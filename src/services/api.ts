// API service layer — centralized fetch wrapper for the Mooncraft backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Store admin token in memory (not localStorage for security)
let adminToken: string | null = null;
let accessToken: string | null = null;

export const setAdminToken = (token: string | null) => { adminToken = token; };
export const setAccessToken = (token: string | null) => { accessToken = token; };
export const getAdminToken = () => adminToken;

interface FetchOptions extends RequestInit {
  isAdmin?: boolean;
}

async function apiFetch(path: string, options: FetchOptions = {}) {
  const { isAdmin, ...fetchOptions } = options;
  const token = isAdmin ? adminToken : accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }

  return data;
}

// ── Auth ─────────────────────────────────
export const authAPI = {
  adminLogin: (email: string, password: string) =>
    apiFetch('/auth/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  adminMe: () => apiFetch('/auth/admin/me', { isAdmin: true }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
};

// ── Products ──────────────────────────────
export const productsAPI = {
  getAll: () => apiFetch('/products', { isAdmin: true }),
  getAllAdmin: () => apiFetch('/products/admin/all', { isAdmin: true }),

  create: (data: Record<string, unknown>) =>
    apiFetch('/products', { method: 'POST', body: JSON.stringify(data), isAdmin: true }),

  update: (slugId: string, data: Record<string, unknown>) =>
    apiFetch(`/products/${slugId}`, { method: 'PUT', body: JSON.stringify(data), isAdmin: true }),

  toggle: (slugId: string) =>
    apiFetch(`/products/${slugId}/toggle`, { method: 'PATCH', isAdmin: true }),

  remove: (slugId: string) =>
    apiFetch(`/products/${slugId}`, { method: 'DELETE', isAdmin: true }),
};

// ── Orders ────────────────────────────────
export const ordersAPI = {
  getAll: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch(`/orders${qs}`, { isAdmin: true });
  },

  getOne: (id: string) => apiFetch(`/orders/${id}`, { isAdmin: true }),

  updateStatus: (id: string, status: string, extra?: Record<string, string>) =>
    apiFetch(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...extra }),
      isAdmin: true,
    }),

  cancel: (id: string) => apiFetch(`/orders/${id}`, { method: 'DELETE', isAdmin: true }),

  // Place order (customer / checkout)
  place: (data: Record<string, unknown>) =>
    apiFetch('/orders', { method: 'POST', body: JSON.stringify(data) }),

  // Verify Razorpay payment
  verifyPayment: (data: Record<string, string>) =>
    apiFetch('/orders/verify-payment', { method: 'POST', body: JSON.stringify(data) }),

  track: (orderNumber: string, email: string) =>
    apiFetch(`/orders/track/${orderNumber}?email=${encodeURIComponent(email)}`),
};

// ── Admin Dashboard ────────────────────────
export const adminAPI = {
  getStats: () => apiFetch('/admin/dashboard/stats', { isAdmin: true }),
  getRevenueChart: (days = 30) => apiFetch(`/admin/dashboard/revenue-chart?days=${days}`, { isAdmin: true }),
  getTopProducts: () => apiFetch('/admin/dashboard/top-products', { isAdmin: true }),
  getUsers: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch(`/admin/users${qs}`, { isAdmin: true });
  },
  getUser: (id: string) => apiFetch(`/admin/users/${id}`, { isAdmin: true }),
  getAdmins: () => apiFetch('/admin/admins', { isAdmin: true }),
  createAdmin: (data: Record<string, unknown>) =>
    apiFetch('/admin/admins', { method: 'POST', body: JSON.stringify(data), isAdmin: true }),
};
