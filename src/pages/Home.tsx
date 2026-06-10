import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Calendar, Heart, ShieldCheck, ArrowRight } from 'lucide-react';
import { products } from '../data';
import ProductCard from '../components/ProductCard';
import CategoryMarquee from '../components/CategoryMarquee';
import { useRouter } from '../useRouter';

export default function Home() {
  const { navigateTo } = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Resin Art' | 'Wedding Favors' | 'Festive Gifting' | 'Accessories'>('All');

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'All') return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="w-full bg-white text-black pt-[116px]">
      
      {/* A. Hero Section (Split Screen Artistic Layout) */}
      <section className="relative min-h-[550px] lg:h-[calc(100vh-116px)] w-full overflow-hidden flex flex-col lg:flex-row border-b border-zinc-100 bg-white">
        
        {/* Subtle Side Detail from Design HTML */}
        <div className="absolute left-4 bottom-40 -rotate-90 origin-left text-[9px] tracking-[0.4em] uppercase text-zinc-300 font-medium z-10 pointer-events-none hidden lg:block">
          Handcrafted in Jaipur — Est 2024
        </div>

        {/* Hero Left Content Area */}
        <div className="w-full lg:w-1/2 p-8 sm:p-16 lg:p-20 flex flex-col justify-center bg-zinc-50/50 relative z-10 border-r border-zinc-100">
          <div className="max-w-md">
            <motion.span 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4 block"
            >
              Bespoke Preservation
            </motion.span>
            
            <motion.h2 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15 }}
              className="text-4xl sm:text-5xl lg:text-5.5xl font-serif text-zinc-900 leading-tight mb-6 italic"
            >
              The Art of <br/>Eternal Flora
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-xs sm:text-sm text-zinc-600 leading-relaxed mb-8 max-w-sm"
            >
              Handcrafted resin masterpieces that capture your most cherished memories in crystal-clear permanence. Capturing wedding garlands and personal milestones.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45 }}
              className="flex flex-wrap gap-4"
            >
              <button
                id="hero-shop-all-btn"
                onClick={() => navigateTo({ type: 'shop' })}
                className="bg-black hover:bg-zinc-800 text-white px-8 py-4 text-[11px] tracking-[0.2em] uppercase font-semibold transition-all rounded-xs cursor-pointer"
              >
                Shop the Collection
              </button>
              <button
                id="hero-learn-more-btn"
                onClick={() => {
                  const element = document.getElementById('about-story');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-transparent hover:bg-zinc-100 text-zinc-950 border border-zinc-300 px-6 py-4 text-[11px] tracking-[0.2em] uppercase font-semibold transition-all rounded-xs cursor-pointer"
              >
                Our Story
              </button>
            </motion.div>
          </div>
        </div>

        {/* Hero Right Visual Column */}
        <div className="w-full lg:w-1/2 h-[350px] lg:h-full relative bg-zinc-200 overflow-hidden">
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 saturate-75 hover:scale-[1.03]"
            style={{ backgroundImage: `url('/images/hexgon photo frame, price 3000.jpeg')` }}
          ></div>
          <div className="absolute inset-0 bg-black/5"></div>
          
          <div className="absolute right-8 bottom-8 text-white/80 font-mono text-[9px] tracking-[0.35em] uppercase">
            Hexagon Photo Frame • Jaipur
          </div>
        </div>

      </section>

      {/* B. Category Marquee / Banners Section */}
      <section className="py-20 bg-white">
        <CategoryMarquee />
      </section>

      {/* C. About Story Capsule (Aesthetic & Editorial) */}
      <section id="about-story" className="py-20 bg-neutral-50 border-y border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left side: Grid of images portraying resin art creation */}
            <div className="lg:col-span-6 grid grid-cols-12 gap-4">
              <div className="col-span-8 overflow-hidden rounded-xs aspect-4/5 shadow-md">
                <img 
                  src="/images/12 inch wall clock, price 2500.jpeg" 
                  alt="Resin Pouring Close up" 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="col-span-4 flex flex-col justify-end">
                <div className="overflow-hidden rounded-xs aspect-square shadow-sm mb-4">
                  <img 
                    src="/images/varmala night lamp, price 2500.jpeg" 
                    alt="Dried Flowers Selection" 
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <div className="bg-black text-white p-4 rounded-xs">
                  <p className="font-mono text-[16px] font-bold">28</p>
                  <p className="text-[8px] tracking-wider uppercase text-neutral-400 font-sans mt-1">Days average cure cycle per luxury keepsake</p>
                </div>
              </div>
            </div>

            {/* Right side: Manifesto & Guarantees */}
            <div className="lg:col-span-6 flex flex-col gap-6 lg:pl-6 text-left">
              <span className="text-[10px] font-sans font-extrabold tracking-[0.25em] text-neutral-400 uppercase">
                Meticulous Preservation
              </span>
              <h2 className="font-sans text-2xl sm:text-3xl font-light tracking-wide uppercase text-black leading-tight">
                Crafting Crystal Clear Heirlooms
              </h2>
              <p className="text-xs text-neutral-600 font-sans leading-relaxed">
                At the Mooncraft Atelier, we utilize German optical-grade UV-resistant casting resins to capture the lush shapes and vivid color gradients of wedding garlands, floral wedding boards, and personal milestones. Our slow-curing casting method ensures a flawless bubble-free glass finish that will never fog.
              </p>

              {/* Grid of badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-neutral-200">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-black shrink-0" />
                  <div>
                    <h4 className="text-[11px] uppercase tracking-wider font-bold text-black">Zero-Yellowing resin</h4>
                    <p className="text-[10px] text-neutral-500 mt-0.5">Built with advanced UV inhibitors for crystal clarity.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-black shrink-0" />
                  <div>
                    <h4 className="text-[11px] uppercase tracking-wider font-bold text-black">Bespoke Curation</h4>
                    <p className="text-[10px] text-neutral-500 mt-0.5">Direct communication with master resin artists.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Heart className="w-5 h-5 text-black shrink-0" />
                  <div>
                    <h4 className="text-[11px] uppercase tracking-wider font-bold text-black">Hand-Pressed botanicals</h4>
                    <p className="text-[10px] text-neutral-500 mt-0.5">Seasonal flowers prepared individually for 14 days.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-black shrink-0" />
                  <div>
                    <h4 className="text-[11px] uppercase tracking-wider font-bold text-black">Gold leaf options</h4>
                    <p className="text-[10px] text-neutral-500 mt-0.5">Gilded 24k leaf accents tailored to your color scheme.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* D. Featured Product Grid & Category Filter Tabs */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
            <div className="text-center md:text-left flex flex-col gap-1">
              <span className="text-[10px] font-sans font-extrabold tracking-[0.25em] uppercase text-neutral-400">The Catalog</span>
              <h2 className="font-sans text-xl sm:text-2xl font-light tracking-widest uppercase text-black">Featured Masterpieces</h2>
              <p className="text-[11px] text-neutral-500 mt-1 max-w-sm">Handcrafted products ready for fast dispatch or customized order setups.</p>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center flex-wrap justify-center gap-1.5 border border-neutral-100 p-1.5 rounded bg-neutral-50/50">
              {(['All', 'Resin Art', 'Wedding Favors', 'Festive Gifting', 'Accessories'] as const).map((cat) => (
                <button
                  id={`filter-tab-${cat.replace(/\s+/g, '-').toLowerCase()}`}
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 text-[10px] uppercase font-bold tracking-widest rounded-xs transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-transparent text-neutral-500 hover:text-black'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards responsive Grid (1 mobile, 2 tablet, 3-4 desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10 sm:gap-x-8 sm:gap-y-12">
            {filteredProducts.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* View All Button */}
          <div className="flex justify-center mt-14">
            <button
              id="view-full-cabinet-btn"
              onClick={() => navigateTo({ type: 'shop', filterCategory: selectedCategory === 'All' ? undefined : selectedCategory })}
              className="px-8 py-3.5 bg-black text-white hover:bg-neutral-800 font-sans font-bold tracking-widest text-[11px] uppercase transition-colors rounded-sm flex items-center gap-2 cursor-pointer"
            >
              Explore Full Cabinet
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </section>

    </div>
  );
}
