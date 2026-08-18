# Mooncraft — Pending TODO Until Cloudflare Deployment

> Last updated: 2026-08-18 14:30 IST

---

## ✅ Completed So Far

| What | Status |
|---|---|
| Supabase DB migration (`shipment_id` + `awb_code` columns) | ✅ Done |
| Resend domain `mooncraftbymoniyal.com` — DNS verified + Domain verified | ✅ Done |
| `RESEND_FROM_EMAIL` → `orders@mooncraftbymoniyal.com` | ✅ Done |
| Razorpay test keys added to `.env` (`rzp_test_TRAg9HVmNm6vEH`) | ✅ Done |
| `VITE_RAZORPAY_KEY_ID` added for Vite frontend | ✅ Done |
| Razorpay modal confirmed opening (Mooncraft Studio branding ✅) | ✅ Done |
| Dev simulate-payment endpoint (`POST /api/orders/:id/simulate-payment`) | ✅ Done |
| 🧪 "Simulate Payment Success" button in checkout UI (test mode only) | ✅ Done |
| Shiprocket service code — fully written & wired up | ✅ Done (code only) |

---

## Phase 1 — Razorpay Payment Gateway

| # | Task | Status |
|---|---|---|
| 1.1 | Test keys in `.env` + `VITE_RAZORPAY_KEY_ID` | ✅ Done |
| 1.2 | **Run full E2E checkout test** — place order → click "Pay" → close modal → hit "🧪 Simulate Payment" → confirm success screen | ❌ **DO NOW** |
| 1.2 | Verify order appears as `confirmed` + `payment_status=paid` in Supabase | ❌ After simulate test |
| 1.2 | Verify confirmation email fires from `orders@mooncraftbymoniyal.com` | ❌ After simulate test |
| 1.3 | Apply for Razorpay **live** KYC (business docs + bank account) | ❌ TODO |
| 1.3 | Swap live keys into `.env` once KYC approved | ❌ TODO |
| 1.4 | Register Razorpay webhook URL in Dashboard → `https://api.mooncraftbymoniyal.com/api/webhooks/razorpay` | ❌ TODO (after deployment) |

> [!IMPORTANT]
> Do the simulate-payment test RIGHT NOW — it takes 2 minutes and validates Razorpay + Supabase + Resend email all at once.

---

## Phase 2 — Shiprocket Live

| # | Task | Status |
|---|---|---|
| 2.1 | Wait for `ronakbharodiya123@gmail.com` login block to lift | ⏳ Blocked |
| 2.1 | Test credentials via Postman: `POST https://apiv2.shiprocket.in/v1/external/auth/login` | ❌ After block lifts |
| 2.2 | Supabase migration `shipment_id` + `awb_code` | ✅ Done |
| 2.3 | Complete Shiprocket KYC in panel | ❌ TODO |
| 2.3 | Confirm "Home" pickup location name matches `SHIPROCKET_PICKUP_LOCATION=Home` exactly | ❌ TODO |
| 2.4 | Live test: create real order → admin "🚀 Create Shipment" → AWB generated | ❌ TODO |
| 2.5 | Register tracking webhook in Shiprocket panel → `https://api.mooncraftbymoniyal.com/api/shipping/webhook` | ❌ TODO (after deployment) |

---

## Phase 3 — Resend Email

| # | Task | Status |
|---|---|---|
| 3.1 | Add domain to Resend | ✅ Done |
| 3.2 | Add DNS records in GoDaddy | ✅ Done |
| 3.3 | Domain verified in Resend (green ✅) | ✅ Done |
| 3.4 | `RESEND_FROM_EMAIL=orders@mooncraftbymoniyal.com` | ✅ Done |
| 3.5 | **Test real order confirmation email** — fires after simulate-payment test | ❌ After Phase 1.2 |

---

## Phase 4 — Backend Rewrite for Cloudflare Workers

> [!WARNING]
> Largest phase (~2-3 days). Workers don't support `express`, `bcryptjs`, `multer`, `razorpay` SDK, `express-rate-limit`.

