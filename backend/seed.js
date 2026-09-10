// Populates the local SQLite database with demo accounts and sample
// activity, mirroring the original single-file prototype's seed data.
// Run with: npm run seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');
const Recycler = require('./models/Recycler');
const Center = require('./models/Center');
const Pickup = require('./models/Pickup');
const Collection = require('./models/Collection');
const { AP_AREAS, rateFor } = require('./constants');

const FIRST_NAMES = ['Ravi', 'Sunita', 'Anil', 'Priya', 'Kiran', 'Lakshmi', 'Suresh', 'Divya', 'Manoj', 'Aruna'];
const LAST_NAMES = ['Kumar', 'Reddy', 'Naidu', 'Rao', 'Varma', 'Prasad', 'Sharma', 'Devi', 'Babu', 'Chowdary'];
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randName = () => `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`;
const randPhone = () => '9' + Math.floor(100000000 + Math.random() * 899999999);
const jitter = (base, spread) => base + (Math.random() - 0.5) * spread;

async function run() {
  await connectDB();
  console.log('Clearing existing demo collections...');
  await Collection.deleteMany({});
  await Pickup.deleteMany({});
  await Promise.all([User.deleteMany({}), Recycler.deleteMany({}), Center.deleteMany({})]);

  const demoPassword = await bcrypt.hash('demo1234', 10);

  console.log('Seeding centers...');
  const centers = await Center.insertMany([
    { name: 'Kakinada Ward-9 Collection Center', area: 'Kakinada' },
    { name: 'Rajahmundry Sorting Hub', area: 'Rajahmundry' },
    { name: 'Vijayawada Aggregation Point', area: 'Vijayawada' },
  ]);

  console.log('Seeding recyclers...');
  const recyclers = await Recycler.insertMany([
    { name: 'GreenLoop Recyclers Pvt Ltd', location: 'Kakinada', accepts: ['plastic', 'mixed'], contact: '0884-2345 678', verified: true, capacity: '2,000 kg/day', status: 'Active' },
    { name: 'Andhra Metal Reclaim Co.', location: 'Rajahmundry', accepts: ['metal', 'ewaste'], contact: '0883-2233 445', verified: true, capacity: '1,200 kg/day', status: 'Active' },
    { name: 'EcoPaper Processing Unit', location: 'Vijayawada', accepts: ['paper', 'cardboard'], contact: '0866-2556 890', verified: false, capacity: '900 kg/day', status: 'Pending verification' },
    { name: 'ClearGlass Recyclers', location: 'Vijayawada', accepts: ['glass'], contact: '0866-2778 112', verified: true, capacity: '600 kg/day', status: 'Active' },
    { name: 'CircuitCycle E-Waste Facility', location: 'Visakhapatnam', accepts: ['ewaste'], contact: '0891-2990 334', verified: true, capacity: '400 kg/day', status: 'Active' },
  ]);

  console.log('Seeding admin...');
  await User.create({ role: 'admin', name: 'Admin', email: 'admin@kabadiwalaconnect.demo', password: demoPassword });

  console.log('Seeding customers...');
  const customers = [];
  for (let i = 0; i < 10; i++) {
    const area = AP_AREAS[i % AP_AREAS.length];
    const c = await User.create({
      role: 'customer',
      name: i === 0 ? 'Anita Sharma' : randName(),
      email: i === 0 ? 'customer@kabadiwalaconnect.demo' : `customer${i}@kabadiwalaconnect.demo`,
      password: demoPassword,
      phone: randPhone(),
      area: area.name,
      lat: jitter(area.lat, 0.02),
      lng: jitter(area.lng, 0.02),
      address: `${12 + i}-${3 + i}-${100 + i}, ${['Gandhi Nagar', 'Ward 9', 'Main Road', 'Temple Street', 'Jawahar Colony'][i % 5]}, ${area.name}, AP`,
    });
    customers.push(c);
  }

  console.log('Seeding collectors...');
  const catPool = ['paper', 'plastic', 'metal', 'glass', 'ewaste', 'cardboard', 'mixed'];
  const collectors = [];
  for (let i = 0; i < 8; i++) {
    const area = AP_AREAS[i % AP_AREAS.length];
    const c = await User.create({
      role: 'collector',
      name: i === 0 ? 'Ramesh Yadav' : randName(),
      email: i === 0 ? 'collector@kabadiwalaconnect.demo' : `collector${i}@kabadiwalaconnect.demo`,
      password: demoPassword,
      phone: randPhone(),
      area: area.name,
      lat: jitter(area.lat, 0.02),
      lng: jitter(area.lng, 0.02),
      verified: i !== 6,
      rating: +(3.6 + Math.random() * 1.3).toFixed(1),
      completed: 20 + Math.floor(Math.random() * 160),
      totalWasteKg: 300 + Math.floor(Math.random() * 2200),
      categories: [catPool[i % 7], catPool[(i + 2) % 7], catPool[(i + 4) % 7]],
      earningsToday: Math.floor(Math.random() * 1200),
      earningsWeek: Math.floor(Math.random() * 4000),
      earningsMonth: Math.floor(Math.random() * 12000),
      earningsTotal: 4000 + Math.floor(Math.random() * 38000),
      badges: i % 3 === 0 ? ['Safety Trained', 'SWM Certified'] : i % 2 === 0 ? ['SWM Certified'] : [],
    });
    collectors.push(c);
  }

  console.log('Seeding historical pickups + collections...');
  for (let i = 0; i < 20; i++) {
    const cust = customers[i % customers.length];
    const cat = catPool[i % catPool.length];
    const collector = collectors[i % collectors.length];
    let status = 'RECYCLED';
    if (i >= 17) status = 'SENT_TO_RECYCLER';
    if (i >= 19) status = 'VERIFIED';

    const pickup = await Pickup.create({
      customer: cust._id,
      collector: collector._id,
      category: cat,
      qtyEst: +(2 + Math.random() * 8).toFixed(1),
      lat: jitter(cust.lat, 0.002),
      lng: jitter(cust.lng, 0.002),
      address: cust.address,
      pickupTime: 'Morning (9–11 AM)',
      status,
    });

    const weight = +(2 + Math.random() * 10).toFixed(1);
    const rec = recyclers.find((r) => r.accepts.includes(cat)) || recyclers[0];
    const center = centers[i % centers.length];
    await Collection.create({
      collectionCode: `KC-2026-${String(100000 + i).slice(-6)}`,
      pickup: pickup._id,
      collector: collector._id,
      customer: cust._id,
      category: cat,
      weight,
      quality: ['Good', 'Average', 'Excellent'][i % 3],
      amountPaid: +(weight * rateFor(cat)).toFixed(0),
      paymentMethod: i % 2 === 0 ? 'Cash' : 'UPI',
      center: center.name,
      recycler: rec.name,
      status,
      co2: +(weight * 1.8).toFixed(1),
    });
    center.incoming += 1;
    if (status !== 'COLLECTED') center.outgoing += 1;
    await center.save();
  }

  console.log('\nDone! Demo accounts (password for all: demo1234):');
  console.log('  customer@kabadiwalaconnect.demo');
  console.log('  collector@kabadiwalaconnect.demo');
  console.log('  admin@kabadiwalaconnect.demo');
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
