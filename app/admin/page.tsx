'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/lib/supabase';

interface MenuItem {
  id: string;
  category_id: string;
  name: {
    en: string;
    am?: string;
  };
  description: {
    en: string;
    am?: string;
  };
  price: number;
  currency: string;
  available: boolean;
  featured: boolean;
  fasting: boolean;
  vegetarian: boolean;
  spicy: boolean;
}

interface Category {
  id: string;
  name: {
    en: string;
    am?: string;
  };
  display_order: number;
  visible: boolean;
}

export default function AdminDashboard() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    setMounted(true);
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [menuResult, categoriesResult] = await Promise.all([
        supabase
          .from('menu_items')
          .select('*')
          .order('display_order', { ascending: true }),

        supabase
          .from('categories')
          .select('*')
          .order('display_order', { ascending: true }),
      ]);

      if (menuResult.error) {
        throw menuResult.error;
      }

      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      setMenuItems(menuResult.data || []);
      setCategories(categoriesResult.data || []);
    } catch (err) {
      console.error('Dashboard loading error:', err);
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return (
      <AdminLayout>
        <div>Loading...</div>
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
      label: 'Total Menu Items',
      value: totalItems,
      color:
        'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    },
    {
      label: 'Available Items',
      value: availableItems,
      color:
        'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    },
    {
      label: 'Sold Out',
      value: soldOutItems,
      color:
        'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300',
    },
    {
      label: 'Categories',
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
            Dashboard
          </h1>

          <p className="text-restaurant-text-light dark:text-gray-400 mt-1">
            Welcome to your restaurant management panel
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
              Loading dashboard...
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
                Menu Categories
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories.map((category) => {
                  const count = menuItems.filter(
                    (item) => item.category_id === category.id
                  ).length;

                  return (
                    <div
                      key={category.id}
                      className="restaurant-card p-5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-restaurant-text dark:text-white">
                            {category.name.en}
                          </p>

                          <p className="text-sm text-restaurant-text-light dark:text-gray-400 mt-1">
                            {count} menu item{count !== 1 ? 's' : ''}
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
                Featured Items
              </h2>

              <div className="restaurant-card divide-y dark:divide-slate-800">
                {featuredItems.length > 0 ? (
                  featuredItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 flex items-center justify-between hover:bg-cream-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-restaurant-text dark:text-white">
                          {item.name.en}
                        </p>

                        <p className="text-sm text-restaurant-text-light dark:text-gray-400">
                          {item.description.en?.substring(0, 60)}
                          {item.description.en?.length > 60 ? '...' : ''}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-restaurant-accent">
                          {item.price} {item.currency}
                        </p>

                        <p className="text-xs text-restaurant-text-light dark:text-gray-400">
                          {item.available
                            ? '✓ Available'
                            : '✗ Unavailable'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-restaurant-text-light dark:text-gray-400">
                    No featured items
                  </div>
                )}
              </div>
            </div>

            {/* Recent Items */}
            <div>
              <h2 className="text-2xl font-serif font-bold text-restaurant-text dark:text-white mb-4">
                Recent Menu Items
              </h2>

              <div className="restaurant-card divide-y dark:divide-slate-800">
                {recentItems.map((item) => {
                  const category = categories.find(
                    (category) =>
                      category.id === item.category_id
                  );

                  return (
                    <div
                      key={item.id}
                      className="p-4 flex items-center justify-between hover:bg-cream-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-restaurant-text dark:text-white">
                          {item.name.en}
                        </p>

                        <p className="text-sm text-restaurant-text-light dark:text-gray-400">
                          Category:{' '}
                          {category?.name.en || 'Unknown'}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-restaurant-accent">
                          {item.price} {item.currency}
                        </p>

                        <p className="text-xs text-restaurant-text-light dark:text-gray-400">
                          {item.available
                            ? 'Available'
                            : 'Unavailable'}
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