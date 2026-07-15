const nodemailer = require('nodemailer');

// Create transporter using Gmail SMTP (free, no API key needed)
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password (not your regular password)
    },
  });
};

/**
 * Send order confirmation email to customer
 */
const sendOrderConfirmationEmail = async (order) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('⚠️  Email not configured. Skipping confirmation email.');
    return false;
  }

  const transporter = createTransporter();

  const itemsHtml = order.items
    .map(
      (item) => `
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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Order Confirmed — Mooncraft</title>
</head>
<body style="margin:0;padding:0;background:#f8f7f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.06);">
    
    <!-- Header -->
    <div style="background:#111111;padding:40px 40px 32px;text-align:center;">
      <div style="letter-spacing:0.3em;font-size:11px;color:#888;text-transform:uppercase;margin-bottom:8px;">Handcrafted Resin Art</div>
      <h1 style="color:#ffffff;font-size:24px;font-weight:300;letter-spacing:0.15em;text-transform:uppercase;margin:0;">MOONCRAFT</h1>
    </div>

    <!-- Success Banner -->
    <div style="background:#f9f6f2;padding:28px 40px;text-align:center;border-bottom:1px solid #eeebe6;">
      <div style="font-size:32px;margin-bottom:12px;">✓</div>
      <h2 style="margin:0 0 6px;font-size:16px;font-weight:600;color:#111;letter-spacing:0.05em;text-transform:uppercase;">Order Confirmed</h2>
      <p style="margin:0;color:#777;font-size:13px;">Thank you, <strong style="color:#111;">${order.customer.name}</strong>. Your bespoke order is in the studio queue.</p>
    </div>

    <!-- Order Number -->
    <div style="padding:24px 40px;background:#fff;text-align:center;border-bottom:1px solid #f0f0f0;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#999;margin-bottom:6px;">Order Reference</div>
      <div style="font-family:monospace;font-size:20px;font-weight:700;color:#111;letter-spacing:0.1em;">${order.orderNumber}</div>
    </div>

    <!-- Items -->
    <div style="padding:32px 40px;">
      <h3 style="margin:0 0 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#999;">Your Items</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:12px 8px;font-size:13px;color:#555;">Subtotal</td>
            <td style="padding:12px 8px;text-align:right;font-size:13px;color:#333;">₹${order.subtotal.toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding:6px 8px;font-size:13px;color:#555;">Shipping</td>
            <td style="padding:6px 8px;text-align:right;font-size:13px;color:#333;">${order.shipping === 0 ? '<span style="color:#16a34a;font-weight:600;">FREE</span>' : `₹${order.shipping}`}</td>
          </tr>
          <tr style="border-top:2px solid #111;">
            <td colspan="2" style="padding:16px 8px;font-size:15px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:0.05em;">Total</td>
            <td style="padding:16px 8px;text-align:right;font-size:15px;font-weight:700;color:#111;">₹${order.total.toLocaleString('en-IN')}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Delivery Info -->
    <div style="margin:0 40px 32px;background:#f8f7f5;border-radius:4px;padding:20px 24px;">
      <h3 style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#999;">Delivery Details</h3>
      <div style="font-size:13px;color:#444;line-height:1.7;">
        <strong>${order.customer.name}</strong><br/>
        ${order.customer.address.line1}<br/>
        ${order.customer.address.city}, ${order.customer.address.state} — ${order.customer.address.zip}<br/>
        📱 ${order.customer.phone}
      </div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid #eee;font-size:12px;color:#888;">
        <strong style="color:#111;">⏱ Est. Studio Finishing:</strong> ${order.estimatedDelivery || '14 - 21 Days'}<br/>
        <strong style="color:#111;">🚚 Dispatch:</strong> Insured Cargo
      </div>
    </div>

    <!-- CTA -->
    <div style="padding:0 40px 32px;text-align:center;">
      <p style="font-size:12px;color:#888;margin:0 0 16px;">Questions about your order? Reply to this email or reach us at:</p>
      <a href="mailto:${process.env.GMAIL_USER}" style="color:#111;font-size:12px;font-weight:600;">${process.env.GMAIL_USER}</a>
    </div>

    <!-- Footer -->
    <div style="background:#111;padding:24px 40px;text-align:center;">
      <p style="color:#555;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;margin:0;">
        Mooncraft · Bespoke Resin Art Studio · India
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"Mooncraft Studio" <${process.env.GMAIL_USER}>`,
      to: order.customer.email,
      subject: `✓ Order Confirmed — ${order.orderNumber} | Mooncraft`,
      html,
    });
    console.log(`📧 Confirmation email sent to ${order.customer.email}`);
    return true;
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
    return false;
  }
};

/**
 * Send admin notification email when new order is placed
 */
