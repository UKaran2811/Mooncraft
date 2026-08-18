import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, ShoppingBag, Package, Users, Settings,
  LogOut, TrendingUp, Clock, CheckCircle, Truck, XCircle,
  Search, Plus, Edit2, Trash2, Eye,
  ToggleLeft, ToggleRight, IndianRupee, RefreshCw, X,
  ArrowUpRight, ArrowDownRight, AlertTriangle, Bell,
  UserCheck, Star, Menu, ChevronLeft, ChevronRight,
  Send, Package2, BarChart2, ShieldCheck, Copy, ExternalLink, Upload, Loader,
} from 'lucide-react';
import { adminAPI, ordersAPI, productsAPI, authAPI, uploadAPI, setAdminToken } from '../services/api';

// ──── Types ───────────────────────────────
interface AdminUser { name: string; email: string; role: string; }
interface Stats { revenue: RevenueStat; orders: OrderStat; customers: { total: number }; products: { totalActive: number }; }
interface RevenueStat { total: number; today: number; thisMonth: number; lastMonth: number; growthPercent: string | null; }
interface OrderStat { total: number; today: number; thisMonth: number; byStatus: Record<string, number>; }
interface Order {
  id: string; orderNumber: string;
  customer: { name: string; email: string; phone: string; address: { city: string; state: string; line1: string; zip: string; }; };
  items: OrderItem[]; subtotal: number; shipping: number; total: number;
  status: string; payment: { status: string; method?: string };
  trackingNumber?: string; courierPartner?: string; adminNotes?: string;
  shipmentId?: string; awbCode?: string;
  emailSent?: boolean; whatsappSent?: boolean;
  createdAt: string;
}
interface OrderItem { name: string; quantity: number; price: number; }
interface Product { id: string; slugId: string; name: string; price: number; category: string; isActive: boolean; stock: number; image: string; description: string; materials: string; careInstructions: string; gallery: string[]; isFeatured: boolean; }
interface ChartDay { date: string; revenue: number; orders: number; }

