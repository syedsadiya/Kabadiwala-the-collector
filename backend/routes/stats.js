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

// GET /api/stats/admin  (dashboard charts + KPIs)
router.get('/admin', requireAuth, requireRole('admin'), async (req, res) => {
  const collections = await Collection.find();
  const pickups = await Pickup.find();
  const collectors = await User.find({ role: 'collector' }).select('-password');

  const byCategory = {};
  WASTE_CATEGORIES.forEach((c) => (byCategory[c.id] = 0));
  collections.forEach((c) => (byCategory[c.category] = (byCategory[c.category] || 0) + c.weight));

  const byStatus = {};
  STATUS_FLOW.forEach((s) => (byStatus[s] = 0));
  collections.forEach((c) => (byStatus[c.status] = (byStatus[c.status] || 0) + 1));

  const totalKg = collections.reduce((s, c) => s + (c.weight || 0), 0);
  const co2 = collections.reduce((s, c) => s + (c.co2 || 0), 0);
  const completedPickups = pickups.filter((p) => p.status !== 'REQUESTED').length;

  const topCollectors = [...collectors].sort((a, b) => b.completed - a.completed).slice(0, 6)
    .map((c) => ({ name: c.name, completed: c.completed }));

  res.json({
    kpis: {
      totalCollectors: collectors.length,
      totalKg,
      co2,
      totalPickups: pickups.length,
      completedPickups,
    },
    byCategory,
    byStatus,
    topCollectors,
  });
});

module.exports = router;
