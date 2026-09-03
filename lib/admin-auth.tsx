import { supabase } from '@/lib/supabase';

export type AdminRole =
  | 'admin'
  | 'cashier'
  | 'order_manager'
  | 'kitchen'
  | 'drinks_kitchen'
  | 'waiter'
  | 'owner'
  | 'manager'
  | 'editor'
  | 'chef';

export function normalizeAdminRole(role: string | null | undefined): AdminRole {
  const normalized = String(role || '').trim().toLowerCase();

  if (normalized === 'owner' || normalized === 'manager' || normalized === 'editor') {
    return 'admin';
  }

  if (normalized === 'chef') {
    return 'kitchen';
  }

  if (
    normalized === 'admin' ||
    normalized === 'cashier' ||
    normalized === 'order_manager' ||
    normalized === 'kitchen' ||
    normalized === 'drinks_kitchen' ||
    normalized === 'waiter'
  ) {
    return normalized as AdminRole;
  }

  return 'order_manager';
}

export function getAdminHomeRoute(role: string | null | undefined) {
  const normalized = normalizeAdminRole(role);

  switch (normalized) {
    case 'admin':
      return '/admin/reports/orders';
    case 'cashier':
    case 'order_manager':
      return '/admin/orders';
    case 'kitchen':
      return '/admin/kitchen';
    case 'drinks_kitchen':
      return '/admin/drinks-kitchen';
    case 'waiter':
      return '/waiter';
    default:
      return '/admin/orders';
  }
}

export async function getAdminAccessToken() {
  const { data } = await supabase.auth.getSession();

  return data.session?.access_token ?? null;
}

export async function signInAdmin(email: string, password: string) {
  // Ensure any previous session is completely cleared first
  try {
    await supabase.auth.signOut();
  } catch (e) {
    // ignore
  }

  // Sign in using Supabase Auth
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError) {
    throw new Error(authError.message);
  }

  if (!authData.user) {
    throw new Error('Authentication failed');
  }

  // Check that the authenticated user exists in admin_users
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('id, email, name, role')
    .eq('id', authData.user.id)
    .single();

  if (adminError || !adminUser) {
    // Sign out if the user is authenticated but isn't an admin
    await supabase.auth.signOut();
    throw new Error('You do not have permission to access the admin panel.');
  }

  return {
    user: authData.user,
    adminUser,
  };
}

export function getAdminRoleHomeRoute(role: string | null | undefined) {
  return getAdminHomeRoute(role);
}

export async function signOutAdmin() {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Sign out error:', error);
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('admin_token');
      sessionStorage.clear();
    } catch (e) {
      // ignore
    }
  }
}

export async function getAdminAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;

  if (!user) {
    return null;
  }

  const { data: adminUser, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !adminUser) {
    return null;
  }

  return {
    user,
    adminUser,
  };
}