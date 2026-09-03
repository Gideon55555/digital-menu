import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export type OrderTimeline = {
  ordered_at: string | null
  sent_to_kitchen_at: string | null
  preparing_at: string | null
  ready_at: string | null
  cooking_duration: string | null
  cooking_duration_seconds: number | null
  served_at: string | null
  paid_at: string | null
}

type ReportOrder = {
  id: string
  order_number: string
  table_id: string | null
  table_session_id: string | null
  status: string
  order_type: string
  customer_name: string | null
  customer_phone: string | null
  notes: string | null
  subtotal: number
  discount: number
  tax: number
  total: number
  created_at: string
  updated_at: string
  items: any[]
  payment: any | null
  table_name: string
  timeline: OrderTimeline
}

function getDateRange(period: string, from?: string, to?: string) {
  const now = new Date()

  let start: Date
  let end: Date

  if (period === 'custom' && from) {
    start = new Date(`${from}T00:00:00`)

    if (to) {
      end = new Date(`${to}T23:59:59.999`)
    } else {
      end = new Date(`${from}T23:59:59.999`)
    }

    return { start, end }
  }

  if (period === 'week') {
    start = new Date(now)
    start.setDate(now.getDate() - 6)
    start.setHours(0, 0, 0, 0)

    end = new Date(now)
    end.setHours(23, 59, 59, 999)

    return { start, end }
  }

  if (period === 'month') {
    start = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    )

    end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    )

    return { start, end }
  }

  if (period === 'year') {
    start = new Date(
      now.getFullYear(),
      0,
      1
    )

    end = new Date(
      now.getFullYear(),
      11,
      31,
      23,
      59,
      59,
      999
    )

    return { start, end }
  }

  // TODAY
  start = new Date(now)
  start.setHours(0, 0, 0, 0)

  end = new Date(now)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

