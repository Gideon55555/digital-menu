'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  AdminLayout,
} from '@/components/admin/AdminLayout'

import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  CreditCard,
  RefreshCw,
  ShoppingBag,
  Wallet,
  Smartphone,
  Timer,
  Clock,
  Send,
  ChefHat,
  Bell,
  UtensilsCrossed,
  CheckCircle2,
  User,
} from 'lucide-react'

type Period =
  | 'today'
  | 'week'
  | 'month'
  | 'year'
  | 'custom'

type OrderItem = {
  id: string
  order_id: string
  menu_item_id: string

  name?: any
  item_name?: any

  price?: number
  unit_price?: number

  quantity: number
  subtotal?: number

  notes?: string | null
}

type Payment = {
  id: string
  order_id: string
  payment_method: string
  amount: number
  payment_status?: string
  uploaded_at?: string
  confirmed_at?: string
}

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

type Order = {
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

  table_name: string

  waiter_name?: string | null

  items: OrderItem[]

  payment: Payment | null

  timeline?: OrderTimeline
}

type Summary = {
  totalOrders: number
  totalCollected: number
  cash: number
  cbe: number
  telebirr: number
  averageCookingDuration?: string
  averageCookingSeconds?: number
}

type GraphPoint = {
  label: string
  amount: number
}

