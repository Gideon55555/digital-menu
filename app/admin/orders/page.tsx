'use client';

import { useEffect, useRef, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAdminAuth } from '@/lib/admin-auth';
import { supabase } from '@/lib/supabase';
import { playNotificationSound } from '@/lib/audio';
import {
  Bell,
  RefreshCw,
  Check,
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

type Tab = 'new' | 'ready';

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

  const [channelConnected, setChannelConnected] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevReadyCount = useRef<number>(-1);
  const prevNewCount = useRef<number>(-1);

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

    const confirmed =
      window.confirm(
        'Are you sure you want to cancel this order?'
      );

    if (!confirmed) {
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
            status: 'cancelled',
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
    setPaymentAmount(
      Number(order.total).toFixed(2)
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

  async function recordPaymentAndClose() {
    if (
      !paymentOrder ||
      processingOrderId
    ) {
      return;
    }

    const amount =
      Number(paymentAmount);

    const total =
      Number(paymentOrder.total);

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

    if (
      Math.abs(amount - total) >
      0.01
    ) {
      setPaymentError(
        `Payment amount must be ${total.toFixed(
          2
        )} ETB.`
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
                order.id !==
                paymentOrder.id
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
        order.status === 'ready' ||
        order.status === 'payment_pending'
    );

  // Audio alerts for new orders & orders marked ready by kitchen
  useEffect(() => {
    const newCount = newOrders.length;
    const readyCount = readyOrders.length;

    if (prevNewCount.current >= 0 && newCount > prevNewCount.current && !loading) {
      if (soundEnabled) playNotificationSound('new_order');
    }
    if (prevReadyCount.current >= 0 && readyCount > prevReadyCount.current && !loading) {
      if (soundEnabled) playNotificationSound('ready');
    }

    prevNewCount.current = newCount;
    prevReadyCount.current = readyCount;
  }, [newOrders.length, readyOrders.length, soundEnabled, loading]);

  const visibleOrders =
    activeTab === 'new'
      ? newOrders
      : readyOrders;

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

        </div>

        {/* ORDERS */}

        {visibleOrders.length === 0 ? (

          <EmptyState
            type={activeTab}
            isAmharic={isAmharic}
          />

        ) : (

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

            {visibleOrders.map(
              (order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  activeTab={activeTab}
                  tables={tables}
                  isAmharic={isAmharic}
                  processing={
                    processingOrderId ===
                    order.id
                  }
                  onConfirmAndSend={
                    confirmAndSend
                  }
                  onCancel={
                    cancelOrder
                  }
                  onRecordPayment={
                    openPaymentModal
                  }
                  onApprovePayment={
                    approvePayment
                  }
                  onRejectPayment={
                    rejectPayment
                  }
                />
              )
            )}

          </div>

        )}

      </div>

      {/* =====================================================
          PAYMENT MODAL
      ====================================================== */}

      {paymentOrder && (
        <PaymentModal
          order={paymentOrder}
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

    </AdminLayout>
  );
}

/* ============================================================
   ORDER CARD
============================================================ */

function OrderCard({
  order,
  activeTab,
  tables,
  processing,
  onConfirmAndSend,
  onCancel,
  onRecordPayment,
  onApprovePayment,
  onRejectPayment,
  isAmharic,
}: {
  order: Order;
  activeTab: Tab;
  tables: Table[];
  processing: boolean;

  onConfirmAndSend: (
    orderId: string
  ) => void;

  onCancel: (
    orderId: string
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
  const [isExpanded, setIsExpanded] = useState(false);
  const isPendingApproval = order.payment?.payment_status === 'PENDING' || order.status === 'payment_pending';
  const tableName = formatTableName(order.table_id, tables, isAmharic);
  const orderNumberStr = order.order_number.startsWith('order-') ? order.order_number : `#${order.order_number}`;

  return (
    <div className={`restaurant-card overflow-hidden transition-all shadow-xs ${isPendingApproval ? 'ring-2 ring-amber-400 dark:ring-amber-600' : ''}`}>

      {/* ACCORDION HEADER BAR (Always Visible) */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 bg-white dark:bg-slate-900 hover:bg-cream-50/70 dark:hover:bg-slate-800/60 cursor-pointer flex items-center justify-between gap-3 border-b border-cream-200 dark:border-slate-800 transition select-none"
      >
        <div className="flex items-center gap-3">
          <button 
            type="button"
            className="p-1 rounded-lg text-gray-400 hover:text-restaurant-accent hover:bg-cream-100 dark:hover:bg-slate-800 transition"
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold text-restaurant-text dark:text-white">
                {orderNumberStr}
              </span>

              {activeTab === 'new' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[11px] font-bold">
                  <Clock size={11} />
                  {isAmharic ? 'አዲስ' : 'New'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold">
                  <PackageCheck size={11} />
                  {isAmharic ? 'ተዘጋጅቷል' : 'Ready'}
                </span>
              )}

              {isPendingApproval && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[11px] font-bold animate-pulse">
                  {isAmharic ? 'ማረጋገጫ' : 'Approval'}
                </span>
              )}
            </div>

            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-0.5 flex items-center gap-2">
              <span>{isAmharic ? 'ጠረጴዛ:' : 'Table:'} <strong className="text-gray-900 dark:text-white">{tableName}</strong></span>
              <span>•</span>
              <span className="text-gray-400">{(order.items || []).length} {isAmharic ? 'እቃዎች' : 'items'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-gray-400 block">{isAmharic ? 'ጠቅላላ' : 'Total'}</span>
            <span className="text-base font-extrabold text-restaurant-accent">
              {Number(order.total).toFixed(2)} {isAmharic ? 'ብር' : 'ETB'}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-xs font-bold text-gray-500 hover:text-restaurant-accent px-2 py-1 rounded-lg border border-cream-200 dark:border-slate-800 hidden sm:block"
          >
            {isExpanded ? (isAmharic ? 'ዘጋ' : 'Hide') : (isAmharic ? 'ዝርዝር' : 'Details')}
          </button>
        </div>
      </div>

      {/* QUICK ACTIONS BAR (Visible when collapsed) */}
      {!isExpanded && (
        <div className="p-3 bg-cream-50/50 dark:bg-slate-850 flex items-center justify-between gap-2 border-b border-cream-100 dark:border-slate-800">
          <span className="text-xs text-gray-400 px-1">
            {formatTime(order.created_at)}
          </span>

          <div className="flex items-center gap-2">
            {isPendingApproval ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onApprovePayment) onApprovePayment(order.id);
                }}
                disabled={processing}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs disabled:opacity-50"
              >
                <Check size={14} />
                <span>{isAmharic ? 'አጽድቅ' : 'Approve'}</span>
              </button>
            ) : activeTab === 'new' ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirmAndSend(order.id);
                }}
                disabled={processing}
                className="px-3.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
              >
                <Check size={14} />
                <span>{isAmharic ? 'አረጋግጥና ላክ' : 'Confirm & Send'}</span>
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRecordPayment(order);
                }}
                disabled={processing}
                className="px-3.5 py-1.5 rounded-lg bg-restaurant-accent hover:bg-restaurant-accent-dark text-white text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
              >
                <CreditCard size={14} />
                <span>{isAmharic ? 'ክፍያ ተቀበል' : 'Record Payment'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* EXPANDABLE ACCORDION CONTENT */}
      {isExpanded && (
        <div className="space-y-4 p-5 bg-white dark:bg-slate-900 border-t border-cream-100 dark:border-slate-800">
          {/* PENDING WAITER PAYMENT APPROVAL BANNER */}
          {isPendingApproval && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-600 animate-pulse" />
                  {isAmharic ? 'በአስተናጋጅ ተልኳል - ማረጋገጫ ይጠብቃል' : 'Submitted by Waiter - Pending Approval'}
                </span>
                {order.payment?.payment_method && (
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded bg-amber-200/60 dark:bg-amber-900/60 uppercase">
                    {order.payment.payment_method}
                  </span>
                )}
              </div>

              {order.payment?.receipt_image && (
                <div className="relative h-32 w-full rounded-lg overflow-hidden border border-amber-300 dark:border-amber-800 bg-black/5 dark:bg-black/40 flex items-center justify-center p-1">
                  <img
                    src={order.payment.receipt_image}
                    alt="Payment receipt proof"
                    className="max-h-full max-w-full object-contain rounded"
                  />
                </div>
              )}

              {Number(order.payment?.tip_amount || 0) > 0 && (
                <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center justify-between">
                  <span>{isAmharic ? 'የተሰጠ ጉርሻ (ቲፕ):' : 'Waiter Tip:'}</span>
                  <span className="font-bold text-amber-700 dark:text-amber-300">+{Number(order.payment?.tip_amount).toFixed(2)} ETB</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => onApprovePayment && onApprovePayment(order.id)}
                  disabled={processing}
                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Check size={15} />
                  {isAmharic ? 'አጽድቅና ጨርስ' : 'Approve & Close'}
                </button>

                <button
                  onClick={() => onRejectPayment && onRejectPayment(order.id)}
                  disabled={processing}
                  className="py-2 px-3 rounded-lg border border-red-300 hover:bg-red-50 text-red-700 dark:border-red-900 dark:hover:bg-red-950/40 text-xs font-bold transition flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <X size={15} />
                  {isAmharic ? 'ውድቅ አድርግ' : 'Reject'}
                </button>
              </div>
            </div>
          )}

          {/* ORDER ITEMS TABLE */}
          <div>
            <p className="text-xs uppercase tracking-wide font-semibold text-gray-400 mb-2">
              {isAmharic ? 'የታዘዙ ምግቦች ዝርዝር' : 'Ordered Items'}
            </p>

            {!order.items || order.items.length === 0 ? (
              <div className="py-4 text-center text-xs text-red-500">
                {isAmharic ? 'ምንም እቃ የለም።' : 'No items in this order.'}
              </div>
            ) : (
              <div className="space-y-2">
                {order.items.map((item) => (
                  <OrderItemRow
                    key={item.id}
                    item={item}
                    isAmharic={isAmharic}
                  />
                ))}
              </div>
            )}
          </div>

          {/* NOTE */}
          {order.notes && (
            <div className="p-3 rounded-xl bg-cream-50 dark:bg-slate-800 border border-cream-200 dark:border-slate-700">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                {isAmharic ? 'ማስታወሻ' : 'Order Note'}
              </p>
              <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-200">
                {order.notes}
              </p>
            </div>
          )}

          {/* TIME & ID SUMMARY */}
          <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-cream-100 dark:border-slate-800">
            <span>{isAmharic ? 'የተመዘገበበት ሰዓት:' : 'Time:'} {formatTime(order.created_at)}</span>
            <span>ID: {order.id.slice(0, 8)}...</span>
          </div>

          {/* ACTIONS */}
          <div className="pt-2 border-t border-gray-200 dark:border-slate-800">
            {activeTab === 'new' ? (
              <div className="flex gap-2">
                <button
                  onClick={() => onConfirmAndSend(order.id)}
                  disabled={processing}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50 transition"
                >
                  <Check size={16} />
                  {processing
                    ? isAmharic
                      ? 'በመላክ ላይ...'
                      : 'Sending...'
                    : isAmharic
                    ? 'አረጋግጥና ላክ'
                    : 'Confirm & Send'}
                </button>

                <button
                  onClick={() => onCancel(order.id)}
                  disabled={processing}
                  title={isAmharic ? 'ትዕዛዝ ሰርዝ' : 'Cancel order'}
                  className="px-3.5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20 disabled:opacity-50 transition"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onRecordPayment(order)}
                disabled={processing}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-restaurant-accent text-white text-xs font-bold hover:bg-restaurant-accent-dark disabled:opacity-50 transition"
              >
                <CreditCard size={16} />
                {isAmharic ? 'ክፍያ ተቀበል' : 'Record Payment'}
              </button>
            )}
          </div>
        </div>
      )}
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
    <div className="flex items-start justify-between gap-4">

      <div className="flex items-start gap-3 min-w-0">

        <span className="flex-shrink-0 min-w-[28px] h-7 px-1.5 rounded-md bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-restaurant-accent">
          {item.quantity}×
        </span>

        <div className="min-w-0">

          <p className="font-medium text-restaurant-text dark:text-white">
            {primaryName}
          </p>

          {secondaryName && secondaryName !== primaryName && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {secondaryName}
            </p>
          )}

          {item.notes && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {isAmharic ? 'ማስታወሻ: ' : 'Note: '}{item.notes}
            </p>
          )}

        </div>

      </div>

      <span className="flex-shrink-0 text-sm font-medium">
        {Number(
          item.subtotal
        ).toFixed(2)}{' '}
        {isAmharic ? 'ብር' : 'ETB'}
      </span>

    </div>
  );
}



/* ============================================================
   PAYMENT MODAL
============================================================ */

function PaymentModal({
  order,
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

  onConfirm: () => void;
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

  const parsedOrderTotal = Number(order.total) || 0;
  const parsedTip = Number(tipAmount) || 0;
  const grandTotal = parsedOrderTotal + parsedTip;

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
            onClick={onConfirm}
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
   TIME
============================================================ */

function formatTime(
  date: string
): string {
  try {
    return new Date(
      date
    ).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
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