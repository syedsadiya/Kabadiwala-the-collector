import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { AP_AREAS } from '../constants';

const ROLE_LABEL = {
  customer: 'Customer',
  collector: 'Kabadiwala',
  admin: 'Admin',
};

export default function Login({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState('customer');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [area, setArea] = useState('');
  const [categories, setCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);

  const navigate = useNavigate();
  const { loginSuccess } = useAuth();
  const toast = useToast();

  useEffect(() => {
    api.meta()
      .then((m) => setAllCategories(m?.categories || []))
      .catch(() => {});
  }, []);

  function pickRole(r) {
    if (mode === 'register' && r === 'admin') return;
    setRole(r);
    setError('');
  }

  function switchMode() {
    const next = mode === 'login' ? 'register' : 'login';

    setMode(next);
    setError('');
    setPhone('');
    setPassword('');
    setName('');
    setArea('');
    setCategories([]);

    if (next === 'register' && role === 'admin') {
      setRole('customer');
    }
  }

  function validateRegister() {
    if (name.trim().length < 2) {
      return 'Enter your full name';
    }

    const cleanPhone = phone.replace(/[\s()-]/g, '');

    if (!/^\+?\d{10,13}$/.test(cleanPhone)) {
      return 'Enter a valid phone number with 10–13 digits';
    }

    if (password.length < 6) {
      return 'Password must be at least 6 characters';
    }

    if (role === 'collector' && !area) {
      return 'Select the area you operate in';
    }

    if (role === 'collector' && categories.length === 0) {
      return 'Select at least one waste category you collect';
    }

    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const cleanPhone = phone.replace(/[\s()-]/g, '');

    if (!/^\+?\d{10,13}$/.test(cleanPhone)) {
      setError('Enter a valid phone number with 10–13 digits');
      return;
    }

    if (mode === 'register') {
      const problem = validateRegister();

      if (problem) {
        setError(problem);
        return;
      }
    }

    setBusy(true);

    try {
      const result =
        mode === 'login'
          ? await api.login({
              phone: cleanPhone,
              password,
            })
          : await api.register({
              role,
              name: name.trim(),
              phone: cleanPhone,
              password,
              area: area || undefined,
              categories,
            });

      if (!result?.user) {
        throw new Error('The server did not return user details. Please check your API response.');
      }

      loginSuccess(result);

      if (typeof toast === 'function') {
        toast(
          mode === 'login'
            ? 'Logged in successfully'
            : 'Account created successfully'
        );
      } else {
        toast?.success?.(
          mode === 'login'
            ? 'Logged in successfully'
            : 'Account created successfully'
        );
      }

      navigate(`/${result.user.role}`);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Something went wrong. Please try again.';

      setError(message);

      if (typeof toast === 'function') {
        toast(message);
      } else {
        toast?.error?.(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div
            className="brand"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <button
              className="home-brand"
              type="button"
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
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => navigate('/')}
            >
              ← Back home
            </button>
          </div>
        </div>
      </div>

      <div className="auth-shell">
        <div className="auth-card">
          <h3 style={{ marginTop: 0 }}>
            {mode === 'login' ? 'Log in to' : 'Create an account on'} Kabadiwala Connect
          </h3>

          <div className="role-tabs">
            {(mode === 'register'
              ? ['customer', 'collector']
              : ['customer', 'collector', 'admin']
            ).map((r) => (
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
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="field">
              <label>Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                inputMode="tel"
                autoComplete="tel"
                required
              />
            </div>

            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                minLength={6}
                required
              />
            </div>

            {mode === 'register' && (
              <>
                <div className="row2">
                  <div className="field">
                    <label>
                      Area{role === 'collector' ? '' : ' (optional)'}
                    </label>
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      required={role === 'collector'}
                    >
                      <option value="">Select area</option>
                      {AP_AREAS.map((a) => (
                        <option key={a.name} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {role === 'collector' && (
                  <div className="field">
                    <label>Waste you collect</label>
                    <div className="chip-select">
                      {allCategories.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`chip-opt ${
                            categories.includes(c.id) ? 'sel' : ''
                          }`}
                          onClick={() =>
                            setCategories((cur) =>
                              cur.includes(c.id)
                                ? cur.filter((x) => x !== c.id)
                                : [...cur, c.id]
                            )
                          }
                        >
                          {c.icon} {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}

            <button
              className="btn btn-primary btn-block"
              disabled={busy}
              type="submit"
            >
              {busy
                ? 'Please wait…'
                : mode === 'login'
                  ? `Log in as ${ROLE_LABEL[role]}`
                  : `Create ${ROLE_LABEL[role]} account`}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13.5 }}>
            {mode === 'login'
              ? "Don't have an account? "
              : 'Already have an account? '}
            <button
              type="button"
              className="link-btn"
              onClick={switchMode}
            >
              {mode === 'login' ? 'Register' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </>
  );
}
