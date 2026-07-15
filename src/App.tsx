import { useEffect, useState } from 'react';
import Lenis from 'lenis';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter, initHashRouting } from './useRouter';
import Header from './components/Header';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';

import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Checkout from './pages/Checkout';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ResetPassword from './pages/ResetPassword';
import MyOrders from './pages/MyOrders';
import { setAdminToken } from './services/api';
import { useAuthStore } from './useAuthStore';

interface AdminUser { name: string; email: string; role: string; }

export default function App() {
  const { route, navigateTo } = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const hydrate = useAuthStore((s) => s.hydrate);

  // Hydrate customer auth (OTP session) from sessionStorage on first mount
  useEffect(() => { hydrate(); }, [hydrate]);

  // Initialize synchronous hash routing
  useEffect(() => {
    const cleanup = initHashRouting(navigateTo);
    return cleanup;
  }, [navigateTo]);

  // Smooth scroll via Lenis (only for storefront, not admin)
  useEffect(() => {
    const isAdmin = route.type === 'admin' || route.type === 'admin-login';
    if (isAdmin) return;

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
    return () => { lenis.destroy(); };
  }, [route.type]);

  const handleAdminLoginSuccess = (token: string, admin: AdminUser) => {
    setAdminToken(token);
    setAdminUser(admin);
    navigateTo({ type: 'admin' });
  };

  const handleAdminLogout = () => {
    setAdminUser(null);
    setAdminToken(null);
    navigateTo({ type: 'admin-login' });
  };

  // ── Admin routes — completely separate layout (no header/footer) ──
  if (route.type === 'admin-login') {
    return <AdminLogin onSuccess={handleAdminLoginSuccess} />;
  }

  if (route.type === 'admin') {
    if (!adminUser) {
      // Not logged in → redirect to admin login
      return <AdminLogin onSuccess={handleAdminLoginSuccess} />;
    }
    return <AdminDashboard admin={adminUser} onLogout={handleAdminLogout} />;
  }

  // ── Standalone pages (no header/footer) ───────────────────────
  if (route.type === 'reset-password') {
    return <ResetPassword token={route.token} />;
  }

  // ── Storefront routes ──────────────────────────────────────────
  const renderPage = () => {
    switch (route.type) {
      case 'home':     return <Home />;
      case 'shop':     return <Shop />;
      case 'product':  return <ProductDetail />;
      case 'checkout': return <Checkout />;
      case 'my-orders': return <MyOrders />;
      default:         return <Home />;
    }
  };

  return (
    <div className="min-h-screen bg-white text-black selection:bg-neutral-900 selection:text-white flex flex-col justify-between">
      <Header />

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

      <CartDrawer />
      <Footer />
    </div>
  );
}
