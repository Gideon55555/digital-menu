import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

// GET /api/tables
//
// Returns ALL tables, including:
// - physical tables
// - split sections such as 1A / 1B
// - inactive tables
//
// The frontend groups children under their parent.
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .order('display_order', { ascending: true })
      .order('table_number', { ascending: true })

    if (error) {
      console.error('Error fetching tables:', error)

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      )
    }

    // Natural numeric sorting for table numbers (e.g. Table 1, Table 2, ... Table 10)
    const sortedData = (data || []).sort((a: any, b: any) => {
      const orderA = a.display_order ?? 0
      const orderB = b.display_order ?? 0
      if (orderA !== orderB) {
        return orderA - orderB
      }
      return String(a.table_number || '').localeCompare(
        String(b.table_number || ''),
        undefined,
        { numeric: true, sensitivity: 'base' }
      )
    })

    return NextResponse.json({
      success: true,
      data: sortedData,
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


// ============================================================
// POST /api/tables
//
// Used for:
// 1. Creating a normal physical table
// 2. Splitting a physical table into any amount of sections
// 3. Switching an order from one table to another
// 4. Merging split table sections back together
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // ========================================================
    // SWITCH TABLE / TRANSFER ORDER
    // ========================================================

    if (body.action === 'switch_table') {
      const { source_table_id, target_table_id, order_id } = body

      if (!target_table_id) {
        return NextResponse.json(
          { success: false, error: 'Destination table is required' },
          { status: 400 }
        )
      }

      // Verify destination table exists
      const { data: targetTable, error: targetError } = await supabase
        .from('tables')
        .select('*')
        .eq('id', target_table_id)
        .single()

      if (targetError || !targetTable) {
        return NextResponse.json(
          { success: false, error: 'Destination table not found' },
          { status: 404 }
        )
      }

      // If specific order_id provided
      if (order_id) {
        const { error: updateError } = await supabase
          .from('orders')
          .update({ table_id: target_table_id })
          .eq('id', order_id)

        if (updateError) {
          return NextResponse.json(
            { success: false, error: updateError.message },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: `Order successfully transferred to ${targetTable.name || `Table ${targetTable.table_number}`}`,
        })
      }

      // If source_table_id provided, transfer all active orders on that table
      if (source_table_id) {
        const { data: activeOrders, error: orderError } = await supabase
          .from('orders')
          .select('id')
          .eq('table_id', source_table_id)
          .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'served'])

        if (orderError) {
          return NextResponse.json(
            { success: false, error: orderError.message },
            { status: 500 }
          )
        }

        if (!activeOrders || activeOrders.length === 0) {
          return NextResponse.json(
            { success: false, error: 'No active orders found at the selected table to transfer' },
            { status: 400 }
          )
        }

        const orderIds = activeOrders.map((o) => o.id)
        const { error: updateOrdersError } = await supabase
          .from('orders')
          .update({ table_id: target_table_id })
          .in('id', orderIds)

        if (updateOrdersError) {
          return NextResponse.json(
            { success: false, error: updateOrdersError.message },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: `${orderIds.length} order(s) transferred to ${targetTable.name || `Table ${targetTable.table_number}`}`,
        })
      }

      return NextResponse.json(
        { success: false, error: 'Source table or order ID is required' },
        { status: 400 }
      )
    }

    // ========================================================
    // MERGE TABLE SECTIONS BACK TOGETHER
    // ========================================================

    if (body.action === 'merge_sections') {
      const { parent_table_id } = body

      if (!parent_table_id) {
        return NextResponse.json(
          { success: false, error: 'parent_table_id is required' },
          { status: 400 }
        )
      }

      const { data: children, error: childrenErr } = await supabase
        .from('tables')
        .select('id, table_number')
        .eq('parent_table_id', parent_table_id)

      if (childrenErr) {
        return NextResponse.json(
          { success: false, error: childrenErr.message },
          { status: 500 }
        )
      }

      if (children && children.length > 0) {
        const childIds = children.map((c) => c.id)

        // Move active orders from child sections to the parent table
        await supabase
          .from('orders')
          .update({ table_id: parent_table_id })
          .in('table_id', childIds)

        // Delete or deactivate the child sections
        const { error: deleteErr } = await supabase
          .from('tables')
          .delete()
          .in('id', childIds)

        if (deleteErr) {
          await supabase
            .from('tables')
            .update({ active: false })
            .in('id', childIds)
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Table sections merged successfully',
      })
    }

    // ========================================================
    // SPLIT TABLE
    // ========================================================

    if (body.action === 'split') {
      const {
        parent_table_id,
        sections,
      } = body

      if (!parent_table_id) {
        return NextResponse.json(
          {
            success: false,
            error: 'parent_table_id is required',
          },
          { status: 400 }
        )
      }

      if (
        !Array.isArray(sections) ||
        sections.length < 2
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'At least two sections are required',
          },
          { status: 400 }
        )
      }

      // ------------------------------------------------------
      // Find parent
      // ------------------------------------------------------

      const {
        data: parentTable,
        error: parentError,
      } = await supabase
        .from('tables')
        .select('*')
        .eq('id', parent_table_id)
        .single()

      if (parentError || !parentTable) {
        return NextResponse.json(
          {
            success: false,
            error: 'Parent table not found',
          },
          { status: 404 }
        )
      }

      // A section cannot itself be split.
      if (parentTable.parent_table_id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Only physical tables can be split',
          },
          { status: 400 }
        )
      }

      // ------------------------------------------------------
      // Check existing active children
      // ------------------------------------------------------

      const {
        data: existingChildren,
        error: childrenError,
      } = await supabase
        .from('tables')
        .select('id, table_number, active')
        .eq('parent_table_id', parent_table_id)
        .eq('active', true)

      if (childrenError) {
        console.error(
          'Error checking existing sections:',
          childrenError
        )

        return NextResponse.json(
          {
            success: false,
            error: childrenError.message,
          },
          { status: 500 }
        )
      }

      if (
        existingChildren &&
        existingChildren.length > 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'This table is already split. Remove or deactivate its existing sections before splitting it again.',
          },
          { status: 400 }
        )
      }

      // ------------------------------------------------------
      // Clean sections
      // ------------------------------------------------------

      const cleanedSections = sections.map(
        (section: {
          suffix?: string
          capacity?: number
        }) => ({
          suffix: String(section.suffix || '')
            .trim()
            .toUpperCase(),

          capacity: Number(section.capacity),
        })
      )

      // ------------------------------------------------------
      // Validate
      // ------------------------------------------------------

      for (const section of cleanedSections) {
        if (!section.suffix) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Every section needs a suffix such as A or B',
            },
            { status: 400 }
          )
        }

        if (
          !section.capacity ||
          section.capacity < 1
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Every section must have a capacity of at least 1',
            },
            { status: 400 }
          )
        }
      }

      // ------------------------------------------------------
      // Make suffixes unique
      // ------------------------------------------------------

      const suffixes = cleanedSections.map(
        (section: { suffix: string }) =>
          section.suffix
      )

      if (
        new Set(suffixes).size !== suffixes.length
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Section suffixes must be unique',
          },
          { status: 400 }
        )
      }

      // ------------------------------------------------------
      // Generate table numbers
      //
      // Example:
      // parent = 1
      // suffix A -> 1A
      // suffix B -> 1B
      // ------------------------------------------------------

      const tableNumbers = cleanedSections.map(
        (section: { suffix: string }) =>
          `${parentTable.table_number}${section.suffix}`
      )

      // ------------------------------------------------------
      // Check conflicts
      // ------------------------------------------------------

      const {
        data: conflictingTables,
        error: conflictError,
      } = await supabase
        .from('tables')
        .select('table_number')
        .in('table_number', tableNumbers)

      if (conflictError) {
        console.error(
          'Error checking table numbers:',
          conflictError
        )

        return NextResponse.json(
          {
            success: false,
            error: conflictError.message,
          },
          { status: 500 }
        )
      }

      if (
        conflictingTables &&
        conflictingTables.length > 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `These table sections already exist: ${conflictingTables
              .map(
                (table) => table.table_number
              )
              .join(', ')}`,
          },
          { status: 400 }
        )
      }

      // ------------------------------------------------------
      // Create sections
      // ------------------------------------------------------

      const sectionRows = cleanedSections.map(
        (
          section: {
            suffix: string
            capacity: number
          },
          index: number
        ) => ({
          table_number:
            `${parentTable.table_number}${section.suffix}`,

          name:
            `${parentTable.name || `Table ${parentTable.table_number}`} ${section.suffix}`,

          capacity: section.capacity,

          parent_table_id:
            parentTable.id,

          status: 'available',

          display_order:
            Number(
              parentTable.display_order || 0
            ) +
            index +
            1,

          active: true,
        })
      )

      const {
        data: createdSections,
        error: insertError,
      } = await supabase
        .from('tables')
        .insert(sectionRows)
        .select()

      if (insertError) {
        console.error(
          'Error creating table sections:',
          insertError
        )

        return NextResponse.json(
          {
            success: false,
            error: insertError.message,
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            parent: parentTable,
            sections:
              createdSections || [],
          },
        },
        { status: 201 }
      )
    }


    // ========================================================
    // NORMAL TABLE CREATION
    // ========================================================

    const {
      table_number,
      name,
      capacity,
      parent_table_id,
      display_order,
    } = body

    if (!table_number) {
      return NextResponse.json(
        {
          success: false,
          error: 'table_number is required',
        },
        { status: 400 }
      )
    }

    const cleanedTableNumber =
      String(table_number).trim()

    const capacityNumber =
      Number(capacity || 4)

    if (
      !capacityNumber ||
      capacityNumber < 1
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Capacity must be at least 1',
        },
        { status: 400 }
      )
    }

    // ------------------------------------------------------
    // Duplicate check
    // ------------------------------------------------------

    const {
      data: existingTable,
    } = await supabase
      .from('tables')
      .select('id')
      .eq(
        'table_number',
        cleanedTableNumber
      )
      .maybeSingle()

    if (existingTable) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Table ${cleanedTableNumber} already exists`,
        },
        { status: 400 }
      )
    }

    // ------------------------------------------------------
    // Insert
    // ------------------------------------------------------

    const {
      data,
      error,
    } = await supabase
      .from('tables')
      .insert({
        table_number:
          cleanedTableNumber,

        name:
          name?.trim() ||
          `Table ${cleanedTableNumber}`,

        capacity:
          capacityNumber,

        parent_table_id:
          parent_table_id || null,

        display_order:
          display_order !== undefined
            ? Number(display_order)
            : 0,

        status: 'available',

        active: true,
      })
      .select()
      .single()

    if (error) {
      console.error(
        'Error creating table:',
        error
      )

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
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
    console.error(
      'Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}


// ============================================================
// PUT /api/tables
//
// Used for:
// - editing a table
// - changing status
// - reactivating a table
// - moving 1A/1B to another physical table
// ============================================================

export async function PUT(
  request: NextRequest
) {
  try {
    const body = await request.json()

    // ------------------------------------------------------
    // Batch reorder tables
    // ------------------------------------------------------
    if (body.action === 'reorder' && Array.isArray(body.orders)) {
      for (const item of body.orders) {
        if (item.id && typeof item.display_order === 'number') {
          await supabase
            .from('tables')
            .update({
              display_order: item.display_order,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id)
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Tables reordered successfully',
      })
    }

    const {
      id,
      table_number,
      name,
      capacity,
      parent_table_id,
      status,
      display_order,
      active,
    } = body

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Table id is required',
        },
        { status: 400 }
      )
    }

    // ------------------------------------------------------
    // Find current table
    // ------------------------------------------------------

    const {
      data: existingTable,
      error: findError,
    } = await supabase
      .from('tables')
      .select('*')
      .eq('id', id)
      .single()

    if (
      findError ||
      !existingTable
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Table not found',
        },
        { status: 404 }
      )
    }

    const updates: Record<
      string,
      unknown
    > = {}

    // ------------------------------------------------------
    // Table number
    // ------------------------------------------------------

    let newTableNumber =
      existingTable.table_number

    if (
      table_number !== undefined
    ) {
      newTableNumber =
        String(table_number).trim()

      if (!newTableNumber) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Table number cannot be empty',
          },
          { status: 400 }
        )
      }

      updates.table_number =
        newTableNumber
    }

    // ------------------------------------------------------
    // Name
    // ------------------------------------------------------

    if (name !== undefined) {
      updates.name =
        String(name).trim()
    }

    // ------------------------------------------------------
    // Capacity
    // ------------------------------------------------------

    if (capacity !== undefined) {
      const capacityNumber =
        Number(capacity)

      if (
        !capacityNumber ||
        capacityNumber < 1
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Capacity must be at least 1',
          },
          { status: 400 }
        )
      }

      updates.capacity =
        capacityNumber
    }

    // ------------------------------------------------------
    // Parent / MOVE SECTION
    // ------------------------------------------------------

    if (
      parent_table_id !== undefined
    ) {
      if (
        parent_table_id === id
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'A table cannot be its own parent',
          },
          { status: 400 }
        )
      }

      // If this is a section being moved,
      // automatically preserve its suffix.
      if (
        parent_table_id &&
        existingTable.parent_table_id
      ) {
        const {
          data: newParent,
          error: parentError,
        } = await supabase
          .from('tables')
          .select('*')
          .eq(
            'id',
            parent_table_id
          )
          .single()

        if (
          parentError ||
          !newParent
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Destination table not found',
            },
            { status: 404 }
          )
        }

        // Destination must be a physical table.
        if (
          newParent.parent_table_id
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                'A section cannot be moved under another section',
            },
            { status: 400 }
          )
        }

        // Get suffix from existing number.
        const oldParent =
          await supabase
            .from('tables')
            .select('table_number')
            .eq(
              'id',
              existingTable.parent_table_id
            )
            .single()

        let suffix = ''

        if (
          oldParent.data
        ) {
          suffix =
            existingTable.table_number
              .replace(
                oldParent.data.table_number,
                ''
              )
              .toUpperCase()
        }

        if (!suffix) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Could not determine section suffix',
            },
            { status: 400 }
          )
        }

        newTableNumber =
          `${newParent.table_number}${suffix}`

        updates.table_number =
          newTableNumber

        updates.parent_table_id =
          newParent.id
      } else {
        updates.parent_table_id =
          parent_table_id || null
      }
    }

    // ------------------------------------------------------
    // Check duplicate table number
    // ------------------------------------------------------

    if (
      newTableNumber !==
      existingTable.table_number
    ) {
      const {
        data: duplicate,
      } = await supabase
        .from('tables')
        .select('id')
        .eq(
          'table_number',
          newTableNumber
        )
        .neq('id', id)
        .maybeSingle()

      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Table ${newTableNumber} already exists`,
          },
          { status: 400 }
        )
      }
    }

    // ------------------------------------------------------
    // Status
    // ------------------------------------------------------

    if (status !== undefined) {
      updates.status =
        status
    }

    // ------------------------------------------------------
    // Display order
    // ------------------------------------------------------

    if (
      display_order !== undefined
    ) {
      updates.display_order =
        Number(display_order)
    }

    // ------------------------------------------------------
    // Active
    // ------------------------------------------------------

    if (active !== undefined) {
      updates.active =
        Boolean(active)
    }

    updates.updated_at =
      new Date().toISOString()

    // ------------------------------------------------------
    // Update
    // ------------------------------------------------------

    const {
      data,
      error,
    } = await supabase
      .from('tables')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error(
        'Error updating table:',
        error
      )

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
      data,
    })
  } catch (error) {
    console.error(
      'Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}


// ============================================================
// DELETE /api/tables?id=...
//
// Deactivates a table.
// ============================================================

export async function DELETE(
  request: NextRequest
) {
  try {
    const {
      searchParams,
    } = new URL(request.url)

    const id =
      searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Table id is required',
        },
        { status: 400 }
      )
    }

    // ------------------------------------------------------
    // Find table
    // ------------------------------------------------------

    const {
      data: table,
      error: tableError,
    } = await supabase
      .from('tables')
      .select('*')
      .eq('id', id)
      .single()

    if (
      tableError ||
      !table
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Table not found',
        },
        { status: 404 }
      )
    }

    // ------------------------------------------------------
    // Don't deactivate a physical table while
    // active sections still exist.
    // ------------------------------------------------------

    if (
      !table.parent_table_id
    ) {
      const {
        data: children,
      } = await supabase
        .from('tables')
        .select('id, table_number')
        .eq(
          'parent_table_id',
          id
        )
        .eq('active', true)

      if (
        children &&
        children.length > 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Cannot deactivate ${table.name || `Table ${table.table_number}`} while it has active sections: ${children
                .map(
                  (child) =>
                    child.table_number
                )
                .join(', ')}`,
          },
          { status: 400 }
        )
      }
    }

    // ------------------------------------------------------
    // Active order check (Cannot delete if seated/active order exists)
    // ------------------------------------------------------
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('table_id', id)
      .not('status', 'in', '(completed,cancelled)')
      .limit(1)

    if (activeOrders && activeOrders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete ${table.name || `Table ${table.table_number}`} because it currently has an active order (#${activeOrders[0].order_number}). Please complete, cancel, or switch the order first.`,
        },
        { status: 400 }
      )
    }

    const isDeactivateOnly = searchParams.get('action') === 'deactivate'

    if (isDeactivateOnly) {
      // ------------------------------------------------------
      // Soft Deactivate
      // ------------------------------------------------------
      const {
        data,
        error,
      } = await supabase
        .from('tables')
        .update({
          active: false,
          status: 'inactive',
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error deactivating table:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data,
      })
    }

    // ------------------------------------------------------
    // Permanent Deletion
    // ------------------------------------------------------
    // 1. Unlink past completed orders so foreign keys don't block deletion
    await supabase
      .from('orders')
      .update({ table_id: null })
      .eq('table_id', id)

    // 2. Remove table sessions for this table
    await supabase
      .from('table_sessions')
      .delete()
      .eq('table_id', id)

    // 3. Remove child split sections if any
    const { data: children } = await supabase
      .from('tables')
      .select('id')
      .eq('parent_table_id', id)

    if (children && children.length > 0) {
      const childIds = children.map((c) => c.id)
      await supabase.from('orders').update({ table_id: null }).in('table_id', childIds)
      await supabase.from('table_sessions').delete().in('table_id', childIds)
      await supabase.from('tables').delete().in('id', childIds)
    }

    // 4. Delete the table record itself
    const { error: deleteError } = await supabase
      .from('tables')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting table:', deleteError)
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Table ${table.table_number} deleted successfully`,
    })
  } catch (error) {
    console.error(
      'Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}