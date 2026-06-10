import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import { Product } from '../types';
import { useCartStore } from '../useCartStore';
import { useRouter } from '../useRouter';
import type { MouseEvent } from 'react';

export default function ProductCard({ product }: { product: Product; key?: any }) {
  const { addItem } = useCartStore();
  const { navigateTo } = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [imgSrc, setImgSrc] = useState(product.image);

  const handleCardClick = () => {
    navigateTo({ type: 'product', id: product.id });
  };

  const handleQuickAdd = (e: MouseEvent) => {
    e.stopPropagation(); // Avoid triggering route navigation
    addItem(product);
  };

  return (
    <div 
      className="group flex flex-col cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Image Container with 4:5 aspect ratio */}
      <div className="relative aspect-4/5 w-full bg-zinc-100 overflow-hidden mb-3 border border-zinc-100">
        <motion.img
          src={imgSrc}
          alt={product.name}
          animate={{ scale: isHovered ? 1.05 : 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full h-full object-cover grayscale-[0.05] group-hover:grayscale-0 transition-all duration-700"
          onError={() => {
            // Fall back to custom luxurious Unsplash photo
            setImgSrc(product.fallbackImage);
          }}
        />

        {/* Dynamic Sliding Quick Add overlay matching Design HTML */}
        <div 
          onClick={handleQuickAdd}
          className={`absolute bottom-0 left-0 right-0 bg-white/95 py-3.5 text-center text-[10px] tracking-[0.2em] font-bold uppercase transition-all duration-300 cursor-pointer border-t border-zinc-100 ${
            isHovered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}
        >
          Quick Add
        </div>
      </div>

      {/* Text Info Below */}
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-[0.15em] text-zinc-900 group-hover:text-zinc-500 transition-colors line-clamp-1">
          {product.name}
        </h3>
        <p className="text-xs text-zinc-500 font-medium">
          ₹{product.price.toLocaleString('en-IN')}
        </p>
      </div>
    </div>
  );
}
