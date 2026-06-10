import { motion } from 'motion/react';
import { useRouter } from '../useRouter';

export default function CategoryMarquee() {
  const { navigateTo } = useRouter();

  const categories = [
    {
      title: "Custom Resin Art",
      subtitle: "Bespoke preservation & custom wall clocks",
      tag: "Resin Art",
      image: "/images/8 inch resin photo frame, price 1500.jpeg",
    },
    {
      title: "Wedding Favors",
      subtitle: "Bells, custom invites & bride keepsakes",
      tag: "Wedding Favors",
      image: "/images/Wedding Invite, price 2000.jpeg",
    },
    {
      title: "Festive Gifting",
      subtitle: "Luxury pooja trays, rakhis & divine decor",
      tag: "Festive Gifting",
      image: "/images/Pooja Tilak Tray, price 2000.jpeg",
    }
  ];

  const scrollingText = [
    "ELEGANT RESIN PRESERVATION",
    "CUSTOM WEDDING INVITATIONS",
    "LUXURIOUS DESIGN INSPIRED BY NATURE",
    "HANDCRAFTED HERITAGE ART",
    "PRESTIGE BOTANICAL CLOCKS"
  ];

  return (
    <section className="w-full flex flex-col gap-12 sm:gap-20">
      
      {/* Editorial Text Marquee */}
      <div className="w-full bg-neutral-900 text-white/95 py-3.5 overflow-hidden border-y border-neutral-800">
        <div className="flex whitespace-nowrap gap-8 w-max anim-marquee">
          {/* First loop */}
          <div className="flex gap-12 items-center text-[10px] sm:text-xs font-sans tracking-[0.25em] font-semibold uppercase">
            {scrollingText.map((text, i) => (
              <span key={`1-${i}`} className="flex items-center gap-3">
                <span>{text}</span>
                <span className="text-neutral-500 text-xs">•</span>
              </span>
            ))}
          </div>
          {/* Same replica for seamless loop */}
          <div className="flex gap-12 items-center text-[10px] sm:text-xs font-sans tracking-[0.25em] font-semibold uppercase">
            {scrollingText.map((text, i) => (
              <span key={`2-${i}`} className="flex items-center gap-3">
                <span>{text}</span>
                <span className="text-neutral-500 text-xs">•</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Styled Grid Category Banners */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex flex-col gap-4 text-center max-w-2xl mx-auto mb-10">
          <span className="text-[10px] font-sans font-extrabold tracking-[0.25em] uppercase text-neutral-400">Curated Offerings</span>
          <h2 className="font-sans text-xl sm:text-2xl font-light tracking-widest uppercase text-black">Shop By Collections</h2>
          <div className="w-8 h-[1px] bg-neutral-300 mx-auto"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {categories.map((cat, idx) => (
            <div 
              key={idx}
              onClick={() => navigateTo({ type: 'shop', filterCategory: cat.tag })}
              className="group relative h-[320px] sm:h-[400px] w-full overflow-hidden rounded-xs border border-neutral-100 cursor-pointer shadow-xs hover:shadow-lg transition-shadow duration-500"
            >
              {/* Background Cover Image */}
              <div className="absolute inset-0 bg-neutral-900">
                <img 
                  src={cat.image} 
                  alt={cat.title} 
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity duration-700 scale-100 group-hover:scale-105 transition-transform"
                />
              </div>

              {/* Text overlays with minimal layout */}
              <div className="absolute inset-0 p-6 flex flex-col justify-end bg-gradient-to-t from-black/60 via-black/10 to-transparent">
                <div className="flex flex-col gap-1 items-start text-left">
                  <span className="text-[9px] font-sans font-bold tracking-[0.2em] text-neutral-300 uppercase bg-black/40 px-2 py-0.5 rounded-sm">
                    Collection
                  </span>
                  <h3 className="font-sans text-base sm:text-lg font-light tracking-widest text-white uppercase mt-1">
                    {cat.title}
                  </h3>
                  <p className="text-[11px] font-sans font-light text-neutral-300 tracking-wide leading-relaxed line-clamp-1">
                    {cat.subtitle}
                  </p>
                  
                  {/* Subtle underline hover effect */}
                  <div className="flex items-center gap-1.5 mt-3 group-hover:translate-x-1 transition-transform">
                    <span className="text-[10px] font-sans font-bold tracking-widest text-white uppercase">
                      Discover Here
                    </span>
                    <span className="text-white text-[11px] font-sans font-bold">→</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Styled animation values in App css */}
      <style>{`
        .anim-marquee {
          animation: marquee 18s linear infinite;
        }
        @keyframes marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </section>
  );
}
