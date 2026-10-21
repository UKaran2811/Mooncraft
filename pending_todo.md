# 🌙 Mooncraft — Master Deployment Tracker & Status

> **Target Domain:** `https://mooncraftbymoniyal.com`  
> **Architecture:** Unified Cloudflare Worker (`Hono` + Static SPA Assets + Cloudflare R2 + Supabase DB)  
> **Last Synced:** October 2026  
> **Status:** Backend Rewrite 100% Done | Ready for Cloudflare Deployment

---

## 🚦 Quick Summary: Where We Stand

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | Razorpay Payment Gateway (Test Mode / KYC) | 🔄 Test keys wired; E2E simulate test ready; Live KYC pending |
| **Phase 2** | Shiprocket Logistics Integration | ⏳ Code complete; Login block lifting pending; KYC pending |
| **Phase 3** | Resend Transactional Email | ✅ Domain & DNS verified; Sender set to `orders@mooncraftbymoniyal.com` |
| **Phase 4** | Backend Rewrite for Cloudflare Workers (Express → Hono) | ✅ **100% COMPLETE** (All 18 worker modules + configs ported) |
| **Phase 5** | Cloudflare Worker & R2 Deployment | ❌ **READY TO EXECUTE** (Automated with `.\deploy.ps1`) |
| **Phase 6** | Custom Domain & DNS Migration (GoDaddy → Cloudflare) | ❌ Pending Cloudflare account setup & nameserver switch |
| **Phase 7** | Production Go-Live Validation | ❌ Runs immediately after Phase 5 & 6 |

---

## ⚡ 5-Step Quick Start Deployment (Run in Order)

Execute these steps in PowerShell from the project root:

```powershell
# Step 1: Authenticate with your Cloudflare account
npx wrangler login

# Step 2: Create the Cloudflare R2 bucket for product/order uploads
npx wrangler r2 bucket create mooncraft-uploads

# Step 3: Push all production secrets from .dev.vars to Cloudflare
.\push-secrets.ps1

# Step 4: Build frontend assets and deploy the unified Worker
.\deploy.ps1

# Step 5: Verify the live deployment health endpoint
# Browse to: https://mooncraft.<your-subdomain>.workers.dev/api/health
```

> [!NOTE]
> Once your domain DNS is live (Phase 6), update the frontend URLs in Cloudflare with:
> ```powershell
> echo "https://mooncraftbymoniyal.com" | npx wrangler secret put FRONTEND_URL
> echo "https://mooncraftbymoniyal.com" | npx wrangler secret put APP_URL
> ```

---

## 📋 Master Task Tracker by Phase

### Phase 1 — Razorpay Payment Gateway

| # | Task | Description | Status |
|---|---|---|---|
| 1.1 | Razorpay Test Keys | Test key ID & secret configured in `.env` and `.dev.vars` (`rzp_test_TRAg9HVmNm6vEH`), `VITE_RAZORPAY_KEY_ID` set | ✅ Done |
| 1.2 | Razorpay Modal Verification | Confirmed modal triggers with Mooncraft Studio branding in checkout | ✅ Done |
| 1.3 | Dev Payment Simulation | `POST /api/orders/:id/simulate-payment` endpoint & UI button created | ✅ Done |
| 1.4 | **E2E Checkout Test** | Cart → Checkout → Click "Pay" → Close modal → Click "🧪 Simulate Payment" → Verify success screen | ❌ **DO NOW** |
| 1.5 | Database & Email Check | Confirm order marked `confirmed` + `paid` in Supabase & confirmation email received from Resend | ❌ After 1.4 |
| 1.6 | Apply for Live Razorpay KYC | Submit business documents and bank account verification in Razorpay Dashboard | ⏳ In Progress / User Action |
| 1.7 | Swap Live Razorpay Keys | Replace test keys in `.dev.vars` and run `.\push-secrets.ps1` once KYC is approved | ❌ After 1.6 |
| 1.8 | Register Razorpay Webhook | Set webhook in Razorpay Dashboard → `https://mooncraftbymoniyal.com/api/webhooks/razorpay` | ❌ Post-Deploy |

---

### Phase 2 — Shiprocket Logistics Integration

