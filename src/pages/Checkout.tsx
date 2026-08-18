import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCartStore } from '../useCartStore';
import { useRouter } from '../useRouter';
import { useAuthStore } from '../useAuthStore';
import {
  ShieldCheck, Lock, ChevronRight, CheckCircle2, ShoppingBag,
  CreditCard, Smartphone, Banknote, Phone, Mail, User, Edit3,
} from 'lucide-react';
import { ordersAPI, shippingAPI } from '../services/api';
import OtpLoginModal from '../components/OtpLoginModal';

type PaymentMethod = 'razorpay' | 'cod';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (resp: unknown) => void) => void;
    };
  }
}

export default function Checkout() {
  const { items, clearCart } = useCartStore();
  const { navigateTo } = useRouter();
  const { user, hydrated, hydrate, updateProfile, signOut } = useAuthStore();

  // Auth modal
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('razorpay');

  // App state
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderId, setOrderId] = useState('');   // used by simulate-payment
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<PaymentMethod>('razorpay');
  const [errorMsg, setErrorMsg] = useState('');

  // Detect test mode — KEY_ID starts with rzp_test_
  const isTestMode = (import.meta.env.VITE_RAZORPAY_KEY_ID || '').startsWith('rzp_test_');

  // Pincode serviceability state
  const [pincodeStatus, setPincodeStatus] = useState<{ checking: boolean; serviceable?: boolean; couriers?: { name: string; estimatedDays?: string }[]; message?: string }>({});

  // Hydrate auth on mount
  useEffect(() => { hydrate(); }, [hydrate]);

  // Auto-open auth modal if user reaches checkout without being signed in
  useEffect(() => {
    if (hydrated && !user && items.length > 0) {
      setShowAuthModal(true);
    }
  }, [hydrated, user, items.length]);

  // Pre-fill form from auth user
  useEffect(() => {
    if (user) {
      if (!phone && user.phone) setPhone(user.phone.replace(/^\+91/, ''));
      if (!email && user.email) setEmail(user.email);
      if (!firstName && user.name) {
        const parts = user.name.split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.slice(1).join(' ') || '');
      }
    }
  }, [user]);  // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal > 1500 ? 0 : 250;
  const total = subtotal + shipping;

  const checkPincode = async () => {
    if (!/^\d{6}$/.test(zipCode)) {
      setPincodeStatus({ checking: false, message: 'Enter a valid 6-digit pincode to check delivery.' });
      return;
    }
    setPincodeStatus({ checking: true });
    try {
      const res = await shippingAPI.checkPincode(zipCode);
      setPincodeStatus({
        checking: false,
        serviceable: res.serviceable,
        couriers: res.availableCouriers || [],
        message: res.message,
      });
    } catch (err: any) {
      setPincodeStatus({ checking: false, message: err?.message || 'Delivery check failed.' });
    }
  };

  const handleAuthenticated = () => {
    setShowAuthModal(false);
  };

  const openRazorpay = (order: {
    razorpayOrderId: string;
    razorpayKeyId: string;
    amount: number;
    orderNumber: string;
  }) => {
    if (!window.Razorpay) {
      setErrorMsg('Razorpay checkout script failed to load. Please refresh and try again.');
      setIsOrdering(false);
      return;
    }
    const options = {
      key: order.razorpayKeyId,
      amount: order.amount * 100,
      currency: 'INR',
      name: 'Mooncraft Studio',
      description: `Order ${order.orderNumber}`,
      order_id: order.razorpayOrderId,
      image: '/images/creator_portrait.png',
      handler: async (payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          await ordersAPI.verifyPayment({
            razorpay_order_id: payment.razorpay_order_id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
            orderNumber: order.orderNumber,
          });
          setOrderNumber(order.orderNumber);
          setOrderPaymentMethod('razorpay');
          setOrderSuccess(true);
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : 'Payment verification failed');
        } finally {
          setIsOrdering(false);
        }
      },
      prefill: {
        name: `${firstName} ${lastName}`.trim(),
        email,
        contact: phone ? `+91${phone.replace(/^\+91/, '')}` : user?.phone,
      },
      notes: { orderNumber: order.orderNumber },
      theme: { color: '#111111' },
      modal: {
        ondismiss: () => { setIsOrdering(false); },
      },
    };
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (resp: unknown) => {
      console.error('Razorpay payment failed:', resp);
      setErrorMsg('Payment failed. Please try again or use Cash on Delivery.');
      setIsOrdering(false);
    });
    rzp.open();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setIsOrdering(true);
    setErrorMsg('');

    try {
      // Save profile in the background so subsequent orders have the latest data
      if (user && (firstName || email)) {
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName || email) {
          updateProfile({ name: fullName || undefined, email: email || undefined }).catch(() => {});
        }
      }

      const orderPayload = {
        customer: {
          name: `${firstName} ${lastName}`.trim() || user?.name || 'Customer',
          email: email || user?.email || `guest+${user?.id}@mooncraft.in`,
          phone: phone || user?.phone || '',
          address: { line1: address, city, state: stateName, zip: zipCode },
        },
        items: items.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          selectedOption: item.selectedOption,
        })),
        paymentMethod,
      };

      const res = await ordersAPI.place(orderPayload);

      // Razorpay: open the modal — success callback closes the loop
      if (paymentMethod === 'razorpay' && res.razorpayOrderId && res.razorpayKeyId) {
        setOrderId(res.orderId);   // save so simulate button can use it
        openRazorpay({
          razorpayOrderId: res.razorpayOrderId,
          razorpayKeyId: res.razorpayKeyId,
          amount: res.amount,
          orderNumber: res.orderNumber,
        });
        return;
      }

      // COD or no Razorpay configured → backend already marked as confirmed
      setOrderNumber(res.orderNumber);
      setOrderPaymentMethod('cod');
      setOrderSuccess(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to place order. Please try again.');
    } finally {
      // For Razorpay, we keep isOrdering=true until the modal closes (handled in ondismiss / payment.failed).
      if (paymentMethod !== 'razorpay') setIsOrdering(false);
    }
  };

  const handleFinish = () => {
    clearCart();
    setOrderSuccess(false);
    navigateTo({ type: 'home' });
  };

  // ── Empty cart ─────────────────────────────────────────────
  if (items.length === 0 && !orderSuccess) {
    return (
      <div className="w-full bg-white text-black pt-[116px] min-h-[calc(100vh-200px)] flex flex-col items-center justify-center text-center gap-5 px-4 font-sans select-none animate-fade-in">
        <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-400">
          <ShoppingBag className="w-5 h-5 stroke-[1.2]" />
        </div>
        <div>
          <h2 className="text-sm uppercase tracking-widest font-bold">Your Checkout Basket is Empty</h2>
          <p className="text-[11px] text-neutral-500 mt-2 max-w-xs leading-relaxed">
            Please add bespoke handcrafted items from our boutique collection to proceed.
          </p>
        </div>
        <button
          id="checkout-empty-shop-all"
          onClick={() => navigateTo({ type: 'shop' })}
          className="px-6 py-2.5 bg-black text-white text-[10px] uppercase tracking-widest font-bold hover:bg-neutral-800 transition-colors rounded-xs shadow cursor-pointer"
        >
          Return to Studio
        </button>
      </div>
    );
  }

  // ── Loading auth state ─────────────────────────────────────
  if (!hydrated) {
    return (
      <div className="w-full bg-white text-black pt-[116px] min-h-screen flex items-center justify-center font-sans text-xs text-neutral-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="w-full bg-white text-black pt-[116px] min-h-screen relative font-sans">
      {/* OTP login modal */}
      <OtpLoginModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthenticated={handleAuthenticated}
        initialPhone={phone}
      />

      {/* Success overlay */}
      <AnimatePresence>
        {orderSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[200] flex flex-col items-center justify-center px-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring' }}
              className="max-w-md w-full text-center flex flex-col items-center gap-6"
            >
              <CheckCircle2 className="w-14 h-14 text-neutral-900 stroke-[1]" />

              <div className="flex flex-col gap-1 text-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400">Order Confirmed</span>
                <h1 className="font-sans text-xl sm:text-2xl font-light tracking-widest uppercase text-black">
                  {orderPaymentMethod === 'cod' ? 'Your order is on its way' : 'Payment received — thank you'}
                </h1>
                <p className="text-[11px] text-neutral-500 mt-1">
                  {orderPaymentMethod === 'cod'
                    ? 'Pay in cash when your bespoke piece arrives.'
                    : 'Your bespoke order configuration is in progress.'}
                </p>
              </div>

              <div className="w-full bg-neutral-50 border border-neutral-100 rounded p-4 text-left flex flex-col gap-3 font-sans text-xs">
                <div className="flex justify-between border-b border-neutral-100 pb-2">
                  <span className="text-neutral-500">Order Reference</span>
                  <span className="font-mono font-bold text-black uppercase">{orderNumber}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-100 pb-2">
                  <span className="text-neutral-500">Payment Method</span>
                  <span className="font-semibold text-black">
                    {orderPaymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay (paid)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Est. Studio Finishing</span>
                  <span className="font-semibold text-black">14 - 21 Days</span>
                </div>
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed max-w-sm">
                A confirmation has been forwarded to your phone via SMS / WhatsApp.
                You can track your order anytime with the reference number above.
              </p>

              <button
                id="finish-checkout-success-btn"
                onClick={handleFinish}
                className="w-full bg-black text-white hover:bg-neutral-800 py-3.5 text-xs font-bold tracking-widest uppercase rounded-sm cursor-pointer shadow transition-colors"
              >
                Back To Studio Hub
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase tracking-widest font-sans mb-10">
          <button onClick={() => navigateTo({ type: 'home' })} className="hover:text-black transition-colors">Home</button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-black font-semibold">Bespoke Checkout</span>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-12 sm:gap-16">

          {/* Left column */}
          <div className="lg:col-span-7 flex flex-col gap-10">

            {/* 0. Signed-in notice */}
            {user && (
              <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-100 rounded-lg p-3.5">
                <div className="flex items-center gap-2.5 text-xs text-emerald-900">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center font-bold">
                    {(user.name || user.phone)?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">Signed in as {user.name || user.phone}</div>
                    <div className="text-[10px] text-emerald-700/70 font-mono">+91 {user.phone?.replace(/^\+91/, '')}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { signOut(); setShowAuthModal(true); }}
                  className="text-[10px] uppercase tracking-widest text-emerald-700 hover:text-emerald-900 font-bold"
                >
                  Switch
                </button>
              </div>
            )}

            {/* 1. Contact */}
            <div className="flex flex-col gap-5 text-left">
              <h2 className="text-xs uppercase tracking-widest font-extrabold text-black font-sans border-b border-neutral-100 pb-2 flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> 1. Contact Details
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">First Name</label>
                  <input
                    id="checkout-firstname"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    className="w-full mt-1 bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Last Name</label>
                  <input
                    id="checkout-lastname"
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    className="w-full mt-1 bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Email</label>
                <div className="relative">
                  <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                  <input
                    id="checkout-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full mt-1 pl-5 bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xs text-neutral-500 font-mono mt-0.5">+91</span>
                  <input
                    id="checkout-phone"
                    type="tel"
                    inputMode="numeric"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    className="w-full mt-1 pl-14 bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* 2. Address */}
            <div className="flex flex-col gap-5 text-left">
              <h2 className="text-xs uppercase tracking-widest font-extrabold text-black font-sans border-b border-neutral-100 pb-2">
                2. Shipping Address
              </h2>
              <input
                id="checkout-address"
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street Address, Suite or Apartment"
                className="w-full bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
              />
              <div className="grid grid-cols-3 gap-4">
                <input
                  id="checkout-city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="w-full bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
                />
                <input
                  id="checkout-state"
                  type="text"
                  required
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  placeholder="State"
                  className="w-full bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
                />
                <input
                  id="checkout-zip"
                  type="text"
                  required
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="PIN / Zip"
                  className="w-full bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button type="button" onClick={checkPincode} disabled={pincodeStatus.checking} className="text-[10px] uppercase tracking-widest font-bold bg-black text-white px-3 py-2 rounded-xs hover:bg-neutral-800 disabled:bg-neutral-400 transition-colors cursor-pointer">
                  {pincodeStatus.checking ? 'Checking...' : 'Check Delivery'}
                </button>
                {pincodeStatus.message && !pincodeStatus.checking && (
                  <span className={`text-[10px] font-semibold ${pincodeStatus.serviceable === false ? 'text-red-600' : 'text-emerald-700'}`}>
                    {pincodeStatus.message}
                  </span>
                )}
              </div>
              {pincodeStatus.couriers && pincodeStatus.couriers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {pincodeStatus.couriers.slice(0, 4).map((c, i) => (
                    <span key={i} className="text-[9px] font-semibold uppercase tracking-wider bg-neutral-100 border border-neutral-200 text-neutral-600 px-2 py-1 rounded-xs">
                      {c.name}{c.estimatedDays ? ` · ${c.estimatedDays}d` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Payment method */}
            <div className="flex flex-col gap-5 text-left">
              <h2 className="text-xs uppercase tracking-widest font-extrabold text-black font-sans border-b border-neutral-100 pb-2">
                3. Payment Method
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PaymentOption
                  active={paymentMethod === 'razorpay'}
                  onClick={() => setPaymentMethod('razorpay')}
                  icon={<CreditCard className="w-4 h-4" />}
                  title="Pay Online"
                  subtitle="UPI · Cards · Net Banking · Wallets"
                  badge="Recommended"
                />
                <PaymentOption
                  active={paymentMethod === 'cod'}
                  onClick={() => setPaymentMethod('cod')}
                  icon={<Banknote className="w-4 h-4" />}
                  title="Cash on Delivery"
                  subtitle="Pay in cash when your order arrives"
                />
              </div>

              <div className="bg-neutral-50 border border-neutral-100 rounded p-3 flex items-center justify-between text-[10px] uppercase tracking-widest">
                <span className="flex items-center gap-1.5 font-bold text-neutral-800">
                  <Lock className="w-3 h-3" />
                  {paymentMethod === 'razorpay' ? 'Razorpay Secure Connect' : 'No online payment needed'}
                </span>
                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                  <ShieldCheck className="w-3 h-3" /> 256-bit SSL
                </span>
              </div>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="w-full bg-red-50 border border-red-200 rounded p-3 text-xs text-red-600 font-sans">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* TEST MODE banner + simulate button */}
            {isTestMode && paymentMethod === 'razorpay' && (
              <div className="w-full border border-amber-300 bg-amber-50 rounded p-3 flex flex-col gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 flex items-center gap-1.5">
                  🧪 Razorpay Test Mode Active
                </p>
                <p className="text-[10px] text-amber-600 leading-relaxed">
                  If the Razorpay modal fails, use the button below to simulate a successful payment and test the full order → email → confirmation flow.
                </p>
                {orderId && (
                  <button
                    id="simulate-payment-btn"
                    type="button"
                    disabled={isOrdering}
                    onClick={async () => {
                      setIsOrdering(true);
                      setErrorMsg('');
                      try {
                        const sim = await ordersAPI.simulatePayment(orderId);
                        await ordersAPI.verifyPayment({
                          razorpay_order_id: sim.razorpay_order_id,
                          razorpay_payment_id: sim.razorpay_payment_id,
                          razorpay_signature: sim.razorpay_signature,
                          orderNumber: sim.orderNumber,
                        });
                        setOrderNumber(sim.orderNumber);
                        setOrderPaymentMethod('razorpay');
                        setOrderSuccess(true);
                      } catch (err) {
                        setErrorMsg(err instanceof Error ? err.message : 'Simulation failed');
                      } finally {
                        setIsOrdering(false);
                      }
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 text-[10px] font-bold tracking-widest uppercase rounded-sm flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isOrdering ? (
                      <><div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Simulating…</>
                    ) : '🧪 Simulate Payment Success'}
                  </button>
                )}
                {!orderId && (
                  <p className="text-[10px] text-amber-500 italic">
                    First click "Pay ₹{total.toLocaleString('en-IN')}" to create the order, then use this button if the modal fails.
                  </p>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              id="submit-order-checkout-btn"
              type="submit"
              disabled={isOrdering}
              className="w-full bg-black text-white hover:bg-neutral-800 py-4 text-xs font-bold tracking-widest uppercase transition-all duration-200 rounded-sm flex items-center justify-center gap-2 cursor-pointer shadow hover:shadow-lg disabled:bg-neutral-400"
            >
              {isOrdering ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {paymentMethod === 'razorpay' ? 'Opening payment…' : 'Placing order…'}
                </>
              ) : paymentMethod === 'razorpay' ? (
                <>Pay ₹{total.toLocaleString('en-IN')} <Smartphone className="w-3.5 h-3.5 ml-1" /></>
              ) : (
                `Place COD Order • ₹${total.toLocaleString('en-IN')}`
              )}
            </button>

            <p className="text-[10px] text-neutral-400 text-center">
              By placing this order you agree to our terms of service and privacy policy.
            </p>
          </div>

          {/* Right column: summary */}
          <div className="lg:col-span-5 h-fit lg:sticky lg:top-[160px]">
            <div className="bg-neutral-50 border border-neutral-100 rounded p-6 sm:p-8 flex flex-col gap-6 text-left shadow-xs">
              <h3 className="text-xs uppercase tracking-widest font-extrabold text-black font-sans border-b border-neutral-200 pb-3">
                Purchase Summary
              </h3>

              <div className="flex flex-col gap-4 max-h-[240px] overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3.5 justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-12 bg-white rounded overflow-hidden shadow-xs shrink-0 relative">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = item.fallbackImage;
                          }}
                        />
                        <span className="absolute -top-1 -right-1 bg-black text-white font-mono text-[8px] w-4 h-4 rounded-full flex items-center justify-center scale-90 leading-none">
                          {item.quantity}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider font-semibold text-black truncate max-w-[150px]">
                          {item.name}
                        </p>
                        <p className="text-[9px] text-neutral-400 italic">₹{item.price.toLocaleString('en-IN')} each</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-medium text-black">
                      ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2.5 pt-4 border-t border-neutral-200 text-xs text-neutral-600 font-sans">
                <div className="flex justify-between items-center">
                  <span>Subtotal</span>
                  <span className="text-black font-mono">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Insured Express Shipping</span>
                  <span className="text-black font-mono">
                    {shipping === 0 ? (
                      <strong className="text-emerald-600 font-bold uppercase text-[10px] tracking-wide">FREE</strong>
                    ) : (
                      `₹${shipping}`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-neutral-200 text-black">
                  <span className="text-xs font-bold uppercase tracking-wider">Total</span>
                  <span className="text-sm font-mono font-bold font-extrabold">₹{total.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="border-t border-neutral-200 pt-4 flex flex-col gap-3 font-sans text-[10px] text-neutral-400">
                <div className="flex items-center gap-2">
                  <span className="text-black font-extrabold">✓</span>
                  <span>German ultra-durable casting resin warranty</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-black font-extrabold">✓</span>
                  <span>100% Secure SSL checkout protection</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-black font-extrabold">✓</span>
                  <span>Direct artist design review session bookings</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentOption({
  active, onClick, icon, title, subtitle, badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-lg border-2 transition-all cursor-pointer relative ${
        active ? 'border-black bg-black/[0.03]' : 'border-neutral-200 hover:border-neutral-400 bg-white'
      }`}
    >
      {badge && (
        <span className="absolute -top-2 right-3 bg-black text-white text-[8px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${active ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-700'}`}>
          {icon}
        </div>
        <span className="text-xs font-bold text-black">{title}</span>
      </div>
      <p className="text-[10px] text-neutral-500 leading-relaxed">{subtitle}</p>
    </button>
  );
}
