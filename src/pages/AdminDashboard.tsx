import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, ShoppingBag, Package, Users, Settings,
  LogOut, TrendingUp, Clock, CheckCircle, Truck, XCircle,
  Search, Filter, ChevronDown, Plus, Edit2, Trash2, Eye,
  ToggleLeft, ToggleRight, IndianRupee, RefreshCw, X,
  ArrowUpRight, ArrowDownRight, AlertTriangle, Bell,
  UserCheck, Star, Menu, ChevronRight
} from 'lucide-react';
import { adminAPI, ordersAPI, productsAPI, authAPI, setAdminToken } from '../services/api';

// ──── Types ───────────────────────────────
interface AdminUser { name: string; email: string; role: string; }
interface Stats { revenue: RevenueStat; orders: OrderStat; customers: { total: number }; products: { totalActive: number }; }
interface RevenueStat { total: number; today: number; thisMonth: number; lastMonth: number; growthPercent: string | null; }
interface OrderStat { total: number; today: number; thisMonth: number; byStatus: Record<string, number>; }
interface Order { _id: string; orderNumber: string; customer: { name: string; email: string; phone: string; address: { city: string; state: string; line1: string; zip: string; }; }; items: OrderItem[]; subtotal: number; shipping: number; total: number; status: string; payment: { status: string }; createdAt: string; }
interface OrderItem { name: string; quantity: number; price: number; }
interface Product { _id: string; slugId: string; name: string; price: number; category: string; isActive: boolean; stock: number; image: string; description: string; materials: string; careInstructions: string; gallery: string[]; isFeatured: boolean; }

// ──── Constants ───────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  confirmed: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  processing: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  shipped: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/20',
  refunded: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
};

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
const CATEGORIES = ['Resin Art', 'Wedding Favors', 'Festive Gifting', 'Accessories'];

// ──── Main Dashboard ──────────────────────
interface AdminDashboardProps { admin: AdminUser; onLogout: () => void; }

