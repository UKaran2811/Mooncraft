import React from 'react';
import { Mail, Instagram, MessageCircle, ArrowUp, MapPin, Package, Gift, HeartHandshake } from 'lucide-react';
import { useRouter } from '../useRouter';

export default function Footer() {
  const { navigateTo } = useRouter();

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

          {/* Brand Info */}
          <div className="flex flex-col gap-4">
            <h3 className="font-sans font-black tracking-[0.25em] text-white uppercase text-base">
              Moon Craft
            </h3>
            <p className="text-sm text-neutral-400 font-sans font-light leading-relaxed max-w-sm flex items-center gap-2">
              Light up your next gift with Moon Craft
            </p>

            <ul className="text-sm text-neutral-400 flex flex-col gap-3 mt-2">
              <li className="flex items-center gap-2"><HeartHandshake className="w-4 h-4 text-neutral-500" /> Handmade stuff</li>
              <li className="flex items-center gap-2"><Gift className="w-4 h-4 text-neutral-500" /> Gift solution</li>
              <li className="flex items-center gap-2"><Package className="w-4 h-4 text-neutral-500" /> Ship World wide</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-neutral-500" /> SURAT</li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs uppercase font-extrabold tracking-widest text-white font-sans">
              Inquiry and contact
            </h4>
            <div className="flex flex-col gap-1.5 mt-2">
              <a href="mailto:monika.radadiya4757@gmail.com" className="text-sm text-neutral-300 hover:text-white transition-colors">
                monika.radadiya4757@gmail.com
              </a>
              <a href="https://wa.me/918980881747" target="_blank" rel="noreferrer" className="text-sm text-neutral-300 hover:text-white transition-colors">
                WhatsApp: +91 89808 81747
              </a>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-3 mt-4">
              <a
                href="https://www.instagram.com/moon_craft_by_moniyal?igsh=MTdhZWhocGg3a3Bpdg%3D%3D&utm_source=qr"
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-neutral-900 rounded-full hover:bg-neutral-800 hover:text-white transition-colors"
                aria-label="Instagram Profile"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="mailto:monika.radadiya4757@gmail.com"
                className="p-2 bg-neutral-900 rounded-full hover:bg-neutral-800 hover:text-white transition-colors"
                aria-label="Email Inbox"
              >
                <Mail className="w-4 h-4" />
              </a>
              <a
                href="https://wa.me/918980881747"
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-neutral-900 rounded-full hover:bg-neutral-800 hover:text-white transition-colors"
                aria-label="WhatsApp Chat"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs uppercase font-extrabold tracking-widest text-white font-sans">
              Category
            </h4>
            <div className="flex flex-col gap-2.5 font-sans text-sm text-neutral-400">
              <button onClick={() => handleQuickLink("Resin Art")} className="text-left hover:text-white transition-colors cursor-pointer">
                Resin Art
              </button>
              <button onClick={() => handleQuickLink("Handmade Gift")} className="text-left hover:text-white transition-colors cursor-pointer">
                Handmade Gift
              </button>
              <button onClick={() => handleQuickLink("Home decor")} className="text-left hover:text-white transition-colors cursor-pointer">
                Home decor
              </button>
              <button onClick={() => handleQuickLink("Personalised Gift")} className="text-left hover:text-white transition-colors cursor-pointer">
                Personalised Gift
              </button>
              <button onClick={() => handleQuickLink("Wedding Items")} className="text-left hover:text-white transition-colors cursor-pointer">
                Wedding Items
              </button>
              <button onClick={() => handleQuickLink("Festive Collection")} className="text-left hover:text-white transition-colors cursor-pointer">
                Festive Collection
              </button>
            </div>
          </div>


          {/* Custom Project Inquiry */}
          <div className="flex flex-col gap-4">
            <h4 className="text-xs uppercase font-extrabold tracking-widest text-white font-sans">
              Customize Project
            </h4>
            <p className="text-sm text-neutral-400 font-sans font-light leading-relaxed">
              Have a unique idea? Let's bring it to life.
            </p>
            <form className="flex flex-col gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); alert("Inquiry submitted!"); }}>
              <input type="text" placeholder="Your Name" required className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-neutral-600 transition-colors" />
              <input type="email" placeholder="Your Email" required className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-neutral-600 transition-colors" />
              <textarea placeholder="Tell us about your project..." rows={3} required className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-hidden focus:border-neutral-600 transition-colors resize-none"></textarea>
              <button type="submit" className="bg-white text-black text-xs uppercase tracking-widest font-bold py-2.5 rounded hover:bg-neutral-200 transition-colors mt-1 cursor-pointer">Submit Inquiry</button>
            </form>
          </div>
        </div>

        {/* Bottom Segment: Copyright & Policies */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 pt-8 font-sans text-[11px] text-neutral-500 font-light">
          <p>© {year} Moon Craft. Handcrafted luxury from local studios.</p>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a href="#/" className="hover:text-white transition-colors">Shipping & Returns Policy</a>
            <a href="#/" className="hover:text-white transition-colors">Privacy Policy</a>
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
