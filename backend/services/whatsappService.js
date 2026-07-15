const https = require('https');

// ──────────────────────────────────────────────
// ADMIN WHATSAPP ALERTS (via CallMeBot — free)
// ──────────────────────────────────────────────

const sendWhatsAppViaCallMeBot = (phone, message, apiKey) => {
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encoded}&apikey=${apiKey}`;

    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('📱 WhatsApp sent via CallMeBot');
            resolve(true);
          } else {
            console.error('❌ CallMeBot error:', res.statusCode, data);
            resolve(false);
          }
        });
      })
      .on('error', (err) => {
        console.error('❌ CallMeBot request failed:', err.message);
        resolve(false);
      });
  });
};

const sendAdminWhatsAppAlert = async (order) => {
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_API_KEY;

  if (!phone || !apiKey) {
    console.warn('⚠️  WhatsApp admin alert not configured (CALLMEBOT_PHONE / CALLMEBOT_API_KEY)');
    return false;
  }

  const itemsList = order.items
    .map((i) => `• ${i.name} ×${i.quantity}`)
    .join('\n');

  const message =
    `🛍️ *New Mooncraft Order!*\n\n` +
    `📋 *Order:* ${order.orderNumber}\n` +
    `👤 *Customer:* ${order.customer.name}\n` +
    `📱 *Phone:* ${order.customer.phone}\n` +
    `💰 *Total:* ₹${order.total.toLocaleString('en-IN')}\n\n` +
    `📦 *Items:*\n${itemsList}\n\n` +
    `📍 *Ship to:* ${order.customer.address.city}, ${order.customer.address.state}\n\n` +
    `🔗 Admin: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/#/admin/login`;

  return sendWhatsAppViaCallMeBot(phone, message, apiKey);
};

// ──────────────────────────────────────────────
// CUSTOMER WHATSAPP NOTIFICATIONS
// ──────────────────────────────────────────────
// Uses Twilio WhatsApp API (sandbox free, production ~$0.005/msg)
//
// To enable:
//   1. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
//   2. Twilio WhatsApp sender looks like: "whatsapp:+14155238886"
//   3. Customers must opt in by sending "join <your-sandbox>" to the Twilio number
// ──────────────────────────────────────────────

function isTwilioWhatsAppConfigured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
}

async function sendCustomerWhatsApp(phone, message) {
  if (!isTwilioWhatsAppConfigured()) {
    console.log('ℹ️  Twilio WhatsApp not configured — skipping customer WhatsApp');
    return false;
  }

  try {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilio.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${phone}`,
      body: message,
    });
    console.log(`📱 WhatsApp sent to customer ${phone}`);
    return true;
  } catch (err) {
    console.error('❌ Twilio WhatsApp failed:', err.message);
    return false;
  }
}

/**
 * Send order confirmation WhatsApp to customer
 */
const sendCustomerOrderConfirmation = async (order) => {
  const itemsList = order.items
    .map((i) => `• ${i.name} ×${i.quantity} — ₹${(i.price * i.quantity).toLocaleString('en-IN')}`)
    .join('\n');

  const message =
    `✨ *Thank you for your order, ${order.customer.name}!*\n\n` +
    `📋 *Order:* ${order.orderNumber}\n` +
    `📦 *Items:*\n${itemsList}\n\n` +
    `💰 *Total:* ₹${order.total.toLocaleString('en-IN')}\n` +
    `💳 *Payment:* ${order.status === 'confirmed' ? 'Confirmed ✅' : 'Pending'}\n\n` +
    `📍 *Shipping to:* ${order.customer.address.city}, ${order.customer.address.state}\n` +
    `📬 *Est. delivery:* ${order.estimatedDelivery || '14-21 Days'}\n\n` +
    `We'll notify you when your order ships! 🚚\n` +
    `— Mooncraft by Monika`;

  return sendCustomerWhatsApp(order.customer.phone, message);
};

/**
 * Send order status update WhatsApp to customer
 */
const sendCustomerStatusUpdate = async (order, newStatus) => {
  const statusMessages = {
    confirmed: '✅ Your order has been confirmed and is being prepared.',
    processing: '🎨 Your order is now being crafted with love.',
    shipped: `🚚 Your order has been shipped! Track it: ${order.tracking_number || 'N/A'} via ${order.courier_partner || 'courier partner'}.`,
    delivered: '📬 Your order has been delivered! We hope you love it. Share a photo with us on Instagram @moon_craft_by_moniyal!',
    cancelled: '❌ Your order has been cancelled. Please contact us for any questions.',
  };

  const line = statusMessages[newStatus] || `Your order status has been updated to: ${newStatus}`;

  const message =
    `👋 *Hi ${order.customer.name}!*\n\n` +
    `📋 *Order:* ${order.orderNumber}\n\n` +
    `${line}\n\n` +
    `— Mooncraft by Monika`;

  return sendCustomerWhatsApp(order.customer.phone, message);
};

module.exports = {
  sendAdminWhatsAppAlert,
  sendCustomerOrderConfirmation,
  sendCustomerStatusUpdate,
};
