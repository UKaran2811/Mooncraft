/**
 * Shipping routes — Hono (Workers-compatible).
 * Mirrors backend/routes/shipping.js.
 */
import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase';
import { isConfigured, checkPincodeServiceability } from '../services/shiprocket';
import { sendCustomerStatusUpdate } from '../services/whatsapp';
import { shapeForNotifications } from '../utils/orderShaper';

const router = new Hono<{ Bindings: Env }>();

// ── Pincode serviceability (public) ───────
router.post('/check-pincode', async (c) => {
  try {
    const body = await c.req.json();
    const pincode = String(body.pincode || '').trim();
    if (!/^\d{6}$/.test(pincode)) {
      return c.json({ success: false, message: 'Enter a valid 6-digit pincode' }, 400);
    }
    if (!isConfigured(c.env)) {
      return c.json({
        success: false,
        serviceable: false,
        message: 'Shipping service not configured yet',
      }, 503);
    }

    const weightKg = Number(body.weightKg || 0.5);
    const cod = Boolean(body.cod);

    const data = await checkPincodeServiceability(c.env, pincode, weightKg, cod);
    const couriers = data?.data?.available_courier_companies || [];
    const recommended = data?.data?.recommended_courier_companies || [];

    return c.json({
      success: true,
      serviceable: couriers.length > 0,
      availableCouriers: couriers.map((courier: any) => ({
        id: courier.courier_company_id,
        name: courier.courier_name || courier.courier_name_internal,
        estimatedDays: courier.estimated_delivery_days,
        rate: courier.rate,
      })),
      recommended: recommended.length > 0 ? recommended[0] : null,
      message: couriers.length > 0
        ? `${couriers.length} courier(s) available to ${pincode}`
        : `No courier available to ${pincode}`,
    });
  } catch (err: any) {
    console.error('Pincode check error:', err.message);
    return c.json({ success: false, message: `Pincode check failed: ${err.message}` }, 500);
  }
});

// ── Shiprocket webhook (x-api-key auth) ───
router.post('/webhook', async (c) => {
  const expected = c.env.SHIPROCKET_WEBHOOK_SECRET;
  if (!expected) {
    return c.json({ success: false, message: 'Webhook secret not configured' }, 500);
  }

  const provided = c.req.header('x-api-key') || c.req.header('x-shiprocket-webhook-token');
  if (provided !== expected) {
    return c.text('Unauthorized', 401);
  }

  try {
    const payload = await c.req.json();
    const { current_status, awb_code, shipment_id } = payload;

    console.log('📦 Shiprocket webhook:', JSON.stringify(payload).slice(0, 300));

    const statusMap: Record<string, string> = {
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

    const supabase = getSupabase(c.env);

    let order: any = null;
    if (awb_code) {
      const r = await supabase.from('orders').select('*, order_items(*)').eq('awb_code', awb_code).single();
      if (!r.error) order = r.data;
    }
    if (!order && shipment_id) {
      const r = await supabase.from('orders').select('*, order_items(*)').eq('shipment_id', String(shipment_id)).single();
      if (!r.error) order = r.data;
    }

    if (!order) {
      return c.json({ success: false, message: 'Order not found for webhook (ignored)' });
    }

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (mappedStatus && order.status !== mappedStatus) {
      update.status = mappedStatus;
    }
    if (awb_code && !order.awb_code) update.awb_code = awb_code;

    const { error: updErr } = await supabase.from('orders').update(update).eq('id', order.id);
    if (updErr) throw updErr;

    if (mappedStatus === 'delivered') {
      sendCustomerStatusUpdate(c.env, shapeForNotifications({ ...order, ...update }), 'delivered').catch(() => {});
    } else if (mappedStatus === 'shipped' && order.status !== 'shipped') {
      sendCustomerStatusUpdate(c.env, shapeForNotifications({ ...order, ...update }), 'shipped').catch(() => {});
    }

    return c.text('Webhook Received', 200);
  } catch (err: any) {
    console.error('Shiprocket webhook error:', err.message);
    return c.text('Webhook Error', 500);
  }
});

export default router;