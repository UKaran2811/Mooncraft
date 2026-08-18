// API service layer — centralized fetch wrapper for the Mooncraft backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Store admin token in memory (not localStorage for security)
let adminToken: string | null = null;
let accessToken: string | null = null;

export const setAdminToken = (token: string | null) => { adminToken = token; };
export const setAccessToken = (token: string | null) => { accessToken = token; };


interface FetchOptions extends RequestInit {
  isAdmin?: boolean;
}

/**
 * Custom error class that preserves the full response payload.
 * Allows callers to read fields like `cooldownSeconds` (429) or
 * `errors` (400) from the backend response, not just `message`.
 */
export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
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
    throw new ApiError(data.message || `HTTP ${res.status}`, res.status, data);
  }

  return data;
}

// ── Auth ─────────────────────────────────
export const authAPI = {
  // Customer: mobile OTP flow
  sendOtp: (phone: string) =>
    apiFetch('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) }),

  verifyOtp: (phone: string, code: string) =>
    apiFetch('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, code }) }),

  me: () => apiFetch('/auth/me'),

  updateMe: (data: { name?: string; email?: string }) =>
    apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),

  // Admin
  adminLogin: (email: string, password: string) =>
    apiFetch('/auth/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  adminMe: () => apiFetch('/auth/admin/me', { isAdmin: true }),

  // Password reset — email
  forgotPassword: (email: string) =>
    apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  // Password reset — phone OTP (verify code + set password in one call)
  forgotPasswordOtp: (phone: string) =>
    apiFetch('/auth/forgot-password-otp', { method: 'POST', body: JSON.stringify({ phone }) }),

  resetPasswordWithOtp: (phone: string, code: string, password: string) =>
    apiFetch('/auth/reset-password-otp', { method: 'POST', body: JSON.stringify({ phone, code, password }) }),

  // Shared
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
};

// ── Products ──────────────────────────────
export const productsAPI = {
  // Public: fetch active products with optional filters
  getAll: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch(`/products${qs}`);
  },

  // Public: single product by slug ID
  getOne: (slugId: string) => apiFetch(`/products/${slugId}`),

  // Admin: all products including inactive
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

  shipViaShiprocket: (id: string, schedulePickup = false) =>
    apiFetch(`/orders/${id}/ship`, {
      method: 'POST',
      body: JSON.stringify({ schedulePickupNow: schedulePickup }),
      isAdmin: true,
    }),

  getShiprocketTracking: (id: string) =>
    apiFetch(`/orders/${id}/tracking`, { isAdmin: true }),

  // Customer's own orders
  getMy: () => apiFetch('/orders/my'),

  // Place order (customer / checkout)
  place: (data: Record<string, unknown>) =>
    apiFetch('/orders', { method: 'POST', body: JSON.stringify(data) }),

  // Verify Razorpay payment
  verifyPayment: (data: Record<string, string>) =>
    apiFetch('/orders/verify-payment', { method: 'POST', body: JSON.stringify(data) }),

  // DEV ONLY: simulate a successful payment (never works in production)
  simulatePayment: (orderId: string) =>
    apiFetch(`/orders/${orderId}/simulate-payment`, { method: 'POST' }),

  track: (orderNumber: string, email: string) =>
    apiFetch(`/orders/track/${orderNumber}?email=${encodeURIComponent(email)}`),
};

// ── Shipping (Shiprocket) ───────────────────
export const shippingAPI = {
  checkPincode: (pincode: string, weightKg = 0.5, cod = false) =>
    apiFetch('/shipping/check-pincode', {
      method: 'POST',
      body: JSON.stringify({ pincode, weightKg, cod }),
    }),
};

// ── Upload ──────────────────────────────────
export const uploadAPI = {
  image: async (file: File): Promise<{ success: boolean; url: string; message: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const token = adminToken;
    const res = await fetch(`${API_BASE}/upload/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    return res.json();
  },
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
