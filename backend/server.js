require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const { WASTE_CATEGORIES, AP_AREAS } = require('./constants');
const User = require('./models/User');

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim());
app.use(cors({ origin: allowedOrigins }));
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

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong', error: err.message });
});

const PORT = process.env.PORT || 5000;
async function ensureDemoUsers() {
  if (await User.countDocuments() > 0) return;

  const password = await bcrypt.hash('demo1234', 10);
  await User.insertMany([
    { role: 'customer', name: 'Anita Sharma', email: 'customer@kabadiwalaconnect.demo', password },
    { role: 'collector', name: 'Ramesh Yadav', email: 'collector@kabadiwalaconnect.demo', password },
    { role: 'admin', name: 'Admin', email: 'admin@kabadiwalaconnect.demo', password },
  ]);
  console.log('Created demo users');
}

connectDB().then(async () => {
  await ensureDemoUsers();
  app.listen(PORT, () => console.log(`Kabadiwala Connect API running on port ${PORT}`));
});
