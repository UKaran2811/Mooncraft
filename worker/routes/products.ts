/**
 * Product routes — Hono (Workers-compatible).
 * Mirrors backend/routes/products.js.
 */
import { Hono } from 'hono';
import { getSupabase } from '../lib/supabase';
import { requireAdmin, requirePermission } from '../middleware/auth';
import { camelizeKeys } from '../utils/orderShaper';

const router = new Hono<{ Bindings: Env }>();

const CATEGORIES = ['Resin Art', 'Wedding Favors', 'Festive Gifting', 'Accessories'];

// ── PUBLIC ────────────────────────────────
// GET /api/products
router.get('/', async (c) => {
  try {
    const q = c.req.query();
    const { category, search, sort = 'newest' } = q;
    const limit = Number(q.limit) || 50;
    const page = Number(q.page) || 1;
    const offset = (page - 1) * limit;

    const supabase = getSupabase(c.env);
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    if (category) query = query.eq('category', category);
    if (search) query = query.ilike('name', `%${search}%`);

    const sortMap: Record<string, [string, { ascending: boolean }]> = {
      price_asc: ['price', { ascending: true }],
      price_desc: ['price', { ascending: false }],
      newest: ['created_at', { ascending: false }],
      popular: ['total_sold', { ascending: false }],
    };
    const [col, opts] = sortMap[sort] || sortMap.newest;
    query = query.order(col, opts);

    query = query.range(offset, offset + limit - 1);

    const { data: products, count, error } = await query;
    if (error) throw error;

    return c.json({
      success: true,
      data: products,
      pagination: { total: count, page, pages: Math.ceil((count || 0) / limit) },
    });
  } catch (err: any) {
    console.error('Get products error:', err.message);
    return c.json({ success: false, message: 'Failed to fetch products' }, 500);
  }
});

// ── ADMIN: all products (before /:slugId) ──
router.get('/admin/all', requireAdmin, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return c.json({ success: true, data: (products || []).map(camelizeKeys), total: products.length });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── PUBLIC: single product ────────────────
router.get('/:slugId', async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug_id', c.req.param('slugId'))
      .eq('is_active', true)
      .single();

    if (error || !product) return c.json({ success: false, message: 'Product not found' }, 404);
    return c.json({ success: true, data: product });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── ADMIN: create product ─────────────────
router.post('/', requireAdmin, requirePermission('manage_products'), async (c) => {
  try {
    const body = await c.req.json();

    if (!body.slug_id || !String(body.slug_id).trim()) return c.json({ success: false, errors: [{ msg: 'slug_id required' }] }, 400);
    if (!body.name || !String(body.name).trim()) return c.json({ success: false, errors: [{ msg: 'Name required' }] }, 400);
    if (typeof body.price !== 'number' || body.price < 0) return c.json({ success: false, errors: [{ msg: 'Valid price required' }] }, 400);
    if (!CATEGORIES.includes(body.category)) return c.json({ success: false, errors: [{ msg: 'Valid category required' }] }, 400);
    if (!body.description || !String(body.description).trim()) return c.json({ success: false, errors: [{ msg: 'Description required' }] }, 400);

    const supabase = getSupabase(c.env);
    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('slug_id', String(body.slug_id).trim())
      .single();

    if (existing) return c.json({ success: false, message: 'Product with this slug_id already exists' }, 409);

    const { data: product, error } = await supabase
      .from('products')
      .insert({ ...body, slug_id: String(body.slug_id).trim() })
      .select()
      .single();

    if (error) throw error;
    return c.json({ success: true, data: camelizeKeys(product), message: 'Product created' }, 201);
  } catch (err: any) {
    console.error('Create product error:', err.message);
    return c.json({ success: false, message: 'Failed to create product' }, 500);
  }
});

// ── ADMIN: update product ─────────────────
router.put('/:slugId', requireAdmin, requirePermission('manage_products'), async (c) => {
  try {
    const body = await c.req.json();
    const { id: _id, slug_id: _sid, created_at: _ca, ...updateData } = body;

    const supabase = getSupabase(c.env);
    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('slug_id', c.req.param('slugId'))
      .select()
      .single();

    if (error || !product) return c.json({ success: false, message: 'Product not found' }, 404);
    return c.json({ success: true, data: camelizeKeys(product), message: 'Product updated' });
  } catch {
    return c.json({ success: false, message: 'Failed to update product' }, 500);
  }
});

// ── ADMIN: toggle active ──────────────────
router.patch('/:slugId/toggle', requireAdmin, async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: current } = await supabase
      .from('products')
      .select('is_active')
      .eq('slug_id', c.req.param('slugId'))
      .single();

    if (!current) return c.json({ success: false, message: 'Product not found' }, 404);

    const { data: product, error } = await supabase
      .from('products')
      .update({ is_active: !current.is_active })
      .eq('slug_id', c.req.param('slugId'))
      .select()
      .single();

    if (error) throw error;
    return c.json({
      success: true,
      data: camelizeKeys(product),
      message: `Product ${product.is_active ? 'activated' : 'deactivated'}`,
    });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// ── ADMIN: soft delete ────────────────────
router.delete('/:slugId', requireAdmin, requirePermission('manage_products'), async (c) => {
  try {
    const supabase = getSupabase(c.env);
    const { data: product, error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('slug_id', c.req.param('slugId'))
      .select()
      .single();

    if (error || !product) return c.json({ success: false, message: 'Product not found' }, 404);
    return c.json({ success: true, message: 'Product removed from store' });
  } catch {
    return c.json({ success: false, message: 'Failed to delete product' }, 500);
  }
});

// ── ADMIN: permanent delete (super only) ──
router.delete('/:slugId/permanent', requireAdmin, async (c) => {
  try {
    const admin = c.get('admin');
    if (admin.role !== 'super_admin') return c.json({ success: false, message: 'Super admin only' }, 403);

    const supabase = getSupabase(c.env);
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('slug_id', c.req.param('slugId'));

    if (error) throw error;
    return c.json({ success: true, message: 'Product permanently deleted' });
  } catch {
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

export default router;