| # | Task | Description | Status |
|---|---|---|---|
| 2.1 | Service Layer Implementation | Shiprocket client rewritten in [`worker/services/shiprocket.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/services/shiprocket.ts) with token caching | ✅ Done |
| 2.2 | Supabase Database Schema | Added `shipment_id` and `awb_code` columns to Supabase `orders` table | ✅ Done |
| 2.3 | Shipping API Routes | Ported `/api/shipping/check-pincode` and `/api/shipping/webhook` to Worker routes | ✅ Done |
| 2.4 | Shiprocket Account Unblock | Wait for temporary login lock on `ronakbharodiya123@gmail.com` to expire | ⏳ Blocked (External) |
| 2.5 | Credential Verification | Test login via `POST https://apiv2.shiprocket.in/v1/external/auth/login` | ❌ After block lifts |
| 2.6 | Shiprocket KYC & Pickup Setup | Verify KYC in panel; verify pickup location name matches `SHIPROCKET_PICKUP_LOCATION=Home` | ❌ After login works |
| 2.7 | Live Shipment Creation Test | Admin panel → Order Details → Click "🚀 Create Shipment" → Confirm AWB generation | ❌ After KYC |
| 2.8 | Register Tracking Webhook | Set webhook in Shiprocket dashboard → `https://mooncraftbymoniyal.com/api/shipping/webhook` | ❌ Post-Deploy |

---

### Phase 3 — Resend Transactional Email

| # | Task | Description | Status |
|---|---|---|---|
| 3.1 | Add Domain to Resend | Added `mooncraftbymoniyal.com` to Resend dashboard | ✅ Done |
| 3.2 | DNS Verification Records | Configured SPF, DKIM, and MX records in GoDaddy | ✅ Done |
| 3.3 | Resend Domain Status | Domain verification completed and active (Green checkmark in Resend) | ✅ Done |
| 3.4 | Configure Sender Identity | `RESEND_FROM_EMAIL=orders@mooncraftbymoniyal.com` set in `.env` and `.dev.vars` | ✅ Done |
| 3.5 | Worker Email Service | Rewrote email service with standard `fetch` in [`worker/services/email.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/services/email.ts) | ✅ Done |
| 3.6 | End-to-End Delivery Test | Trigger order confirmation email via simulate test and verify inbox delivery | ❌ After Phase 1.4 |

---

### Phase 4 — Backend Rewrite for Cloudflare Workers (100% COMPLETE)

> All 18 worker files are fully implemented with 1:1 feature parity with the legacy Express backend.

#### Worker Modules Breakdown

| Module | File | Porting Details | Status |
|---|---|---|---|
| **App Entry & Routing** | [`worker/index.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/index.ts) | Hono app, CORS allowlist (`mooncraftbymoniyal.com`), global error handler (`app.onError`), static assets binding (`ASSETS`) | ✅ Done |
| **Auth Routes** | [`worker/routes/auth.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/routes/auth.ts) | 489 lines: Register, customer/admin login, OTP flow, password reset, token refresh | ✅ Done |
| **Product Routes** | [`worker/routes/products.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/routes/products.ts) | 213 lines: Public catalog, category filters, inventory management, admin CRUD | ✅ Done |
| **Order Routes** | [`worker/routes/orders.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/routes/orders.ts) | 539 lines: Create order, Razorpay order creation, payment verify, simulation, user order history | ✅ Done |
| **Admin Routes** | [`worker/routes/admin.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/routes/admin.ts) | 380 lines: Dashboard metrics, revenue tracking, user management, order status transitions | ✅ Done |
| **Shipping Routes** | [`worker/routes/shipping.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/routes/shipping.ts) | 125 lines: Pincode serviceability lookup, tracking webhooks | ✅ Done |
| **Upload Routes** | [`worker/routes/upload.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/routes/upload.ts) | 70 lines: Multipart `FormData` parsing, R2 bucket storage (`mooncraft-uploads`), public URL generation | ✅ Done |
| **Auth Middleware** | [`worker/middleware/auth.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/middleware/auth.ts) | `jose` JWT verification, role-based access control (customer vs admin) | ✅ Done |
| **Database Client** | [`worker/lib/supabase.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/lib/supabase.ts) | Edge-compatible `@supabase/supabase-js` instance using Workers environment bindings | ✅ Done |
| **JWT Utilities** | [`worker/utils/jwt.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/utils/jwt.ts) | `jose` sign & verify replacing Node-specific `jsonwebtoken` | ✅ Done |
| **Password Utilities** | [`worker/utils/password.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/utils/password.ts) | `bcryptjs` compatible with `nodejs_compat` runtime | ✅ Done |
| **Crypto Utilities** | [`worker/utils/crypto.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/utils/crypto.ts) | Web Crypto API (`crypto.subtle`) for HMAC verification & random tokens | ✅ Done |
| **Order Shaper** | [`worker/utils/orderShaper.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/utils/orderShaper.ts) | Database-to-client schema normalization functions | ✅ Done |
| **Email Service** | [`worker/services/email.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/services/email.ts) | Direct `fetch` requests to Resend REST API | ✅ Done |
| **OTP Service** | [`worker/services/otp.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/services/otp.ts) | Fast2SMS & Twilio/MSG91 fallbacks | ✅ Done |
| **Shiprocket Service** | [`worker/services/shiprocket.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/services/shiprocket.ts) | Direct `fetch` requests to Shiprocket REST API with memory caching | ✅ Done |
| **WhatsApp Service** | [`worker/services/whatsapp.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/services/whatsapp.ts) | CallMeBot & Twilio WhatsApp notifications | ✅ Done |
| **Type Definitions** | [`worker/types.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/types.ts) | Complete TypeScript interfaces for Cloudflare bindings & environment vars | ✅ Done |

#### Deployment Configuration Fixes Applied

| Area | File | Change Description | Status |
|---|---|---|---|
| **API Base URL** | [`src/services/api.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/src/services/api.ts) | Changed default from `http://localhost:5000/api` to `/api` (same-origin architecture) | ✅ Done |
| **CORS Policy** | [`worker/index.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/index.ts) | Added `https://mooncraftbymoniyal.com` and `https://www.mooncraftbymoniyal.com` | ✅ Done |
| **Global Error Handling** | [`worker/index.ts`](file:///c:/Users/SHIV/Desktop/Mooncraft/worker/index.ts) | Added `app.onError()` returning standardized JSON error payloads | ✅ Done |
| **Client Environment** | [`.env`](file:///c:/Users/SHIV/Desktop/Mooncraft/.env) | Set `VITE_API_URL=/api` | ✅ Done |
| **Vite Configuration** | [`vite.config.mts`](file:///c:/Users/SHIV/Desktop/Mooncraft/vite.config.mts) | Removed obsolete localhost:5000 proxy; configured `@cloudflare/vite-plugin` | ✅ Done |
| **Worker Secrets Template** | [`.dev.vars`](file:///c:/Users/SHIV/Desktop/Mooncraft/.dev.vars) | Configured `R2_PUBLIC_URL`, `DEV_SIMULATE_PAYMENT`, `GEMINI_API_KEY` | ✅ Done |
| **Git Exclusion** | [`.gitignore`](file:///c:/Users/SHIV/Desktop/Mooncraft/.gitignore) | Ignored `.dev.vars`, `.wrangler/`, and `backend/uploads/` | ✅ Done |
| **Deployment Automation** | [`deploy.ps1`](file:///c:/Users/SHIV/Desktop/Mooncraft/deploy.ps1) | Automated script: Vite production build + Wrangler deployment | ✅ Done |
| **Secrets Automation** | [`push-secrets.ps1`](file:///c:/Users/SHIV/Desktop/Mooncraft/push-secrets.ps1) | Automated script: Reads `.dev.vars` and uploads secrets to Cloudflare | ✅ Done |

#### Build Verification Metrics

```
✅ wrangler deploy --dry-run: PASSED
   - Worker bundle: 939.70 KiB (190.50 KiB gzipped)
   - Bindings: R2 (mooncraft-uploads), ASSETS (./dist), NODE_ENV
✅ npm run build: PASSED
   - Client JS: 919.34 KiB (226.85 KiB gzipped)
   - Client CSS: 69.27 KiB (11.75 KiB gzipped)
```

---

### Phase 5 — Cloudflare Deployment Setup

| # | Task | Command / Action | Status |
|---|---|---|---|
| 5.1 | Cloudflare Account | Create free account at [dash.cloudflare.com](https://dash.cloudflare.com) | ❌ Action Required |
| 5.2 | CLI Authentication | Run `npx wrangler login` in PowerShell | ❌ Action Required |
| 5.3 | Create R2 Storage | Run `npx wrangler r2 bucket create mooncraft-uploads` | ❌ Action Required |
| 5.4 | Push Worker Secrets | Run `.\push-secrets.ps1` to upload credentials | ❌ Action Required |
| 5.5 | Deploy Worker & Assets | Run `.\deploy.ps1` | ❌ Action Required |
| 5.6 | Verify Worker Health | Visit `https://mooncraft.<subdomain>.workers.dev/api/health` → Expect `{"status":"ok"}` | ❌ Action Required |

---

### Phase 6 — Custom Domain & DNS Migration (GoDaddy → Cloudflare)

| # | Step | Instructions | Status |
|---|---|---|---|
| 6.1 | Add Domain to Cloudflare | Cloudflare Dashboard → **Websites** → **Add a Domain** → Enter `mooncraftbymoniyal.com` (Select Free plan) | ❌ Action Required |
| 6.2 | Switch Nameservers | In GoDaddy DNS Management, replace default nameservers with Cloudflare nameservers (e.g. `ns1.cloudflare.com`, `ns2.cloudflare.com`) | ❌ Action Required |
| 6.3 | Wait for DNS Propagation | Propagation takes between 15 minutes to 24 hours | ⏳ Wait |
| 6.4 | Configure Worker Routing | In Cloudflare Dashboard → Workers & Pages → `mooncraft` → **Settings** → **Domains & Routes** → **Add Custom Domain** → `mooncraftbymoniyal.com` | ❌ Action Required |
| 6.5 | Configure R2 Public Domain | In Cloudflare Dashboard → R2 → `mooncraft-uploads` → **Settings** → **Public Access** → Connect custom domain `images.mooncraftbymoniyal.com` | ❌ Action Required |
| 6.6 | SSL / TLS Verification | Ensure SSL/TLS encryption mode is set to **Full** in Cloudflare | 🔄 Auto-Enabled |
| 6.7 | Update Production URL Secrets | Run in terminal:  <br>`echo "https://mooncraftbymoniyal.com" \| npx wrangler secret put FRONTEND_URL`<br>`echo "https://mooncraftbymoniyal.com" \| npx wrangler secret put APP_URL` | ❌ After DNS active |

---

### Phase 7 — Production Go-Live Validation (QA Checklist)

| # | Test Scenario | Expected Outcome | Status |
|---|---|---|---|
| 7.1 | **Storefront Catalog** | Homepage loads, hero banner renders, categories and products show without broken images | ❌ Pending Deploy |
| 7.2 | **Image Serving via R2** | Upload an image in admin → Image renders from `https://images.mooncraftbymoniyal.com/...` | ❌ Pending Deploy |
| 7.3 | **Customer OTP Login** | Enter phone number → Receive OTP via SMS → Verify → Logged in successfully | ❌ Pending Deploy |
| 7.4 | **Cart & Checkout Flow** | Add resin art product to cart → Enter shipping address → Proceed to payment | ❌ Pending Deploy |
| 7.5 | **Razorpay Modal & Payment** | Razorpay modal opens with Mooncraft branding → Test payment succeeds → Order status transitions to `confirmed` | ❌ Pending Deploy |
| 7.6 | **Confirmation Email** | Customer receives formatted HTML order receipt from `orders@mooncraftbymoniyal.com` | ❌ Pending Deploy |
| 7.7 | **Admin Dashboard** | Login at `/admin/login` → Dashboard displays revenue, order counts, product metrics | ❌ Pending Deploy |
| 7.8 | **Shipment & AWB Generation** | Admin clicks "Create Shipment" → Shiprocket creates order & returns tracking AWB code | ❌ After Shiprocket KYC |
| 7.9 | **CORS & Console Health** | Open Developer Tools → Verify zero CORS errors and zero broken asset requests | ❌ Pending Deploy |

---

## 🔐 Environment Variables & Secrets Audit

| Variable Name | Location | Current Status | Production Value / Action Required |
|---|---|---|---|
| `SUPABASE_URL` | `.dev.vars` / Worker Secret | ✅ Configured | Production Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `.dev.vars` / Worker Secret | ✅ Configured | Secret role key for server operations |
| `SUPABASE_ANON_KEY` | `.dev.vars` / Worker Secret | ✅ Configured | Client safe public key |
| `JWT_SECRET` | `.dev.vars` / Worker Secret | ✅ Configured | 64-character cryptographic secret |
| `RESEND_API_KEY` | `.dev.vars` / Worker Secret | ✅ Configured | Live Resend API key |
| `RESEND_FROM_EMAIL` | `.dev.vars` / Worker Secret | ✅ Configured | `orders@mooncraftbymoniyal.com` |
| `RAZORPAY_KEY_ID` | `.dev.vars` & `.env` | ✅ Configured | `rzp_test_TRAg9HVmNm6vEH` (Swap after KYC) |
| `RAZORPAY_KEY_SECRET` | `.dev.vars` / Worker Secret | ✅ Configured | Test secret (Swap after KYC) |
| `FAST2SMS_API_KEY` | `.dev.vars` / Worker Secret | ✅ Configured | Active SMS gateway for OTP |
| `SHIPROCKET_EMAIL` | `.dev.vars` / Worker Secret | ✅ Configured | `ronakbharodiya123@gmail.com` |
| `SHIPROCKET_PASSWORD` | `.dev.vars` / Worker Secret | ✅ Configured | Account password |
| `SHIPROCKET_PICKUP_LOCATION` | `.dev.vars` / Worker Secret | ✅ Configured | Set to `Home` (verify in Shiprocket panel) |
| `R2_PUBLIC_URL` | `.dev.vars` / Worker Secret | ✅ Configured | `https://images.mooncraftbymoniyal.com` |
| `DEV_SIMULATE_PAYMENT` | `.dev.vars` / Worker Secret | ✅ Configured | Set to `false` for live production |
| `FRONTEND_URL` / `APP_URL` | `.dev.vars` / Worker Secret | ❌ Needs Update | Change to `https://mooncraftbymoniyal.com` |
| `VITE_API_URL` | `.env` | ✅ Configured | Set to `/api` (same-origin worker) |
| `TWILIO_ACCOUNT_SID` / `AUTH_TOKEN` | `.dev.vars` | ⚠️ Optional | Optional backup for international SMS |
| `CALLMEBOT_PHONE` / `API_KEY` | `.dev.vars` | ⚠️ Optional | Optional admin WhatsApp alerts |
| `MSG91_AUTH_KEY` | `.dev.vars` | ⚠️ Optional | Optional third-tier OTP gateway |

---

## ⏳ External Blockers & Action Dependencies

```
[BLOCKED] Shiprocket Account Login Lock
 └── Impact: Automated shipping generation & AWB creation
 └── Remedy: Wait for cooldown period on ronakbharodiya123@gmail.com, then test via Postman.

[IN PROGRESS] Razorpay Live KYC
 └── Impact: Accepting real credit cards / UPI from customers
 └── Remedy: Complete business identity and bank account verification in Razorpay Dashboard.
 └── Workaround: Store can deploy and operate in Test Mode immediately.

[ACTION NEEDED] Cloudflare Account & Domain DNS
 └── Impact: Connecting mooncraftbymoniyal.com to the Worker
 └── Remedy: User signs up at dash.cloudflare.com and switches nameservers in GoDaddy.
```

---

## 🛠️ Operational Runbook & Common Commands

### Local Development
```powershell
# Run the unified Worker locally with local bindings & Vite hot reload
npm run dev

# Or run worker preview with Wrangler
npm run worker:dev
```

### Build & Deploy
```powershell
# Full build + deploy script
.\deploy.ps1

# Push secrets to Cloudflare Workers
.\push-secrets.ps1

# View real-time Worker logs
npx wrangler tail
```

### Manual Worker Secret Management
```powershell
# Set an individual secret
echo "my_secret_value" | npx wrangler secret put SECRET_NAME

# List all active secrets
npx wrangler secret list

# Delete a secret
npx wrangler secret delete SECRET_NAME
```
