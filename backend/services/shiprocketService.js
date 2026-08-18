/**
 * backend/services/shiprocketService.js
 *
 * Shiprocket API integration for automated order shipping:
 *   - Auth token (cached)
 *   - Create adhoc shipment order
 *   - Generate AWB number
 *   - Schedule pickup
 *   - Track shipment
 *
 * Docs: https://apidocs.shiprocket.in/
 * Env:  SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD, SHIPROCKET_PICKUP_LOCATION
 */

const API_BASE = 'https://apiv2.shiprocket.in/v1/external';

let cachedToken = null;
let tokenExpiry = 0;

const isConfigured = () =>
  !!process.env.SHIPROCKET_EMAIL &&
  !!process.env.SHIPROCKET_PASSWORD &&
  !process.env.SHIPROCKET_EMAIL.startsWith('FILL_IN_') &&
  !process.env.SHIPROCKET_PASSWORD.startsWith('FILL_IN_');

async function getAuthToken() {
  // Return cached token if not expired (Shiprocket tokens last ~10 days)
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Shiprocket login failed (${res.status}): ${JSON.stringify(data)}`);
  }
  if (!data.token) throw new Error(`Shiprocket login failed: no token in response`);

  cachedToken = data.token;
  tokenExpiry = Date.now() + (10 * 24 * 60 * 60 * 1000); // 10 days
  return cachedToken;
}

async function api(path, { method = 'GET', body } = {}) {
  const token = await getAuthToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data.message || JSON.stringify(data);
    throw new Error(`Shiprocket ${method} ${path} failed (${res.status}): ${msg}`);
  }
  return data;
}

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  const firstName = parts.shift() || '';
  return { firstName, lastName: parts.join(' ') };
}

function normalizePhone(phone) {
  // Shiprocket wants a 10-digit mobile number
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  return digits;
}

/**
 * Create a Shiprocket shipment for an order.
 * @param {Object} order - shaped order (shapeAdminOrder output or raw row)
 * @returns {Promise<{shipmentId, awbCode, courierId, courierName}>}
 */
async function createShipment(order) {
  if (!isConfigured()) throw new Error('Shiprocket not configured (set SHIPROCKET_EMAIL/PASSWORD)');

  const phone = normalizePhone(order.customer.phone);
  if (phone.length !== 10) {
    throw new Error(`Invalid customer phone for Shiprocket: ${order.customer.phone}`);
  }

  const { firstName, lastName } = splitName(order.customer.name);
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';
  const paymentMethod = order.payment?.method === 'cod' ? 'COD' : 'Prepaid';

  const orderItems = order.items.map((item) => ({
    name: item.name,
    sku: item.productId || `SKU-${item.name.slice(0, 10)}`,
    units: item.quantity,
    selling_price: Number(item.price),
    discount: '',
    tax: '',
    hsn: '4420', // Books / craft items (resin art)
  }));

  const dateStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const payload = {
    order_id: order.orderNumber,
    order_date: dateStr,
    pickup_location: pickupLocation,
    channel_id: '',
    comment: order.notes || '',
    reseller_name: '',
    company_name: 'Mooncraft',
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address: order.customer.address.line1,
    billing_address_2: '',
    billing_city: order.customer.address.city,
    billing_pincode: order.customer.address.zip,
    billing_state: order.customer.address.state,
    billing_country: 'India',
    billing_email: order.customer.email || '',
    billing_phone: phone,
    shipping_is_billing: true,
    shipping_customer_name: '',
    shipping_last_name: '',
    shipping_address: '',
    shipping_address_2: '',
    shipping_city: '',
    shipping_pincode: '',
    shipping_country: '',
    shipping_state: '',
    shipping_email: '',
    shipping_phone: '',
    order_items: orderItems,
    payment_method: paymentMethod,
    shipping_charges: Number(order.shipping || 0),
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: 0,
    sub_total: Number(order.subtotal || order.total || 0),
    length: 30,
    breadth: 20,
    height: 15,
    weight: 500, // grams (resin art piece default)
  };

  const created = await api('/orders/create/adhoc', { method: 'POST', body: payload });

  let awbCode = created.awb_code || null;
  let courierId = created.courier_company_id ? String(created.courier_company_id) : null;
  let courierName = created.courier_name || null;

  // If Shiprocket didn't auto-generate an AWB, fetch recommended courier & generate one
  if (!awbCode && created.shipment_id) {
    try {
      const storePincode = process.env.SHIPROCKET_STORE_PINCODE || '';
      const recommended = await api(
        `/courier/recommend?from_pincode=${storePincode}&to_pincode=${order.customer.address.zip}&weight=500&cod=0`
      );
      const couriers = recommended?.recommended_courier_list || [];
      if (couriers.length > 0) {
        courierId = String(couriers[0].courier_company_id);
        courierName = couriers[0].courier_name || couriers[0].courier_name_internal || null;
      }
    } catch (e) {
      console.warn('Shiprocket: courier recommend failed, continuing without AWB:', e.message);
    }
  }

  if (created.shipment_id && courierId && !awbCode) {
    try {
      const awb = await api('/courier/generate/awb', {
        method: 'POST',
        body: { shipment_id: created.shipment_id, courier_id: courierId },
      });
      awbCode = awb.awb_code || awb.awb_assignment?.awb_code || awb.awb_data?.awb_code || null;
      courierName = courierName || awb.courier_name || awb.awb_assignment?.courier_name || null;
    } catch (e) {
      console.warn('Shiprocket: AWB generation failed:', e.message);
    }
  }

  return {
    shipmentId: created.shipment_id || null,
    awbCode,
    courierId,
    courierName,
    raw: created,
  };
}

/**
 * Schedule pickup for a shipment.
 * @param {number|string} shipmentId
 * @param {string} [pickupDate='YYYY-MM-DD HH:MM'] defaults to next business day
 * @returns {Promise<Object>}
 */
async function schedulePickup(shipmentId) {
  if (!shipmentId) throw new Error('shipmentId required');

  // Next business day at 10:00
  const pickupDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pickupDate.getFullYear()}-${pad(pickupDate.getMonth() + 1)}-${pad(pickupDate.getDate())} 10:00`;

  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';
  return api('/courier/generate/pickup', {
    method: 'POST',
    body: {
      shipment_id: shipmentId,
      pickup_location: pickupLocation,
      pickup_date: dateStr,
      pickup_time: '10:00',
      fixed_address: '',
    },
  });
}

