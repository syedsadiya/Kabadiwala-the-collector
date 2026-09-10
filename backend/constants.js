const WASTE_CATEGORIES = [
  { id: 'paper', label: 'Paper', icon: '📄', rate: 12 },
  { id: 'cardboard', label: 'Cardboard', icon: '📦', rate: 10 },
  { id: 'plastic', label: 'Plastic', icon: '♻️', rate: 25 },
  { id: 'metal', label: 'Metal', icon: '🔩', rate: 45 },
  { id: 'glass', label: 'Glass', icon: '🍾', rate: 8 },
  { id: 'ewaste', label: 'E-waste', icon: '🔌', rate: 60 },
  { id: 'mixed', label: 'Mixed recyclable', icon: '🗑️', rate: 9 },
];

function rateFor(catId) {
  const c = WASTE_CATEGORIES.find((c) => c.id === catId);
  return c ? c.rate : 10;
}

const STATUS_FLOW = ['REQUESTED', 'ACCEPTED', 'COLLECTED', 'VERIFIED', 'SENT_TO_RECYCLER', 'RECYCLED'];

const AP_AREAS = [
  { name: 'Kakinada', lat: 16.9891, lng: 82.2475 },
  { name: 'Rajahmundry', lat: 17.0005, lng: 81.8040 },
  { name: 'Vijayawada', lat: 16.5062, lng: 80.6480 },
  { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
  { name: 'Amaravati', lat: 16.5738, lng: 80.3565 },
];

module.exports = { WASTE_CATEGORIES, rateFor, STATUS_FLOW, AP_AREAS };
