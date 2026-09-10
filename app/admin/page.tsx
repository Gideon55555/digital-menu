'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { MenuItem, MenuCategory } from '@/lib/types';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext';

export default function AdminDashboard() {
  const { isAmharic } = useAdminLanguage();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);

  useEffect(() => {
    setMounted(true);
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [menuResponse, categoriesResponse] = await Promise.all([
        fetch('/api/menu', { cache: 'no-store' }),
        fetch('/api/categories', { cache: 'no-store' }),
      ]);

      const menuResult = await menuResponse.json();
      const categoriesResult = await categoriesResponse.json();

      if (!menuResponse.ok || !menuResult.success) {
        throw new Error(menuResult.error || 'Failed to load menu data.');
      }

      if (!categoriesResponse.ok || !categoriesResult.success) {
        throw new Error(categoriesResult.error || 'Failed to load category data.');
      }

      setMenuItems(Array.isArray(menuResult.data) ? menuResult.data : []);
      setCategories(Array.isArray(categoriesResult.data) ? categoriesResult.data : []);
    } catch (err) {
      console.error('Dashboard loading error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <AdminLayout>
        <div>{isAmharic ? 'በመጫን ላይ...' : 'Loading...'}</div>
      </AdminLayout>
    );
  }

  const totalItems = menuItems.length;

  const availableItems = menuItems.filter(
    (item) => item.available
  ).length;

  const soldOutItems = menuItems.filter(
    (item) => !item.available
  ).length;

  const featuredItems = menuItems
    .filter((item) => item.featured)
    .slice(0, 5);

  const recentItems = [...menuItems]
    .reverse()
    .slice(0, 5);

  const stats = [
    {
      label: isAmharic ? 'ጠቅላላ ምግቦች' : 'Total Menu Items',
      value: totalItems,
      color:
        'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    },
    {
      label: isAmharic ? 'የሚገኙ ምግቦች' : 'Available Items',
      value: availableItems,
      color:
        'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    },
    {
      label: isAmharic ? 'ያለቁ ምግቦች' : 'Sold Out',
      value: soldOutItems,
      color:
        'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    },
    {
      label: isAmharic ? 'ምድቦች' : 'Categories',
      value: categories.length,
      color:
        'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-serif font-bold text-restaurant-text dark:text-white">
            {isAmharic ? 'የምግብ ዝርዝር ሪፖርት' : 'Menu Report'}
          </h1>

          <p className="text-restaurant-text-light dark:text-gray-400 mt-1">
            {isAmharic ? 'የምግብ ዝርዝር፣ ተገኝነት እና የምድቦች አጠቃላይ መረጃ' : 'Overview of menu items, availability and categories'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="restaurant-card p-8 text-center">
            <p className="text-restaurant-text-light dark:text-gray-400">
              {isAmharic ? 'የምግብ ዝርዝር ሪፖርት በመጫን ላይ...' : 'Loading menu report...'}
            </p>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={`${stat.color} rounded-lg p-6 border border-current/20`}
                >
                  <p className="text-sm font-medium mb-2">
                    {stat.label}
                  </p>

                  <p className="text-4xl font-bold">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Category Overview */}
            <div>
              <h2 className="text-2xl font-serif font-bold text-restaurant-text dark:text-white mb-4">
                {isAmharic ? 'የምግብ ምድቦች' : 'Menu Categories'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories.map((category) => {
                  const count = menuItems.filter(
                    (item) => (item.categoryId || (item as unknown as { category_id?: string }).category_id) === category.id
                  ).length;

                  const catName = isAmharic
                    ? (category.name?.am || category.name?.en || 'ምድብ')
                    : (category.name?.en || category.name?.am || 'Category');

                  return (
                    <div
                      key={category.id}
                      className="restaurant-card p-5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-restaurant-text dark:text-white">
                            {catName}
                          </p>

                          <p className="text-sm text-restaurant-text-light dark:text-gray-400 mt-1">
                            {count} {isAmharic ? 'ምግቦች' : (count !== 1 ? 'menu items' : 'menu item')}
                          </p>
                        </div>

                        <div className="text-2xl font-bold text-restaurant-accent">
                          {count}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Featured Items */}
            <div>
              <h2 className="text-2xl font-serif font-bold text-restaurant-text dark:text-white mb-4">
                {isAmharic ? 'ተለይተው የቀረቡ ምግቦች' : 'Featured Items'}
              </h2>

              <div className="restaurant-card divide-y dark:divide-slate-800">
                {featuredItems.length > 0 ? (
                  featuredItems.map((item) => {
                    const itemName = isAmharic
                      ? (item.name?.am || item.name?.en || 'ምግብ')
                      : (item.name?.en || item.name?.am || 'Item');

                    const itemDesc = (isAmharic ? item.description?.am : item.description?.en) || item.description?.en || item.description?.am;

                    return (
                      <div
                        key={item.id}
                        className="p-4 flex items-center justify-between hover:bg-cream-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-restaurant-text dark:text-white">
                            {itemName}
                          </p>

                          <p className="text-sm text-restaurant-text-light dark:text-gray-400">
                            {itemDesc?.substring(0, 60)}
                            {(itemDesc?.length || 0) > 60 ? '...' : ''}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold text-restaurant-accent">
                            {item.price} {isAmharic ? 'ብር' : item.currency}
                          </p>

                          <p className="text-xs text-restaurant-text-light dark:text-gray-400">
                            {item.available
                              ? (isAmharic ? '✓ ይገኛል' : '✓ Available')
                              : (isAmharic ? '✗ አልቋል' : '✗ Unavailable')}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center text-restaurant-text-light dark:text-gray-400">
                    {isAmharic ? 'ምንም ተለይቶ የቀረበ ምግብ የለም' : 'No featured items'}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Items */}
            <div>
              <h2 className="text-2xl font-serif font-bold text-restaurant-text dark:text-white mb-4">
                {isAmharic ? 'የቅርብ ጊዜ ምግቦች' : 'Recent Menu Items'}
              </h2>

              <div className="restaurant-card divide-y dark:divide-slate-800">
                {recentItems.map((item) => {
                  const category = categories.find(
                    (category) =>
                      category.id === (item.categoryId || (item as unknown as { category_id?: string }).category_id)
                  );

                  const itemName = isAmharic
                    ? (item.name?.am || item.name?.en || 'ምግብ')
                    : (item.name?.en || item.name?.am || 'Item');

                  const catName = category
                    ? (isAmharic ? (category.name?.am || category.name?.en) : (category.name?.en || category.name?.am))
                    : (isAmharic ? 'ያልታወቀ' : 'Unknown');

                  return (
                    <div
                      key={item.id}
                      className="p-4 flex items-center justify-between hover:bg-cream-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-restaurant-text dark:text-white">
                          {itemName}
                        </p>

                        <p className="text-sm text-restaurant-text-light dark:text-gray-400">
                          {isAmharic ? 'ምድብ: ' : 'Category: '}
                          {catName}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-restaurant-accent">
                          {item.price} {isAmharic ? 'ብር' : item.currency}
                        </p>

                        <p className="text-xs text-restaurant-text-light dark:text-gray-400">
                          {item.available
                            ? (isAmharic ? 'ይገኛል' : 'Available')
                            : (isAmharic ? 'አልቋል' : 'Unavailable')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}