import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useCartStore } from '../useCartStore';
import { useRouter } from '../useRouter';
import { ShieldCheck, Lock, CreditCard, ChevronRight, CheckCircle2, ShoppingBag } from 'lucide-react';
import { ordersAPI } from '../services/api';

export default function Checkout() {
  const { items, clearCart } = useCartStore();
  const { navigateTo } = useRouter();

  // Form states
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  // App states
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal > 1500 ? 0 : 250;
  const total = subtotal + shipping;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setIsOrdering(true);
    setErrorMsg('');

    try {
      const orderPayload = {
        customer: {
          name: `${firstName} ${lastName}`.trim(),
          email,
          phone,
          address: { line1: address, city, state, zip: zipCode },
        },
        items: items.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          selectedOption: item.selectedOption,
        })),
        paymentMethod: 'cod', // Change to 'razorpay' when Razorpay keys are live
      };

      const res = await ordersAPI.place(orderPayload);

      // ── If Razorpay is configured, open Razorpay checkout modal ──
      if (res.razorpayOrderId && res.razorpayKeyId) {
        const options = {
          key: res.razorpayKeyId,
          amount: res.amount * 100,
          currency: 'INR',
          name: 'Mooncraft Studio',
          description: 'Bespoke Resin Art Order',
          order_id: res.razorpayOrderId,
          handler: async (payment: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            await ordersAPI.verifyPayment({
              razorpay_order_id: payment.razorpay_order_id,
              razorpay_payment_id: payment.razorpay_payment_id,
              razorpay_signature: payment.razorpay_signature,
              orderNumber: res.orderNumber,
            });
            setOrderNumber(res.orderNumber);
            setOrderSuccess(true);
          },
          prefill: { name: `${firstName} ${lastName}`, email, contact: phone },
          theme: { color: '#111111' },
          modal: {
            ondismiss: () => setIsOrdering(false),
          },
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        return; // Don't clear cart until payment confirmed
      }

      // ── COD / no Razorpay → order already confirmed by backend ──
      setOrderNumber(res.orderNumber);
      setOrderSuccess(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to place order. Please try again.');
    } finally {
      setIsOrdering(false);
    }
  };

  const handleFinish = () => {
    clearCart();
    setOrderSuccess(false);
    navigateTo({ type: 'home' });
  };


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

  return (
    <div className="w-full bg-white text-black pt-[116px] min-h-screen relative font-sans">
      
      {/* Checkout Success Screen Modal Overlay */}
      <AnimatePresence>
        {orderSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[200] flex flex-col items-center justify-center px-4 "
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
                <h1 className="font-sans text-xl sm:text-2xl font-light tracking-widest uppercase text-black">Amehtyxbypour has captured your memory</h1>
                <p className="text-[11px] text-neutral-500 mt-1">Your bespoke order configuration is in progress.</p>
              </div>

              <div className="w-full bg-neutral-50 border border-neutral-100 rounded p-4 text-left flex flex-col gap-3 font-sans text-xs">
                <div className="flex justify-between border-b border-neutral-100 pb-2">
                  <span className="text-neutral-500">Order Reference</span>
                  <span className="font-mono font-bold text-black uppercase">{orderNumber}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-100 pb-2">
                  <span className="text-neutral-500">Est. Studio Finishing</span>
                  <span className="font-semibold text-black">14 - 21 Days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Delivery Status</span>
                  <span className="font-semibold text-neutral-700 italic">Insured Cargo Dispatch</span>
                </div>
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed max-w-sm">
                A confirmation email has been forwarded to <strong className="text-neutral-800 font-medium">{email || 'your-email@sample.com'}</strong> with your digital consultation booking form.
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

      {/* Normal Checkout Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        
        {/* Breadcrumb section */}
        <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase tracking-widest font-sans mb-10">
          <button onClick={() => navigateTo({ type: 'home' })} className="hover:text-black transition-colors">Home</button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-black font-semibold">Bespoke Checkout</span>
        </div>

        {/* Form Grid */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-12 sm:gap-16">
          
          {/* Left Column: Input Form (Borders only!) */}
          <div className="lg:col-span-7 flex flex-col gap-10">
            
            {/* Contact details */}
            <div className="flex flex-col gap-5 text-left">
              <h2 className="text-xs uppercase tracking-widest font-extrabold text-black font-sans border-b border-neutral-100 pb-2">
                1. Contact Details
              </h2>
              <div className="relative">
                <input
                  id="checkout-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
                />
              </div>
            </div>

            {/* Delivery address */}
            <div className="flex flex-col gap-5 text-left">
              <h2 className="text-xs uppercase tracking-widest font-extrabold text-black font-sans border-b border-neutral-100 pb-2">
                2. Shipping Address
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <input
                  id="checkout-firstname"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  className="w-full bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
                />
                <input
                  id="checkout-lastname"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  className="w-full bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
                />
              </div>

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
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className="w-full bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
                />
                <input
                  id="checkout-zip"
                  type="text"
                  required
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="Zip / Postal"
                  className="w-full bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
                />
              </div>

              <input
                id="checkout-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile Number (for Courier alerts)"
                className="w-full bg-transparent border-b border-neutral-300 py-2.5 text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans tracking-wide transition-colors"
              />
            </div>

            {/* Simulated Payment details */}
            <div className="flex flex-col gap-5 text-left">
              <h2 className="text-xs uppercase tracking-widest font-extrabold text-black font-sans border-b border-neutral-100 pb-2">
                3. Secure Payment Gateway
              </h2>

              <div className="bg-neutral-50 border border-neutral-100 rounded p-4 flex flex-col gap-4">
                {/* Shield header */}
                <div className="flex items-center justify-between text-neutral-400 text-[10px] uppercase tracking-widest">
                  <span className="flex items-center gap-1.5 font-bold text-neutral-800">
                    <Lock className="w-3.5 h-3.5 text-black" />
                    Stripe / Razorpay Secure Connect
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Encrypted
                  </span>
                </div>

                {/* Card input */}
                <div className="grid grid-cols-1 gap-4 mt-1">
                  <div className="relative">
                    <input
                      id="checkout-cardnumber"
                      type="text"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                      maxLength={19}
                      placeholder="Card Number"
                      className="w-full bg-white border border-neutral-200 p-3 rounded-xs text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans"
                    />
                    <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <input
                      id="checkout-cardexpiry"
                      type="text"
                      required
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      placeholder="MM / YY"
                      maxLength={5}
                      className="w-full bg-white border border-neutral-200 p-3 rounded-xs text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans"
                    />
                    <input
                      id="checkout-cardcvv"
                      type="password"
                      required
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      placeholder="CVV"
                      maxLength={4}
                      className="w-full bg-white border border-neutral-200 p-3 rounded-xs text-xs text-black placeholder-neutral-400 focus:outline-hidden focus:border-black font-sans"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="w-full bg-red-50 border border-red-200 rounded p-3 text-xs text-red-600 font-sans">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Proceed Actions Button */}
            <button
              id="submit-order-checkout-btn"
              type="submit"
              disabled={isOrdering}
              className="w-full bg-black text-white hover:bg-neutral-800 py-4 text-xs font-bold tracking-widest uppercase transition-all duration-200 rounded-sm flex items-center justify-center gap-2 cursor-pointer shadow hover:shadow-lg disabled:bg-neutral-400"
            >
              {isOrdering ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Processing Order...
                </>
              ) : (
                `Place Order • ₹${total.toLocaleString('en-IN')}`
              )}
            </button>
          </div>

          {/* Right Column: Order Summary pane */}
          <div className="lg:col-span-5 h-fit lg:sticky lg:top-[160px]">
            <div className="bg-neutral-50 border border-neutral-100 rounded p-6 sm:p-8 flex flex-col gap-6 text-left shadow-xs">
              <h3 className="text-xs uppercase tracking-widest font-extrabold text-black font-sans border-b border-neutral-200 pb-3">
                Purchase Summary
              </h3>

              {/* Items checklist */}
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

              {/* Pricing details */}
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

              {/* Coupon / Promo code area */}
              <div className="flex gap-2 pt-2">
                <input 
                  type="text" 
                  placeholder="GIFTCOUPON / PROMO" 
                  className="bg-white border border-neutral-200 flex-1 p-2 rounded-xs text-[10px] uppercase font-mono tracking-wider text-black focus:outline-hidden"
                />
                <button 
                  type="button" 
                  onClick={() => alert("Curated Wedding & Festive discounts are activated automatically. Max coupon benefits applied.")}
                  className="bg-black/90 hover:bg-black text-white text-[10px] uppercase tracking-widest font-bold px-4 py-2 rounded-xs transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>

              {/* Trust badges footer */}
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
