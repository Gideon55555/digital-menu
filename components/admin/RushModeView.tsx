'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  Table2,
  CheckCircle2,
  CreditCard,
  Plus,
  Minus,
  Trash2,
  Search,
  Pencil,
  RefreshCw,
  ShoppingBag,
  X,
  AlertCircle,
  Camera,
  Check,
  ChefHat,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext';
import { compressReceiptImage } from '@/lib/utils/image';

type LocalizedName =
  | string
  | {
      en?: string;
      am?: string;
    };

export type RushOrderItem = {
  id?: string;
  order_id?: string;
  menu_item_id?: string;
  item_name?: LocalizedName;
  unit_price?: number;
  quantity: number;
  subtotal?: number;
  notes?: string | null;
  status?: string;
};

export type RushOrder = {
  id: string;
  order_number: string | number;
  table_id: string | null;
  status: string;
  order_type?: string;
  waiter_id?: string | null;
  waiter_name?: string | null;
  customer_name?: string | null;
  notes?: string | null;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total: number;
  created_at: string;
  items?: RushOrderItem[];
  payment?: {
    id: string;
    payment_method: string;
    amount: number;
    tip_amount?: number;
    payment_status?: string;
  } | null;
};

export type RushTable = {
  id: string;
  table_number: string;
  name?: string | null;
  capacity?: number;
  active?: boolean;
};

export type RushCategory = {
  id: string;
  name: {
    en: string;
    am?: string;
  };
  type?: 'food' | 'drink';
  displayOrder?: number;
  visible?: boolean;
};

export type RushMenuItem = {
  id: string;
  categoryId: string;
  name: {
    en: string;
    am?: string;
  };
  description?: {
    en: string;
    am?: string;
  };
  price: number;
  currency?: string;
  image?: string | null;
  available: boolean;
};

type CartItemDraft = {
  menuItemId: string;
  name: { en: string; am?: string };
  price: number;
  quantity: number;
  notes: string;
};

interface RushModeViewProps {
  orders: RushOrder[];
  tables: RushTable[];
  categories: RushCategory[];
  menuItems: RushMenuItem[];
  currentRole?: string;
  currentWaiter?: { id: string; name: string | null; email: string };
  onRefresh: () => Promise<void> | void;
  onExitRushMode: () => void;
}

