import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/table-sessions
// Returns active table sessions.
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('table_sessions')
      .select(`
        *,
        tables (
          id,
          table_number,
          name,
          capacity,
          status,
          active
        )
      `)
      .eq('status', 'active')
      .order('opened_at', { ascending: true })

    if (error) {
      console.error('Error fetching table sessions:', error)

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error) {
    console.error('Unexpected error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}


// POST /api/table-sessions
// Opens a new session for a table.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      table_id,
      opened_by,
    } = body

    if (!table_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'table_id is required',
        },
        { status: 400 }
      )
    }

    // Check that the table exists and is active.
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('id, status, active')
      .eq('id', table_id)
      .single()

    if (tableError || !table) {
      return NextResponse.json(
        {
          success: false,
          error: 'Table not found',
        },
        { status: 404 }
      )
    }

    if (!table.active) {
      return NextResponse.json(
        {
          success: false,
          error: 'This table is inactive',
        },
        { status: 400 }
      )
    }

    // Check if this table already has an active session.
    const { data: existingSession, error: existingError } =
      await supabase
        .from('table_sessions')
        .select('id')
        .eq('table_id', table_id)
        .eq('status', 'active')
        .maybeSingle()

    if (existingError) {
      console.error(
        'Error checking existing session:',
        existingError
      )

      return NextResponse.json(
        {
          success: false,
          error: existingError.message,
        },
        { status: 500 }
      )
    }

    if (existingSession) {
      return NextResponse.json(
        {
          success: false,
          error: 'This table already has an active session',
        },
        { status: 409 }
      )
    }

    const sessionData: Record<string, unknown> = {
      table_id,
      status: 'active',
    }

    if (opened_by) {
      sessionData.opened_by = opened_by
    }

    const { data, error } = await supabase
      .from('table_sessions')
      .insert(sessionData)
      .select(`
        *,
        tables (
          id,
          table_number,
          name,
          capacity,
          status,
          active
        )
      `)
      .single()

    if (error) {
      console.error('Error creating table session:', error)

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      )
    }

    // Mark the physical table as occupied.
    const { error: updateTableError } = await supabase
      .from('tables')
      .update({
        status: 'occupied',
        updated_at: new Date().toISOString(),
      })
      .eq('id', table_id)

    if (updateTableError) {
      console.error(
        'Session created but table status could not be updated:',
        updateTableError
      )
    }

    return NextResponse.json(
      {
        success: true,
        data,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}


// PUT /api/table-sessions
// Closes an active table session.
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      id,
      closed_by,
    } = body

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session id is required',
        },
        { status: 400 }
      )
    }

    const { data: session, error: sessionError } =
      await supabase
        .from('table_sessions')
        .select('id, table_id, status')
        .eq('id', id)
        .single()

    if (sessionError || !session) {
      return NextResponse.json(
        {
          success: false,
          error: 'Table session not found',
        },
        { status: 404 }
      )
    }

    if (session.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          error: 'This table session is already closed',
        },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {
      status: 'closed',
      closed_at: new Date().toISOString(),
    }

    if (closed_by) {
      updates.closed_by = closed_by
    }

    const { data, error } = await supabase
      .from('table_sessions')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        tables (
          id,
          table_number,
          name,
          capacity,
          status,
          active
        )
      `)
      .single()

    if (error) {
      console.error('Error closing table session:', error)

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      )
    }

    // Make the physical table available again.
    const { error: updateTableError } = await supabase
      .from('tables')
      .update({
        status: 'available',
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.table_id)

    if (updateTableError) {
      console.error(
        'Session closed but table status could not be updated:',
        updateTableError
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Unexpected error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}