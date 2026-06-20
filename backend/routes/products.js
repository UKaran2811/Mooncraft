const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../lib/supabase');
const { requireAdmin, requirePermission } = require('../middleware/auth');

const router = express.Router();

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
};

// ──────────────────────────────────────────────
// PUBLIC
// ──────────────────────────────────────────────

/**
 * GET /api/products
 * List all active products with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { category, search, sort = 'newest', limit = 50, page = 1 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    if (category) query = query.eq('category', category);
    if (search) query = query.ilike('name', `%${search}%`);

    const sortMap = {
      price_asc:  ['price', { ascending: true }],
      price_desc: ['price', { ascending: false }],
      newest:     ['created_at', { ascending: false }],
      popular:    ['total_sold', { ascending: false }],
    };
    const [col, opts] = sortMap[sort] || sortMap.newest;
    query = query.order(col, opts);

    query = query.range(offset, offset + Number(limit) - 1);

    const { data: products, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: products,
      pagination: { total: count, page: Number(page), pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/admin/all
 * All products including inactive (admin only)
 */
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: products, total: products.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/products/:slugId
 * Single product by slug_id (public)
 */
router.get('/:slugId', async (req, res) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug_id', req.params.slugId)
      .eq('is_active', true)
      .single();

    if (error || !product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ──────────────────────────────────────────────
// ADMIN ONLY
// ──────────────────────────────────────────────

/**
 * POST /api/products
 * Create a new product
 */
router.post(
  '/',
  requireAdmin,
  requirePermission('manage_products'),
  [
    body('slug_id').trim().notEmpty().withMessage('slug_id required'),
    body('name').trim().notEmpty().withMessage('Name required'),
    body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
    body('category')
      .isIn(['Resin Art', 'Wedding Favors', 'Festive Gifting', 'Accessories'])
      .withMessage('Valid category required'),
    body('description').trim().notEmpty().withMessage('Description required'),
  ],
  async (req, res) => {
    if (!validate(req, res)) return;
    try {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('slug_id', req.body.slug_id)
        .single();

      if (existing) {
        return res.status(409).json({ success: false, message: 'Product with this slug_id already exists' });
      }

      const { data: product, error } = await supabase
        .from('products')
        .insert(req.body)
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ success: true, data: product, message: 'Product created' });
    } catch (err) {
      console.error('Create product error:', err);
      res.status(500).json({ success: false, message: 'Failed to create product' });
    }
  }
);

/**
 * PUT /api/products/:slugId
 * Update a product
 */
router.put('/:slugId', requireAdmin, requirePermission('manage_products'), async (req, res) => {
  try {
    // Strip protected fields
    const { id: _id, slug_id: _sid, created_at: _ca, ...updateData } = req.body;

    const { data: product, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('slug_id', req.params.slugId)
      .select()
      .single();

    if (error || !product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product, message: 'Product updated' });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
});

/**
 * PATCH /api/products/:slugId/toggle
 * Toggle product active status
 */
router.patch('/:slugId/toggle', requireAdmin, async (req, res) => {
  try {
    const { data: current } = await supabase
      .from('products')
      .select('is_active')
      .eq('slug_id', req.params.slugId)
      .single();

    if (!current) return res.status(404).json({ success: false, message: 'Product not found' });

    const { data: product, error } = await supabase
      .from('products')
      .update({ is_active: !current.is_active })
      .eq('slug_id', req.params.slugId)
      .select()
      .single();

    if (error) throw error;
    res.json({
      success: true,
      data: product,
      message: `Product ${product.is_active ? 'activated' : 'deactivated'}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/products/:slugId
 * Soft delete (hide from store)
 */
router.delete('/:slugId', requireAdmin, requirePermission('manage_products'), async (req, res) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('slug_id', req.params.slugId)
      .select()
      .single();

    if (error || !product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product removed from store' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
});

/**
 * DELETE /api/products/:slugId/permanent
 * Hard delete (super admin only)
 */
router.delete('/:slugId/permanent', requireAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super admin only' });
    }
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('slug_id', req.params.slugId);

    if (error) throw error;
    res.json({ success: true, message: 'Product permanently deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
