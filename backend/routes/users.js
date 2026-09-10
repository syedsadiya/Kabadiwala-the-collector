const router = require('express').Router();
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /api/users?role=collector  (admin: manage users; anyone: nearby collectors list)
router.get('/', requireAuth, async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.area) filter.area = req.query.area;
  const users = await User.find(filter).select('-password').sort('-createdAt');
  res.json({ users });
});

router.patch('/:id/verify', requireAuth, requireRole('admin'), async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { verified: !!req.body.verified }, { new: true }).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user });
});

module.exports = router;
