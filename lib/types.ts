// Language type
export type Language = 'en' | 'am';

// Localized string type
export interface LocalizedString {
  en: string;
  am?: string;
}

// =========================================================
// MENU CATEGORY
// =========================================================

export type MenuCategoryType = 'food' | 'drink';

export interface MenuCategory {
  id: string;
  name: LocalizedString;
  description?: LocalizedString;
  icon?: string;
  type: MenuCategoryType;
  displayOrder: number;
  visible: boolean;
}

// =========================================================
// MENU ITEM
// =========================================================

export interface MenuItem {
  id: string;
  categoryId: string;
  name: LocalizedString;
  description: LocalizedString;
  price: number;
  currency: string;
  image?: string | null;
  available: boolean;
  featured: boolean;
  fasting: boolean;
  vegetarian: boolean;
  spicy: boolean;
  ingredients?: string[];
  allergens?: string[];
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

// =========================================================
// CATERING SERVICE
// =========================================================

export interface CateringService {
  id: string;
  name: LocalizedString;
  description: LocalizedString;
  price?: number;
  serviceTypes: string[];
  image?: string;
  featured: boolean;
  displayOrder: number;
}

// =========================================================
// RESTAURANT SETTINGS
// =========================================================

export interface RestaurantSettings {
  id: string;
  name: LocalizedString;
  tagline?: LocalizedString;
  description?: LocalizedString;
  logo?: string | null;
  coverImage?: string | null;
  phone: string;
  whatsapp?: string;
  email?: string;
  address: LocalizedString;
  googleMapsUrl?: string;
  openingHours: OpeningHours;
  currency: string;
  defaultLanguage: Language;
  availableLanguages: Language[];

  social?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    website?: string;
  };

  catering?: {
    available: boolean;
    contactPhone?: string;
    contactEmail?: string;
    services: string[];
  };
}

// =========================================================
// OPENING HOURS
// =========================================================

export interface OpeningHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
  notes?: LocalizedString;
}

// =========================================================
// ADMIN / STAFF USER
// =========================================================

export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;

  role:
    | 'owner'
    | 'manager'
    | 'editor'
    | 'waiter'
    | 'cashier'
    | 'chef';

  createdAt: string;
  lastLogin?: string;
}

// =========================================================
// ANALYTICS EVENT
// =========================================================

export interface AnalyticsEvent {
  id: string;

  eventType:
    | 'view'
    | 'favorite'
    | 'search'
    | 'filter'
    | 'share';

  itemId?: string;
  categoryId?: string;
  timestamp: string;
  userAgent?: string;
  referer?: string;
}

// =========================================================
// FAVORITES
// =========================================================

export interface FavoritesStorage {
  itemIds: Set<string>;

  addFavorite: (itemId: string) => void;
  removeFavorite: (itemId: string) => void;
  isFavorite: (itemId: string) => boolean;
  clearAll: () => void;
}

// =========================================================
// RECENTLY VIEWED
// =========================================================

export interface RecentlyViewedStorage {
  items: Array<{
    itemId: string;
    viewedAt: number;
  }>;

  addItem: (itemId: string) => void;
  getRecent: (limit: number) => string[];
  clear: () => void;
}

// =========================================================
// API RESPONSE TYPES
// =========================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =========================================================
// CAFE ORDER MANAGEMENT SYSTEM
// =========================================================

// =========================================================
// TABLE
// =========================================================

export interface Table {
  id: string;
  name: string;
  number: number;
  qr_code_url?: string | null;
  is_active: boolean;
  created_at: string;
}

// =========================================================
// TABLE SESSION
// =========================================================

export type TableSessionStatus =
  | 'active'
  | 'closed';

export interface TableSession {
  id: string;
  table_id: string;
  session_name: string;
  status: TableSessionStatus;
  opened_at: string;
  closed_at?: string | null;
}

// =========================================================
// ORDER
// =========================================================

export type OrderStatus =
  | 'OPEN'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'CLOSED';

export interface Order {
  id: string;
  table_session_id: string;
  waiter_id: string;
  status: OrderStatus;
  total_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;

  // Joins
  table_session?: TableSession;
  waiter?: AdminUser;
  items?: OrderItem[];
  payments?: Payment[];
}

// =========================================================
// KITCHEN
// =========================================================

/**
 * Every ordered item is routed to one kitchen.
 *
 * food  -> Food Kitchen
 * drink -> Drink Kitchen
 */
export type KitchenType =
  | 'food'
  | 'drink';

/**
 * Status of an individual kitchen ticket.
 *
 * One customer order can have:
 *
 * Food Ticket  -> READY
 * Drink Ticket -> PREPARING
 */
export type KitchenTicketStatus =
  | 'PENDING'
  | 'PREPARING'
  | 'READY'
  | 'CANCELLED';

// =========================================================
// ORDER ITEM
// =========================================================

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;

  name: LocalizedString;

  price: number;
  quantity: number;

  notes?: string | null;

  /**
   * Kitchen responsible for preparing this item.
   *
   * This value should be saved when the order item
   * is created so changing a category later does
   * not change old orders.
   */
  kitchen_type: KitchenType;

  created_at: string;
}

// =========================================================
// KITCHEN TICKET
// =========================================================

export interface KitchenTicket {
  id: string;

  order_id: string;

  kitchen_type: KitchenType;

  status: KitchenTicketStatus;

  created_at: string;

  started_at?: string | null;

  ready_at?: string | null;

  cancelled_at?: string | null;

  /**
   * Order items assigned to this kitchen ticket.
   */
  items?: OrderItem[];
}

// =========================================================
// PAYMENTS
// =========================================================

export type PaymentMethod =
  | 'CASH'
  | 'TRANSFER';

export type PaymentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'FAILED';

export interface Payment {
  id: string;
  order_id: string;

  payment_method: PaymentMethod;

  amount: number;

  payment_status: PaymentStatus;

  receipt_url?: string | null;

  uploaded_by?: string | null;

  uploaded_at: string;

  confirmed_by?: string | null;

  confirmed_at?: string | null;
}

// =========================================================
// ORDER HISTORY
// =========================================================

export interface OrderHistory {
  id: string;
  order_id: string;
  user_id: string;

  action: string;

  old_status?: string | null;
  new_status?: string | null;

  notes?: string | null;

  created_at: string;
}

// =========================================================
// NOTIFICATIONS
// =========================================================

export interface Notification {
  id: string;
  user_id: string;
  order_id: string;

  message: string;

  is_read: boolean;

  created_at: string;
}

// =========================================================
// INVENTORY & ALERTS
// =========================================================

export type InventoryCategoryType = 'food' | 'drink';

export interface InventoryItem {
  id: string;
  name: string;
  category_type: InventoryCategoryType;
  quantity: number;
  unit: string;
  min_threshold: number;
  cost_per_unit?: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryNotification {
  id: string;
  item_id: string;
  item_name: string;
  category_type: InventoryCategoryType;
  current_quantity: number;
  min_threshold: number;
  sender_role: string;
  message: string;
  status: 'unread' | 'read' | 'resolved';
  created_at: string;
  updated_at?: string;
}