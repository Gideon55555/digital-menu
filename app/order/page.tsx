
'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { MenuItem, MenuCategory } from '@/lib/types'
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
          menuResult.error || 'Failed to load menu'
        )
      }

      if (!categoriesResult.success) {
        throw new Error(
          categoriesResult.error || 'Failed to load categories'
        )
      }

      if (!sessionsResult.success) {
        throw new Error(
          sessionsResult.error || 'Failed to load sessions'
        )
      }

      const activeTables = (tablesResult.data || []).filter(
        (table: Table) => table.active
      )

      const availableMenuItems = (menuResult.data || []).filter(
        (item: MenuItem) => item.available
      )

      const activeSessions = (sessionsResult.data || []).filter(
        (session: TableSession) =>
          session.status === 'active'
      )

      setTables(activeTables)
      setMenuItems(availableMenuItems)
      setCategories(categoriesResult.data || [])
      setSessions(activeSessions)
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load order screen'
      )
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------
  // Automatically create/reuse table session
  // --------------------------------------------------

  async function createTableSession(table: Table) {
    try {
      setOpeningSession(true)
      setError('')
      setMessage('')

      // Check whether we already know about an active session.
      const existingSession = sessions.find(
        (session) => session.table_id === table.id
      )

      if (existingSession) {
        setActiveSession(existingSession)

        setTables((previous) =>
          previous.map((currentTable) =>
            currentTable.id === table.id
              ? {
                  ...currentTable,
                  status: 'occupied',
                }
              : currentTable
          )
        )

        setSelectedTable((previous) =>
          previous
            ? {
                ...previous,
                status: 'occupied',
              }
            : previous
        )

        setMessage(
          `${table.name || `Table ${table.table_number}`} is ready for ordering.`
        )

        return
      }

      // No known session, so create one automatically.
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
          result.error || 'Failed to create table session'
        )
      }

      const newSession: TableSession = result.data

      // Set active session immediately.
      setActiveSession(newSession)

      // Add it to our local session list.
      setSessions((previous) => {
        const alreadyExists = previous.some(
          (session) => session.id === newSession.id
        )

        if (alreadyExists) {
          return previous
        }

        return [...previous, newSession]
      })

      // Mark table occupied immediately in UI.
      setTables((previous) =>
        previous.map((currentTable) =>
          currentTable.id === table.id
            ? {
                ...currentTable,
                status: 'occupied',
              }
            : currentTable
        )
      )

      setSelectedTable((previous) =>
        previous
          ? {
              ...previous,
              status: 'occupied',
            }
          : previous
      )

      setMessage(
        `${table.name || `Table ${table.table_number}`} is ready for ordering.`
      )
    } catch (err) {
      console.error(err)

      setActiveSession(null)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create table session'
      )
    } finally {
      setOpeningSession(false)
    }
  }

  // --------------------------------------------------
  // Select table
  //
  // If active session exists:
  //   reuse it.
  //
  // If no active session:
  //   automatically create one.
  // --------------------------------------------------

  async function handleSelectTable(table: Table) {
    if (openingSession) {
      return
    }

    setSelectedTable(table)
    setMessage('')
    setError('')

    const existingSession = sessions.find(
      (session) => session.table_id === table.id
    )

    if (existingSession) {
      // Existing occupied table.
      setActiveSession(existingSession)

      setMessage(
        `${table.name || `Table ${table.table_number}`} is ready for ordering.`
      )

      return
    }

    // No session exists.
    // Automatically create one.
    setActiveSession(null)

    await createTableSession(table)
  }

  // --------------------------------------------------
  // Filter menu
  // --------------------------------------------------

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        item.categoryId === selectedCategory

      const searchText = search.toLowerCase().trim()

      const matchesSearch =
        !searchText ||
        item.name.en.toLowerCase().includes(searchText) ||
        (item.name.am || '').includes(searchText)

      return matchesCategory && matchesSearch
    })
  }, [
    menuItems,
    selectedCategory,
    search,
  ])

  const selectedItemIds = useMemo(
    () => new Set(cart.map((item) => item.menuItem.id)),
    [cart]
  )

  // --------------------------------------------------
  // Cart
  // --------------------------------------------------

  function addToCart(item: MenuItem) {
    setCart((previous) => {
      const existing = previous.find(
        (cartItem) =>
          cartItem.menuItem.id === item.id
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
      setError('Please select a table.')
      return
    }

    if (!activeSession) {
      setError(
        'The table is still being prepared. Please wait a moment.'
      )
      return
    }

    if (cart.length === 0) {
      setError('Please add at least one item.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setMessage('')

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_id: selectedTable.id,
          table_session_id: activeSession.id,
          order_type: 'dine_in',
          items: cart.map((item) => ({
            menu_item_id: item.menuItem.id,
            quantity: item.quantity,
            notes: item.notes || null,
          })),
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || 'Failed to create order'
        )
      }

      setMessage(
        `Order ${result.data.order_number} created successfully.`
      )

      setCart([])
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create order'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center p-12">
          <p className="text-gray-500">
            Loading order screen...
          </p>
        </div>
      </AdminLayout>
    )
  }

  // --------------------------------------------------
  // Page
  // --------------------------------------------------

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-serif font-bold text-restaurant-text dark:text-white">
              Take Order
            </h1>

            <p className="text-sm text-gray-500">
              Select a table and add menu items
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <ShoppingCart size={20} />

            <span className="font-semibold">
              {cart.reduce(
                (total, item) =>
                  total + item.quantity,
                0
              )}
            </span>
          </div>

        </div>

      <main className="p-6">

        {/* Messages */}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* Table Selection */}

        <section className="mb-8">

          <div className="mb-4 flex items-center gap-2">
            <Utensils size={20} />

            <h2 className="text-xl font-semibold">
              Select Table
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
                      ? 'border-green-500 bg-green-50 ring-2 ring-green-200 dark:bg-green-950/20 dark:ring-green-900/40'
                      : 'bg-white hover:border-restaurant-accent dark:bg-slate-900 dark:border-slate-700'
                  } ${
                    openingSession
                      ? 'cursor-wait opacity-70'
                      : ''
                  }`}
                >

                  <div className="flex items-center justify-between">

                    <span className="text-lg font-bold">
                      {table.name ||
                        `Table ${table.table_number}`}
                    </span>

                    {hasSession && (
                      <span className="h-3 w-3 rounded-full bg-red-500" />
                    )}

                  </div>

                  <p className="mt-1 text-sm text-gray-500">
                    Seats {table.capacity}
                  </p>

                  <p className="mt-2 text-xs font-medium">

                    {isOpeningThisTable
                      ? 'Preparing...'
                      : hasSession
                        ? 'Occupied'
                        : table.status === 'available'
                          ? 'Available'
                          : table.status}

                  </p>

                </button>
              )
            })}

          </div>

          {/* Selected table information */}

          {selectedTable && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 dark:bg-slate-900 dark:border-slate-700">

              <div>

                <p className="font-semibold">
                  {selectedTable.name ||
                    `Table ${selectedTable.table_number}`}
                </p>

                <p className="text-sm text-gray-500">
                  Capacity: {selectedTable.capacity}
                </p>

              </div>

              <div className="flex-1" />

              {openingSession ? (

                <span className="flex items-center gap-2 rounded-lg bg-yellow-100 px-4 py-2 text-sm font-medium text-yellow-700">
                  Preparing table...
                </span>

              ) : activeSession ? (

                <span className="flex items-center gap-2 rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
                  <CheckCircle size={18} />
                  Table Ready
                </span>

              ) : (

                <span className="text-sm text-red-600">
                  Table session unavailable
                </span>

              )}

            </div>
          )}

        </section>

        {/* Cart */}

        <section className="mb-8 rounded-2xl border border-green-200 bg-white p-5 shadow-sm dark:border-green-900/40 dark:bg-slate-900">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

            <div>

              <div className="flex items-center gap-2">
                <ShoppingCart size={20} className="text-green-600" />

                <h2 className="text-xl font-semibold">
                  Current Order
                </h2>

              </div>

              <p className="mt-1 text-sm text-gray-500">
                {cart.length} item{cart.length === 1 ? '' : 's'} selected
              </p>

              {selectedTable && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Table:{' '}
                  <span className="font-semibold">
                    {selectedTable.name || `Table ${selectedTable.table_number}`}
                  </span>
                </p>
              )}

            </div>

            <div className="text-right">

              <p className="text-sm text-gray-500">Subtotal</p>

              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {subtotal.toFixed(2)} ETB
              </p>

            </div>

          </div>

          <div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-green-100 p-3 dark:border-green-900/30">

            {cart.length === 0 ? (

              <div className="py-8 text-center text-sm text-gray-500">
                Select items from the menu to build the order.
              </div>

            ) : (

              <div className="space-y-3">

                {cart.map((item) => (

                  <div
                    key={item.menuItem.id}
                    className="rounded-xl border border-green-200 bg-green-50/60 p-3 dark:border-green-900/40 dark:bg-green-950/20"
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div>

                        <p className="font-semibold text-restaurant-text dark:text-white">
                          {item.menuItem.name.en}
                        </p>

                        <p className="text-sm text-gray-500">
                          {item.menuItem.price} {item.menuItem.currency}
                        </p>

                      </div>

                      <button
                        onClick={() => removeFromCart(item.menuItem.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X size={18} />
                      </button>

                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">

                      <div className="flex items-center rounded-lg border border-green-200 dark:border-green-900/40">

                        <button
                          onClick={() => decreaseQuantity(item.menuItem.id)}
                          className="p-2 hover:bg-green-100 dark:hover:bg-green-900/20"
                        >
                          <Minus size={16} />
                        </button>

                        <span className="min-w-8 text-center font-semibold">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() => addToCart(item.menuItem)}
                          className="p-2 hover:bg-green-100 dark:hover:bg-green-900/20"
                        >
                          <Plus size={16} />
                        </button>

                      </div>

                      <span className="font-semibold text-green-700 dark:text-green-400">
                        {(Number(item.menuItem.price) * item.quantity).toFixed(2)} {item.menuItem.currency}
                      </span>

                    </div>

                    <input
                      value={item.notes}
                      onChange={(e) => updateNotes(item.menuItem.id, e.target.value)}
                      placeholder="Item note..."
                      className="mt-3 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm dark:border-green-900/40 dark:bg-slate-950"
                    />

                  </div>

                ))}

              </div>

            )}

          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div className="text-sm text-gray-500">
              The cart stays on top so the order is easy to review.
            </div>

            <button
              onClick={submitOrder}
              disabled={
                submitting ||
                cart.length === 0 ||
                !activeSession ||
                openingSession
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >

              {submitting
                ? 'Submitting...'
                : openingSession
                  ? 'Preparing Table...'
                  : 'Submit Order'}

            </button>

          </div>

        </section>

        {/* Menu */}

        <section>

            <div className="mb-4">
              <h2 className="text-xl font-semibold">
                Menu
              </h2>
            </div>

            {/* Search */}

            <div className="relative mb-4">

              <Search
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search menu..."
                className="w-full rounded-lg border bg-white py-3 pl-10 pr-4 dark:bg-slate-900 dark:border-slate-700"
              />

            </div>

            {/* Categories */}

            <div className="mb-5 flex gap-2 overflow-x-auto pb-2">

              <button
                onClick={() =>
                  setSelectedCategory('all')
                }
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${
                  selectedCategory === 'all'
                    ? 'bg-restaurant-accent text-white'
                    : 'bg-white dark:bg-slate-900'
                }`}
              >
                All
              </button>

              {categories.map((category) => (

                <button
                  key={category.id}
                  onClick={() =>
                    setSelectedCategory(
                      category.id
                    )
                  }
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${
                    selectedCategory ===
                    category.id
                      ? 'bg-restaurant-accent text-white'
                      : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  {category.name.en}
                </button>

              ))}

            </div>

            {/* Menu Grid */}

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">

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
                  className={`group overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 ${selectedItemIds.has(item.id) ? 'border-green-500 ring-2 ring-green-200 dark:ring-green-900/40' : 'dark:border-slate-700'}`}
                >

                  <div className="aspect-square overflow-hidden bg-gray-100 dark:bg-slate-800">

                    {item.image ? (

                      <Image
                        src={item.image}
                        alt={item.name.en}
                        width={400}
                        height={400}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />

                    ) : (

                      <div className="flex h-full items-center justify-center text-gray-400">
                        No image
                      </div>

                    )}

                  </div>

                  <div className="p-3">

                    <h3 className="font-semibold">
                      {item.name.en}
                    </h3>

                    {item.name.am && (
                      <p className="mt-1 text-sm text-gray-400">
                        {item.name.am}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between">

                      <span className="font-bold text-restaurant-accent">
                        {item.price}{' '}
                        {item.currency}
                      </span>

                      {selectedItemIds.has(item.id) ? (
                        <span className="rounded-full bg-green-600 p-1.5 text-white">
                          <CheckCircle size={16} />
                        </span>
                      ) : (
                        <span className="rounded-full bg-restaurant-accent p-1.5 text-white">
                          <Plus size={16} />
                        </span>
                      )}

                    </div>

                  </div>

                </button>

              ))}

            </div>

            {filteredItems.length === 0 && (

              <div className="rounded-xl border border-dashed p-10 text-center">

                <p className="font-medium">
                  No menu items found
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Try another search or category.
                </p>

              </div>

            )}

          </section>

      </main>

      </div>
    </AdminLayout>
  )
}

