const router = require('express').Router();
const Collection = require('../models/Collection');
const Pickup = require('../models/Pickup');
const Center = require('../models/Center');
const Recycler = require('../models/Recycler');
const User = require('../models/User');
const { db } = require('../models/sqlModel');
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
    const claim = db.prepare("UPDATE pickups SET status = 'COLLECTED' WHERE id = ? AND status = 'ACCEPTED' AND collector = ?")
      .run(pickup._id, req.user.id);
    if (claim.changes === 0) return res.status(409).json({ message: 'This pickup is not in an accepted state (already collected or cancelled)' });

    const collection = await Collection.create({
      collectionCode: genCollectionCode(),
      pickup: pickup._id,
      collector: req.user.id,
      customer: pickup.customer,
      category: pickup.category,
      weight, quality, amountPaid, paymentMethod, notes,
      center, recycler,
      status: 'COLLECTED',
      co2: +(weight * 1.8).toFixed(1),
    });
    
    // Green Rewards: award points to the customer using actual collected weight.
    const pointsAwarded = Math.round(weight * rateFor(pickup.category));
    const rewardCreatedAt = new Date().toISOString();

    // UNIQUE collectionId prevents the same collection earning points twice.
    const rewardResult = db.prepare(`
      INSERT OR IGNORE INTO reward_transactions
        (customer, pickup, collectionId, category, weight, points, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      pickup.customer,
      pickup._id,
      collection._id,
      pickup.category,
      weight,
      pointsAwarded,
      rewardCreatedAt
    );

    const awardedPoints = rewardResult.changes === 1 ? pointsAwarded : 0;

    const totalPoints = db.prepare(`
      SELECT COALESCE(SUM(points), 0) AS total
      FROM reward_transactions
      WHERE customer = ?
    `).get(pickup.customer).total;

    const completedPickups = db.prepare(`
      SELECT COUNT(*) AS total
      FROM reward_transactions
      WHERE customer = ?
    `).get(pickup.customer).total;

    // Badge rules: first successful recycling, 100+ points, and 10 collections.
    const badgesToCheck = [];

    if (completedPickups >= 1) badgesToCheck.push('first_recycling');
    if (totalPoints >= 100) badgesToCheck.push('eco_warrior');
    if (completedPickups >= 10) badgesToCheck.push('ten_pickups');

    const insertBadge = db.prepare(`
      INSERT OR IGNORE INTO user_badges (userId, badgeKey, earnedAt)
      VALUES (?, ?, ?)
    `);

    const newBadges = [];
    for (const badgeKey of badgesToCheck) {
      const result = insertBadge.run(
        pickup.customer,
        badgeKey,
        rewardCreatedAt
      );
      if (result.changes === 1) newBadges.push(badgeKey);
    }


    await User.findByIdAndUpdate(req.user.id, {
      $inc: {
        completed: 1,
        totalWasteKg: weight,
        earningsToday: amountPaid,
        earningsWeek: amountPaid,
        earningsMonth: amountPaid,
        earningsTotal: amountPaid,
      },
    });

    if (center) await Center.findOneAndUpdate({ name: center }, { $inc: { incoming: 1 } });

res.status(201).json({
  collection,
  rewards: {
    pointsAwarded: awardedPoints,
    totalPoints,
    completedPickups,
    newBadges,
  },
});  } catch (err) {
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
