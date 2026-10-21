/**
 * Shiprocket API service — Workers-compatible (pure fetch).
 * Auth token cached in isolate memory.
 */

const API_BASE = 'https://apiv2.shiprocket.in/v1/external';

interface ShiprocketEnv {
  SHIPROCKET_EMAIL?: string;
  SHIPROCKET_PASSWORD?: string;
  SHIPROCKET_PICKUP_LOCATION?: string;
  SHIPROCKET_STORE_PINCODE?: string;
}

let cachedToken: string | null = null;
let tokenExpiry = 0;

export function isConfigured(env: ShiprocketEnv): boolean {
  return !!(
    env.SHIPROCKET_EMAIL &&
    env.SHIPROCKET_PASSWORD &&
    !env.SHIPROCKET_EMAIL.startsWith('FILL_IN_') &&
    !env.SHIPROCKET_PASSWORD.startsWith('FILL_IN_')
  );
}

async function getAuthToken(env: ShiprocketEnv): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
  });
  const data: any = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`Shiprocket login failed (${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
  }
  cachedToken = data.token;
  tokenExpiry = Date.now() + 10 * 24 * 60 * 60 * 1000; // 10 days
  return cachedToken;
}

async function api(env: ShiprocketEnv, path: string, { method = 'GET', body }: { method?: string; body?: any } = {}) {
  const token = await getAuthToken(env);
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(`Shiprocket ${method} ${path} failed (${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

function splitName(fullName: string) {
  const parts = (fullName || '').trim().split(/\s+/);
  const firstName = parts.shift() || '';
  return { firstName, lastName: parts.join(' ') };
}

function normalizePhone(phone: string): string {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  return digits;
}

export async function createShipment(env: ShiprocketEnv, order: any) {
  if (!isConfigured(env)) throw new Error('Shiprocket not configured');

  const phone = normalizePhone(order.customer.phone);
  if (phone.length !== 10) throw new Error(`Invalid customer phone: ${order.customer.phone}`);

  const { firstName, lastName } = splitName(order.customer.name);
  const pickupLocation = env.SHIPROCKET_PICKUP_LOCATION || 'Home';
  const paymentMethod = order.payment?.method === 'cod' ? 'COD' : 'Prepaid';

  const orderItems = order.items.map((item: any) => ({
    name: item.name,
    sku: item.productId || `SKU-${item.name.slice(0, 10)}`,
    units: item.quantity,
    selling_price: Number(item.price),
    discount: '',
    tax: '',
    hsn: '4420',
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
    weight: 500,
  };

  const created = await api(env, '/orders/create/adhoc', { method: 'POST', body: payload });

  let awbCode = created.awb_code || null;
  let courierId = created.courier_company_id ? String(created.courier_company_id) : null;
  let courierName = created.courier_name || null;

  if (!awbCode && created.shipment_id) {
    try {
      const storePincode = env.SHIPROCKET_STORE_PINCODE || '';
      const recommended = await api(
        env,
        `/courier/recommend?from_pincode=${storePincode}&to_pincode=${order.customer.address.zip}&weight=500&cod=0`
      );
      const couriers = recommended?.recommended_courier_list || [];
      if (couriers.length > 0) {
        courierId = String(couriers[0].courier_company_id);
        courierName = couriers[0].courier_name || couriers[0].courier_name_internal || null;
      }
    } catch (e: any) {
      console.warn('Shiprocket: courier recommend failed:', e.message);
    }
  }

  if (created.shipment_id && courierId && !awbCode) {
    try {
      const awb = await api(env, '/courier/generate/awb', {
        method: 'POST',
        body: { shipment_id: created.shipment_id, courier_id: courierId },
      });
      awbCode = awb.awb_code || awb.awb_assignment?.awb_code || awb.awb_data?.awb_code || null;
      courierName = courierName || awb.courier_name || awb.awb_assignment?.courier_name || null;
    } catch (e: any) {
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

export async function schedulePickup(env: ShiprocketEnv, shipmentId: number | string) {
  if (!shipmentId) throw new Error('shipmentId required');
  const pickupDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${pickupDate.getFullYear()}-${pad(pickupDate.getMonth() + 1)}-${pad(pickupDate.getDate())} 10:00`;
  const pickupLocation = env.SHIPROCKET_PICKUP_LOCATION || 'Home';
  return api(env, '/courier/generate/pickup', {
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

export async function trackShipment(env: ShiprocketEnv, shipmentId: number | string) {
  if (!shipmentId) throw new Error('shipmentId required');
  return api(env, `/courier/track?shipment_id=${shipmentId}`);
}

export async function checkPincodeServiceability(env: ShiprocketEnv, deliveryPincode: string, weightKg = 0.5, isCOD = false) {
  const pickupPostcode = env.SHIPROCKET_STORE_PINCODE || '';
  const token = await getAuthToken(env);
  const qs = new URLSearchParams({
    pickup_postcode: pickupPostcode,
    delivery_postcode: deliveryPincode,
    weight: String(weightKg),
    cod: isCOD ? '1' : '0',
  }).toString();

  const res = await fetch(`${API_BASE}/courier/serviceability/?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(`Serviceability failed (${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}