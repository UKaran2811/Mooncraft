/**
 * Email service — Resend HTTP API (Workers-compatible).
 * No npm package; uses raw fetch.
 */
import { getFromAddress, type EmailEnv } from './emailConfig';

export async function sendOrderConfirmationEmail(env: EmailEnv, order: any): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn('Resend not configured — skipping order confirmation email');
    return false;
  }

  const itemsHtml = order.items
    .map(
      (item: any) => `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #333;">
          ${item.name}${item.selectedOption ? ` (${item.selectedOption})` : ''}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; text-align: center; font-size: 13px; color: #555;">
          ×${item.quantity}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #f0f0f0; text-align: right; font-size: 13px; font-weight: 600; color: #111;">
          ₹${(item.price * item.quantity).toLocaleString('en-IN')}
        </td>
      </tr>`
    )
    .join('');

  const html = orderConfirmationHtml(order, itemsHtml, getFromAddress(env));
  return sendEmail(env, {
    from: `"Mooncraft Studio" <${getFromAddress(env)}>`,
    to: order.customer.email,
    subject: `✓ Order Confirmed — ${order.orderNumber} | Mooncraft`,
    html,
  });
}

export async function sendAdminOrderAlert(env: EmailEnv, order: any): Promise<boolean> {
  const adminRecipient = env.ADMIN_EMAIL_RECIPIENT;
  if (!env.RESEND_API_KEY || !adminRecipient) return false;

  const itemsList = order.items
    .map((i: any) => `• ${i.name} ×${i.quantity} — ₹${(i.price * i.quantity).toLocaleString('en-IN')}`)
    .join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `"Mooncraft Orders" <${getFromAddress(env)}>`,
        to: adminRecipient,
        subject: `🛍️ New Order ${order.orderNumber} — ₹${order.total.toLocaleString('en-IN')}`,
        text: `New order!\n\nOrder: ${order.orderNumber}\nCustomer: ${order.customer.name} (${order.customer.email})\nPhone: ${order.customer.phone}\nTotal: ₹${order.total.toLocaleString('en-IN')}\n\nItems:\n${itemsList}\n\nShip to:\n${order.customer.address.line1}, ${order.customer.address.city}, ${order.customer.address.state} ${order.customer.address.zip}`,
      }),
    });
    return res.ok;
  } catch (err: any) {
    console.error('Admin email failed:', err.message);
    return false;
  }
}

export async function sendPasswordResetEmail(env: EmailEnv, email: string, resetLink: string, name = ''): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const html = passwordResetHtml(resetLink, name, getFromAddress(env));
  return sendEmail(env, {
    from: `"Mooncraft Studio" <${getFromAddress(env)}>`,
    to: email,
    subject: 'Reset your Mooncraft password',
    html,
  });
}

export async function sendOtpEmail(env: EmailEnv, email: string, code: string, phone = ''): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const html = otpHtml(code, phone, getFromAddress(env));
  return sendEmail(env, {
    from: `"Mooncraft Studio" <${getFromAddress(env)}>`,
    to: email,
    subject: `${code} — Your Mooncraft Login Code`,
    html,
  });
}

// ── Helpers ──────────────────────────────────────────────

async function sendEmail(env: EmailEnv, payload: { from: string; to: string; subject: string; html?: string; text?: string }): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('Resend error:', res.status, body);
      return false;
    }
    console.log(`📧 Email sent to ${payload.to}`);
    return true;
  } catch (err: any) {
    console.error('Email send failed:', err.message);
    return false;
  }
}

