'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext'
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  CreditCard,
  Download,
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
  Search,
  Calendar,
  X,
  Sparkles,
  Flame,
  Receipt,
  Table as TableIcon,
  Activity,
  Camera,
  Eye,
} from 'lucide-react'

type Period = 'today' | 'week' | 'month' | 'year' | 'custom'

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
  receipt_image?: string | null
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
  orderCount?: number
  sortKey?: number
}

export default function OrdersReportPage() {
  return (
    <AdminLayout>
      <OrdersReportPageContent />
    </AdminLayout>
  )
}

function OrdersReportPageContent() {
  const { language, setLanguage, t } = useAdminLanguage()

  const [period, setPeriod] = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [summary, setSummary] = useState<Summary>({
    totalOrders: 0,
    totalCollected: 0,
    cash: 0,
    cbe: 0,
    telebirr: 0,
  })
  const [graph, setGraph] = useState<GraphPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'cbe' | 'telebirr'>('all')

  // Graph state: Toggle between Revenue (ETB) vs Volume (Orders Count)
  const [graphViewMode, setGraphViewMode] = useState<'revenue' | 'orders'>('revenue')
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null)
  const [showGraphTable, setShowGraphTable] = useState(false)

  // Lightbox for payment screenshot
  const [selectedReceiptImage, setSelectedReceiptImage] = useState<string | null>(null)

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

        const params = new URLSearchParams()
        params.set('period', period)

        if (period === 'custom') {
          if (customFrom) params.set('from', customFrom)
          if (customTo) params.set('to', customTo)
        }

        const response = await fetch(`/api/reports/orders?${params.toString()}`, {
          cache: 'no-store',
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to load report')
        }

        setOrders(result.data?.orders || [])
        setSummary(
          result.data?.summary || {
            totalOrders: 0,
            totalCollected: 0,
            cash: 0,
            cbe: 0,
            telebirr: 0,
          }
        )
        setGraph(result.data?.graph || [])
      } catch (err) {
        console.error('Report error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load report')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [period, customFrom, customTo]
  )

  useEffect(() => {
    loadReport()
  }, [loadReport])

  /*
   * =========================================================
   * FORMATTERS
   * =========================================================
   */

  function money(amount: number) {
    return `${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${language === 'am' ? 'ብር' : 'ETB'}`
  }

  function itemName(item: OrderItem) {
    const value = item.item_name ?? item.name
    if (typeof value === 'string') return value
    if (language === 'am' && value && typeof value.am === 'string' && value.am.trim()) return value.am
    if (value && typeof value.en === 'string' && value.en.trim()) return value.en
    if (value && typeof value.am === 'string' && value.am.trim()) return value.am
    return 'Unnamed item'
  }

  function formatDate(date?: string | null) {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString(language === 'am' ? 'am-ET' : undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  function formatTime(date?: string | null) {
    if (!date) return 'N/A'
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /*
   * =========================================================
   * CSV EXPORT
   * =========================================================
   */

  const exportToCSV = () => {
    if (!orders || orders.length === 0) {
      alert(language === 'am' ? 'ለዚህ ጊዜ የሚወርድ የተጠናቀቀ ትዕዛዝ የለም።' : 'No orders available to export for this period.')
      return
    }

    const headers = [
      'Order Number',
      'Date',
      'Time',
      'Table',
      'Waiter',
      'Customer Name',
      'Customer Phone',
      'Order Type',
      'Status',
      'Items Count',
      'Items Summary',
      'Cooking Duration',
      'Payment Method',
      'Subtotal (ETB)',
      'Discount (ETB)',
      'Tax (ETB)',
      'Total Amount (ETB)',
    ]

    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""'
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }

    const rows = orders.map((order) => {
      const itemsSummary = (order.items || [])
        .map((it) => {
          const rawName = it.name || it.item_name
          const name =
            typeof rawName === 'object' && rawName !== null
              ? rawName.en || rawName.am || 'Item'
              : String(rawName || 'Item')
          return `${it.quantity}x ${name}`
        })
        .join('; ')

      const totalItemsCount = (order.items || []).reduce(
        (sum, it) => sum + (Number(it.quantity) || 1),
        0
      )

      const paymentMethod = order.payment?.payment_method
        ? order.payment.payment_method.toUpperCase()
        : 'UNPAID'

      const dateObj = order.created_at ? new Date(order.created_at) : null
      const datePart = dateObj ? dateObj.toLocaleDateString() : ''
      const timePart = dateObj
        ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : ''

      return [
        escapeCsv(order.order_number),
        escapeCsv(datePart),
        escapeCsv(timePart),
        escapeCsv(order.table_name || 'Takeaway'),
        escapeCsv(order.waiter_name || '-'),
        escapeCsv(order.customer_name || '-'),
        escapeCsv(order.customer_phone || '-'),
        escapeCsv(order.order_type || 'dine_in'),
        escapeCsv(order.status || 'closed'),
        escapeCsv(totalItemsCount),
        escapeCsv(itemsSummary),
        escapeCsv(order.timeline?.cooking_duration || '-'),
        escapeCsv(paymentMethod),
        escapeCsv(Number(order.subtotal || 0).toFixed(2)),
        escapeCsv(Number(order.discount || 0).toFixed(2)),
        escapeCsv(Number(order.tax || 0).toFixed(2)),
        escapeCsv(Number(order.total || 0).toFixed(2)),
      ].join(',')
    })

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0)

    const summaryRow = [
      escapeCsv('TOTAL'),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(`${orders.length} orders`),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(totalRevenue.toFixed(2)),
    ].join(',')

    const csvContent = '\uFEFF' + [headers.join(','), ...rows, summaryRow].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const dateSuffix = new Date().toISOString().slice(0, 10)
    link.setAttribute('download', `sales_report_${period}_${dateSuffix}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /*
   * =========================================================
   * COMPUTED GRAPH METRICS & PEAK HOURS INTELLIGENCE
   * =========================================================
   */

  const {
    maximumGraphValue,
    totalGraphAmount,
    averageGraphAmount,
    peakGraphPoint,
    maximumOrderCount,
    totalOrdersCount,
    peakOrderPoint,
    rankedRushHours,
  } = useMemo(() => {
    if (graph.length === 0) {
      return {
        maximumGraphValue: 1,
        totalGraphAmount: 0,
        averageGraphAmount: 0,
        peakGraphPoint: null,
        maximumOrderCount: 1,
        totalOrdersCount: 0,
        peakOrderPoint: null,
        rankedRushHours: [],
      }
    }

    const totalAmount = graph.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const maxAmount = Math.max(...graph.map((p) => Number(p.amount || 0)), 1)
    const avgAmount = totalAmount / graph.length

    const totalOrders = graph.reduce((sum, p) => sum + Number(p.orderCount || 1), 0)
    const maxOrders = Math.max(...graph.map((p) => Number(p.orderCount || 1)), 1)

    let peakAmountPoint = graph[0]
    let peakOrdersPoint = graph[0]

    for (const p of graph) {
      if (Number(p.amount) > Number(peakAmountPoint.amount)) {
        peakAmountPoint = p
      }
      if (Number(p.orderCount || 0) > Number(peakOrdersPoint.orderCount || 0)) {
        peakOrdersPoint = p
      }
    }

    const ranked = [...graph]
      .filter((p) => Number(p.amount) > 0)
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 3)

    return {
      maximumGraphValue: maxAmount,
      totalGraphAmount: totalAmount,
      averageGraphAmount: avgAmount,
      peakGraphPoint: Number(peakAmountPoint.amount) > 0 ? peakAmountPoint : null,
      maximumOrderCount: maxOrders,
      totalOrdersCount: totalOrders,
      peakOrderPoint: Number(peakOrdersPoint.amount) > 0 ? peakOrdersPoint : null,
      rankedRushHours: ranked,
    }
  }, [graph])

  /*
   * =========================================================
   * FILTERED ORDERS
   * =========================================================
   */

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Payment filter
      if (paymentFilter !== 'all') {
        const method = (order.payment?.payment_method || '').toLowerCase()
        if (paymentFilter === 'cash' && !method.includes('cash')) return false
        if (paymentFilter === 'cbe' && !method.includes('cbe')) return false
        if (paymentFilter === 'telebirr' && !method.includes('telebirr')) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const orderNum = order.order_number.toLowerCase()
        const table = (order.table_name || '').toLowerCase()
        const waiter = (order.waiter_name || '').toLowerCase()
        const customer = (order.customer_name || '').toLowerCase()
        const hasItem = (order.items || []).some((item) =>
          itemName(item).toLowerCase().includes(query)
        )

        return (
          orderNum.includes(query) ||
          table.includes(query) ||
          waiter.includes(query) ||
          customer.includes(query) ||
          hasItem
        )
      }

      return true
    })
  }, [orders, paymentFilter, searchQuery, language])

  // Payment share percentages
  const paymentShares = useMemo(() => {
    const total = summary.totalCollected || 1
    const cashPct = Math.round(((summary.cash || 0) / total) * 100)
    const cbePct = Math.round(((summary.cbe || 0) / total) * 100)
    const telebirrPct = Math.round(((summary.telebirr || 0) / total) * 100)

    return {
      cash: Math.min(100, Math.max(0, cashPct)),
      cbe: Math.min(100, Math.max(0, cbePct)),
      telebirr: Math.min(100, Math.max(0, telebirrPct)),
    }
  }, [summary])

  /*
   * =========================================================
   * LOADING STATE
   * =========================================================
   */

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-restaurant-accent/15 text-restaurant-accent animate-pulse mb-4">
          <BarChart3 size={28} />
        </div>
        <p className="text-base font-bold text-stone-800 dark:text-white">
          {t.loadingAnalytics}
        </p>
        <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 font-medium">
          {t.computingSales}
        </p>
      </div>
    )
  }

  /*
   * =========================================================
   * MAIN REPORT RENDER
   * =========================================================
   */

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-white tracking-tight">
              {t.reportTitle}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-restaurant-accent/15 px-3 py-1 text-xs font-bold text-stone-800 dark:text-amber-300 border border-restaurant-accent/30">
              <Sparkles size={13} className="text-restaurant-accent" />
              {t.liveSettlement}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-stone-600 dark:text-stone-300">
            {t.reportSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* In-page Language Selector */}
          <div className="flex items-center rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-850 p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                language === 'en'
                  ? 'bg-restaurant-accent text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('am')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                language === 'am'
                  ? 'bg-restaurant-accent text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              አማ
            </button>
          </div>

          <button
            onClick={exportToCSV}
            disabled={orders.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-bold text-stone-800 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-slate-700 disabled:opacity-40 transition shadow-sm"
            title="Export report to CSV file"
          >
            <Download size={16} />
            {t.exportCsv}
          </button>

          <button
            onClick={() => loadReport(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-restaurant-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-restaurant-accent-dark disabled:opacity-50 transition shadow-sm hover:shadow"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {t.refresh}
          </button>
        </div>
      </div>

      {/* ERROR NOTIFICATION */}
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* PERIOD SELECTOR TABS */}
      <div className="restaurant-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Pill Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
            {(
              [
                ['today', t.today],
                ['week', t.thisWeek],
                ['month', t.thisMonth],
                ['year', t.thisYear],
                ['custom', t.customRange],
              ] as [Period, string][]
            ).map(([value, label]) => {
              const isActive = period === value
              return (
                <button
                  key={value}
                  onClick={() => setPeriod(value)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-white text-stone-900 shadow-sm dark:bg-slate-700 dark:text-white ring-1 ring-stone-200 dark:ring-slate-600'
                      : 'text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Quick Period Label */}
          <div className="text-xs font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-1.5 px-1">
            <Calendar size={14} className="text-restaurant-accent" />
            <span>
              {t.filteredTimeframe}:{' '}
              <strong className="text-stone-900 dark:text-white uppercase tracking-wide">
                {period === 'today'
                  ? t.today
                  : period === 'week'
                  ? t.thisWeek
                  : period === 'month'
                  ? t.thisMonth
                  : period === 'year'
                  ? t.thisYear
                  : t.customRange}
              </strong>
            </span>
          </div>
        </div>

        {/* Custom Date Range Pickers */}
        {period === 'custom' && (
          <div className="mt-3.5 pt-3.5 border-t border-stone-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300">{t.from}:</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-stone-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold dark:bg-slate-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-restaurant-accent"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300">{t.to}:</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-stone-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold dark:bg-slate-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-restaurant-accent"
              />
            </div>

            <button
              onClick={() => loadReport(true)}
              className="px-4 py-1.5 rounded-lg bg-restaurant-accent text-white text-xs font-bold hover:bg-restaurant-accent-dark transition shadow-sm"
            >
              {t.applyRange}
            </button>
          </div>
        )}
      </div>

      {/* PRIMARY EXECUTIVE KPI METRICS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Total Revenue */}
        <div className="restaurant-card p-5 relative overflow-hidden border-l-4 border-l-emerald-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {t.totalRevenue}
              </p>
              <h3 className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-white tracking-tight">
                {money(summary.totalCollected)}
              </h3>
              <p className="mt-1 text-xs font-medium text-stone-600 dark:text-stone-300">
                {summary.totalOrders > 0
                  ? `${money(summary.totalCollected / summary.totalOrders)} ${t.avgOrderValue}`
                  : t.noOrdersYet}
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shadow-sm">
              <CircleDollarSign size={24} />
            </div>
          </div>
        </div>

        {/* Orders Closed */}
        <div className="restaurant-card p-5 relative overflow-hidden border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                {t.ordersSettled}
              </p>
              <h3 className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-white tracking-tight">
                {summary.totalOrders}
              </h3>
              <p className="mt-1 text-xs font-medium text-stone-600 dark:text-stone-300">
                {t.completedSettled}
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 shadow-sm">
              <ShoppingBag size={24} />
            </div>
          </div>
        </div>

        {/* Kitchen Cook Time */}
        <div className="restaurant-card p-5 relative overflow-hidden border-l-4 border-l-amber-500">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                {t.avgCookTime}
              </p>
              <h3 className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-white tracking-tight">
                {summary.averageCookingDuration || 'N/A'}
              </h3>
              <p className="mt-1 text-xs font-medium text-stone-600 dark:text-stone-300">
                {t.cookTimeDesc}
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shadow-sm">
              <Timer size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* PAYMENT SETTLEMENT CHANNELS BREAKDOWN */}
      <div className="restaurant-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-900 dark:text-white">
              {t.settlementChannels}
            </h2>
            <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
              {t.channelsSubtitle}
            </p>
          </div>

          <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
            {t.totalRevenue}: <strong className="text-stone-900 dark:text-white">{money(summary.totalCollected)}</strong>
          </span>
        </div>

        {/* Visual Stacked Progress Bar */}
        <div className="h-3.5 w-full rounded-full bg-stone-200 dark:bg-slate-800 overflow-hidden flex gap-1 p-0.5 mb-4 shadow-inner">
          {summary.cash > 0 && (
            <div
              style={{ width: `${paymentShares.cash}%` }}
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              title={`${t.cash}: ${paymentShares.cash}% (${money(summary.cash)})`}
            />
          )}
          {summary.cbe > 0 && (
            <div
              style={{ width: `${paymentShares.cbe}%` }}
              className="h-full rounded-full bg-sky-500 transition-all duration-500"
              title={`${t.cbe}: ${paymentShares.cbe}% (${money(summary.cbe)})`}
            />
          )}
          {summary.telebirr > 0 && (
            <div
              style={{ width: `${paymentShares.telebirr}%` }}
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              title={`${t.telebirr}: ${paymentShares.telebirr}% (${money(summary.telebirr)})`}
            />
          )}
          {summary.totalCollected === 0 && (
            <div className="h-full w-full rounded-full bg-stone-300 dark:bg-slate-700" />
          )}
        </div>

        {/* 3 Payment Methods Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Cash */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/25 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <Wallet size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{t.cash}</p>
                <p className="text-base font-bold text-stone-900 dark:text-white">
                  {money(summary.cash)}
                </p>
              </div>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-md bg-emerald-200 text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-200">
              {summary.totalCollected > 0 ? `${paymentShares.cash}%` : '0%'}
            </span>
          </div>

          {/* CBE */}
          <div className="rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/70 dark:bg-sky-950/25 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                <CreditCard size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-sky-800 dark:text-sky-300">{t.cbe}</p>
                <p className="text-base font-bold text-stone-900 dark:text-white">
                  {money(summary.cbe)}
                </p>
              </div>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-md bg-sky-200 text-sky-900 dark:bg-sky-900/70 dark:text-sky-200">
              {summary.totalCollected > 0 ? `${paymentShares.cbe}%` : '0%'}
            </span>
          </div>

          {/* Telebirr */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/25 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
                <Smartphone size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">{t.telebirr}</p>
                <p className="text-base font-bold text-stone-900 dark:text-white">
                  {money(summary.telebirr)}
                </p>
              </div>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-md bg-amber-200 text-amber-900 dark:bg-amber-900/70 dark:text-amber-200">
              {summary.totalCollected > 0 ? `${paymentShares.telebirr}%` : '0%'}
            </span>
          </div>
        </div>
      </div>

      {/* 🔥 PEAK HOURS & OPERATIONAL RUSH INTELLIGENCE */}
      <div className="restaurant-card p-5 sm:p-6 border border-amber-200 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/40 via-white to-cream-50/40 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 shadow-sm">
        {/* Section Header with Dual Toggle */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200 dark:border-slate-800 pb-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
                <Flame size={18} />
              </div>
              <h2 className="text-lg font-serif font-bold text-stone-900 dark:text-white">
                {t.rushHoursTitle}
              </h2>
            </div>
            <p className="text-xs font-medium text-stone-600 dark:text-stone-300 mt-1">
              {t.rushHoursSubtitle}
            </p>
          </div>

          {/* Metric Toggle: Revenue vs Volume */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-slate-800 rounded-xl border border-stone-200 dark:border-slate-700">
              <button
                onClick={() => setGraphViewMode('revenue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  graphViewMode === 'revenue'
                    ? 'bg-white dark:bg-slate-700 text-stone-900 dark:text-white shadow-sm'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {t.revenueMetric}
              </button>
              <button
                onClick={() => setGraphViewMode('orders')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  graphViewMode === 'orders'
                    ? 'bg-white dark:bg-slate-700 text-stone-900 dark:text-white shadow-sm'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {t.volumeMetric}
              </button>
            </div>

            <button
              onClick={() => setShowGraphTable(!showGraphTable)}
              className="p-2 rounded-xl border border-stone-200 dark:border-slate-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-slate-800 transition"
              title="Toggle tabular view of rush periods"
            >
              <TableIcon size={16} />
            </button>
          </div>
        </div>

        {/* Operational Rush Insights Callout Banner */}
        {peakGraphPoint && totalGraphAmount > 0 && (
          <div className="mb-6 rounded-2xl bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
                  <Activity size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                      {t.peakRushDetected}
                    </span>
                    <span className="rounded-full bg-amber-200 dark:bg-amber-900/60 px-2 py-0.5 text-[11px] font-extrabold text-amber-950 dark:text-amber-200">
                      {peakGraphPoint.label}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-stone-900 dark:text-white mt-0.5">
                    {money(peakGraphPoint.amount)} ({peakGraphPoint.orderCount || 1}{' '}
                    {(peakGraphPoint.orderCount || 1) === 1 ? t.singleOrderLabel : t.orderCountLabel})
                    <span className="font-normal text-stone-600 dark:text-stone-300 ml-1.5">
                      • {Math.round((Number(peakGraphPoint.amount) / (totalGraphAmount || 1)) * 100)}% {t.ofTotalSales}
                    </span>
                  </p>
                </div>
              </div>

              {/* Top 3 ranked rush windows */}
              {rankedRushHours.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300">
                    {t.busiestWindows}:
                  </span>
                  {rankedRushHours.map((rush, idx) => (
                    <span
                      key={rush.label}
                      className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-stone-800 dark:text-stone-200 border border-amber-200/80 dark:border-amber-900/40 shadow-xs"
                    >
                      <span className="text-amber-600 dark:text-amber-400 font-extrabold">#{idx + 1}</span>
                      <span>{rush.label}</span>
                      <span className="text-stone-500 text-[10px]">({Number(rush.amount).toLocaleString()} {language === 'am' ? 'ብር' : 'ETB'})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Summary Strip */}
        {graph.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 mb-5 text-xs font-bold">
            <div className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-slate-700">
              {t.totalRevenue}: <strong className="text-stone-900 dark:text-white ml-1">{money(totalGraphAmount)}</strong>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-slate-700">
              {t.totalOrders}: <strong className="text-stone-900 dark:text-white ml-1">{totalOrdersCount} {t.orderCountLabel}</strong>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-slate-700">
              {t.averagePerSlot}: <strong className="text-stone-900 dark:text-white ml-1">{money(averageGraphAmount)}</strong>
            </div>
            {peakGraphPoint && (
              <div className="px-3 py-1.5 rounded-lg bg-amber-100/80 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800/60">
                🔥 {t.highestWindow}: <strong className="ml-1">{peakGraphPoint.label}</strong> ({money(peakGraphPoint.amount)})
              </div>
            )}
          </div>
        )}

        {/* CHART BODY */}
        {graph.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 dark:border-slate-800 text-center p-8 bg-stone-50/50 dark:bg-slate-850/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-200 dark:bg-slate-800 text-stone-500 mb-2">
              <BarChart3 size={24} />
            </div>
            <h3 className="text-sm font-bold text-stone-800 dark:text-white">
              {t.noSalesTitle}
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 max-w-sm">
              {t.noSalesDesc}
            </p>
          </div>
        ) : (
          <div className="relative pt-6">
            {/* Horizontal Guidelines & Reference Axis */}
            <div className="overflow-x-auto pb-4">
              <div
                className="relative flex min-w-[550px] items-end gap-3 sm:gap-4 px-2"
                style={{ height: 280 }}
              >
                {/* Background Guidelines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                  {/* 100% Mark */}
                  <div className="border-b border-stone-200 dark:border-slate-700/80 w-full flex justify-between pr-2 text-xs font-bold text-stone-600 dark:text-stone-300">
                    <span>{graphViewMode === 'revenue' ? money(maximumGraphValue) : `${maximumOrderCount} ${t.orderCountLabel}`}</span>
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider">{t.topLimit}</span>
                  </div>

                  {/* 75% Mark */}
                  <div className="border-b border-dashed border-stone-200 dark:border-slate-800/80 w-full flex justify-start pr-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
                    <span>{graphViewMode === 'revenue' ? money(maximumGraphValue * 0.75) : `${Math.round(maximumOrderCount * 0.75)} ${t.orderCountLabel}`}</span>
                  </div>

                  {/* 50% Mark */}
                  <div className="border-b border-dashed border-stone-200 dark:border-slate-800/80 w-full flex justify-start pr-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
                    <span>{graphViewMode === 'revenue' ? money(maximumGraphValue * 0.5) : `${Math.round(maximumOrderCount * 0.5)} ${t.orderCountLabel}`}</span>
                  </div>

                  {/* 25% Mark */}
                  <div className="border-b border-dashed border-stone-200 dark:border-slate-800/80 w-full flex justify-start pr-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
                    <span>{graphViewMode === 'revenue' ? money(maximumGraphValue * 0.25) : `${Math.round(maximumOrderCount * 0.25)} ${t.orderCountLabel}`}</span>
                  </div>

                  {/* 0% Baseline */}
                  <div className="border-b-2 border-stone-400 dark:border-slate-600 w-full flex justify-start pr-2 text-xs font-bold text-stone-700 dark:text-stone-300">
                    <span>0</span>
                  </div>
                </div>

                {/* Chart Bars */}
                {graph.map((point, index) => {
                  const value = graphViewMode === 'revenue' ? Number(point.amount) : Number(point.orderCount || 1)
                  const max = graphViewMode === 'revenue' ? maximumGraphValue : maximumOrderCount
                  const heightPercent = Math.max(6, Math.round((value / max) * 100))

                  const isPeak =
                    graphViewMode === 'revenue'
                      ? peakGraphPoint && point.label === peakGraphPoint.label && Number(point.amount) > 0
                      : peakOrderPoint && point.label === peakOrderPoint.label && Number(point.amount) > 0

                  const isHovered = hoveredPointIndex === index

                  return (
                    <div
                      key={`${point.label}-${index}`}
                      onMouseEnter={() => setHoveredPointIndex(index)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                      className="relative flex h-full flex-1 flex-col items-center justify-end group cursor-pointer z-10"
                    >
                      {/* Interactive Floating Tooltip */}
                      {isHovered && (
                        <div className="absolute -top-20 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 p-3 text-xs shadow-2xl pointer-events-none transition-all animate-fade-in border border-stone-700 dark:border-stone-300">
                          <div className="flex items-center justify-between gap-3 border-b border-stone-700 dark:border-stone-300 pb-1.5 mb-1.5 font-bold">
                            <span>{point.label}</span>
                            {isPeak && <span className="text-amber-400 dark:text-amber-600 font-extrabold">🔥 {t.peakBadge}</span>}
                          </div>
                          <div className="space-y-1 font-semibold">
                            <div className="flex justify-between gap-4">
                              <span className="text-stone-300 dark:text-stone-600">{t.revenue}:</span>
                              <span className="font-extrabold text-amber-300 dark:text-amber-700">{money(point.amount)}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-stone-300 dark:text-stone-600">{t.orders}:</span>
                              <span>{point.orderCount || 1} {t.orderCountLabel}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-[11px] text-stone-400 dark:text-stone-500 pt-0.5 border-t border-stone-800 dark:border-stone-200">
                              <span>{t.contribution}:</span>
                              <span>{Math.round((Number(point.amount) / (totalGraphAmount || 1)) * 100)}%</span>
                            </div>
                          </div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-stone-900 dark:border-t-stone-100" />
                        </div>
                      )}

                      {/* Top Indicator Badge */}
                      {isPeak && (
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black tracking-wider uppercase shadow-sm">
                          <Flame size={10} /> {t.peakBadge}
                        </span>
                      )}

                      {/* Value text right above bar */}
                      <span
                        className={`text-xs font-bold mb-1.5 transition-all ${
                          isHovered || isPeak
                            ? 'text-stone-900 dark:text-white scale-110 font-extrabold'
                            : 'text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        {graphViewMode === 'revenue'
                          ? Number(point.amount) > 0
                            ? Number(point.amount) >= 1000
                              ? `${(Number(point.amount) / 1000).toFixed(1)}k`
                              : Number(point.amount).toLocaleString()
                            : '0'
                          : point.orderCount || 0}
                      </span>

                      {/* The Bar Element */}
                      <div className="w-full max-w-[50px] flex items-end justify-center" style={{ height: '65%' }}>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-xl transition-all duration-300 ${
                            isPeak
                              ? 'bg-gradient-to-t from-amber-600 via-amber-500 to-amber-400 shadow-md ring-2 ring-amber-400/50'
                              : isHovered
                                ? 'bg-gradient-to-t from-restaurant-accent-dark via-restaurant-accent to-restaurant-accent ring-2 ring-restaurant-accent shadow-lg scale-x-105'
                                : 'bg-gradient-to-t from-restaurant-accent/70 to-restaurant-accent hover:from-restaurant-accent hover:to-restaurant-accent-dark'
                          }`}
                        />
                      </div>

                      {/* X-Axis Label */}
                      <span
                        className={`mt-2.5 whitespace-nowrap text-xs font-bold transition-colors max-w-[65px] truncate text-center ${
                          isHovered || isPeak
                            ? 'text-stone-900 dark:text-white font-extrabold underline decoration-restaurant-accent decoration-2 underline-offset-4'
                            : 'text-stone-700 dark:text-stone-300'
                        }`}
                        title={point.label}
                      >
                        {point.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Rush Data Table */}
        {showGraphTable && graph.length > 0 && (
          <div className="mt-6 pt-5 border-t border-stone-200 dark:border-slate-800 animate-fade-in">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-white mb-3">
              {t.tableBreakdownTitle}
            </h3>
            <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-stone-300 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">{t.timeWindow}</th>
                    <th className="p-3">{t.salesETB}</th>
                    <th className="p-3">{t.ordersSettled}</th>
                    <th className="p-3">{t.avgTicket}</th>
                    <th className="p-3">{t.shareOfPeriod}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-slate-800 text-stone-800 dark:text-stone-200 font-medium">
                  {graph.map((p) => {
                    const share = Math.round((Number(p.amount) / (totalGraphAmount || 1)) * 100)
                    const isPeak = peakGraphPoint && p.label === peakGraphPoint.label
                    return (
                      <tr
                        key={p.label}
                        className={`hover:bg-stone-50 dark:hover:bg-slate-800/50 ${
                          isPeak ? 'bg-amber-50 dark:bg-amber-950/30 font-bold' : ''
                        }`}
                      >
                        <td className="p-3 flex items-center gap-1.5">
                          {p.label}
                          {isPeak && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-extrabold">
                              {t.peakBadge}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-stone-900 dark:text-white">{money(p.amount)}</td>
                        <td className="p-3">{p.orderCount || 1}</td>
                        <td className="p-3">
                          {money(Number(p.amount) / Number(p.orderCount || 1))}
                        </td>
                        <td className="p-3">
                          <span className="font-bold">{share}%</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ORDERS MANAGEMENT SECTION */}
      <div className="space-y-4">
        {/* Section Header & Filters */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-serif font-bold text-stone-900 dark:text-white">
                {t.closedOrders}
              </h2>
              <span className="rounded-full bg-stone-200 dark:bg-slate-800 px-3 py-0.5 text-xs font-bold text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-slate-700">
                {filteredOrders.length} {filteredOrders.length === 1 ? t.singleOrderLabel : t.orderCountLabel}
              </span>
            </div>
            <p className="text-xs font-medium text-stone-600 dark:text-stone-300 mt-0.5">
              {t.clickToInspect}
            </p>
          </div>

          {/* Search & Channel Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Box */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 dark:text-stone-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full sm:w-64 pl-9 pr-8 py-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-xs font-medium text-stone-900 dark:text-white placeholder-stone-500 dark:placeholder-stone-400 focus:ring-2 focus:ring-restaurant-accent focus:border-restaurant-accent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Payment Filter Buttons */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-slate-800 rounded-xl border border-stone-200 dark:border-slate-700">
              {(
                [
                  ['all', t.all],
                  ['cash', t.cash],
                  ['cbe', t.cbe],
                  ['telebirr', t.telebirr],
                ] as const
              ).map(([method, label]) => {
                const isActive = paymentFilter === method
                return (
                  <button
                    key={method}
                    onClick={() => setPaymentFilter(method as any)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg capitalize transition ${
                      isActive
                        ? 'bg-white text-stone-900 shadow-sm dark:bg-slate-700 dark:text-white ring-1 ring-stone-200 dark:ring-slate-600'
                        : 'text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="restaurant-card p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 dark:bg-slate-800 text-stone-500 mx-auto mb-3">
              <Receipt size={28} />
            </div>
            <h3 className="font-serif font-bold text-base text-stone-900 dark:text-white">
              {orders.length === 0 ? t.noClosedOrders : t.noMatchingOrders}
            </h3>
            <p className="mt-1 text-xs font-medium text-stone-600 dark:text-stone-300 max-w-sm mx-auto">
              {orders.length === 0
                ? t.noOrdersPeriodDesc
                : t.tryChangingFilter}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const expanded = expandedOrderId === order.id
              const paymentMethod = (order.payment?.payment_method || 'Unknown').toLowerCase()
              const paymentAmount = Number(order.payment?.amount || order.total || 0)
              const itemsCount = (order.items || []).reduce(
                (sum, it) => sum + (Number(it.quantity) || 1),
                0
              )

              const isCash = paymentMethod.includes('cash')
              const isCbe = paymentMethod.includes('cbe')
              const isTelebirr = paymentMethod.includes('telebirr')

              return (
                <div
                  key={order.id}
                  className={`restaurant-card overflow-hidden transition-all duration-200 ${
                    expanded ? 'ring-2 ring-restaurant-accent shadow-md' : 'hover:border-stone-400'
                  }`}
                >
                  {/* ORDER CARD ROW */}
                  <button
                    onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                    className="w-full p-4 sm:p-5 text-left transition hover:bg-stone-50/70 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      {/* Left Side: Order details */}
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-restaurant-accent/15 text-restaurant-accent font-bold">
                          <Receipt size={20} />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-white">
                              {order.order_number.startsWith('order-')
                                ? order.order_number
                                : `#${order.order_number}`}
                            </h3>

                            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              {t.paid}
                            </span>

                            <span className="rounded-full bg-stone-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-slate-700">
                              {order.table_name || t.takeaway}
                            </span>

                            {order.waiter_name && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-950 px-2.5 py-0.5 text-xs font-bold text-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                                <User size={12} /> {order.waiter_name}
                              </span>
                            )}
                          </div>

                          {/* Subtitle row with HIGH-CONTRAST TEXT */}
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-stone-600 dark:text-stone-300">
                            <span>{t.orderedTime}: <strong className="text-stone-800 dark:text-white">{formatTime(order.timeline?.ordered_at || order.created_at)}</strong></span>
                            <span>•</span>
                            <span>{t.paidTime}: <strong className="text-stone-800 dark:text-white">{formatTime(order.timeline?.paid_at || order.updated_at)}</strong></span>
                            <span>•</span>
                            <span>{itemsCount} {itemsCount === 1 ? t.singleItemCount : t.itemsCount}</span>

                            {order.timeline?.cooking_duration && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-xs font-bold text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                  <Timer size={12} /> {order.timeline.cooking_duration}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Payment amount & Expand Chevron */}
                      <div className="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-stone-200 dark:border-slate-800">
                        <div className="text-left md:text-right">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
                              isCash
                                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                                : isCbe
                                  ? 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                                  : isTelebirr
                                    ? 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                                    : 'bg-stone-100 text-stone-900 dark:bg-slate-800 dark:text-stone-200 border-stone-300 dark:border-slate-700'
                            }`}
                          >
                            {isCash ? t.cash : isCbe ? t.cbe : isTelebirr ? t.telebirr : (order.payment?.payment_method || 'Settled')}
                          </span>

                          <p className="mt-0.5 text-base sm:text-lg font-bold text-stone-900 dark:text-white">
                            {money(paymentAmount)}
                          </p>
                        </div>

                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 group-hover:text-restaurant-accent transition">
                          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* EXPANDED DETAILS DRAWER */}
                  {expanded && (
                    <div className="border-t border-stone-200 dark:border-slate-800 bg-stone-50/60 dark:bg-slate-850 p-5 sm:p-6 space-y-6 animate-fade-in">
                      {/* KITCHEN & ORDER LIFECYCLE STEPPER */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                            <Clock size={14} className="text-restaurant-accent" />
                            {t.lifecycleTitle}
                          </h4>
                          <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                            {t.tables}: <strong className="text-stone-900 dark:text-white">{order.table_name || t.takeaway}</strong>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                          <TimelineItem
                            label={t.stepOrdered}
                            time={formatTime(order.timeline?.ordered_at || order.created_at)}
                            sub={formatDate(order.timeline?.ordered_at || order.created_at)}
                            icon={<Clock size={15} />}
                          />

                          <TimelineItem
                            label={t.stepToKitchen}
                            time={
                              order.timeline?.sent_to_kitchen_at
                                ? formatTime(order.timeline.sent_to_kitchen_at)
                                : 'Auto-sent'
                            }
                            icon={<Send size={15} />}
                          />

                          <TimelineItem
                            label={t.stepPreparing}
                            time={
                              order.timeline?.preparing_at
                                ? formatTime(order.timeline.preparing_at)
                                : 'N/A'
                            }
                            icon={<ChefHat size={15} />}
                          />

                          <TimelineItem
                            label={t.stepReady}
                            time={
                              order.timeline?.ready_at
                                ? formatTime(order.timeline.ready_at)
                                : 'N/A'
                            }
                            icon={<Bell size={15} />}
                          />

                          <TimelineItem
                            label={t.stepCookTime}
                            time={order.timeline?.cooking_duration || 'N/A'}
                            highlight={Boolean(order.timeline?.cooking_duration)}
                            icon={<Timer size={15} />}
                          />

                          <TimelineItem
                            label={t.stepServed}
                            time={
                              order.timeline?.served_at
                                ? formatTime(order.timeline.served_at)
                                : 'N/A'
                            }
                            icon={<UtensilsCrossed size={15} />}
                          />

                          <TimelineItem
                            label={t.stepPaid}
                            time={formatTime(order.timeline?.paid_at || order.updated_at)}
                            sub={formatDate(order.timeline?.paid_at || order.updated_at)}
                            icon={<CheckCircle2 size={15} />}
                          />
                        </div>
                      </div>

                      {/* FOOD ITEMS ORDERED & BILLING RECEIPT */}
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                        {/* Items List (2 cols) */}
                        <div className="lg:col-span-2 space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                            {t.itemsOrderedTitle} ({order.items.length})
                          </h4>

                          <div className="space-y-2">
                            {order.items.length === 0 ? (
                              <p className="text-xs font-semibold text-stone-600 dark:text-stone-400 py-3">{t.noItemsFound}</p>
                            ) : (
                              order.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 shadow-xs"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-restaurant-accent/20 text-xs font-extrabold text-stone-900 dark:text-amber-300">
                                      {item.quantity}×
                                    </span>

                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-stone-900 dark:text-white truncate">
                                        {itemName(item)}
                                      </p>
                                      {item.notes && (
                                        <p className="text-xs text-stone-600 dark:text-stone-300 italic truncate">
                                          {t.notes}: {item.notes}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-bold text-stone-900 dark:text-white">
                                      {money(Number(item.subtotal || (item.price || 0) * item.quantity))}
                                    </p>
                                    <p className="text-xs font-medium text-stone-600 dark:text-stone-400">
                                      {money(Number(item.unit_price || item.price || 0))} each
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Billing & Order Notes (1 col) */}
                        <div className="space-y-4">
                          <div className="rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3 shadow-xs">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 border-b border-stone-200 dark:border-slate-700 pb-2">
                              {t.settlementReceipt}
                            </h4>

                            <div className="space-y-2 text-xs font-semibold">
                              <div className="flex justify-between text-stone-700 dark:text-stone-300">
                                <span>{t.subtotal}</span>
                                <span className="font-bold text-stone-900 dark:text-white">
                                  {money(order.subtotal || order.total)}
                                </span>
                              </div>

                              {Number(order.discount) > 0 && (
                                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                                  <span>{t.discount}</span>
                                  <span>-{money(order.discount)}</span>
                                </div>
                              )}

                              {Number(order.tax) > 0 && (
                                <div className="flex justify-between text-stone-700 dark:text-stone-300">
                                  <span>{t.tax}</span>
                                  <span className="font-bold text-stone-900 dark:text-white">
                                    {money(order.tax)}
                                  </span>
                                </div>
                              )}

                              <div className="flex justify-between border-t border-stone-200 dark:border-slate-700 pt-2 text-sm font-extrabold text-stone-900 dark:text-white">
                                <span>{t.totalSettled}</span>
                                <span className="text-restaurant-accent">
                                  {money(order.total)}
                                </span>
                              </div>

                              <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400 pt-1">
                                <span>{t.method}</span>
                                <span className="font-bold uppercase text-stone-900 dark:text-white">
                                  {isCash ? t.cash : isCbe ? t.cbe : isTelebirr ? t.telebirr : (order.payment?.payment_method || 'CASH')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* PAYMENT RECEIPT / SCREENSHOT PREVIEW */}
                          {order.payment?.receipt_image && (
                            <div className="rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 space-y-2 shadow-xs">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                                  <Camera size={13} className="text-restaurant-accent" />
                                  {t.receiptScreenshot}
                                </h5>
                                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                                  {t.attached}
                                </span>
                              </div>

                              <div
                                onClick={() => setSelectedReceiptImage(order.payment?.receipt_image || null)}
                                className="relative h-32 w-full rounded-lg overflow-hidden border border-stone-200 dark:border-slate-700 cursor-pointer group bg-stone-100 dark:bg-slate-900 flex items-center justify-center"
                                title={t.viewFullPhoto}
                              >
                                <img
                                  src={order.payment.receipt_image}
                                  alt="Payment confirmation screenshot"
                                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-200"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1.5">
                                  <Eye size={15} /> {t.viewFullPhoto}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Waiter & Customer Card */}
                          {(order.waiter_name || order.customer_name || order.notes) && (
                            <div className="rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 space-y-1.5 text-xs font-medium shadow-xs">
                              {order.waiter_name && (
                                <div className="flex items-center justify-between">
                                  <span className="text-stone-600 dark:text-stone-400">{t.staffWaiter}:</span>
                                  <span className="font-bold text-purple-800 dark:text-purple-300">
                                    {order.waiter_name}
                                  </span>
                                </div>
                              )}
                              {order.customer_name && (
                                <div className="flex items-center justify-between">
                                  <span className="text-stone-600 dark:text-stone-400">{t.customer}:</span>
                                  <span className="font-bold text-stone-900 dark:text-white">
                                    {order.customer_name}
                                  </span>
                                </div>
                              )}
                              {order.notes && (
                                <div className="pt-1.5 border-t border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300 text-xs">
                                  <span className="font-bold text-stone-900 dark:text-white">{t.notes}: </span>
                                  {order.notes}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* LIGHTBOX MODAL FOR RECEIPT SCREENSHOT */}
      {selectedReceiptImage && (
        <div
          onClick={() => setSelectedReceiptImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-2xl w-full rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xl flex flex-col border border-stone-300 dark:border-slate-700"
          >
            <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-restaurant-accent" />
                <h3 className="font-bold text-sm text-stone-900 dark:text-white">
                  {t.receiptProofTitle}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={selectedReceiptImage}
                  download="payment_receipt.jpg"
                  className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-slate-800 transition"
                  title={t.downloadReceipt}
                >
                  <Download size={18} />
                </a>
                <button
                  onClick={() => setSelectedReceiptImage(null)}
                  className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-slate-800 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 flex items-center justify-center bg-black/5 dark:bg-black/50 overflow-auto max-h-[75vh]">
              <img
                src={selectedReceiptImage}
                alt="Receipt full size"
                className="max-h-full max-w-full object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/*
 * ============================================================
 * TIMELINE ITEM COMPONENT (HIGH CONTRAST)
 * ============================================================
 */

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
      className={`flex flex-col justify-between rounded-xl p-3 border transition-all ${
        highlight
          ? 'bg-amber-100/80 border-amber-300 dark:bg-amber-950/60 dark:border-amber-700 text-amber-950 dark:text-amber-200 shadow-sm'
          : 'bg-white dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-stone-800 dark:text-stone-200 shadow-xs'
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-stone-300">
        <span
          className={
            highlight
              ? 'text-amber-700 dark:text-amber-300'
              : 'text-stone-500 dark:text-stone-400'
          }
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>

      <div className="mt-2">
        <p
          className={`text-xs sm:text-sm ${
            highlight
              ? 'font-extrabold text-amber-950 dark:text-amber-200'
              : 'font-bold text-stone-900 dark:text-white'
          }`}
        >
          {time}
        </p>

        {sub && (
          <p className="mt-0.5 text-[11px] font-medium text-stone-600 dark:text-stone-300 truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}