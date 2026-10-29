const router = require('express').Router();
const Pickup = require('../models/Pickup');
const User = require('../models/User');
const { db } = require('../models/sqlModel');
const { requireAuth, requireRole } = require('../middleware/auth');
const { WASTE_CATEGORIES } = require('../constants');
const { matchCollectors, haversineKm, collectorPosition, accepts, WEIGHTS } = require('../services/matching');

const VALID_CATEGORIES = WASTE_CATEGORIES.map((c) => c.id);

function validatePickup(body) {
  const errors = [];
  const { category, qtyEst, lat, lng, address, pickupDate } = body;
  if (!VALID_CATEGORIES.includes(category)) errors.push('Choose a supported waste category');
  const qty = Number(qtyEst);
  if (!Number.isFinite(qty) || qty <= 0) errors.push('Quantity must be a number greater than 0');
  else if (qty > 5000) errors.push('Quantity looks too large (max 5000 kg per request)');
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || lat == null || lng == null
    || Math.abs(lat) > 90 || Math.abs(lng) > 180) errors.push('A valid pickup location pin is required');
  if (!address || String(address).trim().length < 3) errors.push('Pickup address is required');
  if (pickupDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate) || Number.isNaN(Date.parse(pickupDate))) errors.push('Preferred date is invalid');
    else {
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
      if (pickupDate < yesterday) errors.push('Preferred date cannot be in the past');
    }
  }
  return errors;
}

// POST /api/pickups  (customer requests a pickup)
router.post('/', requireAuth, requireRole('customer'), async (req, res) => {
  try {
    const errors = validatePickup(req.body);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const { category, qtyEst, lat, lng, address, pickupTime, pickupDate } = req.body;
    const pickup = await Pickup.create({
      customer: req.user.id, category, qtyEst: Number(qtyEst), lat: Number(lat), lng: Number(lng),
      address: String(address).trim(), pickupTime, pickupDate: pickupDate || null, status: 'REQUESTED',
    });
    res.status(201).json({ pickup });
  } catch (err) {
    res.status(500).json({ message: 'Could not submit pickup request', error: err.message });
  }
});

// GET /api/pickups/mine
//  customer  -> their own requests
//  collector -> open requests for categories they accept (+ ones routed to them) and their own pickups
//  admin     -> everything
router.get('/mine', requireAuth, async (req, res) => {
  try {
    let pickups;
    if (req.user.role === 'customer') {
      pickups = await Pickup.find({ customer: req.user.id })
        .populate('collector', 'name phone rating')
        .populate('preferredCollector', 'name rating area')
        .sort('-createdAt');
    } else if (req.user.role === 'collector') {
      const me = await User.findById(req.user.id);
      const pos = collectorPosition(me);
      const all = await Pickup.find({ $or: [{ status: 'REQUESTED' }, { collector: req.user.id }] })
        .populate('customer', 'name phone area')
        .sort('-createdAt');
      const isMine = (p) => p.collector != null && String(p.collector) === String(me._id);
      pickups = all
        .filter((p) => {
          if (isMine(p)) return true;
          if (p.status !== 'REQUESTED') return false;
          return accepts(me, p.category) || String(p.preferredCollector) === String(me._id);
        })
        .map((p) => {
          const mine = isMine(p);
          const customer = { ...p.customer };
          if (!mine) delete customer.phone; // privacy: phone only after you accept
          return {
            ...p, customer,
            forYou: String(p.preferredCollector) === String(me._id),
            distanceKm: pos && p.lat != null ? +haversineKm(p.lat, p.lng, pos.lat, pos.lng).toFixed(1) : null,
          };
        });
      pickups.sort((a, b) => Number(b.forYou) - Number(a.forYou) || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    } else {
      pickups = await Pickup.find().populate('customer', 'name').populate('collector', 'name').sort('-createdAt');
    }
    res.json({ pickups });
  } catch (err) {
    res.status(500).json({ message: 'Could not load pickups', error: err.message });
  }
});

// Loads a pickup and checks that the caller may manage it (owner customer or admin).
async function loadManageable(req, res) {
  const pickup = await Pickup.findById(req.params.id);
  if (!pickup) { res.status(404).json({ message: 'Pickup not found' }); return null; }
  const isOwner = req.user.role === 'customer' && String(pickup.customer) === String(req.user.id);
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403).json({ message: 'You cannot manage this pickup' });
    return null;
  }
  return pickup;
}

