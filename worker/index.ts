/**
 * Mooncraft — unified Cloudflare Worker.
 * Serves the React frontend (static assets) AND the /api/* backend on one URL.
 */
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { getSupabase } from './lib/supabase';
import { hmacSha256 } from './utils/crypto';
import { shapeOrder } from './utils/orderShaper';
import { sendOrderConfirmationEmail, sendAdminOrderAlert } from './services/email';
import { sendAdminWhatsAppAlert } from './services/whatsapp';

import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import adminRoutes from './routes/admin';
import shippingRoutes from './routes/shipping';
import uploadRoutes from './routes/upload';

type AppEnv = { Bindings: Env };

const app = new Hono<AppEnv>();

// ── Global middleware ──────────────────────
app.use('*', secureHeaders());

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return '*';
      if (origin.includes('localhost')) return origin;
      if (origin.includes('.vercel.app')) return origin;
      if (origin.includes('mooncraftbymoniyal.com')) return origin;
      return origin; // unified worker — same origin as frontend
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  })
);

// Simple in-memory rate limiter (200 req / 15 min per IP)
const rateMap = new Map<string, number[]>();
app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/api/products') && c.req.method === 'GET') return next();
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const hits = (rateMap.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (hits.length >= 200) {
    return c.json({ success: false, message: 'Too many requests. Please try again later.' }, 429);
  }
  hits.push(now);
  rateMap.set(ip, hits);
  return next();
});

// ── Health check ───────────────────────────
app.get('/api/health', (c) => {
  return c.json({
    success: true,
    status: 'healthy',
    service: 'Mooncraft API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    environment: c.env.NODE_ENV || 'development',
  });
});

// ── API routes ─────────────────────────────
app.route('/api/auth', authRoutes);
app.route('/api/products', productRoutes);
app.route('/api/orders', orderRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/shipping', shippingRoutes);
app.route('/api/upload', uploadRoutes);

// ── Razorpay webhook (raw body + HMAC) ─────
app.post('/api/webhooks/razorpay', async (c) => {
  try {
    const secret = c.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return c.json({ success: false, message: 'Webhook secret not configured' }, 400);

    const receivedSig = c.req.header('x-razorpay-signature');
    const rawBody = await c.req.text();
    const expectedSig = await hmacSha256(secret, rawBody);

    if (!receivedSig || receivedSig !== expectedSig) {
      return c.json({ success: false, message: 'Invalid webhook signature' }, 400);
    }

    const event = JSON.parse(rawBody);
    console.log('🔔 Razorpay webhook event:', event.event);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const supabase = getSupabase(c.env);

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
        const shaped = shapeOrder(order);
        const [emailResult, , waResult] = await Promise.allSettled([
          sendOrderConfirmationEmail(c.env, shaped),
          sendAdminOrderAlert(c.env, shaped),
          sendAdminWhatsAppAlert(c.env, shaped),
        ]);
        await supabase.from('orders').update({
          email_sent: emailResult.status === 'fulfilled' && emailResult.value === true,
          whatsapp_sent: waResult.status === 'fulfilled' && waResult.value === true,
        }).eq('id', order.id);
      }
    }

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    return c.json({ success: false }, 500);
  }
});

// ── 404 for unknown API routes ─────────────
app.notFound((c) => {
  if (c.req.path.startsWith('/api')) {
    return c.json({ success: false, message: `Route ${c.req.method} ${c.req.path} not found` }, 404);
  }
  // Non-API → fall through to static assets
  return c.env.ASSETS ? c.env.ASSETS.fetch(c.req.raw) : c.text('Not found', 404);
});

// ── Global error handler ──────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err.message || err);
  if (c.req.path.startsWith('/api')) {
    const status = (err as any).status || 500;
    return c.json(
      {
        success: false,
        message:
          c.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Unknown error',
      },
      status
    );
  }
  return c.text('Internal Server Error', 500);
});

export default app;