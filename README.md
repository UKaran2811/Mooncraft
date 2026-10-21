# 🌙 Mooncraft By Monika — Bespoke Resin Art Studio

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-Hono_v4-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![React](https://img.shields.io/badge/React_19-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-Modern_Styling-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Payments-0C2340?style=for-the-badge&logo=razorpay&logoColor=white)](https://razorpay.com/)
[![Shiprocket](https://img.shields.io/badge/Shiprocket-Logistics-7B2CBF?style=for-the-badge)](https://www.shiprocket.in/)
[![Resend](https://img.shields.io/badge/Resend-Transactional_Email-000000?style=for-the-badge&logo=resend&logoColor=white)](https://resend.com/)

> **Live Production Store:** [mooncraftbymoniyal.com](https://mooncraftbymoniyal.com)  
> A premium, handcrafted e-commerce experience for bespoke resin art, wedding favors, floral keepsakes (varmala preservation), luxury home decor, clocks, and personalized gifts.

---

## 🌟 Overview & Highlights

**Mooncraft** is a modern, high-performance e-commerce platform built specifically for artisanal craft studios. It combines a responsive React storefront with an edge-native Cloudflare Worker backend to deliver near-zero cold starts and instant global delivery.

### ✨ Key Features

- **🎨 Bespoke Artisanal Storefront**: Rich catalog showcase for wall clocks, customized pooja trays, photo frames, keepsakes, and festival collections with smooth animations via Lenis & Motion.
- **🖼️ Customization & Photo Uploads**: Direct customer image/flower upload support for bespoke preservation orders backed by **Cloudflare R2 Object Storage**.
- **💳 Seamless Razorpay Integration**: Comprehensive checkout flow supporting UPI, Cards, Netbanking, and Wallets with server-side Web Crypto signature verification, plus a built-in development payment simulator.
- **🚚 Automated Shiprocket Logistics**: Real-time delivery pincode serviceability checks, automated order dispatch, and AWB tracking code generation.
- **📬 Branded Email Receipts (Resend)**: Verified domain emails delivered directly from `orders@mooncraftbymoniyal.com` with responsive HTML templates.
- **📱 Phone OTP Authentication**: Fast, passwordless customer login via Fast2SMS and optional Twilio/MSG91 fallbacks.
- **🛡️ Comprehensive Admin Portal**: Dedicated dashboard at `/admin/login` for real-time sales analytics, inventory management, order state transitions, and one-click shipment creation.
- **⚡ Unified Edge Architecture**: Single Cloudflare Worker serves both the client SPA and the `/api/*` REST endpoints without separate server overhead.

---

## 🏗️ Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Type-safe UI components and modern React hooks |
| **Build & Tooling** | [Vite 6](https://vitejs.dev/) + [@cloudflare/vite-plugin](https://github.com/cloudflare/workers-sdk) | Instant HMR and unified single-bundle Worker output |
| **Styling & Motion** | [Tailwind CSS v4](https://tailwindcss.com/) + [Motion](https://motion.dev/) + [Lenis](https://lenis.darkroom.engineering/) | Aesthetic glassmorphism, responsive layouts, smooth scroll |
| **Edge Server** | [Cloudflare Workers](https://workers.cloudflare.com/) + [Hono v4](https://hono.dev/) | Ultrafast edge router with middleware, CORS, and error handlers |
| **Object Storage** | [Cloudflare R2](https://developers.cloudflare.com/r2/) | S3-compatible zero-egress bucket (`mooncraft-uploads`) |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL) | Managed relational database with RLS and order tracking |
| **Auth & Security** | `jose` (JWT) + `bcryptjs` + Web Crypto API | Edge-compatible authentication and HMAC validation |
| **Payment Gateway** | [Razorpay](https://razorpay.com/) REST API | Secure UPI, Card, and Netbanking payments |
| **Logistics** | [Shiprocket](https://www.shiprocket.in/) REST API | Automated shipping rates, label generation, and tracking |
| **Communications** | [Resend](https://resend.com/) + [Fast2SMS](https://www.fast2sms.com/) | Transactional emails and SMS OTP verification |

---

## 📁 Repository Structure

```
Mooncraft/
├── worker/                     # Cloudflare Worker backend (Hono Edge App)
│   ├── index.ts                # Worker entry point, CORS, static asset bindings
│   ├── types.ts                # TypeScript interfaces for Cloudflare bindings & env
│   ├── lib/
│   │   └── supabase.ts         # Edge-safe Supabase client
│   ├── middleware/
│   │   └── auth.ts             # JWT authentication & admin authorization
│   ├── routes/
│   │   ├── auth.ts             # Customer & admin auth, OTP verification
│   │   ├── products.ts         # Catalog filtering, search, and admin CRUD
│   │   ├── orders.ts           # Order placement, Razorpay verification, history
│   │   ├── admin.ts            # Admin dashboard analytics & order management
│   │   ├── shipping.ts         # Pincode check and Shiprocket tracking webhook
│   │   └── upload.ts           # R2 multipart image upload handling
│   ├── services/
│   │   ├── email.ts            # Resend transactional emails
│   │   ├── otp.ts              # Fast2SMS OTP generator & delivery
│   │   ├── shiprocket.ts       # Shiprocket API client with auth token caching
│   │   └── whatsapp.ts         # WhatsApp notification handlers
│   └── utils/
│       ├── crypto.ts           # Web Crypto API utilities (HMAC, hashing)
│       ├── jwt.ts              # jose JWT signing and decoding
│       ├── orderShaper.ts      # Database-to-client schema normalizer
│       └── password.ts         # bcryptjs password verification
├── src/                        # React Frontend (SPA)
│   ├── components/             # Reusable UI components (Navbar, Footer, Modal, etc.)
│   ├── pages/                  # Page routes (Home, Shop, ProductDetails, Checkout, Admin)
│   ├── services/               # Frontend API client (api.ts points to /api)
│   ├── context/                # Auth, Cart, and Toast state management
│   ├── App.tsx                 # App component & client router
│   └── main.tsx                # React DOM entry point
├── public/                     # Static assets (favicons, product images)
├── backend/                    # Legacy Express backend (reference / local fallback)
├── .dev.vars                   # Local environment variables for Cloudflare Worker
├── .env                        # Local frontend environment variables
├── deploy.ps1                  # One-command build & deployment script
├── push-secrets.ps1            # Automated secret synchronization script
├── pending_todo.md             # Master deployment checklist & status tracker
├── supabase_schema.sql         # Supabase PostgreSQL database schema
├── vite.config.mts             # Vite configuration with Cloudflare integration
└── wrangler.jsonc              # Cloudflare Wrangler configuration
```

---

## 🚀 Getting Started Locally

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/) (v9.0.0 or higher)
- Cloudflare Wrangler CLI (bundled in devDependencies)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/UKaran2811/Mooncraft.git
cd Mooncraft
npm install
```

### 2. Configure Environment Variables

Create your local `.env` and `.dev.vars` files from the provided samples:

- **`.env`** (Frontend variables):
  ```env
  VITE_API_URL=/api
  VITE_RAZORPAY_KEY_ID=rzp_test_TRAg9HVmNm6vEH
  ```

- **`.dev.vars`** (Worker edge secrets):
  ```env
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  SUPABASE_ANON_KEY=your_anon_key
  JWT_SECRET=your_super_secret_jwt_key_at_least_64_characters
  RESEND_API_KEY=re_your_resend_api_key
  RESEND_FROM_EMAIL=orders@mooncraftbymoniyal.com
  RAZORPAY_KEY_ID=rzp_test_TRAg9HVmNm6vEH
  RAZORPAY_KEY_SECRET=your_razorpay_secret
  FAST2SMS_API_KEY=your_fast2sms_api_key
  SHIPROCKET_EMAIL=your_email@example.com
  SHIPROCKET_PASSWORD=your_password
  SHIPROCKET_PICKUP_LOCATION=Home
  R2_PUBLIC_URL=https://images.mooncraftbymoniyal.com
  DEV_SIMULATE_PAYMENT=true
  ```

### 3. Start the Development Server

```bash
# Start frontend with live preview
npm run dev

# Or test the Worker with Cloudflare bindings locally
npm run worker:dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚢 Cloudflare Deployment Guide

The deployment is fully automated using Cloudflare Workers and R2.

### Step 1: Authenticate with Cloudflare
```powershell
npx wrangler login
```

### Step 2: Create the R2 Storage Bucket
```powershell
npx wrangler r2 bucket create mooncraft-uploads
```

### Step 3: Push Secrets to Cloudflare
Upload all credentials from `.dev.vars` directly into Cloudflare's encrypted secret store:
```powershell
.\push-secrets.ps1
```

### Step 4: Build & Deploy
Build the Vite production assets and deploy the unified Worker in a single command:
```powershell
.\deploy.ps1
```

### Step 5: Configure Custom Domain & DNS
1. Add `mooncraftbymoniyal.com` to your Cloudflare account.
2. In GoDaddy (or your registrar), update nameservers to Cloudflare.
3. In Cloudflare Dashboard → **Workers & Pages** → `mooncraft` → **Domains & Routes**, add `mooncraftbymoniyal.com`.
4. In Cloudflare Dashboard → **R2** → `mooncraft-uploads` → **Settings** → **Public Access**, connect custom domain `images.mooncraftbymoniyal.com`.
5. Update production URL secrets:
   ```powershell
   echo "https://mooncraftbymoniyal.com" | npx wrangler secret put FRONTEND_URL
   echo "https://mooncraftbymoniyal.com" | npx wrangler secret put APP_URL
   ```

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite local development server on port 3000 |
| `npm run build` | Builds the client SPA bundle and worker target |
| `npm run preview` | Previews the production build locally |
| `npm run worker:dev` | Runs Cloudflare Worker locally via Wrangler |
| `npm run worker:deploy` | Compiles and deploys the worker directly to Cloudflare |
| `npm run worker:typecheck` | Runs TypeScript compiler checks on the codebase |
| `.\deploy.ps1` | PowerShell one-click build and deploy script |
| `.\push-secrets.ps1` | PowerShell script to push `.dev.vars` to Cloudflare Secrets |
| `npx wrangler tail` | Streams real-time production Worker logs to your terminal |

---

## 📊 Deployment Tracking & Checklist

For an in-depth checklist tracking each phase (Razorpay live KYC, Shiprocket unblocking, Resend status, and DNS propagation), refer to:

👉 **[`pending_todo.md`](./pending_todo.md)**

---

## 📄 License & Attribution

Handcrafted with passion for **Mooncraft By Monika**.  
All rights reserved © 2026 Mooncraft Studio.
