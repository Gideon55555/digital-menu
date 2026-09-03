'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, LogOut, ArrowRight } from 'lucide-react';
import {
  getAdminAuth,
  getAdminHomeRoute,
  normalizeAdminRole,
  signInAdmin,
  signOutAdmin,
} from '@/lib/admin-auth';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Active session lock check
  const [existingAuth, setExistingAuth] = useState<Awaited<ReturnType<typeof getAdminAuth>>>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    async function checkCurrentSession() {
      try {
        const auth = await getAdminAuth();
        if (auth) {
          setExistingAuth(auth);
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setCheckingExisting(false);
      }
    }
    checkCurrentSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      const auth = await signInAdmin(email, password);
      const adminHome = getAdminHomeRoute(auth.adminUser.role);
      // Clean full page load into the new role's dashboard
      window.location.href = adminHome;
    } catch (err) {
      console.error('Admin login error:', err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Invalid email or password.');
      }
      setLoading(false);
    }
  };

  const handleExplicitLogout = async () => {
    setLoading(true);
    try {
      await signOutAdmin();
      setExistingAuth(null);
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (checkingExisting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-100 to-white dark:from-restaurant-bg-dark dark:to-slate-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-restaurant-accent/30 border-t-restaurant-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-500">Checking session...</p>
        </div>
      </div>
    );
  }

  // ACTIVE SESSION LOCKED: User must explicitly log out before switching roles!
  if (existingAuth) {
    const roleName = normalizeAdminRole(existingAuth.adminUser.role);
    const dashboardRoute = getAdminHomeRoute(existingAuth.adminUser.role);

    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-100 to-white dark:from-restaurant-bg-dark dark:to-slate-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="restaurant-card p-8 text-center space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600">
              <ShieldCheck size={28} />
            </div>

            <div>
              <h1 className="text-2xl font-serif font-bold text-restaurant-text dark:text-white">
                Active Session Detected
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                You are currently signed in as:
              </p>

              <div className="mt-3 rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/60 dark:bg-slate-800/50 p-4">
                <p className="font-bold text-restaurant-text dark:text-white text-base">
                  {existingAuth.adminUser.name || existingAuth.adminUser.email}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {existingAuth.adminUser.email}
                </p>
                <div className="mt-2.5">
                  <span className="inline-block rounded-full bg-restaurant-accent/10 px-3 py-1 text-xs font-bold text-restaurant-accent capitalize">
                    {roleName.replace('_', ' ')} Role
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              To keep your session secure and prevent accidental role switching, you remain signed in on this role. You must explicitly log out before signing in with another account.
            </p>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => {
                  window.location.href = dashboardRoute;
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-restaurant-accent px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-restaurant-accent-dark transition"
              >
                Continue to {roleName.replace('_', ' ')} Dashboard
                <ArrowRight size={16} />
              </button>

              <button
                onClick={handleExplicitLogout}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition"
              >
                <LogOut size={16} />
                {loading ? 'Signing out...' : 'Log Out & Switch Account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STANDARD LOGIN FORM (Shown only when completely logged out)
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 to-white dark:from-restaurant-bg-dark dark:to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="restaurant-card p-8">
          <h1 className="text-3xl font-serif font-bold text-restaurant-text dark:text-white text-center mb-2">
            A&apos;erkt Admin
          </h1>

          <p className="text-center text-restaurant-text-light dark:text-gray-400 mb-8 text-sm">
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

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-4 pr-11 py-2 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-restaurant-accent transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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
              Sign in with your assigned staff or manager credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}