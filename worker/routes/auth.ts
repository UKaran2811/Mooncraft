/**
 * Auth routes — Hono (Workers-compatible).
 * Mirrors backend/routes/auth.js.
 */
import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { getSupabase } from '../lib/supabase';
import { generateAccessToken, generateRefreshToken, generateAdminToken, verifyRefreshToken } from '../utils/jwt';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { sendPasswordResetEmail, sendOtpEmail } from '../services/email';
import { hashPassword, verifyPassword } from '../utils/password';
import { randomString } from '../utils/crypto';
import {
  normalizePhone,
  isValidPhone,
  createOtp,
  verifyOtp,
  deliverOtp,
  findOrCreateUserByPhone,
  consumeOtp,
} from '../services/otp';

const router = new Hono<{ Bindings: Env }>();

// Simple in-memory rate limiter for auth endpoints (Workers-safe)
const authAttempts = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(c: any, ip: string): boolean {
  const now = Date.now();
  const rec = authAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  rec.count += 1;
  if (rec.count > 10) return false;
  return true;
}

const getIp = (c: any) => c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';

function extractUserSafe(row: any) {
  if (!row) return null;
  const { password_hash, ...safe } = row;
  return safe;
}

// ── CUSTOMER REGISTER ───────────────────────
router.post('/register', async (c) => {
  if (!checkRateLimit(c, getIp(c))) {
    return c.json({ success: false, message: 'Too many attempts. Try again in 15 minutes.' }, 429);
  }
  try {
    const body = await c.req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();
    const phone = body.phone ? String(body.phone).trim() : null;

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return c.json({ success: false, errors: [{ msg: 'Valid email required' }] }, 400);
    }
    if (password.length < 8) {
      return c.json({ success: false, errors: [{ msg: 'Password must be at least 8 characters' }] }, 400);
    }
    if (!name) {
      return c.json({ success: false, errors: [{ msg: 'Name is required' }] }, 400);
    }

    const supabase = getSupabase(c.env);
    const { data: existing } = await supabase.from('users').select('id').eq('email', email).single();
    if (existing) return c.json({ success: false, message: 'Email already registered' }, 409);

    const passwordHash = await hashPassword(password);
    const { data: user, error } = await supabase
      .from('users')
      .insert({ email, name, phone, password_hash: passwordHash, role: 'customer' })
      .select('id, email, name, phone, role, created_at')
      .single();
    if (error) throw error;

    const accessToken = await generateAccessToken({ id: user.id, email: user.email, phone: user.phone }, c.env);
    const refreshToken = await generateRefreshToken({ id: user.id, email: user.email }, c.env);

    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: c.env.APP_URL ? true : false,
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return c.json({ success: true, message: 'Account created', accessToken, user }, 201);
  } catch (err: any) {
    console.error('Register error:', err.message);
    return c.json({ success: false, message: 'Registration failed' }, 500);
  }
});

// ── CUSTOMER LOGIN ──────────────────────────
router.post('/login', async (c) => {
  if (!checkRateLimit(c, getIp(c))) {
    return c.json({ success: false, message: 'Too many attempts. Try again in 15 minutes.' }, 429);
  }
  try {
    const body = await c.req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return c.json({ success: false, message: 'Invalid email or password' }, 401);

    const supabase = getSupabase(c.env);
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('is_guest', false)
      .single();

    if (!user || !user.password_hash) return c.json({ success: false, message: 'Invalid email or password' }, 401);
    if (!user.is_active) return c.json({ success: false, message: 'Account is deactivated' }, 403);

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return c.json({ success: false, message: 'Invalid email or password' }, 401);

    const accessToken = await generateAccessToken({ id: user.id, email: user.email, phone: user.phone }, c.env);
    const refreshToken = await generateRefreshToken({ id: user.id, email: user.email }, c.env);

    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: c.env.APP_URL ? true : false,
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return c.json({ success: true, accessToken, user: extractUserSafe(user) });
  } catch (err: any) {
    console.error('Login error:', err.message);
    return c.json({ success: false, message: 'Login failed' }, 500);
  }
});

// ── REFRESH ─────────────────────────────────
router.post('/refresh', async (c) => {
  try {
    const token = c.req.header('cookie')?.match(/refreshToken=([^;]+)/)?.[1];
    if (!token) return c.json({ success: false, message: 'No refresh token' }, 401);

    const decoded = await verifyRefreshToken(token, c.env);
    const supabase = getSupabase(c.env);
    const { data: user } = await supabase
      .from('users')
      .select('id, email, is_active')
      .eq('id', decoded.id)
      .single();

    if (!user || !user.is_active) return c.json({ success: false, message: 'Invalid session' }, 401);

    const accessToken = await generateAccessToken({ id: user.id, email: user.email }, c.env);
    return c.json({ success: true, accessToken });
  } catch {
    return c.json({ success: false, message: 'Invalid refresh token' }, 401);
  }
});

// ── LOGOUT ──────────────────────────────────
router.post('/logout', (c) => {
  deleteCookie(c, 'refreshToken');
  deleteCookie(c, 'adminToken');
  return c.json({ success: true, message: 'Logged out' });
});

