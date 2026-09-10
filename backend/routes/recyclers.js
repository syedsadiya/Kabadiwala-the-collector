const router = require('express').Router();
const Recycler = require('../models/Recycler');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const recyclers = await Recycler.find().sort('-createdAt');
  res.json({ recyclers });
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const recycler = await Recycler.create(req.body);
  res.status(201).json({ recycler });
});

router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const recycler = await Recycler.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!recycler) return res.status(404).json({ message: 'Recycler not found' });
  res.json({ recycler });
});

module.exports = router;