function orderConfirmationHtml(order: any, itemsHtml: string, fromAddr: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Order Confirmed</title></head><body style="margin:0;padding:0;background:#f8f7f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.06);">
    <div style="background:#111;padding:40px 40px 32px;text-align:center;">
      <div style="letter-spacing:0.3em;font-size:11px;color:#888;text-transform:uppercase;margin-bottom:8px;">Handcrafted Resin Art</div>
      <h1 style="color:#fff;font-size:24px;font-weight:300;letter-spacing:0.15em;text-transform:uppercase;margin:0;">MOONCRAFT</h1>
    </div>
    <div style="background:#f9f6f2;padding:28px 40px;text-align:center;border-bottom:1px solid #eeebe6;">
      <div style="font-size:32px;margin-bottom:12px;">✓</div>
      <h2 style="margin:0 0 6px;font-size:16px;font-weight:600;color:#111;letter-spacing:0.05em;text-transform:uppercase;">Order Confirmed</h2>
      <p style="margin:0;color:#777;font-size:13px;">Thank you, <strong style="color:#111;">${order.customer.name}</strong>. Your bespoke order is in the studio queue.</p>
    </div>
    <div style="padding:24px 40px;text-align:center;border-bottom:1px solid #f0f0f0;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#999;margin-bottom:6px;">Order Reference</div>
      <div style="font-family:monospace;font-size:20px;font-weight:700;color:#111;letter-spacing:0.1em;">${order.orderNumber}</div>
    </div>
    <div style="padding:32px 40px;">
      <h3 style="margin:0 0 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#999;">Your Items</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr><td colspan="2" style="padding:12px 8px;font-size:13px;color:#555;">Subtotal</td><td style="padding:12px 8px;text-align:right;font-size:13px;color:#333;">₹${order.subtotal.toLocaleString('en-IN')}</td></tr>
          <tr><td colspan="2" style="padding:6px 8px;font-size:13px;color:#555;">Shipping</td><td style="padding:6px 8px;text-align:right;font-size:13px;color:#333;">${order.shipping === 0 ? '<span style="color:#16a34a;font-weight:600;">FREE</span>' : `₹${order.shipping}`}</td></tr>
          <tr style="border-top:2px solid #111;"><td colspan="2" style="padding:16px 8px;font-size:15px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:0.05em;">Total</td><td style="padding:16px 8px;text-align:right;font-size:15px;font-weight:700;color:#111;">₹${order.total.toLocaleString('en-IN')}</td></tr>
        </tfoot>
      </table>
    </div>
    <div style="margin:0 40px 32px;background:#f8f7f5;border-radius:4px;padding:20px 24px;">
      <h3 style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#999;">Delivery Details</h3>
      <div style="font-size:13px;color:#444;line-height:1.7;">
        <strong>${order.customer.name}</strong><br/>${order.customer.address.line1}<br/>${order.customer.address.city}, ${order.customer.address.state} — ${order.customer.address.zip}<br/>📱 ${order.customer.phone}
      </div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid #eee;font-size:12px;color:#888;">
        <strong style="color:#111;">⏱ Est. Studio Finishing:</strong> ${order.estimatedDelivery || '14 - 21 Days'}<br/><strong style="color:#111;">🚚 Dispatch:</strong> Insured Cargo
      </div>
    </div>
    <div style="padding:0 40px 32px;text-align:center;">
      <p style="font-size:12px;color:#888;margin:0 0 16px;">Questions? Reach us at:</p>
      <a href="mailto:${fromAddr}" style="color:#111;font-size:12px;font-weight:600;">${fromAddr}</a>
    </div>
    <div style="background:#111;padding:24px 40px;text-align:center;">
      <p style="color:#555;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;margin:0;">Mooncraft · Bespoke Resin Art Studio · India</p>
    </div>
  </div>
</body></html>`;
}

function passwordResetHtml(link: string, name: string, fromAddr: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8f7f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.06);">
    <div style="background:#111;padding:40px 40px 32px;text-align:center;">
      <div style="letter-spacing:0.3em;font-size:11px;color:#888;text-transform:uppercase;margin-bottom:8px;">Handcrafted Resin Art</div>
      <h1 style="color:#fff;font-size:24px;font-weight:300;letter-spacing:0.15em;text-transform:uppercase;margin:0;">MOONCRAFT</h1>
    </div>
    <div style="padding:40px;text-align:center;">
      <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#111;letter-spacing:0.05em;">Reset Your Password</h2>
      <p style="color:#666;font-size:13px;line-height:1.6;margin:0 0 32px;">${name ? `Hi ${name}, we` : 'We'} received a request to reset your Mooncraft password. Click below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 36px;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;border-radius:2px;">Reset Password</a>
      <p style="color:#999;font-size:11px;margin:28px 0 0;line-height:1.5;">If you didn't request this, ignore this email.</p>
    </div>
    <div style="background:#111;padding:24px 40px;text-align:center;">
      <p style="color:#555;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;margin:0;">Mooncraft · Bespoke Resin Art Studio · India</p>
    </div>
  </div>
</body></html>`;
}

function otpHtml(code: string, phone: string, fromAddr: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8f7f5;font-family:Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.06);">
    <div style="background:#111;padding:32px 40px 24px;text-align:center;">
      <div style="letter-spacing:0.3em;font-size:11px;color:#888;text-transform:uppercase;margin-bottom:8px;">Handcrafted Resin Art</div>
      <h1 style="color:#fff;font-size:22px;font-weight:300;letter-spacing:0.15em;text-transform:uppercase;margin:0;">MOONCRAFT</h1>
    </div>
    <div style="padding:40px;text-align:center;">
      <h2 style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111;letter-spacing:0.05em;text-transform:uppercase;">Your Login Code</h2>
      <p style="color:#666;font-size:13px;line-height:1.6;margin:0 0 24px;">Use this 6-digit code to sign in to your Mooncraft account${phone ? ` (linked to ${phone})` : ''}. It expires in <strong>5 minutes</strong>.</p>
      <div style="background:#f8f7f5;border:1px solid #eeebe6;border-radius:4px;padding:20px;letter-spacing:0.5em;font-size:28px;font-weight:700;color:#111;font-family:monospace;">${code}</div>
      <p style="color:#999;font-size:11px;margin:24px 0 0;line-height:1.5;">If you didn't request this, ignore this email.</p>
    </div>
    <div style="background:#111;padding:20px 40px;text-align:center;">
      <p style="color:#555;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;margin:0;">Mooncraft · Bespoke Resin Art Studio</p>
    </div>
  </div>
</body></html>`;
}