export default function OrdersReportPage() {
  const [period, setPeriod] =
    useState<Period>('today')

  const [customFrom, setCustomFrom] =
    useState('')

  const [customTo, setCustomTo] =
    useState('')

  const [orders, setOrders] =
    useState<Order[]>([])

  const [summary, setSummary] =
    useState<Summary>({
      totalOrders: 0,
      totalCollected: 0,
      cash: 0,
      cbe: 0,
      telebirr: 0,
    })

  const [graph, setGraph] =
    useState<GraphPoint[]>([])

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState('')

  const [expandedOrderId, setExpandedOrderId] =
    useState<string | null>(null)

  /*
   * =========================================================
   * LOAD REPORT
   * =========================================================
   */

  const loadReport = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        setError('')

        const params =
          new URLSearchParams()

        params.set(
          'period',
          period
        )

        if (
          period === 'custom'
        ) {
          if (customFrom) {
            params.set(
              'from',
              customFrom
            )
          }

          if (customTo) {
            params.set(
              'to',
              customTo
            )
          }
        }

        const response =
          await fetch(
            `/api/reports/orders?${params.toString()}`,
            {
              cache: 'no-store',
            }
          )

        const result =
          await response.json()

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ||
              'Failed to load report'
          )
        }

        setOrders(
          result.data?.orders || []
        )

        setSummary(
          result.data?.summary || {
            totalOrders: 0,
            totalCollected: 0,
            cash: 0,
            cbe: 0,
            telebirr: 0,
          }
        )

        setGraph(
          result.data?.graph || []
        )
      } catch (error) {
        console.error(
          'Report error:',
          error
        )

        setError(
          error instanceof Error
            ? error.message
            : 'Failed to load report'
        )
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [
      period,
      customFrom,
      customTo,
    ]
  )

  useEffect(() => {
    loadReport()
  }, [loadReport])

  /*
   * =========================================================
   * FORMAT MONEY
   * =========================================================
   */

  function money(
    amount: number
  ) {
    return `${Number(
      amount || 0
    ).toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )} ETB`
  }

  /*
   * =========================================================
   * FORMAT ITEM NAME
   * =========================================================
   */

  function itemName(
    item: OrderItem
  ) {
    const value =
      item.item_name ??
      item.name

    if (
      typeof value === 'string'
    ) {
      return value
    }

    if (
      value &&
      typeof value.en ===
        'string' &&
      value.en.trim()
    ) {
      return value.en
    }

    if (
      value &&
      typeof value.am ===
        'string' &&
      value.am.trim()
    ) {
      return value.am
    }

    return 'Unnamed item'
  }

  /*
   * =========================================================
   * DATE/TIME
   * =========================================================
   */

  function formatDate(
    date?: string | null
  ) {
    if (!date) return 'N/A'
    return new Date(
      date
    ).toLocaleDateString(
      undefined,
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }
    )
  }

  function formatTime(
    date?: string | null
  ) {
    if (!date) return 'N/A'
    return new Date(
      date
    ).toLocaleTimeString(
      [],
      {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }
    )
  }

  /*
   * =========================================================
   * GRAPH
   * =========================================================
   */

  const maximumGraphValue =
    useMemo(() => {
      if (
        graph.length === 0
      ) {
        return 1
      }

      return Math.max(
        ...graph.map(
          (item) =>
            Number(
              item.amount
            )
        ),
        1
      )
    }, [graph])

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <BarChart3
              size={40}
              className="mx-auto mb-3 text-restaurant-accent"
            />

            <p className="text-gray-500">
              Loading sales report...
            </p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  /*
   * =========================================================
   * PAGE
   * =========================================================
   */

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* HEADER */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h1 className="text-3xl font-serif font-bold text-restaurant-text dark:text-white">
              Closed Orders
            </h1>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Sales history and payment report
            </p>
          </div>

          <button
            onClick={() =>
              loadReport(true)
            }
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-restaurant-accent px-4 py-2.5 font-medium text-white hover:bg-restaurant-accent-dark disabled:opacity-50"
          >
            <RefreshCw
              size={18}
              className={
                refreshing
                  ? 'animate-spin'
                  : ''
              }
            />

            Refresh
          </button>

        </div>

        {/* ERROR */}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* PERIOD FILTER */}

        <div className="restaurant-card p-4">

          <div className="flex flex-wrap gap-2">

            {(
              [
                ['today', 'Today'],
                ['week', 'This Week'],
                ['month', 'This Month'],
                ['year', 'This Year'],
                ['custom', 'Custom'],
              ] as [
                Period,
                string
              ][]
            ).map(
              ([value, label]) => (
                <button
                  key={value}
                  onClick={() =>
                    setPeriod(value)
                  }
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    period === value
                      ? 'bg-restaurant-accent text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              )
            )}

          </div>

          {/* CUSTOM DATES */}

          {period ===
            'custom' && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">
                  From
                </label>

                <input
                  type="date"
                  value={
                    customFrom
                  }
                  onChange={(event) =>
                    setCustomFrom(
                      event.target
                        .value
                    )
                  }
                  className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-500">
                  To
                </label>

                <input
                  type="date"
                  value={
                    customTo
                  }
                  onChange={(event) =>
                    setCustomTo(
                      event.target
                        .value
                    )
                  }
                  className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

            </div>
          )}

        </div>

        {/* SUMMARY */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">

          <SummaryCard
            title="Orders Closed"
            value={String(
              summary.totalOrders
            )}
            icon={
              <ShoppingBag
                size={22}
              />
            }
          />

          <SummaryCard
            title="Total Collected"
            value={money(
              summary.totalCollected
            )}
            icon={
              <CircleDollarSign
                size={22}
              />
            }
          />

          <SummaryCard
            title="Avg Cook Time"
            value={summary.averageCookingDuration || 'N/A'}
            icon={
              <Timer
                size={22}
              />
            }
          />

          <SummaryCard
            title="Cash"
            value={money(
              summary.cash
            )}
            icon={
              <Wallet
                size={22}
              />
            }
          />

          <SummaryCard
            title="CBE"
            value={money(
              summary.cbe
            )}
            icon={
              <CreditCard
                size={22}
              />
            }
          />

          <SummaryCard
            title="Telebirr"
            value={money(
              summary.telebirr
            )}
            icon={
              <Smartphone
                size={22}
              />
            }
          />

        </div>

        {/* GRAPH */}

        <div className="restaurant-card p-5">

          <div className="mb-5">

            <h2 className="text-lg font-bold text-restaurant-text dark:text-white">
              Money Collected
            </h2>

            <p className="text-sm text-gray-500">
              Collection during the selected period
            </p>

          </div>

          {graph.length === 0 ? (

            <div className="flex h-56 items-center justify-center text-sm text-gray-400">
              No sales data for this period.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <div
                className="flex min-w-[500px] items-end gap-3"
                style={{
                  height: 260,
                }}
              >

                {graph.map(
                  (point, index) => {
                    const height =
                      Math.max(
                        8,
                        (Number(
                          point.amount
                        ) /
                          maximumGraphValue) *
                          200
                      )

                    return (
                      <div
                        key={`${point.label}-${index}`}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                      >

                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                          {Number(
                            point.amount
                          ).toLocaleString()}
                        </span>

                        <div
                          className="w-full max-w-[55px] rounded-t-lg bg-restaurant-accent/80 transition hover:bg-restaurant-accent"
                          style={{
                            height,
                          }}
                          title={`${point.label}: ${money(
                            point.amount
                          )}`}
                        />

                        <span className="whitespace-nowrap text-[11px] text-gray-500">
                          {point.label}
                        </span>

                      </div>
                    )
                  }
                )}

              </div>

            </div>

          )}

        </div>

        {/* ORDERS */}

        <div>

          <div className="mb-4 flex items-center justify-between">

            <div>
              <h2 className="text-xl font-bold text-restaurant-text dark:text-white">
                Closed Orders
              </h2>

              <p className="text-sm text-gray-500">
                Click an order to see its details
              </p>
            </div>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold dark:bg-slate-800">
              {orders.length}
            </span>

          </div>

          {orders.length === 0 ? (

            <div className="restaurant-card p-10 text-center">

              <ShoppingBag
                size={36}
                className="mx-auto mb-3 text-gray-400"
              />

              <h3 className="font-semibold">
                No closed orders
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                No paid orders were found for this period.
              </p>

            </div>

          ) : (

            <div className="space-y-3">

              {orders.map(
                (order) => {
                  const expanded =
                    expandedOrderId ===
                    order.id

                  const paymentMethod =
                    order.payment
                      ?.payment_method ||
                    'Unknown'

                  const paymentAmount =
                    Number(
                      order.payment
                        ?.amount ||
                        order.total ||
                        0
                    )

                  return (
                    <div
                      key={order.id}
                      className="restaurant-card overflow-hidden"
                    >

                      {/* ORDER ROW */}

                      <button
                        onClick={() =>
                          setExpandedOrderId(
                            expanded
                              ? null
                              : order.id
                          )
                        }
                        className="w-full p-4 text-left transition hover:bg-gray-50 dark:hover:bg-slate-800/50"
                      >

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                          <div className="flex items-center gap-4">

                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-restaurant-accent/10 text-restaurant-accent">
                              <ShoppingBag
                                size={20}
                              />
                            </div>

                            <div>

                              <div className="flex items-center gap-2">

                                <h3 className="font-bold text-restaurant-text dark:text-white">
                                  {order.order_number.startsWith('order-')
                                    ? order.order_number
                                    : `#${order.order_number}`}
                                </h3>

                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                  Paid
                                </span>

                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-gray-500">
                                <span>{order.table_name}</span>
                                <span>•</span>
                                <span>Ordered {formatTime(order.timeline?.ordered_at || order.created_at)}</span>
                                <span>•</span>
                                <span>Paid {formatTime(order.timeline?.paid_at || order.updated_at)}</span>
                                {order.waiter_name && (
                                  <>
                                    <span>•</span>
                                    <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-950/50 dark:text-purple-300">
                                      <User size={12} /> Waiter: {order.waiter_name}
                                    </span>
                                  </>
                                )}
                                {order.timeline?.cooking_duration && (
                                  <>
                                    <span>•</span>
                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                      <Timer size={12} /> Cooked in {order.timeline.cooking_duration}
                                    </span>
                                  </>
                                )}
                              </div>

                            </div>

                          </div>

                          <div className="flex items-center justify-between gap-5 md:justify-end">

                            <div className="text-left md:text-right">

                              <p className="text-xs text-gray-400">
                                {paymentMethod}
                              </p>

                              <p className="font-bold text-restaurant-text dark:text-white">
                                {money(
                                  paymentAmount
                                )}
                              </p>

                            </div>

                            {expanded ? (
                              <ChevronUp
                                size={20}
                                className="text-gray-400"
                              />
                            ) : (
                              <ChevronDown
                                size={20}
                                className="text-gray-400"
                              />
                            )}

                          </div>

                        </div>

                      </button>

                      {/* EXPANDED */}

                      {expanded && (
                        <div className="border-t border-gray-200 dark:border-slate-800">

                          {/* LIFECYCLE TIMELINE */}

                          <div className="p-5 space-y-3">

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                Order Lifecycle & Kitchen Timeline
                              </h4>

                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Table: <strong className="text-restaurant-text dark:text-white">{order.table_name}</strong></span>
                                {order.waiter_name && (
                                  <span>• Waiter: <strong className="text-purple-700 dark:text-purple-300">{order.waiter_name}</strong></span>
                                )}
                                {order.customer_name && (
                                  <span>• Customer: <strong className="text-restaurant-text dark:text-white">{order.customer_name}</strong></span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">

                              <TimelineItem
                                label="1. Ordered"
                                time={formatTime(order.timeline?.ordered_at || order.created_at)}
                                sub={formatDate(order.timeline?.ordered_at || order.created_at)}
                                icon={<Clock size={16} />}
                              />

                              <TimelineItem
                                label="2. To Kitchen"
                                time={order.timeline?.sent_to_kitchen_at ? formatTime(order.timeline.sent_to_kitchen_at) : 'Sent on create'}
                                icon={<Send size={16} />}
                              />

                              <TimelineItem
                                label="3. Preparing"
                                time={order.timeline?.preparing_at ? formatTime(order.timeline.preparing_at) : 'N/A'}
                                icon={<ChefHat size={16} />}
                              />

                              <TimelineItem
                                label="4. Out of Kitchen"
                                time={order.timeline?.ready_at ? formatTime(order.timeline.ready_at) : 'N/A'}
                                icon={<Bell size={16} />}
                              />

                              <TimelineItem
                                label="5. Cook Time"
                                time={order.timeline?.cooking_duration || 'N/A'}
                                highlight={Boolean(order.timeline?.cooking_duration)}
                                icon={<Timer size={16} />}
                              />

                              <TimelineItem
                                label="6. Served"
                                time={order.timeline?.served_at ? formatTime(order.timeline.served_at) : 'N/A'}
                                icon={<UtensilsCrossed size={16} />}
                              />

                              <TimelineItem
                                label="7. Paid"
                                time={formatTime(order.timeline?.paid_at || order.updated_at)}
                                sub={formatDate(order.timeline?.paid_at || order.updated_at)}
                                icon={<CheckCircle2 size={16} />}
                              />

                            </div>

                          </div>

                          {/* FOOD */}

                          <div className="px-5 pb-5">

                            <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">
                              Food Ordered
                            </h4>

                            <div className="space-y-2">

                              {order.items.length ===
                              0 ? (

                                <p className="text-sm text-gray-500">
                                  No items found.
                                </p>

                              ) : (

                                order.items.map(
                                  (
                                    item
                                  ) => (
                                    <div
                                      key={
                                        item.id
                                      }
                                      className="flex items-start justify-between gap-4 rounded-lg bg-gray-50 p-3 dark:bg-slate-800"
                                    >

                                      <div className="flex gap-3">

                                        <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-white px-2 text-sm font-bold dark:bg-slate-700">
                                          {
                                            item.quantity
                                          }×
                                        </span>

                                        <div>

                                          <p className="font-medium">
                                            {itemName(
                                              item
                                            )}
                                          </p>

                                          {item.notes && (
                                            <p className="mt-1 text-xs text-gray-500">
                                              Note:{' '}
                                              {
                                                item.notes
                                              }
                                            </p>
                                          )}

                                        </div>

                                      </div>

                                      <span className="font-semibold">
                                        {money(
                                          Number(
                                            item.subtotal ??
                                              Number(
                                                item.unit_price ||
                                                  item.price ||
                                                  0
                                              ) *
                                                Number(
                                                  item.quantity
                                                )
                                          )
                                        )}
                                      </span>

                                    </div>
                                  )
                                )

                              )}

                            </div>

                          </div>

                          {/* ORDER TOTAL */}

                          <div className="border-t border-gray-200 px-5 py-4 dark:border-slate-800">

                            <div className="ml-auto max-w-sm space-y-2">

                              <div className="flex justify-between text-sm text-gray-500">
                                <span>
                                  Subtotal
                                </span>

                                <span>
                                  {money(
                                    Number(
                                      order.subtotal
                                    )
                                  )}
                                </span>
                              </div>

                              {Number(
                                order.discount
                              ) > 0 && (
                                <div className="flex justify-between text-sm text-gray-500">
                                  <span>
                                    Discount
                                  </span>

                                  <span>
                                    -
                                    {money(
                                      Number(
                                        order.discount
                                      )
                                    )}
                                  </span>
                                </div>
                              )}

                              {Number(
                                order.tax
                              ) > 0 && (
                                <div className="flex justify-between text-sm text-gray-500">
                                  <span>
                                    Tax
                                  </span>

                                  <span>
                                    {money(
                                      Number(
                                        order.tax
                                      )
                                    )}
                                  </span>
                                </div>
                              )}

                              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                                <span>
                                  Total
                                </span>

                                <span>
                                  {money(
                                    Number(
                                      order.total
                                    )
                                  )}
                                </span>
                              </div>

                            </div>

                          </div>

                          {/* PAYMENT */}

                          <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">

                            <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-400">
                              Payment
                            </h4>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                              <InfoBox
                                label="Payment Method"
                                value={
                                  paymentMethod
                                }
                              />

                              <InfoBox
                                label="Amount Paid"
                                value={money(
                                  paymentAmount
                                )}
                              />

                              <InfoBox
                                label="Payment Status"
                                value={
                                  order
                                    .payment
                                    ?.payment_status ||
                                  'Confirmed'
                                }
                              />

                            </div>

                          </div>

                          {/* ORDER NOTE */}

                          {order.notes && (
                            <div className="border-t border-gray-200 px-5 py-4 dark:border-slate-800">

                              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                                Order Note
                              </p>

                              <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                                {order.notes}
                              </p>

                            </div>
                          )}

                        </div>
                      )}

                    </div>
                  )
                }
              )}

            </div>

          )}

        </div>

      </div>
    </AdminLayout>
  )
}

/*
 * ============================================================
 * SUMMARY CARD
 * ============================================================
 */

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="restaurant-card p-5">

      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0">

          <p className="text-sm text-gray-500">
            {title}
          </p>

          <p className="mt-2 truncate text-xl font-bold text-restaurant-text dark:text-white">
            {value}
          </p>

        </div>

        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-restaurant-accent/10 text-restaurant-accent">
          {icon}
        </div>

      </div>

    </div>
  )
}

/*
 * ============================================================
 * INFO BOX
 * ============================================================
 */

function InfoBox({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-slate-800">

      <p className="text-xs text-gray-400">
        {label}
      </p>

      <p className="mt-1 font-semibold text-restaurant-text dark:text-white">
        {value}
      </p>

    </div>
  )
}

function TimelineItem({
  label,
  time,
  sub,
  icon,
  highlight = false,
}: {
  label: string
  time: string
  sub?: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={`flex flex-col justify-between rounded-xl p-3 border transition ${
        highlight
          ? 'bg-amber-50/80 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700/50'
          : 'bg-gray-50/80 border-gray-200/70 dark:bg-slate-800/60 dark:border-slate-800'
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <span
          className={
            highlight
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-gray-400 dark:text-gray-500'
          }
        >
          {icon}
        </span>
        <span className="font-medium truncate">{label}</span>
      </div>

      <div className="mt-2">
        <p
          className={`text-sm ${
            highlight
              ? 'font-bold text-amber-800 dark:text-amber-300'
              : 'font-semibold text-restaurant-text dark:text-white'
          }`}
        >
          {time}
        </p>

        {sub && (
          <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500 truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}