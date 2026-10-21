/**
 * Order routes — Hono (Workers-compatible).
 * Mirrors backend/routes/orders.js (Razorpay SDK replaced with raw fetch).
 */
import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { sendOrderConfirmationEmail, sendAdminOrderAlert } from '../services/email';
import { sendAdminWhatsAppAlert, sendCustomerOrderConfirmation, sendCustomerStatusUpdate } from '../services/whatsapp';
import { shapeOrder, shapeAdminOrder, shapeForNotifications } from '../utils/orderShaper';
import { isConfigured as shiprocketConfigured, createShipment, schedulePickup, trackShipment } from '../services/shiprocket';
import { hmacSha256 } from '../utils/crypto';

const router = new Hono<{ Bindings: Env }>();

const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

const trackingAttempts = new Map<string, number[]>();
function trackingLimited(ip: string): boolean {
  const now = Date.now();
  const times = (trackingAttempts.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (times.length >= 10) {
    trackingAttempts.set(ip, times);
    return true;
  }
  times.push(now);
  trackingAttempts.set(ip, times);
  return false;
}

const getIp = (c: any) => c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';

function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `MC-${ts}-${rand}`;
}

async function createRazorpayOrder(env: Env, { amount, currency, receipt, notes }: { amount: number; currency: string; receipt: string; notes: any }): Promise<any> {
  const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount, currency, receipt, notes }),
  });
  if (!res.ok) throw new Error(`Razorpay order create failed (${res.status})`);
  return res.json();
}

// ── CUSTOMER: Place Order ─────────────────
router.post('/', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { customer, items, notes, paymentMethod = 'razorpay' } = body;

    if (!customer?.name || !customer?.email || !customer?.phone) {
      return c.json({ success: false, message: 'Customer details required' }, 400);
    }
    if (!customer.address?.line1 || !customer.address?.city || !customer.address?.state || !customer.address?.zip) {
      return c.json({ success: false, message: 'Complete address required' }, 400);
    }
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ success: false, message: 'At least one item required' }, 400);
    }
    if (paymentMethod !== 'razorpay' && paymentMethod !== 'cod') {
      return c.json({ success: false, message: 'Invalid payment method' }, 400);
    }

    const supabase = getSupabase(c.env);

    // Validate items & recalculate price from DB (security)
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return c.json({ success: false, message: 'Product ID and valid quantity required for each item' }, 400);
      }
      const { data: product } = await supabase
        .from('products')
        .select('slug_id, name, price, image, is_active')
        .eq('slug_id', item.productId)
        .eq('is_active', true)
        .single();

      if (!product) return c.json({ success: false, message: `Product not found: ${item.productId}` }, 400);

      subtotal += product.price * item.quantity;
      validatedItems.push({
        product_id: item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        image: product.image || null,
        selected_option: item.selectedOption || null,
      });
    }

    const shipping = subtotal > 1500 ? 0 : 250;
    const total = subtotal + shipping;
    const orderNumber = generateOrderNumber();
    const user = c.get('user');

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_name: customer.name,
        customer_email: String(customer.email).toLowerCase(),
        customer_phone: customer.phone,
        address_line1: customer.address.line1,
        address_city: customer.address.city,
        address_state: customer.address.state,
        address_zip: customer.address.zip,
        user_id: user?.id || null,
        subtotal,
        shipping,
        total,
        notes: notes || null,
        payment_method: paymentMethod,
        payment_status: 'unpaid',
        status: 'pending',
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const { error: itemsError } = await supabase.from('order_items').insert(
      validatedItems.map((i) => ({ ...i, order_id: order.id }))
    );
    if (itemsError) throw itemsError;

    // Razorpay payment order (raw fetch)
    let razorpayOrderId = null;
    if (c.env.RAZORPAY_KEY_ID && c.env.RAZORPAY_KEY_SECRET && paymentMethod === 'razorpay') {
      try {
        const rzOrder = await createRazorpayOrder(c.env, {
          amount: Math.round(total * 100),
          currency: 'INR',
          receipt: orderNumber,
          notes: { orderNumber },
        });
        razorpayOrderId = rzOrder.id;

        await supabase.from('orders').update({ razorpay_order_id: razorpayOrderId }).eq('id', order.id);
      } catch (rzErr: any) {
        console.error('Razorpay order creation failed:', rzErr.message);
      }
    }

    // COD or no Razorpay → auto-confirm
    if (!razorpayOrderId) {
      await supabase
        .from('orders')
        .update({ status: 'confirmed', payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', order.id);

      const shaped = shapeOrder({ ...order, items: validatedItems });
      await sendNotifications(c.env, shaped, order.id);
    }

    return c.json({
      success: true,
      orderNumber,
      orderId: order.id,
      razorpayOrderId,
      razorpayKeyId: c.env.RAZORPAY_KEY_ID || null,
      amount: total,
      currency: 'INR',
      message: 'Order placed successfully',
    }, 201);
  } catch (err: any) {
    console.error('Create order error:', err.message);
    return c.json({ success: false, message: 'Failed to place order' }, 500);
  }
});

