'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import RestaurantSettings from '@/data/restaurant.json';
import { trackEvent } from '@/lib/analytics';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [language, setLanguage] = useState<'en' | 'am'>('en');
  const isAmharic = language === 'am';

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('language');
    if (saved === 'am' || saved === 'en') {
      setLanguage(saved);
    }

    // Track homepage visit
    trackEvent({
      eventType: 'page_view',
    });
  }, []);

  const handleLanguageToggle = (lang: 'en' | 'am') => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  if (!mounted) return null;

  const resName = isAmharic && RestaurantSettings.name.am ? RestaurantSettings.name.am : RestaurantSettings.name.en;
  const resTagline = isAmharic && RestaurantSettings.tagline?.am ? RestaurantSettings.tagline.am : RestaurantSettings.tagline?.en;
  const resDescription = isAmharic && RestaurantSettings.description?.am ? RestaurantSettings.description.am : RestaurantSettings.description?.en;
  const resAddress = isAmharic && RestaurantSettings.address?.am ? RestaurantSettings.address.am : RestaurantSettings.address?.en;

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-100 via-cream-50 to-white dark:from-restaurant-bg-dark dark:via-slate-900 dark:to-slate-800">
      {/* Hero Section */}
      <div className="relative w-full">
        <div className="absolute inset-0 overflow-hidden opacity-20 dark:opacity-10">
          <svg
            className="absolute top-0 left-0 w-full h-64"
            viewBox="0 0 1200 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,200 Q300,0 600,200 T1200,200"
              stroke="currentColor"
              strokeWidth="2"
              className="text-restaurant-accent"
            />
          </svg>
        </div>

        <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center gap-2">
            <div className="text-2xl sm:text-3xl font-serif font-bold text-restaurant-accent">
              {resName}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center rounded-lg border border-cream-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 shadow-xs text-xs font-bold">
              <button
                type="button"
                onClick={() => handleLanguageToggle('en')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  !isAmharic ? 'bg-restaurant-accent text-white shadow-xs' : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => handleLanguageToggle('am')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  isAmharic ? 'bg-restaurant-accent text-white shadow-xs' : 'text-stone-600 dark:text-stone-300 hover:text-stone-900'
                }`}
              >
                አማ
              </button>
            </div>

            <Link
              href="/menu"
              className="px-3 sm:px-4 py-2 bg-restaurant-accent text-white rounded-lg hover:bg-restaurant-accent-dark transition-colors text-sm sm:text-base font-medium"
            >
              {isAmharic ? 'ሜኑ እይ' : 'View Menu'}
            </Link>

            <Link
              href="/admin/login"
              className="px-3 sm:px-4 py-2 text-restaurant-accent hover:text-restaurant-accent-dark transition-colors text-sm sm:text-base font-medium"
            >
              {isAmharic ? 'አስተዳደር' : 'Admin'}
            </Link>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-restaurant-text dark:text-white mb-4 sm:mb-6">
            {resName}
          </h1>

          <p className="text-xl sm:text-2xl text-restaurant-accent mb-2">
            {resTagline}
          </p>

          <p className="text-base sm:text-lg text-restaurant-text-light dark:text-gray-300 max-w-2xl mx-auto mb-8 sm:mb-12">
            {resDescription}
          </p>

          <Link
            href="/menu"
            className="inline-block px-8 sm:px-12 py-3 sm:py-4 bg-restaurant-accent text-white rounded-lg hover:bg-restaurant-accent-dark transition-colors text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl"
          >
            {isAmharic ? 'የምግብ ዝርዝሩን ይመልከቱ' : 'Explore Our Menu'}
          </Link>
        </div>

        {/* Features */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="text-center">
            <div className="text-3xl sm:text-4xl mb-2">🍽️</div>

            <h3 className="font-serif text-lg sm:text-xl font-bold text-restaurant-text dark:text-white mb-2">
              {isAmharic ? 'ተወዳጅ ምግቦች' : 'Authentic Cuisine'}
            </h3>

            <p className="text-sm sm:text-base text-restaurant-text-light dark:text-gray-300">
              {isAmharic ? 'በጥንቃቄና በጥራት የተዘጋጁ ጣፋጭ ምግቦች' : 'Traditional Ethiopian dishes prepared with care'}
            </p>
          </div>

          <div className="text-center">
            <div className="text-3xl sm:text-4xl mb-2">📱</div>

            <h3 className="font-serif text-lg sm:text-xl font-bold text-restaurant-text dark:text-white mb-2">
              {isAmharic ? 'ዘመናዊ ዲጂታል ሜኑ' : 'Digital Menu'}
            </h3>

            <p className="text-sm sm:text-base text-restaurant-text-light dark:text-gray-300">
              {isAmharic ? 'ምግቦችን በቀላሉ ለመፈለግ እና ለመምረጥ የተዘጋጀ' : 'Easy to browse, search, and filter items'}
            </p>
          </div>

          <div className="text-center">
            <div className="text-3xl sm:text-4xl mb-2">🌍</div>

            <h3 className="font-serif text-lg sm:text-xl font-bold text-restaurant-text dark:text-white mb-2">
              {isAmharic ? 'በሁለት ቋንቋ የቀረበ' : 'Multilingual'}
            </h3>

            <p className="text-sm sm:text-base text-restaurant-text-light dark:text-gray-300">
              {isAmharic ? 'በአማርኛ እና በእንግሊዝኛ ቋንቋዎች የቀረበ' : 'Available in English and Amharic'}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-cream-200 dark:border-slate-800 mt-16 sm:mt-20 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="font-serif text-lg font-bold text-restaurant-text dark:text-white mb-4">
                {resName}
              </h3>

              <p className="text-sm sm:text-base text-restaurant-text-light dark:text-gray-300 mb-4">
                {resAddress}
              </p>

              <p className="text-sm sm:text-base">
                <span className="text-restaurant-text-light dark:text-gray-300">
                  {isAmharic ? 'ስልክ: ' : 'Phone: '}
                </span>

                <a
                  href={`tel:${RestaurantSettings.phone}`}
                  className="text-restaurant-accent hover:text-restaurant-accent-dark font-medium"
                >
                  {RestaurantSettings.phone}
                </a>
              </p>
            </div>

            <div>
              <h3 className="font-serif text-lg font-bold text-restaurant-text dark:text-white mb-4">
                {isAmharic ? 'የስራ ሰዓት' : 'Hours'}
              </h3>

              <div className="text-sm space-y-1 text-restaurant-text-light dark:text-gray-300">
                <p>{RestaurantSettings.openingHours.monday}</p>
                <p className="text-xs">
                  {isAmharic ? 'ለቅዳሜና እሁድ ሰዓቶች ደውለው ይጠይቁ' : 'Check for weekend hours'}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-cream-200 dark:border-slate-800 pt-6 sm:pt-8 text-center text-xs sm:text-sm text-restaurant-text-light dark:text-gray-400">
            <p>
              &copy; {new Date().getFullYear()}{' '}
              {resName}. {isAmharic ? 'መብቱ በህግ የተጠበቀ ነው።' : 'All rights reserved.'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}