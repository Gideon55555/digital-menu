import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logAction } from '@/lib/activity-logger'

/* =========================================================
   GET /api/taken-materials
========================================================= */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('taken_materials')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to query taken_materials:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error) {
    console.error('GET taken_materials error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/* =========================================================
   POST /api/taken-materials
========================================================= */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      item_name,
      borrower_name,
      borrower_phone,
      quantity = 1,
      taken_date,
      notes,
      created_by,
    } = body

    if (!item_name || !String(item_name).trim()) {
      return NextResponse.json(
        { success: false, error: 'Item name is required' },
        { status: 400 }
      )
    }

    if (!borrower_name || !String(borrower_name).trim()) {
      return NextResponse.json(
        { success: false, error: 'Borrower / person name is required' },
        { status: 400 }
      )
    }

    const takenDateIso = taken_date ? new Date(taken_date).toISOString() : new Date().toISOString()

    const { data, error } = await supabase
      .from('taken_materials')
      .insert({
        item_name: String(item_name).trim(),
        borrower_name: String(borrower_name).trim(),
        borrower_phone: borrower_phone ? String(borrower_phone).trim() : null,
        quantity: Math.max(1, Number(quantity) || 1),
        taken_date: takenDateIso,
        status: 'borrowed',
        notes: notes ? String(notes).trim() : null,
        created_by: created_by ? String(created_by).trim() : null,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to insert taken_material:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    await logAction({
      action_type: 'GENERAL',
      description: `Registered taken item "${item_name}" borrowed by ${borrower_name}`,
      role: created_by || 'staff',
      metadata: { item_id: data.id, item_name, borrower_name, quantity },
    })

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    console.error('POST taken_materials error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/* =========================================================
   PUT /api/taken-materials
========================================================= */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, action, status, item_name, borrower_name, borrower_phone, quantity, notes } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'Material ID is required' }, { status: 400 })
    }

    // Action: Mark returned
    if (action === 'mark_returned' || status === 'returned') {
      const { data, error } = await supabase
        .from('taken_materials')
        .update({
          status: 'returned',
          return_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      await logAction({
        action_type: 'GENERAL',
        description: `Marked taken item "${data.item_name}" returned by ${data.borrower_name}`,
        role: 'staff',
        metadata: { item_id: id, item_name: data.item_name, borrower_name: data.borrower_name },
      })

      return NextResponse.json({ success: true, data, message: 'Item marked as returned successfully' })
    }

    // Generic update
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (item_name) updatePayload.item_name = String(item_name).trim()
    if (borrower_name) updatePayload.borrower_name = String(borrower_name).trim()
    if (borrower_phone !== undefined) updatePayload.borrower_phone = borrower_phone ? String(borrower_phone).trim() : null
    if (quantity) updatePayload.quantity = Math.max(1, Number(quantity) || 1)
    if (notes !== undefined) updatePayload.notes = notes ? String(notes).trim() : null
    if (status) updatePayload.status = status

    const { data, error } = await supabase
      .from('taken_materials')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('PUT taken_materials error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/* =========================================================
   DELETE /api/taken-materials
========================================================= */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 })
    }

    const { error } = await supabase.from('taken_materials').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Record deleted successfully' })
  } catch (error) {
    console.error('DELETE taken_materials error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
