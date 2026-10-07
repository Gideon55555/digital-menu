'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminAuth } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import { playNotificationSound } from '@/lib/audio';
import {
  Bell,
  RefreshCw,
  Check,
  CheckCircle2,
  X,
  Clock,
  PackageCheck,
  CreditCard,
  Volume2,
  VolumeX,
  Camera,
  Upload,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Pencil,
  Plus,
  Trash2,
  ShoppingBag,
  Table2,
} from 'lucide-react';
import { compressReceiptImage } from '@/lib/utils/image';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext';

type LocalizedName =
  | string
  | {
      en?: string;
      am?: string;
    };

type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: LocalizedName;
  unit_price: number;
  quantity: number;
  subtotal: number;
  notes?: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
};

type Payment = {
  id: string;
  order_id: string;
  payment_method: string;
  amount: number;
  tip_amount?: number;
  payment_status?: string;
  receipt_image?: string | null;
  uploaded_at?: string;
};

type Order = {
  id: string;
  order_number: string;
  table_id: string | null;
  table_session_id: string | null;
  status: string;
  order_type: string;
  waiter_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  payment?: Payment | null;
};

type Table = {
  id: string;
  table_number: string;
  name?: string | null;
};

type Tab = 'new' | 'ready' | 'payment_confirmation';

type PaymentMethod = 'cash' | 'cbe' | 'telebirr';

