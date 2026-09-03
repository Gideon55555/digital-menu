'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'
import {
  Table2,
  Plus,
  RefreshCw,
  ArrowRightLeft,
  Split,
  Layers,
  Users,
  Edit2,
  X,
  Check,
  Power,
  AlertCircle,
  Search,
  Receipt,
} from 'lucide-react'

type Table = {
  id: string
  table_number: string
  name: string | null
  capacity: number
  parent_table_id: string | null
  display_order: number
  active: boolean
  created_at: string
  updated_at: string
}

type OrderItem = {
  id: string
  item_name?: string | { en?: string; am?: string }
  quantity: number
  unit_price: number
  status: string
}

type ActiveOrder = {
  id: string
  order_number: string
  table_id: string | null
  status: string
  total_amount: number
  items?: OrderItem[]
  created_at: string
}

type SplitSection = {
  suffix: string
  capacity: string
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([])
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [channelConnected, setChannelConnected] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [search, setSearch] = useState('')

  const tablesRef = useRef<Table[]>([])
  const hasLoadedOnce = useRef(false)

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSplitModal, setShowSplitModal] = useState<Table | null>(null)
  const [splitCount, setSplitCount] = useState<number>(2)
  const [splitSections, setSplitSections] = useState<SplitSection[]>([
    { suffix: 'A', capacity: '2' },
    { suffix: 'B', capacity: '2' },
  ])

  const [showSwitchModal, setShowSwitchModal] = useState<{
    sourceTable: Table
    order?: ActiveOrder
  } | null>(null)
  const [switchTargetTableId, setSwitchTargetTableId] = useState('')

  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [editTableNumber, setEditTableNumber] = useState('')
  const [editTableName, setEditTableName] = useState('')
  const [editCapacity, setEditCapacity] = useState('4')

  // Form states
  const [newTableNumber, setNewTableNumber] = useState('')
  const [newTableName, setNewTableName] = useState('')
  const [newCapacity, setNewCapacity] = useState('4')
  const [saving, setSaving] = useState(false)

  // ---------------------------------------------------------
  // LOAD TABLES & ACTIVE SEATED ORDERS
  // ---------------------------------------------------------

  const loadData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true)
      else if (!hasLoadedOnce.current) setLoading(true)

      // Fetch tables safely
      try {
        const tablesRes = await fetch('/api/tables', { cache: 'no-store' })
        if (tablesRes.ok) {
          const tablesJson = await tablesRes.json()
          if (tablesJson.success && Array.isArray(tablesJson.data)) {
            setTables(tablesJson.data)
            tablesRef.current = tablesJson.data
            hasLoadedOnce.current = true
          }
        }
      } catch (tErr) {
        console.debug('Transient table fetch note:', tErr)
      }

      // Fetch orders safely
      try {
        const ordersRes = await fetch('/api/orders', { cache: 'no-store' })
        if (ordersRes.ok) {
          const ordersJson = await ordersRes.json()
          if (ordersJson.success && Array.isArray(ordersJson.data)) {
            const activeSeated = ordersJson.data.filter(
              (o: ActiveOrder) =>
                o.table_id &&
                ['pending', 'confirmed', 'preparing', 'ready', 'served'].includes(
                  o.status
                )
            )
            setActiveOrders(activeSeated)
          }
        }
      } catch (oErr) {
        console.debug('Transient orders fetch note:', oErr)
      }
    } catch (err) {
      console.debug('Silent sync note:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Realtime subscription + 4s background heartbeat
  useEffect(() => {
    loadData()

    const channel = supabase
      .channel(`tables-page-live-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        () => loadData(false)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => loadData(false)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setChannelConnected(true)
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR')
          setChannelConnected(false)
      })

    const interval = setInterval(() => {
      loadData(false)
    }, 4000)

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [loadData])

  // Auto clear success/error alerts
  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 4000)
    return () => clearTimeout(timer)
  }, [successMessage])

  // ---------------------------------------------------------
  // HIERARCHY COMPUTATIONS
  // ---------------------------------------------------------

  const parentTables = useMemo(() => {
    return tables
      .filter((t) => !t.parent_table_id)
      .filter((t) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
          t.table_number.toLowerCase().includes(q) ||
          (t.name && t.name.toLowerCase().includes(q))
        )
      })
  }, [tables, search])

  const getChildSections = useCallback(
    (parentId: string) => {
      return tables.filter((t) => t.parent_table_id === parentId && t.active)
    },
    [tables]
  )

  const getActiveOrderForTable = useCallback(
    (tableId: string) => {
      return activeOrders.find((o) => o.table_id === tableId)
    },
    [activeOrders]
  )

  // ---------------------------------------------------------
  // SWITCH TABLE (TRANSFER ACTIVE ORDER)
  // ---------------------------------------------------------

  const handleOpenSwitchModal = (table: Table) => {
    const order = getActiveOrderForTable(table.id)
    setShowSwitchModal({ sourceTable: table, order })
    setSwitchTargetTableId('')
    setError('')
  }

  const handleExecuteSwitchTable = async () => {
    if (!showSwitchModal || !switchTargetTableId) {
      setError('Please select a destination table')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'switch_table',
          source_table_id: showSwitchModal.sourceTable.id,
          target_table_id: switchTargetTableId,
          order_id: showSwitchModal.order?.id,
        }),
      })

      const json = await res.json()
      if (json.success) {
        setSuccessMessage(json.message || 'Table switched successfully!')
        setShowSwitchModal(null)
        loadData(true)
      } else {
        setError(json.error || 'Failed to switch table')
      }
    } catch (err) {
      setError('Error switching table')
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------
  // SPLIT TABLE (INTO ANY AMOUNT: 2, 3, 4, 5, 6...)
  // ---------------------------------------------------------

  const generateSplitSections = (count: number, parentCapacity: number) => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const newSections: SplitSection[] = []
    const perSectionCapacity = Math.max(1, Math.floor(parentCapacity / count))

    for (let i = 0; i < count; i++) {
      const suffix = letters[i] || `S${i + 1}`
      newSections.push({
        suffix,
        capacity: String(perSectionCapacity),
      })
    }
    return newSections
  }

  const handleOpenSplitModal = (table: Table) => {
    setShowSplitModal(table)
    setSplitCount(2)
    setSplitSections(generateSplitSections(2, table.capacity))
    setError('')
  }

  const handleSplitCountChange = (count: number) => {
    const validCount = Math.max(2, Math.min(count, 12))
    setSplitCount(validCount)
    if (showSplitModal) {
      setSplitSections(generateSplitSections(validCount, showSplitModal.capacity))
    }
  }

  const handleAddSplitRow = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const nextIndex = splitSections.length
    const suffix = letters[nextIndex] || `S${nextIndex + 1}`
    setSplitSections((prev) => [...prev, { suffix, capacity: '2' }])
    setSplitCount((prev) => prev + 1)
  }

  const handleRemoveSplitRow = (index: number) => {
    if (splitSections.length <= 2) return
    setSplitSections((prev) => prev.filter((_, i) => i !== index))
    setSplitCount((prev) => prev - 1)
  }

  const handleExecuteSplit = async (e: FormEvent) => {
    e.preventDefault()
    if (!showSplitModal) return

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'split',
          parent_table_id: showSplitModal.id,
          sections: splitSections.map((s) => ({
            suffix: s.suffix.toUpperCase(),
            capacity: Math.max(1, Number(s.capacity) || 1),
          })),
        }),
      })

      const json = await res.json()
      if (json.success) {
        setSuccessMessage(
          `Table ${showSplitModal.table_number} successfully split into ${splitSections.length} sections!`
        )
        setShowSplitModal(null)
        loadData(true)
      } else {
        setError(json.error || 'Failed to split table')
      }
    } catch (err) {
      setError('Error splitting table')
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------
  // MERGE SPLIT TABLE SECTIONS BACK TOGETHER
  // ---------------------------------------------------------

  const handleMergeSections = async (parentTable: Table) => {
    if (
      !confirm(
        `Are you sure you want to merge all sections back into Table ${parentTable.table_number}? Any active orders on the sections will be moved back to the main table.`
      )
    ) {
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge_sections',
          parent_table_id: parentTable.id,
        }),
      })

      const json = await res.json()
      if (json.success) {
        setSuccessMessage(
          `Sections merged back into Table ${parentTable.table_number}`
        )
        loadData(true)
      } else {
        setError(json.error || 'Failed to merge sections')
      }
    } catch (err) {
      setError('Error merging sections')
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------
  // CREATE TABLE
  // ---------------------------------------------------------

  const handleCreateTable = async (e: FormEvent) => {
    e.preventDefault()
    if (!newTableNumber.trim()) {
      setError('Table number is required')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: newTableNumber.trim(),
          name: newTableName.trim() || undefined,
          capacity: Math.max(1, Number(newCapacity) || 4),
        }),
      })

      const json = await res.json()
      if (json.success) {
        setSuccessMessage(`Table ${newTableNumber} created successfully!`)
        setShowAddModal(false)
        setNewTableNumber('')
        setNewTableName('')
        setNewCapacity('4')
        loadData(true)
      } else {
        setError(json.error || 'Failed to create table')
      }
    } catch (err) {
      setError('Error creating table')
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------
  // EDIT TABLE
  // ---------------------------------------------------------

  const handleStartEdit = (table: Table) => {
    setEditingTable(table)
    setEditTableNumber(table.table_number)
    setEditTableName(table.name || '')
    setEditCapacity(String(table.capacity))
    setError('')
  }

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingTable || !editTableNumber.trim()) return

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTable.id,
          table_number: editTableNumber.trim(),
          name: editTableName.trim() || null,
          capacity: Math.max(1, Number(editCapacity) || 1),
        }),
      })

      const json = await res.json()
      if (json.success) {
        setSuccessMessage('Table details updated successfully')
        setEditingTable(null)
        loadData(true)
      } else {
        setError(json.error || 'Failed to update table')
      }
    } catch (err) {
      setError('Error updating table')
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------
  // TOGGLE ACTIVE / DEACTIVATE
  // ---------------------------------------------------------

  const handleToggleActive = async (table: Table) => {
    try {
      const res = await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: table.id,
          active: !table.active,
        }),
      })
      const json = await res.json()
      if (json.success) {
        loadData(true)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-restaurant-accent/10 text-restaurant-accent">
                <Table2 size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-serif font-bold text-restaurant-text dark:text-white">
                  Table Management
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Switch active orders, split into multiple sections, and manage capacities.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* LIVE STATUS */}
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
              <span>{channelConnected ? 'Live Channel Open' : 'Auto-Sync Active'}</span>
            </div>

            {/* QUICK SWITCH BUTTON */}
            {activeOrders.length > 0 && (
              <button
                onClick={() => {
                  const firstWithOrder = tables.find((t) =>
                    activeOrders.some((o) => o.table_id === t.id)
                  )
                  if (firstWithOrder) handleOpenSwitchModal(firstWithOrder)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 transition"
              >
                <ArrowRightLeft size={14} />
                Switch Table ({activeOrders.length} active)
              </button>
            )}

            {/* SYNC */}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-cream-50 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* ADD TABLE */}
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-restaurant-accent px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-restaurant-accent-dark transition"
            >
              <Plus size={16} />
              Add Table
            </button>
          </div>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300">
            <Check size={16} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* CONTROLS & SEARCH */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-cream-200 dark:border-slate-800 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search table number or name..."
              className="w-full rounded-lg border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/50 pl-9 pr-4 py-1.5 text-xs outline-none focus:border-restaurant-accent transition"
            />
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>{activeOrders.length} Seated Orders</span>
            </span>
            <span>Total Tables: {tables.filter((t) => t.active).length}</span>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="rounded-xl border border-cream-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <Table2
              size={36}
              className="mx-auto mb-2 text-restaurant-accent animate-pulse"
            />
            <p className="text-xs text-gray-500">Loading tables & orders...</p>
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && parentTables.length === 0 && (
          <div className="rounded-xl border border-dashed border-cream-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <Table2 size={40} className="mx-auto mb-3 text-gray-300" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              No tables found
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {search ? 'No tables match your search query.' : 'Click "Add Table" to set up your floor layout.'}
            </p>
          </div>
        )}

        {/* TABLES GRID */}
        {!loading && parentTables.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {parentTables.map((table) => {
              const children = getChildSections(table.id)
              const isSplit = children.length > 0
              const activeOrder = getActiveOrderForTable(table.id)

              return (
                <div
                  key={table.id}
                  className={`relative flex flex-col justify-between rounded-xl border bg-white p-4 shadow-sm transition dark:bg-slate-900 ${
                    !table.active
                      ? 'opacity-60 border-gray-200 dark:border-slate-800'
                      : activeOrder
                        ? 'border-emerald-300 dark:border-emerald-800/60 ring-1 ring-emerald-400/20'
                        : isSplit
                          ? 'border-blue-200 dark:border-blue-900/40'
                          : 'border-cream-200 dark:border-slate-800 hover:border-restaurant-accent'
                  }`}
                >
                  <div>
                    {/* TOP ROW: TABLE NUMBER, CAPACITY, ACTIVE ORDER */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-xl font-bold text-lg shadow-sm ${
                            activeOrder
                              ? 'bg-emerald-600 text-white'
                              : isSplit
                                ? 'bg-blue-600 text-white'
                                : 'bg-cream-100 text-restaurant-text dark:bg-slate-800 dark:text-white'
                          }`}
                        >
                          {table.table_number}
                        </div>

                        <div>
                          <h3 className="font-bold text-restaurant-text dark:text-white">
                            {table.name || `Table ${table.table_number}`}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users size={12} />
                              Seats {table.capacity}
                            </span>
                            {isSplit && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                Split ({children.length})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* EDIT / DEACTIVATE MENU */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(table)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                          title="Edit Table"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(table)}
                          className={`p-1.5 rounded-lg transition ${
                            table.active
                              ? 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={table.active ? 'Deactivate Table' : 'Reactivate Table'}
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </div>

                    {/* ACTIVE ORDER BADGE (NO OCCUPIED STATUS TAG) */}
                    {activeOrder && (
                      <div className="mt-3.5 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                            <Receipt size={14} />
                            <span>{activeOrder.order_number}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            ${Number(activeOrder.total_amount || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-300">
                          <span>
                            {activeOrder.items?.length || 0} item(s) · {activeOrder.status}
                          </span>
                          <button
                            onClick={() => handleOpenSwitchModal(table)}
                            className="inline-flex items-center gap-1 font-bold text-emerald-800 dark:text-emerald-200 underline hover:text-emerald-950"
                          >
                            <ArrowRightLeft size={11} />
                            Switch Table
                          </button>
                        </div>
                      </div>
                    )}

                    {/* CHILD SECTIONS IF SPLIT */}
                    {isSplit && (
                      <div className="mt-3.5 space-y-2 border-t border-cream-200 dark:border-slate-800 pt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                          <span>Split Sections:</span>
                          <button
                            onClick={() => handleMergeSections(table)}
                            className="text-[11px] font-bold text-blue-600 hover:underline"
                          >
                            Merge All
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {children.map((child) => {
                            const childOrder = getActiveOrderForTable(child.id)
                            return (
                              <div
                                key={child.id}
                                className={`rounded-lg border p-2 text-xs transition ${
                                  childOrder
                                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                                    : 'border-cream-200 bg-cream-50/60 dark:border-slate-800 dark:bg-slate-800/40'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-restaurant-text dark:text-white">
                                    {child.table_number}
                                  </span>
                                  <span className="text-[10px] text-gray-500">
                                    {child.capacity}p
                                  </span>
                                </div>
                                {childOrder ? (
                                  <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-700 font-semibold">
                                    <span>{childOrder.order_number}</span>
                                    <button
                                      onClick={() => handleOpenSwitchModal(child)}
                                      className="text-emerald-800 underline"
                                      title="Switch Table"
                                    >
                                      Switch
                                    </button>
                                  </div>
                                ) : (
                                  <div className="mt-1 text-[10px] text-gray-400">
                                    Available
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* BOTTOM ACTION BUTTONS */}
                  <div className="mt-4 pt-3 border-t border-cream-100 dark:border-slate-800/60 flex items-center gap-2">
                    {/* SWITCH BUTTON */}
                    <button
                      onClick={() => handleOpenSwitchModal(table)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-cream-200 bg-cream-50 px-2.5 py-1.5 text-xs font-semibold text-restaurant-text hover:bg-cream-100 dark:border-slate-800 dark:bg-slate-800 dark:text-gray-200 transition"
                    >
                      <ArrowRightLeft size={13} />
                      Switch Table
                    </button>

                    {/* SPLIT / MERGE BUTTON */}
                    {!isSplit ? (
                      <button
                        onClick={() => handleOpenSplitModal(table)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 transition"
                      >
                        <Split size={13} />
                        Split
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMergeSections(table)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-800 dark:bg-slate-800 dark:text-gray-300 transition"
                      >
                        <Layers size={13} />
                        Merge
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: SWITCH TABLE / TRANSFER ACTIVE ORDER              */}
        {/* ========================================================= */}
        {showSwitchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-cream-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-cream-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="text-restaurant-accent" size={20} />
                  <h3 className="text-lg font-bold text-restaurant-text dark:text-white">
                    Switch Table
                  </h3>
                </div>
                <button
                  onClick={() => setShowSwitchModal(null)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {/* SOURCE TABLE */}
                <div className="rounded-xl bg-cream-50 dark:bg-slate-800/60 p-3.5 border border-cream-200 dark:border-slate-800">
                  <div className="text-xs text-gray-500">From Source Table:</div>
                  <div className="text-base font-bold text-restaurant-text dark:text-white mt-0.5">
                    Table {showSwitchModal.sourceTable.table_number}
                    {showSwitchModal.sourceTable.name && (
                      <span className="text-xs text-gray-500 font-normal ml-2">
                        ({showSwitchModal.sourceTable.name})
                      </span>
                    )}
                  </div>
                  {showSwitchModal.order ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                      <Receipt size={14} />
                      <span>
                        Moving {showSwitchModal.order.order_number} (
                        {showSwitchModal.order.items?.length || 0} items)
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-gray-500">
                      Transferring guest seatings to destination
                    </div>
                  )}
                </div>

                {/* DESTINATION TABLE SELECTION */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    Select Destination Table:
                  </label>
                  <select
                    value={switchTargetTableId}
                    onChange={(e) => setSwitchTargetTableId(e.target.value)}
                    className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm font-semibold outline-none focus:border-restaurant-accent transition"
                  >
                    <option value="">-- Choose destination table --</option>
                    {tables
                      .filter(
                        (t) =>
                          t.active && t.id !== showSwitchModal.sourceTable.id
                      )
                      .map((t) => {
                        const hasOrder = getActiveOrderForTable(t.id)
                        return (
                          <option key={t.id} value={t.id}>
                            Table {t.table_number}{' '}
                            {t.name ? `(${t.name})` : ''} - Seats {t.capacity}
                            {hasOrder ? ` [Seated: ${hasOrder.order_number}]` : ' [Available]'}
                          </option>
                        )
                      })}
                  </select>
                </div>

                {error && <div className="text-xs text-red-600">{error}</div>}

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowSwitchModal(null)}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-slate-800 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteSwitchTable}
                    disabled={saving || !switchTargetTableId}
                    className="flex-1 rounded-xl bg-restaurant-accent px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
                  >
                    {saving ? 'Switching...' : 'Switch Table'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: SPLIT TABLE INTO ANY AMOUNT (2, 3, 4, 5, 6...)    */}
        {/* ========================================================= */}
        {showSplitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-cream-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-cream-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Split className="text-restaurant-accent" size={20} />
                  <h3 className="text-lg font-bold text-restaurant-text dark:text-white">
                    Split Table {showSplitModal.table_number}
                  </h3>
                </div>
                <button
                  onClick={() => setShowSplitModal(null)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleExecuteSplit} className="mt-4 space-y-4">
                {/* PRESETS */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Split into How Many Sections?
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[2, 3, 4, 5].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => handleSplitCountChange(count)}
                        className={`rounded-xl py-2 text-xs font-bold border transition ${
                          splitCount === count
                            ? 'border-restaurant-accent bg-restaurant-accent text-white shadow-sm'
                            : 'border-cream-200 bg-cream-50 text-gray-700 hover:bg-cream-100 dark:border-slate-800 dark:bg-slate-800 dark:text-gray-300'
                        }`}
                      >
                        {count} Sections
                      </button>
                    ))}
                  </div>
                </div>

                {/* SECTIONS LIST */}
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Customize Sections & Capacities:
                  </div>

                  {splitSections.map((sec, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-800/40 p-3"
                    >
                      <div className="flex-1">
                        <label className="block text-[10px] font-medium text-gray-400 mb-0.5">
                          Suffix / Label:
                        </label>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-gray-500">
                            {showSplitModal.table_number}
                          </span>
                          <input
                            type="text"
                            value={sec.suffix}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase()
                              setSplitSections((prev) =>
                                prev.map((s, i) =>
                                  i === idx ? { ...s, suffix: val } : s
                                )
                              )
                            }}
                            maxLength={3}
                            className="w-16 rounded-lg border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold outline-none uppercase text-center"
                          />
                        </div>
                      </div>

                      <div className="flex-1">
                        <label className="block text-[10px] font-medium text-gray-400 mb-0.5">
                          Capacity (Seats):
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={sec.capacity}
                          onChange={(e) => {
                            const val = e.target.value
                            setSplitSections((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, capacity: val } : s
                              )
                            )
                          }}
                          className="w-full rounded-lg border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs outline-none"
                        />
                      </div>

                      {splitSections.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSplitRow(idx)}
                          className="mt-3.5 p-1 text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddSplitRow}
                  className="w-full py-2 text-xs font-bold text-restaurant-accent border border-dashed border-restaurant-accent/40 rounded-xl hover:bg-restaurant-accent/5 transition"
                >
                  + Add Another Section
                </button>

                {error && <div className="text-xs text-red-600">{error}</div>}

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowSplitModal(null)}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-slate-800 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-xl bg-restaurant-accent px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
                  >
                    {saving ? 'Splitting Table...' : `Split into ${splitSections.length} Sections`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: ADD TABLE                                          */}
        {/* ========================================================= */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-cream-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-cream-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Plus className="text-restaurant-accent" size={20} />
                  <h3 className="text-lg font-bold text-restaurant-text dark:text-white">
                    Add New Table
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateTable} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Table Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTableNumber}
                    onChange={(e) => setNewTableNumber(e.target.value)}
                    placeholder="e.g. 5 or Bar-1"
                    className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs outline-none focus:border-restaurant-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Table Name / Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="e.g. Window Booth, Patio 3"
                    className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs outline-none focus:border-restaurant-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Capacity (Seats)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(e.target.value)}
                    className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs outline-none focus:border-restaurant-accent"
                  />
                </div>

                {error && <div className="text-xs text-red-600">{error}</div>}

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-slate-800 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-xl bg-restaurant-accent px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
                  >
                    {saving ? 'Creating...' : 'Create Table'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: EDIT TABLE                                         */}
        {/* ========================================================= */}
        {editingTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-cream-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-cream-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Edit2 className="text-restaurant-accent" size={20} />
                  <h3 className="text-lg font-bold text-restaurant-text dark:text-white">
                    Edit Table {editingTable.table_number}
                  </h3>
                </div>
                <button
                  onClick={() => setEditingTable(null)}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Table Number
                  </label>
                  <input
                    type="text"
                    required
                    value={editTableNumber}
                    onChange={(e) => setEditTableNumber(e.target.value)}
                    className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs outline-none focus:border-restaurant-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Table Name
                  </label>
                  <input
                    type="text"
                    value={editTableName}
                    onChange={(e) => setEditTableName(e.target.value)}
                    placeholder="e.g. Window Booth"
                    className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs outline-none focus:border-restaurant-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Capacity (Seats)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(e.target.value)}
                    className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs outline-none focus:border-restaurant-accent"
                  />
                </div>

                {error && <div className="text-xs text-red-600">{error}</div>}

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingTable(null)}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-slate-800 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-xl bg-restaurant-accent px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
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
