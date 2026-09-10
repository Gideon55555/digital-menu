'use client'

import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext'
import {
  Boxes,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  X,
  PlusCircle,
  MinusCircle,
  MapPin,
  Sparkles,
  Copy,
} from 'lucide-react'

type CafeMaterial = {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  condition: 'good' | 'fair' | 'needs_repair' | 'broken'
  location: string
  notes?: string | null
  created_at: string
  updated_at: string
}

const CATEGORIES = [
  'Furniture',
  'Glassware',
  'Tableware',
  'Equipment',
  'Electronics',
  'Other',
]

const CONDITIONS = [
  { value: 'good', label: 'Good', amLabel: 'ጥሩ' },
  { value: 'fair', label: 'Fair', amLabel: 'መካከለኛ' },
  { value: 'needs_repair', label: 'Needs Repair', amLabel: 'ጥገና የሚያስፈልገው' },
  { value: 'broken', label: 'Broken / Damaged', amLabel: 'የተሰበረ / የተበላሸ' },
]

const LOCATIONS = [
  'Main Dining Area',
  'Bar & Drinks Station',
  'Kitchen',
  'Coffee Station',
  'Outdoor Patio',
  'Storage Room',
]

export default function CafeMaterialsPage() {
  const { language } = useAdminLanguage()
  const isAmharic = language === 'am'

  const [items, setItems] = useState<CafeMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedCondition, setSelectedCondition] = useState('all')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<CafeMaterial | null>(null)
  const [itemToDelete, setItemToDelete] = useState<CafeMaterial | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Vercel / Supabase table status
  const [tableNotCreated, setTableNotCreated] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)
  const [showSqlDetails, setShowSqlDetails] = useState(false)

  // Form states
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('Furniture')
  const [formQuantity, setFormQuantity] = useState('1')
  const [formUnit, setFormUnit] = useState('pcs')
  const [formCondition, setFormCondition] = useState<CafeMaterial['condition']>('good')
  const [formLocation, setFormLocation] = useState('Main Dining Area')
  const [formNotes, setFormNotes] = useState('')

  useEffect(() => {
    loadMaterials()
  }, [])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 3500)
    return () => clearTimeout(timer)
  }, [successMessage])

  async function loadMaterials(showSpinner = true) {
    try {
      if (showSpinner) setLoading(true)
      else setRefreshing(true)
      setError('')

      const res = await fetch('/api/cafe-materials')
      const json = await res.json()

      if (json.success && Array.isArray(json.data)) {
        setItems(json.data)
        setTableNotCreated(Boolean(json.tableNotCreated))
      } else {
        throw new Error(json.error || 'Failed to load materials')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to fetch materials')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Filtered materials
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = item.name.toLowerCase().includes(q)
        const matchCat = item.category.toLowerCase().includes(q)
        const matchLoc = (item.location || '').toLowerCase().includes(q)
        const matchNotes = (item.notes || '').toLowerCase().includes(q)
        if (!matchName && !matchCat && !matchLoc && !matchNotes) return false
      }

      if (selectedCategory !== 'all' && item.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false
      }

      if (selectedCondition !== 'all' && item.condition.toLowerCase() !== selectedCondition.toLowerCase()) {
        return false
      }

      return true
    })
  }, [items, search, selectedCategory, selectedCondition])

  // Aggregate stats
  const stats = useMemo(() => {
    const totalDistinct = items.length
    const totalUnits = items.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0)
    const goodCount = items.filter((i) => i.condition === 'good').length
    const repairCount = items.filter((i) => i.condition === 'needs_repair' || i.condition === 'broken').length

    return { totalDistinct, totalUnits, goodCount, repairCount }
  }, [items])

  const CAFE_MATERIALS_SQL = `-- 1. Create table
CREATE TABLE IF NOT EXISTS public.cafe_materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  condition TEXT NOT NULL DEFAULT 'good',
  location TEXT DEFAULT 'Main Dining Area',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS and permissive policy
ALTER TABLE public.cafe_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read and write to cafe_materials"
  ON public.cafe_materials
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Seed initial materials
INSERT INTO public.cafe_materials (id, name, category, quantity, unit, condition, location, notes)
VALUES
  ('mat-1', 'Dining Chairs', 'Furniture', 36, 'pcs', 'good', 'Main Dining Area', 'Wooden Ethiopian traditional engraved chairs'),
  ('mat-2', 'Dining Tables', 'Furniture', 10, 'pcs', 'good', 'Main Dining Area', 'Solid wood restaurant dining tables'),
  ('mat-3', 'Drinking Glasses (Water)', 'Glassware', 80, 'pcs', 'good', 'Bar', 'Standard 300ml tumblers'),
  ('mat-4', 'Juice Glasses (Tall)', 'Glassware', 45, 'pcs', 'good', 'Bar', 'Tall cocktail/juice glasses'),
  ('mat-5', 'Traditional Coffee Cups (Sini)', 'Tableware', 60, 'pcs', 'good', 'Coffee Station', 'Ceramic Ethiopian coffee ceremony cups'),
  ('mat-6', 'Injera Serving Plates (Mesob style)', 'Tableware', 25, 'pcs', 'good', 'Kitchen', 'Large round stainless steel and woven plates'),
  ('mat-7', 'Heavy Duty Commercial Blender', 'Equipment', 2, 'pcs', 'good', 'Juice Bar', '2200W commercial fruit and telba blenders'),
  ('mat-8', 'Cutlery Sets (Spoons & Forks)', 'Tableware', 100, 'sets', 'good', 'Dining Hall Pantry', 'Stainless steel forks and dessert spoons')
ON CONFLICT (id) DO NOTHING;`

  const handleCopySql = () => {
    navigator.clipboard.writeText(CAFE_MATERIALS_SQL)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 3000)
  }

  function handleOpenAdd() {
    setFormName('')
    setFormCategory('Furniture')
    setFormQuantity('1')
    setFormUnit('pcs')
    setFormCondition('good')
    setFormLocation('Main Dining Area')
    setFormNotes('')
    setError('')
    setShowAddModal(true)
  }

  function handleOpenEdit(item: CafeMaterial) {
    setEditingItem(item)
    setFormName(item.name)
    setFormCategory(item.category || 'Furniture')
    setFormQuantity(String(item.quantity || 1))
    setFormUnit(item.unit || 'pcs')
    setFormCondition(item.condition || 'good')
    setFormLocation(item.location || 'Main Dining Area')
    setFormNotes(item.notes || '')
    setError('')
  }

  async function handleSaveMaterial(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim()) {
      setError(isAmharic ? 'የእቃው ስም ያስፈልጋል' : 'Item name is required')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      name: formName.trim(),
      category: formCategory,
      quantity: Number(formQuantity) || 0,
      unit: formUnit.trim() || 'pcs',
      condition: formCondition,
      location: formLocation.trim(),
      notes: formNotes.trim() || null,
    }

    try {
      if (editingItem) {
        // PUT
        const res = await fetch('/api/cafe-materials', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Failed to update')
        setSuccessMessage(isAmharic ? 'እቃው በተሳካ ሁኔታ ተሻሽሏል' : 'Material updated successfully')
        setEditingItem(null)
      } else {
        // POST
        const res = await fetch('/api/cafe-materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Failed to create')
        setSuccessMessage(isAmharic ? 'አዲስ እቃ በተሳካ ሁኔታ ተመዝግቧል' : 'New material created successfully')
        setShowAddModal(false)
      }

      await loadMaterials(false)
    } catch (err: any) {
      setError(err.message || 'Operation failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdjustQuantity(item: CafeMaterial, delta: number) {
    const newQty = Math.max(0, (item.quantity || 0) + delta)
    if (newQty === item.quantity) return

    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, quantity: newQty } : i))
    )

    try {
      await fetch('/api/cafe-materials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, quantity: newQty }),
      })
    } catch (e) {
      console.error(e)
      loadMaterials(false)
    }
  }

  async function confirmDelete() {
    if (!itemToDelete) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/cafe-materials?id=${encodeURIComponent(itemToDelete.id)}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed to delete')
      setSuccessMessage(isAmharic ? 'እቃው ተሰርዟል' : 'Material deleted successfully')
      setItemToDelete(null)
      await loadMaterials(false)
    } catch (err: any) {
      setError(err.message || 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  function getConditionBadge(cond: CafeMaterial['condition']) {
    switch (cond) {
      case 'good':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 size={12} />
            {isAmharic ? 'ጥሩ' : 'Good'}
          </span>
        )
      case 'fair':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <Sparkles size={12} />
            {isAmharic ? 'መካከለኛ' : 'Fair'}
          </span>
        )
      case 'needs_repair':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
            <Wrench size={12} />
            {isAmharic ? 'ጥገና የሚያስፈልገው' : 'Needs Repair'}
          </span>
        )
      case 'broken':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
            <AlertTriangle size={12} />
            {isAmharic ? 'የተበላሸ' : 'Damaged'}
          </span>
        )
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* TOP BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cream-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-restaurant-accent/10 dark:bg-restaurant-accent/20 text-restaurant-accent">
                <Boxes size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-serif font-bold text-restaurant-text dark:text-white">
                  {isAmharic ? 'የካፌ ቁሳቁሶች' : 'Cafe Materials & Assets'}
                </h1>
                <p className="text-xs text-restaurant-text-light dark:text-gray-400 mt-0.5">
                  {isAmharic
                    ? 'ወንበሮች፣ ጠረጴዛዎች፣ ብርጭቆዎች እና ሌሎች ንብረቶች ክትትል'
                    : 'Manage physical inventory: chairs, tables, glassware, and cafe equipment'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadMaterials(false)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-cream-50 dark:hover:bg-slate-800 transition"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? (isAmharic ? 'በመጫን ላይ...' : 'Syncing...') : (isAmharic ? 'አድስ' : 'Refresh')}</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 rounded-xl bg-restaurant-accent px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-restaurant-accent-dark transition"
            >
              <Plus size={16} />
              <span>{isAmharic ? 'አዲስ እቃ መዝግብ' : 'Add Material'}</span>
            </button>
          </div>
        </div>

        {/* ALERTS */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* DATABASE SETUP ALERT FOR VERCEL PRODUCTION */}
        {tableNotCreated && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/90 dark:border-amber-700/60 dark:bg-amber-950/40 p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 shrink-0 mt-0.5">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                    {isAmharic ? 'ለ Vercel ፕሮዳክሽን የዳታቤዝ ማስተካከያ' : 'Notice for Vercel Production Hosting'}
                  </h3>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                    {isAmharic
                      ? 'የ "cafe_materials" ሠንጠረዥ በ Supabase ዳታቤዝዎ ውስጥ ገና አልተፈጠረም። በ Vercel ፕሮዳክሽን ላይ በቋሚነት እንዲሰራ ከታች ያለውን የ SQL ኮድ በ Supabase SQL Editor ውስጥ ያሂዱ።'
                      : 'The "cafe_materials" table has not been created yet in your Supabase database. Because Vercel functions have a read-only filesystem, this SQL script must be run once in your Supabase SQL Editor so your cafe materials permanently persist in production.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSqlDetails(!showSqlDetails)}
                  className="px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
                >
                  {showSqlDetails ? (isAmharic ? 'ኮዱን ደብቅ' : 'Hide SQL') : (isAmharic ? 'ኮዱን አሳይ' : 'View SQL')}
                </button>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-sm transition"
                >
                  <Copy size={13} />
                  <span>{copiedSql ? (isAmharic ? 'ተገልብጧል!' : 'Copied!') : (isAmharic ? 'SQL ቅዳ' : 'Copy SQL')}</span>
                </button>
              </div>
            </div>

            {showSqlDetails && (
              <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-800">
                <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-48 leading-relaxed">
                  {CAFE_MATERIALS_SQL}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-2xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {isAmharic ? 'የእቃዎች አይነት' : 'Material Types'}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-restaurant-text dark:text-white">
                {stats.totalDistinct}
              </span>
              <span className="text-[11px] text-gray-400">items</span>
            </div>
          </div>

          <div className="rounded-2xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {isAmharic ? 'አጠቃላይ ብዛት' : 'Total Units'}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-restaurant-accent">
                {stats.totalUnits}
              </span>
              <span className="text-[11px] text-gray-400">pieces / units</span>
            </div>
          </div>

          <div className="rounded-2xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {isAmharic ? 'በጥሩ ሁኔታ ላይ' : 'Good Condition'}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.goodCount}
              </span>
              <span className="text-[11px] text-gray-400">items</span>
            </div>
          </div>

          <div className="rounded-2xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              {isAmharic ? 'ጥገና / የተበላሸ' : 'Needs Repair / Damaged'}
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.repairCount}
              </span>
              <span className="text-[11px] text-gray-400">items</span>
            </div>
          </div>
        </div>

        {/* SEARCH AND FILTERS */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-cream-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAmharic ? 'እቃዎችን፣ ቦታዎችን ፈልግ...' : 'Search materials by name, location...'}
              className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 pl-10 pr-4 py-2 text-xs text-restaurant-text dark:text-white outline-none focus:border-restaurant-accent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-restaurant-accent"
            >
              <option value="all">{isAmharic ? 'ሁሉም ምድቦች' : 'All Categories'}</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="rounded-xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 outline-none focus:border-restaurant-accent"
            >
              <option value="all">{isAmharic ? 'ሁሉም ሁኔታ' : 'All Conditions'}</option>
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {isAmharic ? c.amLabel : c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* MATERIALS LIST / GRID */}
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-xs">
            {isAmharic ? 'ቁሳቁሶችን በመጫን ላይ...' : 'Loading cafe materials...'}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
            <Boxes size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
              {isAmharic ? 'ምንም እቃ አልተገኘም' : 'No cafe materials found'}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {isAmharic
                ? 'አዲስ እቃ ለመመዝገብ "አዲስ እቃ መዝግብ" የሚለውን ይጫኑ'
                : 'Click "Add Material" above to record chairs, tables, or equipment.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:border-restaurant-accent/50 hover:shadow-md transition"
              >
                <div>
                  {/* CARD HEADER */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-restaurant-accent">
                        {item.category}
                      </span>
                      <h3 className="text-sm font-bold text-restaurant-text dark:text-white mt-0.5 line-clamp-1">
                        {item.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                        title="Edit material"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                        title="Delete material"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* LOCATION & NOTES */}
                  <div className="mt-2 space-y-1">
                    {item.location && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <MapPin size={11} className="shrink-0 text-gray-400" />
                        <span className="truncate">{item.location}</span>
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-[11px] text-gray-400 italic line-clamp-2">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* BOTTOM: QUANTITY ADJUSTMENT & CONDITION BADGE */}
                <div className="mt-4 pt-3 border-t border-cream-100 dark:border-slate-800 flex items-center justify-between">
                  <div>{getConditionBadge(item.condition)}</div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAdjustQuantity(item, -1)}
                      disabled={item.quantity <= 0}
                      className="text-gray-400 hover:text-restaurant-text dark:hover:text-white disabled:opacity-20 transition"
                      title="Decrease by 1"
                    >
                      <MinusCircle size={17} />
                    </button>

                    <span className="text-xs font-bold text-restaurant-text dark:text-white min-w-[2.5rem] text-center">
                      {item.quantity} <span className="text-[10px] font-normal text-gray-400">{item.unit}</span>
                    </span>

                    <button
                      onClick={() => handleAdjustQuantity(item, 1)}
                      className="text-gray-400 hover:text-restaurant-text dark:hover:text-white transition"
                      title="Increase by 1"
                    >
                      <PlusCircle size={17} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ADD / EDIT MODAL */}
        {(showAddModal || editingItem) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-cream-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-cream-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-restaurant-accent/10 text-restaurant-accent">
                    <Boxes size={20} />
                  </div>
                  <h3 className="text-base font-bold text-restaurant-text dark:text-white">
                    {editingItem
                      ? isAmharic ? 'የእቃ መረጃ አሻሽል' : 'Edit Cafe Material'
                      : isAmharic ? 'አዲስ እቃ መዝግብ' : 'Add New Cafe Material'}
                  </h3>
                </div>

                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingItem(null)
                    setError('')
                  }}
                  className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveMaterial} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isAmharic ? 'የእቃው ስም' : 'Item Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Dining Chairs, Water Glasses, Coffee Cups..."
                    className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs text-restaurant-text dark:text-white outline-none focus:border-restaurant-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {isAmharic ? 'ምድብ' : 'Category'}
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs text-restaurant-text dark:text-white outline-none focus:border-restaurant-accent"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {isAmharic ? 'ቦታ' : 'Location in Cafe'}
                    </label>
                    <input
                      type="text"
                      list="locations-list"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="e.g. Main Dining Area"
                      className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs text-restaurant-text dark:text-white outline-none focus:border-restaurant-accent"
                    />
                    <datalist id="locations-list">
                      {LOCATIONS.map((loc) => (
                        <option key={loc} value={loc} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {isAmharic ? 'ብዛት' : 'Quantity'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(e.target.value)}
                      className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs text-restaurant-text dark:text-white outline-none focus:border-restaurant-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {isAmharic ? 'መለኪያ' : 'Unit'}
                    </label>
                    <input
                      type="text"
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      placeholder="pcs, sets, boxes"
                      className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs text-restaurant-text dark:text-white outline-none focus:border-restaurant-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      {isAmharic ? 'ሁኔታ' : 'Condition'}
                    </label>
                    <select
                      value={formCondition}
                      onChange={(e) => setFormCondition(e.target.value as any)}
                      className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs text-restaurant-text dark:text-white outline-none focus:border-restaurant-accent"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {isAmharic ? c.amLabel : c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isAmharic ? 'ተጨማሪ ማስታወሻ' : 'Notes / Description'}
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Model, serial number, supplier details..."
                    className="w-full rounded-xl border border-cream-200 dark:border-slate-800 bg-cream-50/40 dark:bg-slate-800/40 p-2.5 text-xs text-restaurant-text dark:text-white outline-none focus:border-restaurant-accent"
                  />
                </div>

                {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setEditingItem(null)
                      setError('')
                    }}
                    className="flex-1 rounded-xl border border-gray-200 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    {isAmharic ? 'ሰርዝ' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-xl bg-restaurant-accent px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
                  >
                    {saving
                      ? isAmharic ? 'በማስቀመጥ ላይ...' : 'Saving...'
                      : isAmharic ? 'አስቀምጥ' : 'Save Material'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION MODAL */}
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-cream-200 dark:border-slate-800">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-3">
                <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-950/50">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-restaurant-text dark:text-white">
                    {isAmharic ? 'እቃውን መሰረዝ ይፈልጋሉ?' : 'Delete Material?'}
                  </h3>
                  <p className="text-xs text-gray-500">{itemToDelete.name}</p>
                </div>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                {isAmharic
                  ? 'ይህንን እቃ ከስርዓቱ በቋሚነት መሰረዝ ይፈልጋሉ? ይህ እርምጃ ሊመለስ አይችልም።'
                  : 'Are you sure you want to delete this material record? This action cannot be undone.'}
              </p>

              {error && <div className="mb-4 text-xs text-red-600 dark:text-red-400">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setItemToDelete(null)
                    setError('')
                  }}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-gray-200 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  {isAmharic ? 'ተመለስ' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {saving ? (isAmharic ? 'በመሰረዝ ላይ...' : 'Deleting...') : (isAmharic ? 'አዎ ሰርዝ' : 'Yes, Delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
