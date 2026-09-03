import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
   GET NEXT ORDER NUMBER (Resets to order-1 every day)
========================================================= */

async function getNextOrderNumber() {
  const now = new Date()
  // Start of today: 00:00:00.000 in UTC
  const startOfDay = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
  ).toISOString()

  const { data, error } = await supabase
    .from('orders')
    .select('order_number, created_at')
    .gte('created_at', startOfDay)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to query orders for today:', error)
  }

  let maxSequence = 0

  if (data && data.length > 0) {
    for (const ord of data) {
      if (ord.order_number) {
        // Matches "order-1", "order-2", "Order-5", or simple numbers "1", "2"
        const match = String(ord.order_number).match(/(?:order-)?(\d+)$/i)
        if (match) {
          const num = parseInt(match[1], 10)
          // Filter out legacy epoch timestamps (>100000)
          if (!isNaN(num) && num > maxSequence && num < 100000) {
            maxSequence = num
          }
        }
      }
    }
  }

  const nextNumber = maxSequence + 1
  return `order-${nextNumber}`
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
      items,
    } = body

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
              'pending',
          }
        }
      )

    /* =====================================================
       CREATE ORDER
    ===================================================== */

    const orderNumber =
      await getNextOrderNumber()

    const {
      data: order,
      error: orderError,
    } = await supabase
      .from('orders')
      .insert({
        order_number:
          orderNumber,

        table_id:
          table_id || null,

        table_session_id:
          resolvedTableSessionId ||
          null,

        status:
          'pending',

        order_type,

        waiter_id:
          waiter_id || null,

        customer_name:
          customer_name || null,

        customer_phone:
          customer_phone || null,

        notes: notes
          ? (waiter_name ? `${notes} · [Waiter: ${waiter_name}]` : notes)
          : (waiter_name ? `[Waiter: ${waiter_name}]` : null),

        subtotal,

        discount: 0,

        tax: 0,

        total:
          subtotal,
      })
      .select()
      .single()

    if (
      orderError ||
      !order
    ) {
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
      newStatus: order.status || 'pending',
      note: waiter_name
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
      item_id,
      status,
      action,
      new_table_id,
      payment_method,
      amount,
      receipt_image,
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

      const paymentAmount =
        Number(amount)

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
         GET ORDER
      ------------------------------------------------ */

      const {
        data: order,
        error:
          orderLookupError,
      } = await supabase
        .from('orders')
        .select(
          'id, order_number, table_id, status, total'
        )
        .eq(
          'id',
          id
        )
        .single()

      if (
        orderLookupError ||
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

      /* -----------------------------------------------
         PAYMENT ONLY FOR READY ORDERS
      ------------------------------------------------ */

      if (
        order.status !== 'ready' &&
        order.status !== 'served'
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Payment can only be recorded for a ready or served order. Current status: ${order.status}`,
          },
          { status: 400 }
        )
      }

      const orderTotal =
        Number(
          order.total
        )

      /*
       * Require the payment to match
       * the order total.
       */

      if (
        Math.abs(
          paymentAmount -
            orderTotal
        ) > 0.01
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Payment amount must be ${orderTotal.toFixed(
                2
              )} ETB.`,
          },
          { status: 400 }
        )
      }

      /* -----------------------------------------------
         CHECK FOR EXISTING CONFIRMED PAYMENT
      ------------------------------------------------ */

      const {
        data:
          existingPayment,
      } = await supabase
        .from('payments')
        .select(
          'id, payment_status'
        )
        .eq(
          'order_id',
          id
        )
        .eq(
          'payment_status',
          'CONFIRMED'
        )
        .limit(1)
        .maybeSingle()

      if (
        existingPayment
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              'This order already has a confirmed payment.',
          },
          { status: 400 }
        )
      }

      /* -----------------------------------------------
         CREATE PAYMENT RECORD
      ------------------------------------------------ */

      const {
        data: payment,
        error:
          paymentError,
      } = await supabase
        .from('payments')
        .insert({
          order_id:
            id,

          payment_method:
            payment_method,

          amount:
            paymentAmount,

          payment_status:
            'CONFIRMED',

          receipt_image:
            receipt_image || null,

          uploaded_at:
            new Date().toISOString(),

          confirmed_at:
            new Date().toISOString(),
        })
        .select()
        .single()

      if (
        paymentError ||
        !payment
      ) {
        console.error(
          'Payment insert error:',
          paymentError
        )

        return NextResponse.json(
          {
            success: false,
            error:
              paymentError?.message ||
              'Failed to record payment',
          },
          { status: 500 }
        )
      }

      /* -----------------------------------------------
         CLOSE ORDER
      ------------------------------------------------ */

      const {
        data:
          completedOrder,
        error:
          completeError,
      } = await supabase
        .from('orders')
        .update({
          status:
            'paid',

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          id
        )
        .in(
          'status',
          ['ready', 'served']
        )
        .select()
        .single()

      if (
        completeError ||
        !completedOrder
      ) {
        /*
         * Roll back the payment if
         * the order could not be closed.
         */

        await supabase
          .from('payments')
          .delete()
          .eq(
            'id',
            payment.id
          )

        return NextResponse.json(
          {
            success: false,
            error:
              completeError?.message ||
              'Failed to close order after payment',
          },
          { status: 500 }
        )
      }

      /* -----------------------------------------------
         FREE TABLE
      ------------------------------------------------ */

      if (
        order.table_id
      ) {
        const {
          data:
            activeOrders,
        } = await supabase
          .from('orders')
          .select('id')
          .eq(
            'table_id',
            order.table_id
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
              order.table_id
            )
        }
      }

      await logOrderHistory({
        orderId: id,
        previousStatus: order.status,
        newStatus: 'paid',
        note: `Payment of ${paymentAmount} ETB recorded via ${payment_method.toUpperCase()} and order closed`,
      })

      return NextResponse.json({
        success: true,
        message:
          'Payment recorded and order closed successfully.',
        data: {
          order:
            completedOrder,
          payment,
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

    const {
      data:
        updatedOrder,
      error:
        orderUpdateError,
    } = await supabase
      .from('orders')
      .update({
        status,

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
                    ? 'Order cancelled'
                    : `Order status updated to ${status}`,
    })

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