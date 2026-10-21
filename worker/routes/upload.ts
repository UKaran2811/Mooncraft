/**
 * Upload routes — Hono (Workers-compatible).
 * Mirrors backend/routes/upload.js, but stores images in Cloudflare R2.
 * Requires the `UPLOADS` R2 bucket binding.
 */
import { Hono } from 'hono';
import { requireAdmin } from '../middleware/auth';
import { randomBytes } from '../utils/crypto';

const router = new Hono<{ Bindings: Env }>();

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function extensionFrom(filename: string): string {
  const name = String(filename || '').toLowerCase();
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx) : '';
}

router.post('/image', requireAdmin, async (c) => {
  const bucket = c.env.UPLOADS;
  if (!bucket) {
    return c.json({ success: false, message: 'Storage (R2) not configured on this environment' }, 500);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get('image');

    if (!file || typeof file === 'string') {
      return c.json({ success: false, message: 'No file provided' }, 400);
    }

    const ext = extensionFrom(file.name);
    if (!ALLOWED_EXT.includes(ext)) {
      return c.json({ success: false, message: 'Only jpg, jpeg, png, webp, gif files are allowed' }, 400);
    }
    if (file.size > MAX_SIZE) {
      return c.json({ success: false, message: 'File too large (max 5MB)' }, 400);
    }

    const name = bytesToHex(randomBytes(12));
    const key = `products/${name}${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    await bucket.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    });

    const baseUrl = c.env.R2_PUBLIC_URL || (c.env.APP_URL ? `${c.env.APP_URL}/uploads` : '');
    const url = baseUrl ? `${baseUrl}/${key}` : key;

    return c.json({
      success: true,
      url,
      key,
      message: 'Image uploaded',
    }, 201);
  } catch (err: any) {
    console.error('Upload error:', err.message);
    return c.json({ success: false, message: 'Upload failed' }, 500);
  }
});

export default router;