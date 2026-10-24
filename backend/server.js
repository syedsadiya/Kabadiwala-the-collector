require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const { WASTE_CATEGORIES, AP_AREAS } = require('./constants');
const User = require('./models/User');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy .env.example to .env and set a long random value.');
  process.exit(1);
}

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim());
app.use(allowedOrigins.includes('*') ? cors() : cors({ origin: allowedOrigins }));
app.options('*', (req, res) => {
  const origin = req.get('Origin');
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
  const requestedHeaders = req.get('Access-Control-Request-Headers');
  if (requestedHeaders) res.setHeader('Access-Control-Allow-Headers', requestedHeaders);
  res.setHeader('Vary', 'Origin, Access-Control-Request-Headers');
  res.sendStatus(204);
});
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'kabadiwala-connect-api' }));
app.get('/api/meta', (req, res) => res.json({ categories: WASTE_CATEGORIES, areas: AP_AREAS }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/pickups', require('./routes/pickups'));
app.use('/api/collections', require('./routes/collections'));
app.use('/api/recyclers', require('./routes/recyclers'));
app.use('/api/centers', require('./routes/centers'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/rewards', require('./routes/rewards'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong', error: err.message });
});

const PORT = process.env.PORT || 5000;
async function ensureDemoUsers() {
  const password = await bcrypt.hash('demo1234', 10);
  const demoUsers = [
    { role: 'customer', name: 'Anita Sharma', email: 'customer@kabadiwalaconnect.demo', phone: '9000000001', password, area: 'Kakinada', lat: 16.9891, lng: 82.2475, address: 'Ward 9, Kakinada, AP' },
    { role: 'collector', name: 'Ramesh Yadav', email: 'collector@kabadiwalaconnect.demo', phone: '9000000002', password, area: 'Kakinada', lat: 16.9891, lng: 82.2475, categories: ['paper', 'plastic', 'metal', 'cardboard'], verified: true },
    { role: 'admin', name: 'Admin', email: 'admin@kabadiwalaconnect.demo', phone: '9000000003', password },
  ];

  if (typeof User.findOne !== 'function') {
    if (await User.countDocuments() === 0 && typeof User.insertMany === 'function') {
      await User.insertMany(demoUsers);
    }
    return;
  }

  for (const demoUser of demoUsers) {
    const existing = await User.findOne({ email: demoUser.email });
    if (!existing) {
      await User.create(demoUser);
    } else if (!existing.phone) {
      await User.findOneAndUpdate({ email: demoUser.email }, { phone: demoUser.phone });
    }
  }
}

connectDB().then(async () => {
  await ensureDemoUsers();
  app.listen(PORT, () => console.log(`Kabadiwala Connect API running on port ${PORT}`));
});