const jwt = require('jsonwebtoken');

/**
 * Generate short-lived access token (15 minutes)
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'mooncraft-api',
  });
};

/**
 * Generate long-lived refresh token (7 days)
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
    issuer: 'mooncraft-api',
  });
};

/**
 * Generate admin token with separate secret (1 hour)
 */
const generateAdminToken = (payload) => {
  return jwt.sign({ ...payload, isAdmin: true }, process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET, {
    expiresIn: '8h',
    issuer: 'mooncraft-admin',
  });
};

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET, { issuer: 'mooncraft-api' });
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, { issuer: 'mooncraft-api' });
};

/**
 * Verify admin token
 */
const verifyAdminToken = (token) => {
  return jwt.verify(token, process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET, {
    issuer: 'mooncraft-admin',
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateAdminToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyAdminToken,
};