export function RushModeView({
  orders,
  tables,
  categories,
  menuItems,
  currentRole = 'cashier',
  currentWaiter,
  onRefresh,
  onExitRushMode,
}: RushModeViewProps) {
  const { isAmharic } = useAdminLanguage();

  // Helper for localized text
  const getLocalizedName = (name: LocalizedName | undefined) => {
    if (!name) return 'Item';
    if (typeof name === 'string') return name;
    if (isAmharic && name.am) return name.am;
    return name.en || 'Item';
  };

  // State
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<'all' | 'active' | 'free'>('all');

  // Draft Cart for current table (when creating a new order)
  const [draftCart, setDraftCart] = useState<CartItemDraft[]>([]);
  const [draftNotes, setDraftNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Edit Order Mode for active order
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editItems, setEditItems] = useState<RushOrderItem[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Processing state for dynamic progression button
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  // Payment Modal State
  const [paymentOrder, setPaymentOrder] = useState<RushOrder | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'cbe' | 'telebirr'>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [compressingReceipt, setCompressingReceipt] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Active orders map by table_id (filtering out completed/paid/cancelled)
  const activeOrdersByTable = useMemo(() => {
    const map = new Map<string, RushOrder>();
    orders.forEach((ord) => {
      if (!ord.table_id) return;
      const st = ord.status.toLowerCase();
      if (st !== 'completed' && st !== 'paid' && st !== 'cancelled') {
        // keep the most recent active order for this table
        if (!map.has(ord.table_id)) {
          map.set(ord.table_id, ord);
        }
      }
    });
    return map;
  }, [orders]);

  // Set default selected table if none is selected
  useEffect(() => {
    if (!selectedTableId && tables.length > 0) {
      setSelectedTableId(tables[0].id);
    }
  }, [tables, selectedTableId]);

  // Reset cart / edit state when selected table changes
  const activeOrderForSelectedTable = selectedTableId ? activeOrdersByTable.get(selectedTableId) : null;

  useEffect(() => {
    setDraftCart([]);
    setDraftNotes('');
    setIsEditingOrder(false);
    if (activeOrderForSelectedTable && activeOrderForSelectedTable.items) {
      setEditItems(
        activeOrderForSelectedTable.items.map((it) => ({
          ...it,
          quantity: it.quantity || 1,
        }))
      );
    } else {
      setEditItems([]);
    }
  }, [selectedTableId, activeOrderForSelectedTable]);

  // Filtered tables
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const hasActive = activeOrdersByTable.has(t.id);
      if (tableFilter === 'active') return hasActive;
      if (tableFilter === 'free') return !hasActive;
      return true;
    });
  }, [tables, activeOrdersByTable, tableFilter]);

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.available) return false;
      if (selectedCategoryId !== 'all' && item.categoryId !== selectedCategoryId) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const enName = item.name.en?.toLowerCase() || '';
        const amName = item.name.am?.toLowerCase() || '';
        return enName.includes(query) || amName.includes(query);
      }
      return true;
    });
  }, [menuItems, selectedCategoryId, searchQuery]);

  // Handlers for draft cart (new order)
  const addToDraftCart = (item: RushMenuItem) => {
    setDraftCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) => (c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          notes: '',
        },
      ];
    });
  };

  const updateDraftQty = (menuItemId: string, delta: number) => {
    setDraftCart((prev) =>
      prev
        .map((item) => {
          if (item.menuItemId === menuItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItemDraft[]
    );
  };

  // Handlers for Edit Order (active order)
  const addItemToActiveOrderEdit = (menuItem: RushMenuItem) => {
    if (!activeOrderForSelectedTable) return;
    setEditItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.menu_item_id === menuItem.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          quantity: copy[existingIdx].quantity + 1,
          subtotal: (copy[existingIdx].unit_price || menuItem.price) * (copy[existingIdx].quantity + 1),
        };
        return copy;
      }
      return [
        ...prev,
        {
          menu_item_id: menuItem.id,
          item_name: menuItem.name,
          unit_price: menuItem.price,
          quantity: 1,
          subtotal: menuItem.price,
          notes: null,
          status: 'pending',
        },
      ];
    });
  };

  const updateEditItemQty = (index: number, delta: number) => {
    setEditItems((prev) => {
      const copy = [...prev];
      const newQty = copy[index].quantity + delta;
      if (newQty <= 0) {
        copy.splice(index, 1);
        return copy;
      }
      const uPrice = copy[index].unit_price || 0;
      copy[index] = {
        ...copy[index],
        quantity: newQty,
        subtotal: uPrice * newQty,
      };
      return copy;
    });
  };

  const removeEditItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit New Order for Table
  const handleCreateOrder = async () => {
    if (!selectedTableId || draftCart.length === 0) return;
    try {
      setSubmittingOrder(true);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: selectedTableId,
          order_type: 'dine_in',
          waiter_id: currentWaiter?.id || null,
          waiter_name: currentWaiter?.name || null,
          notes: draftNotes || null,
          creator_role: currentRole,
          items: draftCart.map((c) => ({
            menu_item_id: c.menuItemId,
            quantity: c.quantity,
            notes: c.notes || null,
          })),
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to create order');
      }

      setDraftCart([]);
      setDraftNotes('');
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error placing order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Save Modified Order
  const handleSaveModifiedOrder = async () => {
    if (!activeOrderForSelectedTable) return;
    if (editItems.length === 0) {
      alert(isAmharic ? 'ትዕዛዝ ቢያንስ አንድ እቃ ሊኖረው ይገባል' : 'An order must contain at least one item');
      return;
    }
    try {
      setSavingEdit(true);
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeOrderForSelectedTable.id,
          action: 'modify_order',
          user_role: currentRole,
          items: editItems.map((item) => ({
            menu_item_id: item.menu_item_id,
            item_name: typeof item.item_name === 'object' ? item.item_name.en : item.item_name,
            unit_price: item.unit_price,
            quantity: item.quantity,
            notes: item.notes || null,
            status: item.status || 'pending',
          })),
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to save order modification');
      }

      setIsEditingOrder(false);
      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error updating order');
    } finally {
      setSavingEdit(false);
    }
  };

  // Dynamic Progression Button Action Trigger
  const handleAdvanceOrderStatus = async (order: RushOrder) => {
    const currentStatus = order.status.toLowerCase();
    let nextStatus = '';

    if (currentStatus === 'pending') {
      nextStatus = 'confirmed';
    } else if (currentStatus === 'confirmed' || currentStatus === 'preparing') {
      nextStatus = 'ready';
    } else if (currentStatus === 'ready' || currentStatus === 'served') {
      // Open Swift Payment Modal
      setPaymentOrder(order);
      setPaymentAmount(order.total.toString());
      setPaymentMethod('cash');
      setTipAmount('');
      setReceiptImage(null);
      setPaymentError('');
      return;
    }

    if (!nextStatus) return;

    try {
      setProcessingOrderId(order.id);
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          status: nextStatus,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to update order status');
      }

      await onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Submit Swift Payment
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentOrder) return;
    setPaymentError('');

    try {
      setSubmittingPayment(true);

      const parsedAmount = parseFloat(paymentAmount);
      if (isNaN(parsedAmount) || parsedAmount < paymentOrder.total) {
        setPaymentError(
          isAmharic
            ? `የተከፈለው መጠን ከጠቅላላው ሂሳብ (${paymentOrder.total} ETB) ማነስ የለበትም።`
            : `Payment amount cannot be less than total (${paymentOrder.total} ETB)`
        );
        setSubmittingPayment(false);
        return;
      }

      const parsedTip = tipAmount ? parseFloat(tipAmount) : 0;

      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: paymentOrder.id,
          status: 'paid',
          payment_method: paymentMethod,
          amount: parsedAmount,
          tip_amount: parsedTip,
          receipt_image: receiptImage,
          user_role: currentRole,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to record payment');
      }

      setPaymentOrder(null);
      await onRefresh();
    } catch (err: any) {
      setPaymentError(err.message || 'Payment submission failed');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Receipt image compress handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setCompressingReceipt(true);
      const compressed = await compressReceiptImage(file);
      setReceiptImage(compressed);
    } catch (err) {
      console.error('Receipt compression error:', err);
    } finally {
      setCompressingReceipt(false);
    }
  };

  // Helper renderer for dynamic button
  const renderDynamicProgressionButton = (order: RushOrder, fullWidth = false) => {
    const st = order.status.toLowerCase();
    const isProcessing = processingOrderId === order.id;

    if (st === 'pending') {
      return (
        <button
          onClick={() => handleAdvanceOrderStatus(order)}
          disabled={isProcessing}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-md shadow-amber-500/20 active:scale-98 transition-all ${
            fullWidth ? 'w-full text-base' : 'text-sm'
          }`}
        >
          {isProcessing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>{isAmharic ? '1. ትዕዛዝ አረጋግጥ' : '1. Confirm Order'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      );
    }

    if (st === 'confirmed' || st === 'preparing') {
      return (
        <button
          onClick={() => handleAdvanceOrderStatus(order)}
          disabled={isProcessing}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-md shadow-indigo-600/20 active:scale-98 transition-all ${
            fullWidth ? 'w-full text-base' : 'text-sm'
          }`}
        >
          {isProcessing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <ChefHat className="w-4 h-4 animate-bounce" />
              <span>{isAmharic ? '2. ማዘጋጀት ጀምር (ዝግጁ)' : '2. Start Preparing / Mark Ready'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      );
    }

    if (st === 'ready' || st === 'served') {
      return (
        <button
          onClick={() => handleAdvanceOrderStatus(order)}
          disabled={isProcessing}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/20 active:scale-98 transition-all ${
            fullWidth ? 'w-full text-base' : 'text-sm'
          }`}
        >
          {isProcessing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              <span>{isAmharic ? '3. ክፍያ አረጋግጥ (ጨርስ)' : '3. Confirm Payment & Close'}</span>
              <Check className="w-4 h-4" />
            </>
          )}
        </button>
      );
    }

    return (
      <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
        {order.status}
      </span>
    );
  };

  const selectedTable = tables.find((t) => t.id === selectedTableId);

  return (
    <div className="flex flex-col gap-5 p-3 md:p-6 bg-slate-900 text-slate-100 min-h-screen font-sans">
      {/* ========================================================= */}
      {/* RUSH MODE HEADER BANNER */}
      {/* ========================================================= */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 md:p-5 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white shadow-xl shadow-orange-600/15 border border-amber-400/30">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl animate-pulse">
            <Zap className="w-7 h-7 text-amber-200 fill-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight">
                {isAmharic ? '⚡ የችኮላ ሁኔታ (RUSH MODE POS)' : '⚡ RUSH MODE ALL-IN-ONE'}
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-white text-orange-700 rounded-full uppercase tracking-wider">
                Live Single-Page POS
              </span>
            </div>
            <p className="text-xs md:text-sm text-amber-100 font-medium">
              {isAmharic
                ? 'በአንድ ገጽ ላይ ትዕዛዝ ይቀበሉ፣ ደረጃዎችን ይለውጡ፣ ትዕዛዝ ያርትዑ እና ክፍያ ያረጋግጡ!'
                : 'Order, edit, transition stages & process payment seamlessly in real-time right here!'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            onClick={() => onRefresh()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-xs md:text-sm font-semibold backdrop-blur-md border border-white/20"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{isAmharic ? 'አድስ' : 'Refresh'}</span>
          </button>

          <button
            onClick={onExitRushMode}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-950 transition-all text-xs md:text-sm font-bold text-amber-300 border border-amber-500/30 shadow-lg"
          >
            <X className="w-4 h-4" />
            <span>{isAmharic ? 'ከችኮላ ሁኔታ ውጣ' : 'Exit Rush Mode'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TABLES BAR & STATUS SUMMARY */}
      {/* ========================================================= */}
      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Table2 className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-slate-100">
              {isAmharic ? 'ጠረጴዛዎች (ማንም ሳይወጣ ትዕዛዝ ይምረጡ)' : 'Tables (Select to Manage / Order)'}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700 text-xs font-semibold">
            <button
              onClick={() => setTableFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tableFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isAmharic ? 'ሁሉንም' : 'All'} ({tables.length})
            </button>
            <button
              onClick={() => setTableFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tableFilter === 'active'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isAmharic ? 'ትዕዛዝ ያላቸው' : 'Active'} ({activeOrdersByTable.size})
            </button>
            <button
              onClick={() => setTableFilter('free')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tableFilter === 'free'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isAmharic ? 'ነጻ' : 'Free'} ({tables.length - activeOrdersByTable.size})
            </button>
          </div>
        </div>

        {/* TABLES HORIZONTAL GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
          {filteredTables.map((t) => {
            const activeOrd = activeOrdersByTable.get(t.id);
            const isSelected = t.id === selectedTableId;
            const st = activeOrd?.status.toLowerCase();

            let badgeBg = 'bg-slate-700 border-slate-600 text-slate-300';
            if (activeOrd) {
              if (st === 'pending') badgeBg = 'bg-amber-500/20 border-amber-500 text-amber-300';
              else if (st === 'confirmed' || st === 'preparing') badgeBg = 'bg-blue-500/20 border-blue-500 text-blue-300';
              else if (st === 'ready' || st === 'served') badgeBg = 'bg-emerald-500/20 border-emerald-400 text-emerald-300';
            }

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTableId(t.id)}
                className={`relative flex flex-col justify-between p-3 rounded-xl cursor-pointer border-2 transition-all duration-200 ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/10 shadow-lg shadow-amber-500/10 ring-2 ring-amber-400/20'
                    : 'border-slate-700 bg-slate-800/90 hover:border-slate-500 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <div className="text-xs font-semibold text-slate-400">
                      {isAmharic ? 'ጠረጴዛ' : 'Table'}
                    </div>
                    <div className="text-base font-black text-white">
                      #{t.table_number}
                    </div>
                  </div>
                  {activeOrd ? (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeBg}`}
                    >
                      {activeOrd.status}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                      Free
                    </span>
                  )}
                </div>

                {activeOrd && (
                  <div className="mt-2 pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono text-[11px]">
                      #{activeOrd.order_number}
                    </span>
                    <span className="font-bold text-amber-300">
                      {activeOrd.total} ETB
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN RUSH WORKSPACE: WORKFLOW CARD + MENU CATALOG */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / TOP: SELECTED TABLE ACTIVE ORDER & PROGRESSION PANEL */}
        <div className="lg:col-span-6 xl:col-span-5 flex flex-col gap-4">
          <div className="p-5 rounded-2xl bg-slate-800/90 border border-slate-700 shadow-xl backdrop-blur-md">
            {selectedTable ? (
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-300 text-lg">
                      #{selectedTable.table_number}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {isAmharic ? `ጠረጴዛ #${selectedTable.table_number}` : `Table #${selectedTable.table_number}`}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {activeOrderForSelectedTable
                          ? `Order #${activeOrderForSelectedTable.order_number} · ${activeOrderForSelectedTable.status.toUpperCase()}`
                          : isAmharic ? 'ምንም ንቁ ትዕዛዝ የለም (ከስር ምግብ ይምረጡ)' : 'No active order (Select menu items below)'}
                      </p>
                    </div>
                  </div>

                  {activeOrderForSelectedTable && (
                    <button
                      onClick={() => setIsEditingOrder(!isEditingOrder)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        isEditingOrder
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-700/80 hover:bg-slate-700 text-amber-300 border-slate-600'
                      }`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>{isEditingOrder ? (isAmharic ? 'አርትኦት ዝጋ' : 'Close Edit') : (isAmharic ? 'ትዕዛዝ አርትዕ' : 'Edit Order')}</span>
                    </button>
                  )}
                </div>

                {/* SCENARIO A: ACTIVE ORDER EXISTS FOR THIS TABLE */}
                {activeOrderForSelectedTable ? (
                  <div className="flex flex-col gap-4">
                    {/* ORDER STAGE PROGRESSION BUTTON (SELF-UPDATING) */}
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700 flex flex-col gap-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>{isAmharic ? 'የሂደት መቆጣጠሪያ' : 'Single Progression Control'}</span>
                        <span className="text-amber-400 font-bold">{activeOrderForSelectedTable.status}</span>
                      </div>
                      {renderDynamicProgressionButton(activeOrderForSelectedTable, true)}
                    </div>

                    {/* ORDER EDITING OR VIEWING ITEMS */}
                    {isEditingOrder ? (
                      <div className="p-4 rounded-xl bg-slate-900/90 border border-amber-500/40 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                            <Pencil className="w-3.5 h-3.5" />
                            {isAmharic ? 'ትዕዛዝ በማሻሻል ላይ...' : 'Modifying Order Items...'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {isAmharic ? 'ከስር ካታሎግ ምግብ ማከል ይችላሉ' : 'Click items in catalog to append'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                          {editItems.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-xs"
                            >
                              <div className="flex-1 pr-2">
                                <div className="font-semibold text-white">
                                  {getLocalizedName(item.item_name)}
                                </div>
                                <div className="text-slate-400 font-mono">
                                  {item.unit_price} ETB x {item.quantity} = {item.subtotal || (item.unit_price || 0) * item.quantity} ETB
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex items-center border border-slate-600 rounded-lg overflow-hidden bg-slate-900">
                                  <button
                                    onClick={() => updateEditItemQty(idx, -1)}
                                    className="p-1 hover:bg-slate-700 text-slate-300"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="px-2 font-bold text-white">{item.quantity}</span>
                                  <button
                                    onClick={() => updateEditItemQty(idx, 1)}
                                    className="p-1 hover:bg-slate-700 text-slate-300"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => removeEditItem(idx)}
                                  className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                          <span className="text-sm font-bold text-white">
                            Total: {editItems.reduce((acc, curr) => acc + (curr.subtotal || (curr.unit_price || 0) * curr.quantity), 0)} ETB
                          </span>
                          <button
                            onClick={handleSaveModifiedOrder}
                            disabled={savingEdit}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 font-bold text-slate-950 text-xs shadow-md flex items-center gap-1.5"
                          >
                            {savingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            <span>{isAmharic ? 'ለውጦችን አቀምጥ' : 'Save Order Changes'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* VIEW EXISTING ITEMS LIST */
                      <div className="flex flex-col gap-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          {isAmharic ? 'የታዘዙ ምግቦች' : 'Ordered Items'}
                        </div>
                        <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
                          {activeOrderForSelectedTable.items && activeOrderForSelectedTable.items.length > 0 ? (
                            activeOrderForSelectedTable.items.map((it, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
                              >
                                <div>
                                  <span className="font-bold text-white">{it.quantity}x </span>
                                  <span className="text-slate-200">{getLocalizedName(it.item_name)}</span>
                                  {it.notes && (
                                    <div className="text-[11px] text-amber-400 italic">
                                      Note: {it.notes}
                                    </div>
                                  )}
                                </div>
                                <div className="font-bold text-amber-300 font-mono">
                                  {it.subtotal || (it.unit_price || 0) * it.quantity} ETB
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-500 italic p-3 text-center">
                              No items listed.
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-700 text-sm font-bold text-white">
                          <span>{isAmharic ? 'ጠቅላላ ሂሳብ' : 'Total Amount'}:</span>
                          <span className="text-lg text-amber-400 font-mono">
                            {activeOrderForSelectedTable.total} ETB
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* SCENARIO B: NO ACTIVE ORDER - CREATING DRAFT ORDER */
                  <div className="flex flex-col gap-3">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4 text-amber-400" />
                      <span>{isAmharic ? 'አዲስ ትዕዛዝ ማዘጋጃ (Draft Order)' : 'Draft Order Basket'}</span>
                    </div>

                    {draftCart.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                          {draftCart.map((c) => (
                            <div
                              key={c.menuItemId}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-700 text-xs"
                            >
                              <div className="flex-1 pr-2">
                                <div className="font-bold text-white">{getLocalizedName(c.name)}</div>
                                <div className="text-slate-400 font-mono">
                                  {c.price} ETB x {c.quantity} = {c.price * c.quantity} ETB
                                </div>
                              </div>

                              <div className="flex items-center border border-slate-600 rounded-lg overflow-hidden bg-slate-900">
                                <button
                                  onClick={() => updateDraftQty(c.menuItemId, -1)}
                                  className="p-1 hover:bg-slate-700 text-slate-300"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="px-2 font-bold text-white">{c.quantity}</span>
                                <button
                                  onClick={() => updateDraftQty(c.menuItemId, 1)}
                                  className="p-1 hover:bg-slate-700 text-slate-300"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder={isAmharic ? 'ማስታወሻ (ምሳሌ፡ ያለ በርበሬ...)' : 'Order notes (e.g. extra spicy...)'}
                            value={draftNotes}
                            onChange={(e) => setDraftNotes(e.target.value)}
                            className="w-full text-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                          <span className="text-sm font-bold text-white">
                            Total: {draftCart.reduce((sum, i) => sum + i.price * i.quantity, 0)} ETB
                          </span>
                          <button
                            onClick={handleCreateOrder}
                            disabled={submittingOrder}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs shadow-lg flex items-center gap-1.5 active:scale-98"
                          >
                            {submittingOrder ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{isAmharic ? 'ትዕዛዙን ላክ (ለጠረጴዛ #' + selectedTable.table_number + ')' : `Place Order (#${selectedTable.table_number})`}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-700 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                        <ShoppingBag className="w-8 h-8 opacity-40 text-amber-400" />
                        <span>{isAmharic ? 'ከቀኝ/ከስር ካታሎግ ምግብ በመጫን አዲስ ትዕዛዝ ያክሉ' : 'Click any item from menu catalog to start ordering for this table'}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-8 text-slate-400 text-sm font-medium">
                {isAmharic ? 'እባክዎ መጀመሪያ ጠረጴዛ ይምረጡ' : 'Please select a table above'}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT / BOTTOM: FAST SEARCHABLE MENU CATALOG */}
        <div className="lg:col-span-6 xl:col-span-7 flex flex-col gap-4">
          <div className="p-5 rounded-2xl bg-slate-800/90 border border-slate-700 shadow-xl backdrop-blur-md flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  {isAmharic ? 'የምግብ ካታሎግ (በፍጥነት ይምረጡ)' : 'Menu Catalog (Fast Click Order)'}
                </h3>
              </div>

              {/* SEARCH BAR */}
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={isAmharic ? 'ምግብ ፈልግ...' : 'Search menu...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* CATEGORIES PILLS */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs">
              <button
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                  selectedCategoryId === 'all'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {isAmharic ? 'ሁሉንም' : 'All Category'}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                    selectedCategoryId === cat.id
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {getLocalizedName(cat.name)}
                </button>
              ))}
            </div>

            {/* MENU ITEMS GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredMenuItems.map((item) => {
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (isEditingOrder && activeOrderForSelectedTable) {
                        addItemToActiveOrderEdit(item);
                      } else {
                        addToDraftCart(item);
                      }
                    }}
                    className="group flex flex-col justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-700 hover:border-amber-400/60 hover:bg-slate-800 transition-all cursor-pointer shadow-md active:scale-98"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-100 group-hover:text-amber-300 transition-colors line-clamp-1">
                        {getLocalizedName(item.name)}
                      </div>
                      {item.description && (
                        <div className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                          {getLocalizedName(item.description)}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-xs font-bold text-amber-400 font-mono">
                        {item.price} ETB
                      </span>
                      <button className="p-1 rounded-lg bg-amber-500/20 text-amber-300 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SWIFT PAYMENT MODAL (DIRECT FROM RUSH MODE) */}
      {/* ========================================================= */}
      {paymentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-emerald-400" />
                <h3 className="text-lg font-bold">
                  {isAmharic ? 'ክፍያ አረጋግጥ' : 'Confirm Payment'} (Order #{paymentOrder.order_number})
                </h3>
              </div>
              <button
                onClick={() => setPaymentOrder(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentError && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmPayment} className="flex flex-col gap-4 text-xs">
              {/* PAYMENT METHOD SELECTOR */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-300">
                  {isAmharic ? 'የክፍያ ዘዴ' : 'Payment Method'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'cbe', 'telebirr'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`p-2.5 rounded-xl font-bold uppercase transition-all border ${
                        paymentMethod === method
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* AMOUNT PAID */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-300">
                  {isAmharic ? 'የተከፈለ መጠን (ETB)' : 'Amount Paid (ETB)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full text-base font-mono font-bold px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* TIP AMOUNT */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-300">
                  {isAmharic ? 'ጉርሻ / Tip (አማራጭ)' : 'Tip Amount (Optional)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="w-full text-sm font-mono px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* RECEIPT IMAGE FOR DIGITALS */}
              {(paymentMethod === 'cbe' || paymentMethod === 'telebirr') && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-300">
                    {isAmharic ? 'ደረሰኝ / ፎቶ (Receipt Image)' : 'Upload Receipt Photo'}
                  </label>
                  <label className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800 border border-dashed border-slate-600 hover:border-emerald-400 cursor-pointer transition-all text-slate-300">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>
                      {compressingReceipt
                        ? isAmharic ? 'ፎቶ በመጭመቅ ላይ...' : 'Compressing photo...'
                        : receiptImage
                        ? isAmharic ? '✓ ፎቶ ተመርጧል' : '✓ Receipt Attached'
                        : isAmharic ? 'የደረሰኝ ፎቶ ይምረጡ' : 'Choose Receipt Image'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* SUMMARY & SUBMIT */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400">{isAmharic ? 'ጠቅላላ ሂሳብ' : 'Total Order'}</div>
                  <div className="text-base font-black text-amber-400 font-mono">
                    {paymentOrder.total} ETB
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-white shadow-lg flex items-center gap-2 text-sm"
                >
                  {submittingPayment ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{isAmharic ? 'ክፍያውን ጨርስ' : 'Complete Payment'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
