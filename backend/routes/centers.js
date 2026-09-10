const router = require('express').Router();
const Center = require('../models/Center');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const centers = await Center.find().sort('-createdAt');
  res.json({ centers });
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const center = await Center.create(req.body);
  res.status(201).json({ center });
});

module.exports = router;