| # | Task | Status |
|---|---|---|
| 4.1 | Rewrite `app.js` + all routes from Express → **Hono** | ❌ TODO |
| 4.2 | Replace `express-validator` → Hono `zValidator` or manual validation | ❌ TODO |
| 4.2 | Replace `express-rate-limit` → Cloudflare rate limiting (Workers KV / Durable Objects) | ❌ TODO |
| 4.2 | Replace `razorpay` npm SDK → raw `fetch` to Razorpay REST API | ❌ TODO |
| 4.2 | Replace `bcryptjs` → `SubtleCrypto` (Web Crypto API) for password hashing | ❌ TODO |
| 4.2 | Replace `multer` → Workers `FormData` parsing | ❌ TODO |
| 4.3 | Move image uploads from local `backend/uploads/` → **Cloudflare R2** | ❌ TODO |
| 4.4 | Move static `/uploads` serving → R2 public bucket | ❌ TODO |
| 4.5 | Port all routes: `auth`, `products`, `orders`, `admin`, `shipping`, `webhooks` | ❌ TODO |
| 4.6 | Test locally with `wrangler dev` | ❌ TODO |

---

## Phase 5 — Cloudflare Deploy

| # | Task | Status |
|---|---|---|
| 5.1 | Create Cloudflare account (free) + install `wrangler` | ❌ TODO |
| 5.2 | Set all Workers secrets via `wrangler secret put` | ❌ TODO |
| 5.3 | Deploy backend Worker → `https://api.mooncraftbymoniyal.com` | ❌ TODO |
| 5.4 | Create R2 bucket + set custom domain `images.mooncraftbymoniyal.com` | ❌ TODO |
| 5.5 | `npm run build` → deploy frontend to Cloudflare Pages | ❌ TODO |
| 5.6 | Point Razorpay webhook → Worker URL | ❌ TODO |
| 5.6 | Point Shiprocket webhook → Worker URL | ❌ TODO |

---

## Phase 6 — Domain DNS (GoDaddy → Cloudflare)

| # | Task | Status |
|---|---|---|
| 6.1 | Add `mooncraftbymoniyal.com` to Cloudflare → copy nameservers | ❌ TODO |
| 6.2 | Update GoDaddy nameservers → Cloudflare (~24h propagation) | ❌ TODO |
| 6.3 | Add DNS records in Cloudflare (Pages, Worker, R2) | ❌ TODO |
| 6.4 | HTTPS/SSL auto-enabled (Cloudflare free) | 🔄 Auto |
| 6.5 | Update `FRONTEND_URL` + `APP_URL` secrets → `https://mooncraftbymoniyal.com` | ❌ TODO |

---

## Phase 7 — Go-Live Validation

| # | Task | Status |
|---|---|---|
| 7.1 | Full E2E on live domain: browse → cart → OTP → checkout → pay → ship → track | ❌ TODO |
| 7.2 | Verify emails, WhatsApp/SMS, admin alerts on live | ❌ TODO |
| 7.3 | Fix CORS for `mooncraftbymoniyal.com` in production | ❌ TODO |
| 7.4 | Done ✅ | ❌ TODO |

---

## 🚦 Next Actions (Priority Order)

```
1. ▶ NOW  — Run simulate-payment test (2 min) → validates payment + email
2. ▶ NOW  — Razorpay KYC application (live keys needed for production)
3. ⏳ WAIT — Shiprocket login block lifts → test credentials → KYC
4. 🔨 NEXT — Phase 4: Backend rewrite (Express → Hono for Workers)
5. 🔨 THEN — Phase 5-7: Cloudflare deploy + DNS + validation
```

---

## 📋 Env Vars Still Missing / Placeholder

| Variable | Current Value | Needed |
|---|---|---|
| `TWILIO_*` | `FILL_IN_*` | ⚠️ Optional (Fast2SMS is backup for OTP) |
| `CALLMEBOT_*` | `FILL_IN_*` | ⚠️ Optional (admin WhatsApp alerts) |
| `MSG91_*` | `FILL_IN_*` | ⚠️ Optional |
| `FRONTEND_URL` / `APP_URL` | `http://localhost:3000` | ❌ Update for production |
| `VITE_API_URL` | `http://localhost:5000/api` | ❌ Update for production |