export default function AdminDashboard({ admin, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'products' | 'customers' | 'settings'>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await authAPI.logout().catch(() => {});
    setAdminToken(null);
    onLogout();
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 240 : 72 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="h-screen sticky top-0 bg-[#111] border-r border-white/[0.06] flex flex-col shrink-0 z-20"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06]">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
            <span className="text-black font-black text-xs">M</span>
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-white text-sm font-semibold tracking-wide">Mooncraft</p>
                <p className="text-white/30 text-[9px] uppercase tracking-widest">Admin Panel</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="ml-auto text-white/30 hover:text-white transition-colors shrink-0">
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`admin-nav-${id}`}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left transition-all ${
                activeTab === id
                  ? 'bg-white text-black'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <AnimatePresence>
                {sidebarOpen && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm font-medium whitespace-nowrap">
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          ))}
        </nav>

        {/* Admin info + logout */}
        <div className="p-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-xs font-bold text-white/70">
              {admin.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                  <p className="text-white/80 text-xs font-medium truncate">{admin.name}</p>
                  <p className="text-white/30 text-[9px] uppercase tracking-wider">{admin.role?.replace('_', ' ')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            id="admin-logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all mt-1"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm whitespace-nowrap">
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
            className="min-h-full"
          >
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'orders' && <OrdersTab />}
            {activeTab === 'products' && <ProductsTab />}
            {activeTab === 'customers' && <CustomersTab />}
            {activeTab === 'settings' && <SettingsTab admin={admin} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ══════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════
function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [topProducts, setTopProducts] = useState<{ _id: string; name: string; totalRevenue: number; totalSold: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, topRes, ordersRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getTopProducts(),
        ordersAPI.getAll({ limit: '5', sort: 'newest' }),
      ]);
      setStats(statsRes.data);
      setTopProducts(topRes.data || []);
      setRecentOrders(ordersRes.data || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <LoadingScreen />;

  const kpis = [
    {
      label: 'Total Revenue',
      value: `₹${(stats?.revenue.total || 0).toLocaleString('en-IN')}`,
      sub: `₹${(stats?.revenue.thisMonth || 0).toLocaleString('en-IN')} this month`,
      icon: IndianRupee,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      trend: stats?.revenue.growthPercent,
    },
    {
      label: 'Total Orders',
      value: stats?.orders.total || 0,
      sub: `${stats?.orders.today || 0} today`,
      icon: ShoppingBag,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Pending',
      value: stats?.orders.byStatus.pending || 0,
      sub: 'Needs attention',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Customers',
      value: stats?.customers.total || 0,
      sub: `${stats?.products.totalActive || 0} active products`,
      icon: Users,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
  ];

  const statusBreakdown = [
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle, color: 'text-blue-400' },
    { key: 'processing', label: 'Processing', icon: RefreshCw, color: 'text-purple-400' },
    { key: 'shipped', label: 'Shipped', icon: Truck, color: 'text-cyan-400' },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'text-emerald-400' },
    { key: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-400' },
  ];

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard Overview</h1>
        <p className="text-white/40 text-sm mt-1">Welcome back! Here's what's happening today.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-9 h-9 ${kpi.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                {kpi.trend && (
                  <div className={`flex items-center gap-1 text-xs font-medium ${parseFloat(kpi.trend) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {parseFloat(kpi.trend) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(parseFloat(kpi.trend))}%
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold text-white mb-1">{kpi.value}</div>
              <div className="text-white/40 text-xs">{kpi.label}</div>
              <div className="text-white/25 text-[10px] mt-0.5">{kpi.sub}</div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold text-sm">Recent Orders</h2>
            <span className="text-white/30 text-xs">{stats?.orders.thisMonth} this month</span>
          </div>
          <div className="flex flex-col gap-2">
            {recentOrders.length === 0 && (
              <p className="text-white/30 text-sm text-center py-8">No orders yet</p>
            )}
            {recentOrders.map((order) => (
              <div key={order._id} className="flex items-center justify-between py-3 border-b border-white/[0.05] last:border-0">
                <div>
                  <p className="text-white text-xs font-mono font-semibold">{order.orderNumber}</p>
                  <p className="text-white/40 text-[10px] mt-0.5">{order.customer.name} · {order.customer.address.city}</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-xs font-semibold">₹{order.total.toLocaleString('en-IN')}</p>
                  <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || 'bg-white/10 text-white/50'}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Status Breakdown + Top Products */}
        <div className="flex flex-col gap-4">
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
            <h2 className="text-white font-semibold text-sm mb-4">Order Pipeline</h2>
            {statusBreakdown.map(({ key, label, icon: Icon, color }) => (
              <div key={key} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span className="text-white/60 text-xs">{label}</span>
                </div>
                <span className="text-white text-xs font-bold">{stats?.orders.byStatus[key] || 0}</span>
              </div>
            ))}
          </div>

          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
            <h2 className="text-white font-semibold text-sm mb-4">Top Products</h2>
            {topProducts.slice(0, 4).map((p, i) => (
              <div key={p._id} className="flex items-center gap-3 py-2">
                <span className="text-white/20 text-xs w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-xs truncate">{p.name}</p>
                  <p className="text-white/30 text-[9px]">{p.totalSold} sold</p>
                </div>
                <span className="text-emerald-400 text-xs font-mono">₹{p.totalRevenue.toLocaleString('en-IN')}</span>
              </div>
            ))}
            {topProducts.length === 0 && <p className="text-white/30 text-xs text-center py-4">No sales data yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
// ORDERS TAB
// ══════════════════════════════════════════
function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingId, setUpdatingId] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '15' };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await ordersAPI.getAll(params);
      setOrders(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await ordersAPI.updateStatus(orderId, newStatus);
      setOrders((prev) => prev.map((o) => o._id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?._id === orderId) setSelectedOrder((o) => o ? { ...o, status: newStatus } : o);
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Orders</h1>
          <p className="text-white/40 text-sm mt-1">{total} total orders</p>
        </div>
        <button onClick={loadOrders} className="flex items-center gap-2 text-white/40 hover:text-white text-sm transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order #, name, email..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none focus:border-white/20"
        >
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s} className="bg-[#111] text-white">{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingScreen />
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  {['Order #', 'Customer', 'Items', 'Total', 'Status', 'Date', 'Action'].map((h) => (
                    <th key={h} className="text-left text-white/30 text-[10px] uppercase tracking-widest px-5 py-3.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-white/30 py-12 text-sm">No orders found</td></tr>
                )}
                {orders.map((order) => (
                  <tr key={order._id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-white/80 text-xs">{order.orderNumber}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-white/80 text-xs font-medium">{order.customer.name}</p>
                      <p className="text-white/30 text-[10px]">{order.customer.email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-white/50 text-xs">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-white text-xs font-semibold font-mono">₹{order.total.toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus(order._id, e.target.value)}
                        disabled={updatingId === order._id}
                        className={`text-[10px] font-medium px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none bg-transparent ${STATUS_COLORS[order.status] || 'border-white/10 text-white/50'}`}
                      >
                        {ORDER_STATUSES.map((s) => <option key={s} value={s} className="bg-[#111] text-white">{s}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-white/30 text-[10px]">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setSelectedOrder(order)} className="text-white/30 hover:text-white transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28 }}
              className="bg-[#111] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-white font-semibold font-mono text-sm">{selectedOrder.orderNumber}</h3>
                    <p className="text-white/30 text-[10px] mt-0.5">{new Date(selectedOrder.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-white/30 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Customer */}
                <div className="bg-white/5 rounded-xl p-4 mb-4">
                  <p className="text-white/30 text-[9px] uppercase tracking-widest mb-2">Customer</p>
                  <p className="text-white text-sm font-medium">{selectedOrder.customer.name}</p>
                  <p className="text-white/50 text-xs">{selectedOrder.customer.email}</p>
                  <p className="text-white/50 text-xs">{selectedOrder.customer.phone}</p>
                  <p className="text-white/40 text-xs mt-1">{selectedOrder.customer.address.line1}, {selectedOrder.customer.address.city}, {selectedOrder.customer.address.state} {selectedOrder.customer.address.zip}</p>
                </div>

                {/* Items */}
                <div className="bg-white/5 rounded-xl p-4 mb-4">
                  <p className="text-white/30 text-[9px] uppercase tracking-widest mb-3">Items</p>
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                      <div>
                        <p className="text-white/80 text-xs">{item.name}</p>
                        <p className="text-white/30 text-[10px]">×{item.quantity} · ₹{item.price.toLocaleString('en-IN')} each</p>
                      </div>
                      <p className="text-white text-xs font-mono">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 mt-1">
                    <span className="text-white/50 text-xs">Shipping</span>
                    <span className="text-white/70 text-xs">{selectedOrder.shipping === 0 ? 'FREE' : `₹${selectedOrder.shipping}`}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10 mt-2">
                    <span className="text-white text-sm font-semibold">Total</span>
                    <span className="text-white text-sm font-bold font-mono">₹{selectedOrder.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Status Update */}
                <div>
                  <p className="text-white/30 text-[9px] uppercase tracking-widest mb-2">Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    {ORDER_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedOrder._id, s)}
                        disabled={selectedOrder.status === s || updatingId === selectedOrder._id}
                        className={`text-[10px] font-medium px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                          selectedOrder.status === s
                            ? STATUS_COLORS[s] || 'bg-white/10 border-white/10 text-white'
                            : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 bg-transparent'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════
// PRODUCTS TAB
// ══════════════════════════════════════════
function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState<Partial<Product> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsAPI.getAllAdmin();
      setProducts(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleToggle = async (slugId: string) => {
    try {
      await productsAPI.toggle(slugId);
      setProducts((prev) => prev.map((p) => p.slugId === slugId ? { ...p, isActive: !p.isActive } : p));
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (slugId: string) => {
    if (!confirm('Remove this product from the store?')) return;
    try {
      await productsAPI.remove(slugId);
      setProducts((prev) => prev.map((p) => p.slugId === slugId ? { ...p, isActive: false } : p));
    } catch (err) { console.error(err); }
  };

  const handleSave = async () => {
    if (!editProduct) return;
    setSaving(true);
    try {
      if (isCreating) {
        const res = await productsAPI.create(editProduct as Record<string, unknown>);
        setProducts((prev) => [res.data, ...prev]);
      } else {
        const res = await productsAPI.update(editProduct.slugId!, editProduct as Record<string, unknown>);
        setProducts((prev) => prev.map((p) => p.slugId === editProduct.slugId ? res.data : p));
      }
      setEditProduct(null);
      setIsCreating(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Products</h1>
          <p className="text-white/40 text-sm mt-1">{products.filter((p) => p.isActive).length} active · {products.length} total</p>
        </div>
        <button
          id="admin-add-product-btn"
          onClick={() => { setIsCreating(true); setEditProduct({ slugId: '', name: '', price: 0, category: 'Resin Art', description: '', materials: '', careInstructions: '', gallery: [], isActive: true, stock: 999 }); }}
          className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
        />
      </div>

      {loading ? <LoadingScreen /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <motion.div
              key={product._id}
              layout
              className={`bg-white/[0.03] border rounded-2xl p-4 transition-all ${product.isActive ? 'border-white/[0.07]' : 'border-white/[0.03] opacity-50'}`}
            >
              {/* Image */}
              <div className="w-full aspect-square bg-white/5 rounded-xl mb-3 overflow-hidden">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10">
                    <Package className="w-8 h-8" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white/30 text-[9px] uppercase tracking-wider">{product.category}</span>
                  {product.isFeatured && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                </div>
                <p className="text-white text-xs font-medium leading-snug">{product.name}</p>
                <p className="text-white/60 text-sm font-bold mt-1">₹{product.price.toLocaleString('en-IN')}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5">
                <button onClick={() => handleToggle(product.slugId)} title={product.isActive ? 'Deactivate' : 'Activate'} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-medium border transition-all cursor-pointer border-white/10 text-white/40 hover:text-white hover:border-white/30">
                  {product.isActive ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-white/20" />}
                  {product.isActive ? 'Live' : 'Off'}
                </button>
                <button onClick={() => { setIsCreating(false); setEditProduct({ ...product }); }} className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-all cursor-pointer">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(product.slugId)} className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {editProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setEditProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-white font-semibold">{isCreating ? 'Add New Product' : 'Edit Product'}</h3>
                  <button onClick={() => setEditProduct(null)} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex flex-col gap-4">
                  {isCreating && (
                    <FormField label="Slug ID (unique, no spaces)" required>
                      <input type="text" value={editProduct.slugId || ''} onChange={(e) => setEditProduct((p) => ({ ...p, slugId: e.target.value }))} className={inputClass} placeholder="e.g. resin-clock-01" />
                    </FormField>
                  )}
                  <FormField label="Product Name" required>
                    <input type="text" value={editProduct.name || ''} onChange={(e) => setEditProduct((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Price (₹)" required>
                      <input type="number" value={editProduct.price || ''} onChange={(e) => setEditProduct((p) => ({ ...p, price: Number(e.target.value) }))} className={inputClass} />
                    </FormField>
                    <FormField label="Stock">
                      <input type="number" value={editProduct.stock || ''} onChange={(e) => setEditProduct((p) => ({ ...p, stock: Number(e.target.value) }))} className={inputClass} />
                    </FormField>
                  </div>
                  <FormField label="Category" required>
                    <select value={editProduct.category || ''} onChange={(e) => setEditProduct((p) => ({ ...p, category: e.target.value }))} className={`${inputClass} bg-[#0d0d0d]`}>
                      {CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#0d0d0d]">{c}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Description" required>
                    <textarea value={editProduct.description || ''} onChange={(e) => setEditProduct((p) => ({ ...p, description: e.target.value }))} rows={3} className={`${inputClass} resize-none`} />
                  </FormField>
                  <FormField label="Materials">
                    <input type="text" value={editProduct.materials || ''} onChange={(e) => setEditProduct((p) => ({ ...p, materials: e.target.value }))} className={inputClass} />
                  </FormField>
                  <FormField label="Care Instructions">
                    <input type="text" value={editProduct.careInstructions || ''} onChange={(e) => setEditProduct((p) => ({ ...p, careInstructions: e.target.value }))} className={inputClass} />
                  </FormField>
                  <FormField label="Image URL">
                    <input type="text" value={editProduct.image || ''} onChange={(e) => setEditProduct((p) => ({ ...p, image: e.target.value }))} className={inputClass} placeholder="/images/product.jpg or https://..." />
                  </FormField>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editProduct.isFeatured || false} onChange={(e) => setEditProduct((p) => ({ ...p, isFeatured: e.target.checked }))} className="accent-white" />
                      <span className="text-white/60 text-xs">Featured product</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editProduct.isActive !== false} onChange={(e) => setEditProduct((p) => ({ ...p, isActive: e.target.checked }))} className="accent-white" />
                      <span className="text-white/60 text-xs">Active (visible in store)</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setEditProduct(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white transition-colors cursor-pointer">Cancel</button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:bg-white/30 transition-colors cursor-pointer flex items-center justify-center gap-2">
                    {saving ? <><div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Saving...</> : isCreating ? 'Create Product' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════
// CUSTOMERS TAB
// ══════════════════════════════════════════
function CustomersTab() {
  const [users, setUsers] = useState<{ _id: string; name: string; email: string; phone: string; createdAt: string; }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (search) params.search = search;
        const res = await adminAPI.getUsers(params);
        setUsers(res.data || []);
        setTotal(res.pagination?.total || 0);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [search]);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Customers</h1>
        <p className="text-white/40 text-sm mt-1">{total} registered customers</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20" />
      </div>

      {loading ? <LoadingScreen /> : (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {['Customer', 'Email', 'Phone', 'Joined'].map((h) => (
                  <th key={h} className="text-left text-white/30 text-[10px] uppercase tracking-widest px-5 py-3.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={4} className="text-center text-white/30 py-12 text-sm">No customers yet</td></tr>}
              {users.map((u) => (
                <tr key={u._id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/50 font-medium">{(u.name || u.email)?.[0]?.toUpperCase()}</div>
                      <span className="text-white/80 text-xs font-medium">{u.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-white/50 text-xs">{u.email}</td>
                  <td className="px-5 py-3.5 text-white/50 text-xs">{u.phone || '—'}</td>
                  <td className="px-5 py-3.5 text-white/30 text-[10px]">{new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
// SETTINGS TAB
// ══════════════════════════════════════════
function SettingsTab({ admin }: { admin: AdminUser }) {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-white/40 text-sm mt-1">Admin account & system settings</p>
      </div>

      <div className="max-w-lg flex flex-col gap-5">
        {/* Account Info */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-white/40" /> Account Information
          </h2>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Name', value: admin.name },
              { label: 'Email', value: admin.email },
              { label: 'Role', value: admin.role?.replace('_', ' ') },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <span className="text-white/30 text-xs">{label}</span>
                <span className="text-white/70 text-xs capitalize">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-white/40" /> Notification Setup
          </h2>
          <div className="flex flex-col gap-3 text-xs text-white/50">
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Email confirmations via Gmail SMTP</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>WhatsApp alerts via CallMeBot — set CALLMEBOT_PHONE & CALLMEBOT_API_KEY in .env</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Razorpay payment gateway integration ready</span>
            </div>
          </div>
        </div>

        {/* Useful Commands */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4">Quick Commands</h2>
          <div className="flex flex-col gap-2">
            {[
              { cmd: 'npm run backend:dev', desc: 'Start backend server' },
              { cmd: 'npm run seed', desc: 'Seed products & admin' },
              { cmd: 'npm run dev', desc: 'Start frontend (Vite)' },
            ].map(({ cmd, desc }) => (
              <div key={cmd} className="flex flex-col gap-0.5 p-3 bg-black/30 rounded-xl">
                <code className="text-emerald-400 text-[11px] font-mono">{cmd}</code>
                <span className="text-white/30 text-[10px]">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──── Helpers ─────────────────────────────
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
    </div>
  );
}

const inputClass = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors';

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-white/40 text-[10px] uppercase tracking-widest">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
