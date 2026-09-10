'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'
import { playNotificationSound } from '@/lib/audio'
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext'
import {
  ChefHat,
  Clock,
  RefreshCw,
  CheckCircle,
  Play,
  Utensils,
  AlertCircle,
  Bell,
  Volume2,
  VolumeX,
} from 'lucide-react'

type KitchenType = 'food' | 'drinks'

// Existing kitchen = FOOD (everything except categories whose type is "drinks").
const KITCHEN_TYPE: KitchenType = 'food'

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
        err instanceof Error ? err.message : (isAmharic ? 'የማብሰያ ቤት ትዕዛዞችን ማግኘት አልተቻለም' : 'Failed to load kitchen orders')
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
      .channel(`food-kitchen-live-${Date.now()}`)
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
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setChannelConnected(false)
        }
      })

    // Continuous 4-second background auto-sync so the screen NEVER goes stale
    const pollInterval = setInterval(() => {
      loadOrders(false)
    }, 4000)

    return () => {
      clearInterval(pollInterval)
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
        ? (item.item_name.am || item.item_name.en || 'ያልታወቀ ምግብ')
        : (item.item_name.en || item.item_name.am || 'Unknown Item')
    }
    if (typeof item.item_name === 'string') return item.item_name
    return isAmharic ? 'ያልታወቀ ምግብ' : 'Unknown Item'
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

  // Play audio chime when a new waiting order arrives
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
            <ChefHat size={44} className="mx-auto mb-3 text-restaurant-accent animate-pulse" />
            <p className="text-gray-500">{isAmharic ? 'ማብሰያ ቤት በመጫን ላይ...' : 'Loading kitchen...'}</p>
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
              <ChefHat size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-restaurant-text dark:text-white">
                {isAmharic ? 'ማብሰያ ቤት' : 'Kitchen'}
              </h1>
              <p className="text-sm text-gray-500">
                {isAmharic ? 'የምግብ ትዕዛዞች ማዘጋጃ' : 'Prepare food orders'}
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
            title={isAmharic ? 'ዝግጅት የሚጠብቁ ትዕዛዞች' : 'Waiting Orders'}
            description={isAmharic ? 'ማብሰል እንዲጀመር የሚጠብቁ ትዕዛዞች' : 'Orders waiting to be prepared'}
            count={waitingOrders.length}
            orders={waitingOrders}
            emptyTitle={isAmharic ? 'ምንም የሚጠብቅ የምግብ ትዕዛዝ የለም' : 'No waiting food orders'}
            emptyDescription={isAmharic ? 'አዳዲስ ትዕዛዞች ሲገቡ እዚህ ይታያሉ።' : 'New orders will appear here automatically.'}
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
            title={isAmharic ? 'በዝግጅት ላይ ያሉ' : 'Preparing'}
            description={isAmharic ? 'አሁን በማብሰያ ቤት እየተዘጋጁ ያሉ ምግቦች' : 'Food currently being prepared'}
            count={preparingOrders.length}
            orders={preparingOrders}
            emptyTitle={isAmharic ? 'ምንም እየተዘጋጀ ያለ ምግብ የለም' : 'Nothing is being prepared'}
            emptyDescription={isAmharic ? 'አብሳይ ማብሰል ሲጀምር ትዕዛዞች እዚህ ይታያሉ።' : 'Orders will appear here when the food chef starts preparing them.'}
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

function KitchenSection(props: KitchenSectionProps) {
  return (
    <section className={props.waiting ? 'mb-10' : ''}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-restaurant-text dark:text-white">{props.title}</h2>
          <p className="text-sm text-gray-500">{props.description}</p>
        </div>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
          {props.count}
        </span>
      </div>

      {props.orders.length === 0 ? (
        <EmptyState title={props.emptyTitle} description={props.emptyDescription} waiting={props.waiting} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {props.orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              tableName={props.tableName(order.table_id)}
              getItemName={props.getItemName}
              getOrderAge={props.getOrderAge}
              updating={props.updatingOrder === order.id}
              actionLabel={props.actionLabel}
              actionIcon={props.actionIcon}
              onAction={() => props.onAction(order.id)}
              statusLabel={props.statusLabel}
              isAmharic={props.isAmharic}
            />
          ))}
        </div>
      )}
    </section>
  )
}

type OrderCardProps = {
  order: Order
  tableName: string
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
  tableName,
  getItemName,
  getOrderAge,
  updating,
  actionLabel,
  actionIcon,
  onAction,
  statusLabel,
  isAmharic,
}: OrderCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b px-5 py-4 dark:border-slate-700">
        <div>
          <p className="text-lg font-bold text-restaurant-text dark:text-white">
            {order.order_number.startsWith('order-')
              ? order.order_number
              : `#${order.order_number}`}
          </p>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <Utensils size={15} />
            <span>{tableName}</span>
            <span>•</span>
            <Clock size={15} />
            <span>{getOrderAge(order.created_at)}</span>
          </div>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            statusLabel === 'Preparing' || statusLabel === 'በዝግጅት ላይ'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="p-5">
        <div className="space-y-3">
          {(order.items || []).map((item) => (
            <div key={item.id} className="rounded-lg border p-3 dark:border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-restaurant-accent/10 px-2 font-bold text-restaurant-accent">
                    {item.quantity}
                  </span>
                  <div>
                    <p className="font-semibold text-restaurant-text dark:text-white">{getItemName(item)}</p>
                    {item.notes && (
                      <p className="mt-1 text-sm text-orange-600">
                        {isAmharic ? 'ማስታወሻ: ' : 'Note: '}{item.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {order.notes && (
          <div className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
            <span className="font-semibold">{isAmharic ? 'የትዕዛዝ ማስታወሻ: ' : 'Order note: '}</span>
            {order.notes}
          </div>
        )}

        <button
          onClick={onAction}
          disabled={updating}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-restaurant-accent px-4 py-3 font-semibold text-white transition hover:bg-restaurant-accent-dark disabled:cursor-wait disabled:opacity-60"
        >
          {updating ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              {isAmharic ? 'በማስተካከል ላይ...' : 'Updating...'}
            </>
          ) : (
            <>
              {actionIcon}
              {actionLabel}
            </>
          )}
        </button>
      </div>

      <div className="border-t bg-gray-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{isAmharic ? 'ጠቅላላ ዋጋ' : 'Order total'}</span>
          <span className="font-bold">{Number(order.total).toFixed(2)} {isAmharic ? 'ብር' : 'ETB'}</span>
        </div>
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
        <ChefHat size={40} className="mx-auto text-gray-300" />
      )}
      <p className="mt-3 font-semibold text-restaurant-text dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}
