'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Menu,
  X,
  LayoutDashboard,
  Utensils,
  FolderOpen,
  Settings,
  QrCode,
  LogOut,
  ClipboardList,
  BarChart3,
  Table2,
  ChefHat,
  Coffee,
  Users,
  ConciergeBell,
  Package,
  Bell,
  AlertTriangle,
  Sun,
  Moon,
  KeyRound,
  Eye,
  EyeOff,
  Globe,
} from 'lucide-react';
import { getAdminAccessToken, getAdminAuth, normalizeAdminRole, signOutAdmin } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import { playNotificationSound } from '@/lib/audio';
import { AdminLanguageProvider, useAdminLanguage } from '@/lib/i18n/AdminLanguageContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AdminLanguageProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminLanguageProvider>
  );
}

function AdminLayoutInner({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { language, setLanguage, t } = useAdminLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminAuth, setAdminAuth] = useState<Awaited<
    ReturnType<typeof getAdminAuth>
  >>(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const prevAlertsRef = useRef<number>(-1);

  // User Change Password Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [myNewPassword, setMyNewPassword] = useState('');
  const [showMyNewPassword, setShowMyNewPassword] = useState(false);
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<{
    loading: boolean;
    error: string;
    success: string;
  }>({ loading: false, error: '', success: '' });

  // Theme: Dark (Black Option) vs Light
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('restaurant_theme');
    const isDark = savedTheme === 'dark';
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('restaurant_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('restaurant_theme', 'light');
    }
  };

  const role = adminAuth ? normalizeAdminRole(adminAuth.adminUser.role) : 'waiter';

  const formatRoleLabel = (r: string) => {
    if (language === 'am') {
      switch (r) {
        case 'admin':
          return 'አስተዳዳሪ';
        case 'cashier':
          return 'ገንዘብ ተቀባይ';
        case 'waiter':
          return 'አስተናጋጅ';
        case 'kitchen':
          return 'ማብሰያ';
        case 'drinks_kitchen':
          return 'መጠጥ ማዘጋጃ';
        case 'order_manager':
          return 'የትዕዛዝ አስተዳዳሪ';
        default:
          return r;
      }
    }
    return r.replace('_', ' ');
  };

  useEffect(() => {
    if (!adminAuth) return;

    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/inventory/notify?status=unread');
        const json = await res.json();
        if (json.success) {
          const count = json.unreadCount || 0;
          if (prevAlertsRef.current >= 0 && count > prevAlertsRef.current) {
            if (role === 'admin') {
              playNotificationSound('low_stock');
            }
          }
          prevAlertsRef.current = count;
          setUnreadAlerts(count);
        }
      } catch (e) {
        // silent fail
      }
    };

    fetchAlerts();

    const channel = supabase
      .channel(`inventory-alerts-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_notifications' }, () => {
        fetchAlerts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
        fetchAlerts();
      })
      .subscribe();

    const interval = setInterval(fetchAlerts, 4000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [adminAuth, role]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const auth = await getAdminAuth();

        if (!auth) {
          router.replace('/admin/login');
          return;
        }

        setAdminAuth(auth);
      } catch (error) {
        console.error('Auth error:', error);
        router.replace('/admin/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream-50 dark:bg-restaurant-bg-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-restaurant-accent border-t-transparent" />
      </div>
    );
  }

  if (!adminAuth) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await signOutAdmin();
      window.location.href = '/admin/login';
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/admin/login';
    }
  };

  const navItems = [
    {
      label: t.report,
      icon: BarChart3,
      href: '/admin/reports/orders',
    },
    {
      label: t.activeOrders,
      icon: ClipboardList,
      href: '/admin/orders',
    },
    {
      label: t.menuReport,
      icon: LayoutDashboard,
      href: '/admin',
    },
    {
      label: t.tables,
      icon: Table2,
      href: '/admin/tables',
    },
    {
      label: t.kitchen,
      icon: ChefHat,
      href: '/admin/kitchen',
    },
    {
      label: t.drinksKitchen,
      icon: Coffee,
      href: '/admin/drinks-kitchen',
    },
    {
      label: language === 'am' ? 'አስተናጋጅ' : 'Waiter',
      icon: ConciergeBell,
      href: '/waiter',
    },
    {
      label: t.inventory,
      icon: Package,
      href: '/admin/inventory',
    },
    {
      label: language === 'am' ? 'ምግቦች' : 'Menu Items',
      icon: Utensils,
      href: '/admin/menu',
    },
    {
      label: language === 'am' ? 'ምድቦች' : 'Categories',
      icon: FolderOpen,
      href: '/admin/categories',
    },
    {
      label: language === 'am' ? 'ኪውአር ኮድ' : 'QR Code',
      icon: QrCode,
      href: '/admin/qr-code',
    },
    {
      label: t.settings,
      icon: Settings,
      href: '/admin/settings',
    },
  ];

  const allowedNavItems = navItems.filter((item) => {
    if (role === 'admin') {
      return true;
    }

    if (role === 'cashier') {
      return [
        '/admin/orders',
        '/admin/reports/orders',
        '/admin/tables',
      ].includes(item.href);
    }

    if (role === 'order_manager') {
      return [
        '/admin/orders',
        '/admin/reports/orders',
        '/admin/tables',
      ].includes(item.href);
    }

    if (role === 'kitchen') {
      return item.href === '/admin/kitchen' || item.href === '/admin/inventory';
    }

    if (role === 'drinks_kitchen') {
      return item.href === '/admin/drinks-kitchen' || item.href === '/admin/inventory';
    }

    if (role === 'waiter') {
      return item.href === '/waiter';
    }

    return item.href === '/admin';
  });

  const visibleNavItems =
    role === 'admin'
      ? [
          ...allowedNavItems,
          {
            label: t.users,
            icon: Users,
            href: '/admin/users',
          },
        ]
      : allowedNavItems;

  const allowedPaths = (() => {
    if (role === 'admin') {
      return null;
    }

    if (role === 'cashier' || role === 'order_manager') {
      return ['/admin/orders', '/admin/reports/orders', '/admin/tables', '/order'];
    }

    if (role === 'kitchen') {
      return ['/admin/kitchen', '/admin/inventory'];
    }

    if (role === 'drinks_kitchen') {
      return ['/admin/drinks-kitchen', '/admin/inventory'];
    }

    if (role === 'waiter') {
      return ['/waiter', '/order'];
    }

    return ['/admin'];
  })();

  if (allowedPaths && !allowedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    router.replace(allowedPaths[0]);
    return null;
  }

  const currentItem = [...navItems, { label: t.users, href: '/admin/users' }, { label: 'Order Terminal', href: '/order' }].find(
    (item) => pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`))
  );
  const currentPageTitle = currentItem?.label || (language === 'am' ? 'የአስተዳደር ፖርታል' : 'Management Portal');

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-restaurant-bg-dark flex">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white dark:bg-slate-900 rounded-lg border border-cream-200 dark:border-slate-800"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed lg:relative w-64 h-screen bg-white dark:bg-slate-900 border-r border-cream-200 dark:border-slate-800 flex flex-col z-30 transform lg:transform-none transition-transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-cream-200 dark:border-slate-800">
          <h1 className="text-2xl font-serif font-bold text-restaurant-accent">
            A&apos;erkt
          </h1>

          <p className="text-xs text-restaurant-text-light dark:text-gray-400 mt-1 capitalize">
            {formatRoleLabel(role)} {language === 'am' ? 'ፖርታል' : 'Portal'}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-restaurant-accent text-white font-semibold'
                    : 'text-restaurant-text-light dark:text-gray-400 hover:bg-cream-100 dark:hover:bg-slate-800 hover:text-restaurant-text dark:hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer / Account & Actions */}
        <div className="p-4 border-t border-cream-200 dark:border-slate-800 space-y-2">
          {/* USER PROFILE INFO WITH CHANGE PASSWORD */}
          <button
            onClick={() => {
              setShowPasswordModal(true);
              setMyNewPassword('');
              setPasswordChangeStatus({ loading: false, error: '', success: '' });
            }}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-cream-100 dark:bg-slate-800 text-restaurant-text dark:text-gray-200 rounded-lg hover:bg-cream-200 dark:hover:bg-slate-700 transition text-xs font-semibold"
          >
            <KeyRound size={13} className="text-restaurant-accent" />
            {language === 'am' ? 'የይለፍ ቃል ቀይር' : 'Change Password'}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm font-medium"
          >
            <LogOut size={16} />
            {t.logout}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full min-w-0">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-cream-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="pl-10 lg:pl-0">
            <h2 className="text-xl font-semibold text-restaurant-text dark:text-white">
              {currentPageTitle}
            </h2>
            <p className="text-xs text-restaurant-text-light dark:text-gray-400">
              {t.role}: <span className="font-medium text-restaurant-accent">{formatRoleLabel(role)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            {unreadAlerts > 0 ? (
              <Link
                href="/admin/inventory"
                className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60 animate-pulse transition hover:bg-red-100"
                title={`${unreadAlerts} Low Stock Alert(s) from Kitchen`}
              >
                <AlertTriangle size={18} className="text-red-600 animate-bounce" />
                <span className="text-xs font-bold">{unreadAlerts} {t.lowStockAlert}</span>
              </Link>
            ) : (
              <Link
                href="/admin/inventory"
                className="relative flex items-center justify-center p-2 rounded-lg text-gray-500 hover:text-restaurant-accent hover:bg-cream-100 dark:hover:bg-slate-800 transition"
                title={t.inventory}
              >
                <Bell size={20} />
              </Link>
            )}

            {/* LANGUAGE SWITCHER: EN / አማ */}
            <div className="flex items-center rounded-lg border border-cream-200 dark:border-slate-800 bg-cream-50 dark:bg-slate-800 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  language === 'en'
                    ? 'bg-restaurant-accent text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
                title="Switch to English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('am')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  language === 'am'
                    ? 'bg-restaurant-accent text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
                title="ወደ አማርኛ ቀይር"
              >
                አማ
              </button>
            </div>

            {/* THEME TOGGLE: DARK / LIGHT (BLACK OPTION) */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 rounded-lg border border-cream-200 bg-cream-50 px-2.5 py-1.5 text-xs font-semibold text-restaurant-text hover:bg-cream-100 dark:border-slate-800 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700 transition shadow-sm"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark (Black) Mode'}
            >
              {isDarkMode ? (
                <>
                  <Sun size={15} className="text-amber-400" />
                  <span className="hidden sm:inline">{t.lightMode}</span>
                </>
              ) : (
                <>
                  <Moon size={15} className="text-slate-700" />
                  <span className="hidden sm:inline">{t.darkMode}</span>
                </>
              )}
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs text-restaurant-text-light dark:text-gray-400">
              <span>{t.loggedInAs}</span>
              <span className="font-medium text-restaurant-text dark:text-gray-200 bg-cream-100 dark:bg-slate-800 px-2 py-1 rounded">
                {adminAuth.adminUser.email}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6">{children}</div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* CHANGE PASSWORD MODAL FOR CURRENT USER */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-cream-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-cream-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="text-restaurant-accent" size={20} />
                <h3 className="text-base font-bold text-restaurant-text dark:text-white">
                  {language === 'am' ? 'የይለፍ ቃልዎን ይቀይሩ' : 'Change Your Password'}
                </h3>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-cream-50 dark:bg-slate-800/60 p-3 border border-cream-200 dark:border-slate-800 text-xs">
                <span className="text-gray-400">{language === 'am' ? 'አካውንት:' : 'Account:'}</span>{' '}
                <strong className="text-restaurant-text dark:text-white">
                  {adminAuth?.adminUser.email}
                </strong>
              </div>

              {passwordChangeStatus.error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-3 text-xs text-red-600 dark:text-red-300">
                  {passwordChangeStatus.error}
                </div>
              )}

              {passwordChangeStatus.success && (
                <div className="rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/60 p-3 text-xs text-green-700 dark:text-green-300">
                  {passwordChangeStatus.success}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  {language === 'am' ? 'አዲስ የይለፍ ቃል (ቢያንስ 6 ፊደላት) *' : 'New Password (min 6 characters) *'}
                </label>
                <div className="relative">
                  <input
                    type={showMyNewPassword ? 'text' : 'password'}
                    value={myNewPassword}
                    onChange={(e) => setMyNewPassword(e.target.value)}
                    placeholder={language === 'am' ? 'አዲሱን የይለፍ ቃል ያስገቡ' : 'Enter new password'}
                    className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 pr-10 text-xs outline-none focus:border-restaurant-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMyNewPassword(!showMyNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-restaurant-accent"
                  >
                    {showMyNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-slate-800 dark:text-gray-300"
                >
                  {language === 'am' ? 'ዝጋ' : 'Close'}
                </button>
                <button
                  type="button"
                  disabled={passwordChangeStatus.loading || myNewPassword.length < 6}
                  onClick={async () => {
                    try {
                      setPasswordChangeStatus({ loading: true, error: '', success: '' });
                      const token = await getAdminAccessToken();
                      const res = await fetch('/api/auth/change-password', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({ newPassword: myNewPassword }),
                      });
                      const json = await res.json();
                      if (!res.ok || !json.success) {
                        throw new Error(json.error || 'Failed to update password');
                      }
                      setPasswordChangeStatus({
                        loading: false,
                        error: '',
                        success: language === 'am' ? 'የይለፍ ቃልዎ በተሳካ ሁኔታ ተቀይሯል!' : 'Your password has been updated successfully!',
                      });
                      setMyNewPassword('');
                    } catch (err) {
                      setPasswordChangeStatus({
                        loading: false,
                        error: err instanceof Error ? err.message : 'Error changing password',
                        success: '',
                      });
                    }
                  }}
                  className="flex-1 rounded-xl bg-restaurant-accent px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
                >
                  {passwordChangeStatus.loading
                    ? language === 'am'
                      ? 'በማስቀመጥ ላይ...'
                      : 'Updating...'
                    : language === 'am'
                    ? 'አስቀምጥ'
                    : 'Save Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}