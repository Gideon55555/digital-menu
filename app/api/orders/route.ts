import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { logAction } from '@/lib/activity-logger'

function isDrinkCategory(type: string | null | undefined) {
  const normalized = String(type || '').trim().toLowerCase()
  return normalized === 'drink' || normalized === 'drinks'
}

type OrderItemInput = {
  menu_item_id: string
  quantity: number
  notes?: string | null
}

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'served',
  'completed',
  'cancelled',
]

const PAYMENT_METHODS = [
  'cash',
  'cbe',
  'telebirr',
]

/* =========================================================
   GET NEXT ORDER NUMBER
========================================================= */

async function getNextOrderNumber() {
  const { data, error } = await supabase
    .from('orders')
    .select('order_number')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('Failed to query orders for sequence number:', error)
  }

  let maxSequence = 0

  if (data && data.length > 0) {
    for (const ord of data) {
      if (ord.order_number) {
        // Matches "order-1", "order-2", "Order-5", or simple numbers "1", "2"
        const match = String(ord.order_number).match(/(?:order-)?(\d+)$/i)
        if (match) {
          const num = parseInt(match[1], 10)
          // Filter out legacy epoch timestamps (>1000000)
          if (!isNaN(num) && num > maxSequence && num < 1000000) {
            maxSequence = num
          }
        }
      }
    }
  }

  let nextNumber = maxSequence + 1
  let candidate = `order-${nextNumber}`

  // Safety check: guarantee uniqueness against database
  while (true) {
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', candidate)
      .maybeSingle()

    if (!existing) {
      break
    }
    nextNumber++
    candidate = `order-${nextNumber}`
  }

  return candidate
}

/* =========================================================
   LOG ORDER HISTORY
========================================================= */

