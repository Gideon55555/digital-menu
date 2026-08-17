'use client';

import { MenuCategory } from '@/lib/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface CategoryNavProps {
  categories: MenuCategory[];
  selectedCategoryId?: string;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoryNav({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryNavProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    container?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    return () => {
      container?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      const newScroll =
        scrollContainerRef.current.scrollLeft +
        (direction === 'left' ? -scrollAmount : scrollAmount);
      scrollContainerRef.current.scrollTo({
        left: newScroll,
        behavior: 'smooth',
      });
    }
  };

  const visibleCategories = categories.filter((cat) => cat.visible);

  return (
    <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-cream-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="p-2 hover:bg-cream-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
              aria-label="Scroll left"
            >
              <ChevronLeft size={20} className="text-restaurant-accent" />
            </button>
          )}

          <div
            ref={scrollContainerRef}
            className="flex gap-2 overflow-x-auto scroll-smooth flex-1"
            style={{ scrollBehavior: 'smooth' }}
          >
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => onSelectCategory(category.id)}
                className={`px-4 py-3 whitespace-nowrap text-sm font-medium rounded-lg transition-all flex-shrink-0 border ${
                  selectedCategoryId === category.id
                    ? 'bg-restaurant-accent text-white border-restaurant-accent'
                    : 'bg-cream-50 dark:bg-slate-800 text-restaurant-text dark:text-white border-cream-200 dark:border-slate-700 hover:border-restaurant-accent'
                }`}
              >
                <span className="mr-2">{getIconEmoji(category.icon)}</span>
                {category.name.en}
              </button>
            ))}
          </div>

          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="p-2 hover:bg-cream-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
              aria-label="Scroll right"
            >
              <ChevronRight size={20} className="text-restaurant-accent" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getIconEmoji(icon?: string): string {
  const iconMap: Record<string, string> = {
    Coffee: '☕',
    Utensils: '🍽️',
    Leaf: '🌿',
    Users: '👥',
  };
  return iconMap[icon || ''] || '🍽️';
}
