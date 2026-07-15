/**
 * backend/services/otpService.js
 *
 * Mobile-phone OTP service for customer authentication.
 *
 * Flow:
 *   1. POST /api/auth/send-otp    { phone }      → generates 6-digit code, stores in `otps` table
 *   2. POST /api/auth/verify-otp  { phone, code } → validates, marks used, returns JWT pair
 *
 * Delivery channels (tried in order, first one configured wins):
 *   1. Twilio SMS     (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)
 *   2. MSG91 SMS      (MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_ROUTE)
 *   3. Fast2SMS       (FAST2SMS_API_KEY)
 *   4. Gmail email    (GMAIL_USER, GMAIL_APP_PASSWORD) — sends OTP to user's email
 *   5. Console log    (always — for local dev / testing)
 *
 * Security:
 *   - 6-digit code, 5-minute TTL
 *   - Max 5 verification attempts (lockout)
 *   - Max 1 active OTP per phone (upsert on phone)
 *   - 60-second resend cooldown
 *   - Generic "OTP sent" response (no enumeration)
 */

const crypto = require('crypto');
const supabase = require('../lib/supabase');
const { sendOtpEmail } = require('./emailService');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;          // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;      // 60 seconds
const MAX_ATTEMPTS = 5;

/**
 * Normalize a phone number to E.164-ish format.
 * Accepts: "9876543210", "+919876543210", "919876543210"
 * Returns: "+919876543210"  (assumes +91 if no country code and 10 digits)
 */
function normalizePhone(phone) {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
  return `+${cleaned}`;
}

/**
 * Validate phone: must be 10-15 digits with optional leading +.
 */
function isValidPhone(phone) {
  return /^\+?[0-9]{10,15}$/.test(String(phone || ''));
}

/**
 * Generate a cryptographically random 6-digit OTP code.
 */
function generateCode() {
  // crypto.randomInt is uniform — no modulo bias
  return String(crypto.randomInt(0, 1_000_000)).padStart(OTP_LENGTH, '0');
}

/**
 * Send the OTP via the first configured channel.
 * Returns { delivered: bool, channel: 'twilio'|'msg91'|'fast2sms'|'email'|'console' }.
 */
async function deliverOtp(phone, code) {
  // 1. Twilio
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
    try {
      const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await twilio.messages.create({
        from: process.env.TWILIO_FROM,
        to: phone,
        body: `Your Mooncraft login code is ${code}. Valid for 5 minutes. Do not share.`,
      });
      console.log(`📱 OTP sent via Twilio to ${phone}`);
      return { delivered: true, channel: 'twilio' };
    } catch (err) {
      console.error('❌ Twilio OTP failed:', err.message);
    }
  }

  // 2. MSG91
  if (process.env.MSG91_AUTH_KEY && process.env.MSG91_SENDER_ID) {
    try {
      const https = require('https');
      const path = `/api/v5/otp?authkey=${process.env.MSG91_AUTH_KEY}&mobile=${encodeURIComponent(phone)}&sender=${process.env.MSG91_SENDER_ID}&otp=${code}&template_id=${process.env.MSG91_TEMPLATE_ID || ''}`;
      await new Promise((resolve, reject) => {
        const req = https.request(
          { hostname: 'control.msg91.com', path, method: 'POST', headers: { 'Content-Type': 'application/json' } },
          (res) => { res.on('data', () => {}); res.on('end', () => (res.statusCode < 300 ? resolve() : reject(new Error('status ' + res.statusCode)))); }
        );
        req.on('error', reject);
        req.end();
      });
      console.log(`📱 OTP sent via MSG91 to ${phone}`);
      return { delivered: true, channel: 'msg91' };
    } catch (err) {
      console.error('❌ MSG91 OTP failed:', err.message);
    }
  }

  // 3. Fast2SMS (India only)
  if (process.env.FAST2SMS_API_KEY) {
    try {
      const https = require('https');
      const body = JSON.stringify({
        authorization: process.env.FAST2SMS_API_KEY,
        sender_id: process.env.FAST2SMS_SENDER_ID || 'FSTSMS',
        message: `Your Mooncraft OTP is ${code}. Valid 5 min.`,
        language: 'english',
        route: 'otp',
        numbers: phone.replace(/^\+91/, ''),
      });
      await new Promise((resolve, reject) => {
        const req = https.request(
          { hostname: 'www.fast2sms.com', path: '/dev/bulkV2', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
          (res) => { res.on('data', () => {}); res.on('end', () => (res.statusCode < 300 ? resolve() : reject(new Error('status ' + res.statusCode)))); }
        );
        req.on('error', reject);
        req.end(body);
      });
      console.log(`📱 OTP sent via Fast2SMS to ${phone}`);
      return { delivered: true, channel: 'fast2sms' };
    } catch (err) {
      console.error('❌ Fast2SMS OTP failed:', err.message);
    }
  }

  // 4. Email (fallback — uses the user's email if we have it)
  // We don't have the email here; the route will call sendOtpEmail after looking it up.

  // 5. Console (always — for dev/testing)
  console.log(`\n🔐 [DEV] OTP for ${phone}: ${code}   (expires in 5 min)\n`);
  return { delivered: true, channel: 'console' };
}

