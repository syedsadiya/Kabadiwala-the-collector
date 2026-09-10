const router = require('express').Router();
const Collection = require('../models/Collection');
const Pickup = require('../models/Pickup');
const Center = require('../models/Center');
const Recycler = require('../models/Recycler');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

function genCollectionCode() {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `KC-${new Date().getFullYear()}-${rand}`;
}

// POST /api/collections  (collector confirms a collection -> generates QR code id)
router.post('/', requireAuth, requireRole('collector'), async (req, res) => {
  try {
    const { pickupId, weight, quality, amountPaid, paymentMethod, notes, center, recycler } = req.body;
    const pickup = await Pickup.findById(pickupId);
    if (!pickup) return res.status(404).json({ message: 'Pickup not found' });
    if (String(pickup.collector) !== String(req.user.id)) {
      return res.status(403).json({ message: 'You are not assigned to this pickup' });
    }

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

    await Pickup.findByIdAndUpdate(pickup._id, { status: 'COLLECTED' });

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

    res.status(201).json({ collection });
  } catch (err) {
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
router.get('/trace/:code', requireAuth, async (req, res) => {
  try {
    const collection = await Collection.findOne({ collectionCode: req.params.code })
      .populate('customer', 'name area')
      .populate('collector', 'name');
    if (!collection) return res.status(404).json({ message: 'Collection ID not found' });
    res.json({ collection });
  } catch (err) {
    res.status(500).json({ message: 'Trace lookup failed', error: err.message });
  }
});

// PATCH /api/collections/:id/status  (admin advances status: VERIFIED / SENT_TO_RECYCLER / RECYCLED)
router.patch('/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['VERIFIED', 'SENT_TO_RECYCLER', 'RECYCLED'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const collection = await Collection.findByIdAndUpdate(req.params.id, { status }, { new: true });
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
