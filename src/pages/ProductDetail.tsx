import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronDown, Plus, Minus, ShoppingBag, ShieldCheck, Truck, RefreshCcw } from 'lucide-react';
import { useProduct, useProducts } from '../hooks/useProducts';
import { useCartStore } from '../useCartStore';
import { useRouter } from '../useRouter';
import ProductCard from '../components/ProductCard';

export default function ProductDetail() {
  const { route, navigateTo } = useRouter();
  const { addItem } = useCartStore();

  // Find routing product ID
  const productId = route.type === 'product' ? route.id : '';

  // Fetch this product from backend (falls back to static data)
  const { product: fetchedProduct, loading: productLoading } = useProduct(productId);
  // Fetch all products for related recommendations
  const { products: allProducts } = useProducts();

  // Use fetched product, with a safe placeholder while loading
  const product = fetchedProduct;

  const [quantity, setQuantity] = useState<number>(1);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [activeAccordion, setActiveAccordion] = useState<'desc' | 'materials' | 'care' | null>('desc');

  // Sync state when product changes
  useEffect(() => {
    if (product) {
      setSelectedImage(product.image);
      setQuantity(1);
    }
  }, [product]);

  const handleAddToCart = () => {
    if (!product) return;
    for (let i = 0; i < quantity; i++) {
      addItem(product);
    }
  };

  const handleThumbnailClick = (img: string) => {
    setSelectedImage(img);
  };

  const toggleAccordion = (section: 'desc' | 'materials' | 'care') => {
    setActiveAccordion((prev) => (prev === section ? null : section));
  };

  // Recommendations: products from same category, excluding current product
  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return allProducts
      .filter((p) => p.category === product.category && p.id !== product.id)
      .slice(0, 4);
  }, [product, allProducts]);

  // Loading skeleton
  if (productLoading || !product) {
    return (
      <div className="w-full bg-white text-black pt-[116px] min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 animate-pulse">
            <div className="lg:col-span-7 aspect-[4/5] bg-neutral-100 rounded" />
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="h-3 bg-neutral-100 rounded w-1/3" />
              <div className="h-6 bg-neutral-100 rounded w-2/3" />
              <div className="h-5 bg-neutral-100 rounded w-1/4" />
              <div className="h-24 bg-neutral-100 rounded mt-4" />
              <div className="h-11 bg-neutral-100 rounded mt-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white text-black pt-[116px] min-h-screen">
      
      {/* Dynamic Breadcrumbs */}
      <section className="bg-neutral-50/50 border-b border-neutral-100 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase tracking-widest font-sans">
            <button onClick={() => navigateTo({ type: 'home' })} className="hover:text-black transition-colors">Home</button>
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => navigateTo({ type: 'shop', filterCategory: product.category })} className="hover:text-black transition-colors">{product.category}</button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-black font-semibold truncate max-w-[200px]">{product.name}</span>
          </div>
        </div>
      </section>

      {/* Main Grid View */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          
          {/* Left Column: Image Gallery with thumbnail sidebar on Desktop */}
          <div className="lg:col-span-7 flex flex-col md:flex-row gap-4">
            
            {/* Vertical thumbnails strip (Left side of large image) */}
            <div className="order-2 md:order-1 flex flex-row md:flex-col gap-2.5 overflow-x-auto md:overflow-x-visible shrink-0">
              {product.gallery.map((img, i) => (
                <button
                  id={`thumbs-img-${i}`}
                  key={i}
                  onClick={() => handleThumbnailClick(img)}
                  className={`w-14 h-18 sm:w-16 sm:h-20 shrink-0 rounded overflow-hidden border transition-all cursor-pointer bg-neutral-50`}
                  style={{ borderColor: selectedImage === img ? '#000000' : '#E5E7EB' }}
                >
                  <img
                    src={img}
                    alt={`${product.name} thumbnail ${i}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = product.fallbackImage;
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Large primary presentation image */}
            <div className="order-1 md:order-2 flex-1 aspect-4/5 rounded bg-neutral-50 overflow-hidden relative border border-neutral-100">
              <AnimatePresence mode="wait">
                <motion.img
                  key={selectedImage}
                  src={selectedImage}
                  alt={product.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to high-res Unsplash block
                    (e.target as HTMLImageElement).src = product.fallbackImage;
                  }}
                />
              </AnimatePresence>
              <div className="absolute top-3 left-3 bg-black text-white text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-sm">
                100% Handcrafted
              </div>
            </div>

          </div>

          {/* Right Column: Sticky Product info pane */}
          <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-[160px] h-fit">
            
            {/* Core Header */}
            <div className="flex flex-col gap-1 text-left">
              <span className="text-[10px] font-sans font-extrabold tracking-[0.25em] uppercase text-neutral-400">
                {product.category}
              </span>
              <h1 className="font-sans text-xl sm:text-2xl font-light tracking-widest uppercase text-black">
                {product.name}
              </h1>
              <p className="font-mono text-lg sm:text-xl font-bold mt-1 text-neutral-900 leading-none">
                ₹{product.price.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-neutral-400 italic mt-1 font-sans">
                Tax included. Shipping calculated at checkout. Standard preservation takes 2-3 weeks to cure.
              </p>
            </div>

            {/* Gifting details banner */}
            <div className="border border-dashed border-neutral-200 rounded p-4 bg-neutral-50/50">
              <span className="text-[9px] font-sans font-bold uppercase tracking-widest text-neutral-400">Atelier Guarantee</span>
              <p className="text-[10px] text-neutral-600 mt-1 font-sans leading-relaxed">
                Want to personalize with raw initials, specific flowers, gold/silver foil trims or specialized dates? Send us an inquiry. Custom adjustments are integrated seamlessly!
              </p>
            </div>

            {/* Actions: Quantity + Add To Cart */}
            <div className="flex flex-col gap-3 font-sans">
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Quantity</span>
              <div className="flex items-center gap-4">
                {/* Quantity selector */}
                <div className="flex items-center border border-neutral-300 h-11">
                  <button
                    id="pdp-dec-qty-btn"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                    className="px-3.5 h-full text-neutral-500 hover:text-black flex items-center justify-center cursor-pointer"
                    aria-label="Decrease"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-4 text-xs font-mono font-bold text-black">{quantity}</span>
                  <button
                    id="pdp-inc-qty-btn"
                    onClick={() => setQuantity((prev) => prev + 1)}
                    className="px-3.5 h-full text-neutral-500 hover:text-black flex items-center justify-center cursor-pointer"
                    aria-label="Increase"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Add to Cart button */}
                <button
                  id="pdp-add-to-cart-btn"
                  onClick={handleAddToCart}
                  className="flex-1 bg-black text-white hover:bg-neutral-800 h-11 text-xs tracking-widest font-bold uppercase transition-all duration-200 rounded-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Add To Cart
                </button>
              </div>
            </div>

            {/* Accordion List for details */}
            <div className="flex flex-col border-t border-neutral-100 mt-2">
              
              {/* Product description */}
              <div className="border-b border-neutral-100 py-3.5">
                <button
                  id="accordion-description-btn"
                  onClick={() => toggleAccordion('desc')}
                  className="w-full flex justify-between items-center text-xs font-sans font-bold uppercase tracking-widest text-black cursor-pointer text-left"
                >
                  <span>Product Description</span>
                  <ChevronDown className="w-4 h-4 text-neutral-500 transition-transform" style={{ transform: activeAccordion === 'desc' ? 'rotate(180deg)' : 'scale(1)' }} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${activeAccordion === 'desc' ? 'max-h-[300px] mt-2' : 'max-h-0'}`}>
                  <p className="text-[11px] sm:text-xs text-neutral-600 font-sans leading-relaxed bg-neutral-50/50 p-2.5 rounded-xs">
                    {product.description}
                  </p>
                </div>
              </div>

              {/* Materials Used */}
              <div className="border-b border-neutral-100 py-3.5">
                <button
                  id="accordion-materials-btn"
                  onClick={() => toggleAccordion('materials')}
                  className="w-full flex justify-between items-center text-xs font-sans font-bold uppercase tracking-widest text-black cursor-pointer text-left"
                >
                  <span>Materials Used</span>
                  <ChevronDown className="w-4 h-4 text-neutral-500 transition-transform" style={{ transform: activeAccordion === 'materials' ? 'rotate(180deg)' : 'scale(1)' }} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${activeAccordion === 'materials' ? 'max-h-[300px] mt-2' : 'max-h-0'}`}>
                  <p className="text-[11px] sm:text-xs text-neutral-600 font-sans leading-relaxed bg-neutral-50/50 p-2.5 rounded-xs">
                    {product.materials}
                  </p>
                </div>
              </div>

              {/* Care Instructions */}
              <div className="border-b border-neutral-100 py-3.5">
                <button
                  id="accordion-care-btn"
                  onClick={() => toggleAccordion('care')}
                  className="w-full flex justify-between items-center text-xs font-sans font-bold uppercase tracking-widest text-black cursor-pointer text-left"
                >
                  <span>Care Instructions</span>
                  <ChevronDown className="w-4 h-4 text-neutral-500 transition-transform" style={{ transform: activeAccordion === 'care' ? 'rotate(180deg)' : 'scale(1)' }} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${activeAccordion === 'care' ? 'max-h-[300px] mt-2' : 'max-h-0'}`}>
                  <p className="text-[11px] sm:text-xs text-neutral-600 font-sans leading-relaxed bg-neutral-50/50 p-2.5 rounded-xs">
                    {product.careInstructions}
                  </p>
                </div>
              </div>

            </div>

            {/* Studio shipping benefits banner */}
            <div className="grid grid-cols-3 gap-2.5 text-center pt-2">
              <div className="flex flex-col items-center gap-1">
                <Truck className="w-4 h-4 text-neutral-700" />
                <span className="text-[9px] font-sans font-semibold uppercase text-black">Fast Shipping</span>
                <span className="text-[8px] text-neutral-400">Insured express delivery</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-neutral-700" />
                <span className="text-[9px] font-sans font-semibold uppercase text-black">Safe Delivery</span>
                <span className="text-[8px] text-neutral-400">Fully padded wooden crates</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <RefreshCcw className="w-4 h-4 text-neutral-700" />
                <span className="text-[9px] font-sans font-semibold uppercase text-black">No Fogging promise</span>
                <span className="text-[8px] text-neutral-400 font-serif italic">Pure botanical clarity</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Related Products Grid */}
      {relatedProducts.length > 0 && (
        <section className="bg-neutral-50 border-t border-neutral-100 py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-1 text-center mb-10">
              <span className="text-[10px] font-sans font-extrabold tracking-[0.25em] uppercase text-neutral-400">Atelier Recommendations</span>
              <h2 className="font-sans text-lg sm:text-xl font-light tracking-widest uppercase text-black">Related Creasions</h2>
              <div className="w-8 h-[1px] bg-neutral-300 mx-auto mt-2"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
