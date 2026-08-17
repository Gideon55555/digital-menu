import { supabase } from '@/lib/supabase';

export async function signInAdmin(email: string, password: string) {
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

export async function signOutAdmin() {
  await supabase.auth.signOut();
}

export async function getAdminAuth() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id, email, name, role')
    .eq('id', user.id)
    .single();

  if (!adminUser) {
    return null;
  }

  return {
    user,
    adminUser,
  };
}