export default function OrdersPage() {
  const { isAmharic } = useAdminLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [activeTab, setActiveTab] =
    useState<Tab>('new');
  const [currentRole, setCurrentRole] = useState<string>('cashier');

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const auth = await getAdminAuth();
        if (auth?.adminUser?.role) {
          setCurrentRole(auth.adminUser.role);
        }
      } catch (e) {}
    };
    fetchRole();
  }, []);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [processingOrderId, setProcessingOrderId] =
    useState<string | null>(null);

  // =========================================================
  // PAYMENT MODAL
  // =========================================================

  const [paymentOrder, setPaymentOrder] =
    useState<Order | null>(null);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('cash');

  const [paymentAmount, setPaymentAmount] =
    useState('');

  const [paymentError, setPaymentError] =
    useState('');

  const [tipAmount, setTipAmount] = useState('');

  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [compressingReceipt, setCompressingReceipt] = useState(false);
  const [modifyOrder, setModifyOrder] = useState<Order | null>(null);

  const [channelConnected, setChannelConnected] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevReadyCount = useRef<number>(-1);
  const prevNewCount = useRef<number>(-1);
  const prevPendingConfCount = useRef<number>(-1);

  // =========================================================
  // LOAD ORDERS
  // =========================================================

  async function loadOrders(silent = false) {
    try {
      if (!silent) setLoading(true);

      const response = await fetch(
        '/api/orders',
        {
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        return;
      }

      const result =
        await response.json();

      if (result.success && Array.isArray(result.data)) {
        setOrders(result.data);
      }
    } catch (error) {
      if (!silent) {
        console.error(
          'Failed to load orders:',
          error
        );
      }
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }

  // =========================================================
  // INITIAL LOAD & REALTIME CHANNEL
  // =========================================================

  useEffect(() => {
    loadOrders();
    loadTables();

    // Unique channel to avoid collisions across multiple browser tabs
    const channel = supabase
      .channel(`admin-orders-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          loadOrders(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          loadOrders(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        () => {
          loadOrders(true);
          loadTables();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChannelConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setChannelConnected(false);
        }
      });

    // 4-second auto-poll so cashier NEVER has to manually refresh
    const pollInterval = setInterval(() => {
      loadOrders(true);
    }, 4000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  // =========================================================
  // LOAD TABLES
  // =========================================================

  async function loadTables() {
    try {
      const response = await fetch(
        '/api/tables',
        {
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        return;
      }

      const result =
        await response.json();

      if (
        result.success &&
        Array.isArray(result.data)
      ) {
        setTables(result.data);
      }
    } catch (error) {
      console.error(
        'Failed to load tables:',
        error
      );
    }
  }



  // =========================================================
  // REFRESH
  // =========================================================

  async function refreshOrders() {
    if (refreshing) {
      return;
    }

    setRefreshing(true);

    await Promise.all([
      loadOrders(),
      loadTables(),
    ]);
  }

  // =========================================================
  // CONFIRM & SEND
  // =========================================================

  async function confirmAndSend(
    orderId: string
  ) {
    if (processingOrderId) {
      return;
    }

    try {
      setProcessingOrderId(orderId);

      const response = await fetch(
        '/api/orders',
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            id: orderId,
            status: 'confirmed',
          }),
        }
      );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            'Failed to send order to kitchen'
        );
      }

      // Remove from New Orders immediately.
      setOrders(
        (currentOrders) =>
          currentOrders.filter(
            (order) =>
              order.id !== orderId
          )
      );
    } catch (error) {
      console.error(
        'Confirm/send error:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Failed to send order to kitchen.'
      );
    } finally {
      setProcessingOrderId(null);
    }
  }

  // =========================================================
  // CANCEL ORDER
  // =========================================================

  async function cancelOrder(
    orderId: string
  ) {
    if (processingOrderId) {
      return;
    }

    const targetOrder = orders.find((o) => o.id === orderId);
    const orderNumStr = targetOrder ? (targetOrder.order_number.startsWith('order-') ? targetOrder.order_number : `#${targetOrder.order_number}`) : orderId;

    const confirmed =
      window.confirm(
        isAmharic
          ? `እርግጠኛ ነዎት ትዕዛዝ ${orderNumStr} መሰረዝ/ማስወገድ ይፈልጋሉ?`
          : `Are you sure you want to remove / cancel Order ${orderNumStr}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingOrderId(orderId);

      const response = await fetch(
        `/api/orders?id=${orderId}&reason=${encodeURIComponent('Removed by staff')}&user_role=${currentRole}`,
        {
          method: 'DELETE',
        }
      );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            'Failed to cancel order'
        );
      }

      setOrders(
        (currentOrders) =>
          currentOrders.filter(
            (order) =>
              order.id !== orderId
          )
      );
      await loadOrders(true);
    } catch (error) {
      console.error(
        'Cancel order error:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Failed to cancel order.'
      );
    } finally {
      setProcessingOrderId(null);
    }
  }

  // =========================================================
  // OPEN PAYMENT MODAL
  // =========================================================

  function openPaymentModal(
    order: Order
  ) {
    setPaymentOrder(order);
    setPaymentMethod('cash');

    const sameTableOrders = order.table_id
      ? orders.filter(
          (o) =>
            o.table_id === order.table_id &&
            o.status !== 'completed' &&
            o.status !== 'paid' &&
            o.status !== 'cancelled'
        )
      : [order];

    const defaultAmount = sameTableOrders.length > 1
      ? sameTableOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
      : Number(order.total || 0);

    setPaymentAmount(
      defaultAmount.toFixed(2)
    );
    setPaymentError('');
    setTipAmount('');
  }

  // =========================================================
  // CLOSE PAYMENT MODAL
  // =========================================================

  function closePaymentModal() {
    if (processingOrderId) {
      return;
    }

    setPaymentOrder(null);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentError('');
    setReceiptImage(null);
    setCompressingReceipt(false);
    setTipAmount('');
  }

  // =========================================================
  // RECORD PAYMENT & CLOSE
  // =========================================================

  async function recordPaymentAndClose(targetOrderIds?: string[], customAmount?: number) {
    if (
      !paymentOrder ||
      processingOrderId
    ) {
      return;
    }

    const targetIds = targetOrderIds && targetOrderIds.length > 0 ? targetOrderIds : [paymentOrder.id];
    const amount = customAmount !== undefined ? customAmount : Number(paymentAmount);
    const tip = Number(tipAmount) || 0;

    // -------------------------------------------------------
    // VALIDATE AMOUNT
    // -------------------------------------------------------

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setPaymentError(
        'Please enter a valid payment amount.'
      );

      return;
    }

    if (tip < 0) {
      setPaymentError('Tip cannot be negative.');
      return;
    }

    try {
      setProcessingOrderId(
        paymentOrder.id
      );

      setPaymentError('');

      const response = await fetch(
        '/api/orders',
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            id: paymentOrder.id,
            ids: targetIds,
            action:
              'record_payment',
            payment_method:
              paymentMethod,
            amount,
            tip_amount: tip,
            is_waiter: currentRole === 'waiter',
            user_role: currentRole,
            receipt_image:
              paymentMethod === 'cbe' || paymentMethod === 'telebirr'
                ? receiptImage
                : null,
          }),
        }
      );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success
      ) {
        throw new Error(
          result.error ||
            'Failed to record payment'
        );
      }

      if (result.pendingApproval) {
        alert(
          isAmharic
            ? 'ክፍያው ተመዝግቧል! ለገንዘብ ተቀባዩ/ማናጀሩ ለማረጋገጥ ተልኳል።'
            : 'Payment submitted! Sent to Cashier / Order Manager for approval.'
        );
      } else {
        setOrders(
          (currentOrders) =>
            currentOrders.filter(
              (order) =>
                !targetIds.includes(order.id)
            )
        );
      }

      closePaymentModal();
      await loadOrders(true);
    } catch (error) {
      console.error(
        'Payment error:',
        error
      );

      setPaymentError(
        error instanceof Error
          ? error.message
          : 'Failed to record payment.'
      );
    } finally {
      setProcessingOrderId(null);
    }
  }

  // =========================================================
  // APPROVE & REJECT WAITER PAYMENTS
  // =========================================================

  async function approvePayment(orderId: string) {
    try {
      setProcessingOrderId(orderId);
      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: orderId,
          action: 'approve_payment',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to approve payment');
      }

      await loadOrders(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to approve payment.');
    } finally {
      setProcessingOrderId(null);
    }
  }

  async function rejectPayment(orderId: string) {
    const confirmed = window.confirm(
      isAmharic
        ? 'እርግጠኛ ነዎት ይህን ክፍያ ውድቅ ማድረግ ይፈልጋሉ?'
        : 'Are you sure you want to reject this payment submission?'
    );

    if (!confirmed) return;

    try {
      setProcessingOrderId(orderId);
      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: orderId,
          action: 'reject_payment',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to reject payment');
      }

      await loadOrders(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to reject payment.');
    } finally {
      setProcessingOrderId(null);
    }
  }

  // =========================================================
  // ORDER GROUPS
  // =========================================================

  const newOrders =
    orders.filter(
      (order) =>
        order.status === 'pending' ||
        order.status === 'submitted'
    );

  const readyOrders =
    orders.filter(
      (order) =>
        order.status === 'ready'
    );

  const pendingConfirmationOrders =
    orders.filter(
      (order) =>
        order.status === 'payment_pending'
    );

  // Audio alerts for new orders & orders marked ready by kitchen & waiter payment submissions
  useEffect(() => {
    const newCount = newOrders.length;
    const readyCount = readyOrders.length;
    const pendingConfCount = pendingConfirmationOrders.length;

    if (prevNewCount.current >= 0 && newCount > prevNewCount.current && !loading) {
      if (soundEnabled) playNotificationSound('new_order');
    }
    if (prevReadyCount.current >= 0 && readyCount > prevReadyCount.current && !loading) {
      if (soundEnabled) playNotificationSound('ready');
    }
    if (prevPendingConfCount.current >= 0 && pendingConfCount > prevPendingConfCount.current && !loading) {
      if (soundEnabled) playNotificationSound('ready');
    }

    prevNewCount.current = newCount;
    prevReadyCount.current = readyCount;
    prevPendingConfCount.current = pendingConfCount;
  }, [newOrders.length, readyOrders.length, pendingConfirmationOrders.length, soundEnabled, loading]);

  const visibleOrders =
    activeTab === 'new'
      ? newOrders
      : activeTab === 'ready'
      ? readyOrders
      : pendingConfirmationOrders;

  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({});

  const toggleTableCollapse = (tableKey: string) => {
    setCollapsedTables((prev) => ({
      ...prev,
      [tableKey]: prev[tableKey] === false ? true : false,
    }));
  };

  const tableGroups = useMemo(() => {
    const map = new Map<string, { tableId: string | null; tableName: string; orders: Order[]; totalAmount: number; itemsCount: number }>();

    for (const order of visibleOrders) {
      const key = order.table_id || 'takeaway';
      const name = formatTableName(order.table_id, tables, isAmharic);
      if (!map.has(key)) {
        map.set(key, {
          tableId: order.table_id,
          tableName: name,
          orders: [],
          totalAmount: 0,
          itemsCount: 0,
        });
      }
      const grp = map.get(key)!;
      grp.orders.push(order);
      grp.totalAmount += Number(order.total || 0);
      grp.itemsCount += (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    }
    return Array.from(map.values());
  }, [visibleOrders, tables, isAmharic]);

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-gray-500">
            {isAmharic ? 'ትዕዛዞችን በመጫን ላይ...' : 'Loading orders...'}
          </div>
        </div>
      </AdminLayout>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* HEADER */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          <div>
            <h1 className="text-3xl font-serif font-bold text-restaurant-text dark:text-white">
              {isAmharic ? 'ክፍት ትዕዛዞች' : 'Orders'}
            </h1>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isAmharic
                ? 'የትዕዛዝ ሁኔታን ይቆጣጠሩ እና ክፍያዎችን ይቀበሉ'
                : 'Manage orders and record payments.'}
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
              <span>
                {channelConnected
                  ? isAmharic
                    ? 'የቀጥታ መስመር ክፍት ነው'
                    : 'Live Channel Open'
                  : isAmharic
                  ? 'ቀጣይ ማመሳሰል ይሰራል'
                  : 'Auto-Sync Active'}
              </span>
            </div>

            {/* AUDIO NOTIFICATION TOGGLE */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                soundEnabled
                  ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300'
                  : 'border-gray-200 bg-white text-gray-400 dark:border-slate-800 dark:bg-slate-800'
              }`}
              title={soundEnabled ? 'Chime sound is ON' : 'Chime sound is MUTED'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>
                {soundEnabled
                  ? isAmharic
                    ? 'ድምጽ በርቷል'
                    : 'Chime ON'
                  : isAmharic
                  ? 'ድምጽ ጠፍቷል'
                  : 'Muted'}
              </span>
            </button>

            {/* MANUAL REFRESH */}
            <button
              onClick={refreshOrders}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-restaurant-accent text-white hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
            >
              <RefreshCw
                size={14}
                className={refreshing ? 'animate-spin' : ''}
              />
              <span>
                {refreshing
                  ? isAmharic
                    ? 'በማደስ ላይ...'
                    : 'Syncing...'
                  : isAmharic
                  ? 'አድስ'
                  : 'Sync'}
              </span>
            </button>
          </div>

        </div>

        {/* TABS */}

        <div className="flex items-center border-b border-gray-200 dark:border-slate-800">

          {/* NEW ORDERS */}

          <button
            onClick={() =>
              setActiveTab('new')
            }
            className={`
              relative px-5 py-3 text-sm font-semibold
              transition-colors
              ${
                activeTab === 'new'
                  ? 'text-restaurant-accent'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
              }
            `}
          >
            <span className="flex items-center gap-2">

              <Bell size={18} />

              {isAmharic ? 'አዳዲስ ትዕዛዞች' : 'New Orders'}

              {newOrders.length > 0 && (
                <span className="min-w-[22px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs">
                  {newOrders.length}
                </span>
              )}

            </span>

            {activeTab === 'new' && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-restaurant-accent" />
            )}

          </button>

          {/* READY ORDERS */}

          <button
            onClick={() =>
              setActiveTab('ready')
            }
            className={`
              relative px-5 py-3 text-sm font-semibold
              transition-colors
              ${
                activeTab === 'ready'
                  ? 'text-restaurant-accent'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
              }
            `}
          >
            <span className="flex items-center gap-2">

              <PackageCheck size={18} />

              {isAmharic ? 'የተዘጋጁ ትዕዛዞች' : 'Ready Orders'}

              {readyOrders.length > 0 && (
                <span className="min-w-[22px] h-5 px-1.5 flex items-center justify-center rounded-full bg-green-500 text-white text-xs">
                  {readyOrders.length}
                </span>
              )}

            </span>

            {activeTab === 'ready' && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-restaurant-accent" />
            )}

          </button>

          {/* PAYMENT CONFIRMATION (WAITER SUBMISSIONS) */}

          <button
            onClick={() =>
              setActiveTab('payment_confirmation')
            }
            className={`
              relative px-5 py-3 text-sm font-semibold
              transition-colors
              ${
                activeTab === 'payment_confirmation'
                  ? 'text-restaurant-accent'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
              }
            `}
          >
            <span className="flex items-center gap-2">

              <CheckCircle2 size={18} />

              {isAmharic ? 'ክፍያ ማረጋገጫ' : 'Payment Confirmation'}

              {pendingConfirmationOrders.length > 0 && (
                <span className="min-w-[22px] h-5 px-1.5 flex items-center justify-center rounded-full bg-purple-600 text-white text-xs font-bold animate-pulse">
                  {pendingConfirmationOrders.length}
                </span>
              )}

            </span>

            {activeTab === 'payment_confirmation' && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-restaurant-accent" />
            )}

          </button>

        </div>

        {/* ORDERS GROUPED BY TABLES (ACCORDIONS) */}

        {visibleOrders.length === 0 ? (
          <EmptyState
            type={activeTab}
            isAmharic={isAmharic}
          />
        ) : (
          <div className="space-y-6">
            {tableGroups.map((group) => {
              const groupKey = group.tableId || 'takeaway';
              const isCollapsed = collapsedTables[groupKey] !== false;
              const isTakeaway = !group.tableId;

              return (
                <div
                  key={groupKey}
                  className="restaurant-card overflow-hidden border border-cream-200 dark:border-slate-800 shadow-sm transition-all"
                >
                  {/* TABLE ACCORDION HEADER */}
                  <div
                    onClick={() => toggleTableCollapse(groupKey)}
                    className="p-4 bg-cream-50/80 dark:bg-slate-800/80 hover:bg-cream-100 dark:hover:bg-slate-800 cursor-pointer flex flex-wrap items-center justify-between gap-3 border-b border-cream-200 dark:border-slate-800 transition select-none"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="p-1 rounded-lg text-stone-500 hover:text-restaurant-accent hover:bg-cream-200 dark:hover:bg-slate-700 transition"
                      >
                        {isCollapsed ? <ChevronDown size={22} /> : <ChevronUp size={22} />}
                      </button>

                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl bg-restaurant-accent/15 text-restaurant-accent flex items-center justify-center font-bold">
                          {isTakeaway ? <ShoppingBag size={20} /> : <Table2 size={20} />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-serif font-bold text-restaurant-text dark:text-white">
                              {group.tableName}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full bg-restaurant-accent text-white text-xs font-bold">
                              {group.orders.length} {group.orders.length === 1 ? (isAmharic ? 'ትዕዛዝ' : 'Order') : (isAmharic ? 'ትዕዛዞች' : 'Orders')}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 dark:text-gray-400 font-medium mt-0.5">
                            {group.itemsCount} {isAmharic ? 'ምግቦች/መጠጦች' : 'items total'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[11px] text-gray-400 block uppercase tracking-wider font-semibold">
                          {isAmharic ? 'የጠረጴዛው ጠቅላላ ሂሳብ' : 'Table Total'}
                        </span>
                        <span className="text-lg font-extrabold text-restaurant-accent font-mono">
                          {group.totalAmount.toFixed(2)} {isAmharic ? 'ብር' : 'ETB'}
                        </span>
                      </div>

                      {group.orders.length > 1 && activeTab === 'ready' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPaymentModal(group.orders[0]);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-restaurant-accent hover:bg-restaurant-accent-dark text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                        >
                          <CreditCard size={14} />
                          <span>{isAmharic ? 'ሁሉንም ክፍያ ተቀበል' : 'Settle Table'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* TABLE ACCORDION BODY (ORDERS LIST) */}
                  {!isCollapsed && (
                    <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {group.orders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          activeTab={activeTab}
                          isAmharic={isAmharic}
                          processing={processingOrderId === order.id}
                          onConfirmAndSend={confirmAndSend}
                          onCancel={cancelOrder}
                          onModifyOrder={(ord) => setModifyOrder(ord)}
                          onRecordPayment={openPaymentModal}
                          onApprovePayment={approvePayment}
                          onRejectPayment={rejectPayment}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* =====================================================
          PAYMENT MODAL
      ====================================================== */}

      {paymentOrder && (
        <PaymentModal
          order={paymentOrder}
          allOrders={orders}
          paymentMethod={paymentMethod}
          setPaymentMethod={
            setPaymentMethod
          }
          paymentAmount={
            paymentAmount
          }
          setPaymentAmount={
            setPaymentAmount
          }
          tipAmount={tipAmount}
          setTipAmount={setTipAmount}
          receiptImage={receiptImage}
          setReceiptImage={setReceiptImage}
          compressingReceipt={compressingReceipt}
          setCompressingReceipt={setCompressingReceipt}
          error={paymentError}
          processing={
            processingOrderId ===
            paymentOrder.id
          }
          onCancel={
            closePaymentModal
          }
          onConfirm={
            recordPaymentAndClose
          }
        />
      )}

      {/* =====================================================
          MODIFY ORDER MODAL
      ====================================================== */}
      {modifyOrder && (
        <ModifyOrderModal
          order={modifyOrder}
          isAmharic={isAmharic}
          onCancel={() => setModifyOrder(null)}
          onSaveSuccess={async () => {
            setModifyOrder(null);
            await loadOrders(true);
          }}
        />
      )}

    </AdminLayout>
  );
}

/* ============================================================
   ORDER CARD (Inside Table Accordion)
============================================================ */

function OrderCard({
  order,
  activeTab,
  processing,
  onConfirmAndSend,
  onCancel,
  onModifyOrder,
  onRecordPayment,
  onApprovePayment,
  onRejectPayment,
  isAmharic,
}: {
  order: Order;
  activeTab: Tab;
  processing: boolean;

  onConfirmAndSend: (
    orderId: string
  ) => void;

  onCancel: (
    orderId: string
  ) => void;

  onModifyOrder?: (
    order: Order
  ) => void;

  onRecordPayment: (
    order: Order
  ) => void;

  onApprovePayment?: (
    orderId: string
  ) => void;

  onRejectPayment?: (
    orderId: string
  ) => void;
  isAmharic?: boolean;
}) {
  const isPendingApproval = order.payment?.payment_status === 'PENDING' || order.status === 'payment_pending';
  const orderNumberStr = order.order_number.startsWith('order-') ? order.order_number : `#${order.order_number}`;

  return (
    <div className={`rounded-2xl border border-stone-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 p-4 space-y-3 flex flex-col justify-between transition-all shadow-xs hover:border-restaurant-accent dark:hover:border-amber-500/60 ${isPendingApproval ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''}`}>
      
      {/* TOP ROW: Small Order Number & Badges */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 dark:border-slate-700/70 pb-2.5">
        <div className="flex items-center gap-2">
          {/* Small Order Number */}
          <span className="text-xs font-mono font-bold text-stone-700 dark:text-slate-200 bg-stone-100 dark:bg-slate-700/80 border border-stone-200 dark:border-slate-600 px-2 py-0.5 rounded-md">
            {orderNumberStr}
          </span>

          {activeTab === 'new' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[10px] font-bold">
              <Clock size={10} />
              {isAmharic ? 'አዲስ' : 'New'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
              <PackageCheck size={10} />
              {isAmharic ? 'ተዘጋጅቷል' : 'Ready'}
            </span>
          )}

          {isPendingApproval && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold animate-pulse">
              {isAmharic ? 'ማረጋገጫ' : 'Approval'}
            </span>
          )}
        </div>

        {/* Action icons: Edit & Cancel */}
        <div className="flex items-center gap-1">
          {onModifyOrder && (
            <button
              type="button"
              onClick={() => onModifyOrder(order)}
              disabled={processing}
              title={isAmharic ? 'ትዕዛዝ አስተካክል (Modify)' : 'Modify Order Items (Add/Remove)'}
              className="p-1 rounded-lg text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition"
            >
              <Pencil size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={() => onCancel(order.id)}
            disabled={processing}
            title={isAmharic ? 'ትዕዛዝ ሰርዝ' : 'Remove / Cancel Order'}
            className="p-1 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ITEMS LIST (PROMINENT DISPLAY) */}
      <div className="space-y-2 flex-1 min-h-[70px]">
        {!order.items || order.items.length === 0 ? (
          <p className="text-xs text-red-500 py-2">
            {isAmharic ? 'ምንም እቃ የለም።' : 'No items in this order.'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {order.items.map((item) => (
              <OrderItemRow
                key={item.id}
                item={item}
                isAmharic={isAmharic}
              />
            ))}
          </div>
        )}

        {order.notes && (
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-slate-800/80 border border-amber-200 dark:border-slate-700 text-[11px] text-stone-700 dark:text-stone-300">
            <strong className="text-amber-800 dark:text-amber-400">{isAmharic ? 'ማስታወሻ:' : 'Note:'}</strong> {order.notes}
          </div>
        )}
      </div>

      {/* WAITER PAYMENT APPROVAL BANNER IF PENDING */}
      {isPendingApproval && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-300">
            <span className="flex items-center gap-1">
              <Clock size={12} className="animate-pulse text-amber-600" />
              {isAmharic ? 'በአስተናጋጅ ተልኳል' : 'Waiter Submitted'}
            </span>
            {order.payment?.payment_method && (
              <span className="px-1.5 py-0.5 rounded bg-amber-200/80 text-[10px] uppercase">
                {order.payment.payment_method}
              </span>
            )}
          </div>

          {order.payment?.receipt_image && (
            <div className="relative h-24 w-full rounded overflow-hidden border border-amber-300 bg-black/5 flex items-center justify-center">
              <img src={order.payment.receipt_image} alt="Receipt proof" className="max-h-full max-w-full object-contain" />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onApprovePayment && onApprovePayment(order.id)}
              disabled={processing}
              className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs disabled:opacity-50"
            >
              <Check size={14} />
              {isAmharic ? 'አጽድቅ' : 'Approve'}
            </button>
            <button
              onClick={() => onRejectPayment && onRejectPayment(order.id)}
              disabled={processing}
              className="py-1.5 px-2.5 rounded-lg border border-red-300 text-red-600 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM FOOTER: TOTAL & ACTION BUTTON */}
      <div className="pt-2.5 border-t border-stone-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] text-stone-400 block uppercase font-bold">{isAmharic ? 'የትዕዛዝ ዋጋ' : 'Order Total'}</span>
          <span className="text-sm font-extrabold text-restaurant-accent font-mono">
            {Number(order.total).toFixed(2)} {isAmharic ? 'ብር' : 'ETB'}
          </span>
        </div>

        {!isPendingApproval && (
          <div>
            {activeTab === 'new' ? (
              <button
                onClick={() => onConfirmAndSend(order.id)}
                disabled={processing}
                className="px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition flex items-center gap-1 disabled:opacity-50 shadow-xs"
              >
                <Check size={14} />
                <span>{isAmharic ? 'አረጋግጥና ላክ' : 'Send'}</span>
              </button>
            ) : (
              <button
                onClick={() => onRecordPayment(order)}
                disabled={processing}
                className="px-3 py-1.5 rounded-xl bg-restaurant-accent hover:bg-restaurant-accent-dark text-white text-xs font-bold transition flex items-center gap-1 disabled:opacity-50 shadow-xs"
              >
                <CreditCard size={14} />
                <span>{isAmharic ? 'ክፍያ ተቀበል' : 'Pay'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   ORDER ITEM
============================================================ */

function OrderItemRow({
  item,
  isAmharic,
}: {
  item: OrderItem;
  isAmharic?: boolean;
}) {
  const itemName =
    getItemName(item.item_name);

  const amharicName =
    getAmharicName(
      item.item_name
    );

  const primaryName = isAmharic && amharicName ? amharicName : itemName;
  const secondaryName = isAmharic && amharicName ? itemName : amharicName;

  return (
    <div className="flex items-start justify-between gap-3 text-stone-900 dark:text-slate-100">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="flex-shrink-0 min-w-[26px] h-6 px-1.5 rounded-md bg-amber-100/80 dark:bg-amber-950/70 border border-amber-200/60 dark:border-amber-800/50 flex items-center justify-center text-xs font-bold text-amber-900 dark:text-amber-300">
          {item.quantity}×
        </span>
        <div className="min-w-0">
          <p className="font-medium text-xs sm:text-sm text-stone-900 dark:text-slate-100 leading-snug">
            {primaryName}
          </p>
          {secondaryName && secondaryName !== primaryName && (
            <p className="text-[11px] text-stone-500 dark:text-slate-400">
              {secondaryName}
            </p>
          )}
          {item.notes && (
            <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-1 rounded border border-amber-200/60 dark:border-amber-900/60">
              {isAmharic ? 'ማስታወሻ: ' : 'Note: '}{item.notes}
            </p>
          )}
        </div>
      </div>
      <span className="flex-shrink-0 text-xs sm:text-sm font-semibold font-mono text-stone-800 dark:text-slate-200">
        {Number(item.subtotal).toFixed(2)} {isAmharic ? 'ብር' : 'ETB'}
      </span>
    </div>
  );
}



/* ============================================================
   PAYMENT MODAL
============================================================ */

function PaymentModal({
  order,
  allOrders,
  paymentMethod,
  setPaymentMethod,
  paymentAmount,
  setPaymentAmount,
  tipAmount,
  setTipAmount,
  receiptImage,
  setReceiptImage,
  compressingReceipt,
  setCompressingReceipt,
  error,
  processing,
  onCancel,
  onConfirm,
}: {
  order: Order;
  allOrders?: Order[];

  paymentMethod: PaymentMethod;

  setPaymentMethod: (
    method: PaymentMethod
  ) => void;

  paymentAmount: string;

  setPaymentAmount: (
    amount: string
  ) => void;

  tipAmount: string;

  setTipAmount: (
    amount: string
  ) => void;

  receiptImage: string | null;

  setReceiptImage: (
    img: string | null
  ) => void;

  compressingReceipt: boolean;

  setCompressingReceipt: (
    loading: boolean
  ) => void;

  error: string;

  processing: boolean;

  onCancel: () => void;

  onConfirm: (targetOrderIds?: string[], customAmount?: number) => void;
}) {
  const { language, t } = useAdminLanguage();

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressingReceipt(true);
      const compressedDataUrl = await compressReceiptImage(file, 900, 0.65);
      setReceiptImage(compressedDataUrl);
    } catch (err) {
      console.error('Failed to compress receipt image:', err);
      alert(language === 'am' ? 'ፎቶውን ማዘጋጀት አልተቻለም። እባክዎ በድጋሚ ይሞክሩ።' : 'Failed to process image. Please try again.');
    } finally {
      setCompressingReceipt(false);
      e.target.value = '';
    }
  };

  const sameTableOrders = useMemo(() => {
    if (!order.table_id) return [order];
    return (allOrders || []).filter(
      (o) =>
        o.table_id === order.table_id &&
        o.status !== 'completed' &&
        o.status !== 'paid' &&
        o.status !== 'cancelled'
    );
  }, [order, allOrders]);

  const combinedTableTotal = useMemo(() => {
    return sameTableOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  }, [sameTableOrders]);

  const hasMultipleTableOrders = sameTableOrders.length > 1;

  const unfinishedOrders = useMemo(() => {
    return sameTableOrders.filter((o) =>
      ['pending', 'submitted', 'confirmed', 'preparing'].includes(o.status)
    );
  }, [sameTableOrders]);

  const hasUnfinishedOrders = unfinishedOrders.length > 0;

  const [payAllTableOrders, setPayAllTableOrders] = useState<boolean>(hasMultipleTableOrders);

  const currentSelectedOrders = payAllTableOrders ? sameTableOrders : [order];
  const parsedOrderTotal = payAllTableOrders
    ? combinedTableTotal
    : Number(order.total) || 0;

  const parsedTip = Number(tipAmount) || 0;
  const grandTotal = parsedOrderTotal + parsedTip;

  const handleTogglePayAll = (payAll: boolean) => {
    setPayAllTableOrders(payAll);
    const newTotal = payAll ? combinedTableTotal : Number(order.total) || 0;
    setPaymentAmount(newTotal.toFixed(2));
  };

  const handleConfirmSubmission = () => {
    const targetIds = currentSelectedOrders.map((o) => o.id);
    const parsedAmountInput = Number(paymentAmount);
    const amountVal = !isNaN(parsedAmountInput) && parsedAmountInput >= parsedOrderTotal
      ? parsedAmountInput
      : parsedOrderTotal;
    onConfirm(targetIds, amountVal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">

        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-slate-800">

          <div>

            <p className="text-xs uppercase tracking-wide text-gray-400">
              {language === 'am' ? 'የክፍያ መቀበያ' : 'Payment'}
            </p>

            <h2 className="text-xl font-bold text-restaurant-text dark:text-white">
              {order.order_number.startsWith('order-')
                ? order.order_number
                : `#${order.order_number}`}
            </h2>

          </div>

          <button
            onClick={onCancel}
            disabled={processing}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>

        </div>

        {/* CONTENT */}

        <div className="p-5 space-y-5">

          {/* UNFINISHED ORDERS WARNING BANNER */}
          {hasUnfinishedOrders && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 animate-pulse" />
                <span>{language === 'am' ? '⚠️ ማስጠንቀቂያ፡ ገና ያልተጠናቀቀ ትዕዛዝ አለ!' : '⚠️ Warning: Unfinished Order on Table!'}</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {language === 'am'
                  ? `ይህ ጠረጴዛ ገና በዝግጅት ላይ ያሉ ${unfinishedOrders.length} ትዕዛዞች አሉት (${unfinishedOrders.map(o => o.order_number.startsWith('order-') ? o.order_number : '#' + o.order_number).join(', ')})። ሂሳቡን ከመዝጋትዎ በፊት ዝግጅቱን ያረጋግጡ።`
                  : `This table has ${unfinishedOrders.length} order(s) still in preparation (${unfinishedOrders.map(o => o.order_number.startsWith('order-') ? o.order_number : '#' + o.order_number).join(', ')}). Please verify before closing.`}
              </p>
            </div>
          )}

          {/* COMBINED SAME-TABLE SETTLEMENT SELECTOR */}
          {hasMultipleTableOrders && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {language === 'am' ? 'የጠረጴዛው ክፍያዎች' : 'Table Combined Settlement'}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-bold">
                  {sameTableOrders.length} {language === 'am' ? 'ትዕዛዞች' : 'Orders'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleTogglePayAll(true)}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    payAllTableOrders
                      ? 'border-restaurant-accent bg-restaurant-accent/10 text-restaurant-accent dark:bg-restaurant-accent/20 font-bold'
                      : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-gray-600 dark:text-gray-400 font-medium'
                  }`}
                >
                  <div>{language === 'am' ? 'ሁሉንም ሰብስብ' : 'Combine All'}</div>
                  <div className="text-[11px] opacity-80 mt-0.5">{combinedTableTotal.toFixed(2)} ETB</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTogglePayAll(false)}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    !payAllTableOrders
                      ? 'border-restaurant-accent bg-restaurant-accent/10 text-restaurant-accent dark:bg-restaurant-accent/20 font-bold'
                      : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-gray-600 dark:text-gray-400 font-medium'
                  }`}
                >
                  <div>{language === 'am' ? 'ይህን ብቻ' : 'Single Order'}</div>
                  <div className="text-[11px] opacity-80 mt-0.5">{Number(order.total).toFixed(2)} ETB</div>
                </button>
              </div>

              <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-slate-700 text-xs">
                {sameTableOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                    <span className="font-medium">
                      {o.order_number.startsWith('order-') ? o.order_number : `#${o.order_number}`}
                      <span className="text-[10px] text-gray-400 ml-1">({o.status})</span>
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {Number(o.total).toFixed(2)} ETB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TOTAL & GRAND TOTAL */}

          <div className="rounded-xl bg-gray-50 p-4 dark:bg-slate-800 space-y-2">

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{language === 'am' ? 'የዕቃው ዋጋ' : 'Order Total'}:</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {parsedOrderTotal.toFixed(2)} {language === 'am' ? 'ብር' : 'ETB'}
              </span>
            </div>

            {parsedTip > 0 && (
              <div className="flex items-center justify-between text-sm text-amber-600 dark:text-amber-400 font-medium">
                <span>{t.tipAmount || (language === 'am' ? 'ጉርሻ (ቲፕ)' : 'Tip Amount')}:</span>
                <span>+{parsedTip.toFixed(2)} {language === 'am' ? 'ብር' : 'ETB'}</span>
              </div>
            )}

            <div className="pt-2 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                {t.grandTotal || (language === 'am' ? 'ጠቅላላ ክፍያ' : 'Grand Total')}:
              </span>
              <span className="text-2xl font-extrabold text-restaurant-text dark:text-white">
                {grandTotal.toFixed(2)} {language === 'am' ? 'ብር' : 'ETB'}
              </span>
            </div>

          </div>

          {/* AMOUNT PAID */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t.amountPaid}
            </label>

            <div className="relative">

              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(event) =>
                  setPaymentAmount(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-16 text-lg font-semibold outline-none focus:border-restaurant-accent dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                {language === 'am' ? 'ብር' : 'ETB'}
              </span>

            </div>

            {Number(paymentAmount) > grandTotal && (
              <div className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center justify-between shadow-xs">
                <span>{language === 'am' ? 'ለደንበኛው የሚመለስ መልስ (Change):' : 'Change to Return:'}</span>
                <span className="font-mono text-sm">{(Number(paymentAmount) - grandTotal).toFixed(2)} ETB</span>
              </div>
            )}

          </div>

          {/* TIP FIELD */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t.tipAmount || (language === 'am' ? 'ጉርሻ (ቲፕ) - አማራጭ' : 'Tip Amount (Optional)')}
            </label>

            <div className="relative">

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={tipAmount}
                onChange={(event) =>
                  setTipAmount(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-amber-300 bg-amber-50/30 px-4 py-3 pr-16 text-lg font-semibold outline-none focus:border-amber-500 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-white"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-amber-600 dark:text-amber-400">
                {language === 'am' ? 'ብር' : 'ETB'}
              </span>

            </div>

            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {language === 'am' ? 'ለአስተናጋጁ ወይም ለካሸሩ የተሰጠ ተጨማሪ ጉርሻ' : 'Cashier or waiter tip given by customer'}
            </p>

          </div>

          {/* PAYMENT METHOD */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t.paymentMethodLabel}
            </label>

            <div className="grid grid-cols-3 gap-2">

              <PaymentMethodButton
                label={t.cash}
                selected={
                  paymentMethod === 'cash'
                }
                onClick={() =>
                  setPaymentMethod(
                    'cash'
                  )
                }
              />

              <PaymentMethodButton
                label={t.cbe}
                selected={
                  paymentMethod === 'cbe'
                }
                onClick={() =>
                  setPaymentMethod(
                    'cbe'
                  )
                }
              />

              <PaymentMethodButton
                label={t.telebirr}
                selected={
                  paymentMethod ===
                  'telebirr'
                }
                onClick={() =>
                  setPaymentMethod(
                    'telebirr'
                  )
                }
              />

            </div>

          </div>

          {/* RECEIPT / SCREENSHOT UPLOAD (FOR CBE & TELEBIRR) */}
          {(paymentMethod === 'cbe' || paymentMethod === 'telebirr') && (
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Camera size={14} className="text-restaurant-accent" />
                  {t.receiptOptional}
                </label>
                {receiptImage && (
                  <button
                    type="button"
                    onClick={() => setReceiptImage(null)}
                    className="text-xs text-red-600 dark:text-red-400 font-semibold hover:underline"
                  >
                    {t.remove}
                  </button>
                )}
              </div>

              {compressingReceipt ? (
                <div className="p-4 rounded-xl border border-dashed border-restaurant-accent/50 bg-restaurant-accent/5 flex items-center justify-center gap-2 text-xs font-semibold text-restaurant-accent animate-pulse">
                  <RefreshCw size={15} className="animate-spin" />
                  {t.compressingPhoto}
                </div>
              ) : receiptImage ? (
                <div className="relative rounded-xl overflow-hidden border border-restaurant-accent/40 bg-gray-50 dark:bg-slate-800 p-2">
                  <div className="relative h-36 w-full flex items-center justify-center bg-black/5 dark:bg-black/40 rounded-lg overflow-hidden">
                    <img
                      src={receiptImage}
                      alt="Payment proof preview"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 px-1">
                    <span className="text-green-700 dark:text-green-400 font-bold flex items-center gap-1">
                      <Check size={12} /> {t.imageAttached}
                    </span>
                    <span>~{Math.round((receiptImage.length * 3) / 4 / 1024)} KB</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {/* Upload Photo from gallery */}
                  <label className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 hover:border-restaurant-accent hover:bg-cream-50/50 dark:hover:bg-slate-800 cursor-pointer transition text-center">
                    <Upload size={18} className="text-gray-500 dark:text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t.uploadPhoto}</span>
                    <span className="text-[10px] text-gray-400">{t.fromGallery}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleReceiptFileChange}
                    />
                  </label>

                  {/* Take Photo with Camera */}
                  <label className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-dashed border-gray-300 dark:border-slate-700 hover:border-restaurant-accent hover:bg-cream-50/50 dark:hover:bg-slate-800 cursor-pointer transition text-center">
                    <Camera size={18} className="text-gray-500 dark:text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t.takePhoto}</span>
                    <span className="text-[10px] text-gray-400">{t.useCamera}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleReceiptFileChange}
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

        </div>

        {/* FOOTER */}

        <div className="flex gap-3 border-t border-gray-200 p-5 dark:border-slate-800">

          <button
            onClick={onCancel}
            disabled={processing || compressingReceipt}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:text-gray-200 dark:hover:bg-slate-800"
          >
            {t.cancel}
          </button>

          <button
            onClick={handleConfirmSubmission}
            disabled={processing || compressingReceipt}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >

            {processing ? (
              <>
                <RefreshCw
                  size={18}
                  className="animate-spin"
                />

                {t.saving}
              </>
            ) : (
              <>
                <Check size={18} />

                {t.confirmPayment}
              </>
            )}

          </button>

        </div>

      </div>

    </div>
  );
}

/* ============================================================
   PAYMENT METHOD BUTTON
============================================================ */

function PaymentMethodButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        rounded-lg border px-3 py-3 text-sm font-semibold
        transition
        ${
          selected
            ? 'border-restaurant-accent bg-restaurant-accent/10 text-restaurant-accent'
            : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-slate-700 dark:text-gray-300'
        }
      `}
    >
      {label}
    </button>
  );
}

/* ============================================================
   ITEM NAME
============================================================ */

function getItemName(
  name: LocalizedName
): string {
  if (
    typeof name === 'string'
  ) {
    return name;
  }

  if (
    name &&
    typeof name.en === 'string' &&
    name.en.trim()
  ) {
    return name.en;
  }

  if (
    name &&
    typeof name.am === 'string' &&
    name.am.trim()
  ) {
    return name.am;
  }

  return 'Unnamed item';
}

function getAmharicName(
  name: LocalizedName
): string | null {
  if (
    typeof name === 'object' &&
    typeof name.am === 'string' &&
    name.am.trim()
  ) {
    return name.am;
  }

  return null;
}

/* ============================================================
   TABLE NAME
============================================================ */

function formatTableName(
  tableId: string | null,
  tables: Table[],
  isAmharic?: boolean
): string {
  if (!tableId) {
    return isAmharic ? 'ፓኮ / መውሰጃ' : 'Takeaway';
  }

  const table =
    tables.find(
      (item) =>
        item.id === tableId
    );

  if (!table) {
    return isAmharic ? 'ጠረጴዛ' : 'Table';
  }

  return (
    table.name ||
    (isAmharic ? `ጠረጴዛ ${table.table_number}` : `Table ${table.table_number}`)
  );
}

/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyState({
  type,
  isAmharic,
}: {
  type: Tab;
  isAmharic?: boolean;
}) {
  if (type === 'new') {
    return (
      <div className="restaurant-card p-10 text-center">

        <div className="flex justify-center mb-3">

          <Bell
            size={32}
            className="text-gray-400"
          />

        </div>

        <h3 className="font-semibold text-restaurant-text dark:text-white">
          {isAmharic ? 'ምንም አዲስ ትዕዛዝ የለም' : 'No new orders'}
        </h3>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {isAmharic
            ? 'አዳዲስ የደንበኛ ትዕዛዞች እዚህ ይታያሉ።'
            : 'New customer orders will appear here.'}
        </p>

      </div>
    );
  }

  if (type === 'payment_confirmation') {
    return (
      <div className="restaurant-card p-10 text-center">

        <div className="flex justify-center mb-3">

          <CheckCircle2
            size={32}
            className="text-purple-500"
          />

        </div>

        <h3 className="font-semibold text-restaurant-text dark:text-white">
          {isAmharic ? 'ምንም የሚረጋገጥ ክፍያ የለም' : 'No pending payment confirmations'}
        </h3>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {isAmharic
            ? 'በአስተናጋጆች የተላኩ የክፍያ ማረጋገጫዎች እዚህ ይታያሉ።'
            : 'Payment submissions from waiters awaiting cashier approval will appear here.'}
        </p>

      </div>
    );
  }

  return (
    <div className="restaurant-card p-10 text-center">

      <div className="flex justify-center mb-3">

        <PackageCheck
          size={32}
          className="text-gray-400"
        />

      </div>

      <h3 className="font-semibold text-restaurant-text dark:text-white">
        {isAmharic ? 'ምንም የተዘጋጀ ትዕዛዝ የለም' : 'No ready orders'}
      </h3>

      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {isAmharic
          ? 'በማብሰያ ቤት የተጠናቀቁ ትዕዛዞች እዚህ ይታያሉ።'
          : 'Orders completed by the kitchen will appear here.'}
      </p>

    </div>
  );
}

/* ============================================================
   MODIFY ORDER MODAL
============================================================ */

type EditItem = {
  id?: string;
  menu_item_id: string;
  item_name: LocalizedName;
  unit_price: number;
  quantity: number;
  notes?: string | null;
  status?: string;
};

function ModifyOrderModal({
  order,
  isAmharic,
  onCancel,
  onSaveSuccess,
}: {
  order: Order;
  isAmharic?: boolean;
  onCancel: () => void;
  onSaveSuccess: () => void;
}) {
  const [itemsToEdit, setItemsToEdit] = useState<EditItem[]>(() => {
    return (order.items || []).map((item) => ({
      id: item.id,
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      unit_price: Number(item.unit_price || (item.quantity > 0 ? item.subtotal / item.quantity : 0)),
      quantity: Number(item.quantity || 1),
      notes: item.notes || '',
      status: item.status || 'pending',
    }));
  });

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadMenu() {
      try {
        setLoadingMenu(true);
        const res = await fetch('/api/menu');
        const json = await res.json();
        if (json.success) {
          const list = json.data || json.items || [];
          setMenuItems(list);
        }
      } catch (err) {
        console.error('Failed to load menu items:', err);
      } finally {
        setLoadingMenu(false);
      }
    }
    loadMenu();
  }, []);

  const handleQuantityChange = (index: number, delta: number) => {
    setItemsToEdit((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        return next.filter((_, i) => i !== index);
      }
      next[index] = { ...next[index], quantity: newQty };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItemsToEdit((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddItem = (menuItem: any) => {
    if (!menuItem) return;
    setItemsToEdit((prev) => {
      const existingIdx = prev.findIndex((i) => i.menu_item_id === menuItem.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + 1,
        };
        return next;
      }
      const rawName = menuItem.name;
      const title = typeof rawName === 'object' ? (isAmharic ? rawName.am || rawName.en : rawName.en || rawName.am) : rawName;

      return [
        ...prev,
        {
          menu_item_id: menuItem.id,
          item_name: title || menuItem.title || 'Item',
          unit_price: Number(menuItem.price || 0),
          quantity: 1,
          notes: '',
          status: 'pending',
        },
      ];
    });
  };

  const computedSubtotal = itemsToEdit.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );
  const discount = Number(order.discount || 0);
  const tax = Number(order.tax || 0);
  const computedTotal = Math.max(0, computedSubtotal - discount + tax);

  const handleSave = async () => {
    if (itemsToEdit.length === 0) {
      setError(
        isAmharic
          ? 'እባክዎ ቢያንስ አንድ ምግብ ወይም መጠጥ በትዕዛዙ ውስጥ ያስቅሩ'
          : 'Please keep at least one food or drink item in the order'
      );
      return;
    }

    try {
      setSaving(true);
      setError('');

      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.id,
          action: 'modify_order',
          items: itemsToEdit,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to modify order');
      }

      onSaveSuccess();
    } catch (err) {
      console.error('Modify order error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  const filteredMenuItems = menuItems.filter((item) => {
    if (!searchFilter.trim()) return true;
    const nameStr = typeof item.name === 'object' ? `${item.name.en || ''} ${item.name.am || ''}` : String(item.name || '');
    return nameStr.toLowerCase().includes(searchFilter.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 dark:border-slate-800 space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Pencil size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                {isAmharic ? 'ትዕዛዝ አስተካክል (Modify Order)' : 'Modify Order Items'}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-mono font-bold">
                {order.order_number.startsWith('order-') ? order.order_number : `#${order.order_number}`}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* CURRENT ITEMS IN ORDER */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center justify-between">
            <span>{isAmharic ? 'በትዕዛዙ ውስጥ ያሉ ምግቦች/መጠጦች' : 'Order Items'} ({itemsToEdit.length})</span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
              Subtotal: {computedSubtotal.toFixed(2)} ETB
            </span>
          </h4>

          {itemsToEdit.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-stone-200 dark:border-slate-800 rounded-2xl text-stone-400 text-xs">
              {isAmharic ? 'ምንም ምግብ/መጠጥ የለም። እባክዎ ከታች አዲስ ያክሉ።' : 'No items left in order. Add items below.'}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {itemsToEdit.map((item, idx) => {
                const titleStr = typeof item.item_name === 'object'
                  ? (isAmharic ? item.item_name.am || item.item_name.en : item.item_name.en || item.item_name.am)
                  : String(item.item_name || 'Item');

                return (
                  <div
                    key={item.id || `${item.menu_item_id}-${idx}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl border border-stone-200 dark:border-slate-800 bg-stone-50 dark:bg-slate-800/60 gap-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-bold text-stone-900 dark:text-white">
                        {titleStr}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                        {item.unit_price.toFixed(2)} ETB × {item.quantity} = <strong className="text-stone-900 dark:text-white">{(item.unit_price * item.quantity).toFixed(2)} ETB</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Quantity Controls */}
                      <div className="flex items-center rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(idx, -1)}
                          className="w-7 h-7 flex items-center justify-center text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-mono font-bold text-xs">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(idx, 1)}
                          className="w-7 h-7 flex items-center justify-center text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold"
                        >
                          +
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition"
                        title={isAmharic ? 'ምግቡን ከትዕዛዝ አስወግድ' : 'Remove item'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ADD NEW ITEM FROM MENU */}
        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-slate-800/40 border border-amber-200/60 dark:border-slate-700/60 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
            <Plus size={14} />
            <span>{isAmharic ? 'አዲስ ምግብ ወይም መጠጥ ጨምር' : 'Add Food or Drink to Order'}</span>
          </h4>

          {loadingMenu ? (
            <div className="text-xs text-stone-500 py-2 flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin text-amber-600" />
              <span>{isAmharic ? 'የምግብ ዝርዝር በመጫን ላይ...' : 'Loading menu items...'}</span>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder={isAmharic ? 'ምግብ ወይም መጠጥ በስም ፈልግ...' : 'Search food or drink by name...'}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              />

              <div className="max-h-36 overflow-y-auto divide-y divide-stone-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-xl border border-stone-200 dark:border-slate-800">
                {filteredMenuItems.length === 0 ? (
                  <p className="p-3 text-xs text-stone-400 text-center">
                    {isAmharic ? 'ምንም አልተገኘም' : 'No menu items found'}
                  </p>
                ) : (
                  filteredMenuItems.map((m) => {
                    const title = typeof m.name === 'object' ? (isAmharic ? m.name.am || m.name.en : m.name.en || m.name.am) : m.name;
                    return (
                      <div
                        key={m.id}
                        onClick={() => handleAddItem(m)}
                        className="p-2.5 flex items-center justify-between hover:bg-amber-50 dark:hover:bg-slate-800 cursor-pointer transition text-xs"
                      >
                        <div>
                          <p className="font-bold text-stone-900 dark:text-white">{title}</p>
                          <p className="text-[10px] text-stone-400 capitalize">{m.category || 'Menu Item'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{Number(m.price).toFixed(2)} ETB</span>
                          <span className="p-1 rounded-lg bg-amber-600 text-white font-bold text-[10px] flex items-center gap-0.5">
                            <Plus size={12} /> {isAmharic ? 'ጨምር' : 'Add'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* SUMMARY TOTALS */}
        <div className="p-4 rounded-2xl bg-stone-100 dark:bg-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
            {isAmharic ? 'አዲስ አጠቃላይ ዋጋ (New Total):' : 'New Order Total:'}
          </span>
          <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
            {computedTotal.toFixed(2)} ETB
          </span>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-stone-300 dark:border-slate-700 text-stone-700 dark:text-stone-300 font-bold text-xs hover:bg-stone-100 dark:hover:bg-slate-800 transition"
          >
            {isAmharic ? 'ሰርዝ (Cancel)' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>{isAmharic ? 'በማስቀመጥ ላይ...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>{isAmharic ? 'ለውጦችን አስቀምጥ (Save Order)' : 'Save Order Modifications'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}