-- ═══════════════════════════════════════════════════════
-- MOONCRAFT DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ═══════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- TABLE: admins
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin', 'staff')),
  permissions TEXT[] DEFAULT ARRAY['view_orders', 'view_products'],
  is_active   BOOLEAN DEFAULT true,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: users (customers)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT,
  email         TEXT UNIQUE,
  password_hash TEXT,
  phone         TEXT,
  role          TEXT DEFAULT 'customer',
  is_guest      BOOLEAN DEFAULT false,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: products
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug_id             TEXT UNIQUE NOT NULL,       -- matches frontend id (e.g. "1", "2")
  name                TEXT NOT NULL,
  price               NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  description         TEXT NOT NULL,
  materials           TEXT,
  care_instructions   TEXT,
  category            TEXT NOT NULL CHECK (category IN ('Resin Art', 'Wedding Favors', 'Festive Gifting', 'Accessories')),
  image               TEXT,
  fallback_image      TEXT,
  gallery             TEXT[] DEFAULT '{}',
  stock               INTEGER DEFAULT 999,
  is_active           BOOLEAN DEFAULT true,
  is_featured         BOOLEAN DEFAULT false,
  total_sold          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: orders
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          TEXT UNIQUE NOT NULL,

  -- Customer info (denormalized for guest checkout support)
  customer_name         TEXT NOT NULL,
  customer_email        TEXT NOT NULL,
  customer_phone        TEXT NOT NULL,
  address_line1         TEXT NOT NULL,
  address_city          TEXT NOT NULL,
  address_state         TEXT NOT NULL,
  address_zip           TEXT NOT NULL,
  address_country       TEXT DEFAULT 'India',

  -- Optional user account link
  user_id               UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Financials
  subtotal              NUMERIC(10,2) NOT NULL,
  shipping              NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount              NUMERIC(10,2) DEFAULT 0,
  total                 NUMERIC(10,2) NOT NULL,

  -- Status
  status                TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  )),

  -- Payment
  payment_status        TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
  payment_method        TEXT DEFAULT 'razorpay' CHECK (payment_method IN ('razorpay', 'cod', 'upi', 'card')),
  razorpay_order_id     TEXT,
  razorpay_payment_id   TEXT,
  razorpay_signature    TEXT,
  paid_at               TIMESTAMPTZ,

  -- Delivery
  estimated_delivery    TEXT DEFAULT '14 - 21 Days',
  tracking_number       TEXT,
  courier_partner       TEXT,

  -- Notes
  notes                 TEXT,
  admin_notes           TEXT,

  -- Notifications sent?
  email_sent            BOOLEAN DEFAULT false,
  whatsapp_sent         BOOLEAN DEFAULT false,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLE: order_items
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      TEXT NOT NULL,   -- slug_id from products
  name            TEXT NOT NULL,
  price           NUMERIC(10,2) NOT NULL,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  image           TEXT,
  selected_option TEXT
);

-- ─────────────────────────────────────────
-- INDEXES (for performance)
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay ON orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─────────────────────────────────────────
-- UPDATED_AT TRIGGER (auto-update timestamps)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_admins_updated_at    BEFORE UPDATE ON admins    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_users_updated_at     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_products_updated_at  BEFORE UPDATE ON products  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_orders_updated_at    BEFORE UPDATE ON orders    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY (disable for server-side service role)
-- The backend uses service_role key which bypasses RLS.
-- RLS is here as a safety net if anon key is ever used accidentally.
-- ─────────────────────────────────────────
ALTER TABLE admins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE products  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (our backend)
CREATE POLICY "service_role_all" ON admins    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON users     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON products  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON orders    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON order_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow public to read active products only
CREATE POLICY "public_read_products" ON products FOR SELECT TO anon USING (is_active = true);