/**
 * Track a shipment.
 * @param {number|string} shipmentId Shiprocket shipment id
 * @returns {Promise<Object>} tracking data
 */
async function trackShipment(shipmentId) {
  if (!shipmentId) throw new Error('shipmentId required');
  return api(`/courier/track?shipment_id=${shipmentId}`);
}

/**
 * Check pincode serviceability & available couriers for a delivery pincode.
 * @param {string} deliveryPincode
 * @param {Object} [opts]
 * @param {number} [opts.weightKg] weight in kg (default 0.5)
 * @param {boolean} [opts.isCOD] COD or prepaid (default false)
 * @returns {Promise<Object>} serviceability response
 */
async function checkPincodeServiceability(deliveryPincode, { weightKg = 0.5, isCOD = false } = {}) {
  const pickupPostcode = process.env.SHIPROCKET_STORE_PINCODE || '';
  const token = await getAuthToken();
  const qs = new URLSearchParams({
    pickup_postcode: pickupPostcode,
    delivery_postcode: deliveryPincode,
    weight: String(weightKg),
    cod: isCOD ? '1' : '0',
  }).toString();

  const res = await fetch(`${API_BASE}/courier/serviceability/?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Shiprocket serviceability failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

module.exports = {
  isConfigured,
  getAuthToken,
  createShipment,
  schedulePickup,
  trackShipment,
  checkPincodeServiceability,
  normalizePhone,
};