import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { Mail, Instagram, MessageCircle, ArrowUp, ArrowRight } from 'lucide-react';
import { useRouter } from '../useRouter';

export default function Footer() {
  const { navigateTo } = useRouter();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [inquiryText, setInquiryText] = useState('');
  const [inquirySent, setInquirySent] = useState(false);

  const handleSubscribe = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim() !== '') {
      setSubscribed(true);
      setTimeout(() => setSubscribed(false), 5000);
      setEmail('');
    }
  };

  const handleInquiry = (e: FormEvent) => {
    e.preventDefault();
    if (inquiryText.trim() !== '') {
      setInquirySent(true);
      setTimeout(() => setInquirySent(false), 5000);
      setInquiryText('');
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickLink = (category?: string) => {
    if (category) {
      navigateTo({ type: 'shop', filterCategory: category });
    } else {
      navigateTo({ type: 'shop' });
    }
  };

  const year = new Date().getFullYear();

  return (
    <footer id="contact-section" className="bg-neutral-950 text-neutral-300 pt-16 pb-8 border-t border-neutral-900 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Segment: Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 pb-14 border-b border-neutral-900">
          
          {/* Brand Info & Socials */}
          <div className="flex flex-col gap-4">
            <h3 className="font-sans font-black tracking-[0.25em] text-white uppercase text-base">
              MOONCRAFT
            </h3>
            <p className="text-xs text-neutral-400 font-sans font-light leading-relaxed max-w-sm">
              We preserve memory. Our craft is creating custom floral resin art, bespoke bridal keepsakes, and heirloom wedding gifts. Every piece is completely unique, cured by hand over weeks in our studio.
            </p>
            
            {/* Quick Inquiry / Contact info */}
            <div className="flex flex-col gap-1.5 mt-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500">Inquire & Consult</span>
              <p className="text-xs text-neutral-300 font-mono">boutique@mooncraft.in</p>
              <p className="text-[11px] text-neutral-400">Response time: within 24 hours</p>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-3 mt-1">
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noreferrer"
                className="p-2 bg-neutral-900 rounded-full hover:bg-neutral-800 hover:text-white transition-colors"
                aria-label="Instagram Profile"
              >
                <Instagram className="w-3.5 h-3.5" />
              </a>
              <a 
                href="https://wa.me" 
                target="_blank" 
                rel="noreferrer"
                className="p-2 bg-neutral-900 rounded-full hover:bg-neutral-800 hover:text-white transition-colors animate-pulse"
                aria-label="WhatsApp Hotline"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </a>
              <a 
                href="mailto:boutique@mooncraft.in" 
                className="p-2 bg-neutral-900 rounded-full hover:bg-neutral-800 hover:text-white transition-colors"
                aria-label="Email Inbox"
              >
                <Mail className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs uppercase font-extrabold tracking-widest text-white font-sans">
              Boutique Directory
            </h4>
            <div className="flex flex-col gap-2.5 font-sans text-xs text-neutral-400">
              <button 
                onClick={() => handleQuickLink()} 
                className="text-left hover:text-white transition-colors cursor-pointer"
              >
                Shop Full Catalogue
              </button>
              <button 
                onClick={() => handleQuickLink("Resin Art")} 
                className="text-left hover:text-white transition-colors cursor-pointer"
              >
                Heirloom Resin Art
              </button>
              <button 
                onClick={() => handleQuickLink("Wedding Favors")} 
                className="text-left hover:text-white transition-colors cursor-pointer"
              >
                Bespoke Wedding Gifts
              </button>
              <button 
                onClick={() => handleQuickLink("Festive Gifting")} 
                className="text-left hover:text-white transition-colors cursor-pointer"
              >
                Pooja & Festive Decor
              </button>
              <button 
                onClick={() => handleQuickLink("Accessories")} 
                className="text-left hover:text-white transition-colors cursor-pointer"
              >
                Pocket Keepsakes
              </button>
            </div>
          </div>

          {/* Care Instructions / FAQs */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs uppercase font-extrabold tracking-widest text-white font-sans">
              Resin Care Guidelines
            </h4>
            <div className="flex flex-col gap-3 font-sans text-xs text-neutral-400">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-neutral-300">UV Preservation</span>
                <p className="text-[11px] leading-relaxed text-neutral-500">
                  Keep out of prolonged direct summer sunlight to prevent yellowing or resin softening.
                </p>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-neutral-300">Micro-fiber Polishing</span>
                <p className="text-[11px] leading-relaxed text-neutral-500">
                  Wipe lightly using a completely dry microfiber cloth. Do not scrub or polish with chemical glass fluids.
                </p>
              </div>
            </div>
          </div>

          {/* Combined Newsletter & Custom Booking Inquiry form */}
          <div className="flex flex-col gap-6">
            
            {/* Newsletter */}
            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs uppercase font-extrabold tracking-widest text-white font-sans">
                The Journal
              </h4>
              <p className="text-[11px] text-neutral-500 leading-relaxed font-sans font-light">
                Subscribe to receive early notifications for raw seasonal floral collections, sample sales, and styling tips.
              </p>
              <form onSubmit={handleSubscribe} className="relative flex items-center border-b border-neutral-700 py-1.5">
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your Email Address"
                  required
                  className="w-full bg-transparent text-xs text-white placeholder-neutral-600 focus:outline-hidden pr-8 font-sans"
                />
                <button 
                  type="submit" 
                  className="absolute right-0 hover:text-white transition-colors cursor-pointer"
                  aria-label="Subscribe"
                >
                  <ArrowRight className="w-4 h-4 text-neutral-500 hover:text-white transition-colors" />
                </button>
              </form>
              {subscribed && (
                <span className="text-[10px] text-emerald-400 font-sans tracking-wide">
                  Thank you. You are on the curated roster.
                </span>
              )}
            </div>

            {/* Light Consultation Inquiry */}
            <div className="flex flex-col gap-2">
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 font-sans">
                Request Custom Consultation
              </h4>
              <form onSubmit={handleInquiry} className="flex flex-col gap-2">
                <textarea
                  value={inquiryText}
                  onChange={(e) => setInquiryText(e.target.value)}
                  placeholder="Tell us about your wedding date, garland, or photo design ideas..."
                  rows={2}
                  required
                  className="w-full bg-neutral-900 border border-neutral-800 rounded p-2 text-xs text-white placeholder-neutral-600 focus:outline-hidden focus:border-neutral-700 font-sans"
                />
                <button 
                  type="submit"
                  className="px-4 py-2 bg-white text-black font-sans uppercase font-bold text-[9px] tracking-widest hover:bg-neutral-200 transition-colors rounded-sm cursor-pointer self-start"
                >
                  Send Request
                </button>
              </form>
              {inquirySent && (
                <span className="text-[10px] text-emerald-400 font-sans tracking-wide">
                  Consultation request submitted successfully.
                </span>
              )}
            </div>

          </div>

        </div>

        {/* Bottom Segment: Copyright & Policies */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 pt-8 font-sans text-[11px] text-neutral-500 font-light">
          <p>© {year} Mooncraft Bespoke. Handcrafted luxury from local studios.</p>
          
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a href="#/" className="hover:text-white transition-colors">Care Guide</a>
            <a href="#/" className="hover:text-white transition-colors">Shipping & Returns Policy</a>
            <a href="#/" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#/" className="hover:text-white transition-colors">In-Store Pickup</a>
          </div>

          <button 
            onClick={scrollToTop}
            className="flex items-center gap-1.5 p-2 bg-neutral-900 rounded-full hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
            aria-label="Back to Top"
          >
            <span className="sr-only">Back to Top</span>
            <ArrowUp className="w-3 h-3 text-neutral-400" />
          </button>
        </div>

      </div>
    </footer>
  );
}
