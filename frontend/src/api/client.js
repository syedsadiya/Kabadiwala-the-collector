const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),

  meta: () => request('/meta'),
  publicStats: () => request('/stats/public'),
  adminStats: (token) => request('/stats/admin', { token }),

  submitPickup: (token, payload) => request('/pickups', { method: 'POST', body: payload, token }),
  myPickups: (token) => request('/pickups/mine', { token }),
  acceptPickup: (token, id) => request(`/pickups/${id}/accept`, { method: 'PATCH', token }),

  confirmCollection: (token, payload) => request('/collections', { method: 'POST', body: payload, token }),
  myCollections: (token) => request('/collections/mine', { token }),
  traceCollection: (token, code) => request(`/collections/trace/${code}`, { token }),
  updateCollectionStatus: (token, id, status) =>
    request(`/collections/${id}/status`, { method: 'PATCH', body: { status }, token }),

  recyclers: (token) => request('/recyclers', { token }),
  centers: (token) => request('/centers', { token }),
  users: (token, query = '') => request(`/users${query}`, { token }),
};
