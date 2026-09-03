'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminRole, getAdminAuth, normalizeAdminRole } from '@/lib/admin-auth'
import { InventoryItem, InventoryNotification } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { playNotificationSound } from '@/lib/audio'
import {
  Package,
  AlertTriangle,
  Plus,
  Search,
  RefreshCw,
  Bell,
  CheckCircle2,
  Trash2,
  ChefHat,
  Coffee,
  X,
  Send,
  Minus,
  Check,
  Volume2,
  VolumeX,
} from 'lucide-react'

export default function InventoryPage() {
  const [role, setRole] = useState<AdminRole>('admin')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [notifications, setNotifications] = useState<InventoryNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'food' | 'drink'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all')
  const [activeTab, setActiveTab] = useState<'inventory' | 'notifications'>('inventory')

  // Realtime & Audio Alert states
  const [channelConnected, setChannelConnected] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const prevUnreadCount = useRef<number>(-1)

  // Modals & form state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showNotifyModal, setShowNotifyModal] = useState<InventoryItem | null>(null)
  const [notifyCustomMessage, setNotifyCustomMessage] = useState('')
  const [savingItem, setSavingItem] = useState(false)
  const [sendingAlert, setSendingAlert] = useState(false)
  const [tableNotCreated, setTableNotCreated] = useState(false)

  // New item form
  const [newItem, setNewItem] = useState({
    name: '',
    category_type: 'food' as 'food' | 'drink',
    quantity: 10,
    unit: 'kg',
    min_threshold: 5,
    cost_per_unit: 0,
    notes: '',
  })

  // Quick editing inline quantities
  const [editingQuantities, setEditingQuantities] = useState<Record<string, number>>({})
  const [isUpdatingStock, setIsUpdatingStock] = useState<Record<string, boolean>>({})

  // Determine user role
  useEffect(() => {
    async function loadAuth() {
      const auth = await getAdminAuth()
      if (auth) {
        const userRole = normalizeAdminRole(auth.adminUser.role)
        setRole(userRole)
        if (userRole === 'kitchen') {
          setFilterType('food')
        } else if (userRole === 'drinks_kitchen') {
          setFilterType('drink')
        }
      }
    }
    loadAuth()
  }, [])

  // Fetch inventory
  const fetchInventory = useCallback(async () => {
    try {
      setRefreshing(true)
      const res = await fetch('/api/inventory')
      const json = await res.json()
      if (json.success) {
        setItems(json.data || [])
        if (json.tableNotCreated) {
          setTableNotCreated(true)
        } else {
          setTableNotCreated(false)
        }
      }
    } catch (e) {
      console.error('Error fetching inventory:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/notify?status=all')
      const json = await res.json()
      if (json.success) {
        setNotifications(json.data || [])
      }
    } catch (e) {
      console.error('Error fetching notifications:', e)
    }
  }, [])

  useEffect(() => {
    fetchInventory()
    fetchNotifications()

    // Realtime subscription for instant multi-tab inventory sync
    const channel = supabase
      .channel(`inventory-live-page-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_items' },
        () => {
          fetchInventory()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_notifications' },
        () => {
          fetchNotifications()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChannelConnected(true)
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setChannelConnected(false)
        }
      })

    // 4-second heartbeat auto-sync interval
    const pollInterval = setInterval(() => {
      fetchInventory()
      fetchNotifications()
    }, 4000)

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(channel)
    }
  }, [fetchInventory, fetchNotifications])

  // Play audio warning when new low-stock alerts arrive from kitchen
  useEffect(() => {
    const unreadCount = notifications.filter((n) => n.status === 'unread').length
    if (prevUnreadCount.current >= 0 && unreadCount > prevUnreadCount.current && !loading) {
      if (soundEnabled && role === 'admin') {
        playNotificationSound('low_stock')
      }
    }
    prevUnreadCount.current = unreadCount
  }, [notifications, soundEnabled, role, loading])

  // Update quantity directly
  const handleUpdateQuantity = async (item: InventoryItem, newQty: number) => {
    const qty = Math.max(0, Number(newQty) || 0)
    setIsUpdatingStock((prev) => ({ ...prev, [item.id]: true }))
    try {
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, quantity: qty }),
      })
      const json = await res.json()
      if (json.success) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, quantity: qty } : i))
        )
      }
    } catch (err) {
      console.error('Error updating stock:', err)
    } finally {
      setIsUpdatingStock((prev) => ({ ...prev, [item.id]: false }))
    }
  }

  // Create new inventory item
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.name.trim()) return

    setSavingItem(true)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      })
      const json = await res.json()
      if (json.success && json.data) {
        setItems((prev) => [...prev, json.data])
        setShowAddModal(false)
        setNewItem({
          name: '',
          category_type: role === 'drinks_kitchen' ? 'drink' : 'food',
          quantity: 10,
          unit: 'kg',
          min_threshold: 5,
          cost_per_unit: 0,
          notes: '',
        })
      } else {
        alert(json.error || 'Failed to create item')
      }
    } catch (err) {
      console.error('Error creating item:', err)
    } finally {
      setSavingItem(false)
    }
  }

  // Delete inventory item
  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to remove this item from inventory?')) return
    try {
      const res = await fetch(`/api/inventory?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setItems((prev) => prev.filter((item) => item.id !== id))
      }
    } catch (err) {
      console.error('Error deleting item:', err)
    }
  }

  // Send low-stock notification to admin
  const handleSendLowStockAlert = async () => {
    if (!showNotifyModal) return
    setSendingAlert(true)
    try {
      const res = await fetch('/api/inventory/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: showNotifyModal.id,
          item_name: showNotifyModal.name,
          category_type: showNotifyModal.category_type,
          current_quantity: showNotifyModal.quantity,
          min_threshold: showNotifyModal.min_threshold,
          sender_role: role,
          message: notifyCustomMessage || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        alert('Notification sent to Admin successfully!')
        setShowNotifyModal(null)
        setNotifyCustomMessage('')
        fetchNotifications()
      } else {
        alert(json.error || 'Failed to send notification')
      }
    } catch (err) {
      console.error('Error sending alert:', err)
    } finally {
      setSendingAlert(false)
    }
  }

  // Admin marks notification as resolved
  const handleResolveNotification = async (id: string, status: 'read' | 'resolved') => {
    try {
      const res = await fetch('/api/inventory/notify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const json = await res.json()
      if (json.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, status } : n))
        )
      }
    } catch (err) {
      console.error('Error resolving notification:', err)
    }
  }

  // Filtered items list
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (filterType !== 'all' && item.category_type !== filterType) {
        return false
      }
      // Search filter
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) {
        return false
      }
      // Stock status filter
      if (statusFilter === 'out' && Number(item.quantity) !== 0) {
        return false
      }
      if (statusFilter === 'low' && Number(item.quantity) > Number(item.min_threshold)) {
        return false
      }
      return true
    })
  }, [items, filterType, search, statusFilter])

  // Count low stock
  const lowStockCount = useMemo(() => {
    return items.filter(
      (item) => Number(item.quantity) <= Number(item.min_threshold)
    ).length
  }, [items])

  const unreadAlertsCount = useMemo(() => {
    return notifications.filter((n) => n.status === 'unread').length
  }, [notifications])

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* TOP HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Package className="text-restaurant-accent" size={26} />
              <h1 className="text-2xl font-serif font-bold text-restaurant-text dark:text-white">
                {role === 'kitchen'
                  ? 'Food Kitchen Inventory'
                  : role === 'drinks_kitchen'
                    ? 'Drinks & Bar Inventory'
                    : 'Inventory Management'}
              </h1>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {role === 'kitchen'
                ? 'Update food ingredients and alert administration when supplies run low.'
                : role === 'drinks_kitchen'
                  ? 'Manage beverage supplies, beans, and milk, and report low stock to admin.'
                  : 'Track real-time stock levels, configure thresholds, and receive kitchen alerts.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* LIVE CHANNEL STATUS */}
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                channelConnected
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}
              title={channelConnected ? 'Realtime Channel Connected' : 'Auto-Sync Active'}
            >
              <span className={`h-2 w-2 rounded-full ${channelConnected ? 'bg-green-500 animate-ping' : 'bg-amber-500'}`} />
              <span>{channelConnected ? 'Live Channel Open' : 'Auto-Sync Active'}</span>
            </div>

            {/* AUDIO NOTIFICATION TOGGLE */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                soundEnabled
                  ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300'
                  : 'border-gray-200 bg-white text-gray-400 dark:border-slate-800 dark:bg-slate-800'
              }`}
              title={soundEnabled ? 'Low stock alarm is ON' : 'Low stock alarm is MUTED'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{soundEnabled ? 'Alarm ON' : 'Muted'}</span>
            </button>

            {/* REFRESH / SYNC */}
            <button
              onClick={() => {
                fetchInventory()
                fetchNotifications()
              }}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-cream-50 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {role === 'admin' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-restaurant-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-restaurant-accent-dark transition"
              >
                <Plus size={16} />
                Add Item
              </button>
            )}
          </div>
        </div>

        {/* PROMINENT RED LOW-STOCK WARNING NOTIFICATION BANNER */}
        {(lowStockCount > 0 || unreadAlertsCount > 0) && (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/40 p-4 shadow-sm animate-pulse">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50 text-red-600">
                  <AlertTriangle size={22} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-900 dark:text-red-200">
                    {unreadAlertsCount > 0
                      ? `🚨 Kitchen Alert: ${unreadAlertsCount} Low-Stock Notification(s) Waiting For Review!`
                      : `⚠️ Attention: ${lowStockCount} Inventory Item(s) Running Below Minimum Threshold!`}
                  </h3>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                    {role === 'admin'
                      ? 'Supplies are running low. Please check the reported kitchen alerts and restock as needed.'
                      : 'Some supplies are running low in the kitchen. Management has been notified.'}
                  </p>
                </div>
              </div>
              {role === 'admin' && activeTab !== 'notifications' && unreadAlertsCount > 0 && (
                <button
                  onClick={() => setActiveTab('notifications')}
                  className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 shadow transition"
                >
                  <Bell size={14} />
                  Review Kitchen Alerts ({unreadAlertsCount})
                </button>
              )}
            </div>
          </div>
        )}

        {/* DATABASE SETUP ALERT IF NOT CREATED */}
        {tableNotCreated && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700/50 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 dark:text-amber-400 mt-0.5" size={22} />
              <div>
                <h3 className="font-bold text-amber-900 dark:text-amber-200">
                  Supabase Setup Notice
                </h3>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                  The <code className="font-mono font-semibold">inventory_items</code> and <code className="font-mono font-semibold">inventory_notifications</code> tables have not been created yet in your Supabase database.
                  Please run the SQL script provided in your Supabase SQL Editor to enable persistent inventory storage.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN TAB SELECTOR */}
        {role === 'admin' && (
          <div className="flex items-center gap-3 border-b border-gray-200 dark:border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
                activeTab === 'inventory'
                  ? 'bg-restaurant-accent text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'
              }`}
            >
              <Package size={16} />
              All Inventory ({items.length})
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`relative flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
                activeTab === 'notifications'
                  ? 'bg-restaurant-accent text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'
              }`}
            >
              <Bell size={16} />
              Kitchen Alerts
              {unreadAlertsCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                  {unreadAlertsCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* NOTIFICATIONS TAB CONTENT */}
        {activeTab === 'notifications' && role === 'admin' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-restaurant-text dark:text-white">
                Kitchen Low Stock Alerts
              </h2>
              <span className="text-xs text-gray-500">
                {unreadAlertsCount} unread alert(s)
              </span>
            </div>

            {notifications.length === 0 ? (
              <div className="restaurant-card p-12 text-center text-gray-500 dark:text-gray-400">
                <CheckCircle2 size={36} className="mx-auto text-green-500 mb-2" />
                <p className="font-semibold">No alerts right now</p>
                <p className="text-xs mt-1">Kitchen staff haven&apos;t reported any low items.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`restaurant-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border transition ${
                      notif.status === 'unread'
                        ? 'border-red-300 bg-red-50/40 dark:border-red-800/50 dark:bg-red-950/20'
                        : 'border-gray-200 dark:border-slate-800 opacity-80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600">
                        {notif.category_type === 'drink' ? (
                          <Coffee size={20} />
                        ) : (
                          <ChefHat size={20} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-restaurant-text dark:text-white">
                            {notif.item_name}
                          </span>
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-slate-800 dark:text-gray-300 capitalize">
                            From: {notif.sender_role.replace('_', ' ')}
                          </span>
                          {notif.status === 'unread' && (
                            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {notif.message}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          Remaining: {notif.current_quantity} | Min Threshold: {notif.min_threshold} •{' '}
                          {new Date(notif.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {notif.status === 'unread' && (
                        <button
                          onClick={() => handleResolveNotification(notif.id, 'read')}
                          className="rounded-lg border border-gray-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                        >
                          Mark as Read
                        </button>
                      )}
                      {notif.status !== 'resolved' ? (
                        <button
                          onClick={() => handleResolveNotification(notif.id, 'resolved')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition"
                        >
                          <Check size={14} />
                          Restocked / Resolved
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                          <CheckCircle2 size={14} /> Resolved
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* INVENTORY LIST CONTENT */
          <>
            {/* STATS OVERVIEW */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="restaurant-card p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Total Items</p>
                  <p className="mt-1 text-2xl font-bold text-restaurant-text dark:text-white">
                    {filteredItems.length}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-restaurant-accent/10 text-restaurant-accent">
                  <Package size={20} />
                </div>
              </div>

              <div className="restaurant-card p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Low Stock Items</p>
                  <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {lowStockCount}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={20} />
                </div>
              </div>

              <div className="restaurant-card p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Out of Stock</p>
                  <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
                    {items.filter((i) => Number(i.quantity) === 0).length}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
                  <X size={20} />
                </div>
              </div>
            </div>

            {/* FILTER & SEARCH BAR */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between restaurant-card p-4">
              <div className="relative flex-1 max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search inventory items..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 pl-10 pr-4 text-sm outline-none focus:border-restaurant-accent dark:text-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Role allows switching category only if admin */}
                {role === 'admin' && (
                  <div className="flex rounded-lg border border-gray-200 dark:border-slate-800 p-1 bg-gray-50 dark:bg-slate-900">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                        filterType === 'all'
                          ? 'bg-white dark:bg-slate-800 text-restaurant-accent shadow-sm'
                          : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterType('food')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                        filterType === 'food'
                          ? 'bg-white dark:bg-slate-800 text-restaurant-accent shadow-sm'
                          : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                      }`}
                    >
                      Food
                    </button>
                    <button
                      onClick={() => setFilterType('drink')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                        filterType === 'drink'
                          ? 'bg-white dark:bg-slate-800 text-restaurant-accent shadow-sm'
                          : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
                      }`}
                    >
                      Drinks
                    </button>
                  </div>
                )}

                {/* Stock status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  <option value="all">All Stock Statuses</option>
                  <option value="low">Low Stock (≤ Threshold)</option>
                  <option value="out">Out of Stock (0)</option>
                </select>
              </div>
            </div>

            {/* INVENTORY ITEMS TABLE */}
            <div className="restaurant-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-5 py-3.5">Item Name</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5 text-center">Current Quantity</th>
                      <th className="px-4 py-3.5 text-center">Min Threshold</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-500">
                          <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-restaurant-accent" />
                          Loading inventory items...
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-500 dark:text-gray-400">
                          <Package size={32} className="mx-auto mb-2 text-gray-400" />
                          <p className="font-semibold">No inventory items found</p>
                          <p className="text-xs mt-1">Try adjusting your search or add a new item.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => {
                        const isLow = Number(item.quantity) <= Number(item.min_threshold)
                        const isOut = Number(item.quantity) === 0
                        const updating = isUpdatingStock[item.id]

                        return (
                          <tr
                            key={item.id}
                            className={`transition hover:bg-gray-50/50 dark:hover:bg-slate-800/30 ${
                              isOut
                                ? 'bg-red-50/30 dark:bg-red-950/10'
                                : isLow
                                  ? 'bg-amber-50/30 dark:bg-amber-950/10'
                                  : ''
                            }`}
                          >
                            {/* NAME */}
                            <td className="px-5 py-4">
                              <p className="font-bold text-restaurant-text dark:text-white">
                                {item.name}
                              </p>
                              {item.notes && (
                                <p className="text-xs text-gray-400 truncate max-w-xs">
                                  {item.notes}
                                </p>
                              )}
                            </td>

                            {/* CATEGORY */}
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  item.category_type === 'drink'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                }`}
                              >
                                {item.category_type === 'drink' ? (
                                  <Coffee size={12} />
                                ) : (
                                  <ChefHat size={12} />
                                )}
                                {item.category_type === 'drink' ? 'Drink' : 'Food'}
                              </span>
                            </td>

                            {/* QUANTITY INPUT & QUICK CONTROLS */}
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() =>
                                    handleUpdateQuantity(
                                      item,
                                      Number(item.quantity) - 1
                                    )
                                  }
                                  disabled={updating || Number(item.quantity) <= 0}
                                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
                                  title="Decrement 1"
                                >
                                  <Minus size={13} />
                                </button>

                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={
                                      editingQuantities[item.id] !== undefined
                                        ? editingQuantities[item.id]
                                        : item.quantity
                                    }
                                    onChange={(e) =>
                                      setEditingQuantities((prev) => ({
                                        ...prev,
                                        [item.id]: Number(e.target.value),
                                      }))
                                    }
                                    onBlur={() => {
                                      if (editingQuantities[item.id] !== undefined) {
                                        handleUpdateQuantity(
                                          item,
                                          editingQuantities[item.id]
                                        )
                                        setEditingQuantities((prev) => {
                                          const next = { ...prev }
                                          delete next[item.id]
                                          return next
                                        })
                                      }
                                    }}
                                    className="w-20 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 px-2 text-center text-sm font-bold text-restaurant-text dark:text-white outline-none focus:border-restaurant-accent"
                                  />
                                </div>

                                <button
                                  onClick={() =>
                                    handleUpdateQuantity(
                                      item,
                                      Number(item.quantity) + 1
                                    )
                                  }
                                  disabled={updating}
                                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-40 transition"
                                  title="Increment 1"
                                >
                                  <Plus size={13} />
                                </button>

                                <span className="text-xs text-gray-500 font-medium ml-1">
                                  {item.unit}
                                </span>
                              </div>
                            </td>

                            {/* MIN THRESHOLD */}
                            <td className="px-4 py-4 text-center">
                              <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                                {item.min_threshold} {item.unit}
                              </span>
                            </td>

                            {/* STATUS BADGE */}
                            <td className="px-4 py-4 text-center">
                              {isOut ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                  Out of Stock
                                </span>
                              ) : isLow ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse">
                                  <AlertTriangle size={12} /> Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                  In Stock
                                </span>
                              )}
                            </td>

                            {/* ACTIONS */}
                            <td className="px-5 py-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                {/* Kitchen button to report low stock */}
                                <button
                                  onClick={() => setShowNotifyModal(item)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition"
                                  title="Send Low Stock Alert to Admin"
                                >
                                  <Send size={13} />
                                  Report Low
                                </button>

                                {/* Admin delete button */}
                                {role === 'admin' && (
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                                    title="Delete Item"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* MODAL: REPORT LOW STOCK TO ADMIN */}
        {showNotifyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle size={20} />
                  <h3 className="font-bold text-lg text-restaurant-text dark:text-white">
                    Report Low Stock to Admin
                  </h3>
                </div>
                <button
                  onClick={() => setShowNotifyModal(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div>
                <p className="text-sm font-semibold text-restaurant-text dark:text-white">
                  Item: <span className="text-restaurant-accent">{showNotifyModal.name}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Current Stock: <strong>{showNotifyModal.quantity} {showNotifyModal.unit}</strong> | Minimum Threshold: <strong>{showNotifyModal.min_threshold} {showNotifyModal.unit}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Optional Note for Admin
                </label>
                <textarea
                  rows={3}
                  value={notifyCustomMessage}
                  onChange={(e) => setNotifyCustomMessage(e.target.value)}
                  placeholder="e.g. Only 2kg left, urgently need restock for dinner service..."
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm outline-none focus:border-restaurant-accent dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowNotifyModal(null)}
                  disabled={sendingAlert}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendLowStockAlert}
                  disabled={sendingAlert}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition"
                >
                  <Send size={15} />
                  {sendingAlert ? 'Sending Alert...' : 'Send Alert Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD NEW ITEM (ADMIN) */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-restaurant-accent">
                  <Package size={20} />
                  <h3 className="font-bold text-lg text-restaurant-text dark:text-white">
                    Add New Inventory Item
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="e.g. Beef, Coffee Beans, Cooking Oil..."
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm outline-none focus:border-restaurant-accent dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Kitchen Department *
                    </label>
                    <select
                      value={newItem.category_type}
                      onChange={(e) =>
                        setNewItem({ ...newItem, category_type: e.target.value as any })
                      }
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm font-medium dark:text-white outline-none"
                    >
                      <option value="food">Food Kitchen</option>
                      <option value="drink">Drinks Kitchen & Bar</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Unit of Measurement *
                    </label>
                    <input
                      type="text"
                      required
                      value={newItem.unit}
                      onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                      placeholder="e.g. kg, liters, bottles, pcs"
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm outline-none focus:border-restaurant-accent dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Initial Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      required
                      value={newItem.quantity}
                      onChange={(e) =>
                        setNewItem({ ...newItem, quantity: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm outline-none focus:border-restaurant-accent dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Low Threshold
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newItem.min_threshold}
                      onChange={(e) =>
                        setNewItem({ ...newItem, min_threshold: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm outline-none focus:border-restaurant-accent dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                      Cost per Unit (ETB)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newItem.cost_per_unit}
                      onChange={(e) =>
                        setNewItem({ ...newItem, cost_per_unit: Number(e.target.value) })
                      }
                      className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm outline-none focus:border-restaurant-accent dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={newItem.notes}
                    onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                    placeholder="e.g. Stored in dry pantry shelf B"
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm outline-none focus:border-restaurant-accent dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingItem}
                    className="inline-flex items-center gap-2 rounded-lg bg-restaurant-accent px-4 py-2 text-sm font-semibold text-white hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
                  >
                    <Plus size={16} />
                    {savingItem ? 'Saving Item...' : 'Add to Inventory'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  )
}
