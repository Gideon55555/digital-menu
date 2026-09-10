
'use client';

import { useEffect, useState } from 'react';
import { RestaurantSettings } from '@/lib/types';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext';
import { Save } from 'lucide-react';
import restaurant from '@/data/restaurant.json';

const restaurantData = restaurant as unknown as RestaurantSettings;

type SettingsObject = Record<string, unknown>;

export default function SettingsPage() {
  const { isAmharic } = useAdminLanguage();
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] =
    useState<RestaurantSettings>(restaurantData);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <AdminLayout>
        <div className="p-8 text-center text-xs text-gray-500">
          {isAmharic ? 'በመጫን ላይ...' : 'Loading...'}
        </div>
      </AdminLayout>
    );
  }

  const handleSave = () => {
    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 3000);
  };

  const handleChange = (
    path: string,
    value: unknown
  ) => {
    const keys = path.split('.');

    const updatedSettings: SettingsObject = {
      ...(settings as unknown as SettingsObject),
    };

    let current: SettingsObject =
      updatedSettings;

    for (
      let i = 0;
      i < keys.length - 1;
      i++
    ) {
      const key = keys[i];

      const existingValue =
        current[key];

      if (
        typeof existingValue === 'object' &&
        existingValue !== null &&
        !Array.isArray(existingValue)
      ) {
        current[key] = {
          ...(existingValue as SettingsObject),
        };
      } else {
        current[key] = {};
      }

      current =
        current[key] as SettingsObject;
    }

    const finalKey =
      keys[keys.length - 1];

    current[finalKey] = value;

    setSettings(
      updatedSettings as unknown as RestaurantSettings
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-serif font-bold text-restaurant-text dark:text-white">
            {isAmharic ? 'የሬስቶራንት ቅንብሮች' : 'Restaurant Settings'}
          </h1>

          <p className="text-restaurant-text-light dark:text-gray-400 mt-1">
            {isAmharic ? 'የሬስቶራንትዎን መረጃዎችና አድራሻዎች ያስተዳድሩ' : 'Manage your restaurant information'}
          </p>
        </div>

        {/* Saved Message */}
        {saved && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-700 dark:text-green-400">
              {isAmharic ? 'ቅንብሮች በተሳካ ሁኔታ ተቀምጠዋል!' : 'Settings saved successfully!'}
            </p>
          </div>
        )}

        {/* Basic Information */}
        <div className="restaurant-card p-6 space-y-4">

          <h2 className="text-lg font-semibold text-restaurant-text dark:text-white">
            {isAmharic ? 'መሰረታዊ መረጃዎች' : 'Basic Information'}
          </h2>

          {/* Restaurant Name EN */}
          <div>
            <label className="block text-sm font-medium text-restaurant-text dark:text-white mb-1">
              {isAmharic ? 'የሬስቶራንት ስም (እንግሊዝኛ)' : 'Restaurant Name (EN)'}
            </label>

            <input
              type="text"
              value={settings.name.en}
              onChange={(e) =>
                handleChange(
                  'name.en',
                  e.target.value
                )
              }
              className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
            />
          </div>

          {/* Restaurant Name AM */}
          <div>
            <label className="block text-sm font-medium text-restaurant-text dark:text-white mb-1">
              {isAmharic ? 'የሬስቶራንት ስም (አማርኛ)' : 'Restaurant Name (AM)'}
            </label>

            <input
              type="text"
              value={settings.name.am || ''}
              onChange={(e) =>
                handleChange(
                  'name.am',
                  e.target.value
                )
              }
              className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
            />
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-sm font-medium text-restaurant-text dark:text-white mb-1">
              {isAmharic ? 'መሪ ቃል / መግለጫ (እንግሊዝኛ)' : 'Tagline (EN)'}
            </label>

            <input
              type="text"
              value={settings.tagline?.en || ''}
              onChange={(e) =>
                handleChange(
                  'tagline.en',
                  e.target.value
                )
              }
              className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-restaurant-text dark:text-white mb-1">
              {isAmharic ? 'ስልክ ቁጥር' : 'Phone'}
            </label>

            <input
              type="tel"
              value={settings.phone}
              onChange={(e) =>
                handleChange(
                  'phone',
                  e.target.value
                )
              }
              className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-restaurant-text dark:text-white mb-1">
              {isAmharic ? 'ኢሜይል' : 'Email'}
            </label>

            <input
              type="email"
              value={settings.email || ''}
              onChange={(e) =>
                handleChange(
                  'email',
                  e.target.value
                )
              }
              className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-restaurant-text dark:text-white mb-1">
              {isAmharic ? 'የገንዘብ መለያ (Currency)' : 'Currency'}
            </label>

            <input
              type="text"
              value={settings.currency}
              onChange={(e) =>
                handleChange(
                  'currency',
                  e.target.value
                )
              }
              maxLength={3}
              className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
            />
          </div>

        </div>

        {/* Address */}
        <div className="restaurant-card p-6 space-y-4">

          <h2 className="text-lg font-semibold text-restaurant-text dark:text-white">
            {isAmharic ? 'አድራሻ እና ካርታ' : 'Location'}
          </h2>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-restaurant-text dark:text-white mb-1">
              {isAmharic ? 'አድራሻ (እንግሊዝኛ)' : 'Address (EN)'}
            </label>

            <input
              type="text"
              value={settings.address.en}
              onChange={(e) =>
                handleChange(
                  'address.en',
                  e.target.value
                )
              }
              className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
            />
          </div>

          {/* Google Maps */}
          <div>
            <label className="block text-sm font-medium text-restaurant-text dark:text-white mb-1">
              {isAmharic ? 'የጉግል ካርታ ሊንክ (Google Maps URL)' : 'Google Maps URL'}
            </label>

            <input
              type="url"
              value={settings.googleMapsUrl || ''}
              onChange={(e) =>
                handleChange(
                  'googleMapsUrl',
                  e.target.value
                )
              }
              className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
              placeholder="https://maps.google.com/..."
            />
          </div>

        </div>

        {/* Social Media */}
        <div className="restaurant-card p-6 space-y-4">

          <h2 className="text-lg font-semibold text-restaurant-text dark:text-white">
            {isAmharic ? 'ማህበራዊ ሚዲያ' : 'Social Media'}
          </h2>

          {/* Instagram */}
          <div>
            <label className="block text-sm font-medium text-restaurant-text dark:text-white mb-1">
              {isAmharic ? 'ኢንስታግራም' : 'Instagram'}
            </label>

            <input
              type="url"
              value={settings.social?.instagram || ''}
              onChange={(e) =>
                handleChange(
                  'social.instagram',
                  e.target.value
                )
              }
              className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
            />
          </div>

          {/* Facebook */}
          <div>
            <label className="block text-sm font-medium text-restaurant-text dark:text-white mb-1">
              {isAmharic ? 'ፌስቡክ' : 'Facebook'}
            </label>

            <input
              type="url"
              value={settings.social?.facebook || ''}
              onChange={(e) =>
                handleChange(
                  'social.facebook',
                  e.target.value
                )
              }
              className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
            />
          </div>

        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 bg-restaurant-accent text-white rounded-lg hover:bg-restaurant-accent-dark transition-colors font-medium w-full sm:w-auto"
        >
          <Save size={20} />
          {isAmharic ? 'ቅንብሮቹን አስቀምጥ' : 'Save Settings'}
        </button>

      </div>
    </AdminLayout>
  );
}