async function logOrderHistory({
  orderId,
  previousStatus = null,
  newStatus,
  note = null,
  changedBy = null,
}: {
  orderId: string
  previousStatus?: string | null
  newStatus: string
  note?: string | null
  changedBy?: string | null
}) {
  try {
    await supabase.from('order_history').insert({
      order_id: orderId,
      previous_status: previousStatus,
      new_status: newStatus,
      note,
      changed_by: changedBy,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Failed to record order history log:', err)
  }
}

/* =========================================================
   GET /api/orders
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(request.url)

    const id =
      searchParams.get('id')

    /* =====================================================
       SINGLE ORDER
    ===================================================== */

    if (id) {
      const {
        data: order,
        error: orderError,
      } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()

      if (
        orderError ||
        !order
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Order not found',
          },
          { status: 404 }
        )
      }

      const {
        data: items,
        error: itemsError,
      } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id)
        .order('created_at', {
          ascending: true,
        })

      if (itemsError) {
        return NextResponse.json(
          {
            success: false,
            error: itemsError.message,
          },
          { status: 500 }
        )
      }

      const menuItemIds = [
        ...new Set(
          (items || [])
            .map(
              (item) =>
                item.menu_item_id
            )
            .filter(Boolean)
        ),
      ]

      let enrichedItems =
        items || []

      if (
        menuItemIds.length > 0
      ) {
        const {
          data: menuItems,
        } = await supabase
          .from('menu_items')
          .select(
            'id, category_id'
          )
          .in(
            'id',
            menuItemIds
          )

        const categoryIds = [
          ...new Set(
            (menuItems || [])
              .map(
                (item) =>
                  item.category_id
              )
              .filter(Boolean)
          ),
        ]

        let categories:
          any[] = []

        if (
          categoryIds.length > 0
        ) {
          const {
            data: categoryData,
          } = await supabase
            .from('categories')
            .select('id, type')
            .in(
              'id',
              categoryIds
            )

          categories =
            categoryData || []
        }

        enrichedItems =
          (items || []).map(
            (item) => {
              const menuItem =
                (menuItems || []).find(
                  (menu) =>
                    menu.id ===
                    item.menu_item_id
                )

              const category =
                categories.find(
                  (cat) =>
                    cat.id ===
                    menuItem?.category_id
                )

              return {
                ...item,
                category_type:
                  category?.type ||
                  'unknown',
              }
            }
          )
      }

      return NextResponse.json({
        success: true,
        data: {
          ...order,
          items: enrichedItems,
        },
      })
    }

    /* =====================================================
       ALL ORDERS
    ===================================================== */

    const {
      data: orders,
      error,
    } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    if (error) {
      console.error(
        'Error fetching orders:',
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

    const orderIds =
      (orders || []).map(
        (order) => order.id
      )

    let allItems: any[] = []

    if (
      orderIds.length > 0
    ) {
      const {
        data: items,
      } = await supabase
        .from('order_items')
        .select('*')
        .in(
          'order_id',
          orderIds
        )
        .order('created_at', {
          ascending: true,
        })

      allItems =
        items || []
    }

    const menuItemIds = [
      ...new Set(
        allItems
          .map(
            (item) =>
              item.menu_item_id
          )
          .filter(Boolean)
      ),
    ]

    let menuItems:
      any[] = []

    if (
      menuItemIds.length > 0
    ) {
      const {
        data,
      } = await supabase
        .from('menu_items')
        .select(
          'id, category_id'
        )
        .in(
          'id',
          menuItemIds
        )

      menuItems =
        data || []
    }

    const categoryIds = [
      ...new Set(
        menuItems
          .map(
            (item) =>
              item.category_id
          )
          .filter(Boolean)
      ),
    ]

    let categories:
      any[] = []

    if (
      categoryIds.length > 0
    ) {
      const {
        data,
      } = await supabase
        .from('categories')
        .select(
          'id, type'
        )
        .in(
          'id',
          categoryIds
        )

      categories =
        data || []
    }

    const enrichedItems =
      allItems.map(
        (item) => {
          const menuItem =
            menuItems.find(
              (menu) =>
                menu.id ===
                item.menu_item_id
            )

          const category =
            categories.find(
              (cat) =>
                cat.id ===
                menuItem?.category_id
            )

          return {
            ...item,
            category_type:
              category?.type ||
              'unknown',
          }
        }
      )

    const completeOrders =
      (orders || []).map(
        (order) => ({
          ...order,
          items:
            enrichedItems.filter(
              (item) =>
                item.order_id ===
                order.id
            ),
        })
      )

    return NextResponse.json({
      success: true,
      data: completeOrders,
    })
  } catch (error) {
    console.error(
      'Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   POST /api/orders
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json()

    const {
      table_id,
      table_session_id,
      order_type = 'dine_in',
      waiter_id,
      waiter_name,
      waiter_email,
      customer_name,
      customer_phone,
      notes,
      creator_role,
      items,
    } = body

    const isDirectReady =
      creator_role === 'cashier' ||
      creator_role === 'order_manager' ||
      body.direct_ready === true

    const initialStatus = isDirectReady ? 'ready' : 'pending'

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'At least one order item is required',
        },
        { status: 400 }
      )
    }

    if (
      order_type === 'dine_in' &&
      !table_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'table_id is required for dine-in orders',
        },
        { status: 400 }
      )
    }

    /* =====================================================
       TABLE SESSION
    ===================================================== */

    let resolvedTableSessionId:
      | string
      | null = null

    if (
      order_type === 'dine_in'
    ) {
      if (table_session_id) {
        const {
          data: suppliedSession,
          error,
        } = await supabase
          .from('table_sessions')
          .select(
            'id, table_id, status'
          )
          .eq(
            'id',
            table_session_id
          )
          .single()

        if (
          error ||
          !suppliedSession
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Table session not found',
            },
            { status: 404 }
          )
        }

        if (
          suppliedSession.status !==
          'active'
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                'The table session is not active',
            },
            { status: 400 }
          )
        }

        if (
          suppliedSession.table_id !==
          table_id
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Table does not belong to this session',
            },
            { status: 400 }
          )
        }

        resolvedTableSessionId =
          suppliedSession.id
      } else {
        const {
          data: existingSession,
          error:
            sessionError,
        } = await supabase
          .from('table_sessions')
          .select(
            'id, table_id, status'
          )
          .eq(
            'table_id',
            table_id
          )
          .eq(
            'status',
            'active'
          )
          .order(
            'opened_at',
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle()

        if (sessionError) {
          return NextResponse.json(
            {
              success: false,
              error:
                sessionError.message,
            },
            { status: 500 }
          )
        }

        if (
          existingSession
        ) {
          resolvedTableSessionId =
            existingSession.id
        } else {
          const {
            data: newSession,
            error:
              createSessionError,
          } = await supabase
            .from('table_sessions')
            .insert({
              table_id,
              status: 'active',
            })
            .select()
            .single()

          if (
            createSessionError ||
            !newSession
          ) {
            return NextResponse.json(
              {
                success: false,
                error:
                  createSessionError?.message ||
                  'Failed to create table session',
              },
              { status: 500 }
            )
          }

          resolvedTableSessionId =
            newSession.id
        }
      }

      /* Mark table occupied */

      const {
        error:
          tableUpdateError,
      } = await supabase
        .from('tables')
        .update({
          status: 'occupied',
        })
        .eq(
          'id',
          table_id
        )

      if (tableUpdateError) {
        return NextResponse.json(
          {
            success: false,
            error:
              tableUpdateError.message,
          },
          { status: 500 }
        )
      }
    }

    /* =====================================================
       NORMALIZE ITEMS
    ===================================================== */

    const normalizedItems:
      OrderItemInput[] = []

    for (
      const item of items
    ) {
      if (
        !item ||
        !item.menu_item_id
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Every order item must have a menu_item_id',
          },
          { status: 400 }
        )
      }

      const quantity =
        Number(
          item.quantity
        )

      if (
        !Number.isInteger(
          quantity
        ) ||
        quantity < 1
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Item quantity must be a positive integer',
          },
          { status: 400 }
        )
      }

      normalizedItems.push({
        menu_item_id:
          item.menu_item_id,
        quantity,
        notes:
          item.notes || null,
      })
    }

    /* =====================================================
       GET MENU ITEMS
    ===================================================== */

    const menuItemIds =
      normalizedItems.map(
        (item) =>
          item.menu_item_id
      )

    const {
      data: menuItems,
      error: menuError,
    } = await supabase
      .from('menu_items')
      .select(
        'id, name, price, currency, available'
      )
      .in(
        'id',
        menuItemIds
      )

    if (menuError) {
      return NextResponse.json(
        {
          success: false,
          error:
            menuError.message,
        },
        { status: 500 }
      )
    }

    if (
      !menuItems ||
      menuItems.length !==
        menuItemIds.length
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'One or more menu items could not be found',
        },
        { status: 400 }
      )
    }

    /* =====================================================
       BUILD ORDER ITEMS
    ===================================================== */

    let subtotal = 0

    const orderItems =
      normalizedItems.map(
        (item) => {
          const menuItem =
            menuItems.find(
              (menu) =>
                menu.id ===
                item.menu_item_id
            )

          if (!menuItem) {
            throw new Error(
              `Menu item not found: ${item.menu_item_id}`
            )
          }

          if (
            !menuItem.available
          ) {
            throw new Error(
              `Menu item is currently unavailable: ${item.menu_item_id}`
            )
          }

          const unitPrice =
            Number(
              menuItem.price
            )

          const itemSubtotal =
            unitPrice *
            item.quantity

          subtotal +=
            itemSubtotal

          return {
            menu_item_id:
              menuItem.id,
            item_name:
              menuItem.name,
            unit_price:
              unitPrice,
            quantity:
              item.quantity,
            subtotal:
              itemSubtotal,
            notes:
              item.notes,
            status:
              initialStatus,
          }
        }
      )

    /* =====================================================
       CREATE ORDER
    ===================================================== */

    let order: any = null
    let orderError: any = null

    // Retry up to 3 times in case of concurrent order number insertion
    for (let attempt = 0; attempt < 3; attempt++) {
      const orderNumber = await getNextOrderNumber()

      const res = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          table_id: table_id || null,
          table_session_id: resolvedTableSessionId || null,
          status: initialStatus,
          order_type,
          waiter_id: waiter_id || null,
          customer_name: customer_name || null,
          customer_phone: customer_phone || null,
          notes: notes
            ? (waiter_name ? `${notes} · [Waiter: ${waiter_name}]` : notes)
            : (waiter_name ? `[Waiter: ${waiter_name}]` : null),
          subtotal,
          discount: 0,
          tax: 0,
          total: subtotal,
        })
        .select()
        .single()

      if (!res.error && res.data) {
        order = res.data
        orderError = null
        break
      }

      orderError = res.error
      if (
        res.error?.code === '23505' ||
        res.error?.message?.includes('orders_order_number_key')
      ) {
        console.warn(`Order number collision on ${orderNumber}, retrying... (attempt ${attempt + 1})`)
        continue
      } else {
        break
      }
    }

    if (orderError || !order) {
      return NextResponse.json(
        {
          success: false,
          error:
            orderError?.message ||
            'Failed to create order',
        },
        { status: 500 }
      )
    }

    /* =====================================================
       CREATE ORDER ITEMS
    ===================================================== */

    const itemsToInsert =
      orderItems.map(
        (item) => ({
          ...item,
          order_id:
            order.id,
        })
      )

    const {
      data: createdItems,
      error: itemsError,
    } = await supabase
      .from('order_items')
      .insert(
        itemsToInsert
      )
      .select()

    if (itemsError) {
      await supabase
        .from('orders')
        .delete()
        .eq(
          'id',
          order.id
        )

      return NextResponse.json(
        {
          success: false,
          error:
            itemsError.message,
        },
        { status: 500 }
      )
    }

    await logOrderHistory({
      orderId: order.id,
      previousStatus: null,
      newStatus: initialStatus,
      note: isDirectReady
        ? `Direct order created by cashier${waiter_name ? ` (${waiter_name})` : ''} - Marked Ready for Payment`
        : waiter_name
          ? `Order placed by ${waiter_name}${waiter_email ? ` (${waiter_email})` : ''}`
          : 'Order placed',
      changedBy: waiter_name || waiter_id || null,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          ...order,
          items:
            createdItems || [],
        },
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
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   PUT /api/orders
========================================================= */

export async function PUT(
  request: NextRequest
) {
  try {
    const body =
      await request.json()

    const {
      id,
      ids,
      item_id,
      status,
      action,
      new_table_id,
      payment_method,
      amount,
      tip_amount,
      receipt_image,
      is_waiter,
      user_role,
    } = body

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Order id is required',
        },
        { status: 400 }
      )
    }

    /* =====================================================
       MODIFY ORDER ITEMS (CASHIER / ADMIN EDIT ORDER)
    ===================================================== */

    if (action === 'modify_order') {
      const { items } = body
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { success: false, error: 'An order must contain at least one item' },
          { status: 400 }
        )
      }

      // Fetch current order
      const { data: existingOrder, error: fetchOrderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchOrderError || !existingOrder) {
        return NextResponse.json(
          { success: false, error: 'Order not found' },
          { status: 404 }
        )
      }

      // Fetch menu items to verify prices & names if needed
      const menuItemIds = [...new Set(items.map((i: any) => i.menu_item_id).filter(Boolean))]
      const { data: menuItemsData } = await supabase
        .from('menu_items')
        .select('id, name, price')
        .in('id', menuItemIds)

      const menuMap = new Map((menuItemsData || []).map((m: any) => [m.id, m]))

      let newSubtotal = 0
      const itemsToInsert = items.map((i: any) => {
        const menuItem = menuMap.get(i.menu_item_id)
        const unitPrice = Number(i.unit_price !== undefined ? i.unit_price : menuItem?.price || 0)
        const qty = Math.max(1, Number(i.quantity) || 1)
        const lineSubtotal = unitPrice * qty
        newSubtotal += lineSubtotal

        return {
          order_id: id,
          menu_item_id: i.menu_item_id,
          item_name: i.item_name || menuItem?.name || 'Item',
          unit_price: unitPrice,
          quantity: qty,
          subtotal: lineSubtotal,
          notes: i.notes || null,
          status: i.status || 'pending',
          created_at: new Date().toISOString(),
        }
      })

      // Delete existing order_items and insert updated items list
      await supabase.from('order_items').delete().eq('order_id', id)

      const { data: insertedItems, error: insertError } = await supabase
        .from('order_items')
        .insert(itemsToInsert)
        .select()

      if (insertError) {
        return NextResponse.json(
          { success: false, error: insertError.message || 'Failed to update order items' },
          { status: 500 }
        )
      }

      // Recalculate order subtotal and total
      const discount = Number(existingOrder.discount || 0)
      const tax = Number(existingOrder.tax || 0)
      const newTotal = Math.max(0, newSubtotal - discount + tax)

      const { data: updatedOrder, error: updateOrderErr } = await supabase
        .from('orders')
        .update({
          subtotal: newSubtotal,
          total: newTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (updateOrderErr || !updatedOrder) {
        return NextResponse.json(
          { success: false, error: updateOrderErr?.message || 'Failed to update order record' },
          { status: 500 }
        )
      }

      await logOrderHistory({
        orderId: id,
        previousStatus: existingOrder.status,
        newStatus: existingOrder.status,
        note: `Order modified by ${user_role || 'cashier'}. New total: ${newTotal.toFixed(2)} ETB (${itemsToInsert.length} items)`,
      })

      await logAction({
        action_type: 'ORDER_UPDATED',
        description: `Modified items for order #${existingOrder.order_number}. New total: ${newTotal.toFixed(2)} ETB`,
        role: user_role || 'cashier',
        metadata: { order_id: id, total: newTotal, item_count: itemsToInsert.length },
      })

      return NextResponse.json({
        success: true,
        message: 'Order modified successfully',
        data: {
          ...updatedOrder,
          items: insertedItems || [],
        },
      })
    }

    /* =====================================================
       APPROVE WAITER PAYMENT
    ===================================================== */

    if (action === 'approve_payment') {
      const { data: existingPmt } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', id)
        .maybeSingle()

      if (existingPmt) {
        await supabase
          .from('payments')
          .update({
            payment_status: 'CONFIRMED',
            confirmed_at: new Date().toISOString(),
          })
          .eq('id', existingPmt.id)
      }

      let { data: completedOrder, error: completeError } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (completeError) {
        // Fallback to 'completed' status if 'paid' status is restricted by DB constraint
        const fallbackRes = await supabase
          .from('orders')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single()
        completedOrder = fallbackRes.data
        completeError = fallbackRes.error
      }

      if (completeError || !completedOrder) {
        return NextResponse.json(
          { success: false, error: completeError?.message || 'Failed to approve payment' },
          { status: 500 }
        )
      }

      if (completedOrder.table_id) {
        const { data: activeOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('table_id', completedOrder.table_id)
          .not('status', 'in', '(completed,cancelled,paid)')

        if (!activeOrders || activeOrders.length === 0) {
          await supabase
            .from('tables')
            .update({ status: 'available' })
            .eq('id', completedOrder.table_id)
        }
      }

      await logOrderHistory({
        orderId: id,
        previousStatus: 'payment_pending',
        newStatus: completedOrder.status,
        note: 'Cashier/Manager approved waiter payment submission',
      })

      return NextResponse.json({
        success: true,
        message: 'Payment approved & order closed successfully.',
        data: completedOrder,
      })
    }

    /* =====================================================
       REJECT WAITER PAYMENT
    ===================================================== */

    if (action === 'reject_payment') {
      await supabase.from('payments').delete().eq('order_id', id)

      const { data: updatedOrder } = await supabase
        .from('orders')
        .update({
          status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      await logOrderHistory({
        orderId: id,
        previousStatus: 'payment_pending',
        newStatus: 'ready',
        note: 'Cashier/Manager rejected waiter payment submission',
      })

      return NextResponse.json({
        success: true,
        message: 'Payment rejected. Order returned to ready status.',
        data: updatedOrder,
      })
    }

    /* =====================================================
       RECORD PAYMENT
    ===================================================== */

    if (
      action ===
      'record_payment'
    ) {
      if (
        !PAYMENT_METHODS.includes(
          payment_method
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Invalid payment method. Use CASH, CBE, or TELEBIRR.',
          },
          { status: 400 }
        )
      }

      const isWaiterSubmission = Boolean(is_waiter || user_role === 'waiter')
      const paymentAmount =
        Number(amount)
      const tipAmount =
        Number(tip_amount) || 0

      if (
        !Number.isFinite(
          paymentAmount
        ) ||
        paymentAmount <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Payment amount must be greater than zero.',
          },
          { status: 400 }
        )
      }

      /* -----------------------------------------------
         GET TARGET ORDERS (SINGLE OR COMBINED TABLE ORDERS)
      ------------------------------------------------ */

      const rawIds = body.ids || ids
      const targetOrderIds: string[] = Array.isArray(rawIds) && rawIds.length > 0 ? rawIds : [id]

      const {
        data: targetOrders,
        error:
          orderLookupError,
      } = await supabase
        .from('orders')
        .select(
          'id, order_number, table_id, status, total'
        )
        .in(
          'id',
          targetOrderIds
        )

      if (
        orderLookupError ||
        !targetOrders ||
        targetOrders.length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Order(s) not found',
          },
          { status: 404 }
        )
      }

      const combinedOrdersTotal = targetOrders.reduce(
        (sum, o) => sum + Number(o.total || 0),
        0
      )

      if (
        paymentAmount < combinedOrdersTotal - 0.01
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Payment amount cannot be less than order total (${combinedOrdersTotal.toFixed(
                2
              )} ETB).`,
          },
          { status: 400 }
        )
      }

      /* -----------------------------------------------
         CHECK FOR EXISTING CONFIRMED PAYMENT
      ------------------------------------------------ */

      const {
        data:
          existingPayments,
      } = await supabase
        .from('payments')
        .select(
          'id, order_id, payment_status'
        )
        .in(
          'order_id',
          targetOrderIds
        )
        .eq(
          'payment_status',
          'CONFIRMED'
        )

      if (
        existingPayments &&
        existingPayments.length > 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'One or more selected orders already have a confirmed payment.',
          },
          { status: 400 }
        )
      }

      const initialStatus = isWaiterSubmission ? 'PENDING' : 'CONFIRMED'
      const primaryTargetStatus = isWaiterSubmission ? 'payment_pending' : 'paid'
      const secondaryTargetStatus = isWaiterSubmission ? 'ready' : 'completed'

      /* -----------------------------------------------
         PROCESS PAYMENT FOR ALL TARGET ORDERS
      ------------------------------------------------ */

      for (let i = 0; i < targetOrders.length; i++) {
        const ord = targetOrders[i]
        const currentOrdTotal = Number(ord.total || 0)
        // Attach tip to the primary order
        const currentTip = i === 0 ? tipAmount : 0

        // Clear any previous pending payment from waiter
        await supabase.from('payments').delete().eq('order_id', ord.id).eq('payment_status', 'PENDING')

        const { error: paymentInsertError } = await supabase
          .from('payments')
          .insert({
            order_id: ord.id,
            payment_method,
            amount: currentOrdTotal,
            tip_amount: currentTip,
            payment_status: initialStatus,
            receipt_image: receipt_image || null,
            uploaded_at: new Date().toISOString(),
            confirmed_at: isWaiterSubmission ? null : new Date().toISOString(),
          })

        if (paymentInsertError) {
          console.warn('Full payment insert warning, attempting fallback insert:', paymentInsertError.message)
          await supabase.from('payments').insert({
            order_id: ord.id,
            payment_method,
            amount: currentOrdTotal,
          })
        }

        let finalAppliedStatus = primaryTargetStatus

        const { error: primaryStatusErr } = await supabase
          .from('orders')
          .update({
            status: primaryTargetStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ord.id)

        if (primaryStatusErr) {
          console.warn('Primary status update failed, applying secondary fallback status:', primaryStatusErr.message)
          const { error: secErr } = await supabase
            .from('orders')
            .update({
              status: secondaryTargetStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', ord.id)

          if (!secErr) {
            finalAppliedStatus = secondaryTargetStatus
          }
        }

        await logOrderHistory({
          orderId: ord.id,
          previousStatus: ord.status,
          newStatus: finalAppliedStatus,
          note: isWaiterSubmission
            ? `Waiter submitted ${currentOrdTotal} ETB (${payment_method.toUpperCase()}) awaiting cashier approval`
            : `Payment of ${currentOrdTotal} ETB recorded via ${payment_method.toUpperCase()} and order closed`,
        })
      }

      /* -----------------------------------------------
         FREE TABLE (ONLY IF CONFIRMED CASHIER PAYMENT)
      ------------------------------------------------ */

      if (!isWaiterSubmission) {
        const uniqueTableIds = [
          ...new Set(
            targetOrders
              .map((o) => o.table_id)
              .filter((tid): tid is string => Boolean(tid))
          ),
        ]

        for (const tid of uniqueTableIds) {
          const { data: activeOrders } = await supabase
            .from('orders')
            .select('id')
            .eq('table_id', tid)
            .not('status', 'in', '(completed,cancelled,paid)')

          if (!activeOrders || activeOrders.length === 0) {
            await supabase
              .from('tables')
              .update({ status: 'available' })
              .eq('id', tid)
          }
        }
      }

      const orderNumbersStr = targetOrders
        .map((o) => (o.order_number.startsWith('order-') ? o.order_number : `#${o.order_number}`))
        .join(', ')

      await logAction({
        action_type: 'ORDER_PAID',
        description: `Recorded payment of ${paymentAmount} ETB (${payment_method.toUpperCase()}) for order(s): ${orderNumbersStr}`,
        role: user_role || 'cashier',
        metadata: {
          order_ids: targetOrderIds,
          payment_method,
          amount: paymentAmount,
          tip_amount: tipAmount,
        },
      })

      return NextResponse.json({
        success: true,
        pendingApproval: isWaiterSubmission,
        message: isWaiterSubmission
          ? 'Payment submitted for Cashier approval!'
          : 'Payment recorded and order(s) closed successfully.',
        data: {
          orders: targetOrders,
        },
      })
    }

    /* =====================================================
       SWITCH TABLE
    ===================================================== */

    if (
      action ===
      'switch_table'
    ) {
      if (!new_table_id) {
        return NextResponse.json(
          {
            success: false,
            error:
              'new_table_id is required',
          },
          { status: 400 }
        )
      }

      const {
        data: order,
        error:
          orderError,
      } = await supabase
        .from('orders')
        .select(
          'id, table_id, table_session_id, order_type, status'
        )
        .eq(
          'id',
          id
        )
        .single()

      if (
        orderError ||
        !order
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Order not found',
          },
          { status: 404 }
        )
      }

      if (
        order.order_type !==
        'dine_in'
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Only dine-in orders can be moved between tables',
          },
          { status: 400 }
        )
      }

      if (
        order.table_id ===
        new_table_id
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Order is already assigned to this table',
          },
          { status: 400 }
        )
      }

      const {
        data: targetTable,
        error:
          targetTableError,
      } = await supabase
        .from('tables')
        .select(
          'id, status'
        )
        .eq(
          'id',
          new_table_id
        )
        .single()

      if (
        targetTableError ||
        !targetTable
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Target table not found',
          },
          { status: 404 }
        )
      }

      if (
        targetTable.status ===
        'occupied'
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'The selected table is currently occupied',
          },
          { status: 400 }
        )
      }

      let newSessionId:
        | string
        | null = null

      const {
        data:
          existingSession,
      } = await supabase
        .from('table_sessions')
        .select(
          'id, status'
        )
        .eq(
          'table_id',
          new_table_id
        )
        .eq(
          'status',
          'active'
        )
        .order(
          'opened_at',
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle()

      if (
        existingSession
      ) {
        newSessionId =
          existingSession.id
      } else {
        const {
          data: newSession,
          error:
            newSessionError,
        } = await supabase
          .from('table_sessions')
          .insert({
            table_id:
              new_table_id,
            status:
              'active',
          })
          .select()
          .single()

        if (
          newSessionError ||
          !newSession
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                newSessionError?.message ||
                'Failed to create new table session',
            },
            { status: 500 }
          )
        }

        newSessionId =
          newSession.id
      }

      const oldTableId =
        order.table_id

      const {
        data:
          updatedOrder,
        error:
          updateError,
      } = await supabase
        .from('orders')
        .update({
          table_id:
            new_table_id,

          table_session_id:
            newSessionId,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          id
        )
        .select()
        .single()

      if (updateError) {
        return NextResponse.json(
          {
            success: false,
            error:
              updateError.message,
          },
          { status: 500 }
        )
      }

      await supabase
        .from('tables')
        .update({
          status:
            'occupied',
        })
        .eq(
          'id',
          new_table_id
        )

      if (oldTableId) {
        const {
          data:
            oldActiveOrders,
        } = await supabase
          .from('orders')
          .select('id')
          .eq(
            'table_id',
            oldTableId
          )
          .not(
            'status',
            'in',
            '(completed,cancelled)'
          )

        if (
          !oldActiveOrders ||
          oldActiveOrders.length ===
            0
        ) {
          await supabase
            .from('tables')
            .update({
              status:
                'available',
            })
            .eq(
              'id',
              oldTableId
            )
        }
      }

      return NextResponse.json({
        success: true,
        data:
          updatedOrder,
        message:
          'Table switched successfully',
      })
    }

    /* =====================================================
       KITCHEN ITEM STATUS

       A single order may contain food and drinks.
       Each kitchen updates ONLY its own items.

       kitchen_type = 'food'   -> every non-drink item
       kitchen_type = 'drinks' -> categories whose type is drinks

       The parent order becomes READY only when every item in
       the order is ready.
    ===================================================== */

    if (action === 'update_kitchen_items') {
      const kitchenType =
        body.kitchen_type === 'drinks'
          ? 'drinks'
          : body.kitchen_type === 'food'
            ? 'food'
            : null

      if (!kitchenType) {
        return NextResponse.json(
          {
            success: false,
            error: 'kitchen_type must be drinks or food',
          },
          { status: 400 }
        )
      }

      if (status !== 'preparing' && status !== 'ready') {
        return NextResponse.json(
          {
            success: false,
            error:
              'Kitchen item status must be preparing or ready',
          },
          { status: 400 }
        )
      }

      const {
        data: kitchenOrder,
        error: kitchenOrderError,
      } = await supabase
        .from('orders')
        .select('id, status')
        .eq('id', id)
        .single()

      if (kitchenOrderError || !kitchenOrder) {
        return NextResponse.json(
          {
            success: false,
            error: 'Order not found',
          },
          { status: 404 }
        )
      }

      if (!['confirmed', 'preparing'].includes(kitchenOrder.status)) {
        return NextResponse.json(
          {
            success: false,
            error:
              `This order is not active in the kitchen. Current status: ${kitchenOrder.status}`,
          },
          { status: 400 }
        )
      }

      const {
        data: orderItems,
        error: orderItemsError,
      } = await supabase
        .from('order_items')
        .select('id, menu_item_id, status')
        .eq('order_id', id)

      if (orderItemsError) {
        return NextResponse.json(
          {
            success: false,
            error: orderItemsError.message,
          },
          { status: 500 }
        )
      }

      const menuItemIdsForKitchen = [
        ...new Set(
          (orderItems || [])
            .map((item) => item.menu_item_id)
            .filter(Boolean)
        ),
      ]

      let menuItemsForKitchen: any[] = []

      if (menuItemIdsForKitchen.length > 0) {
        const { data, error } = await supabase
          .from('menu_items')
          .select('id, category_id')
          .in('id', menuItemIdsForKitchen)

        if (error) {
          return NextResponse.json(
            {
              success: false,
              error: error.message,
            },
            { status: 500 }
          )
        }

        menuItemsForKitchen = data || []
      }

      const categoryIdsForKitchen = [
        ...new Set(
          menuItemsForKitchen
            .map((item) => item.category_id)
            .filter(Boolean)
        ),
      ]

      let categoriesForKitchen: any[] = []

      if (categoryIdsForKitchen.length > 0) {
        const { data, error } = await supabase
          .from('categories')
          .select('id, type')
          .in('id', categoryIdsForKitchen)

        if (error) {
          return NextResponse.json(
            {
              success: false,
              error: error.message,
            },
            { status: 500 }
          )
        }

        categoriesForKitchen = data || []
      }

      const kitchenItemIds = (orderItems || [])
        .filter((item) => {
          const menuItem = menuItemsForKitchen.find(
            (menu) => menu.id === item.menu_item_id
          )

          const category = categoriesForKitchen.find(
            (cat) => cat.id === menuItem?.category_id
          )

          const isDrink = isDrinkCategory(category?.type)

          return kitchenType === 'drinks' ? isDrink : !isDrink
        })
        .map((item) => item.id)

      if (kitchenItemIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            order_id: id,
            updated_item_ids: [],
            order_status: kitchenOrder.status,
          },
          message:
            kitchenType === 'drinks'
              ? 'No drinks are attached to this order.'
              : 'No food items are attached to this order.',
        })
      }

      const {
        data: updatedItems,
        error: updateItemsError,
      } = await supabase
        .from('order_items')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .in('id', kitchenItemIds)
        .select()

      if (updateItemsError) {
        return NextResponse.json(
          {
            success: false,
            error: updateItemsError.message,
          },
          { status: 500 }
        )
      }

      const {
        data: allOrderItems,
        error: allItemsError,
      } = await supabase
        .from('order_items')
        .select('id, status')
        .eq('order_id', id)

      if (allItemsError) {
        return NextResponse.json(
          {
            success: false,
            error: allItemsError.message,
          },
          { status: 500 }
        )
      }

      const allReady =
        (allOrderItems || []).length > 0 &&
        (allOrderItems || []).every(
          (item) => item.status === 'ready'
        )

      const anyPreparing =
        (allOrderItems || []).some(
          (item) => item.status === 'preparing'
        )

      let finalOrderStatus = kitchenOrder.status

      if (allReady) {
        finalOrderStatus = 'ready'
      } else if (anyPreparing || status === 'preparing') {
        finalOrderStatus = 'preparing'
      } else if (kitchenOrder.status === 'ready') {
        finalOrderStatus = 'preparing'
      }

      const {
        data: updatedOrder,
        error: orderUpdateError,
      } = await supabase
        .from('orders')
        .update({
          status: finalOrderStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (orderUpdateError) {
        return NextResponse.json(
          {
            success: false,
            error: orderUpdateError.message,
          },
          { status: 500 }
        )
      }

      await logOrderHistory({
        orderId: id,
        previousStatus: kitchenOrder.status,
        newStatus: status,
        note: `${kitchenType === 'drinks' ? 'Drinks' : 'Food'} kitchen: ${status === 'preparing' ? 'Started preparing' : 'Marked ready / out of kitchen'}`,
      })

      if (finalOrderStatus !== kitchenOrder.status && finalOrderStatus !== status) {
        await logOrderHistory({
          orderId: id,
          previousStatus: kitchenOrder.status,
          newStatus: finalOrderStatus,
          note: `Order status moved to ${finalOrderStatus}`,
        })
      }

      return NextResponse.json({
        success: true,
        data: {
          order: updatedOrder,
          items: updatedItems || [],
          order_status: finalOrderStatus,
        },
        message:
          status === 'preparing'
            ? `${kitchenType === 'drinks' ? 'Drinks' : 'Food'} moved to Preparing.`
            : allReady
              ? 'All items are ready. Sent back to Order Manager.'
              : `${kitchenType === 'drinks' ? 'Drinks' : 'Food'} marked Ready. Waiting for the other kitchen if needed.`,
      })
    }

    /* =====================================================
       ITEM STATUS
    ===================================================== */

    if (item_id) {
      if (
        !status ||
        !ORDER_STATUSES.includes(
          status
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Invalid status',
          },
          { status: 400 }
        )
      }

      const {
        data:
          existingItem,
        error:
          itemLookupError,
      } = await supabase
        .from('order_items')
        .select(
          'id, order_id'
        )
        .eq(
          'id',
          item_id
        )
        .eq(
          'order_id',
          id
        )
        .single()

      if (
        itemLookupError ||
        !existingItem
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Order item not found',
          },
          { status: 404 }
        )
      }

      const {
        data:
          updatedItem,
        error:
          itemUpdateError,
      } = await supabase
        .from('order_items')
        .update({
          status,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          item_id
        )
        .eq(
          'order_id',
          id
        )
        .select()
        .single()

      if (itemUpdateError) {
        return NextResponse.json(
          {
            success: false,
            error:
              itemUpdateError.message,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data:
          updatedItem,
      })
    }

    /* =====================================================
       ORDER STATUS
    ===================================================== */

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Status is required',
        },
        { status: 400 }
      )
    }

    if (
      !ORDER_STATUSES.includes(
        status
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Invalid status. Allowed statuses: ${ORDER_STATUSES.join(
              ', '
            )}`,
        },
        { status: 400 }
      )
    }

    const {
      data: existingOrder,
      error:
        orderLookupError,
    } = await supabase
      .from('orders')
      .select(
        'id, table_id, status'
      )
      .eq(
        'id',
        id
      )
      .single()

    if (
      orderLookupError ||
      !existingOrder
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Order not found',
        },
        { status: 404 }
      )
    }

    let targetStatus = status

    if (status === 'confirmed' || status === 'ready') {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id, menu_item_id, status')
        .eq('order_id', id)

      if (orderItems && orderItems.length > 0) {
        const menuItemIds = [...new Set(orderItems.map((item) => item.menu_item_id).filter(Boolean))]
        let menuItemsData: any[] = []
        if (menuItemIds.length > 0) {
          const { data: mData } = await supabase.from('menu_items').select('id, category_id').in('id', menuItemIds)
          menuItemsData = mData || []
        }

        const categoryIds = [...new Set(menuItemsData.map((item) => item.category_id).filter(Boolean))]
        let categoriesData: any[] = []
        if (categoryIds.length > 0) {
          const { data: cData } = await supabase.from('categories').select('id, type').in('id', categoryIds)
          categoriesData = cData || []
        }

        const drinkItemIds: string[] = []
        const foodItemIds: string[] = []

        orderItems.forEach((item) => {
          const menuItem = menuItemsData.find((m) => m.id === item.menu_item_id)
          const category = categoriesData.find((c) => c.id === menuItem?.category_id)
          const isDrink = isDrinkCategory(category?.type)
          if (isDrink) {
            drinkItemIds.push(item.id)
          } else {
            foodItemIds.push(item.id)
          }
        })

        if (status === 'ready' || foodItemIds.length === 0) {
          targetStatus = 'ready'
          await supabase
            .from('order_items')
            .update({ status: 'ready', updated_at: new Date().toISOString() })
            .eq('order_id', id)
        } else {
          if (drinkItemIds.length > 0) {
            await supabase
              .from('order_items')
              .update({ status: 'ready', updated_at: new Date().toISOString() })
              .in('id', drinkItemIds)
          }
          if (foodItemIds.length > 0) {
            await supabase
              .from('order_items')
              .update({ status: 'confirmed', updated_at: new Date().toISOString() })
              .in('id', foodItemIds)
          }
        }
      }
    }

    const {
      data:
        updatedOrder,
      error:
        orderUpdateError,
    } = await supabase
      .from('orders')
      .update({
        status: targetStatus,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        'id',
        id
      )
      .select()
      .single()

    if (orderUpdateError) {
      return NextResponse.json(
        {
          success: false,
          error:
            orderUpdateError.message,
        },
        { status: 500 }
      )
    }

    /* =====================================================
       TABLE STATUS
    ===================================================== */

    if (
      (
        status ===
          'completed' ||
        status ===
          'cancelled'
      ) &&
      existingOrder.table_id
    ) {
      const {
        data:
          activeOrders,
      } = await supabase
        .from('orders')
        .select('id')
        .eq(
          'table_id',
          existingOrder.table_id
        )
        .not(
          'status',
          'in',
          '(completed,cancelled)'
        )

      if (
        !activeOrders ||
        activeOrders.length ===
          0
      ) {
        await supabase
          .from('tables')
          .update({
            status:
              'available',
          })
          .eq(
            'id',
            existingOrder.table_id
          )
      }
    }

    await logOrderHistory({
      orderId: id,
      previousStatus: existingOrder.status,
      newStatus: status,
      note:
        status === 'confirmed'
          ? 'Sent to kitchen'
          : status === 'preparing'
            ? 'Moved to preparing'
            : status === 'ready'
              ? 'Out of kitchen (ready)'
              : status === 'served'
                ? 'Served to table'
                : status === 'completed'
                  ? 'Order completed'
                  : status === 'cancelled'
                    ? 'Order cancelled / removed'
                    : `Order status updated to ${status}`,
    })

    if (status === 'cancelled') {
      await logAction({
        action_type: 'ORDER_CANCELLED',
        description: `Order #${updatedOrder?.order_number || id} was cancelled / removed`,
        target_id: id,
      })
    } else if (status === 'completed' || status === 'paid') {
      await logAction({
        action_type: 'ORDER_PAID',
        description: `Order #${updatedOrder?.order_number || id} was marked completed / paid`,
        target_id: id,
      })
    }

    return NextResponse.json({
      success: true,
      data:
        updatedOrder,
    })
  } catch (error) {
    console.error(
      'Unexpected error:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   DELETE /api/orders
   Removes / Cancels an order from any stage
========================================================= */

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let id = searchParams.get('id')
    let reason = searchParams.get('reason') || 'Removed by staff'
    let userName = searchParams.get('user_name') || searchParams.get('user') || 'Staff User'
    let userRole = searchParams.get('user_role') || searchParams.get('role') || 'admin'

    if (!id) {
      try {
        const body = await request.json()
        id = body?.id
        if (body?.reason) reason = body.reason
        if (body?.user_name) userName = body.user_name
        if (body?.user_role) userRole = body.user_role
      } catch (e) {
        // silent
      }
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Order id is required' }, { status: 400 })
    }

    // Lookup existing order
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, order_number, table_id, status')
      .eq('id', id)
      .maybeSingle()

    if (!existingOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    // Update order status to cancelled
    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Free table if associated
    if (existingOrder.table_id) {
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('table_id', existingOrder.table_id)
        .not('status', 'in', '(completed,cancelled,paid)')

      if (!activeOrders || activeOrders.length === 0) {
        await supabase.from('tables').update({ status: 'available' }).eq('id', existingOrder.table_id)
      }
    }

    const orderNumStr = existingOrder.order_number || id
    const logDesc = `Order #${orderNumStr} was removed / cancelled (${reason})`

    await logOrderHistory({
      orderId: id,
      previousStatus: existingOrder.status,
      newStatus: 'cancelled',
      note: logDesc,
      changedBy: userName,
    })

    await logAction({
      action_type: 'ORDER_CANCELLED',
      description: logDesc,
      performed_by: userName,
      role: userRole,
      target_id: id,
    })

    return NextResponse.json({
      success: true,
      message: `Order #${orderNumStr} removed successfully`,
      data: updatedOrder,
    })
  } catch (error) {
    console.error('Delete order error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete order' },
      { status: 500 }
    )
  }
}