'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { getAdminAuth } from '@/lib/admin-auth'
import { supabase } from '@/lib/supabase'
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext'
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
  Wine,
  FolderPlus,
  X,
  ExternalLink,
  ChefHat,
  Layers,
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

type MenuCategory = {
  id: string
  name: {
    en: string
    am?: string
  }
  description?: {
    en: string
    am?: string
  }
  icon?: string
  type: 'food' | 'drink'
  displayOrder: number
  visible: boolean
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

function getCategoryEmoji(icon?: string): string {
  switch (icon) {
    case 'Coffee':
      return '☕'
    case 'Utensils':
      return '🍽️'
    case 'Leaf':
      return '🌿'
    case 'Wine':
    case 'drink':
      return '🥤'
    case 'Pizza':
      return '🍕'
    case 'Beer':
      return '🍺'
    case 'Sparkles':
      return '✨'
    case 'Users':
      return '👥'
    default:
      return '🍽️'
  }
}

export default function WaiterPage() {
  const { language } = useAdminLanguage()
  const isAmharic = language === 'am'

  const [tables, setTables] = useState<Table[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')

  // Quick category creation modal state
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false)
  const [newCategoryNameEn, setNewCategoryNameEn] = useState('')
  const [newCategoryNameAm, setNewCategoryNameAm] = useState('')
  const [newCategoryType, setNewCategoryType] = useState<'food' | 'drink'>('food')
  const [newCategoryIcon, setNewCategoryIcon] = useState('Utensils')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [categoryModalError, setCategoryModalError] = useState('')

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
  // LOAD TABLES, MENU ITEMS & CATEGORIES
  // ---------------------------------------------------------
  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent && tables.length === 0) setLoading(true)
      else if (!silent) setRefreshing(true)
      setError('')

      const [tablesResponse, menuResponse, categoriesResponse] = await Promise.all([
        fetch('/api/tables', { cache: 'no-store' }),
        fetch('/api/menu', { cache: 'no-store' }),
        fetch('/api/categories', { cache: 'no-store' }),
      ])

      const tablesResult = await tablesResponse.json()
      const menuResult = await menuResponse.json()
      const categoriesResult = await categoriesResponse.json()

      if (tablesResult.success && Array.isArray(tablesResult.data)) {
        setTables(tablesResult.data)
      }

      if (menuResult.success && Array.isArray(menuResult.data)) {
        setMenuItems(menuResult.data)
      }

      if (categoriesResult.success && Array.isArray(categoriesResult.data)) {
        const sorted = [...categoriesResult.data].sort(
          (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
        )
        setCategories(sorted)
      }
    } catch (err) {
      if (!silent) {
        setError(
          isAmharic
            ? 'መረጃዎችን ማምጣት አልተቻለም። እባክዎ እንደገና ይሞክሩ።'
            : 'Failed to load tables and menu. Please refresh.'
        )
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [tables.length, isAmharic])

  // Persistent live channel subscription for instant updates
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => {
          loadData(true)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
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

  // All selectable tables
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
          a.table_number.localeCompare(table_number(a), undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        )
      })

    function table_number(table: Table) {
      return table.table_number
    }
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

  // Map of category lookup
  const categoryMap = useMemo(() => {
    const map = new Map<string, MenuCategory>()
    categories.forEach((cat) => map.set(cat.id, cat))
    return map
  }, [categories])

  // Count available items per category
  const categoryItemCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 }
    for (const item of menuItems) {
      if (!item.available) continue
      counts.all = (counts.all || 0) + 1
      const catId = item.categoryId || 'uncategorized'
      counts[catId] = (counts[catId] || 0) + 1
    }
    return counts
  }, [menuItems])

  // Quantity map for items currently in cart
  const cartItemMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of cart) {
      map.set(item.menuItemId, item.quantity)
    }
    return map
  }, [cart])

  // ---------------------------------------------------------
  // CART OPERATIONS
  // ---------------------------------------------------------
  function addToCart(item: MenuItem) {
    if (!selectedTable) {
      setError(
        isAmharic
          ? 'እባክዎ መጀመሪያ ከላይ ጠረጴዛ ይምረጡ።'
          : 'Please tap a dining table first above before adding items.'
      )
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
  // FILTERED & GROUPED MENU ITEMS
  // ---------------------------------------------------------
  const filteredMenuItems = useMemo(() => {
    const searchValue = search.trim().toLowerCase()

    return menuItems.filter((item) => {
      if (!item.available) return false

      if (selectedCategoryId !== 'all') {
        const itemCatId = item.categoryId || 'uncategorized'
        if (itemCatId !== selectedCategoryId) return false
      }

      if (!searchValue) return true

      return (
        item.name.en.toLowerCase().includes(searchValue) ||
        Boolean(item.name.am && item.name.am.toLowerCase().includes(searchValue))
      )
    })
  }, [menuItems, search, selectedCategoryId])

  // When 'all' is selected and search is empty, display items grouped by category
  const categoryGroups = useMemo(() => {
    if (selectedCategoryId !== 'all' || search.trim()) {
      return null
    }

    const groups: {
      category: MenuCategory | null
      items: MenuItem[]
    }[] = []

    for (const cat of categories) {
      const itemsInCat = menuItems.filter(
        (item) => item.available && item.categoryId === cat.id
      )
      if (itemsInCat.length > 0) {
        groups.push({ category: cat, items: itemsInCat })
      }
    }

    const knownIds = new Set(categories.map((c) => c.id))
    const uncategorized = menuItems.filter(
      (item) => item.available && (!item.categoryId || !knownIds.has(item.categoryId))
    )
    if (uncategorized.length > 0) {
      groups.push({ category: null, items: uncategorized })
    }

    return groups
  }, [categories, menuItems, search, selectedCategoryId])

  // ---------------------------------------------------------
  // CREATE NEW CATEGORY
  // ---------------------------------------------------------
  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryNameEn.trim()) {
      setCategoryModalError(
        isAmharic ? 'እባክዎ የእንግሊዝኛ ስም ያስገቡ።' : 'Category name in English is required.'
      )
      return
    }

    try {
      setCreatingCategory(true)
      setCategoryModalError('')

      const payload = {
        name: {
          en: newCategoryNameEn.trim(),
          am: newCategoryNameAm.trim() || undefined,
        },
        type: newCategoryType,
        icon: newCategoryIcon,
        displayOrder: categories.length + 1,
        visible: true,
      }

      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create category')
      }

      const created: MenuCategory = data.data
      setCategories((prev) => [...prev, created])
      setSelectedCategoryId(created.id)
      setNewCategoryNameEn('')
      setNewCategoryNameAm('')
      setNewCategoryType('food')
      setNewCategoryIcon('Utensils')
      setShowCreateCategoryModal(false)
      setOrderSuccess(
        isAmharic
          ? `ምድብ "${created.name.am || created.name.en}" በተሳካ ሁኔታ ተፈጥሯል!`
          : `Category "${created.name.en}" created successfully!`
      )
    } catch (err: any) {
      setCategoryModalError(err.message || 'Error creating category')
    } finally {
      setCreatingCategory(false)
    }
  }

  // ---------------------------------------------------------
  // SUBMIT ORDER WITH WAITER IDENTITY
  // ---------------------------------------------------------
  async function submitOrder() {
    if (!selectedTable) {
      setError(
        isAmharic
          ? 'እባክዎ መጀመሪያ ጠረጴዛ ይምረጡ።'
          : 'Please select a dining table first.'
      )
      return
    }

    if (cart.length === 0) {
      setError(
        isAmharic
          ? 'እባክዎ ቢያንስ አንድ ዕቃ ወደ ትዕዛዙ ያክሉ።'
          : 'Please add at least one item to the cart.'
      )
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
        isAmharic
          ? `ትዕዛዝ #${result.data.order_number} ለጠረጴዛ ${selectedTable.table_number} በተሳካ ሁኔታ ተልኳል!`
          : `Order #${result.data.order_number} placed successfully for Table ${selectedTable.table_number}!`
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

  // Helper renderer for a single menu item card
  const renderItemCard = (item: MenuItem) => {
    const inCartQty = cartItemMap.get(item.id) || 0
    const cat = categoryMap.get(item.categoryId)

    return (
      <div
        key={item.id}
        onClick={() => addToCart(item)}
        className={`group relative flex flex-col justify-between rounded-xl border transition cursor-pointer active:scale-95 overflow-hidden ${
          inCartQty > 0
            ? 'border-restaurant-accent bg-restaurant-accent/5 ring-1 ring-restaurant-accent/30 dark:bg-restaurant-accent/10'
            : 'border-cream-200 dark:border-slate-800 bg-cream-50/30 dark:bg-slate-800/30 hover:border-restaurant-accent hover:shadow-md'
        }`}
      >
        {/* IN-CART BADGE */}
        {inCartQty > 0 && (
          <div className="absolute top-2 left-2 z-10 rounded-full bg-restaurant-accent text-white px-2 py-0.5 text-[10px] font-bold shadow-md flex items-center gap-1">
            <span>✓</span>
            <span>{inCartQty} {isAmharic ? 'በትዕዛዝ' : 'in cart'}</span>
          </div>
        )}

        {/* IMAGE */}
        {item.image ? (
          <div className="w-full h-24 sm:h-28 overflow-hidden bg-cream-100 dark:bg-slate-800">
            <img
              src={item.image}
              alt={item.name.en}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          </div>
        ) : (
          <div className="w-full h-24 sm:h-28 bg-cream-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 text-xs">
            <Utensils size={24} className="opacity-30" />
          </div>
        )}

        {/* CARD BODY */}
        <div className="p-2.5 flex flex-col justify-between flex-1">
          <div>
            {/* CATEGORY TAG BADGE (shown in search or all view) */}
            {cat && (
              <div className="text-[10px] text-gray-400 dark:text-gray-400 flex items-center gap-1 mb-1 truncate">
                <span>{getCategoryEmoji(cat.icon)}</span>
                <span className="truncate">{isAmharic && cat.name.am ? cat.name.am : cat.name.en}</span>
              </div>
            )}

            <h3 className="font-bold text-xs text-restaurant-text dark:text-white line-clamp-1">
              {isAmharic && item.name.am ? item.name.am : item.name.en}
            </h3>
            {item.name.am && item.name.en && (
              <p className="text-[10px] text-gray-400 truncate">
                {isAmharic ? item.name.en : item.name.am}
              </p>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between pt-1 border-t border-cream-100 dark:border-slate-800">
            <span className="text-xs font-extrabold text-restaurant-accent">
              {Number(item.price).toFixed(2)}{' '}
              <span className="text-[10px] font-normal text-gray-500">
                {item.currency || 'ETB'}
              </span>
            </span>

            <button
              type="button"
              className={`rounded-lg p-1 transition font-bold text-xs ${
                inCartQty > 0
                  ? 'bg-restaurant-accent text-white shadow-sm'
                  : 'bg-restaurant-accent/15 dark:bg-restaurant-accent/25 text-restaurant-accent hover:bg-restaurant-accent hover:text-white'
              }`}
              title="Add to order"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <Utensils className="mx-auto mb-3 h-8 w-8 text-restaurant-accent animate-spin" />
            <p className="text-xs text-gray-500">
              {isAmharic ? 'የአስተናጋጅ ገፅ በመጫን ላይ...' : 'Loading waiter screen...'}
            </p>
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
              {isAmharic ? 'የአስተናጋጅ ትዕዛዝ መስጫ' : 'Waiter Order'}
            </h1>

            {/* WAITER IDENTITY BADGE */}
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-950/60 px-2.5 py-0.5 font-bold text-purple-700 dark:text-purple-300">
                <User size={12} />
                {isAmharic ? 'አስተናጋጅ:' : 'Server:'} {currentWaiter?.name || currentWaiter?.email || (isAmharic ? 'ተመዝግቧል' : 'Logged In')}
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
              <span>{channelConnected ? (isAmharic ? 'ቀጥታ ግንኙነት' : 'Live') : (isAmharic ? 'በማመሳሰል ላይ' : 'Syncing')}</span>
            </div>

            {/* REFRESH */}
            <button
              onClick={() => loadData(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1 rounded-lg border border-cream-200 dark:border-slate-800 bg-cream-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-cream-100 transition"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              <span>{isAmharic ? 'አድስ' : 'Sync'}</span>
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
        {/* STEP 1: TABLES & SPLIT SECTIONS                       */}
        {/* ===================================================== */}
        <section className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-cream-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold flex items-center gap-1.5 text-restaurant-text dark:text-white uppercase tracking-wider">
              <Table2 size={16} className="text-restaurant-accent" />
              {isAmharic ? '1. ጠረጴዛ ይምረጡ:' : '1. Tap Dining Table:'}
            </h2>
            <span className="text-[11px] text-gray-500">
              {selectableTables.length} {isAmharic ? 'ጠረጴዛዎች' : 'tables'}
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
                      {isAmharic ? 'ክፍል' : 'Split'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* ===================================================== */}
        {/* STEP 2: CART / CURRENT ORDER                          */}
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
                  {isAmharic ? '2. የአሁን ትዕዛዝ' : '2. Current Order'}
                </h2>
                {selectedTable ? (
                  <p className="text-[11px] font-semibold text-restaurant-accent">
                    {isAmharic ? 'ጠረጴዛ' : 'Table'} {selectedTable.table_number}{' '}
                    {selectedTable.name ? `(${selectedTable.name})` : ''} · {selectedTable.capacity} {isAmharic ? 'ወንበሮች' : 'seats'}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-400">
                    {isAmharic ? 'ምንም ጠረጴዛ አልተመረጠም' : 'No table selected yet'}
                  </p>
                )}
              </div>
            </div>

            {selectedTable && (
              <button
                onClick={() => setSelectedTable(null)}
                className="text-[11px] text-gray-500 hover:text-red-500 underline"
              >
                {isAmharic ? 'ጠረጴዛ ቀይር' : 'Clear Table'}
              </button>
            )}
          </div>

          {/* CART BODY */}
          {!selectedTable ? (
            <div className="py-6 text-center text-xs text-gray-400">
              {isAmharic ? 'ትዕዛዝ ለመጀመር እባክዎ ከላይ ጠረጴዛ ይምረጡ።' : 'Please tap a table above to begin taking an order.'}
            </div>
          ) : cart.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
              <ShoppingCart size={28} className="mx-auto mb-2 text-gray-300 dark:text-gray-700" />
              {isAmharic ? (
                <>ጠረጴዛ <strong>{selectedTable.table_number}</strong> ተመርጧል። ዕቃዎችን ለማከል ከታች ያሉትን ምግቦች ወይም መጠጦች ይጫኑ።</>
              ) : (
                <>Table <strong>{selectedTable.table_number}</strong> is active. Tap food or drinks below to add items.</>
              )}
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
                          {isAmharic && item.name.am ? item.name.am : item.name.en}
                        </div>
                        {item.name.am && item.name.en && (
                          <div className="text-[10px] text-gray-400 truncate">
                            {isAmharic ? item.name.en : item.name.am}
                          </div>
                        )}
                        <div className="text-xs font-semibold text-restaurant-accent mt-0.5">
                          {(item.price * item.quantity).toFixed(2)} ETB
                          <span className="text-[10px] text-gray-400 font-normal ml-1">
                            ({item.price.toFixed(2)} {isAmharic ? 'በአንዱ' : 'each'})
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
                      placeholder={isAmharic ? 'ልዩ ማስታወሻ (ምሳሌ፡ ያለ በርበሬ፣ ተጨማሪ ዳቦ)...' : 'Special instructions (e.g. no spice, extra sauce)...'}
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
                    {isAmharic ? 'ጠቅላላ' : 'Total'} ({totalQuantity} {isAmharic ? 'ዕቃዎች' : 'items'}):
                  </span>
                  <span className="text-lg font-bold text-restaurant-accent">
                    {subtotal.toFixed(2)} ETB
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
                      ? (isAmharic ? 'ወደ ኩሽና በመላክ ላይ...' : 'Submitting to Kitchen...')
                      : (isAmharic ? `ትዕዛዝ ወደ ኩሽና ላክ (${subtotal.toFixed(2)} ETB)` : `Submit Order to Kitchen (${subtotal.toFixed(2)} ETB)`)}
                  </span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ===================================================== */}
        {/* STEP 3: FOOD & DRINKS MENU ORGANIZED BY CATEGORIES   */}
        {/* ===================================================== */}
        <section className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-cream-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-1.5 text-restaurant-text dark:text-white uppercase tracking-wider">
                <Utensils size={16} className="text-restaurant-accent" />
                {isAmharic ? '3. የምግብ ዝርዝር (ለመምረጥ ይጫኑ):' : '3. Menu Catalog (Tap to Add):'}
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {filteredMenuItems.length} {isAmharic ? 'የሚገኙ ዕቃዎች' : 'items available'}
              </p>
            </div>

            {/* SEARCH */}
            <div className="relative w-full sm:w-72">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAmharic ? 'ምግብ ወይም መጠጥ ይፈልጉ...' : 'Search food or drinks...'}
                className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/50 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-restaurant-accent"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* ===================================================== */}
          {/* CATEGORY TABS BAR WITH QUICK ADD BUTTON               */}
          {/* ===================================================== */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin pt-1">
            {/* ALL ITEMS PILL */}
            <button
              onClick={() => setSelectedCategoryId('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                selectedCategoryId === 'all'
                  ? 'bg-restaurant-accent text-white shadow-md ring-2 ring-restaurant-accent/30'
                  : 'bg-cream-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-cream-200 dark:border-slate-700 hover:border-restaurant-accent'
              }`}
            >
              <Layers size={13} />
              <span>{isAmharic ? 'ሁሉም' : 'All Items'}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedCategoryId === 'all'
                    ? 'bg-white/25 text-white'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {categoryItemCounts.all || 0}
              </span>
            </button>

            {/* EACH CATEGORY PILL */}
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id
              const count = categoryItemCounts[cat.id] || 0
              const label = isAmharic && cat.name.am ? cat.name.am : cat.name.en

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-restaurant-accent text-white shadow-md ring-2 ring-restaurant-accent/30'
                      : 'bg-cream-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-cream-200 dark:border-slate-700 hover:border-restaurant-accent'
                  }`}
                >
                  <span className="text-sm">{getCategoryEmoji(cat.icon)}</span>
                  <span>{label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected
                        ? 'bg-white/25 text-white'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}

            {/* "+ NEW CATEGORY" BUTTON */}
            <button
              onClick={() => setShowCreateCategoryModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 shadow-sm"
              title={isAmharic ? 'አዲስ የምድብ አይነት ይፍጠሩ' : 'Create new category'}
            >
              <Plus size={13} className="text-purple-600 dark:text-purple-400" />
              <span>{isAmharic ? '+ አዲስ ምድብ' : '+ Add Category'}</span>
            </button>
          </div>

          {/* ===================================================== */}
          {/* DISPLAY MODE 1: ALL ITEMS GROUPED BY CATEGORY         */}
          {/* ===================================================== */}
          {categoryGroups ? (
            <div className="space-y-6 pt-2">
              {categoryGroups.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  {isAmharic ? 'ምንም የሚገኙ ምግቦች አልተገኙም።' : 'No available menu items found.'}
                </div>
              ) : (
                categoryGroups.map((group) => {
                  const cat = group.category
                  const catTitle = isAmharic && cat?.name.am ? cat.name.am : cat?.name.en || (isAmharic ? 'ሌሎች' : 'Other Items')
                  const catSubtitle = cat && cat.name.am && cat.name.en ? (isAmharic ? cat.name.en : cat.name.am) : null

                  return (
                    <div key={cat?.id || 'other'} className="space-y-3">
                      {/* CATEGORY SECTION HEADER */}
                      <div className="flex items-center justify-between pb-2 border-b border-cream-200 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getCategoryEmoji(cat?.icon)}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm text-restaurant-text dark:text-white">
                                {catTitle}
                              </h3>
                              {catSubtitle && (
                                <span className="text-[11px] text-gray-400 font-normal">
                                  ({catSubtitle})
                                </span>
                              )}
                              {cat?.type && (
                                <span
                                  className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                    cat.type === 'drink'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  }`}
                                >
                                  {cat.type === 'drink' ? (isAmharic ? 'መጠጥ' : 'Drink') : (isAmharic ? 'ምግብ' : 'Food')}
                                </span>
                              )}
                            </div>
                            {cat?.description?.en && (
                              <p className="text-[10px] text-gray-400 line-clamp-1">
                                {isAmharic && cat.description.am ? cat.description.am : cat.description.en}
                              </p>
                            )}
                          </div>
                        </div>

                        <span className="text-xs text-gray-400 font-medium">
                          {group.items.length} {isAmharic ? 'ዕቃዎች' : 'items'}
                        </span>
                      </div>

                      {/* ITEMS GRID */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {group.items.map((item) => renderItemCard(item))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            /* ===================================================== */
            /* DISPLAY MODE 2: SPECIFIC CATEGORY OR SEARCH RESULTS   */
            /* ===================================================== */
            <div className="space-y-4 pt-1">
              {/* CURRENT SELECTION / SEARCH SUMMARY */}
              <div className="flex items-center justify-between text-xs text-gray-500 pb-1 border-b border-cream-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {selectedCategoryId !== 'all' && (
                    <span className="font-semibold text-restaurant-accent flex items-center gap-1">
                      <span>{getCategoryEmoji(categoryMap.get(selectedCategoryId)?.icon)}</span>
                      <span>
                        {isAmharic && categoryMap.get(selectedCategoryId)?.name.am
                          ? categoryMap.get(selectedCategoryId)?.name.am
                          : categoryMap.get(selectedCategoryId)?.name.en || selectedCategoryId}
                      </span>
                    </span>
                  )}
                  {search && (
                    <span>
                      {isAmharic ? `ለ "${search}" የተገኙ ውጤቶች` : `Results for "${search}"`}
                    </span>
                  )}
                </div>

                <span>
                  {filteredMenuItems.length} {isAmharic ? 'ዕቃዎች' : 'items'}
                </span>
              </div>

              {filteredMenuItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400 space-y-2">
                  <p>{isAmharic ? 'ምንም የሚስማማ ምግብ ወይም መጠጥ አልተገኘም።' : 'No matching items found.'}</p>
                  {(search || selectedCategoryId !== 'all') && (
                    <button
                      onClick={() => {
                        setSearch('')
                        setSelectedCategoryId('all')
                      }}
                      className="text-restaurant-accent hover:underline font-semibold"
                    >
                      {isAmharic ? 'ሁሉንም እቃዎች አሳይ' : 'Show all items'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredMenuItems.map((item) => renderItemCard(item))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ===================================================== */}
        {/* MODAL: QUICK CREATE CATEGORY                          */}
        {/* ===================================================== */}
        {showCreateCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-cream-200 dark:border-slate-800 overflow-hidden">
              {/* MODAL HEADER */}
              <div className="flex items-center justify-between p-4 border-b border-cream-200 dark:border-slate-800 bg-cream-50/60 dark:bg-slate-800/60">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                    <FolderPlus size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-restaurant-text dark:text-white">
                      {isAmharic ? 'አዲስ የምድብ አይነት ፍጠር' : 'Create New Menu Category'}
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      {isAmharic ? 'ምግቦችንና መጠጦችን በየምድባቸው ለማደራጀት' : 'Organize dishes & drinks for fast waiter ordering'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowCreateCategoryModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* MODAL BODY */}
              <form onSubmit={handleCreateCategory} className="p-4 space-y-4">
                {categoryModalError && (
                  <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{categoryModalError}</span>
                  </div>
                )}

                {/* ENGLISH NAME */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {isAmharic ? 'የምድብ ስም (እንግሊዝኛ) *' : 'Category Name (English) *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hot Drinks, Traditional Dishes, Pastries"
                    value={newCategoryNameEn}
                    onChange={(e) => setNewCategoryNameEn(e.target.value)}
                    className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/50 px-3 py-2 text-xs outline-none focus:border-restaurant-accent"
                  />
                </div>

                {/* AMHARIC NAME */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {isAmharic ? 'የምድብ ስም (አማርኛ)' : 'Category Name (Amharic)'}
                  </label>
                  <input
                    type="text"
                    placeholder="ለምሳሌ፦ ትኩስ መጠጦች፣ የባህል ምግቦች፣ ኬክ"
                    value={newCategoryNameAm}
                    onChange={(e) => setNewCategoryNameAm(e.target.value)}
                    className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/50 px-3 py-2 text-xs outline-none focus:border-restaurant-accent"
                  />
                </div>

                {/* KITCHEN TYPE SELECTOR */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    {isAmharic ? 'የትኛው ኩሽና ያዘጋጀዋል? (Type)' : 'Target Kitchen Preparation (Type)'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewCategoryType('food')
                        if (newCategoryIcon === 'Wine') setNewCategoryIcon('Utensils')
                      }}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                        newCategoryType === 'food'
                          ? 'border-restaurant-accent bg-restaurant-accent/10 ring-2 ring-restaurant-accent/20'
                          : 'border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40'
                      }`}
                    >
                      <ChefHat size={18} className="text-restaurant-accent shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-restaurant-text dark:text-white">
                          {isAmharic ? 'የምግብ ኩሽና' : 'Food Kitchen'}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {isAmharic ? 'ቁርስ፣ ምሳ፣ እራት' : 'Mains, breakfast, sides'}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNewCategoryType('drink')
                        if (newCategoryIcon === 'Utensils') setNewCategoryIcon('Wine')
                      }}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                        newCategoryType === 'drink'
                          ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20'
                          : 'border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40'
                      }`}
                    >
                      <Wine size={18} className="text-blue-500 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-restaurant-text dark:text-white">
                          {isAmharic ? 'የመጠጥ ማዘጋጃ' : 'Drink Kitchen'}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {isAmharic ? 'ቡና፣ ጁስ፣ ለስላሳ' : 'Beverages, coffee, bar'}
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* ICON SELECTOR */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    {isAmharic ? 'ምልክት (Icon)' : 'Category Icon'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { icon: 'Utensils', emoji: '🍽️', label: 'Food' },
                      { icon: 'Coffee', emoji: '☕', label: 'Coffee' },
                      { icon: 'Wine', emoji: '🥤', label: 'Drinks' },
                      { icon: 'Leaf', emoji: '🌿', label: 'Fasting' },
                      { icon: 'Pizza', emoji: '🍕', label: 'Pizza' },
                      { icon: 'Beer', emoji: '🍺', label: 'Beer' },
                      { icon: 'Sparkles', emoji: '✨', label: 'Special' },
                      { icon: 'Users', emoji: '👥', label: 'Catering' },
                    ].map((item) => (
                      <button
                        key={item.icon}
                        type="button"
                        onClick={() => setNewCategoryIcon(item.icon)}
                        className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition ${
                          newCategoryIcon === item.icon
                            ? 'border-restaurant-accent bg-restaurant-accent/15 text-restaurant-accent font-bold ring-1 ring-restaurant-accent/30'
                            : 'border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <span>{item.emoji}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="pt-3 border-t border-cream-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <Link
                    href="/admin/categories"
                    className="text-[11px] text-gray-400 hover:text-restaurant-accent flex items-center gap-1"
                  >
                    <ExternalLink size={11} />
                    <span>{isAmharic ? 'ሁሉንም ምድቦች አስተዳድር' : 'Full Manager'}</span>
                  </Link>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateCategoryModal(false)}
                      disabled={creatingCategory}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-cream-100 dark:hover:bg-slate-800 transition"
                    >
                      {isAmharic ? 'ተው' : 'Cancel'}
                    </button>

                    <button
                      type="submit"
                      disabled={creatingCategory}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-restaurant-accent text-white shadow-md hover:bg-restaurant-accent-dark disabled:opacity-50 transition flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>{creatingCategory ? (isAmharic ? 'በመፍጠር ላይ...' : 'Creating...') : (isAmharic ? 'ምድቡን ፍጠር' : 'Create Category')}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* MOBILE STICKY FLOATING BOTTOM BAR                     */}
        {/* ===================================================== */}
        {selectedTable && cart.length > 0 && (
          <div className="fixed bottom-3 left-3 right-3 sm:hidden z-30 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between rounded-2xl bg-restaurant-text text-white p-3 shadow-2xl border border-restaurant-accent/30 backdrop-blur-md bg-opacity-95">
              <div>
                <div className="text-[11px] text-gray-300">
                  {isAmharic ? 'ጠረጴዛ' : 'Table'}{' '}
                  <span className="font-bold text-white">{selectedTable.table_number}</span> · {totalQuantity}{' '}
                  {isAmharic ? 'ዕቃዎች' : 'items'}
                </div>
                <div className="text-sm font-extrabold text-restaurant-accent">
                  {subtotal.toFixed(2)} ETB
                </div>
              </div>

              <button
                onClick={submitOrder}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-restaurant-accent px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
              >
                <Send size={13} />
                <span>{submitting ? (isAmharic ? 'በመላክ ላይ...' : 'Sending...') : (isAmharic ? 'ትዕዛዝ ላክ' : 'Send Order')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}