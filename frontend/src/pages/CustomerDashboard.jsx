import { useEffect, useRef, useState } from 'react';
import AppShell from '../components/AppShell';
import MockMap from '../components/MockMap';
import Timeline from '../components/Timeline';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const AP_AREAS = [
  { name: 'Kakinada', lat: 16.9891, lng: 82.2475 },
  { name: 'Rajahmundry', lat: 17.0005, lng: 81.8040 },
  { name: 'Vijayawada', lat: 16.5062, lng: 80.6480 },
  { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
  { name: 'Amaravati', lat: 16.5738, lng: 80.3565 },
];

const TIME_SLOTS = ['Morning (9–11 AM)', 'Midday (11 AM–1 PM)', 'Afternoon (2–5 PM)', 'Evening (5–7 PM)'];

const STATUS_LABEL = {
  REQUESTED: 'Requested', ACCEPTED: 'Accepted', COLLECTED: 'Collected',
  VERIFIED: 'Verified', SENT_TO_RECYCLER: 'Sent to recycler', RECYCLED: 'Recycled',
};
const STATUS_ORDER = ['REQUESTED', 'ACCEPTED', 'COLLECTED', 'VERIFIED', 'SENT_TO_RECYCLER', 'RECYCLED'];

export default function CustomerDashboard() {
  const [sub, setSub] = useState('request');
  const { user, token } = useAuth();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [collections, setCollections] = useState([]);
  const [traceOpen, setTraceOpen] = useState(null);
  const [mapFocus, setMapFocus] = useState(null);
  const addressRef = useRef(null);

  const area = AP_AREAS.find((a) => a.name === user?.area) || AP_AREAS[0];

  const [form, setForm] = useState({ category: null, qty: '', time: TIME_SLOTS[0], lat: null, lng: null, address: '' });

  useEffect(() => {
    api.meta().then((m) => setCategories(m.categories)).catch(() => {});
  }, []);

  async function refresh() {
    const [{ pickups }, { collections }] = await Promise.all([api.myPickups(token), api.myCollections(token)]);
    setPickups(pickups);
    setCollections(collections);
  }

  useEffect(() => { refresh(); }, []); // eslint-disable-line

  useEffect(() => {
    const query = form.address.trim();
    if (query.length < 3) return undefined;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
          {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          }
        );
        if (!response.ok) return;
        const [place] = await response.json();
        if (!place) return;

        const lat = Number(place.lat);
        const lng = Number(place.lon);
        setForm((current) => ({ ...current, lat, lng }));
        setMapFocus({ lat, lng, label: place.display_name || query });
      } catch (error) {
        if (error.name !== 'AbortError') return;
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.address]);

  function rateFor(id) { return (categories.find((c) => c.id === id) || {}).rate || 10; }
  const estimate = form.category && form.qty ? (rateFor(form.category) * parseFloat(form.qty || 0)).toFixed(0) : null;

  function nearestArea(lat, lng) {
    return AP_AREAS.reduce((nearest, candidate) => {
      const distance = (candidate.lat - lat) ** 2 + (candidate.lng - lng) ** 2;
      const nearestDistance = (nearest.lat - lat) ** 2 + (nearest.lng - lng) ** 2;
      return distance < nearestDistance ? candidate : nearest;
    });
  }

  async function handleMapPick(lat, lng) {
    const fallback = nearestArea(lat, lng).name;
    setForm((f) => ({ ...f, lat, lng, address: fallback }));
    setMapFocus({ lat, lng, label: fallback });
    addressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    addressRef.current?.focus();

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!response.ok) return;
      const result = await response.json();
      const address = result.display_name || result.address?.city || fallback;
      setForm((f) => ({ ...f, address }));
      setMapFocus({ lat, lng, label: address });
    } catch {
      // Keep the nearest city fallback when reverse geocoding is unavailable.
    }
  }

  async function submitPickup() {
    if (!form.category) return toast('Please select a waste category');
    if (!form.qty || parseFloat(form.qty) <= 0) return toast('Please enter an approximate quantity');
    if (!form.lat) return toast('Please drop a pin on the map for pickup location');
    try {
      await api.submitPickup(token, {
        category: form.category, qtyEst: parseFloat(form.qty), lat: form.lat, lng: form.lng,
        address: form.address || user.address, pickupTime: form.time,
      });
      toast('Pickup request submitted — nearby collectors notified');
      setForm({ category: null, qty: '', time: TIME_SLOTS[0], lat: null, lng: null, address: '' });
      setSub('track');
      refresh();
    } catch (err) { toast(err.message); }
  }

  const links = [
    { key: 'request', label: 'Request Pickup', icon: '➕' },
    { key: 'track', label: 'Track Pickups', icon: '📍' },
    { key: 'history', label: 'History', icon: '🕒' },
  ];

  return (
    <AppShell roleName="Customer" links={links} active={sub} onNavigate={setSub}>
      {sub === 'request' && (
        <>
          <div className="page-head"><div><h1>Request a pickup</h1><p className="sub">Tell us what you have and where to collect it.</p></div></div>

          <div className="panel">
            <h3>1. What are you recycling?</h3>
            <div className="chip-select">
              {categories.map((c) => (
                <button key={c.id} type="button"
                  className={`chip-opt ${form.category === c.id ? 'sel' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, category: c.id }))}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <div className="row2" style={{ marginTop: 14 }}>
              <div className="field">
                <label>Approx. quantity (kg)</label>
                <input type="number" step="0.5" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />
              </div>
              <div className="field">
                <label>Estimated value</label>
                <input disabled value={estimate ? `₹${estimate} (demo rate)` : 'Select category + qty'} />
              </div>
            </div>
            <div className="field">
              <label>Preferred time slot</label>
              <select value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}>
                {TIME_SLOTS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="panel">
            <h3>2. Pickup location</h3>
            <div className="field">
              <label>Address</label>
                <input ref={addressRef} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Flat / street / landmark" />
            </div>
            <MockMap
              area={area}
              pin={form.lat ? { lat: form.lat, lng: form.lng } : null}
              focus={mapFocus}
              onPick={handleMapPick}
              hint={form.lat ? `Pin set: ${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}` : 'Click anywhere to drop your pickup pin'}
            />
            <p className="small-muted" style={{ marginTop: 8 }}>Latitude/longitude is stored with your request and shown to nearby collectors.</p>
          </div>

          <button className="btn btn-primary" onClick={submitPickup}>Submit pickup request</button>
        </>
      )}

      {sub === 'track' && (
        <>
          <div className="page-head"><div><h1>Track pickups</h1><p className="sub">Live status of your active requests.</p></div></div>
          {pickups.filter((p) => p.status !== 'RECYCLED').length === 0 && <div className="empty-state">No active pickups yet.</div>}
          {pickups.filter((p) => p.status !== 'RECYCLED').map((p) => {
            const idx = STATUS_ORDER.indexOf(p.status);
            return (
              <div className="panel" key={p._id}>
                <div className="page-head" style={{ marginBottom: 6 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{p.category} · ~{p.qtyEst} kg</h3>
                    <button
                      className="map-link small-muted"
                      type="button"
                      onClick={() => setMapFocus({ lat: p.lat, lng: p.lng, label: p.address })}
                    >
                      {p.address}
                    </button>
                  </div>
                  <span className="pill pill-green">{STATUS_LABEL[p.status]}</span>
                </div>
                <div className="progress-track">
                  {STATUS_ORDER.map((s, i) => (
                    <div className={`progress-step ${i < idx ? 'done' : ''}`} key={s}>
                      <div className="progress-line" />
                      <div className={`progress-dot ${i < idx ? 'done' : i === idx ? 'current' : ''}`}>{i + 1}</div>
                      <div className="progress-lbl">{STATUS_LABEL[s]}</div>
                    </div>
                  ))}
                </div>
                {p.collector && <p className="small-muted">Collector: {p.collector.name} · ★ {p.collector.rating}</p>}
              </div>
            );
          })}
        </>
      )}

      {sub === 'history' && (
        <>
          <div className="page-head"><div><h1>Collection history</h1><p className="sub">Completed pickups with QR-coded collection IDs.</p></div></div>
          {collections.length === 0 && <div className="empty-state">No collections yet.</div>}
          {collections.length > 0 && (
            <div className="panel">
              <table>
                <thead><tr><th>Collection ID</th><th>Category</th><th>Weight</th><th>Paid</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {collections.map((c) => (
                    <tr key={c._id}>
                      <td>{c.collectionCode}</td>
                      <td>{c.category}</td>
                      <td>{c.weight} kg</td>
                      <td>₹{c.amountPaid}</td>
                      <td><span className="pill pill-green">{STATUS_LABEL[c.status]}</span></td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => setTraceOpen(c)}>Trace</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {traceOpen && (
        <div className="modal-bg" onClick={() => setTraceOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-x" onClick={() => setTraceOpen(null)}>✕</button>
            <h3>Waste journey — {traceOpen.collectionCode}</h3>
            <Timeline collection={{ ...traceOpen, customer: { name: user.name }, collector: pickups.find((p) => p._id === traceOpen.pickup)?.collector }} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
