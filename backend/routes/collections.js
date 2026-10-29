const router = require('express').Router();
const Collection = require('../models/Collection');
const Pickup = require('../models/Pickup');
const Center = require('../models/Center');
const { db, hydrate } = require('../models/sqlModel');
const { requireAuth, requireRole } = require('../middleware/auth');
const { rateFor } = require('../constants');

function genCollectionCode() {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `KC-${new Date().getFullYear()}-${rand}`;
}

// POST /api/collections  (collector confirms a collection -> generates QR code id)
router.post('/', requireAuth, requireRole('collector'), async (req, res) => {
  try {
    const { pickupId, quality, paymentMethod, notes, center, recycler } = req.body;
    const weight = Number(req.body.weight);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 5000) {
      return res.status(400).json({ message: 'Enter the actual collected weight (kg), greater than 0' });
    }
    if (paymentMethod && !['Cash', 'UPI'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Payment method must be Cash or UPI' });
    }
    const pickup = await Pickup.findById(pickupId);
    if (!pickup) return res.status(404).json({ message: 'Pickup not found' });
    if (String(pickup.collector) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You are not assigned to this pickup' });
    }
    // The amount is computed on the server from the category rate; the client value is not trusted.
    const amountPaid = +(weight * rateFor(pickup.category)).toFixed(0);

    // Atomic claim: ACCEPTED -> COLLECTED exactly once, so a pickup can never be recorded twice.
    const pointsAwarded = Math.round(weight * rateFor(pickup.category));
    const rewardCreatedAt = new Date().toISOString();
    const collection = await db.transaction(async (client) => {
      const claim = await client.query(
        "UPDATE pickups SET status = 'COLLECTED' WHERE id = $1 AND status = 'ACCEPTED' AND collector = $2",
        [pickup._id, req.user.id]
      );
      if (claim.rowCount === 0) {
        const error = new Error('This pickup is not in an accepted state (already collected or cancelled)');
        error.statusCode = 409;
        throw error;
      }

      const collectionResult = await client.query(`
        INSERT INTO collections
          ("collectionCode", pickup, collector, customer, category, weight, quality, "amountPaid",
           "paymentMethod", notes, center, recycler, status, co2, "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'COLLECTED', $13, $14)
        RETURNING *
      `, [
        genCollectionCode(), pickup._id, req.user.id, pickup.customer, pickup.category,
        weight, quality || null, amountPaid, paymentMethod || null, notes || null,
        center || null, recycler || null, +(weight * 1.8).toFixed(1), rewardCreatedAt,
      ]);
      const row = collectionResult.rows[0];

      const rewardResult = await client.query(`
        INSERT INTO reward_transactions
          (customer, pickup, "collectionId", category, weight, points, "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT ("collectionId") DO NOTHING
        RETURNING points
      `, [pickup.customer, pickup._id, row.id, pickup.category, weight, pointsAwarded, rewardCreatedAt]);

      const totals = await client.query(`
        SELECT COALESCE(SUM(points), 0)::int AS "totalPoints", COUNT(*)::int AS "completedPickups"
        FROM reward_transactions WHERE customer = $1
      `, [pickup.customer]);
      const totalPoints = totals.rows[0].totalPoints;
      const completedPickups = totals.rows[0].completedPickups;
      const badgesToCheck = [];
      if (completedPickups >= 1) badgesToCheck.push('first_recycling');
      if (totalPoints >= 100) badgesToCheck.push('eco_warrior');
      if (completedPickups >= 10) badgesToCheck.push('ten_pickups');
      const newBadges = [];
      for (const badgeKey of badgesToCheck) {
        const badge = await client.query(`
          INSERT INTO user_badges ("userId", "badgeKey", "earnedAt")
          VALUES ($1, $2, $3)
          ON CONFLICT ("userId", "badgeKey") DO NOTHING
          RETURNING id
        `, [pickup.customer, badgeKey, rewardCreatedAt]);
        if (badge.rowCount === 1) newBadges.push(badgeKey);
      }
      await client.query(`
        UPDATE users
        SET completed = completed + 1,
            "totalWasteKg" = "totalWasteKg" + $1,
            "earningsToday" = "earningsToday" + $2,
            "earningsWeek" = "earningsWeek" + $2,
            "earningsMonth" = "earningsMonth" + $2,
            "earningsTotal" = "earningsTotal" + $2
        WHERE id = $3
      `, [weight, amountPaid, req.user.id]);
      if (center) {
        await client.query('UPDATE centers SET incoming = incoming + 1 WHERE name = $1', [center]);
      }
      return {
        collection: hydrate(row, []),
        rewards: {
          pointsAwarded: rewardResult.rowCount === 1 ? pointsAwarded : 0,
          totalPoints,
          completedPickups,
          newBadges,
        },
      };
    });

    res.status(201).json(collection);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    res.status(500).json({ message: 'Could not confirm collection', error: err.message });
  }
});

// GET /api/collections/mine
router.get('/mine', requireAuth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'customer') filter.customer = req.user.id;
    if (req.user.role === 'collector') filter.collector = req.user.id;
    const collections = await Collection.find(filter).sort('-createdAt');
    res.json({ collections });
  } catch (err) {
    res.status(500).json({ message: 'Could not load collections', error: err.message });
  }
});

// GET /api/collections/trace/:code  (public-ish traceability lookup by QR code)

router.get('/trace/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim();

    if (!/^KC-\d{4}-\d{6}$/.test(code)) {
      return res.status(400).json({
        message: 'Invalid collection code'
      });
    }

    const [collection] = await Collection.find({
      collectionCode: code
    }).populate('customer', 'name');

    if (!collection) {
      return res.status(404).json({
        message: 'Collection not found'
      });
    }

    // Return only the details needed for the public QR confirmation page.
    res.json({
      collection: {
        collectionCode: collection.collectionCode,
        customerName:
          collection.customer?.name || 'Valued Customer',
        category: collection.category,
        weight: collection.weight,
        status: collection.status,
        co2: collection.co2,
        createdAt: collection.createdAt
      }
    });
  } catch (err) {
    console.error('Collection trace error:', err.message);
    res.status(500).json({
      message: 'Could not load collection details'
    });
  }
});


// PATCH /api/collections/:id/status  (admin advances status: VERIFIED / SENT_TO_RECYCLER / RECYCLED)
router.patch('/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['VERIFIED', 'SENT_TO_RECYCLER', 'RECYCLED'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const collection = await Collection.findByIdAndUpdate(req.params.id, { status });
    if (!collection) return res.status(404).json({ message: 'Collection not found' });
    if (status === 'SENT_TO_RECYCLER' && collection.center) {
      await Center.findOneAndUpdate({ name: collection.center }, { $inc: { outgoing: 1 } });
    }
    res.json({ collection });
  } catch (err) {
    res.status(500).json({ message: 'Could not update status', error: err.message });
  }
});

module.exports = router;
