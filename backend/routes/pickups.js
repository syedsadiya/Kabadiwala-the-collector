const router = require('express').Router();
const Pickup = require('../models/Pickup');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

// POST /api/pickups  (customer requests a pickup)
router.post('/', requireAuth, requireRole('customer'), async (req, res) => {
  try {
    const { category, qtyEst, lat, lng, address, pickupTime } = req.body;
    if (!category || !qtyEst || lat == null || lng == null) {
      return res.status(400).json({ message: 'category, qtyEst and a map pin (lat/lng) are required' });
    }
    const pickup = await Pickup.create({
      customer: req.user.id, category, qtyEst, lat, lng, address, pickupTime, status: 'REQUESTED',
    });
    res.status(201).json({ pickup });
  } catch (err) {
    res.status(500).json({ message: 'Could not submit pickup request', error: err.message });
  }
});

// GET /api/pickups/mine  (customer: their requests / collector: requested+accepted-by-me)
router.get('/mine', requireAuth, async (req, res) => {
  try {
    let pickups;
    if (req.user.role === 'customer') {
      pickups = await Pickup.find({ customer: req.user.id }).populate('collector', 'name phone rating').sort('-createdAt');
    } else if (req.user.role === 'collector') {
      pickups = await Pickup.find({
        $or: [{ status: 'REQUESTED' }, { collector: req.user.id }],
      }).populate('customer', 'name phone address area').sort('-createdAt');
    } else {
      pickups = await Pickup.find().populate('customer', 'name').populate('collector', 'name').sort('-createdAt');
    }
    res.json({ pickups });
  } catch (err) {
    res.status(500).json({ message: 'Could not load pickups', error: err.message });
  }
});

// PATCH /api/pickups/:id/accept  (collector accepts a request)
router.patch('/:id/accept', requireAuth, requireRole('collector'), async (req, res) => {
  try {
    const pickup = await Pickup.findById(req.params.id);
    if (!pickup) return res.status(404).json({ message: 'Pickup not found' });
    if (pickup.status !== 'REQUESTED') return res.status(409).json({ message: 'Pickup already accepted' });
    const updatedPickup = await Pickup.findByIdAndUpdate(req.params.id, {
      collector: req.user.id,
      status: 'ACCEPTED',
    });
    res.json({ pickup: updatedPickup });
  } catch (err) {
    res.status(500).json({ message: 'Could not accept pickup', error: err.message });
  }
});

module.exports = router;
