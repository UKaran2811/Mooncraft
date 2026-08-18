const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const supabase = require('../lib/supabase');
const { requireAdmin, requireAuth, optionalAuth } = require('../middleware/auth');
const { sendOrderConfirmationEmail, sendAdminOrderAlert } = require('../services/emailService');
const { sendAdminWhatsAppAlert, sendCustomerOrderConfirmation, sendCustomerStatusUpdate } = require('../services/whatsappService');
const { shapeOrder, shapeAdminOrder, shapeForNotifications } = require('../utils/orderShaper');
const { isConfigured: shiprocketConfigured, createShipment, schedulePickup, trackShipment } = require('../services/shiprocketService');

const router = express.Router();

// Rate limiter for public order tracking (prevent enumeration)
const trackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many tracking requests. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
};

// Lazily initialize Razorpay (only if keys are present)
let razorpay = null;
const getRazorpay = () => {
  if (!razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
};

// Generate a unique order number
const generateOrderNumber = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `MC-${ts}-${rand}`;
};

// ──────────────────────────────────────────────
// CUSTOMER: Place Order
// ──────────────────────────────────────────────

/**
 * POST /api/orders
 */
router.post(
  '/',
  requireAuth,
  [
    body('customer.name').trim().notEmpty().withMessage('Customer name required'),
    body('customer.email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('customer.phone').trim().notEmpty().withMessage('Phone required'),
    body('customer.address.line1').trim().notEmpty().withMessage('Address required'),
    body('customer.address.city').trim().notEmpty().withMessage('City required'),
    body('customer.address.state').trim().notEmpty().withMessage('State required'),
    body('customer.address.zip').trim().notEmpty().withMessage('ZIP required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.productId').trim().notEmpty().withMessage('Product ID required for each item'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('paymentMethod').optional().isIn(['razorpay', 'cod']),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { customer, items, notes, paymentMethod = 'razorpay' } = req.body;

      // ── Validate items & recalculate price from DB (security) ──
      let subtotal = 0;
      const validatedItems = [];

      for (const item of items) {
        const { data: product } = await supabase
          .from('products')
          .select('slug_id, name, price, image, is_active')
          .eq('slug_id', item.productId)
          .eq('is_active', true)
          .single();

        if (!product) {
          return res.status(400).json({ success: false, message: `Product not found: ${item.productId}` });
        }

        subtotal += product.price * item.quantity;
        validatedItems.push({
          product_id: item.productId,
          name: product.name,
          price: product.price,   // ← always from DB, never trust frontend price
          quantity: item.quantity,
          image: product.image || null,
          selected_option: item.selectedOption || null,
        });
      }

      const shipping = subtotal > 1500 ? 0 : 250;
      const total = subtotal + shipping;
      const orderNumber = generateOrderNumber();

      // ── Create order row ──────────────────────────────────────
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_name: customer.name,
          customer_email: customer.email.toLowerCase(),
          customer_phone: customer.phone,
          address_line1: customer.address.line1,
          address_city: customer.address.city,
          address_state: customer.address.state,
          address_zip: customer.address.zip,
          user_id: req.user?.id || null,
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

      // ── Create order_items rows ────────────────────────────────
      const { error: itemsError } = await supabase.from('order_items').insert(
        validatedItems.map((i) => ({ ...i, order_id: order.id }))
      );
      if (itemsError) throw itemsError;

      // ── Razorpay payment order ────────────────────────────────
      let razorpayOrderId = null;
      const rz = getRazorpay();
      if (rz && paymentMethod === 'razorpay') {
        try {
          const rzOrder = await rz.orders.create({
            amount: Math.round(total * 100), // paise
            currency: 'INR',
            receipt: orderNumber,
            notes: { orderNumber },
          });
          razorpayOrderId = rzOrder.id;

          await supabase
            .from('orders')
            .update({ razorpay_order_id: razorpayOrderId })
            .eq('id', order.id);
        } catch (rzErr) {
          console.error('Razorpay order creation failed:', rzErr.message);
          // Continue — will fall through to COD-style confirmation
        }
      }

      // ── COD or no Razorpay → auto-confirm ────────────────────
      if (!razorpayOrderId) {
        await supabase
          .from('orders')
          .update({ status: 'confirmed', payment_status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', order.id);

        const shaped = shapeOrder({ ...order, items: validatedItems });
        await sendNotifications(shaped, order.id);
      }

      res.status(201).json({
        success: true,
        orderNumber,
        orderId: order.id,
        razorpayOrderId,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || null,
        amount: total,
        currency: 'INR',
        message: 'Order placed successfully',
      });
    } catch (err) {
      console.error('Create order error:', err);
      res.status(500).json({ success: false, message: 'Failed to place order' });
    }
  }
);

/**
 * POST /api/orders/verify-payment
 * Verify Razorpay payment signature and confirm order
 */
router.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderNumber } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment details incomplete' });
    }

    // Verify HMAC signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // Update order
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

    if (error || !order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Fetch items for notification
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    const shaped = shapeForNotifications({ ...order, items: items || [] });
    await sendNotifications(shaped, order.id);

    res.json({ success: true, orderNumber: order.order_number, message: 'Payment confirmed' });
  } catch (err) {
    console.error('Payment verify error:', err);
    res.status(500).json({ success: false, message: 'Payment verification error' });
  }
});

/**
 * GET /api/orders/track/:orderNumber
 * Public order tracking (requires email verification)
 * NOTE: Must be before /:id wildcard
 */
router.get('/track/:orderNumber', trackingLimiter, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: 'Email required for tracking' });

    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('order_number', req.params.orderNumber)
      .eq('customer_email', email.toLowerCase())
      .single();

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Remove sensitive payment fields
    delete order.razorpay_signature;
    delete order.admin_notes;

    res.json({ success: true, data: order });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/orders/my
 * Logged-in customer's own orders
 * NOTE: Must be before /:id wildcard
 */
