function camelize(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelizeKeys(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(camelizeKeys);
  if (typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelize(key)] = camelizeKeys(value);
  }
  return result;
}

function shapeOrder(row) {
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
    items: items.map((i) => ({
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

function shapeAdminOrder(row) {
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
    items: items.map((i) => ({
      productId: i.product_id,
      name: i.name,
      price: Number(i.price),
      quantity: i.quantity,
      image: i.image,
      selectedOption: i.selected_option || i.selectedOption,
    })),
    payment: {
      status: row.payment_status,
      method: row.payment_method,
    },
    estimatedDelivery: row.estimated_delivery || '14 - 21 Days',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
  };
}

module.exports = { shapeOrder, shapeAdminOrder, camelizeKeys };