function formatPaymentMethod(method: string | null) {
  if (!method) return 'Unknown'

  switch (method.toLowerCase()) {
    case 'cash':
      return 'Cash'

    case 'cbe':
      return 'CBE'

    case 'telebirr':
      return 'Telebirr'

    default:
      return method
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const period =
      searchParams.get('period') || 'today'

    const from =
      searchParams.get('from') || undefined

    const to =
      searchParams.get('to') || undefined

    const { start, end } =
      getDateRange(period, from, to)

    /*
     * =========================================================
     * GET PAID ORDERS
     * =========================================================
     */

    const {
      data: orders,
      error: ordersError,
    } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'paid')
      .gte(
        'updated_at',
        start.toISOString()
      )
      .lte(
        'updated_at',
        end.toISOString()
      )
      .order('updated_at', {
        ascending: false,
      })

    if (ordersError) {
      console.error(
        'Report orders error:',
        ordersError
      )

      return NextResponse.json(
        {
          success: false,
          error: ordersError.message,
        },
        { status: 500 }
      )
    }

    const paidOrders = orders || []

    /*
     * =========================================================
     * GET ORDER ITEMS
     * =========================================================
     */

    const orderIds = paidOrders.map(
      (order) => order.id
    )

    let items: any[] = []

    if (orderIds.length > 0) {
      const {
        data: itemData,
        error: itemsError,
      } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', {
          ascending: true,
        })

      if (itemsError) {
        console.error(
          'Report items error:',
          itemsError
        )
      }

      items = itemData || []
    }

    /*
     * =========================================================
     * GET PAYMENTS
     * =========================================================
     */

    let payments: any[] = []

    if (orderIds.length > 0) {
      const {
        data: paymentData,
        error: paymentsError,
      } = await supabase
        .from('payments')
        .select('*')
        .in('order_id', orderIds)

      if (paymentsError) {
        console.error(
          'Report payments error:',
          paymentsError
        )

        return NextResponse.json(
          {
            success: false,
            error: paymentsError.message,
          },
          { status: 500 }
        )
      }

      payments = paymentData || []
    }

    /*
     * =========================================================
     * GET TABLES
     * =========================================================
     */

    const tableIds = [
      ...new Set(
        paidOrders
          .map(
            (order) => order.table_id
          )
          .filter(Boolean)
      ),
    ]

    let tables: any[] = []

    if (tableIds.length > 0) {
      const {
        data: tableData,
        error: tablesError,
      } = await supabase
        .from('tables')
        .select('*')
        .in('id', tableIds)

      if (tablesError) {
        console.error(
          'Report tables error:',
          tablesError
        )
      }

      tables = tableData || []
    }

    /*
     * =========================================================
     * GET WAITERS / SERVERS
     * =========================================================
     */

    const waiterIds = [
      ...new Set(
        paidOrders
          .map((order) => order.waiter_id)
          .filter(Boolean)
      ),
    ]

    let waiters: any[] = []

    if (waiterIds.length > 0) {
      const { data: waiterData, error: waitersError } = await supabase
        .from('admin_users')
        .select('id, name, email')
        .in('id', waiterIds)

      if (waitersError) {
        console.error('Report waiters error:', waitersError)
      }

      waiters = waiterData || []
    }

    /*
     * =========================================================
     * GET ORDER HISTORY FOR LIFECYCLE TIMELINES
     * =========================================================
     */

    let orderHistories: any[] = []

    if (orderIds.length > 0) {
      const { data: historyData, error: historyError } = await supabase
        .from('order_history')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: true })

      if (historyError) {
        console.error('Report history error:', historyError)
      }

      orderHistories = historyData || []
    }

    /*
     * =========================================================
     * BUILD ORDERS
     * =========================================================
     */

    const reportOrders: ReportOrder[] =
      paidOrders.map((order) => {
        const orderItems =
          items.filter(
            (item) =>
              item.order_id === order.id
          )

        const orderPayment =
          payments.find(
            (payment) =>
              payment.order_id === order.id
          ) || null

        const table =
          tables.find(
            (item) =>
              item.id === order.table_id
          ) || null

        let tableName = 'Takeaway'

        if (table) {
          tableName =
            table.name ||
            table.table_name ||
            (
              table.table_number !==
              undefined
                ? `Table ${table.table_number}`
                : table.number !==
                  undefined
                ? `Table ${table.number}`
                : 'Table'
            )
        }

        const histories = orderHistories.filter(
          (h) => h.order_id === order.id
        )

        // Ordered at
        const orderedAt =
          histories.find(
            (h) => h.new_status === 'pending' || !h.previous_status
          )?.created_at || order.created_at

        // Sent to kitchen at
        const sentToKitchenAt =
          histories.find((h) => h.new_status === 'confirmed')?.created_at ||
          null

        // Preparing at
        const preparingAt =
          histories.find((h) => h.new_status === 'preparing')?.created_at ||
          null

        // Ready at (out of kitchen)
        const readyAt =
          histories.find((h) => h.new_status === 'ready')?.created_at ||
          null

        // Served at
        const servedAt =
          histories.find((h) => h.new_status === 'served')?.created_at ||
          null

        // Paid at
        const paidAt =
          orderPayment?.confirmed_at ||
          histories.find((h) => h.new_status === 'paid')?.created_at ||
          order.updated_at

        // Calculate cooking duration: time from preparing (or sent to kitchen) until ready
        let cookingDurationSeconds: number | null = null
        let cookingDuration: string | null = null

        if (readyAt) {
          const readyTime = new Date(readyAt).getTime()
          const startTime = preparingAt
            ? new Date(preparingAt).getTime()
            : sentToKitchenAt
              ? new Date(sentToKitchenAt).getTime()
              : orderedAt
                ? new Date(orderedAt).getTime()
                : null

          if (startTime && readyTime >= startTime) {
            cookingDurationSeconds = Math.round((readyTime - startTime) / 1000)
            const mins = Math.floor(cookingDurationSeconds / 60)
            const secs = cookingDurationSeconds % 60
            cookingDuration =
              mins === 0
                ? `${secs}s`
                : secs === 0
                  ? `${mins}m`
                  : `${mins}m ${secs}s`
          }
        }

        const assignedWaiter = waiters.find((w) => w.id === order.waiter_id)
        let waiterName = assignedWaiter?.name || assignedWaiter?.email || null

        if (!waiterName && order.notes) {
          const match = order.notes.match(/\[Waiter:\s*([^\]]+)\]/)
          if (match) {
            waiterName = match[1].trim()
          }
        }

        return {
          ...order,

          waiter_name: waiterName,

          items: orderItems,

          payment: orderPayment
            ? {
                ...orderPayment,
                payment_method:
                  formatPaymentMethod(
                    orderPayment.payment_method
                  ),
              }
            : null,

          table_name: tableName,

          timeline: {
            ordered_at: orderedAt,
            sent_to_kitchen_at: sentToKitchenAt,
            preparing_at: preparingAt,
            ready_at: readyAt,
            cooking_duration: cookingDuration,
            cooking_duration_seconds: cookingDurationSeconds,
            served_at: servedAt,
            paid_at: paidAt,
          },
        }
      })

    /*
     * =========================================================
     * SUMMARY
     * =========================================================
     */

    const totalOrders =
      reportOrders.length

    const totalCollected =
      reportOrders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.payment?.amount ||
              order.total ||
              0
          ),
        0
      )

    let cash = 0
    let cbe = 0
    let telebirr = 0

    reportOrders.forEach((order) => {
      const amount = Number(
        order.payment?.amount || 0
      )

      const method =
        String(
          order.payment?.payment_method ||
            ''
        ).toLowerCase()

      if (method === 'cash') {
        cash += amount
      }

      if (method === 'cbe') {
        cbe += amount
      }

      if (method === 'telebirr') {
        telebirr += amount
      }
    })

    // Average cooking duration
    const validCookingDurations = reportOrders
      .map((o) => o.timeline.cooking_duration_seconds)
      .filter((d): d is number => typeof d === 'number' && d > 0)

    let averageCookingDuration = 'N/A'
    let averageCookingSeconds = 0

    if (validCookingDurations.length > 0) {
      const sumDurations = validCookingDurations.reduce((a, b) => a + b, 0)
      averageCookingSeconds = Math.round(sumDurations / validCookingDurations.length)
      const avgMins = Math.floor(averageCookingSeconds / 60)
      const avgSecs = averageCookingSeconds % 60
      averageCookingDuration =
        avgMins === 0
          ? `${avgSecs}s`
          : avgSecs === 0
            ? `${avgMins}m`
            : `${avgMins}m ${avgSecs}s`
    }

    /*
     * =========================================================
     * GRAPH DATA
     * =========================================================
     */

    const graphMap =
      new Map<string, number>()

    reportOrders.forEach((order) => {
      const date =
        new Date(order.updated_at)

      let key = ''

      if (period === 'today') {
        key =
          date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
      } else if (period === 'year') {
        key =
          date.toLocaleDateString([], {
            month: 'short',
          })
      } else {
        key =
          date.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          })
      }

      const amount = Number(
        order.payment?.amount ||
          order.total ||
          0
      )

      graphMap.set(
        key,
        (graphMap.get(key) || 0) +
          amount
      )
    })

    const graph = Array.from(
      graphMap.entries()
    ).map(
      ([label, amount]) => ({
        label,
        amount,
      })
    )

    return NextResponse.json({
      success: true,

      data: {
        orders: reportOrders,

        summary: {
          totalOrders,
          totalCollected,
          cash,
          cbe,
          telebirr,
          averageCookingDuration,
          averageCookingSeconds,
        },

        graph,
      },
    })
  } catch (error) {
    console.error(
      'Orders report error:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load orders report',
      },
      { status: 500 }
    )
  }
}