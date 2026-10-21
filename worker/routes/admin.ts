/**
 * Admin routes — Hono (Workers-compatible).
 * Mirrors backend/routes/admin.js.
 */
import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase';
import { requireAdmin } from '../middleware/auth';
import { shapeAdminOrder } from '../utils/orderShaper';
import { hashPassword } from '../utils/password';

const router = new Hono<{ Bindings: Env }>();

// ── DASHBOARD STATS ───────────────────────
router.get('/dashboard/stats', requireAdmin, async (c) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    const supabase = getSupabase(c.env);

    const countOrders = (q: any) => q.then((r: any) => r.count || 0);
    const [
      totalOrders,
      todayOrders,
      monthOrders,
      pendingOrders,
      confirmedOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalCustomers,
      totalProducts,
      revenueData,
      todayRevenueData,
      monthRevenueData,
      lastMonthRevenueData,
    ] = await Promise.all([
      countOrders(supabase.from('orders').select('*', { count: 'exact', head: true })),
      countOrders(supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday)),
      countOrders(supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth)),
      countOrders(supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
      countOrders(supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'confirmed')),
      countOrders(supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'processing')),
      countOrders(supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'shipped')),
      countOrders(supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered')),
      countOrders(supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'cancelled')),
      countOrders(supabase.from('users').select('*', { count: 'exact', head: true })),
      countOrders(supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true)),
      supabase.from('orders').select('total').eq('payment_status', 'paid').then((r) => r.data),
      supabase.from('orders').select('total').eq('payment_status', 'paid').gte('created_at', startOfToday).then((r) => r.data),
      supabase.from('orders').select('total').eq('payment_status', 'paid').gte('created_at', startOfMonth).then((r) => r.data),
      supabase.from('orders').select('total').eq('payment_status', 'paid').gte('created_at', startOfLastMonth).lte('created_at', endOfLastMonth).then((r) => r.data),
    ]);

    const sum = (rows: any[]) => (rows || []).reduce((acc, r) => acc + Number(r.total), 0);
    const totalRevenue = sum(revenueData);
    const todayRevenue = sum(todayRevenueData);
    const monthRevenue = sum(monthRevenueData);
    const lastMonthRevenue = sum(lastMonthRevenueData);
    const growthPercent = lastMonthRevenue > 0
      ? (((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
      : null;

    return c.json({
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
  } catch (err: any) {
    console.error('Dashboard stats error:', err.message);
    return c.json({ success: false, message: 'Failed to load stats' }, 500);
  }
});

// ── REVENUE CHART ─────────────────────────
router.get('/dashboard/revenue-chart', requireAdmin, async (c) => {
  try {
    const days = parseInt(c.req.query('days')) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const supabase = getSupabase(c.env);
    const { data: orders, error } = await supabase
      .from('orders')
      .select('total, created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    const grouped: Record<string, any> = {};
    for (const order of orders || []) {
      const date = order.created_at.slice(0, 10);
      if (!grouped[date]) grouped[date] = { _id: date, revenue: 0, orders: 0 };
      grouped[date].revenue += Number(order.total);
      grouped[date].orders += 1;
    }

    return c.json({ success: true, data: Object.values(grouped) });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── TOP PRODUCTS ──────────────────────────
router.get('/dashboard/top-products', requireAdmin, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: items, error } = await supabase
      .from('order_items')
      .select('product_id, name, price, quantity, orders!inner(payment_status)')
      .eq('orders.payment_status', 'paid');

    if (error) throw error;

    const productMap: Record<string, any> = {};
    for (const item of items || []) {
      if (!productMap[item.product_id]) {
        productMap[item.product_id] = { _id: item.product_id, name: item.name, totalSold: 0, totalRevenue: 0 };
      }
      productMap[item.product_id].totalSold += item.quantity;
      productMap[item.product_id].totalRevenue += Number(item.price) * item.quantity;
    }

    const sorted = Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
    return c.json({ success: true, data: sorted });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── USERS LIST ────────────────────────────
router.get('/users', requireAdmin, async (c) => {
  try {
    const q = c.req.query();
    const limit = Number(q.limit) || 20;
    const page = Number(q.page) || 1;
    const offset = (page - 1) * limit;
    const { search } = q;

    const supabase = getSupabase(c.env);
    let query = supabase
      .from('users')
      .select('id, name, email, phone, role, is_active, created_at', { count: 'exact' });

    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data: users, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return c.json({ success: true, data: users, pagination: { total: count, page, pages: Math.ceil((count || 0) / limit) } });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── USER DETAIL ───────────────────────────
router.get('/users/:id', requireAdmin, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, phone, role, created_at')
      .eq('id', c.req.param('id'))
      .single();

    if (error || !user) return c.json({ success: false, message: 'User not found' }, 404);

    const conditions = [`user_id.eq.${user.id}`];
    if (user.email) conditions.push(`customer_email.eq.${user.email}`);

    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .or(conditions.join(','))
      .order('created_at', { ascending: false });

    return c.json({ success: true, data: { ...user, orders: (orders || []).map(shapeAdminOrder) } });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── USER TOGGLE ───────────────────────────
router.patch('/users/:id/toggle', requireAdmin, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: current } = await supabase
      .from('users')
      .select('is_active')
      .eq('id', c.req.param('id'))
      .single();

    if (!current) return c.json({ success: false, message: 'User not found' }, 404);

    const { data: user, error } = await supabase
      .from('users')
      .update({ is_active: !current.is_active })
      .eq('id', c.req.param('id'))
      .select('id, name, email, is_active')
      .single();

    if (error) throw error;
    return c.json({ success: true, data: user, message: `User ${user.is_active ? 'activated' : 'deactivated'}` });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── ADMINS LIST (super only) ──────────────
router.get('/admins', requireAdmin, async (c) => {
  try {
    const admin = c.get('admin');
    if (admin.role !== 'super_admin') return c.json({ success: false, message: 'Super admin only' }, 403);

    const supabase = getSupabase(c.env);
    const { data: admins, error } = await supabase
      .from('admins')
      .select('id, name, email, role, permissions, is_active, last_login, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return c.json({ success: true, data: admins });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── CREATE STAFF ADMIN (super only) ───────
router.post('/admins', requireAdmin, async (c) => {
  try {
    const admin = c.get('admin');
    if (admin.role !== 'super_admin') return c.json({ success: false, message: 'Super admin only' }, 403);

    const body = await c.req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.json({ success: false, errors: [{ msg: 'Valid email required' }] }, 400);
    if (password.length < 8) return c.json({ success: false, errors: [{ msg: 'Password must be at least 8 characters' }] }, 400);
    if (!name) return c.json({ success: false, errors: [{ msg: 'Name required' }] }, 400);

    const supabase = getSupabase(c.env);
    const { data: existing } = await supabase.from('admins').select('id').eq('email', email).single();
    if (existing) return c.json({ success: false, message: 'Email already exists' }, 409);

    const passwordHash = await hashPassword(password);

    const { data: created, error } = await supabase
      .from('admins')
      .insert({
        email,
        name,
        role: body.role || 'staff',
        password_hash: passwordHash,
        permissions: body.permissions || ['view_orders', 'view_products'],
      })
      .select('id, name, email, role, permissions, created_at')
      .single();

    if (error) throw error;
    return c.json({ success: true, data: created, message: 'Staff admin created' }, 201);
  } catch (err: any) {
    console.error('Create admin error:', err.message);
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── ADMIN DETAIL (super only) ─────────────
router.get('/admins/:id', requireAdmin, async (c) => {
  try {
    const admin = c.get('admin');
    if (admin.role !== 'super_admin') return c.json({ success: false, message: 'Super admin only' }, 403);

    const supabase = getSupabase(c.env);
    const { data: adminRow, error } = await supabase
      .from('admins')
      .select('id, name, email, role, permissions, is_active, last_login, created_at')
      .eq('id', c.req.param('id'))
      .single();

    if (error || !adminRow) return c.json({ success: false, message: 'Admin not found' }, 404);
    return c.json({ success: true, data: adminRow });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── UPDATE STAFF ADMIN (super only) ───────
router.patch('/admins/:id', requireAdmin, async (c) => {
  try {
    const admin = c.get('admin');
    if (admin.role !== 'super_admin') return c.json({ success: false, message: 'Super admin only' }, 403);
    if (c.req.param('id') === admin.id) return c.json({ success: false, message: 'Cannot edit your own admin record' }, 400);

    const body = await c.req.json();
    const allowedFields = ['name', 'role', 'permissions'];
    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ success: false, message: 'No updatable fields provided' }, 400);
    }

    const supabase = getSupabase(c.env);
    const { data: adminRow, error } = await supabase
      .from('admins')
      .update(updateData)
      .eq('id', c.req.param('id'))
      .select('id, name, email, role, permissions, is_active')
      .single();

    if (error || !adminRow) return c.json({ success: false, message: 'Admin not found' }, 404);
    return c.json({ success: true, data: adminRow, message: 'Admin updated' });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── TOGGLE STAFF ADMIN (super only) ───────
router.patch('/admins/:id/toggle', requireAdmin, async (c) => {
  try {
    const admin = c.get('admin');
    if (admin.role !== 'super_admin') return c.json({ success: false, message: 'Super admin only' }, 403);
    if (c.req.param('id') === admin.id) return c.json({ success: false, message: 'Cannot deactivate yourself' }, 400);

    const supabase = getSupabase(c.env);
    const { data: current } = await supabase
      .from('admins')
      .select('is_active')
      .eq('id', c.req.param('id'))
      .single();

    if (!current) return c.json({ success: false, message: 'Admin not found' }, 404);

    const { data: adminRow, error } = await supabase
      .from('admins')
      .update({ is_active: !current.is_active })
      .eq('id', c.req.param('id'))
      .select('id, name, email, role, is_active')
      .single();

    if (error) throw error;
    return c.json({
      success: true,
      data: adminRow,
      message: `Admin ${adminRow.is_active ? 'activated' : 'deactivated'}`,
    });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

export default router;