// ──── Constants ───────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-amber-500/15 text-amber-400 border-amber-500/20',
  confirmed:  'bg-blue-500/15 text-blue-400 border-blue-500/20',
  processing: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  shipped:    'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  delivered:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  cancelled:  'bg-red-500/15 text-red-400 border-red-500/20',
  refunded:   'bg-orange-500/15 text-orange-400 border-orange-500/20',
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
    { id: 'overview',   label: 'Overview',   icon: LayoutDashboard },
    { id: 'orders',     label: 'Orders',     icon: ShoppingBag },
    { id: 'products',   label: 'Products',   icon: Package },
    { id: 'customers',  label: 'Customers',  icon: Users },
    { id: 'settings',   label: 'Settings',   icon: Settings },
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
                activeTab === id ? 'bg-white text-black' : 'text-white/50 hover:text-white hover:bg-white/5'
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
            onClick={() => { window.location.hash = '#/'; window.location.reload(); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm whitespace-nowrap">
                  Preview Store
                </motion.span>
              )}
            </AnimatePresence>
          </button>
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
            {activeTab === 'overview'  && <OverviewTab />}
            {activeTab === 'orders'    && <OrdersTab />}
            {activeTab === 'products'  && <ProductsTab />}
            {activeTab === 'customers' && <CustomersTab />}
            {activeTab === 'settings'  && <SettingsTab admin={admin} />}
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
  const [topProducts, setTopProducts] = useState<{ id: string; name: string; totalRevenue: number; totalSold: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [chartData, setChartData] = useState<ChartDay[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, topRes, ordersRes, chartRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getTopProducts(),
        ordersAPI.getAll({ limit: '6', sort: 'newest' }),
        adminAPI.getRevenueChart(14),
      ]);
      setStats(statsRes.data);
      setTopProducts(topRes.data || []);
      setRecentOrders(ordersRes.data || []);
      setChartData(chartRes.data || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <LoadingScreen />;

  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 1);

  const kpis = [
    {
      label: 'Total Revenue',
      value: `₹${(stats?.revenue.total || 0).toLocaleString('en-IN')}`,
      sub: `₹${(stats?.revenue.thisMonth || 0).toLocaleString('en-IN')} this month`,
      icon: IndianRupee, color: 'text-emerald-400', bg: 'bg-emerald-500/10',
      trend: stats?.revenue.growthPercent,
    },
    {
      label: 'Total Orders',
      value: stats?.orders.total || 0,
      sub: `${stats?.orders.today || 0} today`,
      icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10',
    },
    {
      label: 'Pending',
      value: stats?.orders.byStatus?.pending || 0,
      sub: 'Needs attention',
      icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10',
    },
    {
      label: 'Customers',
      value: stats?.customers.total || 0,
      sub: `${stats?.products.totalActive || 0} active products`,
      icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10',
    },
  ];

  const statusBreakdown = [
    { key: 'confirmed',  label: 'Confirmed',  icon: CheckCircle, color: 'text-blue-400' },
    { key: 'processing', label: 'Processing', icon: RefreshCw,   color: 'text-purple-400' },
    { key: 'shipped',    label: 'Shipped',    icon: Truck,       color: 'text-cyan-400' },
    { key: 'delivered',  label: 'Delivered',  icon: CheckCircle, color: 'text-emerald-400' },
    { key: 'cancelled',  label: 'Cancelled',  icon: XCircle,     color: 'text-red-400' },
  ];

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard Overview</h1>
          <p className="text-white/40 text-sm mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 text-white/30 hover:text-white text-xs transition-colors border border-white/10 px-3 py-1.5 rounded-lg">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
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

      {/* Revenue Chart */}
      {chartData.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-white/30" /> Revenue — Last 14 Days
            </h2>
            <span className="text-white/30 text-xs">₹{chartData.reduce((s, d) => s + d.revenue, 0).toLocaleString('en-IN')} total</span>
          </div>
          <div className="flex items-end gap-1.5 h-28">
            {chartData.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full relative" style={{ height: '96px' }}>
                  <div
                    className="absolute bottom-0 w-full bg-white/10 group-hover:bg-emerald-500/40 transition-colors rounded-sm"
                    style={{ height: `${Math.max(2, (day.revenue / maxRevenue) * 96)}px` }}
                    title={`₹${day.revenue.toLocaleString('en-IN')}`}
                  />
                </div>
                <span className="text-white/20 text-[8px] group-hover:text-white/50 transition-colors">
                  {new Date(day.date).toLocaleDateString('en-IN', { day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-semibold text-sm">Recent Orders</h2>
            <span className="text-white/30 text-xs">{stats?.orders.thisMonth} this month</span>
          </div>
          <div className="flex flex-col gap-1">
            {recentOrders.length === 0 && (
              <p className="text-white/30 text-sm text-center py-8">No orders yet</p>
            )}
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-3 border-b border-white/[0.05] last:border-0">
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

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Order Pipeline */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
            <h2 className="text-white font-semibold text-sm mb-4">Order Pipeline</h2>
            {statusBreakdown.map(({ key, label, icon: Icon, color }) => (
              <div key={key} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span className="text-white/60 text-xs">{label}</span>
                </div>
                <span className="text-white text-xs font-bold">{stats?.orders.byStatus?.[key] || 0}</span>
              </div>
            ))}
          </div>

          {/* Top Products */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
            <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-white/30" /> Top Products
            </h2>
            {topProducts.slice(0, 5).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
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
  const LIMIT = 15;

  // Shipping modal state
  const [showShipModal, setShowShipModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierPartner, setCourierPartner] = useState('');
  const [shipOrderId, setShipOrderId] = useState('');
  const [shiprocketLoading, setShiprocketLoading] = useState(false);
  const [shiprocketError, setShiprocketError] = useState('');

  // Live tracking modal state
  const [trackingData, setTrackingData] = useState<any>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(LIMIT) };
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

  const updateStatus = async (orderId: string, newStatus: string, extra?: Record<string, string>) => {
    setUpdatingId(orderId);
    try {
      await ordersAPI.updateStatus(orderId, newStatus, extra);
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus, ...extra } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder((o) => o ? { ...o, status: newStatus, ...extra } : o);
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setUpdatingId('');
    }
  };

  const openShipModal = (orderId: string, existing?: Order) => {
    setShipOrderId(orderId);
    setTrackingNumber(existing?.trackingNumber || '');
    setCourierPartner(existing?.courierPartner || '');
    setShowShipModal(true);
  };

  const confirmShip = async () => {
    await updateStatus(shipOrderId, 'shipped', { trackingNumber, courierPartner });
    setShowShipModal(false);
    setTrackingNumber('');
    setCourierPartner('');
  };

  const shipViaShiprocket = async () => {
    setShiprocketLoading(true);
    setShiprocketError('');
    try {
      const res = await ordersAPI.shipViaShiprocket(shipOrderId, true);
      const shipment = res.shipment || {};
      setTrackingNumber(shipment.awbCode || '');
      setCourierPartner(shipment.courierName || '');
      await loadOrders();
      setShowShipModal(false);
      setTrackingNumber('');
      setCourierPartner('');
    } catch (err: any) {
      setShiprocketError(err?.message || 'Shiprocket shipment failed');
    } finally {
      setShiprocketLoading(false);
    }
  };

  const openTrackingModal = async (order: Order) => {
    setSelectedOrder(order);
    setTrackingData(null);
    setShowTrackingModal(true);
    if (!order.shipmentId) return;
    setTrackingLoading(true);
    try {
      const res = await ordersAPI.getShiprocketTracking(order.id);
      setTrackingData(res.data);
    } catch (err: any) {
      setTrackingData({ error: err?.message || 'Failed to load tracking' });
    } finally {
      setTrackingLoading(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Orders</h1>
          <p className="text-white/40 text-sm mt-1">{total} total orders</p>
        </div>
        <button onClick={loadOrders} className="flex items-center gap-2 text-white/40 hover:text-white text-sm transition-colors border border-white/10 px-3 py-1.5 rounded-lg">
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
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by order #, name, email..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
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
        <>
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.07]">
                    {['Order #', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Date', ''].map((h) => (
                      <th key={h} className="text-left text-white/30 text-[10px] uppercase tracking-widest px-4 py-3.5 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-white/30 py-12 text-sm">No orders found</td></tr>
                  )}
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5">
                        <button onClick={() => copyText(order.orderNumber)} className="font-mono text-white/80 text-xs hover:text-white flex items-center gap-1 group">
                          {order.orderNumber}
                          <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50" />
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-white/80 text-xs font-medium">{order.customer.name}</p>
                        <p className="text-white/30 text-[10px]">{order.customer.email}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-white/50 text-xs">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-white text-xs font-semibold font-mono">₹{order.total.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${order.payment?.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                          {order.payment?.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          value={order.status}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (next === 'shipped') { openShipModal(order.id, order); }
                            else { updateStatus(order.id, next); }
                          }}
                          disabled={updatingId === order.id}
                          className={`text-[10px] font-medium px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none bg-transparent ${STATUS_COLORS[order.status] || 'border-white/10 text-white/50'}`}
                        >
                          {ORDER_STATUSES.map((s) => <option key={s} value={s} className="bg-[#111] text-white">{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-white/30 text-[10px] whitespace-nowrap">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <button onClick={() => setSelectedOrder(order)} className="text-white/30 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-white/40">
              <span>Page {page} of {totalPages} ({total} orders)</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-white/10 disabled:opacity-30 hover:text-white hover:border-white/30 transition-all">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-white/10 disabled:opacity-30 hover:text-white hover:border-white/30 transition-all">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Shipping Modal */}
      <AnimatePresence>
        {showShipModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowShipModal(false)}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-semibold flex items-center gap-2"><Truck className="w-4 h-4 text-cyan-400" /> Mark as Shipped</h3>
                <button onClick={() => setShowShipModal(false)} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                  <p className="text-cyan-400 text-[11px] font-semibold mb-1">🚀 Shiprocket Automation</p>
                  <p className="text-white/40 text-[10px] mb-3">Creates the shipment, generates AWB & picks courier automatically.</p>
                  <button onClick={shipViaShiprocket} disabled={shiprocketLoading} className="w-full py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-400 disabled:bg-white/20 transition-colors cursor-pointer flex items-center justify-center gap-2">
                    {shiprocketLoading ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><Truck className="w-3.5 h-3.5" /> Create Shipment</>}
                  </button>
                  {shiprocketError && <p className="text-red-400 text-[10px] mt-2">{shiprocketError}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/30 text-[9px] uppercase tracking-widest">or manual</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <FormField label="Tracking Number">
                  <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className={inputClass} placeholder="e.g. BD123456789IN" />
                </FormField>
                <FormField label="Courier Partner">
                  <select value={courierPartner} onChange={(e) => setCourierPartner(e.target.value)} className={`${inputClass} bg-[#0d0d0d]`}>
                    <option value="">Select courier</option>
                    {['Delhivery', 'BlueDart', 'DTDC', 'Ekart', 'XpressBees', 'India Post', 'FedEx', 'Shadowfax'].map((c) => (
                      <option key={c} value={c} className="bg-[#111]">{c}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowShipModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white transition-colors cursor-pointer">Cancel</button>
                <button onClick={confirmShip} disabled={updatingId === shipOrderId} className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-400 disabled:bg-white/20 transition-colors cursor-pointer flex items-center justify-center gap-2">
                  {updatingId === shipOrderId ? <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><Truck className="w-3.5 h-3.5" /> Confirm Shipped</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Tracking Modal */}
      <AnimatePresence>
        {showTrackingModal && selectedOrder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowTrackingModal(false)}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-semibold flex items-center gap-2"><Truck className="w-4 h-4 text-cyan-400" /> Live Tracking</h3>
                <button onClick={() => setShowTrackingModal(false)} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-white/30 text-[10px] font-mono mb-4">{selectedOrder.orderNumber}</p>

              {trackingLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
                </div>
              ) : trackingData?.error ? (
                <p className="text-red-400 text-sm">{trackingData.error}</p>
              ) : trackingData ? (
                <div className="max-h-[50vh] overflow-y-auto">
                  <div className="bg-white/5 rounded-xl p-3 mb-3">
                    <p className="text-white/40 text-[10px] mb-1">Status</p>
                    <p className="text-white font-semibold text-sm">{trackingData?.tracking_data?.track_status || 'In transit'}</p>
                  </div>
                  {(trackingData?.tracking_data?.shipment_track_activities || []).slice().reverse().map((a: any, i: number) => (
                    <div key={i} className="flex gap-3 mb-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1 ${i === 0 ? 'bg-cyan-400' : 'bg-white/15'}`} />
                        {i < (trackingData.tracking_data.shipment_track_activities.length - 1) && <div className="w-px flex-1 bg-white/10" />}
                      </div>
                      <div className="pb-3">
                        <p className="text-white/80 text-xs">{a.status}</p>
                        <p className="text-white/30 text-[10px] mt-0.5">{a.activity}</p>
                        <p className="text-white/20 text-[10px] mt-0.5">{a.date} {a.time}</p>
                      </div>
                    </div>
                  ))}
                  {!(trackingData?.tracking_data?.shipment_track_activities || []).length && (
                    <p className="text-white/40 text-xs">No tracking activities yet.</p>
                  )}
                </div>
              ) : (
                <p className="text-white/40 text-xs">No Shiprocket shipment linked to this order.</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: 'spring', damping: 28 }}
              className="bg-[#111] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-white font-semibold font-mono text-sm">{selectedOrder.orderNumber}</h3>
                    <p className="text-white/30 text-[10px] mt-0.5">{new Date(selectedOrder.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                {/* Status pills */}
                <div className="flex items-center gap-2 mb-5 flex-wrap">
                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[selectedOrder.status] || 'bg-white/10 text-white/50'}`}>
                    {selectedOrder.status}
                  </span>
                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${selectedOrder.payment?.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                    {selectedOrder.payment?.status || 'unpaid'} · {selectedOrder.payment?.method || 'razorpay'}
                  </span>
                  {selectedOrder.emailSent && <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/5">📧 Email sent</span>}
                  {selectedOrder.whatsappSent && <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/5">📱 WA sent</span>}
                </div>

                {/* Tracking info (if shipped) */}
                {(selectedOrder.trackingNumber || selectedOrder.courierPartner) && (
                  <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 mb-4 flex items-center gap-3">
                    <Truck className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <p className="text-cyan-400 text-xs font-semibold">{selectedOrder.courierPartner || 'Courier'}</p>
                      <p className="text-white/50 text-[10px] font-mono">{selectedOrder.trackingNumber}</p>
                    </div>
                    {selectedOrder.shipmentId && (
                      <button onClick={() => openTrackingModal(selectedOrder)} className="ml-auto bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer">
                        Live Tracking
                      </button>
                    )}
                    {selectedOrder.trackingNumber && !selectedOrder.shipmentId && (
                      <button onClick={() => copyText(selectedOrder.trackingNumber!)} className="ml-auto text-white/30 hover:text-white">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

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
                <div className="mb-4">
                  <p className="text-white/30 text-[9px] uppercase tracking-widest mb-2">Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    {ORDER_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          if (s === 'shipped') { openShipModal(selectedOrder.id, selectedOrder); }
                          else { updateStatus(selectedOrder.id, s); }
                        }}
                        disabled={selectedOrder.status === s || updatingId === selectedOrder.id}
                        className={`text-[10px] font-medium px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                          selectedOrder.status === s
                            ? STATUS_COLORS[s] || 'bg-white/10 border-white/10 text-white'
                            : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70 bg-transparent'
                        }`}
                      >
                        {s === 'shipped' ? '🚚 ' : ''}{s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Admin Notes */}
                {selectedOrder.adminNotes && (
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/30 text-[9px] uppercase tracking-widest mb-1">Admin Notes</p>
                    <p className="text-white/60 text-xs">{selectedOrder.adminNotes}</p>
                  </div>
                )}
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
  const [categoryFilter, setCategoryFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadAPI.image(file);
      if (res.success) {
        setEditProduct((p) => ({ ...p, image: res.url }));
      } else {
        alert(res.message || 'Upload failed');
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toSnake = (obj: Record<string, unknown>) => {
    const map: Record<string, string> = {
      slugId: 'slug_id', careInstructions: 'care_instructions',
      isActive: 'is_active', isFeatured: 'is_featured',
      fallbackImage: 'fallback_image',
    };
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[map[key] || key] = val;
    }
    return result;
  };

  const handleSave = async () => {
    if (!editProduct) return;
    setSaving(true);
    try {
      const payload = toSnake(editProduct as Record<string, unknown>);
      if (isCreating) {
        const res = await productsAPI.create(payload);
        setProducts((prev) => [res.data, ...prev]);
      } else {
        const res = await productsAPI.update(editProduct.slugId!, payload);
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

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const active = products.filter((p) => p.isActive).length;

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Products</h1>
          <p className="text-white/40 text-sm mt-1">{active} active · {products.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadProducts} className="p-2 border border-white/10 rounded-xl text-white/30 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            id="admin-add-product-btn"
            onClick={() => { setIsCreating(true); setEditProduct({ slugId: '', name: '', price: 0, category: 'Resin Art', description: '', materials: '', careInstructions: '', gallery: [], isActive: true, stock: 999 }); }}
            className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none focus:border-white/20"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#111] text-white">{c}</option>)}
        </select>
      </div>

      {loading ? <LoadingScreen /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <motion.div
              key={product.id}
              layout
              className={`bg-white/[0.03] border rounded-2xl p-4 transition-all ${product.isActive ? 'border-white/[0.07]' : 'border-white/[0.03] opacity-50'}`}
            >
              {/* Image */}
              <div className="w-full aspect-square bg-white/5 rounded-xl mb-3 overflow-hidden relative">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/10">
                    <Package className="w-8 h-8" />
                  </div>
                )}
                {/* Stock badge */}
                {product.stock !== undefined && (
                  <div className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${product.stock <= 0 ? 'bg-red-500/80 text-white' : product.stock <= 5 ? 'bg-amber-500/80 text-black' : 'bg-black/60 text-white/70'}`}>
                    {product.stock <= 0 ? 'OUT' : `${product.stock}`}
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
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-white/30 text-sm">No products match your search</div>
          )}
        </div>
      )}

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {editProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setEditProduct(null)}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto"
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
                    <FormField label="Stock quantity">
                      <input type="number" min="0" value={editProduct.stock ?? ''} onChange={(e) => setEditProduct((p) => ({ ...p, stock: Number(e.target.value) }))} className={inputClass} placeholder="999" />
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
                  <FormField label="Image">
                    <div className="flex gap-2">
                      <input type="text" value={editProduct.image || ''} onChange={(e) => setEditProduct((p) => ({ ...p, image: e.target.value }))} className={inputClass} placeholder="/images/product.jpg or /uploads/..." />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleUploadImage}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/30 text-xs transition-colors whitespace-nowrap disabled:opacity-40 cursor-pointer"
                      >
                        {uploading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Upload
                      </button>
                    </div>
                    {editProduct.image && (
                      <img src={editProduct.image} alt="preview" className="mt-2 w-full h-28 object-cover rounded-lg opacity-70" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                  </FormField>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editProduct.isFeatured || false} onChange={(e) => setEditProduct((p) => ({ ...p, isFeatured: e.target.checked }))} className="accent-white w-3.5 h-3.5" />
                      <span className="text-white/60 text-xs">Featured product</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editProduct.isActive !== false} onChange={(e) => setEditProduct((p) => ({ ...p, isActive: e.target.checked }))} className="accent-white w-3.5 h-3.5" />
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
interface CustomerDetail {
  id: string; name: string; email: string; phone: string; created_at: string;
  orderCount?: number; totalSpent?: number;
}

function CustomersTab() {
  const [users, setUsers] = useState<CustomerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<{ user: CustomerDetail; orders: Order[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  const openUserDetail = async (userId: string) => {
    setLoadingDetail(true);
    try {
      const res = await adminAPI.getUser(userId);
      const userData = res.data;
      setSelectedUser({ user: userData, orders: userData.orders || [] });
    } catch (err) { console.error(err); }
    finally { setLoadingDetail(false); }
  };

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
                {['Customer', 'Email', 'Phone', 'Joined', ''].map((h) => (
                  <th key={h} className="text-left text-white/30 text-[10px] uppercase tracking-widest px-5 py-3.5 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={5} className="text-center text-white/30 py-12 text-sm">No customers yet</td></tr>}
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/50 font-medium shrink-0">
                        {(u.name || u.email)?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-white/80 text-xs font-medium">{u.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-white/50 text-xs">{u.email}</td>
                  <td className="px-5 py-3.5 text-white/50 text-xs">{u.phone || '—'}</td>
                  <td className="px-5 py-3.5 text-white/30 text-[10px]">{new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => openUserDetail(u.id)} className="text-white/30 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Detail Modal */}
      <AnimatePresence>
        {(selectedUser || loadingDetail) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: 'spring', damping: 28 }}
              className="bg-[#111] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {loadingDetail ? (
                  <div className="py-12 flex justify-center"><div className="w-5 h-5 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" /></div>
                ) : selectedUser ? (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm text-white/60 font-semibold">
                          {(selectedUser.user.name || selectedUser.user.email)?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">{selectedUser.user.name || 'Guest'}</p>
                          <p className="text-white/40 text-xs">{selectedUser.user.email}</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedUser(null)} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-white/5 rounded-xl p-3 text-center">
                        <p className="text-white font-bold text-lg">{selectedUser.orders.length}</p>
                        <p className="text-white/30 text-[10px] uppercase tracking-wider mt-0.5">Orders</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 text-center">
                        <p className="text-emerald-400 font-bold text-sm">
                          ₹{selectedUser.orders.reduce((s, o) => s + o.total, 0).toLocaleString('en-IN')}
                        </p>
                        <p className="text-white/30 text-[10px] uppercase tracking-wider mt-0.5">Total Spent</p>
                      </div>
                    </div>

                    <p className="text-white/30 text-[9px] uppercase tracking-widest mb-3">Order History</p>
                    {selectedUser.orders.length === 0 ? (
                      <p className="text-white/20 text-xs text-center py-4">No orders placed yet</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {selectedUser.orders.map((order) => (
                          <div key={order.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                            <div>
                              <p className="text-white/80 text-xs font-mono">{order.orderNumber}</p>
                              <p className="text-white/30 text-[10px] mt-0.5">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white text-xs font-semibold">₹{order.total.toLocaleString('en-IN')}</p>
                              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || 'bg-white/10 text-white/50'}`}>
                                {order.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════
// SETTINGS TAB
// ══════════════════════════════════════════
function SettingsTab({ admin }: { admin: AdminUser }) {
  const [admins, setAdmins] = useState<{ id: string; name: string; email: string; role: string; createdAt: string }[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');

  const loadAdmins = useCallback(async () => {
    setLoadingAdmins(true);
    try {
      const res = await adminAPI.getAdmins();
      setAdmins(res.data || []);
    } catch { /* not super admin — ignore */ }
    finally { setLoadingAdmins(false); }
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setCreatingAdmin(true);
    try {
      await adminAPI.createAdmin(newAdmin);
      setShowAddAdmin(false);
      setNewAdmin({ name: '', email: '', password: '', role: 'staff' });
      loadAdmins();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to create admin');
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-white/40 text-sm mt-1">Admin account & system configuration</p>
      </div>

      <div className="max-w-xl flex flex-col gap-5">
        {/* Account Info */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-white/40" /> Account Information
          </h2>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Name',  value: admin.name },
              { label: 'Email', value: admin.email },
              { label: 'Role',  value: admin.role?.replace('_', ' ') },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                <span className="text-white/30 text-xs">{label}</span>
                <span className="text-white/70 text-xs capitalize">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Management */}
        {(admin.role === 'super_admin' || admins.length > 0) && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-white/40" /> Staff Admins
              </h2>
              {admin.role === 'super_admin' && (
                <button onClick={() => setShowAddAdmin(true)} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white border border-white/10 px-2.5 py-1.5 rounded-lg transition-colors">
                  <Plus className="w-3 h-3" /> Add Staff
                </button>
              )}
            </div>
            {loadingAdmins ? (
              <div className="py-4 flex justify-center"><div className="w-4 h-4 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" /></div>
            ) : (
              <div className="flex flex-col gap-2">
                {admins.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/50 font-semibold shrink-0">
                      {a.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-xs font-medium">{a.name}</p>
                      <p className="text-white/30 text-[10px]">{a.email}</p>
                    </div>
                    <span className="text-white/30 text-[9px] uppercase tracking-wider border border-white/10 px-2 py-0.5 rounded-full">{a.role?.replace('_', ' ')}</span>
                  </div>
                ))}
                {admins.length === 0 && <p className="text-white/20 text-xs text-center py-3">No staff admins yet</p>}
              </div>
            )}
          </div>
        )}

        {/* Notification Setup */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-white/40" /> Notification Services
          </h2>
          <div className="flex flex-col gap-3 text-xs text-white/50">
            {[
              { icon: CheckCircle, color: 'text-emerald-400', label: 'Order confirmation emails via Gmail SMTP' },
              { icon: AlertTriangle, color: 'text-amber-400', label: 'WhatsApp admin alerts via CallMeBot — set CALLMEBOT_PHONE & CALLMEBOT_API_KEY in .env' },
              { icon: CheckCircle, color: 'text-emerald-400', label: 'Razorpay payment gateway + webhook ready' },
            ].map(({ icon: Icon, color, label }) => (
              <div key={label} className="flex items-center gap-2.5 p-3 bg-white/5 rounded-xl">
                <Icon className={`w-4 h-4 ${color} shrink-0`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Commands */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
            <Package2 className="w-4 h-4 text-white/40" /> Quick Commands
          </h2>
          <div className="flex flex-col gap-2">
            {[
              { cmd: 'npm run backend:dev', desc: 'Start backend API server (port 5000)' },
              { cmd: 'npm run seed',        desc: 'Create super admin + seed products' },
              { cmd: 'npm run dev',         desc: 'Start frontend (Vite, port 3000)' },
              { cmd: 'node backend/config', desc: 'Validate all environment variables' },
            ].map(({ cmd, desc }) => (
              <div key={cmd} className="flex items-center gap-3 p-3 bg-black/30 rounded-xl group">
                <div className="flex-1">
                  <code className="text-emerald-400 text-[11px] font-mono">{cmd}</code>
                  <p className="text-white/30 text-[10px] mt-0.5">{desc}</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(cmd).catch(() => {})} className="text-white/10 group-hover:text-white/40 transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Admin Modal */}
      <AnimatePresence>
        {showAddAdmin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddAdmin(false)}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-semibold">Add Staff Admin</h3>
                <button onClick={() => setShowAddAdmin(false)} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <form onSubmit={handleCreateAdmin} className="flex flex-col gap-3">
                <FormField label="Name" required>
                  <input type="text" value={newAdmin.name} onChange={(e) => setNewAdmin((n) => ({ ...n, name: e.target.value }))} className={inputClass} required />
                </FormField>
                <FormField label="Email" required>
                  <input type="email" value={newAdmin.email} onChange={(e) => setNewAdmin((n) => ({ ...n, email: e.target.value }))} className={inputClass} required />
                </FormField>
                <FormField label="Password" required>
                  <input type="password" value={newAdmin.password} onChange={(e) => setNewAdmin((n) => ({ ...n, password: e.target.value }))} className={inputClass} required minLength={8} />
                </FormField>
                <FormField label="Role">
                  <select value={newAdmin.role} onChange={(e) => setNewAdmin((n) => ({ ...n, role: e.target.value }))} className={`${inputClass} bg-[#0d0d0d]`}>
                    <option value="staff" className="bg-[#111]">Staff</option>
                    <option value="manager" className="bg-[#111]">Manager</option>
                  </select>
                </FormField>
                {adminError && <p className="text-red-400 text-xs">{adminError}</p>}
                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setShowAddAdmin(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:text-white transition-colors cursor-pointer">Cancel</button>
                  <button type="submit" disabled={creatingAdmin} className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:bg-white/30 transition-colors cursor-pointer flex items-center justify-center gap-2">
                    {creatingAdmin ? <><div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Creating...</> : <><Send className="w-3.5 h-3.5" /> Create Admin</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
