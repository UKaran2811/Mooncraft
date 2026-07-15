import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Calendar, Heart, ShieldCheck, ArrowRight, Gift, Star, Palette, MapPin } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import ProductCard from '../components/ProductCard';
import CategoryMarquee from '../components/CategoryMarquee';
import { useRouter } from '../useRouter';

export default function Home() {
  const { navigateTo } = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Resin Art' | 'Wedding Favors' | 'Festive Gifting' | 'Accessories'>('All');

  // Fetch from backend (falls back to static data if backend is offline)
  const { products } = useProducts();

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'All') return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [selectedCategory, products]);

  return (
    <div className="w-full bg-white text-black pt-[116px]">
      
      {/* A. Hero Section (New Carousel Layout) */}
      <section className="relative w-full overflow-hidden bg-[#e8e8e8] pt-16 pb-0 flex flex-col items-center">
        <div className="text-center mb-10 relative z-10 flex flex-col items-center mt-8">
          <span className="text-sm tracking-widest text-zinc-600 font-sans uppercase font-medium mb-2 block">All New</span>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif italic font-bold text-[#444444] mb-3 tracking-tight">GIFT SOLUTION</h1>
          <span className="text-sm tracking-[0.4em] text-zinc-600 font-sans uppercase font-medium block">Under One Roof</span>
        </div>

        {/* Infinite Auto-scrolling Carousel */}
        <div className="w-full relative overflow-hidden mt-6">
          <div className="flex animate-marquee whitespace-nowrap items-end">
            {/* Duplicate products multiple times to make it seamless */}
            {[...products, ...products, ...products].map((product, idx) => (
               <div key={idx} className="inline-block mx-2 relative w-[180px] h-[220px] sm:w-[220px] sm:h-[280px] shrink-0 overflow-hidden rounded-t-[2.5rem] rounded-b-xl shadow-lg transform transition-transform hover:-translate-y-2">
                 <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
               </div>
            ))}
          </div>
        </div>
      </section>

      {/* A.2 Statistics Banner (Top) */}
      <section className="bg-neutral-50 border-b border-zinc-100 py-16 md:py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 md:gap-8 text-center md:divide-x divide-zinc-200">
            
            {/* Stat Item 1 */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 mb-4 bg-zinc-100/80 border border-zinc-200 rounded-full flex items-center justify-center text-zinc-800">
                <Gift className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="text-3xl sm:text-4xl font-serif text-black font-light mb-2">10,000+</div>
              <div className="text-[9px] sm:text-[10px] uppercase font-sans text-neutral-500 tracking-[0.25em] font-bold">Orders Delivered</div>
            </div>

            {/* Stat Item 2 */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 mb-4 bg-zinc-100/80 border border-zinc-200 rounded-full flex items-center justify-center text-zinc-800">
                <Star className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="text-3xl sm:text-4xl font-serif text-black font-light mb-2">5,000+</div>
              <div className="text-[9px] sm:text-[10px] uppercase font-sans text-neutral-500 tracking-[0.25em] font-bold">Happy Customers</div>
            </div>

            {/* Stat Item 3 */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 mb-4 bg-zinc-100/80 border border-zinc-200 rounded-full flex items-center justify-center text-zinc-800">
                <Palette className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="text-3xl sm:text-4xl font-serif text-black font-light mb-2">50+</div>
              <div className="text-[9px] sm:text-[10px] uppercase font-sans text-neutral-500 tracking-[0.25em] font-bold">Unique Designs</div>
            </div>

            {/* Stat Item 4 */}
            <div className="flex flex-col items-center justify-center">
              <div className="w-12 h-12 mb-4 bg-zinc-100/80 border border-zinc-200 rounded-full flex items-center justify-center text-zinc-800">
                <MapPin className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="text-3xl sm:text-4xl font-serif text-black font-light mb-2">25+</div>
              <div className="text-[9px] sm:text-[10px] uppercase font-sans text-neutral-500 tracking-[0.25em] font-bold">Cities Reached</div>
            </div>

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
            
            {/* Left side: Image */}
            <div className="lg:col-span-5 relative">
              <div className="overflow-hidden rounded-[2rem] rounded-bl-[8rem] rounded-tr-[8rem] aspect-[4/5] shadow-lg relative z-10">
                <img 
                  src="/images/creator_portrait.png" 
                  alt="Moniyal Artineering" 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-1000"
                />
              </div>
              {/* Decorative elements behind image */}
              <div className="absolute -inset-4 bg-zinc-200/50 rounded-[2.5rem] rounded-bl-[8.5rem] rounded-tr-[8.5rem] z-0 -rotate-3 blur-[2px]"></div>
            </div>

            {/* Right side: Our Story */}
            <div className="lg:col-span-7 flex flex-col gap-6 lg:pl-10 text-left">
              <span className="text-[10px] font-sans font-extrabold tracking-[0.25em] text-neutral-400 uppercase">
                Our Story
              </span>
              <h2 className="font-sans text-2xl sm:text-3xl lg:text-4xl font-light tracking-wide text-black leading-tight">
                Hi, I’m the creator behind Moon Craft <br/>
                <span className="italic font-serif text-zinc-500">by Moniyal Artineering.</span>
              </h2>
              <div className="flex flex-col gap-4 text-sm text-neutral-600 font-sans leading-relaxed">
                <p>
                  <span className="font-medium text-black">Since 2015</span>, every piece you discover here is thoughtfully designed and handcrafted in our studio with passion, precision, and creativity. We believe that art is more than decoration—it’s a way to preserve memories, celebrate milestones, and bring meaningful beauty into everyday life.
                </p>
                <p>
                  From custom resin keepsakes and wedding flower preservation to personalized home décor and handcrafted art pieces, each creation is carefully made to tell a unique story. Every layer, detail, and finish reflects our commitment to quality craftsmanship and timeless design.
                </p>
                <p>
                  At Moon Craft, we don’t just create products—we transform moments into lasting memories that can be cherished for years to come.
                </p>
                <p className="font-medium text-black mt-2">
                  Thank you for supporting handmade art and allowing us to be a part of your special moments.
                </p>
                <p className="italic font-serif text-lg text-zinc-800 mt-4">
                  — With love, from Moon Craft
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* C.2 Current Trending Section */}
      <section className="py-20 bg-[#faf9f8] border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 flex flex-col items-center gap-2">
            <span className="text-[10px] font-sans font-extrabold tracking-[0.25em] uppercase text-amber-700/80">Premium Collection</span>
            <h2 className="font-serif text-3xl sm:text-4xl italic text-black">Current Trending</h2>
            <div className="w-12 h-px bg-amber-700/30 mt-4"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {products
              .filter(p => p.price >= 2000)
              .slice(0, 3)
              .map(product => (
                <div key={product.id + '-trending'} className="transform transition duration-500 hover:-translate-y-2">
                  <ProductCard product={product} />
                </div>
            ))}
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

      {/* E. Instagram Embed Section */}
      <section className="py-24 bg-white relative overflow-hidden flex flex-col items-center justify-center border-t border-zinc-100">
        {/* Subtle radial burst background effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(236,72,153,0.05)_0%,rgba(255,255,255,0)_70%)] pointer-events-none"></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-conic-gradient(from 0deg, transparent 0deg 10deg, #000 10deg 11deg)' }}></div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-sans font-semibold text-pink-600 mb-10 text-center tracking-wide">
            Don't miss out! Follow us on Instagram for exclusive updates!
          </h2>
          
          <div className="w-full max-w-[800px] bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-2 sm:p-4 transition-transform hover:scale-[1.01] duration-500 relative z-20">
            <section className="s_instagram_page o_colored_level" data-instagram-page="moon_craft_by_moniyal" data-snippet="s_instagram_page" data-name="Instagram Page">
                <div className="o_instagram_container o_not_editable o_container_small w-full" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                    <iframe scrolling="no" aria-label="Instagram" className="w-full max-w-full" height="683" src="https://www.instagram.com/moon_craft_by_moniyal/embed" style={{ border: 'none', overflow: 'hidden', width: '100%' }}></iframe>
                </div>
            </section>
          </div>
          
          <a 
            href="https://www.instagram.com/moon_craft_by_moniyal?igsh=MTdhZWhocGg3a3Bpdg%3D%3D&utm_source=qr" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-8 px-8 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full font-semibold tracking-wider text-xs sm:text-sm shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 hover:-translate-y-0.5 transition-all relative z-20"
          >
            Follow @moon_craft_by_moniyal
          </a>
        </div>
      </section>

    </div>
  );
}
