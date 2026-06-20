const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const supabase = require('../lib/supabase');
const { requireAdmin, requireAuth, optionalAuth } = require('../middleware/auth');
const { sendOrderConfirmationEmail, sendAdminOrderAlert } = require('../services/emailService');
const { sendAdminWhatsAppAlert } = require('../services/whatsappService');

const router = express.Router();

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
  optionalAuth,
  [
    body('customer.name').trim().notEmpty().withMessage('Customer name required'),
    body('customer.email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('customer.phone').trim().notEmpty().withMessage('Phone required'),
    body('customer.address.line1').trim().notEmpty().withMessage('Address required'),
    body('customer.address.city').trim().notEmpty().withMessage('City required'),
    body('customer.address.state').trim().notEmpty().withMessage('State required'),
    body('customer.address.zip').trim().notEmpty().withMessage('ZIP required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
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

        const shaped = shapeForNotifications({ ...order, items: validatedItems });
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
 */
router.get('/track/:orderNumber', async (req, res) => {
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
 */
router.get('/my', requireAuth, async (req, res) => {
  try {
    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('customer_email', req.user.email)
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
      data: orders,
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
    res.json({ success: true, data: order });
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
      res.json({ success: true, data: order, message: `Order status → ${status}` });
    } catch {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

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
// HELPERS
// ──────────────────────────────────────────────

function shapeForNotifications(row) {
  return {
    _id: row.id,
    orderNumber: row.order_number,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
      address: {
        line1: row.address_line1,
        city: row.address_city,
        state: row.address_state,
        zip: row.address_zip,
      },
    },
    items: (row.items || []).map((i) => ({
      name: i.name,
      price: Number(i.price),
      quantity: i.quantity,
      selectedOption: i.selected_option,
    })),
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping),
    total: Number(row.total),
    status: row.status,
    estimatedDelivery: row.estimated_delivery || '14 - 21 Days',
  };
}

async function sendNotifications(shaped, orderId) {
  const [emailOk, , waOk] = await Promise.allSettled([
    sendOrderConfirmationEmail(shaped),
    sendAdminOrderAlert(shaped),
    sendAdminWhatsAppAlert(shaped),
  ]);

  await supabase.from('orders').update({
    email_sent: emailOk.status === 'fulfilled' && emailOk.value === true,
    whatsapp_sent: waOk.status === 'fulfilled' && waOk.value === true,
  }).eq('id', orderId);
}

module.exports = router;
