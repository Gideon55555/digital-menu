'use client';

import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext';
import {
  History,
  XCircle,
  CheckCircle2,
  Receipt,
  Search,
  RefreshCw,
  User,
  Layers,
  Copy,
  Check,
  Filter,
  FileText,
  Clock,
} from 'lucide-react';

export interface ActionLogItem {
  id: string;
  action_type: 'ORDER_CANCELLED' | 'ORDER_PAID' | 'ORDER_UPDATED' | 'EXPENSE_ADDED' | 'EXPENSE_DELETED' | 'INVENTORY_UPDATED' | 'GENERAL';
  description: string;
  performed_by: string;
  role: string;
  target_id?: string | null;
  metadata?: any;
  created_at: string;
}

const ACTION_LOGS_SQL = `-- Run this SQL script in your Supabase SQL Editor to create the action_logs table:
CREATE TABLE IF NOT EXISTS public.action_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  performed_by TEXT DEFAULT 'Staff User',
  role TEXT DEFAULT 'admin',
  target_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- Allow public read and insert
CREATE POLICY "Allow public read and write to action_logs"
  ON public.action_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);
`;

export default function ActivityLogPage() {
  const { isAmharic } = useAdminLanguage();

  const [logs, setLogs] = useState<ActionLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Fetch Action Logs
  const fetchLogs = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams();
      if (activeFilter !== 'all') params.set('action_type', activeFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/activity-log?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();

      if (json.success) {
        setLogs(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(ACTION_LOGS_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const getActionBadge = (type: string) => {
    switch (type) {
      case 'ORDER_CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
            <XCircle className="h-3.5 w-3.5" />
            {isAmharic ? 'ትዕዛዝ ተሰርዟል' : 'Order Cancelled'}
          </span>
        );
      case 'ORDER_PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isAmharic ? 'ትዕዛዝ ተከፍሏል' : 'Order Paid'}
          </span>
        );
      case 'EXPENSE_ADDED':
      case 'EXPENSE_DELETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
            <Receipt className="h-3.5 w-3.5" />
            {isAmharic ? 'ዕለታዊ ወጪ' : 'Daily Cost'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
            <FileText className="h-3.5 w-3.5" />
            {isAmharic ? 'የስርዓት ድርጊት' : 'System Action'}
          </span>
        );
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(isAmharic ? 'am-ET' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 shadow-sm">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-stone-900 dark:text-white tracking-tight">
                {isAmharic ? 'የድርጊት መዝገብ (Action Log)' : 'Action & Activity Log'}
              </h1>
              <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
                {isAmharic
                  ? 'የተሰረዙ ትዕዛዞች፣ የክፍያ ውሳኔዎች እና የሰራተኞች ድርጊት መዝገብ'
                  : 'Complete audit history of cancelled orders, payments, and system operational changes'}
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-slate-700 transition shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {isAmharic ? 'አድስ' : 'Refresh Logs'}
          </button>
        </div>

        {/* SEARCH AND FILTER CONTROLS */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAmharic ? 'መዝገብ በቃላት፣ በትዕዛዝ ቁጥር ወይም በሰራተኛ ፈልግ...' : 'Search logs by description, order #, staff...'}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-stone-100 dark:bg-slate-800 p-1.5 rounded-xl">
              <Filter className="h-4 w-4 text-stone-400 ml-1 mr-0.5 hidden sm:inline" />
              {(
                [
                  { id: 'all', en: 'All Actions', am: 'ሁሉም' },
                  { id: 'ORDER_CANCELLED', en: 'Cancelled Orders', am: 'የተሰረዙ ትዕዛዞች' },
                  { id: 'ORDER_PAID', en: 'Paid Orders', am: 'የተከፈሉ ትዕዛዞች' },
                  { id: 'EXPENSE_ADDED', en: 'Expenses', am: 'ወጪዎች' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    activeFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  {isAmharic ? tab.am : tab.en}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* LOGS TABLE / TIMELINE */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 p-6 shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-stone-500 dark:text-stone-400 text-sm">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
              {isAmharic ? 'የድርጊት መዝገቦችን በመጫን ላይ...' : 'Loading action logs...'}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-stone-400 dark:text-stone-500 text-sm">
              <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-stone-600 dark:text-stone-400">
                {isAmharic ? 'ምንም የተመዘገበ ድርጊት አልተገኘም' : 'No action logs found'}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                {isAmharic ? 'ትዕዛዞች ሲሰረዙ፣ ሲከፈሉ ወይም ወጪዎች ሲመዘገቡ እዚህ ይታያሉ።' : 'Cancelled orders, payments, and system changes will appear here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
                <thead className="bg-stone-50 dark:bg-slate-800 text-stone-500 dark:text-stone-400 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4 rounded-l-xl">{isAmharic ? 'ጊዜ (Timestamp)' : 'Timestamp'}</th>
                    <th className="py-3.5 px-4">{isAmharic ? 'የድርጊት አይነት' : 'Action Type'}</th>
                    <th className="py-3.5 px-4">{isAmharic ? 'መግለጫ (Description)' : 'Description / Details'}</th>
                    <th className="py-3.5 px-4">{isAmharic ? 'ያከናወነው አካል' : 'Performed By'}</th>
                    <th className="py-3.5 px-4 text-center rounded-r-xl">{isAmharic ? 'ኢላማ ID' : 'Target ID'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-stone-50/60 dark:hover:bg-slate-800/50 transition">
                      <td className="py-3.5 px-4 font-mono text-stone-500 dark:text-stone-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                          <span>{formatDate(log.created_at)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getActionBadge(log.action_type)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-white max-w-md">
                        {log.description}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 dark:bg-slate-700 text-stone-700 dark:text-stone-300 text-[10px] font-bold">
                            <User className="h-3 w-3" />
                          </div>
                          <span className="font-semibold text-stone-800 dark:text-stone-200">
                            {log.performed_by || 'System Staff'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-slate-800 text-stone-500 font-mono">
                            {log.role || 'user'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-stone-400 text-[11px]">
                        {log.target_id ? (
                          <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300">
                            {log.target_id.slice(0, 8)}...
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* DATABASE MIGRATION SQL BANNER */}
        <div className="bg-slate-900 dark:bg-black p-6 rounded-2xl text-white space-y-4 border border-slate-800 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Layers className="h-4 w-4" />
                <span>{isAmharic ? 'የዳታቤዝ መዋቅር (Supabase SQL)' : 'Database Migration SQL Command'}</span>
              </div>
              <h3 className="text-base font-bold">
                {isAmharic ? 'የ \"action_logs\" ሠንጠረዥ በ Supabase ውስጥ መፈጠሩን ያረጋግጡ' : 'Ensure table "action_logs" is created in Supabase'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isAmharic
                  ? 'ከታች ያለውን የ SQL ኮድ በ Supabase SQL Editor ውስጥ ያሂዱ።'
                  : 'Run the following SQL code in your Supabase SQL Editor to enable permanent audit logging.'}
              </p>
            </div>

            <button
              onClick={handleCopySql}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition self-start sm:self-auto shrink-0 shadow-md"
            >
              {copiedSql ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedSql ? (isAmharic ? 'ተገልብጧል!' : 'Copied!') : (isAmharic ? 'SQL ኮፒ አድርግ' : 'Copy SQL Command')}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 text-slate-300 text-xs font-mono overflow-x-auto border border-slate-800">
            <code>{ACTION_LOGS_SQL}</code>
          </pre>
        </div>
      </div>
    </AdminLayout>
  );
}
