const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const supabase = require('../lib/supabase');
const {
  generateAccessToken,
  generateRefreshToken,
  generateAdminToken,
  verifyRefreshToken,
} = require('../utils/jwt');
const { requireAdmin, requireAuth } = require('../middleware/auth');
const { sendPasswordResetEmail, sendOtpEmail } = require('../services/emailService');
const {
  normalizePhone,
  isValidPhone,
  createOtp,
  verifyOtp,
  deliverOtp,
  findOrCreateUserByPhone,
  consumeOtp,
} = require('../services/otpService');

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

// ──────────────────────────────────────────────
// PASSWORD RESET (CUSTOMER)
// ──────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 * Generate a reset token and email it to the customer.
 * Always returns 200 to prevent email enumeration.
 */
router.post(
  '/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    // Always respond 200 — never reveal if email exists
    const ok = () => res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });

    if (!validate(req, res)) return;
    try {
      const { email } = req.body;

      const { data: user } = await supabase
        .from('users')
        .select('id, name, email, is_active')
        .eq('email', email)
        .eq('is_guest', false)
        .single();

      if (!user || !user.is_active) return ok();

      // Generate secure token (64 hex chars)
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      // Store token (upsert by user_id — one active reset per user)
      await supabase.from('password_resets').upsert({
        user_id: user.id,
        email: user.email,
        token,
        expires_at: expiresAt,
        used: false,
      }, { onConflict: 'user_id' });

      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/#/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, resetLink, user.name);

      return ok();
    } catch (err) {
      console.error('Forgot password error:', err);
      return ok(); // Still return 200 on error
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Verify reset token and update password.
 */
router.post(
  '/reset-password',
  authLimiter,
  [
    body('token').trim().notEmpty().withMessage('Reset token required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { token, password } = req.body;

      // Look up the reset token
      const { data: resetRecord } = await supabase
        .from('password_resets')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .single();

      if (!resetRecord) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
      }

      // Check expiry
      if (new Date(resetRecord.expires_at) < new Date()) {
        return res.status(400).json({ success: false, message: 'Reset link has expired. Please request a new one.' });
      }

      // Hash new password and update user
      const passwordHash = await bcrypt.hash(password, 12);
      const { error } = await supabase
        .from('users')
        .update({ password_hash: passwordHash })
        .eq('id', resetRecord.user_id);

      if (error) throw error;

      // Mark token as used
      await supabase
        .from('password_resets')
        .update({ used: true })
        .eq('token', token);

      res.json({ success: true, message: 'Password updated successfully. You can now log in.' });
    } catch (err) {
      console.error('Reset password error:', err);
      res.status(500).json({ success: false, message: 'Password reset failed' });
    }
  }
);

// ──────────────────────────────────────────────
// MOBILE OTP — FORGOT / RESET PASSWORD
// ──────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password-otp
 * Send OTP to phone for password reset (instead of email).
 */
router.post(
  '/forgot-password-otp',
  authLimiter,
  [body('phone').trim().notEmpty().withMessage('Phone number required')],
  async (req, res) => {
    const ok = () => res.json({ success: true, message: 'If the number is registered, a code has been sent.' });
    if (!validate(req, res)) return;
    try {
      const { phone } = req.body;
      if (!isValidPhone(normalizePhone(phone))) return ok();

      // Check user exists for this phone
      const { data: user } = await supabase
        .from('users')
        .select('id, phone')
        .eq('phone', normalizePhone(phone))
        .maybeSingle();

      if (!user) return ok(); // Don't reveal if phone exists

      const created = await createOtp(phone);
      if (!created.ok) {
        if (created.cooldownSeconds) {
          return res.status(429).json({ success: false, message: created.error, cooldownSeconds: created.cooldownSeconds });
        }
        return ok();
      }

      await deliverOtp(created.phone, created.code);

      if (process.env.NODE_ENV !== 'production') {
        return res.json({ success: true, message: 'OTP sent', phone: created.phone, devCode: created.code });
      }
      res.json({ success: true, message: 'OTP sent', phone: created.phone });
    } catch {
      res.json({ success: true, message: 'If the number is registered, a code has been sent.' });
    }
  }
);

/**
 * POST /api/auth/reset-password-otp
 * Verify OTP + set new password (phone-based password reset).
 */
