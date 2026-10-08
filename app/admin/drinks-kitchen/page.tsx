'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'
import { playNotificationSound } from '@/lib/audio'
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext'
import {
  Clock,
  RefreshCw,
  CheckCircle,
  Play,
  AlertCircle,
  Coffee,
  Bell,
  Volume2,
  VolumeX,
  Table2,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

type KitchenType = 'food' | 'drinks'

// Existing kitchen = FOOD (everything except categories whose type is "drinks").
const KITCHEN_TYPE: KitchenType = 'drinks'

const ACTIVE_ORDER_STATUSES = ['confirmed', 'preparing']
const ACTIVE_ITEM_STATUSES = ['pending', 'confirmed', 'preparing']

function isDrinkCategory(type: string | null | undefined) {
  const normalized = String(type || '').trim().toLowerCase()
  return normalized === 'drink' || normalized === 'drinks'
}

type OrderItem = {
  id: string
  order_id: string
  menu_item_id: string
  item_name:
    | string
    | {
        en?: string
        am?: string
      }
  unit_price: number
  quantity: number
  subtotal: number
  notes: string | null
  status: string
  category_type?: string
  created_at: string
  updated_at: string
}

type Order = {
  id: string
  order_number: string
  table_id: string | null
  table_session_id: string | null
  status: string
  order_type: string
  waiter_id: string | null
  cashier_id: string | null
  chef_id: string | null
  customer_name: string | null
  customer_phone: string | null
  notes: string | null
  subtotal: number
  discount: number
  tax: number
  total: number
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

type Table = {
  id: string
  table_number: string
  name: string | null
}

export default function KitchenPage() {
  const { isAmharic } = useAdminLanguage()
  const [orders, setOrders] = useState<Order[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [activeView, setActiveView] = useState<'waiting' | 'preparing'>('waiting')
  const [channelConnected, setChannelConnected] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const prevWaitingCount = useRef<number>(-1)

  const loadOrders = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true)
      else if (orders.length === 0) setLoading(true)

      setError('')

      const [ordersResponse, tablesResponse] = await Promise.all([
        fetch('/api/orders', { cache: 'no-store' }),
        fetch('/api/tables', { cache: 'no-store' }),
      ])

      const ordersResult = await ordersResponse.json()
      const tablesResult = await tablesResponse.json()

      if (!ordersResponse.ok || !ordersResult.success) {
        throw new Error(ordersResult.error || 'Failed to load orders')
      }

      if (!tablesResponse.ok || !tablesResult.success) {
        throw new Error(tablesResult.error || 'Failed to load tables')
      }

      const rawOrders: Order[] = ordersResult.data || []

      const relevantOrders = rawOrders
        .filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status))
        .map((order) => {
          const kitchenItems = (order.items || []).filter((item) => {
            const isDrink = isDrinkCategory(item.category_type)

            const belongsToKitchen =
              KITCHEN_TYPE === 'drinks' ? isDrink : !isDrink

            return belongsToKitchen && ACTIVE_ITEM_STATUSES.includes(item.status)
          })

          return { ...order, items: kitchenItems }
        })
        .filter((order) => (order.items || []).length > 0)

      setOrders(relevantOrders)
      setTables(tablesResult.data || [])
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : (isAmharic ? 'የመጠጥ ትዕዛዞችን ማግኘት አልተቻለም' : 'Failed to load drinks orders')
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [orders.length, isAmharic])

  useEffect(() => {
    loadOrders()

    // Realtime channel with unique timestamp to guarantee clean connection
    const channel = supabase
      .channel(`drinks-kitchen-live-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        loadOrders(false)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        loadOrders(false)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChannelConnected(true)
          loadOrders(false)
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setChannelConnected(false)
        }
      })

    // 90-second safety fallback refresh (Realtime WebSockets is primary live source)
    const pollInterval = setInterval(() => {
      loadOrders(false)
    }, 90000)

    // Refresh dynamic data when switching back to tab
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        loadOrders(false)
      }
    }
    window.addEventListener('visibilitychange', handleFocus)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(pollInterval)
      window.removeEventListener('visibilitychange', handleFocus)
      window.removeEventListener('focus', handleFocus)
      supabase.removeChannel(channel)
    }
  }, [loadOrders])

  function getTableName(tableId: string | null) {
    if (!tableId) return isAmharic ? 'ፓኮ / መውሰጃ' : 'Takeaway'

    const table = tables.find((item) => item.id === tableId)
    if (!table) return isAmharic ? 'ጠረጴዛ' : 'Table'

    return table.name || (isAmharic ? `ጠረጴዛ ${table.table_number}` : `Table ${table.table_number}`)
  }

  function getItemName(item: OrderItem) {
    if (typeof item.item_name === 'object' && item.item_name) {
      return isAmharic
        ? (item.item_name.am || item.item_name.en || 'ያልታወቀ መጠጥ')
        : (item.item_name.en || item.item_name.am || 'Unknown Item')
    }
    if (typeof item.item_name === 'string') return item.item_name
    return isAmharic ? 'ያልታወቀ መጠጥ' : 'Unknown Item'
  }

  function getOrderAge(createdAt: string) {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    if (minutes < 1) return isAmharic ? 'አሁን' : 'Just now'
    if (minutes === 1) return isAmharic ? 'ከ1 ደቂቃ በፊት' : '1 min ago'
    return isAmharic ? `ከ${minutes} ደቂቃ በፊት` : `${minutes} mins ago`
  }

  async function updateKitchenStatus(
    orderId: string,
    status: 'preparing' | 'ready'
  ) {
    try {
      setUpdatingOrder(orderId)
      setError('')
      setMessage('')

      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderId,
          action: 'update_kitchen_items',
          kitchen_type: KITCHEN_TYPE,
          status,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update kitchen order')
      }

      if (status === 'preparing') {
        setOrders((current) =>
          current.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  status: 'preparing',
                  items: (order.items || []).map((item) => ({
                    ...item,
                    status: 'preparing',
                  })),
                }
              : order
          )
        )
        setMessage(`${KITCHEN_TYPE === 'drinks' ? 'Drinks' : 'Food'} moved to Preparing.`)
      } else {
        setOrders((current) => current.filter((order) => order.id !== orderId))
        setMessage(
          result.data?.order_status === 'ready'
            ? 'All items are ready. Sent back to Order Manager.'
            : `${KITCHEN_TYPE === 'drinks' ? 'Drinks' : 'Food'} marked Ready. Waiting for the other kitchen if needed.`
        )
      }
    } catch (err) {
      console.error(err)
      setError(
        err instanceof Error ? err.message : 'Failed to update kitchen order'
      )
    } finally {
      setUpdatingOrder(null)
    }
  }

  const waitingOrders = useMemo(
    () => orders.filter((order) => order.items?.some((item) => ['pending', 'confirmed'].includes(item.status))),
    [orders]
  )

  const preparingOrders = useMemo(
    () => orders.filter((order) => order.items?.some((item) => item.status === 'preparing')),
    [orders]
  )

  // Play audio chime when a new waiting drink order arrives
  useEffect(() => {
    if (prevWaitingCount.current >= 0 && waitingOrders.length > prevWaitingCount.current && !loading) {
      if (soundEnabled) {
        playNotificationSound('new_order')
      }
    }
    prevWaitingCount.current = waitingOrders.length
  }, [waitingOrders.length, soundEnabled, loading])

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <Coffee size={44} className="mx-auto mb-3 text-restaurant-accent animate-pulse" />
            <p className="text-gray-500">{isAmharic ? 'መጠጥ ማዘጋጃ በመጫን ላይ...' : 'Loading drinks kitchen...'}</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-restaurant-accent/10 p-3 text-restaurant-accent">
              <Coffee size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-restaurant-text dark:text-white">
                {isAmharic ? 'መጠጥ ማዘጋጃ' : 'Drinks Kitchen'}
              </h1>
              <p className="text-sm text-gray-500">
                {isAmharic ? 'የመጠጥ ትዕዛዞች ማዘጋጃ' : 'Prepare drink orders'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* LIVE CHANNEL STATUS */}
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                channelConnected
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}
              title={channelConnected ? (isAmharic ? 'የቀጥታ መስመር ክፍት ነው' : 'Realtime Channel Connected') : (isAmharic ? 'ራስ-ማመሳሰል ነቅቷል' : 'Auto-Sync Polling Active')}
            >
              <span className={`h-2 w-2 rounded-full ${channelConnected ? 'bg-green-500 animate-ping' : 'bg-amber-500'}`} />
              <span>{channelConnected ? (isAmharic ? 'የቀጥታ መስመር ክፍት' : 'Live Channel Open') : (isAmharic ? 'ራስ-ማመሳሰል ነቅቷል' : 'Auto-Sync Active')}</span>
            </div>

            {/* NOTIFICATION BELL ICON WITH WAITING ORDERS COUNT */}
            <div className="relative inline-flex items-center gap-1.5 rounded-lg border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-restaurant-text dark:text-white shadow-sm">
              <Bell size={16} className={waitingOrders.length > 0 ? 'text-restaurant-accent animate-bounce' : 'text-gray-400'} />
              <span>{waitingOrders.length} {isAmharic ? 'የሚጠብቁ' : 'Waiting'}</span>
              {waitingOrders.length > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {waitingOrders.length}
                </span>
              )}
            </div>

            {/* AUDIO NOTIFICATION TOGGLE */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                soundEnabled
                  ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300'
                  : 'border-gray-200 bg-white text-gray-400 dark:border-slate-800 dark:bg-slate-800'
              }`}
              title={soundEnabled ? (isAmharic ? 'የጥሪ ድምፅ በርቷል' : 'Chime sound is ON') : (isAmharic ? 'የጥሪ ድምፅ ጠፍቷል' : 'Chime sound is MUTED')}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{soundEnabled ? (isAmharic ? 'ድምፅ በርቷል' : 'Chime ON') : (isAmharic ? 'ድምፅ ጠፍቷል' : 'Muted')}</span>
            </button>

            {/* REFRESH / SYNC BUTTON */}
            <button
              onClick={() => loadOrders(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-medium transition hover:border-restaurant-accent disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? (isAmharic ? 'በማመሳሰል ላይ...' : 'Syncing...') : (isAmharic ? 'አድስ' : 'Sync')}</span>
            </button>
          </div>
        </div>

        {/* View Switcher: Waiting vs Preparing */}
        <div className="flex gap-2 border-b dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveView('waiting')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
              activeView === 'waiting'
                ? 'bg-restaurant-accent text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-slate-800 dark:text-gray-300'
            }`}
          >
            <span>{isAmharic ? 'ዝግጅት የሚጠብቁ' : 'Waiting Orders'}</span>
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs">
              {waitingOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveView('preparing')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
              activeView === 'preparing'
                ? 'bg-restaurant-accent text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-slate-800 dark:text-gray-300'
            }`}
          >
            <span>{isAmharic ? 'በዝግጅት ላይ' : 'Preparing'}</span>
            <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs">
              {preparingOrders.length}
            </span>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle size={18} />
            <span>{message}</span>
          </div>
        )}

        {activeView === 'waiting' ? (
          <KitchenSection
            title={isAmharic ? 'ዝግጅት የሚጠብቁ መጠጦች' : 'Waiting Orders'}
            description={isAmharic ? 'ዝግጅት እንዲጀመር የሚጠብቁ የመጠጥ ትዕዛዞች' : 'Drink orders waiting to be prepared'}
            count={waitingOrders.length}
            orders={waitingOrders}
            emptyTitle={isAmharic ? 'ምንም የሚጠብቅ የመጠጥ ትዕዛዝ የለም' : 'No waiting drink orders'}
            emptyDescription={isAmharic ? 'አዳዲስ የመጠጥ ትዕዛዞች ሲገቡ እዚህ ይታያሉ።' : 'New drink orders will appear here automatically.'}
            tableName={getTableName}
            getItemName={getItemName}
            getOrderAge={getOrderAge}
            updatingOrder={updatingOrder}
            actionLabel={isAmharic ? 'ማዘጋጀት ጀምር' : 'Start Preparing'}
            actionIcon={<Play size={18} />}
            onAction={(id) => updateKitchenStatus(id, 'preparing')}
            statusLabel={isAmharic ? 'ይጠብቃል' : 'Waiting'}
            isAmharic={isAmharic}
            waiting
          />
        ) : (
          <KitchenSection
            title={isAmharic ? 'በዝግጅት ላይ ያሉ መጠጦች' : 'Preparing'}
            description={isAmharic ? 'አሁን በመዘጋጀት ላይ ያሉ መጠጦች' : 'Drinks currently being prepared'}
            count={preparingOrders.length}
            orders={preparingOrders}
            emptyTitle={isAmharic ? 'ምንም እየተዘጋጀ ያለ መጠጥ የለም' : 'Nothing is being prepared'}
            emptyDescription={isAmharic ? 'ባርቴንደር መጠጥ ማዘጋጀት ሲጀምር ትዕዛዞች እዚህ ይታያሉ።' : 'Orders will appear here when the bartender starts preparing them.'}
            tableName={getTableName}
            getItemName={getItemName}
            getOrderAge={getOrderAge}
            updatingOrder={updatingOrder}
            actionLabel={isAmharic ? 'ተዘጋጅቷል' : 'Mark Ready'}
            actionIcon={<CheckCircle size={18} />}
            onAction={(id) => updateKitchenStatus(id, 'ready')}
            statusLabel={isAmharic ? 'በዝግጅት ላይ' : 'Preparing'}
            isAmharic={isAmharic}
          />
        )}
      </div>
    </AdminLayout>
  )
}

