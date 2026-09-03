'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { getAdminAuth } from '@/lib/admin-auth'
import { supabase } from '@/lib/supabase'
import {
  Table2,
  RefreshCw,
  Users,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  User,
  Search,
  Send,
  AlertCircle,
  Utensils,
} from 'lucide-react'

type Table = {
  id: string
  table_number: string
  name: string | null
  capacity: number
  parent_table_id?: string | null
  display_order?: number
  active: boolean
}

type MenuItem = {
  id: string
  categoryId: string
  name: {
    en: string
    am?: string
  }
  description: {
    en: string
    am?: string
  }
  price: number
  currency: string
  image: string | null
  available: boolean
}

type CartItem = {
  menuItemId: string
  name: {
    en: string
    am?: string
  }
  price: number
  quantity: number
  notes: string
}

export default function WaiterPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])

  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])

  const [currentWaiter, setCurrentWaiter] = useState<{
    id: string
    name: string | null
    email: string
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [channelConnected, setChannelConnected] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [orderSuccess, setOrderSuccess] = useState('')

  const [search, setSearch] = useState('')

  // ---------------------------------------------------------
  // LOAD LOGGED-IN WAITER IDENTITY
  // ---------------------------------------------------------
  useEffect(() => {
    const fetchWaiter = async () => {
      try {
        const auth = await getAdminAuth()
        if (auth?.adminUser) {
          setCurrentWaiter({
            id: auth.adminUser.id,
            name: auth.adminUser.name,
            email: auth.adminUser.email,
          })
        }
      } catch (err) {
        console.debug('Failed to get waiter auth info:', err)
      }
    }
    fetchWaiter()
  }, [])

  // ---------------------------------------------------------
  // LOAD TABLES & MENU ITEMS
  // ---------------------------------------------------------
  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent && tables.length === 0) setLoading(true)
      else if (!silent) setRefreshing(true)
      setError('')

      const [tablesResponse, menuResponse] = await Promise.all([
        fetch('/api/tables', { cache: 'no-store' }),
        fetch('/api/menu', { cache: 'no-store' }),
      ])

      const tablesResult = await tablesResponse.json()
      const menuResult = await menuResponse.json()

      if (tablesResult.success && Array.isArray(tablesResult.data)) {
        setTables(tablesResult.data)
      }

      if (menuResult.success && Array.isArray(menuResult.data)) {
        setMenuItems(menuResult.data)
      }
    } catch (err) {
      if (!silent) {
        setError('Failed to load tables and menu. Please refresh.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tables.length])

  // Persistent live channel subscription for instant table split/merge updates
  useEffect(() => {
    loadData()

    const channel = supabase
      .channel(`waiter-live-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        () => {
          loadData(true)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          loadData(true)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setChannelConnected(true)
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR')
          setChannelConnected(false)
      })

    const interval = setInterval(() => {
      loadData(true)
    }, 4000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [loadData])

  // All selectable tables: when Table 2 is split into 2A & 2B, 2A & 2B appear immediately
  const selectableTables = useMemo(() => {
    const parentIdsWithActiveChildren = new Set(
      tables
        .filter((t) => t.active && t.parent_table_id)
        .map((t) => t.parent_table_id as string)
    )

    return tables
      .filter((table) => table.active)
      .filter((table) => {
        if (parentIdsWithActiveChildren.has(table.id)) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        return (
          (a.display_order || 0) - (b.display_order || 0) ||
          a.table_number.localeCompare(b.table_number, undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        )
      })
  }, [tables])

  // Clear selected table if it was merged or deactivated
  useEffect(() => {
    if (
      selectedTable &&
      !selectableTables.some((t) => t.id === selectedTable.id)
    ) {
      setSelectedTable(null)
    }
  }, [selectableTables, selectedTable])

  // Clear success notification
  useEffect(() => {
    if (!orderSuccess) return
    const timer = setTimeout(() => setOrderSuccess(''), 5000)
    return () => clearTimeout(timer)
  }, [orderSuccess])

  // ---------------------------------------------------------
  // CART OPERATIONS
  // ---------------------------------------------------------
  const filteredMenuItems = useMemo(() => {
    const searchValue = search.trim().toLowerCase()

    if (!searchValue) {
      return menuItems.filter((item) => item.available)
    }

    return menuItems.filter((item) => {
      if (!item.available) return false

      return (
        item.name.en.toLowerCase().includes(searchValue) ||
        item.name.am?.toLowerCase().includes(searchValue)
      )
    })
  }, [menuItems, search])

  function addToCart(item: MenuItem) {
    if (!selectedTable) {
      setError('Please tap a dining table first above before adding items.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setError('')
    setCart((currentCart) => {
      const existing = currentCart.find(
        (cartItem) => cartItem.menuItemId === item.id
      )

      if (existing) {
        return currentCart.map((cartItem) =>
          cartItem.menuItemId === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      }

      return [
        ...currentCart,
        {
          menuItemId: item.id,
          name: item.name,
          price: Number(item.price),
          quantity: 1,
          notes: '',
        },
      ]
    })
  }

  function increaseQuantity(menuItemId: string) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.menuItemId === menuItemId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    )
  }

  function decreaseQuantity(menuItemId: string) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.menuItemId === menuItemId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  function removeFromCart(menuItemId: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.menuItemId !== menuItemId)
    )
  }

  function updateNotes(menuItemId: string, notes: string) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.menuItemId === menuItemId ? { ...item, notes } : item
      )
    )
  }

  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  )

  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0)

  // ---------------------------------------------------------
  // SUBMIT ORDER WITH WAITER IDENTITY
  // ---------------------------------------------------------
  async function submitOrder() {
    if (!selectedTable) {
      setError('Please select a dining table first.')
      return
    }

    if (cart.length === 0) {
      setError('Please add at least one item to the cart.')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      const waiterName = currentWaiter?.name || currentWaiter?.email || 'Waiter'

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: selectedTable.id,
          order_type: 'dine_in',
          waiter_id: currentWaiter?.id || null,
          waiter_name: waiterName,
          waiter_email: currentWaiter?.email || null,
          items: cart.map((item) => ({
            menu_item_id: item.menuItemId,
            quantity: item.quantity,
            notes: item.notes || null,
          })),
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create order')
      }

      setOrderSuccess(
        `Order ${result.data.order_number} placed successfully for Table ${selectedTable.table_number}!`
      )

      setCart([])
      loadData(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to submit order'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <Utensils className="mx-auto mb-3 h-8 w-8 text-restaurant-accent animate-spin" />
            <p className="text-xs text-gray-500">Loading mobile waiter screen...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="text-restaurant-text dark:text-white space-y-6 max-w-5xl mx-auto pb-24">
        {/* ===================================================== */}
        {/* HEADER: TITLE, WAITER IDENTITY & LIVE BADGE           */}
        {/* ===================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-cream-200 dark:border-slate-800 shadow-sm">
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold text-restaurant-text dark:text-white flex items-center gap-2">
              <Utensils className="text-restaurant-accent" size={22} />
              Waiter Order
            </h1>

            {/* WAITER IDENTITY BADGE */}
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-950/60 px-2.5 py-0.5 font-bold text-purple-700 dark:text-purple-300">
                <User size={12} />
                Server: {currentWaiter?.name || currentWaiter?.email || 'Logged In'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {/* LIVE CHANNEL BADGE */}
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                channelConnected
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  channelConnected ? 'bg-green-500 animate-ping' : 'bg-amber-500'
                }`}
              />
              <span>{channelConnected ? 'Live' : 'Syncing'}</span>
            </div>

            {/* REFRESH */}
            <button
              onClick={() => loadData(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 rounded-lg border border-cream-200 dark:border-slate-800 bg-cream-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-cream-100 transition"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-3.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {orderSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/60 p-3.5 text-xs text-green-700 dark:text-green-300 animate-in fade-in">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{orderSuccess}</span>
          </div>
        )}

        {/* ===================================================== */}
        {/* STEP 1: TABLES & SPLIT SECTIONS (COMPACT MOBILE GRID) */}
        {/* ===================================================== */}
        <section className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-cream-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold flex items-center gap-1.5 text-restaurant-text dark:text-white uppercase tracking-wider">
              <Table2 size={16} className="text-restaurant-accent" />
              1. Tap Dining Table:
            </h2>
            <span className="text-[11px] text-gray-500">
              {selectableTables.length} tables
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
            {selectableTables.map((table) => {
              const isSelected = selectedTable?.id === table.id

              return (
                <button
                  key={table.id}
                  onClick={() => {
                    setSelectedTable(table)
                    setError('')
                  }}
                  className={`rounded-xl border-2 p-2.5 text-center transition-all relative flex flex-col items-center justify-center ${
                    isSelected
                      ? 'border-restaurant-accent bg-restaurant-accent/15 shadow-md ring-2 ring-restaurant-accent/30 dark:bg-restaurant-accent/20'
                      : 'border-cream-200 bg-cream-50/50 hover:border-restaurant-accent/50 dark:border-slate-800 dark:bg-slate-800/60 shadow-sm'
                  }`}
                >
                  <div className="text-base font-extrabold text-restaurant-text dark:text-white">
                    {table.table_number}
                  </div>

                  <div className="text-[10px] text-gray-500 flex items-center gap-0.5 mt-0.5">
                    <Users size={10} />
                    <span>{table.capacity}p</span>
                  </div>

                  {table.parent_table_id && (
                    <span className="mt-1 rounded bg-blue-100 dark:bg-blue-950 px-1 py-0.2 text-[8px] font-bold text-blue-700 dark:text-blue-300">
                      Split
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* ===================================================== */}
        {/* STEP 2: CART / CURRENT ORDER (PLACED BELOW TABLES!)    */}
        {/* ===================================================== */}
        <section
          id="cart-section"
          className={`rounded-2xl border transition-all p-4 shadow-sm ${
            selectedTable
              ? 'bg-white dark:bg-slate-900 border-restaurant-accent/40 ring-1 ring-restaurant-accent/20'
              : 'bg-cream-50/70 dark:bg-slate-900/40 border-dashed border-cream-300 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-cream-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-restaurant-accent text-white font-bold">
                <ShoppingCart size={16} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-restaurant-text dark:text-white">
                  2. Current Order
                </h2>
                {selectedTable ? (
                  <p className="text-[11px] font-semibold text-restaurant-accent">
                    Table {selectedTable.table_number}{' '}
                    {selectedTable.name ? `(${selectedTable.name})` : ''} · Seats {selectedTable.capacity}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-400">
                    No table selected yet
                  </p>
                )}
              </div>
            </div>

            {selectedTable && (
              <button
                onClick={() => setSelectedTable(null)}
                className="text-[11px] text-gray-500 hover:text-red-500 underline"
              >
                Clear Table
              </button>
            )}
          </div>

          {/* CART BODY */}
          {!selectedTable ? (
            <div className="py-6 text-center text-xs text-gray-400">
              Please tap a table above to begin taking an order.
            </div>
          ) : cart.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
              <ShoppingCart size={28} className="mx-auto mb-2 text-gray-300 dark:text-gray-700" />
              Table <strong>{selectedTable.table_number}</strong> is active. Tap food or drinks below to add items.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {/* CART ITEMS LIST */}
              <div className="divide-y divide-cream-100 dark:divide-slate-800/80 max-h-72 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="py-2.5 flex flex-col gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-restaurant-text dark:text-white truncate">
                          {item.name.en}
                        </div>
                        {item.name.am && (
                          <div className="text-[10px] text-gray-400 truncate">
                            {item.name.am}
                          </div>
                        )}
                        <div className="text-xs font-semibold text-restaurant-accent mt-0.5">
                          ${(item.price * item.quantity).toFixed(2)}
                          <span className="text-[10px] text-gray-400 font-normal ml-1">
                            (${item.price.toFixed(2)} each)
                          </span>
                        </div>
                      </div>

                      {/* QUANTITY STEPPER */}
                      <div className="flex items-center gap-1 bg-cream-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                          onClick={() => decreaseQuantity(item.menuItemId)}
                          className="p-1 rounded bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-6 text-center text-xs font-bold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => increaseQuantity(item.menuItemId)}
                          className="p-1 rounded bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.menuItemId)}
                          className="p-1 ml-1 text-red-500 hover:text-red-700"
                          title="Remove"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* ITEM NOTES INPUT */}
                    <input
                      type="text"
                      placeholder="Special instructions (e.g. no spice, extra sauce)..."
                      value={item.notes}
                      onChange={(e) => updateNotes(item.menuItemId, e.target.value)}
                      className="w-full rounded-lg border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/40 px-2.5 py-1 text-[11px] outline-none focus:border-restaurant-accent"
                    />
                  </div>
                ))}
              </div>

              {/* CART TOTAL & SUBMIT BUTTON */}
              <div className="pt-3 border-t border-cream-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                  <span className="text-xs text-gray-500">
                    Total ({totalQuantity} items):
                  </span>
                  <span className="text-lg font-bold text-restaurant-accent">
                    ${subtotal.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={submitOrder}
                  disabled={submitting || cart.length === 0}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-restaurant-accent px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
                >
                  <Send size={15} />
                  <span>
                    {submitting
                      ? 'Submitting to Kitchen...'
                      : `Submit Order to Kitchen ($${subtotal.toFixed(2)})`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ===================================================== */}
        {/* STEP 3: FOOD & DRINKS MENU CATALOG (BELOW CART)       */}
        {/* ===================================================== */}
        <section className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-cream-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-sm font-bold flex items-center gap-1.5 text-restaurant-text dark:text-white uppercase tracking-wider">
              <Utensils size={16} className="text-restaurant-accent" />
              3. Menu Catalog (Tap to Add):
            </h2>

            {/* SEARCH */}
            <div className="relative w-full sm:w-72">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search food or drinks..."
                className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/50 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-restaurant-accent"
              />
            </div>
          </div>

          {/* MENU ITEMS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredMenuItems.map((item) => (
              <div
                key={item.id}
                onClick={() => addToCart(item)}
                className="group flex flex-col justify-between rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/30 dark:bg-slate-800/30 overflow-hidden hover:border-restaurant-accent hover:shadow-md transition cursor-pointer active:scale-95"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name.en}
                    className="w-full h-24 sm:h-28 object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-24 sm:h-28 bg-cream-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 text-xs">
                    <Utensils size={24} className="opacity-40" />
                  </div>
                )}

                <div className="p-2.5 flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="font-bold text-xs text-restaurant-text dark:text-white line-clamp-1">
                      {item.name.en}
                    </h3>
                    {item.name.am && (
                      <p className="text-[10px] text-gray-400 truncate">
                        {item.name.am}
                      </p>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-cream-100 dark:border-slate-800">
                    <span className="text-xs font-extrabold text-restaurant-accent">
                      ${Number(item.price).toFixed(2)}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg bg-restaurant-accent/15 dark:bg-restaurant-accent/25 p-1 text-restaurant-accent hover:bg-restaurant-accent hover:text-white transition font-bold text-xs"
                      title="Add to order"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===================================================== */}
        {/* MOBILE STICKY FLOATING BOTTOM BAR                     */}
        {/* ===================================================== */}
        {selectedTable && cart.length > 0 && (
          <div className="fixed bottom-3 left-3 right-3 sm:hidden z-30 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between rounded-2xl bg-restaurant-text text-white p-3 shadow-2xl border border-restaurant-accent/30 backdrop-blur-md bg-opacity-95">
              <div>
                <div className="text-[11px] text-gray-300">
                  Table <span className="font-bold text-white">{selectedTable.table_number}</span> · {totalQuantity} items
                </div>
                <div className="text-sm font-extrabold text-restaurant-accent">
                  ${subtotal.toFixed(2)}
                </div>
              </div>

              <button
                onClick={submitOrder}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-restaurant-accent px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
              >
                <Send size={13} />
                <span>{submitting ? 'Sending...' : 'Send Order'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}