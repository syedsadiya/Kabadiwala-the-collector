import { useEffect, useRef, useState } from 'react';
import AppShell from '../components/AppShell';
import ChatWidget from '../components/ChatWidget';
import MockMap from '../components/MockMap';
import Timeline from '../components/Timeline';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { AP_AREAS, STATUS_LABEL, STATUS_PILL, PICKUP_STEPS } from '../constants';

const TIME_SLOTS = ['Morning (9–11 AM)', 'Midday (11 AM–1 PM)', 'Afternoon (2–5 PM)', 'Evening (5–7 PM)'];

const STATUS_ORDER = PICKUP_STEPS;
const today = () => new Date().toISOString().slice(0, 10);

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

  const [form, setForm] = useState({ category: null, qty: '', time: TIME_SLOTS[0], date: '', lat: null, lng: null, address: '' });
  const [stats, setStats] = useState(null);
  const [matchFor, setMatchFor] = useState(null);   // pickup id whose matches are open
  const [matchData, setMatchData] = useState(null);
  const [matchBusy, setMatchBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rewards, setRewards] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState('');

  useEffect(() => {
    api.meta().then((m) => setCategories(m.categories)).catch(() => {});
  }, []);

  async function refresh() {
    try {
      const [{ pickups }, { collections }, st] = await Promise.all([api.myPickups(token), api.myCollections(token), api.myStats(token)]);
      setPickups(pickups);
      setCollections(collections);
      setStats(st);
      setLoadError('');
    } catch (err) { setLoadError(err.message); }
  }

  const catLabel = (id) => { const c = categories.find((x) => x.id === id); return c ? `${c.icon} ${c.label}` : id; };

  async function openMatches(id) {
    if (matchFor === id) { setMatchFor(null); return; }
    setMatchFor(id); setMatchData(null); setMatchBusy(true);
    try { setMatchData(await api.pickupMatches(token, id)); }
    catch (err) { toast(err.message); setMatchFor(null); }
    finally { setMatchBusy(false); }
  }

  async function chooseCollector(pickupId, collectorId) {
    try {
      await api.requestCollector(token, pickupId, collectorId);
      toast(collectorId ? 'Request sent to the selected collector' : 'Request opened to all eligible collectors');
      setMatchFor(null);
      refresh();
    } catch (err) { toast(err.message); }
  }

  async function cancelPickup(id) {
    if (!window.confirm('Cancel this pickup request?')) return;
    try { await api.cancelPickup(token, id); toast('Pickup request cancelled'); setMatchFor(null); refresh(); }
    catch (err) { toast(err.message); refresh(); }
  }

  useEffect(() => { refresh(); }, []); // eslint-disable-line
    useEffect(() => {
    if (sub !== 'rewards' || !token) return;

    let active = true;
    setRewardsLoading(true);
    setRewardsError('');

    Promise.all([
      api.myRewards(token),
      api.rewardsLeaderboard(token),
    ])
      .then(([mine, board]) => {
        if (!active) return;
        setRewards(mine.rewards || mine);
        setLeaderboard(board.leaderboard || []);
      })
      .catch((err) => {
        if (active) setRewardsError(err.message || 'Could not load rewards.');
      })
      .finally(() => {
        if (active) setRewardsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [sub, token]);

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
    if (!form.qty || parseFloat(form.qty) <= 0) return toast('Please enter an approximate quantity (kg)');
    if (!(form.address || user.address || '').trim()) return toast('Please enter the pickup address');
    if (!form.lat) return toast('Please drop a pin on the map for pickup location');
    setSubmitting(true);
    try {
      const { pickup } = await api.submitPickup(token, {
        category: form.category, qtyEst: parseFloat(form.qty), lat: form.lat, lng: form.lng,
        address: (form.address || user.address).trim(), pickupTime: form.time, pickupDate: form.date || undefined,
      });
      toast('Pickup request submitted');
      setForm({ category: null, qty: '', time: TIME_SLOTS[0], date: '', lat: null, lng: null, address: '' });
      setSub('track');
      await refresh();
      openMatches(pickup._id);
    } catch (err) { toast(err.message); }
    finally { setSubmitting(false); }
  }

    const links = [
    { key: 'request', label: 'Request Pickup', icon: '➕' },
    { key: 'track', label: 'Track Pickups', icon: '📍' },
    { key: 'history', label: 'History', icon: '🕒' },
    { key: 'rewards', label: 'Green Rewards', icon: '🌱' },
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
                <input type="number" min="0.5" step="0.5" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />
              </div>
              <div className="field">
                <label>Estimated value</label>
                <input disabled value={estimate ? `₹${estimate} (demo rate)` : 'Select category + qty'} />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Preferred date</label>
                <input type="date" min={today()} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="field">
                <label>Preferred time slot</label>
                <select value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}>
                  {TIME_SLOTS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
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

          <button className="btn btn-primary" disabled={submitting} onClick={submitPickup}>{submitting ? 'Submitting…' : 'Submit pickup request'}</button>
        </>
      )}

      {sub === 'track' && (
        <>
          <div className="page-head"><div><h1>Track pickups</h1><p className="sub">Live status of your active requests.</p></div></div>
          {loadError && <div className="error-banner">{loadError} <button className="link-btn" onClick={refresh}>Retry</button></div>}
          {stats && (
            <div className="cards-grid">
              <div className="kpi"><div className="lbl">Pending</div><div className="val">{stats.pending}</div></div>
              <div className="kpi"><div className="lbl">Accepted</div><div className="val">{stats.accepted}</div></div>
              <div className="kpi"><div className="lbl">Completed</div><div className="val">{stats.completed}</div></div>
              <div className="kpi"><div className="lbl">Recycled so far</div><div className="val">{stats.totalKg} kg</div></div>
            </div>
          )}
          {pickups.filter((p) => !['RECYCLED', 'CANCELLED'].includes(p.status)).length === 0 && <div className="empty-state">No active pickups yet. Use “Request Pickup” to create one.</div>}
          {pickups.filter((p) => !['RECYCLED', 'CANCELLED'].includes(p.status)).map((p) => {
            const idx = STATUS_ORDER.indexOf(p.status);
            const open = matchFor === p._id;
            return (
              <div className="panel" key={p._id}>
                <div className="page-head" style={{ marginBottom: 6 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{catLabel(p.category)} · ~{p.qtyEst} kg</h3>
                    <button
                      className="map-link small-muted"
                      type="button"
                      onClick={() => setMapFocus({ lat: p.lat, lng: p.lng, label: p.address })}
                    >
                      {p.address}
                    </button>
                    {(p.pickupDate || p.pickupTime) && <div className="small-muted">Preferred: {[p.pickupDate, p.pickupTime].filter(Boolean).join(' · ')}</div>}
                  </div>
                  <span className={`pill ${STATUS_PILL[p.status]}`}>{STATUS_LABEL[p.status]}</span>
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
                {p.collector && <p className="small-muted">Collector: <b>{p.collector.name}</b> · ★ {p.collector.rating}{p.collector.phone ? ` · ${p.collector.phone}` : ''}</p>}
                {p.status === 'REQUESTED' && (
                  <>
                    <p className="small-muted">
                      {p.preferredCollector
                        ? <>Sent to <b>{p.preferredCollector.name}</b> — waiting for them to accept. Other eligible collectors can still accept it.</>
                        : 'Waiting for a collector to accept.'}
                    </p>
                    <div className="action-row">
                      <button className="btn btn-primary btn-sm" onClick={() => openMatches(p._id)}>{open ? 'Hide collectors' : 'Find best collector'}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => cancelPickup(p._id)}>Cancel request</button>
                    </div>
                  </>
                )}
                {open && (
                  <div className="match-box">
                    {matchBusy && <div className="small-muted">Finding eligible collectors…</div>}
                    {matchData && matchData.matches.length === 0 && <div className="empty-state">{matchData.message}</div>}
                    {matchData && matchData.matches.length > 0 && (
                      <>
                        <p className="small-muted" style={{ marginTop: 0 }}>
                          Only available collectors who accept this waste type are shown.
                          Score = {Math.round(matchData.weights.proximity * 100)}% proximity + {Math.round(matchData.weights.rating * 100)}% rating + {Math.round(matchData.weights.experience * 100)}% experience.
                          {' '}Skipped: {matchData.excluded.unavailable} unavailable, {matchData.excluded.wrongCategory} don’t accept this category.
                        </p>
                        {matchData.matches.map((m) => (
                          <div className={`match-row ${m.recommended ? 'best' : ''}`} key={m._id}>
                            <div className="match-main">
                              <div className="match-name">
                                {m.name} {m.recommended && <span className="pill pill-green">Recommended</span>} {m.verified && <span className="badge-verified">✓ Verified</span>}
                              </div>
                              <div className="small-muted">{m.reasons.join(' · ')}</div>
                              <div className="score-bar" title={`Proximity ${m.breakdown.proximity} + Rating ${m.breakdown.rating} + Experience ${m.breakdown.experience}`}>
                                <span className="seg s-prox" style={{ width: `${m.breakdown.proximity}%` }} />
                                <span className="seg s-rate" style={{ width: `${m.breakdown.rating}%` }} />
                                <span className="seg s-exp" style={{ width: `${m.breakdown.experience}%` }} />
                              </div>
                            </div>
                            <div className="match-side">
                              <div className="match-score">{m.score}</div>
                              {String(matchData.pickup.preferredCollector) === String(m._id)
                                ? <button className="btn btn-ghost btn-sm" onClick={() => chooseCollector(p._id, null)}>Selected ✓ (undo)</button>
                                : <button className="btn btn-primary btn-sm" onClick={() => chooseCollector(p._id, m._id)}>Request</button>}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
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
                      <td>{catLabel(c.category)}</td>
                      <td>{c.weight} kg</td>
                      <td>₹{c.amountPaid}</td>
                      <td><span className={`pill ${STATUS_PILL[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => setTraceOpen(c)}>Trace</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {sub === 'history' && pickups.some((p) => p.status === 'CANCELLED') && (
        <div className="panel">
          <h3>Cancelled requests</h3>
          <table>
            <thead><tr><th>Category</th><th>Quantity</th><th>Address</th><th>Status</th></tr></thead>
            <tbody>
              {pickups.filter((p) => p.status === 'CANCELLED').map((p) => (
                <tr key={p._id}><td>{catLabel(p.category)}</td><td>~{p.qtyEst} kg</td><td>{p.address}</td><td><span className="pill pill-grey">Cancelled</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {sub === 'rewards' && (
        <>
          <div className="page-head">
            <div>
              <h1>🌱 Green Rewards</h1>
              <p className="sub">
                Every confirmed recycling collection brings you closer to a greener planet.
              </p>
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => setSub('request')}
            >
              Request Pickup
            </button>
          </div>

          {rewardsLoading && (
            <div className="panel">Loading your Green Rewards...</div>
          )}

          {rewardsError && (
            <div className="error-banner">
              {rewardsError}{' '}
              <button
                className="link-btn"
                onClick={() => setSub('rewards')}
              >
                Try again
              </button>
            </div>
          )}

          {!rewardsLoading && !rewardsError && rewards && (
            <>
              <div className="cards-grid">
                <div className="kpi">
                  <div className="lbl">Total Green Points</div>
                  <div className="val">🌿 {rewards.totalPoints}</div>
                </div>
                <div className="kpi">
                  <div className="lbl">Eco Level</div>
                  <div className="val">{rewards.level}</div>
                </div>
                <div className="kpi">
                  <div className="lbl">Completed Recyclings</div>
                  <div className="val">{rewards.completedPickups}</div>
                </div>
                <div className="kpi">
                  <div className="lbl">Waste Recycled</div>
                  <div className="val">{rewards.totalWasteKg} kg</div>
                </div>
              </div>

              <div className="panel">
                <h3>🏆 Your Eco Badges</h3>
                {rewards.badges.length === 0 ? (
                  <p className="small-muted">
                    Your first badge is waiting! Complete a confirmed recycling collection to earn it.
                  </p>
                ) : (
                  <div className="chip-select">
                    {rewards.badges.map((badge) => {
                      const badgeNames = {
                        first_recycling: '♻️ First Recycling',
                        eco_warrior: '🌿 Eco Warrior',
                        ten_pickups: '🏆 10 Pickups Completed',
                      };

                      return (
                        <div className="chip-opt sel" key={badge.badgeKey}>
                          {badgeNames[badge.badgeKey] || badge.badgeKey}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="panel">
                <h3>♻️ Recycling History</h3>
                {rewards.history.length === 0 ? (
                  <div className="empty-state">
                    No reward transactions yet. Your points will appear after a collection is confirmed.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Waste Category</th>
                          <th>Weight</th>
                          <th>Points Earned</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rewards.history.map((item) => (
                          <tr key={item.id}>
                            <td>{item.category}</td>
                            <td>{item.weight} kg</td>
                            <td>🌱 +{item.points}</td>
                            <td>
                              {item.createdAt
                                ? new Date(item.createdAt).toLocaleDateString()
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="panel">
                <h3>🥇 Top Green Recyclers</h3>
                {leaderboard.length === 0 ? (
                  <p className="small-muted">
                    The leaderboard will appear when customers earn points.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Customer</th>
                          <th>Green Points</th>
                          <th>Pickups</th>
                          <th>Waste Recycled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((person, index) => (
                          <tr key={person.userId}>
                            <td>
                              {['🥇', '🥈', '🥉'][index] || index + 1}
                            </td>
                            <td>
                              {person.name}
                              {String(person.userId) === String(user?.id) &&
                                ' (You)'}
                            </td>
                            <td>🌱 {person.totalPoints}</td>
                            <td>{person.completedPickups}</td>
                            <td>
                              {Number(person.totalWasteKg || 0).toFixed(2)} kg
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
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
      <ChatWidget />
    </AppShell>
  );
}
