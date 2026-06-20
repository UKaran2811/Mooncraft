import { create } from 'zustand';
import { PageRoute } from './types';

interface RouterState {
  route: PageRoute;
  history: PageRoute[];
  navigateTo: (route: PageRoute) => void;
  goBack: () => void;
}

export const useRouter = create<RouterState>((set) => ({
  route: { type: 'home' },
  history: [],
  navigateTo: (newRoute: PageRoute) => set((state) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (newRoute.type === 'home') {
      window.location.hash = '';
    } else if (newRoute.type === 'product') {
      window.location.hash = `#/product/${newRoute.id}`;
    } else if (newRoute.type === 'checkout') {
      window.location.hash = '#/checkout';
    } else if (newRoute.type === 'shop') {
      window.location.hash = newRoute.filterCategory
        ? `#/shop/${encodeURIComponent(newRoute.filterCategory)}`
        : '#/shop';
    } else if (newRoute.type === 'admin') {
      window.location.hash = '#/admin';
    } else if (newRoute.type === 'admin-login') {
      window.location.hash = '#/admin/login';
    }
    return {
      history: [...state.history, state.route],
      route: newRoute,
    };
  }),
  goBack: () => set((state) => {
    if (state.history.length === 0) return { route: { type: 'home' } };
    const newHistory = [...state.history];
    const prevRoute = newHistory.pop() || { type: 'home' };
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return { history: newHistory, route: prevRoute };
  }),
}));

// Initialize hash listener
export const initHashRouting = (navigateTo: (route: PageRoute) => void) => {
  const handleHashChange = () => {
    const hash = window.location.hash;
    if (!hash || hash === '#/') {
      navigateTo({ type: 'home' });
    } else if (hash.startsWith('#/product/')) {
      const id = hash.replace('#/product/', '');
      navigateTo({ type: 'product', id });
    } else if (hash === '#/checkout') {
      navigateTo({ type: 'checkout' });
    } else if (hash.startsWith('#/shop')) {
      const parts = hash.split('/');
      const category = parts[2] ? decodeURIComponent(parts[2]) : undefined;
      navigateTo({ type: 'shop', filterCategory: category });
    } else if (hash === '#/admin/login' || hash === '#/admin') {
      // Admin routes are handled without loading the full app nav/footer
      navigateTo({ type: 'admin-login' });
    }
  };

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange(); // run on initial load

  return () => {
    window.removeEventListener('hashchange', handleHashChange);
  };
};