router.get('/my', requireAuth, async (req, res) => {
  try {
    // Filter by user_id (for OTP users who have null email) OR customer_email
    // for backward compatibility with orders placed before user_id was tracked.
    const conditions = [`user_id.eq.${req.user.id}`];
    if (req.user.email) conditions.push(`customer_email.eq.${req.user.email}`);

    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .or(conditions.join(','))
      .order('created_at', { ascending: false });

    res.json({ success: true, data: orders || [] });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// ADMIN: All orders
// ──────────────────────────────────────────────

/**
 * GET /api/orders
 * Filtered orders list (admin only)
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search, sort = 'newest' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

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

    query = query.range(offset, offset + Number(limit) - 1);

    const { data: orders, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: (orders || []).map(shapeAdminOrder),
      pagination: { total: count, page: Number(page), pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/orders/:id
 * Single order detail (admin only)
 */
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: shapeAdminOrder(order) });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * PATCH /api/orders/:id/status
 * Update order status (admin only)
 */
router.patch(
  '/:id/status',
  requireAdmin,
  [body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { status, adminNotes, trackingNumber, courierPartner } = req.body;
      const update = { status };
      if (adminNotes) update.admin_notes = adminNotes;
      if (trackingNumber) update.tracking_number = trackingNumber;
      if (courierPartner) update.courier_partner = courierPartner;

      const { data: order, error } = await supabase
        .from('orders')
        .update(update)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error || !order) return res.status(404).json({ success: false, message: 'Order not found' });

      // Fetch items for notification
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      const shaped = shapeForNotifications({ ...order, items: items || [] });
      sendCustomerStatusUpdate(shaped, status).catch(() => {});

      res.json({ success: true, data: order, message: `Order status → ${status}` });
    } catch {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

/**
 * POST /api/orders/:id/ship
 * Create a Shiprocket shipment for an order (admin only).
 * Updates order with shipment_id, awb_code, courier, status → shipped.
 */
router.post('/:id/ship', requireAdmin, async (req, res) => {
  if (!shiprocketConfigured()) {
    return res.status(400).json({
      success: false,
      message: 'Shiprocket not configured. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.',
    });
  }

  const { schedulePickupNow = false } = req.body;
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !order) return res.status(404).json({ success: false, message: 'Order not found' });

    const shaped = shapeAdminOrder(order);
    const shipment = await createShipment(shaped);

    const update = {
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

    let pickup = null;
    if (schedulePickupNow && shipment.shipmentId) {
      try {
        pickup = await schedulePickup(shipment.shipmentId);
      } catch (e) {
        console.warn('Shiprocket pickup scheduling failed:', e.message);
      }
    }

    // Notify customer that order is shipped (with tracking info)
    sendCustomerStatusUpdate(shapeForNotifications(updated), 'shipped').catch(() => {});

    res.json({
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
  } catch (err) {
    console.error('Shiprocket ship error:', err.message);
    res.status(500).json({ success: false, message: `Shiprocket error: ${err.message}` });
  }
});

/**
 * GET /api/orders/:id/tracking
 * Live tracking from Shiprocket (admin only).
 */
router.get('/:id/tracking', requireAdmin, async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('shipment_id')
      .eq('id', req.params.id)
      .single();

    if (error || !order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!order.shipment_id) {
      return res.status(400).json({ success: false, message: 'No Shiprocket shipment for this order yet' });
    }
    if (!shiprocketConfigured()) {
      return res.status(400).json({ success: false, message: 'Shiprocket not configured' });
    }

    const tracking = await trackShipment(order.shipment_id);
    res.json({ success: true, data: tracking });
  } catch (err) {
    console.error('Shiprocket tracking error:', err.message);
    res.status(500).json({ success: false, message: `Tracking error: ${err.message}` });
  }
});

/**
 * DELETE /api/orders/:id
 * Cancel order (admin only)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, message: 'Order cancelled' });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// DEV ONLY: Simulate a successful Razorpay payment
// Generates a valid HMAC signature from the real KEY_SECRET so you can
// test the full order → confirm → email flow without the Razorpay test UI.
// ⛔ BLOCKED in production — never runs when NODE_ENV=production
// ──────────────────────────────────────────────

router.post('/:id/simulate-payment', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, razorpay_order_id, payment_status')
      .eq('id', req.params.id)
      .single();

    if (error || !order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Order already paid' });
    }
    if (!order.razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'No Razorpay order ID on this order — was it created with paymentMethod=razorpay?' });
    }

    // Generate a fake but structurally valid payment ID
    const fakePaymentId = `pay_TEST${Date.now()}`;
    const razorpayOrderId = order.razorpay_order_id;

    // Sign with the real KEY_SECRET — this makes verify-payment accept it
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${fakePaymentId}`)
      .digest('hex');

    res.json({
      success: true,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: signature,
      orderNumber: order.order_number,
    });
  } catch (err) {
    console.error('Simulate payment error:', err);
    res.status(500).json({ success: false, message: 'Simulation failed' });
  }
});

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

async function sendNotifications(shaped, orderId) {
  const [emailOk, , waAdminOk, waCustomerOk] = await Promise.allSettled([
    sendOrderConfirmationEmail(shaped),
    sendAdminOrderAlert(shaped),
    sendAdminWhatsAppAlert(shaped),
    sendCustomerOrderConfirmation(shaped),
  ]);

  await supabase.from('orders').update({
    email_sent: emailOk.status === 'fulfilled' && emailOk.value === true,
    whatsapp_sent: waCustomerOk.status === 'fulfilled' && waCustomerOk.value === true,
  }).eq('id', orderId);
}

module.exports = router;

