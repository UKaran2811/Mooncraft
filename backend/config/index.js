/**
 * backend/config/index.js
 *
 * Centralized configuration & startup env validation.
 * Import this in app.js or server.js to catch missing env vars early.
 *
 * Usage:
 *   const config = require('./config');
 *   config.validate(); // call once at startup
 */

const REQUIRED_IN_PRODUCTION = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

const RECOMMENDED = [
  'JWT_ADMIN_SECRET',
  'GMAIL_USER',
  'GMAIL_APP_PASSWORD',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'CALLMEBOT_PHONE',
  'CALLMEBOT_API_KEY',
];

/**
 * Validate environment variables.
 * In production, missing required vars will throw.
 * In development, they only warn.
 * Also detects FILL_IN_ placeholder values as unconfigured.
 */
function validate() {
  const isProd = process.env.NODE_ENV === 'production';

  // Treat FILL_IN_ values as missing
  const isUnset = (key) => {
    const val = process.env[key];
    return !val || val.startsWith('FILL_IN_');
  };

  const missing = REQUIRED_IN_PRODUCTION.filter(isUnset);

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    if (isProd) {
      throw new Error(msg);
    } else {
      console.warn(`⚠️  ${msg}`);
      console.warn('   Copy .env.example to .env and fill in the values.\n');
    }
  }

  const missingOptional = RECOMMENDED.filter(isUnset);
  if (missingOptional.length > 0) {
    console.warn(`ℹ️  Optional env vars not set (some features disabled): ${missingOptional.join(', ')}`);
  }

  if (!missing.length) {
    console.log('✅ Environment variables validated');
  }
}

const config = {
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '5000', 10),

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    adminSecret: process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET || '',
  },

  email: {
    gmailUser: process.env.GMAIL_USER || '',
    gmailPass: process.env.GMAIL_APP_PASSWORD || '',
    adminRecipient: process.env.ADMIN_EMAIL_RECIPIENT || process.env.ADMIN_EMAIL || '',
  },

  whatsapp: {
    phone: process.env.CALLMEBOT_PHONE || '',
    apiKey: process.env.CALLMEBOT_API_KEY || '',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  // Business rules
  business: {
    freeShippingThreshold: 1500, // INR — orders above this get free shipping
    shippingCost: 250,           // INR — flat rate below threshold
    estimatedDelivery: '14 - 21 Days',
  },

  validate,
};

module.exports = config;
