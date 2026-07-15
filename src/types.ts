export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  fallbackImage: string;
  description: string;
  materials: string;
  careInstructions: string;
  category: 'Resin Art' | 'Wedding Favors' | 'Festive Gifting' | 'Accessories';
  gallery: string[];

  // Optional fields populated when fetched from the API
  stock?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  totalSold?: number;
  createdAt?: string;
}

export interface CartItem extends Product {
  quantity: number;
  selectedOption?: string;
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  searchOpen: boolean;
  searchQuery: string;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

export type PageRoute = 
  | { type: 'home' }
  | { type: 'product'; id: string }
  | { type: 'checkout' }
  | { type: 'shop'; filterCategory?: string }
  | { type: 'admin' }
  | { type: 'admin-login' }
  | { type: 'reset-password'; token?: string }
  | { type: 'my-orders' };

