const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const {
  generateAccessToken,
  generateRefreshToken,
  generateAdminToken,
  verifyRefreshToken,
} = require('../utils/jwt');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Strict rate limit on auth endpoints — 10 attempts / 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
};

// ──────────────────────────────────────────────
// CUSTOMER AUTH
// ──────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { email, password, name, phone } = req.body;

      // Check if email exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const { data: user, error } = await supabase
        .from('users')
        .insert({ email, name, phone, password_hash: passwordHash, role: 'customer' })
        .select('id, email, name, phone, role, created_at')
        .single();

      if (error) throw error;

      const accessToken = generateAccessToken({ id: user.id, email: user.email, role: 'customer' });
      const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({ success: true, message: 'Account created', accessToken, user });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
  }
);

/**
 * POST /api/auth/login
 */
router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { email, password } = req.body;

      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_guest', false)
        .single();

      if (!user || !user.password_hash) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }
      if (!user.is_active) {
        return res.status(403).json({ success: false, message: 'Account is deactivated' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      const accessToken = generateAccessToken({ id: user.id, email: user.email, role: 'customer' });
      const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const { password_hash: _ph, ...safeUser } = user;
      res.json({ success: true, accessToken, user: safeUser });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }
);

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });

    const decoded = verifyRefreshToken(token);

    const { data: user } = await supabase
      .from('users')
      .select('id, email, is_active')
      .eq('id', decoded.id)
      .single();

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid session' });
    }

    const accessToken = generateAccessToken({ id: user.id, email: user.email, role: 'customer' });
    res.json({ success: true, accessToken });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.clearCookie('adminToken');
  res.json({ success: true, message: 'Logged out' });
});

// ──────────────────────────────────────────────
// ADMIN AUTH
// ──────────────────────────────────────────────

/**
 * POST /api/auth/admin/login
 */
router.post(
  '/admin/login',
  authLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { email, password } = req.body;

      const { data: admin } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (!admin) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Update last login timestamp
      await supabase
        .from('admins')
        .update({ last_login: new Date().toISOString() })
        .eq('id', admin.id);

      const token = generateAdminToken({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: admin.permissions,
      });

      res.cookie('adminToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
      });

      const { password_hash: _ph, ...safeAdmin } = admin;
      res.json({ success: true, token, admin: safeAdmin });
    } catch (err) {
      console.error('Admin login error:', err);
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  }
);

/**
 * GET /api/auth/admin/me
 */
router.get('/admin/me', requireAdmin, async (req, res) => {
  try {
    const { data: admin } = await supabase
      .from('admins')
      .select('id, name, email, role, permissions, last_login, created_at')
      .eq('id', req.admin.id)
      .single();

    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });
    res.json({ success: true, admin });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
