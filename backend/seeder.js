/**
 * backend/seeder.js
 * Creates the default super admin account in Supabase.
 * Products are seeded directly via supabase_schema.sql (ON CONFLICT DO NOTHING).
 *
 * Usage:
 *   node backend/seeder.js           → create admin + verify products
 *   node backend/seeder.js --clear   → delete all orders (safe reset for testing)
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const args = process.argv.slice(2);
  console.log('\n🌱 Mooncraft Seeder\n');

  // ── Clear mode ─────────────────────────────
  if (args.includes('--clear')) {
    console.log('🗑️  Clearing orders and order items...');
    await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Orders cleared. Products and admins kept intact.\n');
    process.exit(0);
  }

  // ── Check products are seeded ─────────────
  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  if (productCount === 0) {
    console.warn(
      '⚠️  No products found in database.\n' +
      '   Please run the SQL schema first:\n' +
      '   Supabase Dashboard → SQL Editor → paste supabase_schema.sql → Run\n'
    );
  } else {
    console.log(`✅ Products: ${productCount} found in database`);
  }

  // ── Create super admin ────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@mooncraft.in';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Mooncraft@Admin2024!';
  const adminName = process.env.ADMIN_NAME || 'Mooncraft Admin';

  const { data: existing } = await supabase
    .from('admins')
    .select('id')
    .eq('email', adminEmail)
    .single();

  if (existing) {
    console.log(`ℹ️  Admin already exists: ${adminEmail}`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const { error } = await supabase.from('admins').insert({
      name: adminName,
      email: adminEmail,
      password_hash: passwordHash,
      role: 'super_admin',
      permissions: [
        'view_orders',
        'manage_orders',
        'view_products',
        'manage_products',
        'view_customers',
        'manage_admins',
      ],
      is_active: true,
    });

    if (error) {
      console.error('❌ Failed to create admin:', error.message);
    } else {
      console.log(`\n✅ Super admin created!`);
      console.log(`   Email:    ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
      console.log(`   ⚠️  Change this password immediately after first login!\n`);
    }
  }

  console.log('\n🚀 Seeding complete!\n');
  console.log('Next steps:');
  console.log('  1. Copy .env.example to .env and fill in your values');
  console.log('  2. Run: npm run backend:dev    (start local API server)');
  console.log('  3. Run: npm run dev            (start frontend)');
  console.log('  4. Visit: http://localhost:3000/#/admin  (admin login)\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seeder error:', err);
  process.exit(1);
});
