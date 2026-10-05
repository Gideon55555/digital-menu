'use client';

import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext';
import {
  Receipt,
  Plus,
  Trash2,
  Calendar,
  TrendingDown,
  Layers,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Wallet,
} from 'lucide-react';

export interface DailyExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
  created_at?: string;
}

const CATEGORY_OPTIONS = [
  { value: 'groceries', labelEn: 'Groceries / Food', labelAm: 'ግሮሰሪ / ምግብ' },
  { value: 'supplies', labelEn: 'Supplies & Packaging', labelAm: 'ቁሳቁስ እና ማሸጊያ' },
  { value: 'utilities', labelEn: 'Utilities (Water, Power)', labelAm: 'መብራት / ውሃ' },
  { value: 'salary', labelEn: 'Staff Salary / Advance', labelAm: 'ደመወዝ / ቅድመ ክፍያ' },
  { value: 'maintenance', labelEn: 'Maintenance / Repair', labelAm: 'ጥገና' },
  { value: 'general', labelEn: 'General / Other', labelAm: 'ልዩ ልዩ' },
];

const DAILY_EXPENSES_SQL = `-- Run this SQL query in your Supabase SQL Editor to create the daily_expenses table:
CREATE TABLE IF NOT EXISTS public.daily_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  category TEXT DEFAULT 'general',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.daily_expenses ENABLE ROW LEVEL SECURITY;

-- Allow read & write access
CREATE POLICY "Allow public read and write to daily_expenses"
  ON public.daily_expenses
  FOR ALL
  USING (true)
  WITH CHECK (true);
`;

