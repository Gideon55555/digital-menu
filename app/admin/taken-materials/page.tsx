'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext'
import { supabase } from '@/lib/supabase'
import { getAdminAuth } from '@/lib/admin-auth'
import {
  PackageMinus,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  RefreshCw,
  X,
  AlertTriangle,
  User,
  Phone,
  Calendar,
  Trash2,
  Check,
  PackageCheck,
  FileText,
} from 'lucide-react'

type TakenMaterial = {
  id: string
  item_name: string
  borrower_name: string
  borrower_phone?: string | null
  quantity: number
  taken_date: string
  return_date?: string | null
  status: 'borrowed' | 'returned'
  notes?: string | null
  created_by?: string | null
  created_at: string
}

export default function TakenMaterialsPage() {
  const { isAmharic } = useAdminLanguage()
  const [materials, setMaterials] = useState<TakenMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'borrowed' | 'returned'>('borrowed')

  // Register Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    item_name: '',
    borrower_name: '',
    borrower_phone: '',
    quantity: 1,
    taken_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  const [currentUser, setCurrentUser] = useState<string>('staff')

  useEffect(() => {
    async function loadUser() {
      try {
        const auth = await getAdminAuth()
        if (auth?.adminUser?.name) {
          setCurrentUser(auth.adminUser.name)
        }
      } catch (e) {}
    }
    loadUser()
  }, [])

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setRefreshing(true)
      setError('')

      const res = await fetch('/api/taken-materials', { cache: 'no-store' })
      const json = await res.json()

      if (json.success && Array.isArray(json.data)) {
        setMaterials(json.data)
      } else {
        throw new Error(json.error || 'Failed to load taken materials')
      }
    } catch (err) {
      if (!silent) {
        setError(
          isAmharic
            ? 'የተወሰዱ እቃዎችን መጫን አልተቻለም።'
            : 'Failed to load taken materials records.'
        )
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isAmharic])

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel(`taken-materials-live-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taken_materials' }, () => {
        loadData(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadData])

  function resetForm() {
    setFormData({
      item_name: '',
      borrower_name: '',
      borrower_phone: '',
      quantity: 1,
      taken_date: new Date().toISOString().slice(0, 10),
      notes: '',
    })
  }

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.item_name.trim()) {
      alert(isAmharic ? 'እባክዎ የእቃውን ስም ያስገቡ።' : 'Please enter the item name.')
      return
    }

    if (!formData.borrower_name.trim()) {
      alert(isAmharic ? 'እባክዎ የወሰደውን ሰው ስም ያስገቡ።' : 'Please enter the borrower / person name.')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      const response = await fetch('/api/taken-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          created_by: currentUser,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to register item')
      }

      setSuccessMsg(
        isAmharic
          ? `የተወሰደ እቃ "${formData.item_name}" በ${formData.borrower_name} ስም ተመዝግቧል!`
          : `Item "${formData.item_name}" registered for ${formData.borrower_name} successfully!`
      )

      setShowAddModal(false)
      resetForm()
      await loadData(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to register item')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMarkReturned(id: string, itemName: string) {
    try {
      setProcessingId(id)
      const response = await fetch('/api/taken-materials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'mark_returned',
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to mark returned')
      }

      setSuccessMsg(
        isAmharic
          ? `እቃ "${itemName}" ተመልሷል ተብሎ ተመዝግቧል!`
          : `Item "${itemName}" marked as returned!`
      )

      await loadData(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update item')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(isAmharic ? 'እርግጠኛ ነዎት ይህን መዝገብ ማጥፋት ይፈልጋሉ?' : 'Are you sure you want to delete this record?')) {
      return
    }

    try {
      setProcessingId(id)
      const response = await fetch(`/api/taken-materials?id=${id}`, {
        method: 'DELETE',
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete record')
      }

      await loadData(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete record')
    } finally {
      setProcessingId(null)
    }
  }

  // Stats
  const borrowedCount = useMemo(() => materials.filter((m) => m.status === 'borrowed').length, [materials])
  const returnedCount = useMemo(() => materials.filter((m) => m.status === 'returned').length, [materials])

  // Filtered List
  const filteredMaterials = useMemo(() => {
    const q = search.trim().toLowerCase()
    return materials.filter((m) => {
      if (filterTab === 'borrowed' && m.status !== 'borrowed') return false
      if (filterTab === 'returned' && m.status !== 'returned') return false

      if (!q) return true
      return (
        m.item_name.toLowerCase().includes(q) ||
        m.borrower_name.toLowerCase().includes(q) ||
        Boolean(m.borrower_phone && m.borrower_phone.toLowerCase().includes(q)) ||
        Boolean(m.notes && m.notes.toLowerCase().includes(q))
      )
    })
  }, [materials, filterTab, search])

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-restaurant-text dark:text-white flex items-center gap-2">
              <PackageMinus className="text-amber-500" size={30} />
              {isAmharic ? 'የተወሰዱ እቃዎች' : 'Taken Materials'}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isAmharic
                ? 'ከካፌው ውጭ የተወሰዱ ወይም በሰዎች የተወሰዱ ቁሳቁሶችን ይከታተሉ'
                : 'Track items and equipment borrowed or taken out of the cafe.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData(false)}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-gray-300 hover:bg-cream-100 dark:hover:bg-slate-800 transition"
              title="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-restaurant-accent hover:bg-restaurant-accent-dark text-white text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Plus size={16} />
              <span>{isAmharic ? 'አዲስ የተወሰደ እቃ መዝግብ' : 'Register Taken Item'}</span>
            </button>
          </div>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/60 text-xs text-green-700 dark:text-green-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-green-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-stone-400 hover:text-stone-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 block">
                {isAmharic ? 'ያልተመለሱ (በውጭ ያሉ)' : 'Unreturned / Borrowed'}
              </span>
              <span className="text-2xl font-extrabold text-amber-900 dark:text-amber-200 font-mono mt-1 block">
                {borrowedCount} {isAmharic ? 'እቃዎች' : 'items'}
              </span>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Clock size={22} />
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block">
                {isAmharic ? 'የተመለሱ' : 'Returned'}
              </span>
              <span className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-200 font-mono mt-1 block">
                {returnedCount} {isAmharic ? 'እቃዎች' : 'items'}
              </span>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <PackageCheck size={22} />
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                {isAmharic ? 'ጠቅላላ መዝገቦች' : 'Total Records'}
              </span>
              <span className="text-2xl font-extrabold text-restaurant-text dark:text-white font-mono mt-1 block">
                {materials.length}
              </span>
            </div>
            <div className="h-11 w-11 rounded-xl bg-restaurant-accent/15 text-restaurant-accent flex items-center justify-center font-bold">
              <FileText size={22} />
            </div>
          </div>
        </div>

        {/* CONTROLS: SEARCH & TABS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          {/* SEARCH BAR */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAmharic ? 'በእቃ ስም ወይም በወሰደው ሰው ፈልግ...' : 'Search by item name or person who took it...'}
              className="w-full pl-10 pr-9 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-cream-200 dark:border-slate-800 text-stone-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-restaurant-accent/40 shadow-xs transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* STATUS FILTER TABS */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterTab('borrowed')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                filterTab === 'borrowed'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-cream-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-cream-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{isAmharic ? 'ያልተመለሱ' : 'Unreturned'}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                {borrowedCount}
              </span>
            </button>

            <button
              onClick={() => setFilterTab('returned')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                filterTab === 'returned'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-cream-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-cream-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{isAmharic ? 'የተመለሱ' : 'Returned'}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px]">
                {returnedCount}
              </span>
            </button>

            <button
              onClick={() => setFilterTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                filterTab === 'all'
                  ? 'bg-restaurant-accent text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-cream-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-cream-100 dark:hover:bg-slate-800'
              }`}
            >
              {isAmharic ? 'ሁሉም' : 'All'} ({materials.length})
            </button>
          </div>
        </div>

        {/* MATERIALS LIST / CARDS */}
        {loading ? (
          <div className="py-16 text-center text-gray-500 text-xs">
            {isAmharic ? 'መረጃዎችን በማምጣት ላይ...' : 'Loading taken materials...'}
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-400 text-xs">
            <PackageMinus size={36} className="mx-auto mb-2 text-stone-300 dark:text-slate-700" />
            {isAmharic ? 'ምንም የተመዘገቡ እቃዎች አልተገኙም።' : 'No taken material records found.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMaterials.map((item) => {
              const isBorrowed = item.status === 'borrowed'
              const takenDateStr = new Date(item.taken_date).toLocaleDateString()
              const takenTimeStr = new Date(item.taken_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 shadow-xs transition-all ${
                    isBorrowed
                      ? 'border-amber-300 dark:border-amber-900/80 bg-amber-50/30 dark:bg-slate-900 ring-1 ring-amber-500/20'
                      : 'border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  {/* CARD HEADER */}
                  <div className="flex items-start justify-between gap-2 border-b border-stone-200 dark:border-slate-800 pb-2.5">
                    <div>
                      <h3 className="font-bold text-base text-stone-900 dark:text-white">
                        {item.item_name}
                      </h3>
                      <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mt-0.5">
                        {item.quantity} {item.quantity === 1 ? (isAmharic ? 'እቃ' : 'unit') : (isAmharic ? 'እቃዎች' : 'units')}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                        isBorrowed
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {isBorrowed ? (isAmharic ? 'አልተመለሰም' : 'Borrowed') : (isAmharic ? 'ተመልሷል' : 'Returned')}
                    </span>
                  </div>

                  {/* BORROWER DETAILS */}
                  <div className="space-y-2 text-xs text-stone-700 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-400" />
                      <span>
                        <strong className="text-gray-500">{isAmharic ? 'የወሰደው ሰው:' : 'Taken by:'}</strong>{' '}
                        <span className="font-bold text-stone-900 dark:text-white">{item.borrower_name}</span>
                      </span>
                    </div>

                    {item.borrower_phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-gray-400" />
                        <span>
                          <strong className="text-gray-500">{isAmharic ? 'ስልክ:' : 'Phone:'}</strong>{' '}
                          <a href={`tel:${item.borrower_phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {item.borrower_phone}
                          </a>
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      <span>
                        <strong className="text-gray-500">{isAmharic ? 'የተወሰደበት ቀን:' : 'Taken date:'}</strong>{' '}
                        {takenDateStr} ({takenTimeStr})
                      </span>
                    </div>

                    {item.notes && (
                      <div className="p-2 rounded-lg bg-stone-100 dark:bg-slate-800/80 text-[11px] text-stone-600 dark:text-slate-400 italic">
                        &quot;{item.notes}&quot;
                      </div>
                    )}
                  </div>

                  {/* FOOTER ACTIONS */}
                  <div className="pt-2.5 border-t border-stone-200 dark:border-slate-800 flex items-center justify-between gap-2">
                    {isBorrowed ? (
                      <button
                        onClick={() => handleMarkReturned(item.id, item.item_name)}
                        disabled={processingId === item.id}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        <Check size={14} />
                        <span>{isAmharic ? 'ተመልሷል (Mark Returned)' : 'Mark Returned'}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        {isAmharic ? 'ተመልሷል' : 'Returned'}
                      </span>
                    )}

                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={processingId === item.id}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* REGISTER MODAL */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in">
              <div className="p-4 bg-cream-100 dark:bg-slate-800/80 border-b border-stone-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-white flex items-center gap-2">
                  <PackageMinus size={20} className="text-amber-500" />
                  {isAmharic ? 'አዲስ የተወሰደ እቃ መዝግብ' : 'Register Taken Material'}
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-stone-400 hover:text-stone-600 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddMaterial} className="p-5 space-y-4">
                {/* ITEM NAME */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">
                    {isAmharic ? 'የእቃው ስም *' : 'Item Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.item_name}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    placeholder={isAmharic ? 'ምሳሌ፡ ስፒከር፣ 2 የቡና ሲኒዎች፣ ትሪ...' : 'e.g. Speaker, 2 Coffee Cups, Tray...'}
                    className="w-full px-3.5 py-2 rounded-xl text-xs border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-white outline-none focus:ring-2 focus:ring-restaurant-accent"
                  />
                </div>

                {/* BORROWER NAME */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">
                    {isAmharic ? 'የወሰደው ሰው ስም *' : 'Name of Person Who Took It *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.borrower_name}
                    onChange={(e) => setFormData({ ...formData, borrower_name: e.target.value })}
                    placeholder={isAmharic ? 'ምሳሌ፡ አበበ (ማናጀር)፣ ሰራተኛ አበቡ...' : 'e.g. Abebe / Staff Member...'}
                    className="w-full px-3.5 py-2 rounded-xl text-xs border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-white outline-none focus:ring-2 focus:ring-restaurant-accent"
                  />
                </div>

                {/* PHONE & QUANTITY ROW */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">
                      {isAmharic ? 'የወሰደው ሰው ስልክ (ተወደደ)' : 'Phone Number (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={formData.borrower_phone}
                      onChange={(e) => setFormData({ ...formData, borrower_phone: e.target.value })}
                      placeholder="0911......"
                      className="w-full px-3.5 py-2 rounded-xl text-xs border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-white outline-none focus:ring-2 focus:ring-restaurant-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">
                      {isAmharic ? 'ብዛት' : 'Quantity'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-3.5 py-2 rounded-xl text-xs border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-white outline-none focus:ring-2 focus:ring-restaurant-accent"
                    />
                  </div>
                </div>

                {/* TAKEN DATE */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">
                    {isAmharic ? 'የተወሰደበት ቀን' : 'Date Taken'}
                  </label>
                  <input
                    type="date"
                    value={formData.taken_date}
                    onChange={(e) => setFormData({ ...formData, taken_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl text-xs border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-white outline-none focus:ring-2 focus:ring-restaurant-accent"
                  />
                </div>

                {/* NOTES */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">
                    {isAmharic ? 'ተጨማሪ ማስታወሻ' : 'Notes / Description'}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={isAmharic ? 'ለየትኛው ዝግጅት ወይም ምክንያት...' : 'Reason or additional details...'}
                    className="w-full px-3.5 py-2 rounded-xl text-xs border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-900 dark:text-white outline-none focus:ring-2 focus:ring-restaurant-accent"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800 transition"
                  >
                    {isAmharic ? 'ሰርዝ' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-restaurant-accent hover:bg-restaurant-accent-dark text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Check size={14} />
                    <span>{submitting ? (isAmharic ? 'በመመዝገብ ላይ...' : 'Saving...') : (isAmharic ? 'መዝግብ' : 'Save Item')}</span>
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
