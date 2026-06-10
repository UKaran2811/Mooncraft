import { useState, useMemo, useEffect } from 'react';
import { products } from '../data';
import ProductCard from '../components/ProductCard';
import { useRouter } from '../useRouter';
import { SlidersHorizontal, ChevronRight, RefreshCw, Sparkles } from 'lucide-react';

export default function Shop() {
  const { route, navigateTo } = useRouter();
  
  // Extract pre-set category filter if navigated to a specific category
  const initialCategory = route.type === 'shop' && route.filterCategory ? route.filterCategory : 'All';
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [priceRange, setPriceRange] = useState<number>(3000);
  const [sortBy, setSortBy] = useState<'featured' | 'lowToHigh' | 'highToLow'>('featured');

  // Keep state synced if route changes
  useEffect(() => {
    if (route.type === 'shop') {
      setActiveCategory(route.filterCategory || 'All');
    }
  }, [route]);

  // Categories list
  const categories = ['All', 'Resin Art', 'Wedding Favors', 'Festive Gifting', 'Accessories'];

  // Filter and sort products
  const processedProducts = useMemo(() => {
    let result = [...products];

    // 1. Category Filter
    if (activeCategory !== 'All') {
      result = result.filter((p) => p.category === activeCategory);
    }

    // 2. Price Filter
    result = result.filter((p) => p.price <= priceRange);

    // 3. Sorting
    if (sortBy === 'lowToHigh') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'highToLow') {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [activeCategory, priceRange, sortBy]);

  const resetFilters = () => {
    setActiveCategory('All');
    setPriceRange(3000);
    setSortBy('featured');
    navigateTo({ type: 'shop' });
  };

  return (
    <div className="w-full bg-white text-black pt-[116px] min-h-screen">
      
      {/* Page Header banner */}
      <section className="bg-neutral-50 border-b border-neutral-100 py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center gap-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase tracking-widest font-sans mb-1">
            <button onClick={() => navigateTo({ type: 'home' })} className="hover:text-black">Home</button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-black font-semibold">Catalogue</span>
          </div>
          
          <h1 className="font-sans text-2xl sm:text-3xl font-light tracking-widest uppercase text-black">
            {activeCategory === 'All' ? 'Our Curated Catalogue' : activeCategory}
          </h1>
          <p className="max-w-md text-neutral-500 font-sans font-light text-[11px] sm:text-xs tracking-wide leading-relaxed">
            Beautiful functional objects customized for sacred moments or luxury interior highlights. Handpainted margins, refined gold foliage and premium clarity.
          </p>
        </div>
      </section>

      {/* Main filter and products content container */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* Left Column: Filter panel */}
          <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-8">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <span className="text-xs font-sans uppercase font-extrabold tracking-widest text-black flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Refine Selection
              </span>
              {(activeCategory !== 'All' || priceRange < 3000 || sortBy !== 'featured') && (
                <button 
                  onClick={resetFilters}
                  className="text-[10px] font-sans font-bold tracking-widest text-neutral-400 hover:text-black flex items-center gap-1 uppercase bg-transparent border-0 cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  Clear All
                </button>
              )}
            </div>

            {/* Category selection */}
            <div className="flex flex-col gap-3 font-sans">
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-black">Category</h4>
              <div className="flex flex-row lg:flex-col flex-wrap gap-2 lg:gap-1.5 mt-1.5">
                {categories.map((cat) => (
                  <button
                    id={`shop-filter-${cat.replace(/\s+/g, '-').toLowerCase()}`}
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      navigateTo({ type: 'shop', filterCategory: cat === 'All' ? undefined : cat });
                    }}
                    className={`text-left px-3 py-1.5 lg:px-0 lg:py-1 text-[11px] uppercase tracking-wider font-semibold border lg:border-none transition-colors cursor-pointer rounded-xs ${
                      activeCategory === cat 
                        ? 'bg-black text-white lg:bg-transparent lg:text-black lg:font-bold' 
                        : 'bg-transparent text-neutral-400 border-neutral-200 hover:text-black hover:border-neutral-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Price slider */}
            <div className="flex flex-col gap-3 font-sans">
              <div className="flex justify-between items-center text-black">
                <h4 className="text-[10px] uppercase font-bold tracking-widest">Max Price</h4>
                <span className="text-xs font-mono font-semibold">₹{priceRange.toLocaleString('en-IN')}</span>
              </div>
              <input 
                id="price-range-slider"
                type="range"
                min="20"
                max="3000"
                step="50"
                value={priceRange}
                onChange={(e) => setPriceRange(Number(e.target.value))}
                className="w-full accent-black bg-neutral-100 h-1 rounded-sm appearance-none outline-hidden cursor-pointer"
              />
              <div className="flex justify-between font-mono text-[9px] text-neutral-400">
                <span>₹20</span>
                <span>₹3,000</span>
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex flex-col gap-3 font-sans">
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-black">Sort Order</h4>
              <select
                id="shop-sort-dropdown"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-white border border-neutral-200 rounded p-2 text-xs uppercase tracking-wider font-semibold focus:outline-hidden focus:border-black font-sans cursor-pointer"
              >
                <option value="featured">Featured Collection</option>
                <option value="lowToHigh">Price: Low to High</option>
                <option value="highToLow">Price: High to Low</option>
              </select>
            </div>

            {/* Aesthetic Callout */}
            <div className="hidden lg:flex flex-col gap-4 border border-neutral-100 p-4 rounded bg-neutral-50/50 mt-4">
              <div className="flex items-center gap-1 text-black font-sans font-bold text-[10px] uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                Preservation Orders
              </div>
              <p className="text-[10px] text-neutral-500 font-sans leading-relaxed">
                Want to cast your actual wedding garland, wedding invitations, baby keepsake garments or dried anniversary bouquets? Contact our team in the chat or email to arrange local pickup.
              </p>
            </div>
          </aside>

          {/* Right Column: Grid of matching products */}
          <main className="flex-1 flex flex-col gap-8">
            <div className="flex items-center justify-between text-neutral-400 font-sans text-[11px] uppercase tracking-wider font-medium">
              <span>Displaying {processedProducts.length} unique treasures</span>
              <span>Exclusive handcrafts</span>
            </div>

            {processedProducts.length === 0 ? (
              <div className="py-24 border border-dashed border-neutral-200 rounded-sm text-center flex flex-col gap-3 items-center">
                <p className="text-xs uppercase tracking-widest font-semibold text-black">No matching items found</p>
                <p className="text-[11px] text-neutral-400 max-w-xs leading-relaxed font-sans">
                  Try adjusting the price slider or choosing another category block to see our premium handcrafted designs.
                </p>
                <button 
                  onClick={resetFilters}
                  className="px-6 py-2.5 bg-black text-white hover:bg-neutral-800 text-[10px] uppercase tracking-widest font-bold mt-2"
                >
                  Reset Studio Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10 sm:gap-x-8 sm:gap-y-12">
                {processedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </main>

        </div>
      </section>

    </div>
  );
}
