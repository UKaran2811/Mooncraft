import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, User, ShoppingBag, Menu, X, ArrowLeft } from 'lucide-react';
import { useCartStore } from '../useCartStore';
import { useRouter } from '../useRouter';
import { useAuthStore } from '../useAuthStore';
import { products } from '../data';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const { items, openCart, searchOpen, setSearchOpen, searchQuery, setSearchQuery } = useCartStore();
  const { navigateTo } = useRouter();
  const user = useAuthStore((s) => s.user);

  // Scroll handler for transparent-to-solid transition
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const announcements = [
    "FREE SHIPPING ON CUSTOM WEDDING ORDERS",
    "HANDCRAFTED WITH LOVE • 100% ETHICAL ARTISANS",
    "CUSTOMIZE YOUR PRESERVED MEMORIES • ORDER SAMPLES"
  ];
  const [currentAnnouncementIdx, setCurrentAnnouncementIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAnnouncementIdx((prev) => (prev + 1) % announcements.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleMenuClick = (category?: string) => {
    setMobileMenuOpen(false);
    if (category) {
      if (category === 'Contact') {
        // Scroll to contact form in footer
        const footer = document.getElementById('contact-section');
        if (footer) {
          footer.scrollIntoView({ behavior: 'smooth' });
        } else {
          navigateTo({ type: 'home' });
          setTimeout(() => {
            document.getElementById('contact-section')?.scrollIntoView({ behavior: 'smooth' });
          }, 300);
        }
      } else {
        navigateTo({ type: 'shop', filterCategory: category });
      }
    } else {
      navigateTo({ type: 'shop' });
    }
  };

  // Live search filtering
  const filteredProducts = searchQuery.trim() === ''
    ? []
    : products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.category.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5);

  return (
    <>
      {/* Sticky Combined Header */}
      <div className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
        
        {/* Announcement Bar */}
        <div className="w-full bg-black text-white h-9 flex items-center justify-center overflow-hidden border-b border-neutral-900">
          <div className="h-full relative w-full max-w-lg flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentAnnouncementIdx}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="text-[10px] sm:text-[11px] font-sans font-medium tracking-widest uppercase text-center absolute px-2 text-neutral-200"
              >
                {announcements[currentAnnouncementIdx]}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Main Navigation Bar */}
        <header 
          className={`w-full transition-all duration-300 border-b ${
            isScrolled 
              ? 'bg-white/95 backdrop-blur-md border-neutral-100 py-3 shadow-xs' 
              : 'bg-transparent border-transparent py-5'
          }`}
          id="main-nav"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            
            {/* Desktop / Mobile Left: Custom Navigation Pages */}
            <div className="flex items-center flex-1">
              {/* Mobile menu trigger */}
              <button 
                id="mobile-menu-btn"
                onClick={() => setMobileMenuOpen(true)}
                className="p-1 -ml-1 text-black cursor-pointer lg:hidden"
                aria-label="Open Menu"
              >
                <Menu className="w-5 h-5 stroke-[1.5]" />
              </button>

              {/* Desktop links */}
              <nav className="hidden lg:flex items-center space-x-8">
                <button 
                  id="nav-link-shop"
                  onClick={() => handleMenuClick()}
                  className="text-xs font-sans tracking-widest text-black hover:text-neutral-500 uppercase font-medium transition-colors cursor-pointer"
                >
                  Shop
                </button>
                <button 
                  id="nav-link-resin"
                  onClick={() => handleMenuClick("Resin Art")}
                  className="text-xs font-sans tracking-widest text-black hover:text-neutral-500 uppercase font-medium transition-colors cursor-pointer"
                >
                  Resin Art
                </button>
                <button 
                  id="nav-link-wedding"
                  onClick={() => handleMenuClick("Wedding Favors")}
                  className="text-xs font-sans tracking-widest text-black hover:text-neutral-500 uppercase font-medium transition-colors cursor-pointer"
                >
                  Wedding
                </button>
                <button 
                  id="nav-link-contact"
                  onClick={() => handleMenuClick("Contact")}
                  className="text-xs font-sans tracking-widest text-black hover:text-neutral-500 uppercase font-medium transition-colors cursor-pointer"
                >
                  Contact
                </button>
              </nav>
            </div>

            {/* Center: Brand Serif Wordmark */}
            <div className="flex justify-center flex-1 text-center">
              <button 
                id="logo-btn"
                onClick={() => navigateTo({ type: 'home' })}
                className="font-serif text-2xl sm:text-3xl tracking-[0.3em] uppercase italic text-zinc-900 hover:opacity-80 transition-opacity cursor-pointer inline-block"
              >
                Mooncraft
              </button>
            </div>

            {/* Right Group: Icons & Cart Bubble */}
            <div className="flex items-center justify-end flex-grow space-x-4 sm:space-x-5 flex-1">
              <button 
                id="search-trigger-btn"
                onClick={() => setSearchOpen(true)}
                className="p-1 text-black hover:text-neutral-500 transition-colors cursor-pointer"
                aria-label="Search Collection"
              >
                <Search className="w-4 h-4 sm:w-[18px] sm:h-[18px] stroke-[1.5]" />
              </button>
              
              <button 
                id="profile-btn"
                onClick={() => navigateTo({ type: 'my-orders' })}
                className="p-1 text-black hover:text-neutral-500 transition-colors cursor-pointer hidden sm:block"
                aria-label={user ? 'My Orders' : 'Account'}
              >
                <User className="w-4 h-4 sm:w-[18px] sm:h-[18px] stroke-[1.5]" />
              </button>

              <button 
                id="cart-trigger-btn"
                onClick={openCart}
                className="relative p-1 text-black hover:text-neutral-500 transition-colors cursor-pointer"
                aria-label="View Cart"
              >
                <ShoppingBag className="w-4 h-4 sm:w-[18px] sm:h-[18px] stroke-[1.5]" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-black text-white font-mono text-[9px] w-4 h-4 flex items-center justify-center rounded-full leading-none scale-90">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>

          </div>
        </header>
      </div>

      {/* Floating search drawer overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[100] flex flex-col justify-start"
          >
            <motion.div 
              initial={{ y: -50 }}
              animate={{ y: 0 }}
              exit={{ y: -50 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white border-b border-neutral-100 px-4 py-6 sm:py-8 shadow-md"
            >
              <div className="max-w-3xl mx-auto flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-sans font-semibold tracking-widest uppercase text-neutral-400">Search the Boutique</span>
                  <button 
                    id="close-search-btn"
                    onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                    className="p-1 hover:bg-neutral-50 rounded-full"
                    aria-label="Close search"
                  >
                    <X className="w-4 h-4 text-black" />
                  </button>
                </div>
                
                <div className="relative border-b border-black py-2">
                  <input 
                    id="search-input-box"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search frames, customized pooja trays, varmala lamps..."
                    autoFocus
                    className="w-full bg-transparent text-sm sm:text-base text-black placeholder-neutral-400 focus:outline-hidden font-sans tracking-wide pr-8"
                  />
                  <Search className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                </div>

                {/* Quick results preview */}
                <div className="flex flex-col">
                  {filteredProducts.length > 0 ? (
                    <div className="flex flex-col gap-3 mt-2 pr-2 max-h-[300px] overflow-y-auto">
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-neutral-400">Products</p>
                      {filteredProducts.map((p) => (
                        <div 
                          key={p.id}
                          className="flex items-center justify-between cursor-pointer group hover:bg-neutral-50/50 p-1.5 rounded transition-colors"
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery('');
                            navigateTo({ type: 'product', id: p.id });
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <img 
                              src={p.image} 
                              alt={p.name}
                              className="w-10 h-12 object-cover rounded bg-neutral-100"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = p.fallbackImage;
                              }}
                            />
                            <div>
                              <p className="text-xs uppercase tracking-wider font-medium text-black group-hover:text-neutral-500 transition-colors">{p.name}</p>
                              <p className="text-[10px] text-neutral-400 italic font-medium">{p.category}</p>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-medium text-black">₹{p.price.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  ) : searchQuery.trim() !== '' ? (
                    <p className="text-xs text-neutral-400 mt-2">No matching products found. Try "frame", "clock", "pooja" or "rakhi".</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-widest mr-2 self-center">Trending:</span>
                      {["Resin Photo Frame", "Wall Clock", "Varmala Night Lamp", "Pooja Tray"].map((term) => (
                        <button 
                          key={term}
                          onClick={() => setSearchQuery(term)}
                          className="px-3 py-1 bg-neutral-50 border border-neutral-100 rounded text-[11px] font-sans tracking-wide text-neutral-600 hover:bg-neutral-100 transition-colors uppercase"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer Navigation Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute top-0 bottom-0 left-0 w-[80%] max-w-[360px] bg-white p-6 shadow-2xl flex flex-col gap-8"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <span className="font-sans font-extrabold tracking-[0.2em] text-black">MOONCRAFT</span>
                <button 
                  id="close-mobile-menu"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 hover:bg-neutral-100 rounded-full cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4 text-black" />
                </button>
              </div>

              <div className="flex flex-col gap-6 font-sans">
                <p className="text-[9px] uppercase tracking-[0.25em] font-bold text-neutral-400">Navigation</p>
                <button 
                  id="mobile-nav-shop"
                  onClick={() => handleMenuClick()}
                  className="text-left py-2 text-sm uppercase tracking-widest font-semibold border-b border-neutral-50 hover:text-neutral-500 cursor-pointer"
                >
                  Shop Custom Collection
                </button>
                <button 
                  id="mobile-nav-resin"
                  onClick={() => handleMenuClick("Resin Art")}
                  className="text-left py-2 text-sm uppercase tracking-widest font-semibold border-b border-neutral-50 hover:text-neutral-500 cursor-pointer"
                >
                  Custom Resin Art
                </button>
                <button 
                  id="mobile-nav-wedding"
                  onClick={() => handleMenuClick("Wedding Favors")}
                  className="text-left py-2 text-sm uppercase tracking-widest font-semibold border-b border-neutral-50 hover:text-neutral-500 cursor-pointer"
                >
                  Wedding Keepsakes
                </button>
                <button 
                  id="mobile-nav-contact"
                  onClick={() => handleMenuClick("Contact")}
                  className="text-left py-2 text-sm uppercase tracking-widest font-semibold border-b border-neutral-50 hover:text-neutral-500 cursor-pointer"
                >
                  Connect & Inquire
                </button>
              </div>

              <div className="mt-auto border-t border-neutral-100 pt-6 flex flex-col gap-3">
                <p className="text-[9px] uppercase tracking-widest text-neutral-400">Inquiries</p>
                <p className="text-[11px] font-mono tracking-wide text-neutral-800">monika.radadiya4757@gmail.com</p>
                <p className="text-[11px] font-sans text-neutral-500 leading-relaxed">
                  Bespoke preservation requests typical timeline: 3-4 weeks.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
