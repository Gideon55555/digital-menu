'use client';

import { RestaurantSettings, Language } from '@/lib/types';
import { Moon, Sun, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface MenuHeaderProps {
  restaurant: RestaurantSettings;
  onLanguageChange?: (language: Language) => void;
  currentLanguage?: Language;
}

export function MenuHeader({
  restaurant,
  onLanguageChange,
  currentLanguage = 'en',
}: MenuHeaderProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme');
    const isDarkMode = saved === 'dark';
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setIsDark(isDarkMode);
  }, []);

  const toggleDarkMode = () => {
    if (mounted) {
      const html = document.documentElement;
      const nextDark = !isDark;
      if (nextDark) {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      setIsDark(nextDark);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-cream-200 dark:border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo/Title */}
          <Link href="/menu" className="flex items-center gap-2 flex-shrink-0 group">
            <div className="text-2xl font-serif font-bold text-restaurant-accent group-hover:text-restaurant-accent-dark transition-colors">
              {restaurant.name.en}
            </div>
          </Link>

          {/* Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Language Switcher */}
            {restaurant.availableLanguages.length > 1 && (
              <div className="flex items-center gap-2 bg-cream-50 dark:bg-slate-800 rounded-lg p-1">
                {restaurant.availableLanguages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => onLanguageChange?.(lang)}
                    className={`px-2 sm:px-3 py-1 rounded text-sm font-medium transition-all ${
                      currentLanguage === lang
                        ? 'bg-restaurant-accent text-white'
                        : 'text-restaurant-text-light dark:text-gray-400 hover:text-restaurant-text dark:hover:text-white'
                    }`}
                    title={lang === 'en' ? 'English' : 'Amharic'}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 hover:bg-cream-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Toggle dark mode"
            >
              {mounted &&
                (isDark ? (
                  <Sun size={20} className="text-yellow-500" />
                ) : (
                  <Moon size={20} className="text-slate-600" />
                ))}
            </button>

            {/* Contact Link */}
            <a
              href={`tel:${restaurant.phone}`}
              className="hidden sm:flex items-center gap-2 px-3 py-2 bg-restaurant-accent/10 text-restaurant-accent hover:bg-restaurant-accent/20 rounded-lg transition-colors text-sm font-medium"
              title="Call restaurant"
            >
              <Globe size={16} />
              <span className="text-xs">{restaurant.phone}</span>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
