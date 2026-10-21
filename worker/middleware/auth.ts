/**
 * Auth middleware for Hono on Cloudflare Workers.
 * Reads JWT from Authorization header or cookie.
 */
import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyAccessToken, verifyAdminToken, type AdminTokenPayload, type UserTokenPayload } from '../utils/jwt';

type Variables = {
  user?: UserTokenPayload;
  admin?: AdminTokenPayload;
};

export const requireAuth = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
  try {
    const token = extractToken(c, 'accessToken');
    if (!token) return c.json({ success: false, message: 'Authentication required' }, 401);

    const decoded = await verifyAccessToken(token, c.env);
    c.set('user', decoded);
    await next();
  } catch (err: any) {
    const msg = err?.code === 'ERR_JWT_EXPIRED'
      ? 'Token expired'
      : 'Invalid token';
    return c.json({ success: false, message: msg, code: 'TOKEN_EXPIRED' }, 401);
  }
};

export const requireAdmin = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
  try {
    const token = extractToken(c, 'adminToken');
    if (!token) return c.json({ success: false, message: 'Admin authentication required' }, 401);

    const decoded = await verifyAdminToken(token, c.env);
    if (!decoded.isAdmin) {
      return c.json({ success: false, message: 'Forbidden: Admin access only' }, 403);
    }
    c.set('admin', decoded);
    await next();
  } catch (err: any) {
    const msg = err?.code === 'ERR_JWT_EXPIRED' ? 'Admin session expired' : 'Invalid admin token';
    return c.json({ success: false, message: msg, code: 'ADMIN_TOKEN_EXPIRED' }, 401);
  }
};

export const requirePermission = (permission: string) =>
  async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const admin = c.get('admin');
    if (!admin) return c.json({ success: false, message: 'Not authenticated' }, 401);
    if (admin.role === 'super_admin') return next();
    if (!admin.permissions?.includes(permission)) {
      return c.json({ success: false, message: `Requires permission: ${permission}` }, 403);
    }
    await next();
  };

export const optionalAuth = async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
  try {
    const token = extractToken(c, 'accessToken');
    if (token) {
      const decoded = await verifyAccessToken(token, c.env);
      c.set('user', decoded);
    }
  } catch (_) { /* ignore */ }
  await next();
};

function extractToken(c: Context<{ Bindings: Env; Variables: Variables }>, cookieName: string): string | null {
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return getCookie(c, cookieName) || null;
}