'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Menu,
  X,
  LayoutDashboard,
  Utensils,
  FolderOpen,
  Settings,
  QrCode,
  LogOut,
} from 'lucide-react';
import { getAdminAuth, signOutAdmin } from '@/lib/admin-auth';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminAuth, setAdminAuth] = useState<Awaited<
    ReturnType<typeof getAdminAuth>
  >>(null);

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
        console.error('Admin authentication check failed:', error);
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
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-restaurant-accent/30 border-t-restaurant-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-restaurant-text-light dark:text-gray-400">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  if (!adminAuth) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await signOutAdmin();
      router.replace('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navItems = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/admin',
    },
    {
      label: 'Menu Items',
      icon: Utensils,
      href: '/admin/menu',
    },
    {
      label: 'Categories',
      icon: FolderOpen,
      href: '/admin/categories',
    },
    {
      label: 'QR Code',
      icon: QrCode,
      href: '/admin/qr-code',
    },
    {
      label: 'Settings',
      icon: Settings,
      href: '/admin/settings',
    },
  ];

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

          <p className="text-xs text-restaurant-text-light dark:text-gray-400 mt-1">
            Admin Panel
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-restaurant-text-light dark:text-gray-400 hover:bg-cream-100 dark:hover:bg-slate-800 hover:text-restaurant-accent transition-colors"
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-cream-200 dark:border-slate-800 space-y-2">
          <p className="text-xs text-restaurant-text-light dark:text-gray-400">
            Logged in as:
            <br />

            <span className="font-medium">
              {adminAuth.adminUser.email}
            </span>

            <br />

            <span className="text-restaurant-accent capitalize">
              {adminAuth.adminUser.role}
            </span>
          </p>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm font-medium"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-cream-200 dark:border-slate-800 px-6 py-4">
          <h2 className="text-xl font-semibold text-restaurant-text dark:text-white">
            Admin Panel
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">{children}</div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}