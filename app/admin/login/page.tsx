'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInAdmin } from '@/lib/admin-auth';

export default function AdminLogin() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      await signInAdmin(email, password);

      router.push('/admin');
    } catch (err) {
      console.error('Admin login error:', err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 to-white dark:from-restaurant-bg-dark dark:to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="restaurant-card p-8">
          <h1 className="text-3xl font-serif font-bold text-restaurant-text dark:text-white text-center mb-2">
            A'erkt Admin
          </h1>

          <p className="text-center text-restaurant-text-light dark:text-gray-400 mb-8">
            Restaurant Management Portal
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-restaurant-text dark:text-white mb-2">
                Email Address
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-restaurant-text dark:text-white mb-2">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-restaurant-accent text-white rounded-lg hover:bg-restaurant-accent-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 p-4 bg-cream-50 dark:bg-slate-800 rounded-lg">
            <p className="text-xs text-restaurant-text-light dark:text-gray-400 text-center">
              Sign in using your administrator account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}