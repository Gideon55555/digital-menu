'use client';

import { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Trash2,
  KeyRound,
  UserPlus,
  Users,
  Shield,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminAccessToken } from '@/lib/admin-auth';

type AdminRole =
  | 'admin'
  | 'cashier'
  | 'order_manager'
  | 'kitchen'
  | 'drinks_kitchen'
  | 'waiter';

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  created_at?: string;
};

async function readApiResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const text = await response.text();

  return {
    success: false,
    error: text || `Request failed with status ${response.status}`,
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<AdminRole>('order_manager');

  // Modal: Change Password
  const [passwordModalUser, setPasswordModalUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Modal: Delete User
  const [deleteModalUser, setDeleteModalUser] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadUsers() {
    try {
      setLoading(true);
      const token = await getAdminAccessToken();

      const response = await fetch('/api/admin/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load users');
      }

      setUsers((result.data || []) as AdminUser[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function createUser() {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const token = await getAdminAccessToken();

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email, password, name, role }),
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create user');
      }

      setEmail('');
      setPassword('');
      setName('');
      setRole('order_manager');
      setSuccess('User created successfully.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  // Handle Delete User
  async function handleDeleteUser() {
    if (!deleteModalUser) return;

    try {
      setDeleting(true);
      setError('');
      setSuccess('');

      const token = await getAdminAccessToken();

      const response = await fetch(`/api/admin/users?id=${deleteModalUser.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete user');
      }

      setSuccess(`User ${deleteModalUser.name || deleteModalUser.email} deleted successfully.`);
      setDeleteModalUser(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  }

  // Handle Change Password
  async function handleChangePassword() {
    if (!passwordModalUser || !newPassword) return;

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setUpdatingPassword(true);
      setError('');
      setSuccess('');

      const token = await getAdminAccessToken();

      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: passwordModalUser.id,
          password: newPassword,
        }),
      });

      const result = await readApiResponse(response);

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update password');
      }

      setSuccess(`Password for ${passwordModalUser.name || passwordModalUser.email} updated successfully.`);
      setPasswordModalUser(null);
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  }

  const getRoleBadgeClasses = (userRole: AdminRole) => {
    switch (userRole) {
      case 'admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
      case 'cashier':
      case 'order_manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'kitchen':
      case 'drinks_kitchen':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
      case 'waiter':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-restaurant-text dark:text-white flex items-center gap-2.5">
            <Users className="text-restaurant-accent" size={28} />
            User & Staff Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Create staff accounts, assign roles, change passwords, and manage permissions.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300 flex items-center gap-2">
            <Check size={16} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* CREATE USER FORM */}
        <div className="restaurant-card p-6 space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-cream-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-base font-bold text-restaurant-text dark:text-white flex items-center gap-2">
            <UserPlus size={18} className="text-restaurant-accent" />
            Create Staff Account
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Full Name *
              </label>
              <input
                className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/50 px-3.5 py-2 text-xs outline-none focus:border-restaurant-accent"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/50 px-3.5 py-2 text-xs outline-none focus:border-restaurant-accent"
                placeholder="e.g. waiter@restaurant.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                Password (min 6 characters) *
              </label>
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/50 px-3.5 py-2 pr-10 text-xs outline-none focus:border-restaurant-accent"
                  placeholder="Enter strong password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-restaurant-accent transition focus:outline-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                System Role *
              </label>
              <select
                className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/50 px-3.5 py-2 text-xs outline-none focus:border-restaurant-accent"
                value={role}
                onChange={(e) => setRole(e.target.value as AdminRole)}
              >
                <option value="waiter">Waiter (Floor Orders)</option>
                <option value="cashier">Cashier (Order & POS)</option>
                <option value="order_manager">Order Manager</option>
                <option value="kitchen">Food Kitchen</option>
                <option value="drinks_kitchen">Drinks Kitchen</option>
                <option value="admin">Administrator (Full Access)</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={createUser}
              disabled={saving || !name || !email || !password}
              className="inline-flex items-center gap-1.5 rounded-xl bg-restaurant-accent px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
            >
              <UserPlus size={15} />
              <span>{saving ? 'Creating Account...' : 'Create Account'}</span>
            </button>
          </div>
        </div>

        {/* EXISTING USERS LIST */}
        <div className="restaurant-card overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-cream-200 dark:border-slate-800 shadow-sm">
          <div className="border-b border-cream-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
            <div className="font-bold text-sm text-restaurant-text dark:text-white flex items-center gap-2">
              <Shield size={16} className="text-restaurant-accent" />
              Existing Staff Accounts ({users.length})
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-gray-500">Loading accounts...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">No staff accounts found.</div>
          ) : (
            <div className="divide-y divide-cream-100 dark:divide-slate-800">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 hover:bg-cream-50/40 dark:hover:bg-slate-800/30 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-xs sm:text-sm text-restaurant-text dark:text-white">
                        {user.name}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getRoleBadgeClasses(
                          user.role
                        )}`}
                      >
                        {user.role.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                  </div>

                  {/* ACTIONS: CHANGE PASSWORD & DELETE */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      onClick={() => {
                        setPasswordModalUser(user);
                        setNewPassword('');
                        setError('');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-cream-50 dark:hover:bg-slate-700 transition"
                      title="Change user's password"
                    >
                      <KeyRound size={13} className="text-restaurant-accent" />
                      <span>Change Password</span>
                    </button>

                    <button
                      onClick={() => {
                        setDeleteModalUser(user);
                        setError('');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/30 px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                      title="Delete user"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===================================================== */}
        {/* MODAL: CHANGE PASSWORD                                */}
        {/* ===================================================== */}
        {passwordModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-cream-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-cream-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <KeyRound className="text-restaurant-accent" size={20} />
                  <h3 className="text-base font-bold text-restaurant-text dark:text-white">
                    Change Password
                  </h3>
                </div>
                <button
                  onClick={() => setPasswordModalUser(null)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-cream-50 dark:bg-slate-800/60 p-3 border border-cream-200 dark:border-slate-800 text-xs">
                  <div className="text-gray-500">Updating password for:</div>
                  <div className="font-bold text-restaurant-text dark:text-white mt-0.5">
                    {passwordModalUser.name} ({passwordModalUser.email})
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    New Password (min 6 characters) *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 pr-10 text-xs outline-none focus:border-restaurant-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-restaurant-accent"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPasswordModalUser(null)}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-slate-800 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={updatingPassword || newPassword.length < 6}
                    className="flex-1 rounded-xl bg-restaurant-accent px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
                  >
                    {updatingPassword ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* MODAL: DELETE USER CONFIRMATION                       */}
        {/* ===================================================== */}
        {deleteModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-cream-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-cream-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-red-600">
                  <Trash2 size={20} />
                  <h3 className="text-base font-bold text-restaurant-text dark:text-white">
                    Confirm Delete User
                  </h3>
                </div>
                <button
                  onClick={() => setDeleteModalUser(null)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  Are you sure you want to permanently delete user{' '}
                  <strong className="text-restaurant-text dark:text-white">
                    {deleteModalUser.name} ({deleteModalUser.email})
                  </strong>
                  ? They will immediately lose access to the system.
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteModalUser(null)}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-slate-800 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteUser}
                    disabled={deleting}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    {deleting ? 'Deleting...' : 'Delete User'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}