router.post(
  '/reset-password-otp',
  authLimiter,
  [
    body('phone').trim().notEmpty().withMessage('Phone required'),
    body('code').trim().notEmpty().withMessage('OTP code required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { phone, code, password } = req.body;

      const result = await verifyOtp(phone, code);
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.error });
      }

      // Find user and update password
      const { data: user } = await supabase
        .from('users')
        .select('id, phone')
        .eq('phone', result.phone)
        .maybeSingle();

      if (!user) {
        return res.status(400).json({ success: false, message: 'User not found' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const { error } = await supabase
        .from('users')
        .update({ password_hash: passwordHash })
        .eq('id', user.id);

      if (error) throw error;

      await consumeOtp(result.phone);

      res.json({ success: true, message: 'Password updated successfully. You can now log in.' });
    } catch (err) {
      console.error('Reset password OTP error:', err);
      res.status(500).json({ success: false, message: 'Password reset failed' });
    }
  }
);

// ──────────────────────────────────────────────
// MOBILE OTP AUTH (CUSTOMER) — primary login flow
// ──────────────────────────────────────────────

/**
 * POST /api/auth/send-otp
 * Body: { phone }
 * Generates a 6-digit code, stores it, and sends via SMS / email / console.
 * Always returns 200 to prevent phone enumeration.
 */
router.post(
  '/send-otp',
  authLimiter,
  [body('phone').trim().notEmpty().withMessage('Phone number required')],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { phone } = req.body;
      if (!isValidPhone(normalizePhone(phone))) {
        // Return generic OK to prevent enumeration
        return res.json({ success: true, message: 'If the number is valid, a code has been sent.' });
      }

      const created = await createOtp(phone);
      if (!created.ok) {
        if (created.cooldownSeconds) {
          return res.status(429).json({ success: false, message: created.error, cooldownSeconds: created.cooldownSeconds });
        }
        // Generic error — don't leak
        return res.json({ success: true, message: 'If the number is valid, a code has been sent.' });
      }

      // Try SMS first via the configured channel; then fall back to email if user has one
      const delivery = await deliverOtp(created.phone, created.code);

      // If SMS couldn't be delivered and the user has an email on file, send via email
      if (delivery.channel === 'console' && process.env.GMAIL_USER) {
        const { data: userRow } = await supabase
          .from('users')
          .select('email')
          .eq('phone', created.phone)
          .maybeSingle();
        if (userRow?.email) {
          await sendOtpEmail(userRow.email, created.code, created.phone);
        }
      }

      // Always return the same generic response. In dev, include the code for easier testing.
      const response = {
        success: true,
        message: 'OTP sent successfully',
        phone: created.phone,
      };
      if (process.env.NODE_ENV !== 'production') {
        response.devCode = created.code;  // visible in dev only
      }
      res.json(response);
    } catch (err) {
      console.error('Send OTP error:', err);
      res.json({ success: true, message: 'If the number is valid, a code has been sent.' });
    }
  }
);

/**
 * POST /api/auth/verify-otp
 * Body: { phone, code }
 * Verifies the code, finds or creates a user, returns JWT pair.
 */
router.post(
  '/verify-otp',
  authLimiter,
  [
    body('phone').trim().notEmpty().withMessage('Phone number required'),
    body('code').trim().matches(/^\d{4,8}$/).withMessage('Invalid code format'),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { phone, code } = req.body;

      const result = await verifyOtp(phone, code);
      if (!result.ok) {
        return res.status(400).json({ success: false, message: result.error });
      }

      // Find or create user
      const user = await findOrCreateUserByPhone(result.phone);

      // Consume the OTP so it can't be re-used
      await consumeOtp(result.phone);

      const accessToken = generateAccessToken({ id: user.id, email: user.email, phone: user.phone, role: 'customer' });
      const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({ success: true, accessToken, user });
    } catch (err) {
      console.error('Verify OTP error:', err);
      res.status(500).json({ success: false, message: 'Verification failed' });
    }
  }
);

/**
 * GET /api/auth/me
 * Get the currently authenticated customer's profile.
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, phone, role, created_at')
      .eq('id', req.user.id)
      .single();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * PATCH /api/auth/me
 * Update the authenticated customer's profile (currently just name/email).
 */
router.patch(
  '/me',
  requireAuth,
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const allowed = ['name', 'email'];
      const update = {};
      for (const f of allowed) {
        if (req.body[f] !== undefined) update[f] = req.body[f];
      }
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ success: false, message: 'No updatable fields provided' });
      }
      const { data: user, error } = await supabase
        .from('users')
        .update(update)
        .eq('id', req.user.id)
        .select('id, name, email, phone, role, created_at')
        .single();
      if (error) throw error;
      res.json({ success: true, user });
    } catch (err) {
      console.error('Update profile error:', err);
      res.status(500).json({ success: false, message: 'Update failed' });
    }
  }
);

module.exports = router;
