const express = require('express');
const supabase = require('../lib/supabase');
const { checkPincodeServiceability, isConfigured } = require('../services/shiprocketService');
const { sendCustomerStatusUpdate } = require('../services/whatsappService');
const { shapeForNotifications } = require('../utils/orderShaper');

const router = express.Router();

/**
 * POST /api/shipping/check-pincode
 * Public — validate that a delivery pincode is serviceable & list couriers.
 * Body: { pincode, weightKg?, cod? }
 */
router.post('/check-pincode', async (req, res) => {
  try {
    const pincode = String(req.body.pincode || '').trim();
    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 6-digit pincode' });
    }
    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        serviceable: false,
        message: 'Shipping service not configured yet',
      });
    }

    const weightKg = Number(req.body.weightKg || 0.5);
    const cod = Boolean(req.body.cod);

    const data = await checkPincodeServiceability(pincode, { weightKg, isCOD: cod });
    const couriers = data?.data?.available_courier_companies || [];
    const recommended = data?.data?.recommended_courier_companies || [];

    res.json({
      success: true,
      serviceable: couriers.length > 0,
      availableCouriers: couriers.map((c) => ({
        id: c.courier_company_id,
        name: c.courier_name || c.courier_name_internal,
        estimatedDays: c.estimated_delivery_days,
        rate: c.rate,
      })),
      recommended: recommended.length > 0 ? recommended[0] : null,
      message: couriers.length > 0
        ? `${couriers.length} courier(s) available to ${pincode}`
        : `No courier available to ${pincode}`,
    });
  } catch (err) {
    console.error('Pincode check error:', err.message);
    res.status(500).json({ success: false, message: `Pincode check failed: ${err.message}` });
  }
});

/**
 * POST /api/shipping/webhook
 * Shiprocket webhook → live tracking updates.
 * Validate x-api-key header, then update order status.
 */
router.post('/webhook', async (req, res) => {
  const expected = process.env.SHIPROCKET_WEBHOOK_SECRET;
  if (!expected) {
    return res.status(500).json({ success: false, message: 'Webhook secret not configured' });
  }

  const provided = req.headers['x-api-key'] || req.headers['x-shiprocket-webhook-token'];
  if (provided !== expected) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const payload = req.body;
    const { current_status, awb_code, shipment_id } = payload;

    console.log('📦 Shiprocket webhook:', JSON.stringify(payload).slice(0, 300));

    // Map Shiprocket status → our status
    const statusMap = {
      DELIVERED: 'delivered',
      DELIVERED_TO_PARTNER: 'delivered',
      OUT_FOR_DELIVERY: 'shipped',
      IN_TRANSIT: 'shipped',
      SHIPPED: 'shipped',
      PICKED_UP: 'shipped',
      PICKUP_ERROR: 'processing',
      CANCELLED: 'cancelled',
      RTO: 'cancelled',
    };
    const mappedStatus = statusMap[String(current_status || '').toUpperCase()];

    // Locate order by awb_code or shipment_id
    let order = null;
    if (awb_code) {
      const r = await supabase.from('orders').select('*, order_items(*)').eq('awb_code', awb_code).single();
      if (!r.error) order = r.data;
    }
    if (!order && shipment_id) {
      const r = await supabase.from('orders').select('*, order_items(*)').eq('shipment_id', String(shipment_id)).single();
      if (!r.error) order = r.data;
    }

    if (!order) {
      return res.status(200).json({ success: false, message: 'Order not found for webhook (ignored)' });
    }

    const update = { updated_at: new Date().toISOString() };
    if (mappedStatus && order.status !== mappedStatus) {
      update.status = mappedStatus;
    }
    if (awb_code && !order.awb_code) update.awb_code = awb_code;

    const { error: updErr } = await supabase.from('orders').update(update).eq('id', order.id);
    if (updErr) throw updErr;

    // Notify customer on key transitions
    if (mappedStatus === 'delivered') {
      sendCustomerStatusUpdate(shapeForNotifications({ ...order, ...update }), 'delivered').catch(() => {});
    } else if (mappedStatus === 'shipped' && order.status !== 'shipped') {
      sendCustomerStatusUpdate(shapeForNotifications({ ...order, ...update }), 'shipped').catch(() => {});
    }

    res.status(200).send('Webhook Received');
  } catch (err) {
    console.error('Shiprocket webhook error:', err.message);
    res.status(500).send('Webhook Error');
  }
});

module.exports = router;