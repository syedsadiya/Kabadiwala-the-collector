const router = require('express').Router();
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { AP_AREAS, WASTE_CATEGORIES } = require('../constants');

// GET /api/users?role=collector  (admin only — contains contact details)
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.area) filter.area = req.query.area;
  const users = await User.find(filter).select('-password').sort('-createdAt');
  res.json({ users });
});

// PATCH /api/users/me  (update own profile; collectors can also change categories / availability)
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const update = {};
    const { name, phone, area, categories, available } = req.body;
    if (name !== undefined) {
      const n = String(name).trim();
      if (n.length < 2 || n.length > 80) return res.status(400).json({ message: 'Enter your full name (2–80 characters)' });
      update.name = n;
    }
    if (phone !== undefined) {
      const p = String(phone).replace(/[\s-]/g, '');
if (p && !/^\+?\d{10,13}$/.test(p)) {
  return res.status(400).json({
    message: 'Enter a valid phone number (10–13 digits, optional + prefix)'
  });
}      update.phone = p || null;
    }
    if (area !== undefined) {
      const a = AP_AREAS.find((x) => x.name === area);
      if (!a) return res.status(400).json({ message: 'Choose one of the supported areas' });
      update.area = a.name; update.lat = a.lat; update.lng = a.lng;
    }
    if (req.user.role === 'collector') {
      if (categories !== undefined) {
        const valid = WASTE_CATEGORIES.map((c) => c.id);
        const cats = (Array.isArray(categories) ? categories : []).filter((c) => valid.includes(c));
        if (!cats.length) return res.status(400).json({ message: 'Select at least one waste category' });
        update.categories = cats;
      }
      if (available !== undefined) update.available = available ? 1 : 0;
    }
    if (!Object.keys(update).length) return res.status(400).json({ message: 'Nothing to update' });
    const user = await User.findByIdAndUpdate(req.user.id, update);
    const obj = { ...user }; delete obj.password;
    res.json({ user: obj });
  } catch (err) {
    res.status(500).json({ message: 'Could not update profile', error: err.message });
  }
});

router.patch('/:id/verify', requireAuth, requireRole('admin'), async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { verified: !!req.body.verified });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const obj = { ...user }; delete obj.password;
  res.json({ user: obj });
});

module.exports = router;
