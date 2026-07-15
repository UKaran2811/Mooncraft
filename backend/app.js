require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');

// Route imports
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');

const app = express();

// ──────────────────────────────────────────────
// SECURITY MIDDLEWARE
// ──────────────────────────────────────────────

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Handled by frontend
  })
);

// Dev request logger — disabled in production
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    const start = Date.now();
    _res.on('finish', () => {
      const ms = Date.now() - start;
      const color = _res.statusCode >= 500 ? '\x1b[31m' : _res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(`${color}${req.method}\x1b[0m ${req.path} → ${_res.statusCode} (${ms}ms)`);
    });
    next();
  });
}

// CORS — allow frontend origin(s)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  process.env.APP_URL,
  // Vercel preview URLs
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman / curl / mobile
      // Allow any vercel.app preview URL for this project
      if (origin.includes('.vercel.app')) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsers
// NOTE: Razorpay webhook needs raw body — register it BEFORE express.json()
// The webhook route uses its own express.raw() parser inline (see below).
// All other routes use the parsers registered here.
app.use((req, res, next) => {
  // Preserve raw body for Razorpay webhook signature verification
  if (req.path === '/api/webhooks/razorpay') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Trust proxy — needed for Vercel / Railway / Render to get correct IP
app.set('trust proxy', 1);

// Global rate limit: 200 req / 15 min per IP
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again later.' },
    skip: (req) =>
      req.method === 'GET' && req.path.startsWith('/api/products'), // Don't limit product browsing
  })
);

// ──────────────────────────────────────────────
// ROUTES
// ──────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'Mooncraft API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// ──────────────────────────────────────────────
// RAZORPAY WEBHOOK
// Raw body handled by the conditional middleware above (before express.json)
// ──────────────────────────────────────────────
app.post(
  '/api/webhooks/razorpay',
  async (req, res) => {
    try {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!secret) {
        return res.status(400).json({ success: false, message: 'Webhook secret not configured' });
      }

      const receivedSig = req.headers['x-razorpay-signature'];
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(req.body)
        .digest('hex');

      if (receivedSig !== expectedSig) {
        return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      }

      const event = JSON.parse(req.body.toString());
      console.log('🔔 Razorpay webhook event:', event.event);

      if (event.event === 'payment.captured') {
        const supabase = require('./lib/supabase');
        const { sendOrderConfirmationEmail, sendAdminOrderAlert } = require('./services/emailService');
        const { sendAdminWhatsAppAlert } = require('./services/whatsappService');
        const { shapeOrder } = require('./utils/orderShaper');

        const payment = event.payload.payment.entity;

        // Find & update order
        const { data: order, error } = await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            payment_status: 'paid',
            razorpay_payment_id: payment.id,
            paid_at: new Date().toISOString(),
          })
          .eq('razorpay_order_id', payment.order_id)
          .select('*, order_items(*)')
          .single();

        if (!error && order) {
          // Reshape for notification services
          const shaped = shapeOrder(order);
          const [emailResult, , waResult] = await Promise.allSettled([
            sendOrderConfirmationEmail(shaped),
            sendAdminOrderAlert(shaped),
            sendAdminWhatsAppAlert(shaped),
          ]);
          // Track whether notifications were sent
          await supabase.from('orders').update({
            email_sent: emailResult.status === 'fulfilled' && emailResult.value === true,
            whatsapp_sent: waResult.status === 'fulfilled' && waResult.value === true,
          }).eq('id', order.id);
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(500).json({ success: false });
    }
  }
);

// ──────────────────────────────────────────────
// ERROR HANDLERS
// ──────────────────────────────────────────────

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message || err);

  if (err.message?.includes('CORS')) {
    return res.status(403).json({ success: false, message: err.message });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request too large' });
  }

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Unknown error',
  });
});



module.exports = app;
