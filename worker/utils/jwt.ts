/**
 * JWT utilities using `jose` (Workers-compatible).
 * Replaces jsonwebtoken from the Express backend.
 */
import { SignJWT, jwtVerify } from 'jose';

const ISSUER_USER = 'mooncraft-api';
const ISSUER_ADMIN = 'mooncraft-admin';

const enc = new TextEncoder();
const decoder = new TextDecoder();

const getSecret = (s: string) => enc.encode(s);

export interface UserTokenPayload {
  id: string;
  email?: string | null;
  phone?: string | null;
}

export interface AdminTokenPayload extends UserTokenPayload {
  isAdmin: true;
  name?: string;
  role?: string;
  permissions?: string[];
}

export async function generateAccessToken(payload: UserTokenPayload, env: Env): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER_USER)
    .setExpirationTime('15m')
    .sign(getSecret(env.JWT_SECRET));
}

export async function generateRefreshToken(payload: UserTokenPayload, env: Env): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER_USER)
    .setExpirationTime('7d')
    .sign(getSecret(env.JWT_REFRESH_SECRET));
}

export async function generateAdminToken(payload: Omit<AdminTokenPayload, 'isAdmin'>, env: Env): Promise<string> {
  const secret = env.JWT_ADMIN_SECRET || env.JWT_SECRET;
  return await new SignJWT({ ...payload, isAdmin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER_ADMIN)
    .setExpirationTime('8h')
    .sign(getSecret(secret));
}

export async function verifyAccessToken(token: string, env: Env): Promise<UserTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(env.JWT_SECRET), { issuer: ISSUER_USER });
  return payload as unknown as UserTokenPayload;
}

export async function verifyRefreshToken(token: string, env: Env): Promise<UserTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(env.JWT_REFRESH_SECRET), { issuer: ISSUER_USER });
  return payload as unknown as UserTokenPayload;
}

export async function verifyAdminToken(token: string, env: Env): Promise<AdminTokenPayload> {
  const secret = env.JWT_ADMIN_SECRET || env.JWT_SECRET;
  const { payload } = await jwtVerify(token, getSecret(secret), { issuer: ISSUER_ADMIN });
  return payload as unknown as AdminTokenPayload;
}

export const _decoder = decoder; // for HMAC body helpers