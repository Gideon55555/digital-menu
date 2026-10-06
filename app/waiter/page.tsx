'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { getAdminAuth } from '@/lib/admin-auth'
import { supabase } from '@/lib/supabase'
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext'
import { compressReceiptImage } from '@/lib/utils/image'
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
  X,
  Layers,
  PackageCheck,
  CreditCard,
  Camera,
  Upload,
  Clock,
  Check,
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

type OrderItem = {
  id?: string
  menu_item_id?: string
  item_name?: string | { en?: string; am?: string }
  quantity: number
  unit_price?: number
  subtotal?: number
  notes?: string | null
}

type WaiterOrder = {
  id: string
  order_number: number | string
  status: string
  total: number
  table_id: string | null
  table_number?: string
  waiter_name?: string
  created_at: string
  items?: OrderItem[]
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

  const [activeTab, setActiveTab] = useState<'create_order' | 'ready_orders'>('create_order')
  const [tables, setTables] = useState<Table[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [orders, setOrders] = useState<WaiterOrder[]>([])

  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])

  const [currentWaiter, setCurrentWaiter] = useState<{
    id: string
    name: string | null
    email: string
    role?: string
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [channelConnected, setChannelConnected] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [orderSuccess, setOrderSuccess] = useState('')

  const [search, setSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')

  // ---------------------------------------------------------
  // WAITER PAYMENT MODAL STATE
  // ---------------------------------------------------------
  const [paymentOrder, setPaymentOrder] = useState<WaiterOrder | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'cbe' | 'telebirr'>('cash')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [tipAmount, setTipAmount] = useState('')
  const [receiptImage, setReceiptImage] = useState<string | null>(null)
  const [compressingReceipt, setCompressingReceipt] = useState(false)
  const [submittingPayment, setSubmittingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState('')

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
            role: auth.adminUser.role,
          })
        }
      } catch (err) {
        console.debug('Failed to get waiter auth info:', err)
      }
    }
    fetchWaiter()
  }, [])

  // ---------------------------------------------------------
  // LOAD TABLES, MENU ITEMS, CATEGORIES & ORDERS
  // ---------------------------------------------------------
  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent && tables.length === 0) setLoading(true)
      else if (!silent) setRefreshing(true)
      setError('')

      const [tablesResponse, menuResponse, categoriesResponse, ordersResponse] = await Promise.all([
        fetch('/api/tables', { cache: 'no-store' }),
        fetch('/api/menu', { cache: 'no-store' }),
        fetch('/api/categories', { cache: 'no-store' }),
        fetch('/api/orders', { cache: 'no-store' }),
      ])

      const tablesResult = await tablesResponse.json()
      const menuResult = await menuResponse.json()
      const categoriesResult = await categoriesResponse.json()
      const ordersResult = await ordersResponse.json()

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

      if (ordersResult.success && Array.isArray(ordersResult.data)) {
        setOrders(ordersResult.data)
      }
    } catch (err) {
      if (!silent) {
        setError(
          isAmharic
            ? 'መረጃዎችን ማምጣት አልተቻለም። እባክዎ እንደገና ይሞክሩ።'
            : 'Failed to load tables, menu, and orders. Please refresh.'
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

  // Filter ready orders for waiters
  const readyOrders = useMemo(() => {
    return orders.filter((order) => order.status === 'ready')
  }, [orders])

  const pendingPaymentOrders = useMemo(() => {
    return orders.filter((order) => order.status === 'payment_pending')
  }, [orders])

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

  // Table lookup map
  const tableMap = useMemo(() => {
    const map = new Map<string, Table>()
    tables.forEach((t) => map.set(t.id, t))
    return map
  }, [tables])

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
          creator_role: currentWaiter?.role || null,
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

  // ---------------------------------------------------------
  // PAYMENT MODAL HANDLERS FOR WAITER
  // ---------------------------------------------------------
  function openPaymentModal(order: WaiterOrder) {
    setPaymentOrder(order)
    setPaymentMethod('cash')
    setPaymentAmount(String(order.total || ''))
    setTipAmount('')
    setReceiptImage(null)
    setPaymentError('')
  }

  function closePaymentModal() {
    setPaymentOrder(null)
    setPaymentMethod('cash')
    setPaymentAmount('')
    setTipAmount('')
    setReceiptImage(null)
    setPaymentError('')
  }

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setCompressingReceipt(true)
      const compressedDataUrl = await compressReceiptImage(file, 900, 0.65)
      setReceiptImage(compressedDataUrl)
    } catch (err) {
      console.error('Failed to compress receipt image:', err)
      alert(isAmharic ? 'ፎቶውን ማዘጋጀት አልተቻለም። እባክዎ በድጋሚ ይሞክሩ።' : 'Failed to process image. Please try again.')
    } finally {
      setCompressingReceipt(false)
    }
  }

  async function handleConfirmPaymentSubmission() {
    if (!paymentOrder) return

    const parsedOrderTotal = Number(paymentOrder.total || 0)
    const amountVal = Number(paymentAmount) >= parsedOrderTotal ? Number(paymentAmount) : parsedOrderTotal
    const tip = Number(tipAmount) || 0

    if (!Number.isFinite(amountVal) || amountVal <= 0) {
      setPaymentError(isAmharic ? 'እባክዎ ትክክለኛ የክፍያ መጠን ያስገቡ።' : 'Please enter a valid payment amount.')
      return
    }

    if (tip < 0) {
      setPaymentError(isAmharic ? 'ቲፕ ከዜሮ ማነስ አይችልም።' : 'Tip cannot be negative.')
      return
    }

    try {
      setSubmittingPayment(true)
      setPaymentError('')

      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: paymentOrder.id,
          action: 'record_payment',
          payment_method: paymentMethod,
          amount: amountVal,
          tip_amount: tip,
          is_waiter: true,
          user_role: 'waiter',
          receipt_image: paymentMethod === 'cbe' || paymentMethod === 'telebirr' ? receiptImage : null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to submit payment')
      }

      setOrderSuccess(
        isAmharic
          ? 'ክፍያው ተመዝግቧል! ለገንዘብ ተቀባዩ ለማረጋገጥ ተልኳል።'
          : 'Payment submitted! Sent to Cashier for approval.'
      )

      closePaymentModal()
      await loadData(true)
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to submit payment.')
    } finally {
      setSubmittingPayment(false)
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
              {isAmharic ? 'የአስተናጋጅ ገፅ' : 'Waiter Portal'}
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
        {/* MAIN TAB NAVIGATION BAR                               */}
        {/* ===================================================== */}
        <div className="flex items-center border-b border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl px-2 shadow-sm overflow-x-auto">
          <button
            onClick={() => setActiveTab('create_order')}
            className={`relative px-5 py-3.5 text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'create_order'
                ? 'text-restaurant-accent border-b-2 border-restaurant-accent'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ShoppingCart size={16} />
            <span>{isAmharic ? 'አዲስ ትዕዛዝ መስጫ' : 'Take New Order'}</span>
          </button>

          <button
            onClick={() => setActiveTab('ready_orders')}
            className={`relative px-5 py-3.5 text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'ready_orders'
                ? 'text-restaurant-accent border-b-2 border-restaurant-accent'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <PackageCheck size={16} />
            <span>{isAmharic ? 'የተዘጋጁ ትዕዛዞች / ክፍያ መቀበያ' : 'Ready Orders / Collect Payment'}</span>
            {readyOrders.length > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[10px] font-extrabold animate-pulse">
                {readyOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* ===================================================== */}
        {/* TAB 1: CREATE NEW ORDER                               */}
        {/* ===================================================== */}
        {activeTab === 'create_order' && (
          <div className="space-y-6">
            {/* STEP 1: TABLES */}
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

            {/* STEP 2: CART */}
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

            {/* STEP 3: MENU CATALOG */}
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

              {/* CATEGORY TABS */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin pt-1">
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
              </div>

              {/* ITEMS CATALOG */}
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
                              </div>
                            </div>

                            <span className="text-xs text-gray-400 font-medium">
                              {group.items.length} {isAmharic ? 'ዕቃዎች' : 'items'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {group.items.map((item) => renderItemCard(item))}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-4 pt-1">
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
          </div>
        )}

        {/* ===================================================== */}
        {/* TAB 2: READY ORDERS & COLLECT PAYMENT                 */}
        {/* ===================================================== */}
        {activeTab === 'ready_orders' && (
          <div className="space-y-6">
            {/* READY ORDERS LIST */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-restaurant-text dark:text-white flex items-center gap-2">
                  <PackageCheck size={20} className="text-emerald-500" />
                  <span>{isAmharic ? 'የተዘጋጁ ትዕዛዞች (ክፍያ ይቀበሉ)' : 'Ready Orders (Collect Payment)'}</span>
                </h2>
                <span className="text-xs font-semibold text-gray-500 bg-cream-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                  {readyOrders.length} {isAmharic ? 'የተዘጋጁ' : 'ready'}
                </span>
              </div>

              {readyOrders.length === 0 && pendingPaymentOrders.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-cream-200 dark:border-slate-800 rounded-2xl p-10 text-center">
                  <PackageCheck size={36} className="mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                  <h3 className="font-bold text-sm text-restaurant-text dark:text-white">
                    {isAmharic ? 'ምንም የተዘጋጀ ትዕዛዝ የለም' : 'No ready orders right now'}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {isAmharic
                      ? 'በኩሽና የተዘጋጁ ትዕዛዞች እዚህ ክፍያ ለመሰብሰብ ይታያሉ።'
                      : 'Orders prepared by the kitchen will appear here for payment collection.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* READY ORDERS */}
                  {readyOrders.map((ord) => {
                    const tableInfo = ord.table_id ? tableMap.get(ord.table_id) : null
                    const tableNum = ord.table_number || tableInfo?.table_number || 'Takeout'

                    return (
                      <div
                        key={ord.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-500/40 p-4 shadow-sm space-y-3 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between pb-2.5 border-b border-cream-100 dark:border-slate-800">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-extrabold text-restaurant-text dark:text-white">
                                #{ord.order_number}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                {isAmharic ? 'ተዘጋጅቷል' : 'Ready'}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                              {isAmharic ? 'ጠረጴዛ:' : 'Table:'} <strong className="text-gray-900 dark:text-white">{tableNum}</strong>
                              {ord.waiter_name && ` · ${ord.waiter_name}`}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] text-gray-400">{isAmharic ? 'ጠቅላላ' : 'Total'}</div>
                            <div className="text-base font-extrabold text-restaurant-accent">
                              {Number(ord.total || 0).toFixed(2)} ETB
                            </div>
                          </div>
                        </div>

                        {/* ITEMS SUMMARY */}
                        {ord.items && ord.items.length > 0 && (
                          <div className="space-y-1.5 text-xs bg-cream-50/50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-cream-100 dark:border-slate-800 max-h-36 overflow-y-auto">
                            {ord.items.map((item, idx) => {
                              const itemNameStr =
                                typeof item.item_name === 'object'
                                  ? (isAmharic && item.item_name?.am ? item.item_name.am : item.item_name?.en || 'Item')
                                  : item.item_name || 'Item'

                              return (
                                <div key={idx} className="flex items-center justify-between">
                                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                                    {item.quantity}x {itemNameStr}
                                  </span>
                                  <span className="text-gray-500 font-mono text-[11px]">
                                    {Number(item.subtotal || item.unit_price || 0).toFixed(2)} ETB
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* COLLECT PAYMENT BUTTON */}
                        <button
                          onClick={() => openPaymentModal(ord)}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 text-xs shadow-md transition"
                        >
                          <CreditCard size={15} />
                          <span>{isAmharic ? 'ክፍያ ተቀበል / ትዕዛዝ ዝጋ' : 'Close Order / Collect Payment'}</span>
                        </button>
                      </div>
                    )
                  })}

                  {/* PENDING CASHIER APPROVAL ORDERS */}
                  {pendingPaymentOrders.map((ord) => {
                    const tableInfo = ord.table_id ? tableMap.get(ord.table_id) : null
                    const tableNum = ord.table_number || tableInfo?.table_number || 'Takeout'

                    return (
                      <div
                        key={ord.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-amber-400/50 p-4 shadow-sm space-y-3 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between pb-2.5 border-b border-cream-100 dark:border-slate-800">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-extrabold text-restaurant-text dark:text-white">
                                #{ord.order_number}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                                <Clock size={11} />
                                {isAmharic ? 'ማረጋገጫ በመጠበቅ ላይ' : 'Awaiting Cashier Approval'}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                              {isAmharic ? 'ጠረጴዛ:' : 'Table:'} <strong className="text-gray-900 dark:text-white">{tableNum}</strong>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] text-gray-400">{isAmharic ? 'ጠቅላላ' : 'Total'}</div>
                            <div className="text-base font-extrabold text-restaurant-accent">
                              {Number(ord.total || 0).toFixed(2)} ETB
                            </div>
                          </div>
                        </div>

                        <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40">
                          {isAmharic
                            ? 'ክፍያው ተመዝግቧል። የገንዘብ ተቀባዩ/ማናጀሩ ማረጋገጫ እስኪያጠናቅቅ በመጠበቅ ላይ ነው።'
                            : 'Payment details submitted. Waiting for Cashier / Manager to confirm.'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================== */}
        {/* MOBILE STICKY BOTTOM BAR FOR CART                     */}
        {/* ===================================================== */}
        {activeTab === 'create_order' && selectedTable && cart.length > 0 && (
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

        {/* ===================================================== */}
        {/* WAITER PAYMENT MODAL DIALOG                           */}
        {/* ===================================================== */}
        {paymentOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-cream-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 relative">
              {/* MODAL HEADER */}
              <div className="flex items-center justify-between pb-3 border-b border-cream-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CreditCard className="text-restaurant-accent" size={20} />
                  <h3 className="font-bold text-base text-restaurant-text dark:text-white">
                    {isAmharic ? `ክፍያ መዝግብ - ትዕዛዝ #${paymentOrder.order_number}` : `Record Payment - Order #${paymentOrder.order_number}`}
                  </h3>
                </div>
                <button
                  onClick={closePaymentModal}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-cream-100 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              {/* PAYMENT ERROR */}
              {paymentError && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-900/60 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* GRAND TOTAL DISPLAY */}
              <div className="bg-cream-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-cream-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                  {isAmharic ? 'የትዕዛዝ ሂሳብ ጠቅላላ:' : 'Order Grand Total:'}
                </span>
                <span className="text-xl font-extrabold text-restaurant-accent">
                  {Number(paymentOrder.total || 0).toFixed(2)} ETB
                </span>
              </div>

              {/* PAYMENT METHOD SELECTOR */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                  {isAmharic ? 'የክፍያ መንገድ ይምረጡ:' : 'Select Payment Method:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'cbe', 'telebirr'] as const).map((method) => {
                    const isSelected = paymentMethod === method
                    const label = method === 'cash' ? (isAmharic ? 'ጥሬ ገንዘብ' : 'Cash') : method.toUpperCase()

                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border-2 transition text-center ${
                          isSelected
                            ? 'border-restaurant-accent bg-restaurant-accent/10 text-restaurant-accent shadow-sm'
                            : 'border-cream-200 dark:border-slate-800 text-gray-600 dark:text-gray-400 hover:border-restaurant-accent/50'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* AMOUNT PAID & CHANGE DISPLAY */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                  {isAmharic ? 'የተከፈለው ገንዘብ (ETB):' : 'Amount Handled / Paid (ETB):'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={String(paymentOrder.total || '')}
                  className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/50 px-3.5 py-2.5 text-sm font-extrabold outline-none focus:border-restaurant-accent"
                />

                {/* LIVE CHANGE CALCULATION */}
                {Number(paymentAmount) > Number(paymentOrder.total || 0) && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                      {isAmharic ? 'ተመላሽ መልስ (Change):' : 'Change to Return:'}
                    </span>
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">
                      {(Number(paymentAmount) - Number(paymentOrder.total || 0)).toFixed(2)} ETB
                    </span>
                  </div>
                )}
              </div>

              {/* TIP AMOUNT */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                  {isAmharic ? 'ቲፕ (አማራጭ):' : 'Tip Amount (Optional):'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/50 px-3.5 py-2 text-xs outline-none focus:border-restaurant-accent"
                />
              </div>

              {/* RECEIPT IMAGE UPLOAD FOR CBE & TELEBIRR */}
              {(paymentMethod === 'cbe' || paymentMethod === 'telebirr') && (
                <div className="space-y-2 pt-1 border-t border-cream-100 dark:border-slate-800">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Camera size={14} className="text-restaurant-accent" />
                    <span>{isAmharic ? 'የደረሰኝ ፎቶ (ቴሌብር/ባንክ):' : 'Receipt Confirmation Photo:'}</span>
                  </label>

                  {receiptImage ? (
                    <div className="relative rounded-xl overflow-hidden border border-cream-200 dark:border-slate-800 bg-black/5 max-h-40">
                      <img src={receiptImage} alt="Receipt preview" className="w-full h-36 object-contain" />
                      <button
                        type="button"
                        onClick={() => setReceiptImage(null)}
                        className="absolute top-2 right-2 rounded-full bg-red-600 text-white p-1 shadow-md hover:bg-red-700"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cream-300 dark:border-slate-700 bg-cream-50/50 dark:bg-slate-800/40 p-4 cursor-pointer hover:border-restaurant-accent transition text-xs text-gray-500">
                      <Upload size={16} />
                      <span>{compressingReceipt ? (isAmharic ? 'ፎቶው በመዘጋጀት ላይ...' : 'Compressing photo...') : (isAmharic ? 'የደረሰኝ ፎቶ ይስቀሉ ወይም በካሜራ ያንሱ' : 'Upload or take receipt photo')}</span>
                      <input type="file" accept="image/*" onChange={handleReceiptFileChange} className="hidden" />
                    </label>
                  )}
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="pt-3 border-t border-cream-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  disabled={submittingPayment}
                  className="px-4 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-xl"
                >
                  {isAmharic ? 'ሰርዝ' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleConfirmPaymentSubmission}
                  disabled={submittingPayment || compressingReceipt}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-restaurant-accent hover:bg-restaurant-accent-dark rounded-xl shadow-md disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  <Check size={15} />
                  <span>
                    {submittingPayment
                      ? (isAmharic ? 'ክፍያ በመመዝገብ ላይ...' : 'Submitting payment...')
                      : (isAmharic ? 'ክፍያ መዝግብና ወደ ገንዘብ ተቀባይ ላክ' : 'Submit Payment to Cashier')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}