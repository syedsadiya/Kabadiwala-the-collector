import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppShell({ roleName, links, active, onNavigate, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const initials = (user?.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2);

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            <div className="brand-mark">♻</div> Kabadiwala Connect
          </div>
          <div className="nav-actions">
            <span className="pill pill-grey">{roleName}</span>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Log out</button>
          </div>
        </div>
      </div>
      <div className="app-shell">
        <div className="sidebar">
          <div className="side-role">{roleName.toUpperCase()}</div>
          {links.map((l) => (
            <button
              key={l.key}
              className={`side-link ${active === l.key ? 'active' : ''}`}
              onClick={() => onNavigate(l.key)}
            >
              {l.icon} {l.label}
            </button>
          ))}
          <div className="side-user">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="avatar">{initials}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{user?.name}</div>
                <div className="small-muted">{roleName}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="main">{children}</div>
      </div>
    </>
  );
}