-- ─────────────────────────────────────────
-- SEED: All 19 products
-- ─────────────────────────────────────────
INSERT INTO products (slug_id, name, price, description, materials, care_instructions, category, image, fallback_image, gallery, is_featured) VALUES
('1',  '8 Inch Resin Photo Frame',       1500, 'Preserve your most cherished memories in a beautiful, glossy 8-inch hexagonal and circular resin photo frame. Handcrafted with high-clarity epoxy resin, real pressed white and blush seasonal baby''s breath flowers, and delicate 24k gold leaf flakes.', 'Premium High-Gloss Epoxy Resin, Hand-Pressed Rose Petals, Eucalyptus sprigs, 24k Gold Leafing, Acrylic Display Stand.', 'Avoid direct, prolonged exposure to harsh UV sunlight. Clean strictly with a soft dry microfiber cloth. Do not apply glass cleaners, scrubbing pads, or alcohol-based chemical sprays.', 'Resin Art', '/images/8 inch resin photo frame, price 1500.jpeg', 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop', ARRAY['https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800', 'https://images.unsplash.com/photo-1544273677-c433136021d4?q=80&w=800'], true),
('2',  '12 Inch Customise Pooja Tray',   2500, 'An elegant religious center plate handcrafted for spiritual spaces. Rich marble textured background with traditional motifs, deep gold acrylic custom calligraphy, and heavy solid brass handles.', 'Extra-Strength Resin Base, Acrylic Calligraphy Decals, Metallic Gold Gilded Rim, Solid Gold-Finished Heavy Brass Knobs.', 'Wipe with a damp warm cloth. Avoid soaking or leaving water/oils pooled on the surface. Not microwave or dishwasher safe.', 'Festive Gifting', '/images/12 inch Customise Pooja Tray, price 2500.jpeg', 'https://images.unsplash.com/photo-1606722590583-6951b5ea92ad?q=80&w=800&auto=format&fit=crop', '{}', false),
('3',  '12 Inch Wall Clock',             2500, 'Make time beautiful. This luxury 12-inch wall clock is structured with abstract Geode patterns, blending shimmering white, slate-gray quartz, and heavy liquid gold boundaries. Contains a silent sweeping Swiss quartz movement.', 'MDF Core Backing, Ultra-Gloss Resin Layering, Quartz Mineral Crystals, Polished Brass Hands, Silent Sweeping Clock Mechanism.', 'Hang out of direct sunlight to prevent UV-yellowing. Dust weekly with a light dusting feather or soft plush brush.', 'Resin Art', '/images/12 inch wall clock, price 2500.jpeg', 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?q=80&w=800&auto=format&fit=crop', '{}', false),
('4',  'Baby Keepsake Resin Dome',       2800, 'Capture the precious moments of early infancy. Preserves hospital bracelets, umbilical cord clips, first hair locks, or tiny mittens inside a heavy crystal-clear resin dome block. Enhanced with warm LED wooden light bases.', 'Optical-Grade UV Resistant Clear Resin, Dried Baby''s Breath, Custom Solid Pine Wood Base with soft USB-powered LED light.', 'Do not leave LED light on for more than 8 straight hours. Keepsake block is sturdy but can chip if dropped on hard marble floors.', 'Resin Art', '/images/baby keep shake, price 2800.jpeg', 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=800&auto=format&fit=crop', '{}', false),
('5',  'Premium Bhabhi Rakhi',            100, 'Celebrate sacred bonds with our premium floral Bhabhi Rakhi (Lumba style). Decorated with handcrafted tassels, preserved rose petals embedded in miniature resin pendants, and high-quality gold zari threads.', 'Premium Silk Threading, Dried Miniature Floral Accents, Micro-Resin Pendant, Handfolded Tassels.', 'Do not submerge in water. Keep inside dry velvet storage pouch when not wearing.', 'Festive Gifting', '/images/Bhabhi Rakhi, price 100.jpeg', 'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?q=80&w=800&auto=format&fit=crop', '{}', false),
('6',  'Celestial Car Hanger',            300, 'Bring a touch of cosmic luxury to your daily commute. Elegantly designed circular rearview-mirror hanger with real-pressed mini flora, reflective gold foil star icons, and a premium white leather tassel bundle.', 'Resin Pendant Ring, Real Dried White Chamomile, 24k Gold Foil flakes, Premium Faux Leather Tassel, Gold Steel Chain.', 'Can handle car cabin temperatures but avoid continuous exposure in parking zones under extreme hot direct desert sun.', 'Accessories', '/images/car hanger, price 300.jpeg', 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?q=80&w=800&auto=format&fit=crop', '{}', false),
('7',  'Cartoon Character Rakhi',          180, 'Delight the little ones with bespoke handcrafted cartoon character rakhis. Specially curated with safe child-friendly rounded edges, vibrant resin graphics, and dynamic comfortable braided cotton bands.', 'Acrylic Graphic Core, Transparent Resin Seal, Soft Braided Organic Cotton Threads.', 'Soft cloth clean only. Keep safe from sharp toys or rough play to prevent minor scratching.', 'Festive Gifting', '/images/cartoon Rakhi, price 180.jpeg', 'https://images.unsplash.com/photo-1518887570146-0612132dd618?q=80&w=800&auto=format&fit=crop', '{}', false),
('8',  'Elegant Couple Rakhi Set',         300, 'A matching pair of handcrafted designer rakhis for Bhaiya and Bhabhi. Adorned with natural hand-pressed flowers, premium pearl beads, and soft custom golden metallic braided strands.', 'Braided Silk Zari Threads, Faux Seed Pearls, Dried Rose Buds, Polished Resin Miniatures.', 'Avoid contact with perfumes, cologne, body oils, or household water sprays.', 'Festive Gifting', '/images/couple rakhi, price 300.jpeg', 'https://images.unsplash.com/photo-1562157873-818bc0726f68?q=80&w=800&auto=format&fit=crop', '{}', false),
('9',  'Heart Botanical Key Chain',        150, 'Carry a small piece of bespoke beauty. A heavy, pocket-friendly heart-shaped solid resin keychain featuring a pristine real miniature red rosebud nested in gold flakes.', 'UV Resistant Epoxy, Pressed Miniature Rose Bud, Gilded Foil, High-Hardness Brass Keyring and Clasp.', 'Avoid scraping against jagged metallic house keys. Wipe away heavy fingerprints with a cloth.', 'Accessories', '/images/Heart key chain, price 150.jpeg', 'https://images.unsplash.com/photo-1530124566582-aa37dd159a5c?q=80&w=800&auto=format&fit=crop', '{}', false),
('10', 'Hexagon Premium Photo Frame',     3000, 'Our signature editorial piece. Massive 12-inch hexagonal solid crystal-clear block framing your memorable photo, surrounded by customized hand-dried wedding blossoms, baby''s breath and signature gold leaf.', 'Optical Casting Resin, High Definition Color Matte Printed Photo, Full Pressed Floral Garland, Polished Maple Display stand.', 'Keep strictly indoors away from sunny windows. Avoid harsh scrubbing or abrasive paper towel cleaning.', 'Resin Art', '/images/hexgon photo frame, price 3000.jpeg', 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop', '{}', true),
('11', 'Naudhan Ganpati Tabletop',         200, 'A compact divine desktop figurine of Lord Ganesha, framed elegantly inside clear solid resin, with red kumkum backdrop and yellow marigold dried petal accents. Enhances calm, peace and positive energies.', 'Molded Resin Plate, Ganesha Metallic Accent, Preserved Marigold Petals, Red Velvet back.', 'Do not wash in warm running water. Dust off gently with a soft micro sponge.', 'Festive Gifting', '/images/Naudhan Ganpati, price 200.jpeg', 'https://images.unsplash.com/photo-1609137144971-ce488f55da28?q=80&w=800&auto=format&fit=crop', '{}', false),
('12', 'Panch Masi Festive Set',           150, 'Miniature ritual handcrafted boxes with geometric clear resin lids for storage of divine grains and tilaks during auspicious family ceremonies.', 'Resin Cast Lids, Eco-friendly engineered wood base, gold metallic knobs.', 'Keep in warm dry drawer. Clean slightly with dry lint-free cloth.', 'Festive Gifting', '/images/Panch masi, price 150.jpeg', 'https://images.unsplash.com/photo-1606722590583-6951b5ea92ad?q=80&w=800&auto=format&fit=crop', '{}', false),
('13', 'Premium Resin Photo Frame',       1500, 'Exquisite rectangular 8x10 photo frame highlighting transparent glass borders coupled with frozen natural botanical stems and real gold highlights. A beautiful centerpiece for bedside tables.', 'Epoxy Resin Matrix, Polished Crystal Borders, Dried Hydrangeas, 24k Gold Flakes, Heavy Stainless Easel Stand.', 'Handle with clean dry hands. Keep out of humid steam bathrooms.', 'Resin Art', '/images/photo frame, price 1500.jpeg', 'https://images.unsplash.com/photo-1513519107129-14a1a2e31af1?q=80&w=800&auto=format&fit=crop', '{}', false),
('14', 'Pooja Tilak Tray',               2000, 'Crafted exclusively for holy sacraments. Complete set including customized compartments for Tilak, Roli, Akshat, and divine flowers, styled with a shimmering white quartz pattern and real brass accents.', 'Water-safe heavy resin, polished copper alloy sub-bowls, high-gloss pearl finish, slip-resistant base mats.', 'Wipe clean immediately after using wet pastes like sandalwood to prevent fine pigment stains.', 'Festive Gifting', '/images/Pooja Tilak Tray, price 2000.jpeg', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop', '{}', false),
('15', 'Varmala Keepsake Night Lamp',     2500, 'Preserve the sacred Varmala wedding garland forever inside a glowing, warm night lamp. Dried flowers from your marriage are carefully structured and cured inside a massive rectangular column, illuminated by a hand-carved warm wood base.', 'Highly Transparent Slow-Cured Epoxy Resin, Dried Wedding Garlands, Fine Rosebuds, Oakwood LED Pedestal Base with USB Connector.', 'Plug into stable 5V output adapters. Do not drop. The heavy block maintains pristine glow endlessly.', 'Wedding Favors', '/images/varmala night lamp, price 2500.jpeg', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?q=80&w=800&auto=format&fit=crop', '{}', true),
('16', 'Resin Wall Clock Classic',        2500, 'An elegant, bespoke timepiece blending contemporary neutral tones with luxury hand-pressed ocean wave gold lines. Classic 12-inch circular layout perfect for adding a sophisticated touch to luxury lounges.', 'Cast Acrylic Board, Dense Pigmented Epoxy Layers, Golden Numerical Bars, Sweep Quartz Mechanism.', 'Replace AA battery once a year. Hand-adjust clock arms only if strictly necessary using back knob.', 'Resin Art', '/images/Wall Clock, price 2500.jpeg', 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?q=80&w=800&auto=format&fit=crop', '{}', false),
('17', 'Delicate Brass Wedding Bells',      20, 'Tiny, beautiful polished brass bells ideal as elegant gift hampers for weddings or ceremonial wedding return bags.', 'Solid Brass Casting, Threaded Cord, Mirror Finish Polish.', 'Wipe with dry polishing cloth to maintain bright brass glimmer.', 'Wedding Favors', '/images/wedding bells, price 20.jpeg', 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=800&auto=format&fit=crop', '{}', false),
('18', 'Custom Bespoke Wedding Invite',   2000, 'An ultra-premium invitations solution. Made of crystal clear thick acrylic card customized with shimmering metallic screenprinting and enclosed in custom textured velvet boxes.', 'Thick Polished Acrylic Plates, Screenprinted Gold Inks, Custom Textured Cardboard Envelope.', 'Avoid rubbing cards together directly. Keep stored in protective tissue sleeves.', 'Wedding Favors', '/images/Wedding Invite, price 2000.jpeg', 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?q=80&w=800&auto=format&fit=crop', '{}', false),
('19', 'Wooden Preserved Photo Frame',    1500, 'Warm, natural teakwood meets high-gloss clear resin. This 8-inch frame contains raw organic bark framing a crystal glossy resin center window housing your beautiful moments.', 'Premium Teak Bark Segment, Clear Epoxy Resin Layer, Polished Brass Back Screws.', 'Keep dry. Wipe timber oil on wooden elements once in a while to preserve grain beauty.', 'Resin Art', '/images/wooden photo frame, price 1500.jpeg', 'https://images.unsplash.com/photo-1544273677-c433136021d4?q=80&w=800&auto=format&fit=crop', '{}', false)
ON CONFLICT (slug_id) DO NOTHING;

-- ─────────────────────────────────────────
-- TABLE: otps
-- Mobile phone OTP auth — sent on /api/auth/send-otp, verified on /api/auth/verify-otp
-- One active code per phone at a time (upsert by phone).
-- Auto-cleaned by the app after verification or after expires_at.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT UNIQUE NOT NULL,         -- E.164-ish, e.g. +919876543210
  code        TEXT NOT NULL,                -- 6-digit OTP (hashed? no — short TTL, low value)
  attempts    INTEGER DEFAULT 0,            -- brute-force guard (max 5)
  expires_at  TIMESTAMPTZ NOT NULL,
  verified    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otps_phone     ON otps(phone);
CREATE INDEX IF NOT EXISTS idx_otps_expires   ON otps(expires_at);

ALTER TABLE otps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON otps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- TABLE: password_resets
-- Used by /api/auth/forgot-password + /api/auth/reset-password
-- One active token per user (upsert on user_id).
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token      ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id    ON password_resets(user_id);

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON password_resets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- NOTE: Admin account is created via seeder.js
-- (password is bcrypt hashed, can't do it in SQL easily)
-- Run: node backend/seeder.js  after setup
-- ─────────────────────────────────────────