// ── ADMIN LOGIN ─────────────────────────────
router.post('/admin/login', async (c) => {
  if (!checkRateLimit(c, getIp(c))) {
    return c.json({ success: false, message: 'Too many attempts. Try again in 15 minutes.' }, 429);
  }
  try {
    const body = await c.req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    const supabase = getSupabase(c.env);
    const { data: admin } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (!admin) return c.json({ success: false, message: 'Invalid credentials' }, 401);

    const valid = await verifyPassword(password, admin.password_hash);
    if (!valid) return c.json({ success: false, message: 'Invalid credentials' }, 401);

    await supabase.from('admins').update({ last_login: new Date().toISOString() }).eq('id', admin.id);

    const token = await generateAdminToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      permissions: admin.permissions,
    }, c.env);

    setCookie(c, 'adminToken', token, {
      httpOnly: true,
      secure: c.env.APP_URL ? true : false,
      sameSite: 'Strict',
      maxAge: 8 * 60 * 60,
      path: '/',
    });

    return c.json({ success: true, token, admin: extractUserSafe(admin) });
  } catch (err: any) {
    console.error('Admin login error:', err.message);
    return c.json({ success: false, message: 'Login failed' }, 500);
  }
});

// ── ADMIN ME ────────────────────────────────
router.get('/admin/me', requireAdmin, async (c) => {
  try {
    const admin = c.get('admin');
    const supabase = getSupabase(c.env);
    const { data: adminRow } = await supabase
      .from('admins')
      .select('id, name, email, role, permissions, last_login, created_at')
      .eq('id', admin.id)
      .single();
    if (!adminRow) return c.json({ success: false, message: 'Admin not found' }, 404);
    return c.json({ success: true, admin: adminRow });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── FORGOT PASSWORD (email) ─────────────────
router.post('/forgot-password', async (c) => {
  const ok = () => c.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  try {
    const body = await c.req.json();
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return ok();

    const supabase = getSupabase(c.env);
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, is_active')
      .eq('email', email)
      .eq('is_guest', false)
      .single();

    if (!user || !user.is_active) return ok();

    const token = randomString(32);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase.from('password_resets').upsert({
      user_id: user.id,
      email: user.email,
      token,
      expires_at: expiresAt,
      used: false,
    }, { onConflict: 'user_id' });

    const resetLink = `${c.env.FRONTEND_URL || 'http://localhost:3000'}/#/reset-password?token=${token}`;
    await sendPasswordResetEmail(c.env, user.email, resetLink, user.name);
    return ok();
  } catch (err: any) {
    console.error('Forgot password error:', err.message);
    return ok();
  }
});

// ── RESET PASSWORD (email token) ────────────
router.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json();
    const token = String(body.token || '').trim();
    const password = String(body.password || '');
    if (!token) return c.json({ success: false, message: 'Reset token required' }, 400);
    if (password.length < 8) return c.json({ success: false, message: 'Password must be at least 8 characters' }, 400);

    const supabase = getSupabase(c.env);
    const { data: resetRecord } = await supabase
      .from('password_resets')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single();

    if (!resetRecord) return c.json({ success: false, message: 'Invalid or expired reset link' }, 400);
    if (new Date(resetRecord.expires_at) < new Date()) {
      return c.json({ success: false, message: 'Reset link has expired. Please request a new one.' }, 400);
    }

    const passwordHash = await hashPassword(password);
    const { error } = await supabase.from('users').update({ password_hash: passwordHash }).eq('id', resetRecord.user_id);
    if (error) throw error;

    await supabase.from('password_resets').update({ used: true }).eq('token', token);
    return c.json({ success: true, message: 'Password updated successfully. You can now log in.' });
  } catch (err: any) {
    console.error('Reset password error:', err.message);
    return c.json({ success: false, message: 'Password reset failed' }, 500);
  }
});

// ── FORGOT PASSWORD OTP ─────────────────────
router.post('/forgot-password-otp', async (c) => {
  const ok = () => c.json({ success: true, message: 'If the number is registered, a code has been sent.' });
  try {
    const body = await c.req.json();
    const phone = String(body.phone || '').trim();
    if (!isValidPhone(normalizePhone(phone))) return ok();

    const supabase = getSupabase(c.env);
    const { data: user } = await supabase
      .from('users')
      .select('id, phone')
      .eq('phone', normalizePhone(phone))
      .maybeSingle();
    if (!user) return ok();

    const created = await createOtp(c.env, phone);
    if (created.ok === false) {
      if (created.cooldownSeconds) return c.json({ success: false, message: created.error, cooldownSeconds: created.cooldownSeconds }, 429);
      return ok();
    }
    await deliverOtp(c.env, created.phone, created.code);

    if (!c.env.APP_URL) return c.json({ success: true, message: 'OTP sent', phone: created.phone, devCode: created.code });
    return c.json({ success: true, message: 'OTP sent', phone: created.phone });
  } catch {
    return c.json({ success: true, message: 'If the number is registered, a code has been sent.' });
  }
});

