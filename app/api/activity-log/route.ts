import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/* =========================================================
   GET /api/activity-log
   Query params:
     - action_type (ORDER_CANCELLED | ORDER_PAID | EXPENSE_ADDED | etc)
     - search
     - limit
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const actionType = searchParams.get('action_type');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let query = supabase
      .from('action_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (actionType && actionType !== 'all') {
      query = query.eq('action_type', actionType);
    }

    if (search) {
      query = query.ilike('description', `%${search}%`);
    }

    const { data: logsData, error } = await query;

    // Fallback if table action_logs doesn't exist yet: fetch from order_history
    if (error) {
      console.warn('action_logs fetch notice:', error.message);
      
      // Fallback query to order_history
      const { data: historyData } = await supabase
        .from('order_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      const fallbackLogs = (historyData || []).map((h: any) => ({
        id: h.id || `hist-${Math.random()}`,
        action_type: h.new_status === 'cancelled' ? 'ORDER_CANCELLED' : h.new_status === 'paid' ? 'ORDER_PAID' : 'ORDER_UPDATED',
        description: h.note || `Order status updated to ${h.new_status}`,
        performed_by: h.changed_by || 'Staff',
        role: 'staff',
        target_id: h.order_id,
        created_at: h.created_at || new Date().toISOString(),
      }));

      return NextResponse.json({
        success: true,
        data: fallbackLogs,
        fallback: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: logsData || [],
    });
  } catch (error) {
    console.error('Activity log error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load activity logs',
        data: [],
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST /api/activity-log
   Body: { action_type, description, performed_by, role, target_id, metadata }
========================================================= */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action_type, description, performed_by, role, target_id, metadata } = body;

    if (!description || !description.trim()) {
      return NextResponse.json(
        { success: false, error: 'Description is required' },
        { status: 400 }
      );
    }

    const logEntry = {
      action_type: action_type || 'GENERAL',
      description: description.trim(),
      performed_by: performed_by || 'Staff User',
      role: role || 'admin',
      target_id: target_id || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('action_logs')
      .insert(logEntry)
      .select()
      .single();

    if (error) {
      console.warn('Action log insert notice:', error.message);
      // Return success even if DB table needs migration so user flow isn't blocked
      return NextResponse.json({
        success: true,
        data: logEntry,
        warning: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Action log error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record action log',
      },
      { status: 500 }
    );
  }
}