type KitchenSectionProps = {
  title: string
  description: string
  count: number
  orders: Order[]
  emptyTitle: string
  emptyDescription: string
  tableName: (id: string | null) => string
  getItemName: (item: OrderItem) => string
  getOrderAge: (createdAt: string) => string
  updatingOrder: string | null
  actionLabel: string
  actionIcon: ReactNode
  onAction: (id: string) => void
  statusLabel: string
  isAmharic: boolean
  waiting?: boolean
}

type KitchenTableGroup = {
  tableId: string | null
  tableName: string
  orders: Order[]
  itemsCount: number
}

function KitchenSection({
  title,
  description,
  count,
  orders,
  emptyTitle,
  emptyDescription,
  tableName,
  getItemName,
  getOrderAge,
  updatingOrder,
  actionLabel,
  actionIcon,
  onAction,
  statusLabel,
  isAmharic,
  waiting,
}: KitchenSectionProps) {
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({})

  const toggleTableCollapse = (tableKey: string) => {
    setCollapsedTables((prev) => ({
      ...prev,
      [tableKey]: prev[tableKey] === false ? true : false,
    }))
  }

  const tableGroups = useMemo(() => {
    const map: Record<string, KitchenTableGroup> = {}

    orders.forEach((order) => {
      const key = order.table_id || 'takeaway'
      if (!map[key]) {
        map[key] = {
          tableId: order.table_id,
          tableName: tableName(order.table_id),
          orders: [],
          itemsCount: 0,
        }
      }
      map[key].orders.push(order)
      map[key].itemsCount += (order.items || []).length
    })

    return Object.values(map)
  }, [orders, tableName])

  const handleBatchAction = async (ordersList: Order[]) => {
    for (const order of ordersList) {
      await onAction(order.id)
    }
  }

  return (
    <section className={waiting ? 'mb-10' : ''}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-restaurant-text dark:text-white">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        <span className="rounded-full bg-blue-100 dark:bg-blue-950/80 dark:text-blue-300 px-3 py-1 text-sm font-semibold text-blue-700">
          {count}
        </span>
      </div>

      {orders.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} waiting={waiting} />
      ) : (
        <div className="space-y-4">
          {tableGroups.map((group) => {
            const groupKey = group.tableId || 'takeaway'
            const isCollapsed = collapsedTables[groupKey] !== false
            const isTakeaway = !group.tableId

            return (
              <div
                key={groupKey}
                className="overflow-hidden rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all"
              >
                {/* TABLE ACCORDION HEADER */}
                <div
                  onClick={() => toggleTableCollapse(groupKey)}
                  className="p-4 bg-stone-50/90 dark:bg-slate-800/90 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 dark:border-slate-700/80 transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="p-1 rounded-lg text-stone-500 dark:text-slate-400 hover:text-restaurant-accent hover:bg-stone-200 dark:hover:bg-slate-700 transition"
                    >
                      {isCollapsed ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
                    </button>

                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-restaurant-accent/15 text-restaurant-accent flex items-center justify-center font-bold">
                        {isTakeaway ? <ShoppingBag size={20} /> : <Table2 size={20} />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                            {group.tableName}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-restaurant-accent text-white text-xs font-bold">
                            {group.orders.length} {group.orders.length === 1 ? (isAmharic ? 'ትዕዛዝ' : 'Order') : (isAmharic ? 'ትዕዛዞች' : 'Orders')}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 dark:text-slate-400 font-medium mt-0.5">
                          {group.itemsCount} {isAmharic ? 'መጠጦች total' : 'items total'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleBatchAction(group.orders)}
                      className="px-3.5 py-1.5 rounded-xl bg-restaurant-accent hover:bg-restaurant-accent-dark text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      {actionIcon}
                      <span>
                        {waiting
                          ? (isAmharic ? `ሁሉንም ጀምር (${group.orders.length})` : `Start All (${group.orders.length})`)
                          : (isAmharic ? `ሁሉንም አዘጋጅ (${group.orders.length})` : `Mark All Ready (${group.orders.length})`)}
                      </span>
                    </button>
                  </div>
                </div>

                {/* TABLE ACCORDION BODY (GRID OF ORDERS) */}
                {!isCollapsed && (
                  <div className="p-4 sm:p-5 bg-stone-100/50 dark:bg-slate-950/60 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {group.orders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        getItemName={getItemName}
                        getOrderAge={getOrderAge}
                        updating={updatingOrder === order.id}
                        actionLabel={actionLabel}
                        actionIcon={actionIcon}
                        onAction={() => onAction(order.id)}
                        statusLabel={statusLabel}
                        isAmharic={isAmharic}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

type OrderCardProps = {
  order: Order
  getItemName: (item: OrderItem) => string
  getOrderAge: (createdAt: string) => string
  updating: boolean
  actionLabel: string
  actionIcon: ReactNode
  onAction: () => void
  statusLabel: string
  isAmharic: boolean
}

function OrderCard({
  order,
  getItemName,
  getOrderAge,
  updating,
  actionLabel,
  actionIcon,
  onAction,
  statusLabel,
  isAmharic,
}: OrderCardProps) {
  const orderNumberStr = order.order_number.startsWith('order-') ? order.order_number : `#${order.order_number}`

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 p-4 space-y-3 flex flex-col justify-between transition-all shadow-xs">
      {/* TOP ROW: Order Number & Badges */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 dark:border-slate-700/70 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-stone-700 dark:text-slate-200 bg-stone-100 dark:bg-slate-700/80 border border-stone-200 dark:border-slate-600 px-2 py-0.5 rounded-md">
            {orderNumberStr}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
              statusLabel === 'Preparing' || statusLabel === 'በዝግጅት ላይ'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            {statusLabel}
          </span>
        </div>

        <span className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-slate-400 font-medium">
          <Clock size={12} />
          {getOrderAge(order.created_at)}
        </span>
      </div>

      {/* ITEMS LIST */}
      <div className="space-y-2 flex-1 py-1">
        {(order.items || []).map((item) => (
          <div key={item.id} className="rounded-lg border border-stone-200/80 dark:border-slate-700/70 bg-stone-50/60 dark:bg-slate-900/60 p-2.5">
            <div className="flex items-start gap-2.5">
              <span className="flex-shrink-0 min-w-[26px] h-6 px-1.5 rounded-md bg-amber-100/80 dark:bg-amber-950/70 border border-amber-200/60 dark:border-amber-800/50 flex items-center justify-center text-xs font-bold text-amber-900 dark:text-amber-300">
                {item.quantity}×
              </span>
              <div className="min-w-0">
                <p className="font-medium text-xs sm:text-sm text-stone-900 dark:text-white leading-snug">
                  {getItemName(item)}
                </p>
                {item.notes && (
                  <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded border border-amber-200/60 dark:border-amber-900/60">
                    {isAmharic ? 'ማስታወሻ: ' : 'Note: '}{item.notes}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {order.notes && (
          <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/60">
            <span className="font-bold">{isAmharic ? 'የትዕዛዝ ማስታወሻ: ' : 'Order note: '}</span>
            {order.notes}
          </div>
        )}
      </div>

      {/* ACTION BUTTON */}
      <div className="pt-2 border-t border-stone-200 dark:border-slate-700/80">
        <button
          onClick={onAction}
          disabled={updating}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-restaurant-accent hover:bg-restaurant-accent-dark px-4 py-2.5 text-xs font-bold text-white transition disabled:cursor-wait disabled:opacity-60 shadow-xs"
        >
          {updating ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span>{isAmharic ? 'በማስተካከል ላይ...' : 'Updating...'}</span>
            </>
          ) : (
            <>
              {actionIcon}
              <span>{actionLabel}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function EmptyState({
  title,
  description,
  waiting,
}: {
  title: string
  description: string
  waiting?: boolean
}) {
  return (
    <div className="rounded-xl border border-dashed bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
      {waiting ? (
        <Clock size={40} className="mx-auto text-gray-300" />
      ) : (
        <Coffee size={40} className="mx-auto text-gray-300" />
      )}
      <p className="mt-3 font-semibold text-restaurant-text dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}
    