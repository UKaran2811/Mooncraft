/**
 * OTP delivery service — Workers-compatible.
 * API-compatible with the original Express backend/otpService.js.
 * Delivery channels: Twilio → Fast2SMS → MSG91 → console.
 */
import { getSupabase } from '../lib/supabase';
import { sendOtpEmail } from './email';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function isConfigured(...vals: (string | undefined)[]) {
  return vals.every((v) => v && !String(v).startsWith('FILL_IN'));
}

export function normalizePhone(phone: string): string {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
  return `+${cleaned}`;
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[0-9]{10,15}$/.test(String(phone || ''));
}

export function generateCode(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const rand = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
  return String(rand % 1_000_000).padStart(OTP_LENGTH, '0');
}

export async function deliverOtp(env: Env, phone: string, code: string): Promise<{ delivered: boolean; channel: string }> {
  // 1. Twilio SMS
  if (isConfigured(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM)) {
    try {
      const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            To: phone,
            From: env.TWILIO_FROM!,
            Body: `Your Mooncraft login code is ${code}. Valid for 5 minutes. Do not share.`,
          }).toString(),
        }
      );
      if (res.ok) {
        console.log(`📱 OTP sent via Twilio to ${phone}`);
        return { delivered: true, channel: 'twilio' };
      }
      console.error('❌ Twilio OTP failed:', res.status);
    } catch (err: any) {
      console.error('❌ Twilio OTP failed:', err.message);
    }
  }

  // 2. Fast2SMS (India — fallback, Quick SMS route=q)
  if (isConfigured(env.FAST2SMS_API_KEY)) {
    try {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: env.FAST2SMS_API_KEY!, // key MUST be a header
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          message: `Your Mooncraft OTP is ${code}. Valid 5 min.`,
          language: 'english',
          route: 'q',
          numbers: phone.replace(/^\+91/, ''),
          sender_id: env.FAST2SMS_SENDER_ID || 'FSTSMS',
        }).toString(),
      });
      const body: any = await res.json().catch(() => ({}));
      if (body?.return === true) {
        console.log(`📱 OTP sent via Fast2SMS to ${phone}`);
        return { delivered: true, channel: 'fast2sms' };
      }
      console.error('❌ Fast2SMS OTP rejected:', res.status, body?.message || '');
    } catch (err: any) {
      console.error('❌ Fast2SMS OTP failed:', err.message);
    }
  }

  // 3. MSG91
  if (isConfigured(env.MSG91_AUTH_KEY, env.MSG91_SENDER_ID)) {
    try {
      const path = `/api/v5/otp?authkey=${env.MSG91_AUTH_KEY}&mobile=${encodeURIComponent(phone)}&sender=${env.MSG91_SENDER_ID}&otp=${code}&template_id=${env.MSG91_SENDER_ID || ''}`;
      const res = await fetch(`https://control.msg91.com${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.status < 300) {
        console.log(`📱 OTP sent via MSG91 to ${phone}`);
        return { delivered: true, channel: 'msg91' };
      }
      console.error('❌ MSG91 OTP failed:', res.status);
    } catch (err: any) {
      console.error('❌ MSG91 OTP failed:', err.message);
    }
  }

  // 4. Console (dev fallback — always works)
  console.log(`\n🔐 [DEV] OTP for ${phone}: ${code}   (expires in 5 min)\n`);
  return { delivered: true, channel: 'console' };
}

export async function createOtp(env: Env, phone: string): Promise<{ ok: true; code: string; phone: string } | { ok: false; error: string; cooldownSeconds?: number }> {
  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) {
    return { ok: false, error: 'Invalid phone number' };
  }
  const supabase = getSupabase(env);

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

export async function verifyOtp(env: Env, phone: string, code: string): Promise<{ ok: true; phone: string } | { ok: false; error: string }> {
  const normalized = normalizePhone(phone);
  if (!isValidPhone(normalized)) return { ok: false, error: 'Invalid phone number' };
  const supabase = getSupabase(env);

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
    await supabase.from('otps').update({ attempts: row.attempts + 1 }).eq('phone', normalized);
    return { ok: false, error: 'Invalid code' };
  }

  await supabase.from('otps').update({ verified: true }).eq('phone', normalized);
  return { ok: true, phone: normalized };
}

export async function findOrCreateUserByPhone(env: Env, phone: string) {
  const supabase = getSupabase(env);
  const { data: existing } = await supabase
    .from('users')
    .select('id, name, email, phone, role, created_at')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('users')
    .insert({ phone, is_guest: false, role: 'customer' })
    .select('id, name, email, phone, role, created_at')
    .single();

  if (error) throw new Error('Failed to create user: ' + error.message);
  return created;
}

export async function consumeOtp(env: Env, phone: string) {
  const supabase = getSupabase(env);
  await supabase.from('otps').delete().eq('phone', phone);
}

export { OTP_TTL_MS, RESEND_COOLDOWN_MS };