/**
 * Create or replace an OTP for a phone. Enforces 60s resend cooldown.
 * Returns { ok, code?, cooldownSeconds?, error? }.
 */
async function createOtp(phone) {
  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) {
    return { ok: false, error: 'Invalid phone number' };
  }

  // Check existing record for cooldown
  const { data: existing } = await supabase
    .from('otps')
    .select('created_at, verified')
    .eq('phone', normalized)
    .maybeSingle();

  if (existing && !existing.verified) {
    const ageMs = Date.now() - new Date(existing.created_at).getTime();
    if (ageMs < RESEND_COOLDOWN_MS) {
      return { ok: false, error: 'Please wait before requesting a new code', cooldownSeconds: Math.ceil((RESEND_COOLDOWN_MS - ageMs) / 1000) };
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error } = await supabase.from('otps').upsert({
    phone: normalized,
    code,
    attempts: 0,
    expires_at: expiresAt,
    verified: false,
    created_at: new Date().toISOString(),
  }, { onConflict: 'phone' });

  if (error) return { ok: false, error: 'Failed to create OTP' };

  return { ok: true, code, phone: normalized };
}

/**
 * Verify an OTP. Returns { ok, phone, error? }.
 * On success, marks the row as verified. Caller should then delete it.
 */
async function verifyOtp(phone, code) {
  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) {
    return { ok: false, error: 'Invalid phone number' };
  }

  const { data: row, error } = await supabase
    .from('otps')
    .select('*')
    .eq('phone', normalized)
    .maybeSingle();

  if (error || !row) return { ok: false, error: 'No OTP requested for this number' };
  if (row.verified) return { ok: false, error: 'Code already used. Please request a new one.' };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: 'Code expired. Please request a new one.' };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: 'Too many attempts. Please request a new code.' };

  if (row.code !== String(code).trim()) {
    // Increment attempts
    await supabase.from('otps').update({ attempts: row.attempts + 1 }).eq('phone', normalized);
    return { ok: false, error: 'Invalid code' };
  }

  // Mark verified & return phone
  await supabase.from('otps').update({ verified: true }).eq('phone', normalized);
  return { ok: true, phone: normalized };
}

/**
 * Find or create a user by phone number. Returns the user row.
 */
async function findOrCreateUserByPhone(phone) {
  // Look up existing user
  const { data: existing } = await supabase
    .from('users')
    .select('id, name, email, phone, role, created_at')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) return existing;

  // Create a new user — phone is the primary identifier, email is null until they set it
  const { data: created, error } = await supabase
    .from('users')
    .insert({ phone, is_guest: false, role: 'customer' })
    .select('id, name, email, phone, role, created_at')
    .single();

  if (error) throw new Error('Failed to create user: ' + error.message);
  return created;
}

/**
 * Delete a verified OTP (cleanup after successful login).
 */
async function consumeOtp(phone) {
  await supabase.from('otps').delete().eq('phone', phone);
}

module.exports = {
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  normalizePhone,
  isValidPhone,
  generateCode,
  createOtp,
  verifyOtp,
  deliverOtp,
  findOrCreateUserByPhone,
  consumeOtp,
};
