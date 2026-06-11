import { useEffect } from 'react';
import Lenis from 'lenis';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter, initHashRouting } from './useRouter';
import Header from './components/Header';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';

// Lazy loading pages with smooth mounting
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Checkout from './pages/Checkout';

export default function App() {
  const { route, navigateTo } = useRouter();

  // Initialize synchronous window location hash routing
  useEffect(() => {
    const cleanup = initHashRouting(navigateTo);
    return cleanup;
  }, [navigateTo]);

  // Initialize soft scroll via Lenis
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.5,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.2,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  // Render correct page view inside smooth layout
  const renderPage = () => {
    switch (route.type) {
      case 'home':
        return <Home />;
      case 'shop':
        return <Shop />;
      case 'product':
        return <ProductDetail />;
      case 'checkout':
        return <Checkout />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="min-h-screen bg-white text-black selection:bg-neutral-900 selection:text-white flex flex-col justify-between">
      {/* 1. Global Navigation Bar & Announcement Slider */}
      <Header />

      {/* 2. Primary Page Render with Motion Layout Animations */}
      <main className="flex-1 w-full flex flex-col justify-start overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={route.type + (route.type === 'product' ? route.id : '')}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full flex-1 flex flex-col justify-start"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 3. Global Cart Split-off Slide-out Drawer */}
      <CartDrawer />

      {/* 4. Editorial Boutique Footer & Contact Inquiry Module */}
      <Footer />
    </div>
  );
}
