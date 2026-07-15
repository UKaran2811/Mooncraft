import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Package, ChevronRight, Clock, IndianRupee } from 'lucide-react';
import { ordersAPI } from '../services/api';
import { useAuthStore } from '../useAuthStore';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total: number;
  subtotal: number;
  shipping: number;
  tracking_number?: string;
  courier_partner?: string;
  created_at: string;
  order_items: OrderItem[];
}

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-amber-100 text-amber-800',
  confirmed:  'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped:    'bg-cyan-100 text-cyan-800',
  delivered:  'bg-emerald-100 text-emerald-800',
  cancelled:  'bg-red-100 text-red-800',
  refunded:   'bg-orange-100 text-orange-800',
};

export default function MyOrders() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) { setLoading(false); return; }
    const load = async () => {
      try {
        const res = await ordersAPI.getMy();
        setOrders(res.data || []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
  }, [user, hydrated]);

  if (!hydrated || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-neutral-300 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <Package className="w-10 h-10 text-neutral-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-zinc-900 mb-2">Sign in to view orders</h2>
          <p className="text-sm text-neutral-500 mb-6">Please complete the checkout OTP process first to see your order history.</p>
          <a href="#/checkout" className="inline-block bg-black text-white text-sm font-semibold px-6 py-3 rounded-lg hover:bg-zinc-800 transition-colors">Go to Checkout</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] max-w-3xl mx-auto px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">My Orders</h1>
      <p className="text-sm text-neutral-500 mb-8">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>

      {orders.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
          <p className="text-neutral-400 text-sm">You haven't placed any orders yet.</p>
          <a href="#/shop" className="inline-block mt-4 text-sm text-black underline underline-offset-4 hover:text-neutral-600 transition-colors">Start shopping</a>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {orders.map((order) => (
          <motion.div key={order.id} layout className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
            <button
              onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-neutral-500" />
                </div>
                <div>
                  <p className="text-sm font-mono font-semibold text-zinc-900">{order.order_number}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-neutral-400">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[order.status] || 'bg-neutral-100 text-neutral-600'}`}>{order.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold font-mono text-zinc-900">₹{order.total.toLocaleString('en-IN')}</span>
                <ChevronRight className={`w-4 h-4 text-neutral-400 transition-transform ${expandedId === order.id ? 'rotate-90' : ''}`} />
              </div>
            </button>

            {expandedId === order.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="border-t border-neutral-100 px-5 py-4 bg-neutral-50/50">
                {/* Items */}
                <div className="flex flex-col gap-2 mb-4">
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium mb-1">Items</p>
                  {order.order_items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-zinc-700">{item.name} <span className="text-neutral-400">×{item.quantity}</span></span>
                      <span className="font-mono text-zinc-800">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="flex flex-col gap-1 mb-4 text-sm">
                  <div className="flex justify-between text-neutral-500">
                    <span>Subtotal</span>
                    <span className="font-mono">₹{order.subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-neutral-500">
                    <span>Shipping</span>
                    <span className="font-mono">{order.shipping === 0 ? 'FREE' : `₹${order.shipping.toLocaleString('en-IN')}`}</span>
                  </div>
                  <div className="flex justify-between text-zinc-900 font-semibold border-t border-neutral-200 pt-1 mt-1">
                    <span>Total</span>
                    <span className="font-mono">₹{order.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Payment & Tracking */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white rounded-xl p-3 border border-neutral-200">
                    <p className="text-neutral-400 text-[10px] uppercase tracking-widest mb-1">Payment</p>
                    <span className={`font-medium ${order.payment_status === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                    {order.payment_method && <span className="text-neutral-400 ml-1">via {order.payment_method}</span>}
                  </div>
                  {order.tracking_number && (
                    <div className="bg-white rounded-xl p-3 border border-neutral-200">
                      <p className="text-neutral-400 text-[10px] uppercase tracking-widest mb-1">Tracking</p>
                      <p className="font-mono text-zinc-800">{order.tracking_number}</p>
                      {order.courier_partner && <p className="text-neutral-400 text-[10px]">{order.courier_partner}</p>}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