const sendAdminOrderAlert = async (order) => {
  const adminRecipient = process.env.ADMIN_EMAIL_RECIPIENT || process.env.ADMIN_EMAIL;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !adminRecipient) {
    return false;
  }
  const transporter = createTransporter();
  const itemsList = order.items.map((i) => `• ${i.name} ×${i.quantity} — ₹${(i.price * i.quantity).toLocaleString('en-IN')}`).join('\n');

  try {
    await transporter.sendMail({
      from: `"Mooncraft Orders" <${process.env.GMAIL_USER}>`,
      to: adminRecipient,
      subject: `🛍️ New Order ${order.orderNumber} — ₹${order.total.toLocaleString('en-IN')}`,
      text: `New order received!\n\nOrder: ${order.orderNumber}\nCustomer: ${order.customer.name} (${order.customer.email})\nPhone: ${order.customer.phone}\nTotal: ₹${order.total.toLocaleString('en-IN')}\n\nItems:\n${itemsList}\n\nShip to:\n${order.customer.address.line1}, ${order.customer.address.city}, ${order.customer.address.state} ${order.customer.address.zip}`,
    });
    return true;
  } catch (err) {
    console.error('❌ Admin email failed:', err.message);
    return false;
  }
};

/**
 * Send password reset email to customer
 */
const sendPasswordResetEmail = async (email, resetLink, name = '') => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('⚠️  Email not configured. Skipping password reset email.');
    return false;
  }

  const transporter = createTransporter();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Your Password — Mooncraft</title>
</head>
<body style="margin:0;padding:0;background:#f8f7f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.06);">
    <div style="background:#111111;padding:40px 40px 32px;text-align:center;">
      <div style="letter-spacing:0.3em;font-size:11px;color:#888;text-transform:uppercase;margin-bottom:8px;">Handcrafted Resin Art</div>
      <h1 style="color:#ffffff;font-size:24px;font-weight:300;letter-spacing:0.15em;text-transform:uppercase;margin:0;">MOONCRAFT</h1>
    </div>
    <div style="padding:40px;text-align:center;">
      <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#111;letter-spacing:0.05em;">Reset Your Password</h2>
      <p style="color:#666;font-size:13px;line-height:1.6;margin:0 0 32px;">
        ${name ? `Hi ${name}, we` : 'We'} received a request to reset the password for your Mooncraft account.
        Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
      </p>
      <a href="${resetLink}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 36px;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;border-radius:2px;">
        Reset Password
      </a>
      <p style="color:#999;font-size:11px;margin:28px 0 0;line-height:1.5;">
        If you didn't request this, you can safely ignore this email.<br/>
        Your password will remain unchanged.
      </p>
    </div>
    <div style="background:#111;padding:24px 40px;text-align:center;">
      <p style="color:#555;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;margin:0;">
        Mooncraft · Bespoke Resin Art Studio · India
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"Mooncraft Studio" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Reset your Mooncraft password`,
      html,
    });
    console.log(`📧 Password reset email sent to ${email}`);
    return true;
  } catch (err) {
    console.error('❌ Password reset email failed:', err.message);
    return false;
  }
};

/**
 * Send OTP code to a customer via email (fallback for SMS when phone
 * number is not reachable on SMS gateways, or for users who prefer email).
 */
const sendOtpEmail = async (email, code, phone) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('⚠️  Email not configured. Skipping OTP email.');
    return false;
  }
  const transporter = createTransporter();
  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f8f7f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:4px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.06);">
    <div style="background:#111111;padding:32px 40px 24px;text-align:center;">
      <div style="letter-spacing:0.3em;font-size:11px;color:#888;text-transform:uppercase;margin-bottom:8px;">Handcrafted Resin Art</div>
      <h1 style="color:#ffffff;font-size:22px;font-weight:300;letter-spacing:0.15em;text-transform:uppercase;margin:0;">MOONCRAFT</h1>
    </div>
    <div style="padding:40px;text-align:center;">
      <h2 style="margin:0 0 8px;font-size:16px;font-weight:600;color:#111;letter-spacing:0.05em;text-transform:uppercase;">Your Login Code</h2>
      <p style="color:#666;font-size:13px;line-height:1.6;margin:0 0 24px;">
        Use this 6-digit code to sign in to your Mooncraft account${phone ? ` (linked to ${phone})` : ''}.
        It expires in <strong>5 minutes</strong>.
      </p>
      <div style="background:#f8f7f5;border:1px solid #eeebe6;border-radius:4px;padding:20px;letter-spacing:0.5em;font-size:28px;font-weight:700;color:#111;font-family:monospace;">
        ${code}
      </div>
      <p style="color:#999;font-size:11px;margin:24px 0 0;line-height:1.5;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#111;padding:20px 40px;text-align:center;">
      <p style="color:#555;font-size:10px;text-transform:uppercase;letter-spacing:0.15em;margin:0;">Mooncraft · Bespoke Resin Art Studio</p>
    </div>
  </div>
</body></html>`;
  try {
    await transporter.sendMail({
      from: `"Mooncraft Studio" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `${code} — Your Mooncraft Login Code`,
      html,
    });
    console.log(`📧 OTP email sent to ${email}`);
    return true;
  } catch (err) {
    console.error('❌ OTP email failed:', err.message);
    return false;
  }
};

module.exports = { sendOrderConfirmationEmail, sendAdminOrderAlert, sendPasswordResetEmail, sendOtpEmail };
