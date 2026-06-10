import { create } from 'zustand';
import { CartState, Product, CartItem } from './types';

export const useCartStore = create<CartState>((set) => ({
  items: [],
  isOpen: false,
  searchOpen: false,
  searchQuery: '',
  openCart: () => set({ isOpen: true }),
  closeCart: () => set({ isOpen: false }),
  toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
  setSearchOpen: (open: boolean) => set({ searchOpen: open }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  
  addItem: (product: Product) => set((state) => {
    const existingIndex = state.items.findIndex((item) => item.id === product.id);
    if (existingIndex > -1) {
      const updatedItems = [...state.items];
      updatedItems[existingIndex].quantity += 1;
      return { items: updatedItems, isOpen: true }; // Slide open on add
    }
    return { 
      items: [...state.items, { ...product, quantity: 1 }], 
      isOpen: true 
    };
  }),
  
  removeItem: (id: string) => set((state) => ({
    items: state.items.filter((item) => item.id !== id)
  })),
  
  updateQuantity: (id: string, quantity: number) => set((state) => {
    if (quantity <= 0) {
      return { items: state.items.filter((item) => item.id !== id) };
    }
    return {
      items: state.items.map((item) => 
        item.id === id ? { ...item, quantity } : item
      )
    };
  }),
  
  clearCart: () => set({ items: [] })
}));
