/**
 * src/useAuthStore.ts
 *
 * Customer auth store (mobile-OTP flow).
 * Holds the JWT access token in sessionStorage so a tab refresh
 * keeps the user signed in, but a new tab starts logged out.
 *
 * The matching `setAccessToken` in services/api.ts mirrors this token
 * into the in-memory cache used by the fetch wrapper.
 */

import { create } from 'zustand';
import { setAccessToken, authAPI } from './services/api';

const STORAGE_KEY = 'mooncraft_customer_auth';

export interface CustomerUser {
  id: string;
  name?: string | null;
  email?: string | null;
  phone: string;
  role: string;
  created_at?: string;
}

interface AuthState {
  user: CustomerUser | null;
  hydrated: boolean;

  /** Hydrate from sessionStorage on app boot. */
  hydrate: () => void;

  /** Sign in via OTP — saves token + user, calls /me to refresh. */
  signInWithOtp: (phone: string, code: string) => Promise<CustomerUser>;

  /** Sign out — clears token + user. */
  signOut: () => Promise<void>;

  /** Refresh user from /me. */
  refresh: () => Promise<CustomerUser | null>;

  /** Update the customer profile (name/email). */
  updateProfile: (data: { name?: string; email?: string }) => Promise<CustomerUser>;
}

function persist(user: CustomerUser | null, accessToken: string | null) {
  setAccessToken(accessToken);
  try {
    if (user && accessToken) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ user, accessToken }));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage may be disabled (private mode) — fail silently
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,

  hydrate: () => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { user, accessToken } = JSON.parse(raw);
        setAccessToken(accessToken);
        set({ user, hydrated: true });
        // Refresh in the background to get the latest profile
        authAPI.me().then((res) => {
          if (res?.user) {
            persist(res.user, accessToken);
            set({ user: res.user });
          }
        }).catch(() => { /* token expired — clear */ persist(null, null); set({ user: null }); });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  signInWithOtp: async (phone, code) => {
    const res = await authAPI.verifyOtp(phone, code);
    if (!res?.accessToken || !res?.user) {
      throw new Error('Invalid response from server');
    }
    persist(res.user, res.accessToken);
    set({ user: res.user });
    return res.user;
  },

  signOut: async () => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    persist(null, null);
    set({ user: null });
  },

  refresh: async () => {
    try {
      const res = await authAPI.me();
      if (res?.user) {
        const currentToken = sessionStorage.getItem(STORAGE_KEY);
        const accessToken = currentToken ? JSON.parse(currentToken).accessToken : null;
        persist(res.user, accessToken);
        set({ user: res.user });
        return res.user;
      }
    } catch { /* ignore */ }
    return null;
  },

  updateProfile: async (data) => {
    const res = await authAPI.updateMe(data);
    if (!res?.user) throw new Error('Failed to update profile');
    const currentToken = sessionStorage.getItem(STORAGE_KEY);
    const accessToken = currentToken ? JSON.parse(currentToken).accessToken : null;
    persist(res.user, accessToken);
    set({ user: res.user });
    return res.user;
  },
}));
