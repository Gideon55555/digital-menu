'use client';

import { MenuItem } from '@/lib/types';
import { formatPrice } from '@/lib/utils/common';
import { Heart, Info } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

interface FoodCardProps {
  item: MenuItem;
  onFavorite?: (id: string, isFavorite: boolean) => void;
  isFavorite?: boolean;
  onClick?: () => void;
}

export function FoodCard({
  item,
  onFavorite,
  isFavorite = false,
  onClick,
}: FoodCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`restaurant-card overflow-hidden cursor-pointer group transition-all duration-300 ${
        !item.available ? 'opacity-60' : ''
      }`}
    >
      {/* Image Container */}
      <div className="relative w-full h-48 bg-gradient-to-br from-cream-100 to-cream-200 dark:from-slate-800 dark:to-slate-900 overflow-hidden">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name.en}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-6xl opacity-10">🍽️</div>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end">
          {!item.available && (
            <div className="bg-red-500/90 text-white px-2 py-1 rounded text-xs font-semibold">
              SOLD OUT
            </div>
          )}
          {item.featured && (
            <div className="bg-restaurant-accent/90 text-white px-2 py-1 rounded text-xs font-semibold">
              FEATURED
            </div>
          )}
          {item.fasting && (
            <div className="bg-green-500/90 text-white px-2 py-1 rounded text-xs font-semibold">
              FASTING
            </div>
          )}
        </div>

        {/* Overlay on hover */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <Info className="text-white" size={24} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <h3 className="font-serif font-bold text-restaurant-text dark:text-white line-clamp-2">
              {item.name.en}
            </h3>
            {item.name.am && (
              <p className="text-sm text-restaurant-text-light dark:text-gray-400">
                {item.name.am}
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavorite?.(item.id, !isFavorite);
            }}
            className="flex-shrink-0 p-1 hover:bg-cream-200 dark:hover:bg-slate-800 rounded transition-colors"
          >
            <Heart
              size={20}
              className={isFavorite ? 'fill-red-500 text-red-500' : 'text-restaurant-text-light'}
            />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-restaurant-text-light dark:text-gray-400 line-clamp-2 mb-3">
          {item.description.en}
        </p>

        {/* Indicators */}
        <div className="flex flex-wrap gap-1 mb-3">
          {item.vegetarian && (
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
              🌱 Vegetarian
            </span>
          )}
          {item.spicy && (
            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
              🌶️ Spicy
            </span>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="font-serif font-bold text-lg text-restaurant-accent">
            {formatPrice(item.price, item.currency)}
          </span>
          <span className={`text-xs font-semibold ${
            item.available
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {item.available ? 'Available' : 'Sold Out'}
          </span>
        </div>
      </div>
    </div>
  );
}