// ── Verify Payment ────────────────────────
router.post('/verify-payment', async (c) => {
  try {
    const body = await c.req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return c.json({ success: false, message: 'Payment details incomplete' }, 400);
    }

    const hmacBody = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = await hmacSha256(c.env.RAZORPAY_KEY_SECRET, hmacBody);

    if (expected !== razorpay_signature) {
      return c.json({ success: false, message: 'Payment verification failed' }, 400);
    }

    const supabase = getSupabase(c.env);
    const { data: order, error } = await supabase
      .from('orders')
      .update({
        status: 'confirmed',
        payment_status: 'paid',
        razorpay_payment_id,
        razorpay_signature,
        paid_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', razorpay_order_id)
      .select()
      .single();

    if (error || !order) return c.json({ success: false, message: 'Order not found' }, 404);

    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    const shaped = shapeForNotifications({ ...order, items: items || [] });
    await sendNotifications(c.env, shaped, order.id);

    return c.json({ success: true, orderNumber: order.order_number, message: 'Payment confirmed' });
  } catch (err: any) {
    console.error('Payment verify error:', err.message);
    return c.json({ success: false, message: 'Payment verification error' }, 500);
  }
});

// ── Track (public) ────────────────────────
router.get('/track/:orderNumber', async (c) => {
  if (trackingLimited(getIp(c))) {
    return c.json({ success: false, message: 'Too many tracking requests. Try again in 15 minutes.' }, 429);
  }
  try {
    const email = c.req.query('email');
    if (!email) return c.json({ success: false, message: 'Email required for tracking' }, 400);

    const supabase = getSupabase(c.env);
    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('order_number', c.req.param('orderNumber'))
      .eq('customer_email', email.toLowerCase())
      .single();

    if (!order) return c.json({ success: false, message: 'Order not found' }, 404);

    delete order.razorpay_signature;
    delete order.admin_notes;

    return c.json({ success: true, data: order });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── My orders (customer) ──────────────────
router.get('/my', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const supabase = getSupabase(c.env);

    const conditions = [`user_id.eq.${user.id}`];
    if (user.email) conditions.push(`customer_email.eq.${user.email}`);

    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .or(conditions.join(','))
      .order('created_at', { ascending: false });

    return c.json({ success: true, data: orders || [] });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── ADMIN: all orders ─────────────────────
router.get('/', requireAdmin, async (c) => {
  try {
    const q = c.req.query();
    const { status, search, sort = 'newest' } = q;
    const limit = Number(q.limit) || 20;
    const page = Number(q.page) || 1;
    const offset = (page - 1) * limit;

    const supabase = getSupabase(c.env);
    let query = supabase
      .from('orders')
      .select('*, order_items(*)', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (search) {
      query = query.or(
        `order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,customer_phone.ilike.%${search}%`
      );
    }

    if (sort === 'oldest') query = query.order('created_at', { ascending: true });
    else if (sort === 'highest') query = query.order('total', { ascending: false });
    else query = query.order('created_at', { ascending: false });

    query = query.range(offset, offset + limit - 1);

    const { data: orders, count, error } = await query;
    if (error) throw error;

    return c.json({
      success: true,
      data: (orders || []).map(shapeAdminOrder),
      pagination: { total: count, page, pages: Math.ceil((count || 0) / limit) },
    });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── ADMIN: order detail ───────────────────
router.get('/:id', requireAdmin, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', c.req.param('id'))
      .single();

    if (error || !order) return c.json({ success: false, message: 'Order not found' }, 404);
    return c.json({ success: true, data: shapeAdminOrder(order) });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── ADMIN: update status ──────────────────
router.patch('/:id/status', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    if (!VALID_STATUSES.includes(body.status)) {
      return c.json({ success: false, errors: [{ msg: 'Invalid status' }] }, 400);
    }

    const { status, adminNotes, trackingNumber, courierPartner } = body;
    const update: Record<string, any> = { status };
    if (adminNotes) update.admin_notes = adminNotes;
    if (trackingNumber) update.tracking_number = trackingNumber;
    if (courierPartner) update.courier_partner = courierPartner;

    const supabase = getSupabase(c.env);
    const { data: order, error } = await supabase
      .from('orders')
      .update(update)
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error || !order) return c.json({ success: false, message: 'Order not found' }, 404);

    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    const shaped = shapeForNotifications({ ...order, items: items || [] });
    sendCustomerStatusUpdate(c.env, shaped, status).catch(() => {});

    return c.json({ success: true, data: order, message: `Order status → ${status}` });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── ADMIN: ship via Shiprocket ────────────
router.post('/:id/ship', requireAdmin, async (c) => {
  if (!shiprocketConfigured(c.env)) {
    return c.json({
      success: false,
      message: 'Shiprocket not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.',
    }, 400);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const schedulePickupNow = Boolean(body.schedulePickupNow);

    const supabase = getSupabase(c.env);
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', c.req.param('id'))
      .single();

    if (error || !order) return c.json({ success: false, message: 'Order not found' }, 404);

    const shaped = shapeAdminOrder(order);
    const shipment = await createShipment(c.env, shaped);

    const update: Record<string, any> = {
      status: 'shipped',
      shipment_id: shipment.shipmentId || null,
      awb_code: shipment.awbCode || null,
      tracking_number: shipment.awbCode || order.tracking_number || null,
      courier_partner: shipment.courierName || order.courier_partner || null,
    };

    const { data: updated, error: updErr } = await supabase
      .from('orders')
      .update(update)
      .eq('id', order.id)
      .select()
      .single();
    if (updErr) throw updErr;

    let pickup: any = null;
    if (schedulePickupNow && shipment.shipmentId) {
      try {
        pickup = await schedulePickup(c.env, shipment.shipmentId);
      } catch (e: any) {
        console.warn('Shiprocket pickup scheduling failed:', e.message);
      }
    }

    sendCustomerStatusUpdate(c.env, shapeForNotifications(updated), 'shipped').catch(() => {});

    return c.json({
      success: true,
      data: shapeAdminOrder(updated),
      shipment: {
        shipmentId: shipment.shipmentId,
        awbCode: shipment.awbCode,
        courierName: shipment.courierName,
      },
      pickup,
      message: shipment.awbCode
        ? `Shipment created — AWB ${shipment.awbCode}`
        : 'Shipment created, but AWB generation is pending',
    });
  } catch (err: any) {
    console.error('Shiprocket ship error:', err.message);
    return c.json({ success: false, message: `Shiprocket error: ${err.message}` }, 500);
  }
});

// ── ADMIN: live tracking ──────────────────
router.get('/:id/tracking', requireAdmin, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: order, error } = await supabase
      .from('orders')
      .select('shipment_id')
      .eq('id', c.req.param('id'))
      .single();

    if (error || !order) return c.json({ success: false, message: 'Order not found' }, 404);
    if (!order.shipment_id) return c.json({ success: false, message: 'No Shiprocket shipment for this order yet' }, 400);
    if (!shiprocketConfigured(c.env)) return c.json({ success: false, message: 'Shiprocket not configured' }, 400);

    const tracking = await trackShipment(c.env, order.shipment_id);
    return c.json({ success: true, data: tracking });
  } catch (err: any) {
    console.error('Shiprocket tracking error:', err.message);
    return c.json({ success: false, message: `Tracking error: ${err.message}` }, 500);
  }
});

// ── ADMIN: cancel order ───────────────────
router.delete('/:id', requireAdmin, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: order, error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', c.req.param('id'))
      .select()
      .single();

    if (error || !order) return c.json({ success: false, message: 'Order not found' }, 404);
    return c.json({ success: true, message: 'Order cancelled' });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── DEV: simulate payment ─────────────────
router.post('/:id/simulate-payment', async (c) => {
  if (c.env.NODE_ENV === 'production') {
    return c.json({ success: false, message: 'Not found' }, 404);
  }

  try {
    const supabase = getSupabase(c.env);
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, razorpay_order_id, payment_status')
      .eq('id', c.req.param('id'))
      .single();

    if (error || !order) return c.json({ success: false, message: 'Order not found' }, 404);
    if (order.payment_status === 'paid') return c.json({ success: false, message: 'Order already paid' }, 400);
    if (!order.razorpay_order_id) {
      return c.json({ success: false, message: 'No Razorpay order ID on this order — was it created with paymentMethod=razorpay?' }, 400);
    }

    const fakePaymentId = `pay_TEST${Date.now()}`;
    const razorpayOrderId = order.razorpay_order_id;

    const signature = await hmacSha256(c.env.RAZORPAY_KEY_SECRET, `${razorpayOrderId}|${fakePaymentId}`);

    return c.json({
      success: true,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: signature,
      orderNumber: order.order_number,
    });
  } catch (err: any) {
    console.error('Simulate payment error:', err.message);
    return c.json({ success: false, message: 'Simulation failed' }, 500);
  }
});

// ── Helpers ───────────────────────────────
async function sendNotifications(env: Env, shaped: any, orderId: string) {
  const [emailOk, , waAdminOk, waCustomerOk] = await Promise.allSettled([
    sendOrderConfirmationEmail(env, shaped),
    sendAdminOrderAlert(env, shaped),
    sendAdminWhatsAppAlert(env, shaped),
    sendCustomerOrderConfirmation(env, shaped),
  ]);

  const supabase = getSupabase(env);
  await supabase.from('orders').update({
    email_sent: emailOk.status === 'fulfilled' && emailOk.value === true,
    whatsapp_sent: waCustomerOk.status === 'fulfilled' && waCustomerOk.value === true,
  }).eq('id', orderId);
}

export default router;