// GET /api/pickups/:id/matches  (ranked, eligible collectors for this request)
router.get('/:id/matches', requireAuth, requireRole('customer', 'admin'), async (req, res) => {
  try {
    const pickup = await loadManageable(req, res);
    if (!pickup) return;
    const collectors = await User.find({ role: 'collector' }).select('-password');
    const { matches, excluded } = matchCollectors(pickup, collectors);
    res.json({
      pickup: { _id: pickup._id, category: pickup.category, status: pickup.status, preferredCollector: pickup.preferredCollector },
      matches, excluded, weights: WEIGHTS,
      message: matches.length ? null : 'No available collector currently accepts this waste category. Your request stays open for any collector to accept.',
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not match collectors', error: err.message });
  }
});

// PATCH /api/pickups/:id/request-collector  { collectorId | null }
// Routes the request to a recommended collector. The collector still has to accept.
router.patch('/:id/request-collector', requireAuth, requireRole('customer', 'admin'), async (req, res) => {
  try {
    const pickup = await loadManageable(req, res);
    if (!pickup) return;
    if (pickup.status !== 'REQUESTED') return res.status(409).json({ message: 'Only open requests can be re-routed' });
    const { collectorId } = req.body;
    if (collectorId == null) {
      const cleared = await Pickup.findByIdAndUpdate(pickup._id, { preferredCollector: null });
      return res.json({ pickup: cleared });
    }
    if (
  !Number.isSafeInteger(Number(collectorId)) ||
  Number(collectorId) <= 0
) {
  return res.status(400).json({
    message: 'Invalid collector ID'
  });
}
    const collectors = await User.find({ role: 'collector' }).select('-password');
    const { matches } = matchCollectors(pickup, collectors);
    if (!matches.some((m) => String(m._id) === String(collectorId))) {
      return res.status(400).json({ message: 'That collector is not eligible for this request' });
    }
    const updated = await Pickup.findByIdAndUpdate(pickup._id, { preferredCollector: Number(collectorId) });
    res.json({ pickup: updated });
  } catch (err) {
    res.status(500).json({ message: 'Could not route request', error: err.message });
  }
});

// PATCH /api/pickups/:id/accept  (collector accepts a request)
router.patch('/:id/accept', requireAuth, requireRole('collector'), async (req, res) => {
  try {
    const pickup = await Pickup.findById(req.params.id);
    if (!pickup) return res.status(404).json({ message: 'Pickup not found' });
    const me = await User.findById(req.user.id);
    if (!me.available) return res.status(409).json({ message: 'Set yourself as Available before accepting pickups' });
    if (!accepts(me, pickup.category)) return res.status(403).json({ message: `Your profile does not include ${pickup.category}` });
    // Atomic claim: only one collector can move REQUESTED -> ACCEPTED.
    const claim = await db.query(
      "UPDATE pickups SET collector = $1, status = 'ACCEPTED' WHERE id = $2 AND status = 'REQUESTED'",
      [req.user.id, pickup._id]
    );
    if (claim.rowCount === 0) return res.status(409).json({ message: 'Pickup was already accepted or cancelled' });
    res.json({ pickup: await Pickup.findById(pickup._id) });
  } catch (err) {
    res.status(500).json({ message: 'Could not accept pickup', error: err.message });
  }
});

// PATCH /api/pickups/:id/cancel
//  customer: only while the request is still open (no silent change after a collector accepted)
//  admin:    open or accepted requests
router.patch('/:id/cancel', requireAuth, requireRole('customer', 'admin'), async (req, res) => {
  try {
    const pickup = await loadManageable(req, res);
    if (!pickup) return;
    const cancellable = req.user.role === 'admin' ? ['REQUESTED', 'ACCEPTED'] : ['REQUESTED'];
    const placeholders = cancellable.map((_, index) => `$${index + 2}`).join(', ');
    const result = await db.query(
      `UPDATE pickups SET status = 'CANCELLED' WHERE id = $1 AND status IN (${placeholders})`,
      [pickup._id, ...cancellable]
    );
    if (result.rowCount === 0) {
      return res.status(409).json({ message: 'This pickup can no longer be cancelled. Contact the collector or an admin.' });
    }
    res.json({ pickup: await Pickup.findById(pickup._id) });
  } catch (err) {
    res.status(500).json({ message: 'Could not cancel pickup', error: err.message });
  }
});

module.exports = router;
