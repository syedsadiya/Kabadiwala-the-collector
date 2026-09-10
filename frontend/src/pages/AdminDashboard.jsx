import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AppShell from '../components/AppShell';
import MockMap from '../components/MockMap';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#2d6a4f', '#52796f', '#95d5b2', '#d98e2d', '#b5533c', '#74c69d', '#1b4332'];
const STATUS_LABEL = { REQUESTED: 'Requested', ACCEPTED: 'Accepted', COLLECTED: 'Collected', VERIFIED: 'Verified', SENT_TO_RECYCLER: 'Sent to recycler', RECYCLED: 'Recycled' };
const AP_AREAS = [
  { name: 'Kakinada', lat: 16.9891, lng: 82.2475 },
  { name: 'Rajahmundry', lat: 17.0005, lng: 81.8040 },
  { name: 'Vijayawada', lat: 16.5062, lng: 80.6480 },
  { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
  { name: 'Amaravati', lat: 16.5738, lng: 80.3565 },
];

export default function AdminDashboard() {
  const [sub, setSub] = useState('overview');
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [collectors, setCollectors] = useState([]);
  const [recyclers, setRecyclers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [mapFocus, setMapFocus] = useState(AP_AREAS[0]);

  function focusCity(name) {
    const city = AP_AREAS.find((area) => area.name === name);
    if (city) setMapFocus({ ...city, label: city.name });
  }

  async function refresh() {
    const [statsRes, usersRes, recyclersRes, centersRes] = await Promise.all([
      api.adminStats(token), api.users(token, '?role=collector'), api.recyclers(token), api.centers(token),
    ]);
    setStats(statsRes);
    setCollectors(usersRes.users);
    setRecyclers(recyclersRes.recyclers);
    setCenters(centersRes.centers);
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line

  const links = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'users', label: 'Collectors', icon: '👥' },
    { key: 'recyclers', label: 'Recyclers', icon: '♻️' },
    { key: 'centers', label: 'Centers', icon: '🏭' },
    { key: 'impact', label: 'Impact', icon: '🌱' },
  ];

  if (!stats) return <AppShell roleName="Admin" links={links} active={sub} onNavigate={setSub}><div className="loading-shell">Loading…</div></AppShell>;

  const categoryData = Object.entries(stats.byCategory).map(([id, kg]) => ({ name: id, value: +kg.toFixed(1) })).filter((d) => d.value > 0);
  const statusData = Object.entries(stats.byStatus).map(([status, count]) => ({ name: STATUS_LABEL[status] || status, count }));

  return (
    <AppShell roleName="Admin" links={links} active={sub} onNavigate={setSub}>
      {sub === 'overview' && (
        <>
          <div className="page-head"><div><h1>Overview</h1><p className="sub">Platform-wide activity at a glance.</p></div></div>
          <div className="cards-grid">
            <div className="kpi"><div className="lbl">Collectors</div><div className="val">{stats.kpis.totalCollectors}</div></div>
            <div className="kpi"><div className="lbl">Total waste</div><div className="val">{stats.kpis.totalKg.toFixed(0)} kg</div></div>
            <div className="kpi"><div className="lbl">CO₂e saved</div><div className="val">{stats.kpis.co2.toFixed(0)} kg</div></div>
            <div className="kpi"><div className="lbl">Pickups</div><div className="val">{stats.kpis.totalPickups}</div></div>
            <div className="kpi"><div className="lbl">Completed</div><div className="val">{stats.kpis.completedPickups}</div></div>
          </div>

          <div className="two-col">
            <div className="panel">
              <h3>Waste by category (kg)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={90} label>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="panel">
              <h3>Collections by status</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={statusData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2d6a4f" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <h3>Top collectors</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats.topCollectors} layout="vertical">
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="completed" fill="#52796f" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {sub === 'users' && (
        <>
          <div className="page-head"><div><h1>Collectors</h1><p className="sub">All onboarded kabadiwalas.</p></div></div>
          <MockMap area={mapFocus} focus={mapFocus} hint={`Showing ${mapFocus.name}`} />
          <div className="panel">
            <table>
              <thead><tr><th>Name</th><th>Area</th><th>Rating</th><th>Completed</th><th>Total kg</th><th>Status</th></tr></thead>
              <tbody>
                {collectors.map((c) => (
                  <tr key={c._id}>
                    <td>{c.name}</td><td><button className="map-link" type="button" onClick={() => focusCity(c.area)}>{c.area}</button></td><td>★ {c.rating}</td><td>{c.completed}</td><td>{c.totalWasteKg}</td>
                    <td>{c.verified ? <span className="pill pill-green">Verified</span> : <span className="pill pill-amber">Pending</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sub === 'recyclers' && (
        <>
          <div className="page-head"><div><h1>Recyclers</h1><p className="sub">Authorized recycling partners.</p></div></div>
          <MockMap area={mapFocus} focus={mapFocus} hint={`Showing ${mapFocus.name}`} />
          <div className="panel">
            <table>
              <thead><tr><th>Name</th><th>Location</th><th>Accepts</th><th>Capacity</th><th>Status</th></tr></thead>
              <tbody>
                {recyclers.map((r) => (
                  <tr key={r._id}>
                    <td>{r.name}</td><td><button className="map-link" type="button" onClick={() => focusCity(r.location)}>{r.location}</button></td><td>{r.accepts.join(', ')}</td><td>{r.capacity}</td>
                    <td>{r.verified ? <span className="pill pill-green">Active</span> : <span className="pill pill-clay">{r.status}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sub === 'centers' && (
        <>
          <div className="page-head"><div><h1>Collection centers</h1></div></div>
          <MockMap area={mapFocus} focus={mapFocus} hint={`Showing ${mapFocus.name}`} />
          <div className="cards-grid">
            {centers.map((c) => (
              <div className="panel" key={c._id}>
                <h3 style={{ marginTop: 0 }}>{c.name}</h3>
                <button className="map-link small-muted" type="button" onClick={() => focusCity(c.area)}>{c.area}</button>
                <p>Incoming: <b>{c.incoming}</b> · Outgoing: <b>{c.outgoing}</b></p>
              </div>
            ))}
          </div>
        </>
      )}

      {sub === 'impact' && (
        <>
          <div className="page-head"><div><h1>Environmental impact</h1></div></div>
          <div className="impact-band">
            <div className="impact-item"><div className="num">{stats.kpis.totalKg.toFixed(0)} kg</div><div className="lbl">Recyclable waste collected</div></div>
            <div className="impact-item"><div className="num">{(stats.kpis.totalKg * 0.92).toFixed(0)} kg</div><div className="lbl">Est. diverted from landfill</div></div>
            <div className="impact-item"><div className="num">{stats.kpis.co2.toFixed(0)} kg CO₂e</div><div className="lbl">Estimated impact</div></div>
            <div className="impact-item"><div className="num">{stats.kpis.totalCollectors}</div><div className="lbl">Collectors integrated</div></div>
            <div className="impact-item"><div className="num">{recyclers.length}</div><div className="lbl">Recycling partners</div></div>
          </div>
        </>
      )}
    </AppShell>
  );
}