export default function DailyExpensesPage() {
  const { isAmharic } = useAdminLanguage();

  // Period filter for the table
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month' | 'all'>('today');

  // Expenses data state
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);

  // Summary KPI states
  const [todayTotal, setTodayTotal] = useState<number>(0);
  const [weekTotal, setWeekTotal] = useState<number>(0);
  const [monthTotal, setMonthTotal] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form input states (Item and Price)
  const [item, setItem] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('groceries');
  const [expenseDate, setExpenseDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Format currency helper
  const money = (val: number) => {
    const formatted = val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isAmharic ? `${formatted} ብር` : `ETB ${formatted}`;
  };

  // Fetch expenses for a specific period
  const fetchExpenses = useCallback(async (period: 'today' | 'week' | 'month' | 'all', isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetch(`/api/daily-expenses?period=${period}`, { cache: 'no-store' });
      const json = await res.json();

      if (json.success) {
        const list = json.expenses || json.data || [];
        setExpenses(list);
        setTotalExpenses(json.totalExpenses || json.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch KPI totals (Today, Week, Month)
  const fetchKpis = useCallback(async () => {
    try {
      const [todayRes, weekRes, monthRes] = await Promise.all([
        fetch('/api/daily-expenses?period=today', { cache: 'no-store' }),
        fetch('/api/daily-expenses?period=week', { cache: 'no-store' }),
        fetch('/api/daily-expenses?period=month', { cache: 'no-store' }),
      ]);

      const [todayJson, weekJson, monthJson] = await Promise.all([
        todayRes.json(),
        weekRes.json(),
        monthRes.json(),
      ]);

      if (todayJson.success) setTodayTotal(todayJson.totalExpenses || todayJson.total || 0);
      if (weekJson.success) setWeekTotal(weekJson.totalExpenses || weekJson.total || 0);
      if (monthJson.success) setMonthTotal(monthJson.totalExpenses || monthJson.total || 0);
    } catch (e) {
      console.error('Error fetching KPI totals:', e);
    }
  }, []);

  useEffect(() => {
    fetchExpenses(activeTab);
    fetchKpis();
  }, [activeTab, fetchExpenses, fetchKpis]);

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (!item.trim()) {
      setFormError(isAmharic ? 'እባክዎ የእቃውን መግለጫ ያስገቡ' : 'Please enter item description');
      return;
    }

    const priceNum = Number(price);
    if (!price || isNaN(priceNum) || priceNum <= 0) {
      setFormError(isAmharic ? 'እባክዎ ትክክለኛ ዋጋ ያስገቡ' : 'Please enter a valid price amount');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/daily-expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: item.trim(),
          price: priceNum,
          category,
          expense_date: expenseDate,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save expense');
      }

      setSuccessMsg(isAmharic ? 'ዕለታዊ ወጪ በስኬት ተመዝግቧል!' : 'Daily cost saved successfully!');
      setItem('');
      setPrice('');
      
      // Refresh current view & KPIs
      await Promise.all([fetchExpenses(activeTab, true), fetchKpis()]);

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Submit expense error:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string, description: string) => {
    const confirmText = isAmharic
      ? `እርግጠኛ ነዎት "${description}" የሚለውን ወጪ ማጥፋት ይፈልጋሉ?`
      : `Are you sure you want to delete "${description}"?`;

    if (!window.confirm(confirmText)) return;

    try {
      setDeletingId(id);
      const res = await fetch(`/api/daily-expenses?id=${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete expense');
      }

      await Promise.all([fetchExpenses(activeTab, true), fetchKpis()]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete expense');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(DAILY_EXPENSES_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 shadow-sm">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-stone-900 dark:text-white tracking-tight">
                {isAmharic ? 'ዕለታዊ ወጪዎች' : 'Daily Costs & Outflows'}
              </h1>
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
                {isAmharic
                  ? 'የዕለቱ፣ የሳምንቱ እና የወሩ የገንዘብ ወጪዎችን ይመዝግቡ እና ይቆጣጠሩ'
                  : 'Track and record daily restaurant expenses, groceries, and operating costs'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              fetchExpenses(activeTab, true);
              fetchKpis();
            }}
            disabled={refreshing}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-slate-700 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {isAmharic ? 'አድስ' : 'Refresh'}
          </button>
        </div>

        {/* TOP KPI CARDS: Today, Week, Month Costs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Today's Cost */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-l-4 border-l-rose-500 border border-stone-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  {isAmharic ? 'የዛሬ ዕለታዊ ወጪ' : "Today's Daily Cost"}
                </span>
                <h3 className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-white tracking-tight">
                  {money(todayTotal)}
                </h3>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {isAmharic ? 'የዛሬ የተመዘገቡ ወጪዎች ድምር' : 'Expenses recorded for today'}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* This Week's Cost */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-l-4 border-l-amber-500 border border-stone-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {isAmharic ? 'የዚህ ሳምንት ወጪ' : "This Week's Cost"}
                </span>
                <h3 className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-white tracking-tight">
                  {money(weekTotal)}
                </h3>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {isAmharic ? 'ያለፉት 7 ቀናት ወጪዎች ድምር' : 'Expenses for past 7 days'}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* This Month's Cost */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-l-4 border-l-purple-500 border border-stone-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  {isAmharic ? 'የዚህ ወር ወጪ' : "This Month's Cost"}
                </span>
                <h3 className="mt-2 text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-white tracking-tight">
                  {money(monthTotal)}
                </h3>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {isAmharic ? 'የዚህ ወር ጠቅላላ ወጪ' : 'Expenses for current month'}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          </div>
        </div>

        {/* INPUT FORM: Accept Item and Price */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-stone-100 dark:border-slate-800">
            <Plus className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">
              {isAmharic ? 'አዲስ ወጪ መመዝገቢያ' : 'Record New Daily Cost'}
            </h2>
          </div>

          {formError && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Item / Description Input */}
            <div className="md:col-span-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1">
                {isAmharic ? 'የእቃ / ወጪ ስም (Item)' : 'Item Name / Description'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder={isAmharic ? 'ለምሳሌ፡ አትክልቶች፣ ቡና ፍሬ፣ ወተት...' : 'e.g., Vegetables, Coffee Beans, Milk...'}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
                required
              />
            </div>

            {/* Price Input */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1">
                {isAmharic ? 'ዋጋ / መጠን (Price ETB)' : 'Price / Amount (ETB)'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-4 pr-12 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition font-mono font-bold"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                  ETB
                </span>
              </div>
            </div>

            {/* Category Dropdown */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1">
                {isAmharic ? 'ምድብ (Category)' : 'Category'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {isAmharic ? opt.labelAm : opt.labelEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Input */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1">
                {isAmharic ? 'ቀን (Date)' : 'Date'}
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
              />
            </div>

            {/* Submit Button */}
            <div className="md:col-span-12 flex justify-end mt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>{isAmharic ? 'በማስቀመጥ ላይ...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>{isAmharic ? 'ወጪ መዝግብ' : 'Save Daily Cost'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* EXPENSES LIST & TIMEFRAME TABS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-rose-500" />
                {isAmharic ? 'የተመዘገቡ ዕለታዊ ወጪዎች' : 'Recorded Daily Costs'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {isAmharic
                  ? 'የመረጡትን ጊዜ ወጪዎች ዝርዝር ያያሉ'
                  : 'Filter and inspect costs by day, week, month, or all time'}
              </p>
            </div>

            {/* Timeframe Filter Tabs */}
            <div className="flex items-center gap-1 bg-stone-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
              {(
                [
                  { id: 'today', en: 'Today', am: 'ዛሬ' },
                  { id: 'week', en: 'This Week', am: 'በዚህ ሳምንት' },
                  { id: 'month', en: 'This Month', am: 'በዚህ ወር' },
                  { id: 'all', en: 'All Time', am: 'ሁሉም' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  {isAmharic ? tab.am : tab.en}
                </button>
              ))}
            </div>
          </div>

          {/* Table view */}
          {loading ? (
            <div className="py-12 text-center text-stone-500 dark:text-stone-400 text-sm">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-rose-500" />
              {isAmharic ? 'ወጪዎችን በመጫን ላይ...' : 'Loading daily expenses...'}
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center text-stone-400 dark:text-stone-500 text-sm">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-stone-600 dark:text-stone-400">
                {isAmharic ? 'በዚህ ጊዜ ውስጥ ምንም የተመዘገበ ወጪ የለም' : 'No expenses recorded for this timeframe'}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                {isAmharic ? 'ከላይ ያለውን ቅጽ በመጠቀም አዲስ ወጪ ያስገቡ' : 'Use the form above to add an item and price.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
                <thead className="bg-stone-50 dark:bg-slate-800 text-stone-500 dark:text-stone-400 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4 rounded-l-xl">{isAmharic ? 'ቀን' : 'Date'}</th>
                    <th className="py-3 px-4">{isAmharic ? 'የእቃ / ወጪ ስም' : 'Item Description'}</th>
                    <th className="py-3 px-4">{isAmharic ? 'ምድብ' : 'Category'}</th>
                    <th className="py-3 px-4 text-right">{isAmharic ? 'ዋጋ (Price)' : 'Price (ETB)'}</th>
                    <th className="py-3 px-4 text-center rounded-r-xl">{isAmharic ? 'ተግባር' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                  {expenses.map((exp) => {
                    const catInfo = CATEGORY_OPTIONS.find((c) => c.value === exp.category);
                    return (
                      <tr key={exp.id} className="hover:bg-stone-50/60 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3 px-4 font-mono font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                          {exp.expense_date}
                        </td>
                        <td className="py-3 px-4 font-bold text-stone-900 dark:text-white">
                          {exp.description}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300">
                            {isAmharic ? catInfo?.labelAm || exp.category : catInfo?.labelEn || exp.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 text-sm whitespace-nowrap">
                          -{money(Number(exp.amount))}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleDelete(exp.id, exp.description)}
                            disabled={deletingId === exp.id}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                            title={isAmharic ? 'ወጪውን ሰርዝ' : 'Delete expense'}
                          >
                            {deletingId === exp.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-stone-200 dark:border-slate-700 bg-stone-50/50 dark:bg-slate-800/30">
                  <tr>
                    <td colSpan={3} className="py-3.5 px-4 font-bold text-stone-900 dark:text-white uppercase tracking-wider text-xs">
                      {isAmharic ? 'ጠቅላላ የተመዘገበ ወጪ:' : 'Total Period Cost:'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-serif font-bold text-rose-700 dark:text-rose-400 text-base whitespace-nowrap">
                      -{money(totalExpenses)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* DATABASE SETUP SQL BANNER */}
        <div className="bg-slate-900 dark:bg-black p-6 rounded-2xl text-white space-y-4 border border-slate-800 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Layers className="h-4 w-4" />
                <span>{isAmharic ? 'የዳታቤዝ መዋቅር ማስታወሻ (Supabase SQL)' : 'Database Migration SQL Command'}</span>
              </div>
              <h3 className="text-base font-bold">
                {isAmharic ? 'የ \"daily_expenses\" ሠንጠረዥ በ Supabase ዳታቤዝዎ ውስጥ መፈጠሩን ያረጋግጡ' : 'Ensure table "daily_expenses" is created in Supabase'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isAmharic
                  ? 'ከታች ያለውን የ SQL ኮድ ኮፒ በማድረግ በ Supabase SQL Editor ውስጥ ያሂዱ።'
                  : 'Run the following SQL statement in your Supabase SQL Editor to enable daily expenses tracking.'}
              </p>
            </div>

            <button
              onClick={handleCopySql}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition self-start sm:self-auto shrink-0 shadow-md"
            >
              {copiedSql ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedSql ? (isAmharic ? 'ተገልብጧል!' : 'Copied!') : (isAmharic ? 'SQL ኮፒ አድርግ' : 'Copy SQL Command')}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 text-slate-300 text-xs font-mono overflow-x-auto border border-slate-800">
            <code>{DAILY_EXPENSES_SQL}</code>
          </pre>
        </div>
      </div>
    </AdminLayout>
  );
}
