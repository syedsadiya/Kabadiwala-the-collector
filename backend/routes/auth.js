
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AP_AREAS, WASTE_CATEGORIES } = require('../constants');
const { requireAuth } = require('../middleware/auth');

const normalizePhone = (value) =>
  String(value || '').replace(/[\s()-]/g, '');

const validPhone = (phone) => /^\+?\d{10,13}$/.test(phone);
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(user) {
  const obj = { ...user };
  delete obj.password;

  // Hide the internal compatibility email used for phone-only accounts.
  if (String(obj.email || '').endsWith('@phone.kabadiwala.invalid')) {
    obj.email = null;
  }

  return obj;
}

// Register customers and collectors. Admin accounts must be created privately.
router.post('/register', async (req, res) => {
  try {
    const { role, phone, area, address, categories } = req.body;
    const name = String(req.body.name || '').trim();
    const password = String(req.body.password || '');
    const cleanPhone = normalizePhone(phone);

    if (!['customer', 'collector'].includes(role)) {
      return res.status(403).json({
        message: 'Admin registration is not allowed'
      });
    }

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({
        message: 'Enter your full name (2–80 characters)'
      });
    }

    if (!validPhone(cleanPhone)) {
      return res.status(400).json({
        message: 'Enter a valid phone number with 10–13 digits'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters'
      });
    }

    const existingUsers = await User.find({});
    const duplicatePhone = existingUsers.some(
      (u) => normalizePhone(u.phone) === cleanPhone
    );

    if (duplicatePhone) {
      return res.status(409).json({
        message: 'An account with this phone number already exists'
      });
    }

    const areaInfo = AP_AREAS.find((a) => a.name === area);

    if (area && !areaInfo) {
      return res.status(400).json({
        message: 'Choose one of the supported areas'
      });
    }

    let cats = [];

    if (role === 'collector') {
      const validCategories = WASTE_CATEGORIES.map((c) => c.id);
      cats = (Array.isArray(categories) ? categories : [])
        .filter((c) => validCategories.includes(c));

      if (cats.length === 0) {
        return res.status(400).json({
          message: 'Select at least one waste category you collect'
        });
      }

      if (!areaInfo) {
        return res.status(400).json({
          message: 'Select the area you operate in'
        });
      }
    }

    // The current SQLite schema requires a unique email.
    // This reserved internal address allows registration without asking
    // the user for an email or changing the existing database schema.
    const internalEmail =
      `phone-${cleanPhone.replace(/\D/g, '')}@phone.kabadiwala.invalid`;

    const emailExists = await User.findOne({ email: internalEmail });

    if (emailExists) {
      return res.status(409).json({
        message: 'This phone number is already registered'
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      role,
      name,
      email: internalEmail,
      password: hash,
      phone: cleanPhone,
      area: areaInfo?.name || null,
      address: address ? String(address).trim() : null,
      lat: areaInfo ? areaInfo.lat : null,
      lng: areaInfo ? areaInfo.lng : null,
      categories: cats
    });

    res.status(201).json({
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Admins may log in with email; customers and collectors use phone numbers.
router.post('/login', async (req, res) => {
  try {
    const role = String(req.body.role || '').trim();
    const identifier = String(req.body.identifier || req.body.phone || req.body.email || '').trim();
    const password = String(req.body.password || '');

    if (!identifier || !password) {
      return res.status(400).json({
        message: role === 'admin'
          ? 'Enter your admin email and password'
          : 'Enter your phone number and password'
      });
    }

    const users = await User.find({});
    const emailLogin = role === 'admin' || identifier.includes('@');
    const user = emailLogin
      ? users.find((candidate) =>
        (role === 'admin' ? candidate.role === 'admin' : true) &&
        normalizeEmail(candidate.email) === normalizeEmail(identifier)
      )
      : users.find((candidate) =>
        ['customer', 'collector'].includes(candidate.role) &&
        normalizePhone(candidate.phone) === normalizePhone(identifier)
      );

    if (!user) {
      return res.status(401).json({
        message: 'Invalid phone number or password'
      });
    }

    const ok = await bcrypt.compare(password, user.password);

    if (!ok) {
      return res.status(401).json({
        message: 'Invalid phone number or password'
      });
    }

    res.json({
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Get the currently signed-in user.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Could not load user' });
  }
});

module.exports = router;
