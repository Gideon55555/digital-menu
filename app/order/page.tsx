'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { getAdminAuth, normalizeAdminRole } from '@/lib/admin-auth'
import { MenuItem, MenuCategory } from '@/lib/types'
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext'
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Utensils,
  CheckCircle,
} from 'lucide-react'

type Table = {
  id: string
  table_number: string
  name: string | null
  capacity: number
  parent_table_id: string | null
  status: 'available' | 'occupied' | 'reserved' | 'inactive'
  display_order: number
  active: boolean
}

type TableSession = {
  id: string
  table_id: string
  status: 'active' | 'closed'
}

type CartItem = {
  menuItem: MenuItem
  quantity: number
  notes: string
}

export default function OrderPage() {
  const { isAmharic } = useAdminLanguage()

  const [tables, setTables] = useState<Table[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [sessions, setSessions] = useState<TableSession[]>([])

  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [activeSession, setActiveSession] =
    useState<TableSession | null>(null)

  const [cart, setCart] = useState<CartItem[]>([])

  const [selectedCategory, setSelectedCategory] = useState('all')
  const [search, setSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [openingSession, setOpeningSession] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // --------------------------------------------------
  // Initial load
  // --------------------------------------------------

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError('')

      const [
        tablesResponse,
        menuResponse,
        categoriesResponse,
        sessionsResponse,
      ] = await Promise.all([
        fetch('/api/tables'),
        fetch('/api/menu'),
        fetch('/api/categories'),
        fetch('/api/table-sessions'),
      ])

      const tablesResult = await tablesResponse.json()
      const menuResult = await menuResponse.json()
      const categoriesResult = await categoriesResponse.json()
      const sessionsResult = await sessionsResponse.json()

      if (!tablesResult.success) {
        throw new Error(
          tablesResult.error || 'Failed to load tables'
        )
      }

      if (!menuResult.success) {
        throw new Error(
          menuResult.error || 'Failed to load menu items'
        )
      }

      if (!categoriesResult.success) {
        throw new Error(
          categoriesResult.error ||
            'Failed to load categories'
        )
      }

      if (!sessionsResult.success) {
        throw new Error(
          sessionsResult.error ||
            'Failed to load table sessions'
        )
      }

      setTables(
        (tablesResult.data || []).filter(
          (table: Table) => table.active
        )
      )

      setMenuItems(menuResult.data || [])

      setCategories(
        (categoriesResult.data || []).filter(
          (category: MenuCategory) => category.visible
        )
      )

      setSessions(
        (sessionsResult.data || []).filter(
          (session: TableSession) =>
            session.status === 'active'
        )
      )
    } catch (loadError) {
      console.error(loadError)

      setError(
        loadError instanceof Error
          ? loadError.message
          : isAmharic
          ? 'መረጃዎችን ማምጣት አልተቻለም'
          : 'Failed to load order page data.'
      )
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------
  // Table selection
  // --------------------------------------------------

  async function handleSelectTable(table: Table) {
    try {
      setSelectedTable(table)
      setError('')
      setMessage('')

      const currentSession = sessions.find(
        (session) => session.table_id === table.id
      )

      if (currentSession) {
        setActiveSession(currentSession)
        return
      }

      setOpeningSession(true)

      const response = await fetch('/api/table-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_id: table.id,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || (isAmharic ? 'የጠረጴዛ ክፍለ-ጊዜ መክፈት አልተቻለም' : 'Failed to create table session')
        )
      }

      const newSession: TableSession = result.data

      setSessions((previous) => [
        ...previous.filter(
          (session) => session.id !== newSession.id
        ),
        newSession,
      ])

      setActiveSession(newSession)
    } catch (sessionError) {
      console.error(sessionError)

      setError(
        sessionError instanceof Error
          ? sessionError.message
          : isAmharic
          ? 'ጠረጴዛውን ማዘጋጀት አልተቻለም'
          : 'Failed to prepare table session.'
      )
    } finally {
      setOpeningSession(false)
    }
  }

  // --------------------------------------------------
  // Filtering
  // --------------------------------------------------

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        item.categoryId === selectedCategory

      const nameMatch =
        item.name.en
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        Boolean(
          item.name.am
            ?.toLowerCase()
            .includes(search.toLowerCase())
        )

      const descriptionMatch =
        item.description.en
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        Boolean(
          item.description.am
            ?.toLowerCase()
            .includes(search.toLowerCase())
        )

      return (
        matchesCategory &&
        (nameMatch || descriptionMatch) &&
        item.available
      )
    })
  }, [menuItems, selectedCategory, search])

  const selectedItemIds = useMemo(() => {
    return new Set(cart.map((item) => item.menuItem.id))
  }, [cart])

  // --------------------------------------------------
  // Cart management
  // --------------------------------------------------

  function addToCart(item: MenuItem) {
    if (!selectedTable) {
      setError(isAmharic ? 'እባክዎ መጀመሪያ ጠረጴዛ ይምረጡ።' : 'Please select a table before adding items.')
      return
    }

    if (!activeSession) {
      setError(
        isAmharic
          ? 'ጠረጴዛው ገና እየተዘጋጀ ነው። እባክዎ ትንሽ ይጠብቁ።'
          : 'The table session is not ready yet. Please wait a moment.'
      )
      return
    }

    setError('')

    setCart((previous) => {
      const existing = previous.find(
        (cartItem) => cartItem.menuItem.id === item.id
      )

      if (existing) {
        return previous.map((cartItem) =>
          cartItem.menuItem.id === item.id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + 1,
              }
            : cartItem
        )
      }

      return [
        ...previous,
        {
          menuItem: item,
          quantity: 1,
          notes: '',
        },
      ]
    })
  }

  function decreaseQuantity(itemId: string) {
    setCart((previous) =>
      previous
        .map((cartItem) =>
          cartItem.menuItem.id === itemId
            ? {
                ...cartItem,
                quantity: cartItem.quantity - 1,
              }
            : cartItem
        )
        .filter(
          (cartItem) => cartItem.quantity > 0
        )
    )
  }

  function removeFromCart(itemId: string) {
    setCart((previous) =>
      previous.filter(
        (cartItem) =>
          cartItem.menuItem.id !== itemId
      )
    )
  }

  function updateNotes(
    itemId: string,
    notes: string
  ) {
    setCart((previous) =>
      previous.map((cartItem) =>
        cartItem.menuItem.id === itemId
          ? {
              ...cartItem,
              notes,
            }
          : cartItem
      )
    )
  }

  const subtotal = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.menuItem.price) *
        item.quantity,
    0
  )

  // --------------------------------------------------
  // Submit order
  // --------------------------------------------------

  async function submitOrder() {
    if (!selectedTable) {
      setError(isAmharic ? 'እባክዎ ጠረጴዛ ይምረጡ።' : 'Please select a table.')
      return
    }

    if (!activeSession) {
      setError(
        isAmharic
          ? 'ጠረጴዛው ገና እየተዘጋጀ ነው። እባክዎ ትንሽ ይጠብቁ።'
          : 'The table is still being prepared. Please wait a moment.'
      )
      return
    }

    if (cart.length === 0) {
      setError(isAmharic ? 'እባክዎ ቢያንስ አንድ ምግብ ይምረጡ።' : 'Please add at least one item.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setMessage('')

      const auth = await getAdminAuth()
      const role = auth ? normalizeAdminRole(auth.adminUser.role) : 'waiter'

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_id: selectedTable.id,
          table_session_id: activeSession.id,
          order_type: 'dine_in',
          creator_role: role,
          waiter_name: auth?.adminUser?.name || null,
          waiter_email: auth?.adminUser?.email || null,
          items: cart.map((item) => ({
            menu_item_id: item.menuItem.id,
            quantity: item.quantity,
            unit_price: item.menuItem.price,
            notes: item.notes || null,
          })),
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || (isAmharic ? 'ትዕዛዝ መላክ አልተቻለም' : 'Failed to submit order')
        )
      }

      setMessage(
        isAmharic
          ? `ትዕዛዝ #${result.data.order_number} በተሳካ ሁኔታ ተልኳል!`
          : `Order #${result.data.order_number} submitted successfully!`
      )

      setCart([])
      await loadData()
    } catch (submitError) {
      console.error(submitError)

      setError(
        submitError instanceof Error
          ? submitError.message
          : isAmharic
          ? 'ትዕዛዝ መላክ አልተቻለም።'
          : 'Failed to submit order.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-gray-500 dark:text-gray-400">
            {isAmharic ? 'የትዕዛዝ ተርሚናል በመጫን ላይ...' : 'Loading order terminal...'}
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cream-200 dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-serif font-bold text-restaurant-text dark:text-white">
              {isAmharic ? 'ትዕዛዝ መውሰጃ' : 'Take Order'}
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isAmharic
                ? 'ጠረጴዛ ይምረጡ እና የታዘዙ ምግቦችን ያክሉ'
                : 'Select a table and add menu items'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm bg-cream-100 dark:bg-slate-800 px-3.5 py-2 rounded-xl text-restaurant-text dark:text-white">
            <ShoppingCart size={20} className="text-restaurant-accent" />

            <span className="font-semibold">
              {cart.reduce(
                (total, item) =>
                  total + item.quantity,
                0
              )}{' '}
              {isAmharic ? 'እቃዎች' : 'items'}
            </span>
          </div>

        </div>

      <main className="p-2 sm:p-4">

        {/* Messages */}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900/60 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/40 dark:border-green-900/60 px-4 py-3 text-sm text-green-700 dark:text-green-300">
            {message}
          </div>
        )}

        {/* Table Selection */}

        <section className="mb-8">

          <div className="mb-4 flex items-center gap-2">
            <Utensils size={20} className="text-restaurant-accent" />

            <h2 className="text-xl font-semibold text-restaurant-text dark:text-white">
              {isAmharic ? 'ጠረጴዛ ይምረጡ' : 'Select Table'}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">

            {tables.map((table) => {
              const isSelected =
                selectedTable?.id === table.id

              const hasSession =
                sessions.some(
                  (session) =>
                    session.table_id === table.id
                )

              const isOpeningThisTable =
                openingSession &&
                selectedTable?.id === table.id

              return (
                <button
                  key={table.id}
                  onClick={() =>
                    handleSelectTable(table)
                  }
                  disabled={openingSession}
                  className={`rounded-xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-restaurant-accent bg-restaurant-accent/10 ring-2 ring-restaurant-accent/30 dark:bg-restaurant-accent/20'
                      : 'bg-white hover:border-restaurant-accent dark:bg-slate-900 dark:border-slate-800'
                  } ${
                    openingSession
                      ? 'cursor-wait opacity-70'
                      : ''
                  }`}
                >

                  <div className="flex items-center justify-between">

                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                      {table.name ||
                        (isAmharic ? `ጠረጴዛ ${table.table_number}` : `Table ${table.table_number}`)}
                    </span>

                    {hasSession && (
                      <span className="h-3 w-3 rounded-full bg-rose-500 shadow-xs" title="Occupied" />
                    )}

                  </div>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {isAmharic ? `መቀመጫ: ${table.capacity}` : `Seats ${table.capacity}`}
                  </p>

                  <p className="mt-2 text-xs font-semibold">

                    {isOpeningThisTable
                      ? isAmharic ? 'በዝግጅት ላይ...' : 'Preparing...'
                      : hasSession
                        ? <span className="text-rose-600 dark:text-rose-400">{isAmharic ? 'የተያዘ' : 'Occupied'}</span>
                        : table.status === 'available'
                          ? <span className="text-emerald-600 dark:text-emerald-400">{isAmharic ? 'ነፃ' : 'Available'}</span>
                          : table.status}

                  </p>

                </button>
              )
            })}

          </div>

          {/* Selected table information */}

          {selectedTable && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-cream-200 dark:border-slate-800 bg-white p-4 dark:bg-slate-900 shadow-xs">

              <div>

                <p className="font-bold text-gray-900 dark:text-white">
                  {selectedTable.name ||
                    (isAmharic ? `ጠረጴዛ ${selectedTable.table_number}` : `Table ${selectedTable.table_number}`)}
                </p>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {isAmharic ? `የመቀመጫ ብዛት፡ ${selectedTable.capacity}` : `Capacity: ${selectedTable.capacity} seats`}
                </p>

              </div>

              <div className="flex-1" />

              {openingSession ? (

                <span className="flex items-center gap-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 px-4 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                  {isAmharic ? 'ጠረጴዛው በመዘጋጀት ላይ...' : 'Preparing table...'}
                </span>

              ) : activeSession ? (

                <span className="flex items-center gap-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 px-4 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle size={16} />
                  {isAmharic ? 'ጠረጴዛው ለትዕዛዝ ዝግጁ ነው' : 'Table Ready for Order'}
                </span>

              ) : (

                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {isAmharic ? 'ክፍት የጠረጴዛ ክፍለ-ጊዜ የለም' : 'Table session unavailable'}
                </span>

              )}

            </div>
          )}

        </section>

        {/* Cart */}

        <section className="mb-8 rounded-2xl border border-cream-200 dark:border-slate-800 bg-white p-5 shadow-sm dark:bg-slate-900">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

            <div>

              <div className="flex items-center gap-2">
                <ShoppingCart size={20} className="text-restaurant-accent" />

                <h2 className="text-xl font-bold text-restaurant-text dark:text-white">
                  {isAmharic ? 'የአሁኑ ትዕዛዝ' : 'Current Order'}
                </h2>

              </div>

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {isAmharic
                  ? `${cart.length} የተመረጡ ምግቦች`
                  : `${cart.length} item${cart.length === 1 ? '' : 's'} selected`}
              </p>

              {selectedTable && (
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  {isAmharic ? 'ጠረጴዛ፡ ' : 'Table: '}
                  <span className="font-bold text-restaurant-accent">
                    {selectedTable.name || (isAmharic ? `ጠረጴዛ ${selectedTable.table_number}` : `Table ${selectedTable.table_number}`)}
                  </span>
                </p>
              )}

            </div>

            <div className="text-right">

              <p className="text-xs text-gray-500 dark:text-gray-400">{isAmharic ? 'ንዑስ ድምር' : 'Subtotal'}</p>

              <p className="text-2xl font-extrabold text-restaurant-accent">
                {subtotal.toFixed(2)} ETB
              </p>

            </div>

          </div>

          <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-cream-100 dark:border-slate-800 p-3">

            {cart.length === 0 ? (

              <div className="py-8 text-center text-xs text-gray-400">
                {isAmharic
                  ? 'ትዕዛዝ ለመጀመር ከታች ካለው ሜኑ ምግቦችን ይምረጡ።'
                  : 'Select items from the menu below to build the order.'}
              </div>

            ) : (

              <div className="space-y-3">

                {cart.map((item) => (

                  <div
                    key={item.menuItem.id}
                    className="rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/40 p-3"
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div>

                        <p className="font-semibold text-gray-900 dark:text-white text-sm">
                          {isAmharic && item.menuItem.name.am
                            ? item.menuItem.name.am
                            : item.menuItem.name.en}
                        </p>

                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item.menuItem.price} {item.menuItem.currency}
                        </p>

                      </div>

                      <button
                        onClick={() => removeFromCart(item.menuItem.id)}
                        className="text-gray-400 hover:text-rose-500 transition"
                      >
                        <X size={18} />
                      </button>

                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">

                      <div className="flex items-center rounded-lg border border-cream-300 dark:border-slate-700 bg-white dark:bg-slate-800">

                        <button
                          onClick={() => decreaseQuantity(item.menuItem.id)}
                          className="p-1.5 hover:bg-cream-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200"
                        >
                          <Minus size={14} />
                        </button>

                        <span className="min-w-8 text-center font-bold text-xs text-gray-900 dark:text-white">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() => addToCart(item.menuItem)}
                          className="p-1.5 hover:bg-cream-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200"
                        >
                          <Plus size={14} />
                        </button>

                      </div>

                      <span className="font-bold text-sm text-restaurant-accent">
                        {(Number(item.menuItem.price) * item.quantity).toFixed(2)} {item.menuItem.currency}
                      </span>

                    </div>

                    <input
                      value={item.notes}
                      onChange={(e) => updateNotes(item.menuItem.id, e.target.value)}
                      placeholder={isAmharic ? 'ልዩ ማስታወሻ (ምሳሌ፡ ጨው እንዳይበዛ)...' : 'Item note (e.g. less spicy)...'}
                      className="mt-3 w-full rounded-lg border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-gray-900 dark:text-white outline-none focus:border-restaurant-accent"
                    />

                  </div>

                ))}

              </div>

            )}

          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div className="text-xs text-gray-400">
              {isAmharic
                ? 'ትዕዛዙን በቀላሉ ለመከታተል ቅርጫቱ ከላይ ይቀመጣል።'
                : 'The cart stays on top so the order is easy to review.'}
            </div>

            <button
              onClick={submitOrder}
              disabled={
                submitting ||
                cart.length === 0 ||
                !activeSession ||
                openingSession
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-restaurant-accent px-6 py-3 font-bold text-sm text-white shadow-sm hover:bg-restaurant-accent-dark disabled:cursor-not-allowed disabled:opacity-50 transition"
            >

              {submitting
                ? isAmharic ? 'በመላክ ላይ...' : 'Submitting...'
                : openingSession
                  ? isAmharic ? 'ጠረጴዛው በመዘጋጀት ላይ...' : 'Preparing Table...'
                  : isAmharic ? 'ትዕዛዙን ላክ' : 'Submit Order'}

            </button>

          </div>

        </section>

        {/* Menu */}

        <section>

            <div className="mb-4">
              <h2 className="text-xl font-bold text-restaurant-text dark:text-white">
                {isAmharic ? 'የምግብና መጠጥ ዝርዝር' : 'Menu Items'}
              </h2>
            </div>

            {/* Search */}

            <div className="relative mb-4">

              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder={isAmharic ? 'ምግብ ወይም መጠጥ ፈልግ...' : 'Search menu...'}
                className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-4 text-xs sm:text-sm text-gray-900 dark:text-white outline-none focus:border-restaurant-accent transition"
              />

            </div>

            {/* Categories */}

            <div className="mb-5 flex gap-2 overflow-x-auto pb-2">

              <button
                onClick={() =>
                  setSelectedCategory('all')
                }
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition ${
                  selectedCategory === 'all'
                    ? 'bg-restaurant-accent text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border border-cream-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-cream-100 dark:hover:bg-slate-800'
                }`}
              >
                {isAmharic ? 'ሁሉም' : 'All'}
              </button>

              {categories.map((category) => (

                <button
                  key={category.id}
                  onClick={() =>
                    setSelectedCategory(
                      category.id
                    )
                  }
                  className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition ${
                    selectedCategory ===
                    category.id
                      ? 'bg-restaurant-accent text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border border-cream-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-cream-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {isAmharic && category.name.am ? category.name.am : category.name.en}
                </button>

              ))}

            </div>

            {/* Menu Grid */}

            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">

              {filteredItems.map((item) => (

                <button
                  key={item.id}
                  onClick={() =>
                    addToCart(item)
                  }
                  disabled={
                    !selectedTable ||
                    !activeSession ||
                    openingSession
                  }
                  className={`group overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 text-left shadow-xs transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 ${selectedItemIds.has(item.id) ? 'border-restaurant-accent ring-2 ring-restaurant-accent/30' : 'border-cream-200 dark:border-slate-800'}`}
                >

                  <div className="aspect-square overflow-hidden bg-cream-100 dark:bg-slate-800">

                    {item.image ? (

                      <Image
                        src={item.image}
                        alt={item.name.en}
                        width={400}
                        height={400}
                        className="h-full w-full object-cover transition group-hover:scale-105 duration-300"
                      />

                    ) : (

                      <div className="flex h-full items-center justify-center text-gray-400">
                        <Utensils size={32} className="opacity-20" />
                      </div>

                    )}

                  </div>

                  <div className="p-3">

                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                      {isAmharic && item.name.am ? item.name.am : item.name.en}
                    </h3>

                    {item.name.am && !isAmharic && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {item.name.am}
                      </p>
                    )}

                    <div className="mt-2.5 flex items-center justify-between">

                      <span className="font-bold text-sm text-restaurant-accent">
                        {item.price}{' '}
                        {item.currency}
                      </span>

                      {selectedItemIds.has(item.id) ? (
                        <span className="rounded-full bg-restaurant-accent p-1.5 text-white">
                          <CheckCircle size={14} />
                        </span>
                      ) : (
                        <span className="rounded-full bg-cream-200 dark:bg-slate-800 text-gray-700 dark:text-gray-200 p-1.5 group-hover:bg-restaurant-accent group-hover:text-white transition">
                          <Plus size={14} />
                        </span>
                      )}

                    </div>

                  </div>

                </button>

              ))}

            </div>

            {filteredItems.length === 0 && (

              <div className="rounded-2xl border border-dashed border-cream-300 dark:border-slate-800 p-10 text-center">

                <p className="font-semibold text-sm text-gray-700 dark:text-gray-200">
                  {isAmharic ? 'ምንም ምግብ ወይም መጠጥ አልተገኘም' : 'No menu items found'}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  {isAmharic ? 'ሌላ ፍለጋ ወይም ምድብ ይሞክሩ።' : 'Try another search or category.'}
                </p>

              </div>

            )}

          </section>

      </main>

      </div>
    </AdminLayout>
  )
}
