/**
 * WhatsApp notification service — Workers-compatible.
 * Replaces Node `https` module with `fetch`.
 */

interface WhatsAppEnv {
  CALLMEBOT_PHONE?: string;
  CALLMEBOT_API_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_WHATSAPP_FROM?: string;
  FRONTEND_URL?: string;
}

function isConfigured(val: string | undefined): boolean {
  return !!(val && !val.startsWith('FILL_IN_'));
}

function isTwilioWhatsAppConfigured(env: WhatsAppEnv): boolean {
  return isConfigured(env.TWILIO_ACCOUNT_SID) && isConfigured(env.TWILIO_AUTH_TOKEN) && isConfigured(env.TWILIO_WHATSAPP_FROM);
}

async function sendViaCallMeBot(phone: string, message: string, apiKey: string): Promise<boolean> {
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
    const res = await fetch(url);
    return res.ok;
  } catch (e: any) {
    console.error('CallMeBot failed:', e.message);
    return false;
  }
}

async function sendViaTwilioWhatsApp(env: WhatsAppEnv, phone: string, message: string): Promise<boolean> {
  if (!isTwilioWhatsAppConfigured(env)) return false;
  try {
    const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
          To: `whatsapp:${phone}`,
          Body: message,
        }).toString(),
      }
    );
    return res.ok;
  } catch (e: any) {
    console.error('Twilio WhatsApp failed:', e.message);
    return false;
  }
}

export async function sendAdminWhatsAppAlert(env: WhatsAppEnv, order: any): Promise<boolean> {
  if (!isConfigured(env.CALLMEBOT_PHONE) || !isConfigured(env.CALLMEBOT_API_KEY)) return false;

  const itemsList = order.items.map((i: any) => `• ${i.name} ×${i.quantity}`).join('\n');
  const message =
    `🛍️ *New Mooncraft Order!*\n\n` +
    `📋 *Order:* ${order.orderNumber}\n` +
    `👤 *Customer:* ${order.customer.name}\n` +
    `📱 *Phone:* ${order.customer.phone}\n` +
    `💰 *Total:* ₹${order.total.toLocaleString('en-IN')}\n\n` +
    `📦 *Items:*\n${itemsList}\n\n` +
    `📍 *Ship to:* ${order.customer.address.city}, ${order.customer.address.state}\n\n` +
    `🔗 Admin: ${env.FRONTEND_URL || 'http://localhost:3000'}/#/admin/login`;

  return sendViaCallMeBot(env.CALLMEBOT_PHONE!, message, env.CALLMEBOT_API_KEY!);
}

export async function sendCustomerOrderConfirmation(env: WhatsAppEnv, order: any): Promise<boolean> {
  if (!isTwilioWhatsAppConfigured(env)) return false;
  const itemsList = order.items
    .map((i: any) => `• ${i.name} ×${i.quantity} — ₹${(i.price * i.quantity).toLocaleString('en-IN')}`)
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

  return sendViaTwilioWhatsApp(env, order.customer.phone, message);
}

export async function sendCustomerStatusUpdate(env: WhatsAppEnv, order: any, newStatus: string): Promise<boolean> {
  if (!isTwilioWhatsAppConfigured(env)) return false;
  const statusMessages: Record<string, string> = {
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
  return sendViaTwilioWhatsApp(env, order.customer.phone, message);
}