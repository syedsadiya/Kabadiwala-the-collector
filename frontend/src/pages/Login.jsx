import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const ROLE_LABEL = { customer: 'Customer', collector: 'Kabadiwala', admin: 'Admin' };
const DEMO_EMAIL = {
  customer: 'customer@kabadiwalaconnect.demo',
  collector: 'collector@kabadiwalaconnect.demo',
  admin: 'admin@kabadiwalaconnect.demo',
};

export default function Login({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [role, setRole] = useState('customer');
  const [email, setEmail] = useState(DEMO_EMAIL.customer);
  const [password, setPassword] = useState('demo1234');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { loginSuccess } = useAuth();
  const toast = useToast();

  function pickRole(r) {
    setRole(r);
    if (mode === 'login') setEmail(DEMO_EMAIL[r]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = mode === 'login'
        ? await api.login({ email, password })
        : await api.register({ role, name, email, password });
      loginSuccess(result);
      toast(`Logged in as ${result.user.name} (${ROLE_LABEL[result.user.role]})`);
      navigate(`/${result.user.role}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar"><div className="topbar-inner">
        <div className="brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <button
            className="home-brand"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <span className="home-brand-icon">♻</span>

            <span>
              Kabadiwala
              <b>Connect</b>
            </span>
          </button>
        </div>
        <div className="nav-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back home</button>
        </div>
      </div></div>

      <div className="auth-shell">
        <div className="auth-card">
          <h3 style={{ marginTop: 0 }}>{mode === 'login' ? 'Log in to' : 'Create an account on'} Kabadiwala Connect</h3>

          <div className="role-tabs">
            {['customer', 'collector', 'admin'].map((r) => (
              <button
                key={r}
                type="button"
                className={`role-tab ${role === r ? 'active' : ''}`}
                onClick={() => pickRole(r)}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="field">
                <label>Full name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {busy ? 'Please wait…' : mode === 'login' ? `Log in as ${ROLE_LABEL[role]}` : `Create ${ROLE_LABEL[role]} account`}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13.5 }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button className="link-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
              {mode === 'login' ? 'Register' : 'Log in'}
            </button>
          </p>

          {mode === 'login' && (
            <div className="demo-hint">
              
            </div>
          )}
        </div>
      </div>
    </>
  );
}
