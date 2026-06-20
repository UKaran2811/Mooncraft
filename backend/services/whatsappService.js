const https = require('https');

/**
 * Send WhatsApp message via CallMeBot (100% free, no signup)
 *
 * SETUP (one-time, takes 2 minutes):
 * 1. Add +34 644 59 77 79 to your WhatsApp contacts as "CallMeBot"
 * 2. Send this message to it: "I allow callmebot to send me messages"
 * 3. You'll receive your API key via WhatsApp
 * 4. Add to .env:  CALLMEBOT_PHONE=+91XXXXXXXXXX  CALLMEBOT_API_KEY=XXXXXX
 *
 * Limitation: Only sends to the number that activated the API key.
 * Use this for admin notifications. For customer WA, see Twilio note below.
 */
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
            console.log('📱 WhatsApp notification sent via CallMeBot');
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

/**
 * Send admin WhatsApp alert when new order is placed
 */
const sendAdminWhatsAppAlert = async (order) => {
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_API_KEY;

  if (!phone || !apiKey) {
    console.warn('⚠️  WhatsApp not configured (CALLMEBOT_PHONE / CALLMEBOT_API_KEY missing)');
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
    `🔗 Login to admin panel to update order status.`;

  return sendWhatsAppViaCallMeBot(phone, message, apiKey);
};

/**
 * Send customer WhatsApp (using CallMeBot — customer must have activated it)
 * NOTE: For production customer WA at scale, use Meta Business API or Twilio.
 * The below is a placeholder for when/if the customer has their own CallMeBot key.
 */
const sendCustomerWhatsApp = async (order) => {
  // This is intentionally a no-op for now — CallMeBot requires each user
  // to activate individually. Admin notifications above are fully functional.
  // For customer notifications, the email is the primary channel (configured above).
  console.log(`ℹ️  Customer WhatsApp skipped — using email as primary channel for ${order.customer.email}`);
  return false;
};

module.exports = { sendAdminWhatsAppAlert, sendCustomerWhatsApp };
