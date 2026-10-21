/**
 * Order shaping utilities (camelCase + notification payload).
 * Pure functions — works identically on Node and Workers.
 */

function camelize(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function camelizeKeys<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((v) => camelizeKeys(v)) as unknown as T;
  if (typeof obj !== 'object') return obj;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelize(key)] = camelizeKeys(value);
  }
  return result as unknown as T;
}

export interface ShapedOrder {
  _id: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: { line1: string; city: string; state: string; zip: string };
  };
  items: Array<{ name: string; price: number; quantity: number; selectedOption?: string | null }>;
  subtotal: number;
  shipping: number;
  total: number;
  status: string;
  estimatedDelivery: string;
}

export function shapeOrder(row: any): ShapedOrder {
  const items = row.items || row.order_items || [];
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
    items: items.map((i: any) => ({
      name: i.name,
      price: Number(i.price),
      quantity: i.quantity,
      selectedOption: i.selected_option || i.selectedOption,
    })),
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping),
    total: Number(row.total),
    status: row.status,
    estimatedDelivery: row.estimated_delivery || '14 - 21 Days',
  };
}

export function shapeAdminOrder(row: any) {
  const items = row.items || row.order_items || [];
  const base = camelizeKeys(row);
  return {
    ...base,
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
    items: items.map((i: any) => ({
      productId: i.product_id,
      name: i.name,
      price: Number(i.price),
      quantity: i.quantity,
      image: i.image,
      selectedOption: i.selected_option || i.selectedOption,
    })),
    payment: { status: row.payment_status, method: row.payment_method },
    estimatedDelivery: row.estimated_delivery || '14 - 21 Days',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
  };
}

export function shapeForNotifications(row: any) {
  const items = row.items || row.order_items || [];
  return {
    orderNumber: row.order_number,
    status: row.status,
    estimatedDelivery: row.estimated_delivery || '14 - 21 Days',
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
    items: items.map((i: any) => ({
      name: i.name,
      price: Number(i.price),
      quantity: i.quantity,
      selectedOption: i.selected_option || i.selectedOption,
    })),
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping),
    total: Number(row.total),
    tracking_number: row.tracking_number || null,
    courier_partner: row.courier_partner || null,
  };
}