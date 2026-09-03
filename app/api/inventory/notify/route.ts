import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

/* =========================================================
   GET /api/inventory/notify
   Fetch notifications and unread count
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'unread', 'read', 'resolved', 'all'

    let query = supabase
      .from('inventory_notifications')
      .select('*')
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: [],
          unreadCount: 0,
        })
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    const notifications = data || []
    const unreadCount = notifications.filter((n: any) => n.status === 'unread').length

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
    })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch notifications',
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   POST /api/inventory/notify
   Kitchen worker sends low stock alert to Admin
========================================================= */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      item_id,
      item_name,
      category_type,
      current_quantity,
      min_threshold,
      sender_role,
      message,
    } = body

    if (!item_id || !item_name) {
      return NextResponse.json(
        { success: false, error: 'item_id and item_name are required' },
        { status: 400 }
      )
    }

    const notificationMessage =
      message?.trim() ||
      `${sender_role === 'drinks_kitchen' ? 'Drinks Kitchen' : 'Kitchen'} reported that ${item_name} is running low (Remaining: ${current_quantity}, Minimum: ${min_threshold}).`

    const { data, error } = await supabase
      .from('inventory_notifications')
      .insert({
        item_id,
        item_name,
        category_type: category_type || 'food',
        current_quantity: Number(current_quantity) || 0,
        min_threshold: Number(min_threshold) || 0,
        sender_role: sender_role || 'kitchen',
        message: notificationMessage,
        status: 'unread',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Low stock notification sent to Admin successfully!',
    }, { status: 201 })
  } catch (error) {
    console.error('Notifications POST error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification',
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   PUT /api/inventory/notify
   Update notification status (mark read / resolved)
========================================================= */

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Notification id is required' },
        { status: 400 }
      )
    }

    if (!['unread', 'read', 'resolved'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('inventory_notifications')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: `Notification marked as ${status}`,
    })
  } catch (error) {
    console.error('Notifications PUT error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update notification',
      },
      { status: 500 }
    )
  }
}
