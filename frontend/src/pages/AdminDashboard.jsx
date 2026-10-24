import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AppShell from '../components/AppShell';
import MockMap from '../components/MockMap';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { AP_AREAS, STATUS_LABEL } from '../constants';

const COLORS = ['#2d6a4f', '#52796f', '#95d5b2', '#d98e2d', '#b5533c', '#74c69d', '#1b4332'];
export default function AdminDashboard() {
  const [sub, setSub] = useState('overview');
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [collectors, setCollectors] = useState([]);
  const [recyclers, setRecyclers] = useState([]);
  const [centers, setCenters] = useState([]);
  const [mapFocus, setMapFocus] = useState(AP_AREAS[0]);

  function focusCity(name) {
    const city = AP_AREAS.find((area) => area.name === name);
    if (city) setMapFocus({ ...city, label: city.name });
  }

  async function refresh() {
    try {
    const [statsRes, usersRes, recyclersRes, centersRes] = await Promise.all([
      api.adminStats(token), api.users(token, '?role=collector'), api.recyclers(token), api.centers(token),
    ]);
    setStats(statsRes);
    setCollectors(usersRes.users);
    setRecyclers(recyclersRes.recyclers);
    setCenters(centersRes.centers);
    } catch (err) { setError(err.message); }
  }
    async function verifyCollector(collectorId) {
    try {
      await api.verifyCollector(token, collectorId);
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not verify collector');
    }
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line

  const links = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'users', label: 'Collectors', icon: '👥' },
    { key: 'recyclers', label: 'Recyclers', icon: '♻️' },
    { key: 'centers', label: 'Centers', icon: '🏭' },
    { key: 'impact', label: 'Impact', icon: '🌱' },
  ];

  if (!stats) return <AppShell roleName="Admin" links={links} active={sub} onNavigate={setSub}><div className="loading-shell">{error || 'Loading…'}</div></AppShell>;

  const categoryData = Object.entries(stats.byCategory).map(([id, kg]) => ({ name: id, value: +kg.toFixed(1) })).filter((d) => d.value > 0);
  const statusData = Object.entries(stats.byStatus).map(([status, count]) => ({ name: STATUS_LABEL[status] || status, count }));
  const pipelineData = Object.entries(stats.pickupStatus).map(([status, count]) => ({ name: STATUS_LABEL[status] || status, count }));
  const PIPE_COLORS = { Requested: '#d98e2d', Accepted: '#2563eb', Collected: '#2d6a4f', Cancelled: '#9aa5a0' };

  return (
    <AppShell roleName="Admin" links={links} active={sub} onNavigate={setSub}>
      {sub === 'overview' && (
        <>
          <div className="page-head"><div><h1>Overview</h1><p className="sub">Platform-wide activity at a glance.</p></div></div>
          <div className="cards-grid">
            <div className="kpi"><div className="lbl">Completed pickups</div><div className="val">{stats.kpis.completedPickups}</div></div>
            <div className="kpi"><div className="lbl">Waste collected</div><div className="val">{stats.kpis.totalKg.toFixed(0)} kg</div></div>
            <div className="kpi"><div className="lbl">Pending pickups</div><div className="val">{stats.kpis.pendingPickups}</div></div>
            <div className="kpi"><div className="lbl">Accepted, not collected</div><div className="val">{stats.kpis.acceptedPickups}</div></div>
            <div className="kpi"><div className="lbl">Collectors available</div><div className="val">{stats.kpis.availableCollectors}/{stats.kpis.totalCollectors}</div></div>
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

          <div className="two-col">
            <div className="panel">
              <h3>Monthly collections (completed pickups)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6e2d3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pickups" name="Pickups" stroke="#2d6a4f" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="panel">
              <h3>Pickup requests by status</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={pipelineData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Requests">
                    {pipelineData.map((d) => <Cell key={d.name} fill={PIPE_COLORS[d.name] || '#2d6a4f'} />)}
                  </Bar>
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
<thead>
  <tr>
    <th>Name</th>
    <th>Area</th>
    <th>Rating</th>
    <th>Completed</th>
    <th>Total kg</th>
    <th>Status</th>
    <th>Action</th>
  </tr>
</thead>              <tbody>
                {collectors.map((c) => (
                  <tr key={c._id}>
                    <td>{c.name}</td><td><button className="map-link" type="button" onClick={() => focusCity(c.area)}>{c.area}</button></td><td>★ {c.rating}</td><td>{c.completed}</td><td>{c.totalWasteKg}</td>
<td>
  {c.verified
    ? <span className="pill pill-green">Verified</span>
    : <span className="pill pill-amber">Pending</span>}
</td>
<td>
  {!c.verified && (
    <button
      type="button"
      onClick={() => verifyCollector(c._id)}
    >
      Verify
    </button>
  )}
</td>                  </tr>
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
            <div className="impact-item"><div className="num">{stats.kpis.completedPickups}</div><div className="lbl">Completed pickups</div></div>
            <div className="impact-item"><div className="num">{stats.kpis.co2.toFixed(0)} kg CO₂e</div><div className="lbl">Estimated, not measured</div></div>
            <div className="impact-item"><div className="num">{stats.kpis.totalCollectors}</div><div className="lbl">Collectors integrated</div></div>
            <div className="impact-item"><div className="num">{recyclers.length}</div><div className="lbl">Recycling partners</div></div>
          </div>
          <p className="small-muted" style={{ marginTop: 14 }}>
            Weights come from recorded collections in the database. CO₂e is an estimate: {stats.co2Note.replace('Estimate: ', '')}
            {' '}Seeded demo records are sample data, not real impact.
          </p>
        </>
      )}
    </AppShell>
  );
}
