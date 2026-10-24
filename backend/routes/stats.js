const router = require('express').Router();
const User = require('../models/User');
const Pickup = require('../models/Pickup');
const Collection = require('../models/Collection');
const Recycler = require('../models/Recycler');
const { requireAuth, requireRole } = require('../middleware/auth');
const { WASTE_CATEGORIES, STATUS_FLOW } = require('../constants');

// GET /api/stats/public  (used on the landing page, no auth required)
router.get('/public', async (req, res) => {
  const collectors = await User.countDocuments({ role: 'collector' });
  const recyclers = await Recycler.countDocuments({ verified: true });
  const collections = await Collection.find();
  const totalKg = collections.reduce((s, c) => s + (c.weight || 0), 0);
  const co2 = collections.reduce((s, c) => s + (c.co2 || 0), 0);
  res.json({ collectors, recyclers, totalKg, co2 });
});

// CO2e is an ESTIMATE: a flat 1.8 kg CO2e avoided per kg recycled (set when a collection is recorded).
// Replace with category-specific emission factors before making real impact claims.
const CO2_NOTE = 'Estimate: flat 1.8 kg CO2e per kg recorded. Not a measured value.';

// GET /api/stats/admin  (impact dashboard: all numbers come from database records)
router.get('/admin', requireAuth, requireRole('admin'), async (req, res) => {
  const collections = await Collection.find();
  const pickups = await Pickup.find();
  const collectors = await User.find({ role: 'collector' }).select('-password');

  const byCategory = {};
  WASTE_CATEGORIES.forEach((c) => (byCategory[c.id] = 0));
  collections.forEach((c) => (byCategory[c.category] = (byCategory[c.category] || 0) + (c.weight || 0)));

  const byStatus = {};
  STATUS_FLOW.forEach((s) => (byStatus[s] = 0));
  collections.forEach((c) => (byStatus[c.status] = (byStatus[c.status] || 0) + 1));

  // Pickup request pipeline: how many requests are in each stage right now.
  const pickupStatus = { REQUESTED: 0, ACCEPTED: 0, COLLECTED: 0, CANCELLED: 0 };
  pickups.forEach((p) => {
    const key = ['REQUESTED', 'ACCEPTED', 'CANCELLED'].includes(p.status) ? p.status : 'COLLECTED';
    pickupStatus[key] += 1;
  });

  // Last 6 calendar months (including empty ones) of recorded collections.
  const months = [];
  const base = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }), pickups: 0, kg: 0 });
  }
  collections.forEach((c) => {
    const m = months.find((x) => x.key === String(c.createdAt).slice(0, 7));
    if (m) { m.pickups += 1; m.kg = +(m.kg + (c.weight || 0)).toFixed(1); }
  });

  const totalKg = collections.reduce((s, c) => s + (c.weight || 0), 0);
  const co2 = collections.reduce((s, c) => s + (c.co2 || 0), 0);
  const topCollectors = [...collectors].sort((a, b) => b.completed - a.completed).slice(0, 6)
    .map((c) => ({ name: c.name, completed: c.completed }));

  res.json({
    kpis: {
      totalCollectors: collectors.length,
      availableCollectors: collectors.filter((c) => c.available).length,
      totalKg,
      co2,
      totalPickups: pickups.length,
      completedPickups: collections.length,        // a pickup is "completed" once its weight is recorded
      pendingPickups: pickupStatus.REQUESTED,
      acceptedPickups: pickupStatus.ACCEPTED,
    },
    byCategory,
    byStatus,
    pickupStatus,
    monthly: months,
    topCollectors,
    co2Note: CO2_NOTE,
  });
});

// GET /api/stats/mine  (small summary for customer / collector dashboards)
router.get('/mine', requireAuth, requireRole('customer', 'collector'), async (req, res) => {
  const field = req.user.role === 'customer' ? 'customer' : 'collector';
  const pickups = await Pickup.find({ [field]: req.user.id });
  const collections = await Collection.find({ [field]: req.user.id });
  res.json({
    pending: pickups.filter((p) => p.status === 'REQUESTED').length,
    accepted: pickups.filter((p) => p.status === 'ACCEPTED').length,
    completed: collections.length,
    cancelled: pickups.filter((p) => p.status === 'CANCELLED').length,
    totalKg: +collections.reduce((s, c) => s + (c.weight || 0), 0).toFixed(1),
  });
});

module.exports = router;
