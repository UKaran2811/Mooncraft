/**
 * Global type declarations for the Cloudflare Worker bindings.
 * Exported via `declare global` so all worker modules can reference `Env`.
 */

declare global {
  interface Env {
    // ── Supabase ──
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;

    // ── JWT ──
    JWT_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_ADMIN_SECRET?: string;

    // ── Frontend ──
    FRONTEND_URL?: string;
    APP_URL?: string;

    // ── Resend email ──
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    ADMIN_EMAIL_RECIPIENT?: string;

    // ── OTP / SMS ──
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_FROM?: string;
    TWILIO_WHATSAPP_FROM?: string;
    FAST2SMS_API_KEY?: string;
    FAST2SMS_SENDER_ID?: string;
    MSG91_AUTH_KEY?: string;
    MSG91_SENDER_ID?: string;
    MSG91_ROUTE?: string;

    // ── WhatsApp (CallMeBot) ──
    CALLMEBOT_PHONE?: string;
    CALLMEBOT_API_KEY?: string;

    // ── Shiprocket ──
    SHIPROCKET_EMAIL?: string;
    SHIPROCKET_PASSWORD?: string;
    SHIPROCKET_PICKUP_LOCATION?: string;
    SHIPROCKET_STORE_PINCODE?: string;
    SHIPROCKET_WEBHOOK_SECRET?: string;

    // ── Razorpay ──
    RAZORPAY_KEY_ID?: string;
    RAZORPAY_KEY_SECRET?: string;
    RAZORPAY_WEBHOOK_SECRET?: string;

    // ── Misc ──
    GEMINI_API_KEY?: string;
    NODE_ENV?: string;

    // ── R2 binding ──
    UPLOADS?: R2Bucket;
    R2_PUBLIC_URL?: string;

    // ── Static assets (Vite plugin) ──
    ASSETS?: Fetcher;

    // ── Simulation/dev ──
    DEV_SIMULATE_PAYMENT?: string;
  }
}

export {};
