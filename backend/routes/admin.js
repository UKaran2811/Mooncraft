const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const supabase = require('../lib/supabase');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ──────────────────────────────────────────────
// DASHBOARD STATS
// ──────────────────────────────────────────────

/**
 * GET /api/admin/dashboard/stats
 */
router.get('/dashboard/stats', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    // Run all counts in parallel
    const [
      { count: totalOrders },
      { count: todayOrders },
      { count: monthOrders },
      { count: pendingOrders },
      { count: confirmedOrders },
      { count: processingOrders },
      { count: shippedOrders },
      { count: deliveredOrders },
      { count: cancelledOrders },
      { count: totalCustomers },
      { count: totalProducts },
      { data: revenueData },
      { data: todayRevenueData },
      { data: monthRevenueData },
      { data: lastMonthRevenueData },
    ] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday),
      supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'shipped'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
      // Revenue = sum of total for paid orders (Supabase doesn't have aggregate directly, use select)
      supabase.from('orders').select('total').eq('payment_status', 'paid'),
      supabase.from('orders').select('total').eq('payment_status', 'paid').gte('created_at', startOfToday),
      supabase.from('orders').select('total').eq('payment_status', 'paid').gte('created_at', startOfMonth),
      supabase.from('orders').select('total').eq('payment_status', 'paid').gte('created_at', startOfLastMonth).lte('created_at', endOfLastMonth),
    ]);

    const sum = (rows) => (rows || []).reduce((acc, r) => acc + Number(r.total), 0);
    const totalRevenue = sum(revenueData);
    const todayRevenue = sum(todayRevenueData);
    const monthRevenue = sum(monthRevenueData);
    const lastMonthRevenue = sum(lastMonthRevenueData);
    const growthPercent = lastMonthRevenue > 0
      ? (((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
      : null;

    res.json({
      success: true,
      data: {
        revenue: { total: totalRevenue, today: todayRevenue, thisMonth: monthRevenue, lastMonth: lastMonthRevenue, growthPercent },
        orders: {
          total: totalOrders,
          today: todayOrders,
          thisMonth: monthOrders,
          byStatus: {
            pending: pendingOrders,
            confirmed: confirmedOrders,
            processing: processingOrders,
            shipped: shippedOrders,
            delivered: deliveredOrders,
            cancelled: cancelledOrders,
          },
        },
        customers: { total: totalCustomers },
        products: { totalActive: totalProducts },
      },
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to load stats' });
  }
});

/**
 * GET /api/admin/dashboard/revenue-chart
 * Daily revenue for the past N days
 */
router.get('/dashboard/revenue-chart', requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: orders, error } = await supabase
      .from('orders')
      .select('total, created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Group by date in JS
    const grouped = {};
    for (const order of orders || []) {
      const date = order.created_at.slice(0, 10);
      if (!grouped[date]) grouped[date] = { _id: date, revenue: 0, orders: 0 };
      grouped[date].revenue += Number(order.total);
      grouped[date].orders += 1;
    }

    res.json({ success: true, data: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/admin/dashboard/top-products
 * Best-selling products by revenue
 */
router.get('/dashboard/top-products', requireAdmin, async (req, res) => {
  try {
    const { data: items, error } = await supabase
      .from('order_items')
      .select('product_id, name, price, quantity, orders!inner(payment_status)')
      .eq('orders.payment_status', 'paid');

    if (error) throw error;

    // Aggregate in JS
    const productMap = {};
    for (const item of items || []) {
      if (!productMap[item.product_id]) {
        productMap[item.product_id] = { _id: item.product_id, name: item.name, totalSold: 0, totalRevenue: 0 };
      }
      productMap[item.product_id].totalSold += item.quantity;
      productMap[item.product_id].totalRevenue += Number(item.price) * item.quantity;
    }

    const sorted = Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
    res.json({ success: true, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// CUSTOMER MANAGEMENT
// ──────────────────────────────────────────────

/**
 * GET /api/admin/users
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('users')
      .select('id, name, email, phone, role, is_active, created_at', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (error) throw error;
    res.json({ success: true, data: users, pagination: { total: count, page: Number(page), pages: Math.ceil(count / limit) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/admin/users/:id
 * Customer detail with all their orders
 */
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, role, created_at')
      .eq('id', req.params.id)
      .single();

    if (error || !user) return res.status(404).json({ success: false, message: 'User not found' });

    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('customer_email', user.email)
      .order('created_at', { ascending: false });

    res.json({ success: true, data: { ...user, orders: orders || [] } });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// ADMIN ACCOUNT MANAGEMENT (super_admin only)
// ──────────────────────────────────────────────

/**
 * GET /api/admin/admins
 */
router.get('/admins', requireAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super admin only' });
    }
    const { data: admins, error } = await supabase
      .from('admins')
      .select('id, name, email, role, permissions, is_active, last_login, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: admins });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/admin/admins
 * Create staff admin (super admin only)
 */
router.post(
  '/admins',
  requireAdmin,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
  ],
  async (req, res) => {
    try {
      if (req.admin.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Super admin only' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { email, password, name, role = 'staff', permissions } = req.body;

      const { data: existing } = await supabase.from('admins').select('id').eq('email', email).single();
      if (existing) return res.status(409).json({ success: false, message: 'Email already exists' });

      const passwordHash = await bcrypt.hash(password, 12);

      const { data: admin, error } = await supabase
        .from('admins')
        .insert({
          email,
          name,
          role,
          password_hash: passwordHash,
          permissions: permissions || ['view_orders', 'view_products'],
        })
        .select('id, name, email, role, permissions, created_at')
        .single();

      if (error) throw error;
      res.status(201).json({ success: true, data: admin, message: 'Staff admin created' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

module.exports = router;
