import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore } from '../useCartStore';
import { useRouter } from '../useRouter';

export default function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeItem } = useCartStore();
  const { navigateTo } = useRouter();

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    closeCart();
    navigateTo({ type: 'checkout' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
          />

          {/* Sliding Panel */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="w-screen max-w-md bg-white flex flex-col justify-between shadow-2xl h-full border-l border-neutral-100"
            >
              {/* Header */}
              <div className="px-5 py-6 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-950 font-sans">Your Bag ({totalItems})</h3>
                </div>
                <button
                  id="close-cart-btn"
                  onClick={closeCart}
                  className="p-1 hover:bg-zinc-50 rounded-full cursor-pointer transition-colors"
                  aria-label="Close Cart"
                >
                  <X className="w-5 h-5 text-black" />
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-12">
                    <div className="w-12 h-12 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-400">
                      <ShoppingBag className="w-5 h-5 stroke-[1.2]" />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest font-semibold text-black font-sans">Your Cart is Empty</p>
                      <p className="text-[11px] text-neutral-400 mt-1 max-w-[240px] leading-relaxed">
                        Explore our bespoke resin frames, luxury pooja trays and custom wedding invitations.
                      </p>
                    </div>
                    <button
                      id="continue-shopping-from-cart"
                      onClick={() => { closeCart(); navigateTo({ type: 'shop' }); }}
                      className="px-6 py-2 bg-black text-white hover:bg-neutral-800 text-[10px] tracking-widest uppercase transition-colors rounded-sm cursor-pointer"
                    >
                      Shop the Collection
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-4 border-b border-neutral-50 pb-5 last:border-b-0">
                        {/* Image Thumbnail */}
                        <div 
                          className="w-18 h-22 shrink-0 bg-neutral-50 rounded overflow-hidden relative cursor-pointer"
                          onClick={() => { closeCart(); navigateTo({ type: 'product', id: item.id }); }}
                        >
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = item.fallbackImage;
                            }}
                          />
                        </div>

                        {/* Details */}
                        <div className="flex-1 flex flex-col justify-between">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex justify-between gap-2">
                              <h3 
                                className="text-[11px] uppercase tracking-wider font-semibold text-black hover:text-neutral-500 transition-colors cursor-pointer line-clamp-2"
                                onClick={() => { closeCart(); navigateTo({ type: 'product', id: item.id }); }}
                              >
                                {item.name}
                              </h3>
                              <span className="text-[11px] font-mono font-medium text-black">
                                ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                              </span>
                            </div>
                            <span className="text-[10px] text-neutral-400 italic">{item.category}</span>
                          </div>

                          {/* Controls & Action */}
                          <div className="flex items-center justify-between mt-3">
                            {/* Quantity buttons */}
                            <div className="flex items-center border border-neutral-200">
                              <button
                                id={`dec-qty-${item.id}`}
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="px-2 py-1 text-neutral-500 hover:text-black cursor-pointer"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2 text-xs font-mono font-medium text-black">{item.quantity}</span>
                              <button
                                id={`inc-qty-${item.id}`}
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="px-2 py-1 text-neutral-500 hover:text-black cursor-pointer"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Remove link */}
                            <button
                              id={`remove-item-${item.id}`}
                              onClick={() => removeItem(item.id)}
                              className="text-[10px] uppercase tracking-widest font-semibold text-neutral-400 hover:text-black transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fixed Bottom Section */}
              {items.length > 0 && (
                <div className="border-t border-neutral-100 p-5 bg-neutral-50/50 flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-black">
                      <span className="text-xs uppercase tracking-widest font-semibold font-sans">Subtotal</span>
                      <span className="text-sm font-mono font-semibold">₹{subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 italic">
                      Tax included. Shipping calculated at checkout.
                    </p>
                  </div>

                  <button
                    id="cart-drawer-checkout-btn"
                    onClick={handleCheckout}
                    className="w-full bg-black text-white hover:bg-neutral-800 py-4 text-center text-[10px] tracking-[0.3em] font-bold uppercase transition-all duration-200 rounded-none cursor-pointer shadow-sm hover:shadow-md"
                  >
                    Proceed to Checkout
                  </button>

                  <button
                    id="continue-shopping"
                    onClick={closeCart}
                    className="text-center text-[10px] uppercase tracking-widest font-semibold text-neutral-600 hover:text-black transition-colors cursor-pointer block mt-1"
                  >
                    Continue Shopping
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
