/**
 * src/hooks/useProducts.ts
 *
 * React hook that fetches products from the backend API and
 * falls back to the static data.ts array when the API is
 * unavailable (no .env configured, dev without backend running, etc.).
 *
 * Usage:
 *   const { products, loading, error } = useProducts();
 *   const { products, loading, error } = useProducts({ category: 'Resin Art' });
 */

import { useState, useEffect } from 'react';
import { products as staticProducts } from '../data';
import { productsAPI } from '../services/api';
import type { Product } from '../types';

interface UseProductsOptions {
  category?: string;
  search?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
  limit?: number;
}

interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  total: number;
  /** true when using the static fallback (backend not reachable) */
  isOffline: boolean;
}

/**
 * Map a raw Supabase product row → frontend Product shape.
 * The DB uses snake_case; frontend types use camelCase.
 */
function mapDbProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.slug_id ?? row.id ?? ''),
    name: String(row.name ?? ''),
    price: Number(row.price ?? 0),
    image: String(row.image ?? ''),
    fallbackImage: String(row.fallback_image ?? row.image ?? ''),
    description: String(row.description ?? ''),
    materials: String(row.materials ?? ''),
    careInstructions: String(row.care_instructions ?? ''),
    category: row.category as Product['category'],
    gallery: Array.isArray(row.gallery) ? (row.gallery as string[]) : [],
    stock: Number(row.stock ?? 0),
    isActive: row.is_active === true || row.is_active === 'true',
    isFeatured: row.is_featured === true || row.is_featured === 'true',
    totalSold: Number(row.total_sold ?? 0),
    createdAt: String(row.created_at ?? ''),
  };
}

export function useProducts(options: UseProductsOptions = {}): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params: Record<string, string> = {};
    if (options.category) params.category = options.category;
    if (options.search)   params.search   = options.search;
    if (options.sort)     params.sort     = options.sort;
    if (options.limit)    params.limit    = String(options.limit);

    productsAPI
      .getAll(Object.keys(params).length ? params : undefined)
      .then((res) => {
        if (cancelled) return;
        const rows: Product[] = (res.data || []).map(mapDbProduct);
        setProducts(rows);
        setTotal(res.pagination?.total ?? rows.length);
        setIsOffline(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Backend not reachable — use static data as fallback
        console.warn('⚠️ Backend not reachable — using static product data');
        let fallback = [...staticProducts];
        if (options.category) {
          fallback = fallback.filter((p) => p.category === options.category);
        }
        if (options.search) {
          const q = options.search.toLowerCase();
          fallback = fallback.filter((p) => p.name.toLowerCase().includes(q));
        }
        setProducts(fallback);
        setTotal(fallback.length);
        setIsOffline(true);
        setError(null); // Silently fall back — don't show error to customers
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  // Stringify options so the effect only re-runs when values actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.category, options.search, options.sort, options.limit]);

  return { products, loading, error, total, isOffline };
}

/**
 * Fetch a single product by its slug ID.
 * Falls back to static data if the backend is unavailable.
 */
export function useProduct(slugId: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    productsAPI
      .getOne(slugId)
      .then((res) => {
        if (cancelled) return;
        setProduct(mapDbProduct(res.data));
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to static data
        const found = staticProducts.find((p) => p.id === slugId) ?? staticProducts[0];
        setProduct(found);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slugId]);

  return { product, loading, error };
}
