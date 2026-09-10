import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import AppShell from '../components/AppShell';
import MockMap from '../components/MockMap';
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

export default function CollectorDashboard() {
  const [sub, setSub] = useState('requests');
  const { user, token } = useAuth();
  const toast = useToast();
  const [pickups, setPickups] = useState([]);
  const [collections, setCollections] = useState([]);
  const [modalPickup, setModalPickup] = useState(null);
  const [lastQr, setLastQr] = useState(null);
  const [centers, setCenters] = useState([]);
  const [recyclers, setRecyclers] = useState([]);
  const [mapFocus, setMapFocus] = useState(null);

  const area = AP_AREAS.find((a) => a.name === user?.area) || AP_AREAS[0];

  async function refresh() {
    const [{ pickups }, { collections }, { centers }, { recyclers }] = await Promise.all([
      api.myPickups(token), api.myCollections(token), api.centers(token), api.recyclers(token),
    ]);
    setPickups(pickups);
    setCollections(collections);
    setCenters(centers);
    setRecyclers(recyclers);
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line

  async function accept(id) {
    try { await api.acceptPickup(token, id); toast('Pickup accepted'); refresh(); }
    catch (err) { toast(err.message); }
  }

  const requested = pickups.filter((p) => p.status === 'REQUESTED');
  const myActive = pickups.filter((p) => p.status === 'ACCEPTED');

  const links = [
    { key: 'requests', label: 'Nearby Requests', icon: '📥' },
    { key: 'earnings', label: 'Earnings', icon: '💰' },
    { key: 'profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <AppShell roleName="Kabadiwala" links={links} active={sub} onNavigate={setSub}>
      {sub === 'requests' && (
        <>
          <div className="page-head"><div><h1>Nearby requests</h1><p className="sub">Accept a request, then confirm the collection once weighed.</p></div></div>

          <MockMap
            area={area}
            focus={mapFocus}
            markers={requested.map((p) => ({
              lat: p.lat,
              lng: p.lng,
              title: p.customer?.name,
              category: p.category,
              qtyEst: p.qtyEst,
              address: p.address,
              status: p.status,
            }))}
            hint={`${requested.length} open request(s) near ${user?.area}`}
          />

          <h3 style={{ marginTop: 22 }}>Open requests</h3>
          {requested.length === 0 && <div className="empty-state">No open requests right now.</div>}
          {requested.map((p) => (
            <div className="request-card" key={p._id}>
              <div>
                <div style={{ fontWeight: 700 }}>{p.customer?.name}</div>
                <div className="meta">
                  {p.category} · ~{p.qtyEst} kg ·{' '}
                  <button
                    className="map-link"
                    type="button"
                    onClick={() => setMapFocus({ lat: p.lat, lng: p.lng, label: p.address })}
                  >
                    {p.address}
                  </button>
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => accept(p._id)}>Accept</button>
            </div>
          ))}

          <h3 style={{ marginTop: 22 }}>My accepted pickups</h3>
          {myActive.length === 0 && <div className="empty-state">Nothing accepted yet.</div>}
          {myActive.map((p) => (
            <div className="request-card" key={p._id}>
              <div>
                <div style={{ fontWeight: 700 }}>{p.customer?.name}</div>
                <div className="meta">
                  {p.category} · ~{p.qtyEst} kg ·{' '}
                  <button
                    className="map-link"
                    type="button"
                    onClick={() => setMapFocus({ lat: p.lat, lng: p.lng, label: p.address })}
                  >
                    {p.address}
                  </button>
              </div>
                </div>
              <button className="btn btn-amber btn-sm" onClick={() => setModalPickup(p)}>Mark as collected</button>
            </div>
          ))}
        </>
      )}

      {sub === 'earnings' && (
        <>
          <div className="page-head"><div><h1>Earnings</h1><p className="sub">Your collection activity and payouts.</p></div></div>
          <div className="cards-grid">
            <div className="kpi"><div className="lbl">Today</div><div className="val">₹{user?.earningsToday ?? 0}</div></div>
            <div className="kpi"><div className="lbl">This week</div><div className="val">₹{user?.earningsWeek ?? 0}</div></div>
            <div className="kpi"><div className="lbl">This month</div><div className="val">₹{user?.earningsMonth ?? 0}</div></div>
            <div className="kpi"><div className="lbl">All time</div><div className="val">₹{user?.earningsTotal ?? 0}</div></div>
          </div>
          <div className="panel">
            <h3>Completed collections</h3>
            {collections.length === 0 && <div className="empty-state">No collections recorded yet.</div>}
            {collections.length > 0 && (
              <table>
                <thead><tr><th>Collection ID</th><th>Category</th><th>Weight</th><th>Paid</th><th>Method</th></tr></thead>
                <tbody>
                  {collections.map((c) => (
                    <tr key={c._id}>
                      <td>{c.collectionCode}</td><td>{c.category}</td><td>{c.weight} kg</td><td>₹{c.amountPaid}</td><td>{c.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {sub === 'profile' && (
        <>
          <div className="page-head"><div><h1>Profile</h1></div></div>
          <div className="panel">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <div className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
                {(user?.name || '?').split(' ').map((w) => w[0]).join('')}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{user?.name} {user?.verified && <span className="badge-verified">✓ Verified</span>}</div>
                <div className="small-muted">★ {user?.rating} · {user?.completed} pickups completed</div>
              </div>
            </div>
            <p><b>Phone:</b> {user?.phone}</p>
            <p><b>Area:</b> {user?.area}</p>
            <p><b>Categories handled:</b> {(user?.categories || []).join(', ')}</p>
            <p><b>Total waste collected:</b> {user?.totalWasteKg} kg</p>
            {user?.badges?.length > 0 && <p><b>Badges:</b> {user.badges.join(', ')}</p>}
          </div>
        </>
      )}

      {modalPickup && (
        <CollectModal
          pickup={modalPickup}
          centers={centers}
          recyclers={recyclers}
          onClose={() => setModalPickup(null)}
          onConfirmed={(collection) => {
            setModalPickup(null);
            setLastQr(collection);
            toast('Collection confirmed — QR generated');
            refresh();
          }}
        />
      )}

      {lastQr && (
        <div className="modal-bg" onClick={() => setLastQr(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-x" onClick={() => setLastQr(null)}>✕</button>
            <h3>Collection confirmed</h3>
            <div className="qr-wrap">
              <QRCodeSVG value={lastQr.collectionCode} size={140} fgColor="#1b4332" />
              <p className="small-muted" style={{ margin: '8px 0 0' }}>{lastQr.collectionCode}</p>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function CollectModal({ pickup, centers, recyclers, onClose, onConfirmed }) {
  const { token } = useAuth();
  const toast = useToast();
  const [weight, setWeight] = useState('');
  const [quality, setQuality] = useState('Good');
  const [method, setMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [center, setCenter] = useState(centers[0]?.name || '');
  const [recycler, setRecycler] = useState(recyclers.find((r) => r.accepts.includes(pickup.category))?.name || recyclers[0]?.name || '');
  const [busy, setBusy] = useState(false);

  const rate = { paper: 12, cardboard: 10, plastic: 25, metal: 45, glass: 8, ewaste: 60, mixed: 9 }[pickup.category] || 10;
  const amount = weight ? (weight * rate).toFixed(0) : '';

  async function confirm() {
    if (!weight || parseFloat(weight) <= 0) return toast('Enter the actual weight');
    setBusy(true);
    try {
      const { collection } = await api.confirmCollection(token, {
        pickupId: pickup._id, weight: parseFloat(weight), quality, amountPaid: parseFloat(amount || 0),
        paymentMethod: method, notes, center, recycler,
      });
      onConfirmed(collection);
    } catch (err) { toast(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-x" onClick={onClose}>✕</button>
        <h3>Mark as collected</h3>
        <p className="small-muted">{pickup.customer?.name} · {pickup.address}</p>
        <div className="field"><label>Waste category</label><input disabled value={pickup.category} /></div>
        <div className="row2">
          <div className="field"><label>Actual weight (kg)</label><input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
          <div className="field"><label>Material quality</label>
            <select value={quality} onChange={(e) => setQuality(e.target.value)}>
              {['Excellent', 'Good', 'Average'].map((q) => <option key={q}>{q}</option>)}
            </select>
          </div>
        </div>
        <div className="row2">
          <div className="field"><label>Amount paid (₹)</label><input value={amount} readOnly /></div>
          <div className="field"><label>Payment method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {['Cash', 'UPI'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="row2">
          <div className="field"><label>Collection center</label>
            <select value={center} onChange={(e) => setCenter(e.target.value)}>
              {centers.map((c) => <option key={c._id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Recycler</label>
            <select value={recycler} onChange={(e) => setRecycler(e.target.value)}>
              {recyclers.map((r) => <option key={r._id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>Notes (optional)</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <button className="btn btn-primary btn-block" disabled={busy} onClick={confirm}>
          {busy ? 'Saving…' : 'Confirm collection & generate QR'}
        </button>
      </div>
    </div>
  );
}
