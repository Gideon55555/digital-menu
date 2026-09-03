import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

/* =========================================================
   GET /api/inventory
   Query params:
   - category_type: 'food' | 'drink' | 'all'
   - search: string
   - low_stock_only: 'true' | 'false'
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryType = searchParams.get('category_type')
    const search = searchParams.get('search')?.trim()
    const lowStockOnly = searchParams.get('low_stock_only') === 'true'

    let query = supabase
      .from('inventory_items')
      .select('*')
      .order('name', { ascending: true })

    if (categoryType && categoryType !== 'all') {
      query = query.eq('category_type', categoryType)
    }

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      // If table doesn't exist yet, return empty list with instruction
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: [],
          tableNotCreated: true,
          message: 'inventory_items table not created yet. Please execute the SQL script in Supabase.',
        })
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    let items = data || []

    if (lowStockOnly) {
      items = items.filter((item: any) => Number(item.quantity) <= Number(item.min_threshold))
    }

    return NextResponse.json({
      success: true,
      data: items,
    })
  } catch (error) {
    console.error('Inventory GET error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch inventory',
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   POST /api/inventory
   Create a new inventory item
========================================================= */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      category_type,
      quantity = 0,
      unit = 'units',
      min_threshold = 5,
      cost_per_unit = 0,
      notes = null,
    } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Item name is required' },
        { status: 400 }
      )
    }

    if (!['food', 'drink'].includes(category_type)) {
      return NextResponse.json(
        { success: false, error: 'category_type must be either food or drink' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        name: name.trim(),
        category_type,
        quantity: Number(quantity) || 0,
        unit: unit.trim() || 'units',
        min_threshold: Number(min_threshold) || 5,
        cost_per_unit: Number(cost_per_unit) || 0,
        notes: notes ? String(notes).trim() : null,
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
      message: 'Inventory item added successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('Inventory POST error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create inventory item',
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   PUT /api/inventory
   Update quantity or details
========================================================= */

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      name,
      category_type,
      quantity,
      unit,
      min_threshold,
      cost_per_unit,
      notes,
    } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Item id is required' },
        { status: 400 }
      )
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updates.name = String(name).trim()
    if (category_type !== undefined && ['food', 'drink'].includes(category_type)) {
      updates.category_type = category_type
    }
    if (quantity !== undefined) updates.quantity = Number(quantity)
    if (unit !== undefined) updates.unit = String(unit).trim()
    if (min_threshold !== undefined) updates.min_threshold = Number(min_threshold)
    if (cost_per_unit !== undefined) updates.cost_per_unit = Number(cost_per_unit)
    if (notes !== undefined) updates.notes = notes ? String(notes).trim() : null

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updates)
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
      message: 'Inventory item updated successfully',
    })
  } catch (error) {
    console.error('Inventory PUT error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update inventory item',
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   DELETE /api/inventory
   Remove inventory item
========================================================= */

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Item id is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Inventory item removed successfully',
    })
  } catch (error) {
    console.error('Inventory DELETE error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete inventory item',
      },
      { status: 500 }
    )
  }
}
