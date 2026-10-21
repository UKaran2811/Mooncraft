/**
 * Workers-safe crypto utilities.
 * Replaces Node `crypto` module (randomBytes, createHmac) using Web Crypto API.
 */

// ── Random bytes (replaces crypto.randomBytes) ──
export function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return buf;
}

export function randomString(length = 32): string {
  const buf = randomBytes(length);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

export function randomOtp(length = 6): string {
  const buf = randomBytes(length);
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += String(buf[i] % 10);
  }
  return otp;
}

// ── HMAC SHA-256 (replaces crypto.createHmac) ──
export async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── SHA-256 hex digest (for content hashing, ETags, etc.) ──
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── Constant-time string comparison ──
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ── Phone number normalization ──
export function normalizePhone(phone: string): string {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  return digits;
}