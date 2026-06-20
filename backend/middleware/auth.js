const { verifyAccessToken, verifyAdminToken } = require('../utils/jwt');

/**
 * Middleware: Require valid customer JWT
 */
const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
      req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/**
 * Middleware: Require valid admin JWT
 */
const requireAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
      req.cookies?.adminToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Admin authentication required' });
    }

    const decoded = verifyAdminToken(token);
    if (!decoded.isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access only' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Admin session expired', code: 'ADMIN_TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid admin token' });
  }
};

/**
 * Middleware: Check permission for staff admins
 */
const requirePermission = (permission) => (req, res, next) => {
  if (!req.admin) return res.status(401).json({ success: false, message: 'Not authenticated' });
  if (req.admin.role === 'super_admin') return next(); // Super admin has all permissions
  if (!req.admin.permissions?.includes(permission)) {
    return res.status(403).json({ success: false, message: `Requires permission: ${permission}` });
  }
  next();
};

/**
 * Middleware: Optional auth (attaches user if token valid, else continues)
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      req.user = verifyAccessToken(token);
    }
  } catch (_) {
    // ignore
  }
  next();
};

module.exports = { requireAuth, requireAdmin, requirePermission, optionalAuth };