// ── RESET PASSWORD OTP ──────────────────────
router.post('/reset-password-otp', async (c) => {
  try {
    const body = await c.req.json();
    const phone = String(body.phone || '').trim();
    const code = String(body.code || '').trim();
    const password = String(body.password || '');
    if (!phone || !code) return c.json({ success: false, message: 'Phone and code required' }, 400);
    if (password.length < 8) return c.json({ success: false, message: 'Password must be at least 8 characters' }, 400);

    const result = await verifyOtp(c.env, phone, code);
    if (result.ok === false) return c.json({ success: false, message: result.error }, 400);

    const supabase = getSupabase(c.env);
    const { data: user } = await supabase
      .from('users')
      .select('id, phone')
      .eq('phone', result.phone)
      .maybeSingle();
    if (!user) return c.json({ success: false, message: 'User not found' }, 400);

    const passwordHash = await hashPassword(password);
    const { error } = await supabase.from('users').update({ password_hash: passwordHash }).eq('id', user.id);
    if (error) throw error;

    await consumeOtp(c.env, result.phone);
    return c.json({ success: true, message: 'Password updated successfully. You can now log in.' });
  } catch (err: any) {
    console.error('Reset password OTP error:', err.message);
    return c.json({ success: false, message: 'Password reset failed' }, 500);
  }
});

// ── SEND OTP ────────────────────────────────
router.post('/send-otp', async (c) => {
  if (!checkRateLimit(c, getIp(c))) {
    return c.json({ success: false, message: 'Too many attempts. Try again in 15 minutes.' }, 429);
  }
  try {
    const body = await c.req.json();
    const phone = String(body.phone || '').trim();
    if (!isValidPhone(normalizePhone(phone))) {
      return c.json({ success: true, message: 'If the number is valid, a code has been sent.' });
    }

    const created = await createOtp(c.env, phone);
    if (created.ok === false) {
      if (created.cooldownSeconds) return c.json({ success: false, message: created.error, cooldownSeconds: created.cooldownSeconds }, 429);
      return c.json({ success: true, message: 'If the number is valid, a code has been sent.' });
    }

    const delivery = await deliverOtp(c.env, created.phone, created.code);

    if (delivery.channel === 'console' && c.env.RESEND_API_KEY) {
      const supabase = getSupabase(c.env);
      const { data: userRow } = await supabase
        .from('users')
        .select('email')
        .eq('phone', created.phone)
        .maybeSingle();
      if (userRow?.email) await sendOtpEmail(c.env, userRow.email, created.code, created.phone);
    }

    const response: any = { success: true, message: 'OTP sent successfully', phone: created.phone };
    if (!c.env.APP_URL) response.devCode = created.code;
    return c.json(response);
  } catch (err: any) {
    console.error('Send OTP error:', err.message);
    return c.json({ success: true, message: 'If the number is valid, a code has been sent.' });
  }
});

// ── VERIFY OTP ──────────────────────────────
router.post('/verify-otp', async (c) => {
  if (!checkRateLimit(c, getIp(c))) {
    return c.json({ success: false, message: 'Too many attempts. Try again in 15 minutes.' }, 429);
  }
  try {
    const body = await c.req.json();
    const phone = String(body.phone || '').trim();
    const code = String(body.code || '').trim();

    const result = await verifyOtp(c.env, phone, code);
    if (result.ok === false) return c.json({ success: false, message: result.error }, 400);

    const user = await findOrCreateUserByPhone(c.env, result.phone);
    await consumeOtp(c.env, result.phone);

    const accessToken = await generateAccessToken({ id: user.id, email: user.email, phone: user.phone }, c.env);
    const refreshToken = await generateRefreshToken({ id: user.id, email: user.email }, c.env);

    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: c.env.APP_URL ? true : false,
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return c.json({ success: true, accessToken, user });
  } catch (err: any) {
    console.error('Verify OTP error:', err.message);
    return c.json({ success: false, message: 'Verification failed' }, 500);
  }
});

// ── ME (GET/PATCH) ──────────────────────────
router.get('/me', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const supabase = getSupabase(c.env);
    const { data: profile } = await supabase
      .from('users')
      .select('id, name, email, phone, role, created_at')
      .eq('id', user.id)
      .single();
    if (!profile) return c.json({ success: false, message: 'User not found' }, 404);
    return c.json({ success: true, user: profile });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

router.patch('/me', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const allowed = ['name', 'email'];
    const update: Record<string, string> = {};
    for (const f of allowed) {
      if (body[f] !== undefined) update[f] = String(body[f]);
    }
    if (Object.keys(update).length === 0) {
      return c.json({ success: false, message: 'No updatable fields provided' }, 400);
    }
    const supabase = getSupabase(c.env);
    const { data: updated, error } = await supabase
      .from('users')
      .update(update)
      .eq('id', user.id)
      .select('id, name, email, phone, role, created_at')
      .single();
    if (error) throw error;
    return c.json({ success: true, user: updated });
  } catch (err: any) {
    console.error('Update profile error:', err.message);
    return c.json({ success: false, message: 'Update failed' }, 500);
  }
});

export default router;