import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeAdminRole } from '@/lib/admin-auth';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

async function requireAdmin(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (!accessToken) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: adminUser, error: adminError } = await supabaseAdmin
    .from('admin_users')
    .select('id, role')
    .eq('id', data.user.id)
    .maybeSingle();

  const normalizedRole = normalizeAdminRole(adminUser?.role);

  if (adminError || !adminUser || normalizedRole !== 'admin') {
    return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { user: data.user, adminUser };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    const supabaseAdmin = getSupabaseAdmin();

    if ('error' in auth) {
      return auth.error;
    }

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('id, email, name, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load admin users',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    const supabaseAdmin = getSupabaseAdmin();

    if ('error' in auth) {
      return auth.error;
    }

    const { email, password, name, role } = await request.json();

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { success: false, error: 'email, password, name, and role are required' },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          success: false,
          error: authError?.message || 'Failed to create auth user',
          stage: 'auth.createUser',
        },
        { status: 500 }
      );
    }

    const { error: adminUserError } = await supabaseAdmin.from('admin_users').insert({
      id: authData.user.id,
      email,
      name,
      role,
    });

    if (adminUserError) {
      return NextResponse.json(
        {
          success: false,
          error: adminUserError.message || 'Failed to insert admin user',
          stage: 'admin_users.insert',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: authData.user.id, email, name, role },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create admin user',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    const supabaseAdmin = getSupabaseAdmin();

    if ('error' in auth) {
      return auth.error;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'User id is required' },
        { status: 400 }
      );
    }

    // Prevent admin from deleting their own currently logged-in account
    if (auth.user.id === id) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete your own account while logged in.' },
        { status: 400 }
      );
    }

    // Delete from admin_users table
    const { error: dbError } = await supabaseAdmin
      .from('admin_users')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('Failed to delete from admin_users:', dbError);
    }

    // Delete from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (authError) {
      console.error('Failed to delete auth user:', authError);
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete user',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    const supabaseAdmin = getSupabaseAdmin();

    if ('error' in auth) {
      return auth.error;
    }

    const body = await request.json();
    const { id, password, name, role } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'User id is required' },
        { status: 400 }
      );
    }

    // If changing password
    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 6 characters long' },
          { status: 400 }
        );
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        id,
        { password }
      );

      if (authError) {
        return NextResponse.json(
          { success: false, error: authError.message },
          { status: 500 }
        );
      }
    }

    // If updating name or role
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;

    if (Object.keys(updates).length > 0) {
      const { error: dbError } = await supabaseAdmin
        .from('admin_users')
        .update(updates)
        .eq('id', id);

      if (dbError) {
        return NextResponse.json(
          { success: false, error: dbError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user',
      },
      { status: 500 }
    );
  }
}