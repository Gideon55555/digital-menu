// Language type
export type Language = 'en' | 'am';

// Localized string type
export interface LocalizedString {
  en: string;
  am?: string;
}

// Menu category type
export interface MenuCategory {
  id: string;
  name: LocalizedString;
  description?: LocalizedString;
  icon?: string;
  displayOrder: number;
  visible: boolean;
}

// Menu item type
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

// Catering service type
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

// Restaurant settings type
export interface RestaurantSettings {
  id: string;
  name: LocalizedString;
  tagline?: LocalizedString;
  description?: LocalizedString;
  logo?: string;
  coverImage?: string;
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

// Opening hours type
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

// Admin user type
export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'owner' | 'manager' | 'editor';
  createdAt: string;
  lastLogin?: string;
}

// Analytics event type
export interface AnalyticsEvent {
  id: string;
  eventType: 'view' | 'favorite' | 'search' | 'filter' | 'share';
  itemId?: string;
  categoryId?: string;
  timestamp: string;
  userAgent?: string;
  referer?: string;
}

// Favorites storage type (client-side)
export interface FavoritesStorage {
  itemIds: Set<string>;
  addFavorite: (itemId: string) => void;
  removeFavorite: (itemId: string) => void;
  isFavorite: (itemId: string) => boolean;
  clearAll: () => void;
}

// Recently viewed storage type (client-side)
export interface RecentlyViewedStorage {
  items: Array<{ itemId: string; viewedAt: number }>;
  addItem: (itemId: string) => void;
  getRecent: (limit: number) => string[];
  clear: () => void;
}

// API response types
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
