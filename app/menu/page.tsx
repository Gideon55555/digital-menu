'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';

import {
  MenuItem,
  MenuCategory,
  RestaurantSettings,
  Language,
} from '@/lib/types';

import { FoodCard } from '@/components/menu/FoodCard';
import { SearchBar } from '@/components/menu/SearchBar';
import { CategoryNav } from '@/components/menu/CategoryNav';
import { MenuHeader } from '@/components/menu/MenuHeader';

import { storageKeys } from '@/lib/utils/common';
import { trackEvent } from '@/lib/analytics';

export default function MenuPage() {
  const [mounted, setMounted] = useState(false);

  // =========================================================
  // SUPABASE DATA
  // =========================================================

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categoryList, setCategoryList] =
    useState<MenuCategory[]>([]);
  const [restaurantData, setRestaurantData] =
    useState<RestaurantSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // =========================================================
  // MENU STATE
  // =========================================================

  const [selectedCategory, setSelectedCategory] =
    useState<string>('all');

  // Categories expanded in the "All" view
  const [expandedCategories, setExpandedCategories] =
    useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] =
    useState('');

  // =========================================================
  // LANGUAGE
  // =========================================================

  const [language, setLanguage] =
    useState<Language>('en');

  // =========================================================
  // FAVORITES
  // =========================================================

  const [favorites, setFavorites] =
    useState<Set<string>>(new Set());

  // =========================================================
  // RECENTLY VIEWED
  // =========================================================

  const [recentlyViewed, setRecentlyViewed] =
    useState<string[]>([]);

  // =========================================================
  // SELECTED ITEM
  // =========================================================

  const [selectedItem, setSelectedItem] =
    useState<MenuItem | null>(null);

  // =========================================================
  // QR TABLE NUMBER
  // =========================================================

  const [tableNumber, setTableNumber] =
    useState<string | null>(null);

  // Prevent duplicate menu visit tracking
  const analyticsTracked = useRef(false);

  // =========================================================
  // INITIALIZE PAGE
  // =========================================================

  useEffect(() => {
    setMounted(true);

    // -------------------------------------------------------
    // GET TABLE NUMBER FROM QR URL
    //
    // Example:
    // /menu?table=5
    // -------------------------------------------------------

    const params = new URLSearchParams(
      window.location.search
    );

    const table = params.get('table');

    if (table && table.trim()) {
      setTableNumber(table.trim());
    }

    // -------------------------------------------------------
    // LOAD LANGUAGE
    // -------------------------------------------------------

    const savedLanguage =
      localStorage.getItem(
        storageKeys.language
      ) as Language | null;

    if (savedLanguage) {
      setLanguage(savedLanguage);
    }

    // -------------------------------------------------------
    // LOAD FAVORITES
    // -------------------------------------------------------

    const savedFavorites =
      localStorage.getItem(
        storageKeys.favorites
      );

    if (savedFavorites) {
      try {
        setFavorites(
          new Set(JSON.parse(savedFavorites))
        );
      } catch {
        console.error(
          'Failed to load favorites'
        );
      }
    }

    // -------------------------------------------------------
    // LOAD RECENTLY VIEWED
    // -------------------------------------------------------

    const savedRecent =
      localStorage.getItem(
        storageKeys.recentlyViewed
      );

    if (savedRecent) {
      try {
        setRecentlyViewed(
          JSON.parse(savedRecent)
        );
      } catch {
        console.error(
          'Failed to load recently viewed'
        );
      }
    }
  }, []);

  // =========================================================
  // LOAD EVERYTHING FROM SUPABASE
  // =========================================================

  useEffect(() => {
    if (!mounted) return;

    async function loadData() {
      try {
        setLoading(true);
        setError('');

        const [
          menuResponse,
          categoryResponse,
          restaurantResponse,
        ] = await Promise.all([
          fetch('/api/menu'),
          fetch('/api/categories'),
          fetch('/api/restaurant'),
        ]);

        // ---------------------------------------------------
        // CHECK RESPONSES
        // ---------------------------------------------------

        if (!menuResponse.ok) {
          throw new Error(
            `Menu request failed: ${menuResponse.status}`
          );
        }

        if (!categoryResponse.ok) {
          throw new Error(
            `Category request failed: ${categoryResponse.status}`
          );
        }

        if (!restaurantResponse.ok) {
          throw new Error(
            `Restaurant request failed: ${restaurantResponse.status}`
          );
        }

        // ---------------------------------------------------
        // PARSE RESPONSES
        // ---------------------------------------------------

        const menuResult =
          await menuResponse.json();

        const categoryResult =
          await categoryResponse.json();

        const restaurantResult =
          await restaurantResponse.json();

        // ---------------------------------------------------
        // VALIDATE MENU
        // ---------------------------------------------------

        if (!menuResult.success) {
          throw new Error(
            menuResult.error ||
              'Failed to load menu items'
          );
        }

        // ---------------------------------------------------
        // VALIDATE CATEGORIES
        // ---------------------------------------------------

        if (!categoryResult.success) {
          throw new Error(
            categoryResult.error ||
              'Failed to load categories'
          );
        }

        // ---------------------------------------------------
        // VALIDATE RESTAURANT
        // ---------------------------------------------------

        if (!restaurantResult.success) {
          throw new Error(
            restaurantResult.error ||
              'Failed to load restaurant settings'
          );
        }

        // ---------------------------------------------------
        // MENU
        // ---------------------------------------------------

        setMenuItems(
          menuResult.data || []
        );

        // ---------------------------------------------------
        // CATEGORIES
        // ---------------------------------------------------

        const loadedCategories:
          MenuCategory[] =
          categoryResult.data || [];

        // Add "All" as a frontend-only category
        const allCategory: MenuCategory = {
          id: 'all',

          name: {
            en: 'All',
          },

          description: {
            en: 'All menu items',
          },

          icon: 'Utensils',

          type: 'food',

          displayOrder: -1,

          visible: true,
        };

        // Put All first
        setCategoryList([
          allCategory,
          ...loadedCategories,
        ]);

        // ---------------------------------------------------
        // EXPAND ALL CATEGORIES INITIALLY
        // ---------------------------------------------------

        setExpandedCategories(
          new Set(
            loadedCategories.map(
              (category: MenuCategory) =>
                category.id
            )
          )
        );

        // ---------------------------------------------------
        // SELECT ALL BY DEFAULT
        // ---------------------------------------------------

        setSelectedCategory('all');

        // ---------------------------------------------------
        // RESTAURANT
        //
        // Supabase:
        // opening_hours
        // available_languages
        // google_maps_url
        //
        // Application:
        // openingHours
        // availableLanguages
        // googleMapsUrl
        // ---------------------------------------------------

        const data =
          restaurantResult.data;

        const formattedRestaurant:
          RestaurantSettings = {
          id: data.id,

          name: data.name,

          tagline: data.tagline,

          description: data.description,

          logo: data.logo ?? null,

          coverImage:
            data.cover_image ?? null,

          phone: data.phone,

          whatsapp:
            data.whatsapp ?? null,

          email:
            data.email ?? null,

          address: data.address,

          googleMapsUrl:
            data.google_maps_url ?? null,

          openingHours:
            data.opening_hours,

          currency:
            data.currency,

          defaultLanguage:
            data.default_language,

          availableLanguages:
            data.available_languages || [],

          social:
            data.social ?? null,

          catering:
            data.catering ?? null,
        };

        setRestaurantData(
          formattedRestaurant
        );
      } catch (error) {
        console.error(
          'Failed to load menu:',
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : 'Failed to load the menu. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [mounted]);

  // =========================================================
  // TRACK MENU VISIT
  // =========================================================

  useEffect(() => {
    if (!mounted) return;

    if (analyticsTracked.current) {
      return;
    }

    // Wait until table number has been determined
    // from the URL before recording the visit.
    if (
      window.location.search.includes('table=') &&
      tableNumber === null
    ) {
      return;
    }

    analyticsTracked.current = true;

    trackEvent({
      eventType: 'menu_visit',

      tableNumber:
        tableNumber ?? undefined,
    });
  }, [
    mounted,
    tableNumber,
  ]);

  // =========================================================
  // PERSIST LANGUAGE
  // =========================================================

  useEffect(() => {
    if (!mounted) return;

    localStorage.setItem(
      storageKeys.language,
      language
    );
  }, [
    language,
    mounted,
  ]);

  // =========================================================
  // PERSIST FAVORITES
  // =========================================================

  useEffect(() => {
    if (!mounted) return;

    localStorage.setItem(
      storageKeys.favorites,
      JSON.stringify(
        Array.from(favorites)
      )
    );
  }, [
    favorites,
    mounted,
  ]);

  // =========================================================
  // PERSIST RECENTLY VIEWED
  // =========================================================

  useEffect(() => {
    if (!mounted) return;

    localStorage.setItem(
      storageKeys.recentlyViewed,
      JSON.stringify(
        recentlyViewed
      )
    );
  }, [
    recentlyViewed,
    mounted,
  ]);

  // =========================================================
  // FAVORITES
  // =========================================================

  const handleFavorite = useCallback(
    (
      itemId: string,
      isFavorite: boolean
    ) => {
      setFavorites((previous) => {
        const updated =
          new Set(previous);

        if (isFavorite) {
          updated.add(itemId);
        } else {
          updated.delete(itemId);
        }

        return updated;
      });
    },
    []
  );

  // =========================================================
  // VIEW ITEM
  // =========================================================

  const handleViewItem = useCallback(
    (itemId: string) => {
      const item =
        menuItems.find(
          (current) =>
            current.id === itemId
        );

      if (!item) return;

      setSelectedItem(item);

      // -----------------------------------------------------
      // RECENTLY VIEWED
      // -----------------------------------------------------

      setRecentlyViewed((previous) => {
        const filtered =
          previous.filter(
            (id) => id !== itemId
          );

        return [
          itemId,
          ...filtered,
        ].slice(0, 5);
      });

      // -----------------------------------------------------
      // ANALYTICS
      // -----------------------------------------------------

      trackEvent({
        eventType:
          'menu_item_view',

        itemId: item.id,

        categoryId:
          item.categoryId,

        tableNumber:
          tableNumber ?? undefined,
      });
    },
    [
      menuItems,
      tableNumber,
    ]
  );

  // =========================================================
  // CATEGORY ACCORDION
  // =========================================================

  const toggleCategory = useCallback(
    (categoryId: string) => {
      setExpandedCategories(
        (previous) => {
          const updated =
            new Set(previous);

          if (
            updated.has(categoryId)
          ) {
            updated.delete(categoryId);
          } else {
            updated.add(categoryId);
          }

          return updated;
        }
      );
    },
    []
  );

  // =========================================================
  // FILTER ITEMS
  // =========================================================

  const filteredItems = useMemo(() => {
    let items = [...menuItems];

    // -------------------------------------------------------
    // CATEGORY FILTER
    // -------------------------------------------------------

    if (
      selectedCategory !== 'all'
    ) {
      items =
        items.filter(
          (item) =>
            item.categoryId ===
            selectedCategory
        );
    }

    // -------------------------------------------------------
    // SEARCH
    // -------------------------------------------------------

    if (searchQuery.trim()) {
      const query =
        searchQuery
          .toLowerCase()
          .trim();

      items =
        items.filter(
          (item) => {
            const nameMatch =
              item.name.en
                .toLowerCase()
                .includes(query) ||
              (
                item.name.am
                  ?.toLowerCase()
                  .includes(query) ??
                false
              );

            const descriptionMatch =
              item.description.en
                .toLowerCase()
                .includes(query) ||
              (
                item.description.am
                  ?.toLowerCase()
                  .includes(query) ??
                false
              );

            return (
              nameMatch ||
              descriptionMatch
            );
          }
        );
    }

    return items.sort(
      (a, b) =>
        a.displayOrder -
        b.displayOrder
    );
  }, [
    menuItems,
    selectedCategory,
    searchQuery,
  ]);

  // =========================================================
  // GROUP BY CATEGORY
  // =========================================================

  const groupedItems = useMemo(() => {
    const groups: Record<
      string,
      MenuItem[]
    > = {};

    filteredItems.forEach(
      (item) => {
        if (
          !groups[item.categoryId]
        ) {
          groups[item.categoryId] =
            [];
        }

        groups[
          item.categoryId
        ].push(item);
      }
    );

    return groups;
  }, [
    filteredItems,
  ]);

  // =========================================================
  // LOADING
  // =========================================================

  if (
    !mounted ||
    loading ||
    !restaurantData
  ) {
    return (
      <div className="min-h-screen bg-cream-50 dark:bg-restaurant-bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-lg">
            Loading menu...
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error) {
    return (
      <div className="min-h-screen bg-cream-50 dark:bg-restaurant-bg-dark flex items-center justify-center px-4">
        <div className="restaurant-card p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600 mb-3">
            Unable to load menu
          </h1>

          <p className="text-restaurant-text-light dark:text-gray-400 mb-6">
            {error}
          </p>

          <button
            onClick={() =>
              window.location.reload()
            }
            className="px-6 py-2 bg-restaurant-accent text-white rounded-lg hover:bg-restaurant-accent-dark"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-restaurant-bg-dark">

      {/* =====================================================
          TABLE INDICATOR
          ===================================================== */}

      {tableNumber && (
        <div className="bg-restaurant-accent text-white text-center py-2 text-sm font-medium">
          📍 Table {tableNumber}
        </div>
      )}

      {/* =====================================================
          HEADER
          ===================================================== */}

      <MenuHeader
        restaurant={restaurantData}
        currentLanguage={language}
        onLanguageChange={
          setLanguage
        }
      />

      {/* =====================================================
          CATEGORIES
          ===================================================== */}

      <CategoryNav
        categories={categoryList}
        selectedCategoryId={
          selectedCategory
        }
        onSelectCategory={
          setSelectedCategory
        }
      />

      {/* =====================================================
          MAIN
          ===================================================== */}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {/* ===================================================
            SEARCH
            =================================================== */}

        <div className="mb-8">
          <SearchBar
            onSearch={
              setSearchQuery
            }
            placeholder="Search for dishes..."
          />
        </div>

        {/* ===================================================
            FEATURED ITEMS

            Only show Featured when All is selected and
            the user isn't searching.
            =================================================== */}

        {selectedCategory === 'all' &&
          !searchQuery && (
            <div className="mb-12">

              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-restaurant-text dark:text-white mb-6">
                Featured Items
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                {menuItems
                  .filter(
                    (item) =>
                      item.featured &&
                      item.available
                  )
                  .slice(0, 4)
                  .map((item) => (
                    <FoodCard
                      key={item.id}
                      item={item}
                      isFavorite={favorites.has(
                        item.id
                      )}
                      onFavorite={
                        handleFavorite
                      }
                      onClick={() =>
                        handleViewItem(
                          item.id
                        )
                      }
                    />
                  ))}

              </div>
            </div>
          )}

        {/* ===================================================
            MENU
            =================================================== */}

        {filteredItems.length > 0 ? (

          /*
           * ==================================================
           * ALL CATEGORY
           *
           * Show each category as an accordion.
           * ==================================================
           */

          selectedCategory === 'all' ? (

            <div className="space-y-4">

              {categoryList
                .filter(
                  (
                    category: MenuCategory
                  ) =>
                    category.id !==
                    'all'
                )
                .map(
                  (
                    category: MenuCategory
                  ) => {
                    const items =
                      groupedItems[
                        category.id
                      ] || [];

                    if (
                      items.length ===
                      0
                    ) {
                      return null;
                    }

                    const isExpanded =
                      expandedCategories.has(
                        category.id
                      );

                    return (
                      <section
                        key={
                          category.id
                        }
                        className="border border-cream-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white/50 dark:bg-slate-900/30"
                      >

                        {/* --------------------------------
                            ACCORDION HEADER
                            -------------------------------- */}

                        <button
                          type="button"
                          onClick={() =>
                            toggleCategory(
                              category.id
                            )
                          }
                          className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left hover:bg-cream-100 dark:hover:bg-slate-800/50 transition-colors"
                        >

                          <div className="flex items-center gap-3">

                            <span className="text-2xl">
                              {getIconEmoji(
                                category.icon
                              )}
                            </span>

                            <div>

                              <h2 className="text-xl sm:text-2xl font-serif font-bold text-restaurant-text dark:text-white">
                                {
                                  category
                                    .name
                                    .en
                                }
                              </h2>

                              <p className="text-sm text-restaurant-text-light dark:text-gray-400 mt-1">
                                {
                                  items.length
                                }{' '}
                                {items.length ===
                                1
                                  ? 'item'
                                  : 'items'}
                              </p>

                            </div>

                          </div>

                          {/* Arrow */}

                          <span
                            className={`text-lg transition-transform duration-300 ${
                              isExpanded
                                ? 'rotate-180'
                                : ''
                            }`}
                          >
                            ▼
                          </span>

                        </button>

                        {/* --------------------------------
                            ACCORDION CONTENT
                            -------------------------------- */}

                        {isExpanded && (
                          <div className="px-5 pb-6 sm:px-6">

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">

                              {items.map(
                                (item) => (
                                  <FoodCard
                                    key={
                                      item.id
                                    }
                                    item={
                                      item
                                    }
                                    isFavorite={favorites.has(
                                      item.id
                                    )}
                                    onFavorite={
                                      handleFavorite
                                    }
                                    onClick={() =>
                                      handleViewItem(
                                        item.id
                                      )
                                    }
                                  />
                                )
                              )}

                            </div>

                          </div>
                        )}

                      </section>
                    );
                  }
                )}

            </div>

          ) : (

            /*
             * ==================================================
             * INDIVIDUAL CATEGORY
             *
             * Normal grid — no accordion.
             * ==================================================
             */

            <div className="space-y-12">

              {categoryList
                .filter(
                  (
                    category: MenuCategory
                  ) =>
                    category.id ===
                    selectedCategory
                )
                .map(
                  (
                    category: MenuCategory
                  ) => {

                    const items =
                      groupedItems[
                        category.id
                      ] || [];

                    if (
                      items.length ===
                      0
                    ) {
                      return null;
                    }

                    return (
                      <section
                        key={
                          category.id
                        }
                      >

                        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-restaurant-text dark:text-white mb-6 flex items-center gap-3">

                          <span>
                            {getIconEmoji(
                              category.icon
                            )}
                          </span>

                          {
                            category
                              .name
                              .en
                          }

                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                          {items.map(
                            (item) => (
                              <FoodCard
                                key={
                                  item.id
                                }
                                item={
                                  item
                                }
                                isFavorite={favorites.has(
                                  item.id
                                )}
                                onFavorite={
                                  handleFavorite
                                }
                                onClick={() =>
                                  handleViewItem(
                                    item.id
                                  )
                                }
                              />
                            )
                          )}

                        </div>

                      </section>
                    );
                  }
                )}

            </div>
          )

        ) : (

          /* ==================================================
             NO RESULTS
             ================================================== */

          <div className="text-center py-12">

            <p className="text-lg text-restaurant-text-light dark:text-gray-400 mb-4">
              No menu items found.
            </p>

            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory(
                  'all'
                );
              }}
              className="px-6 py-2 bg-restaurant-accent text-white rounded-lg hover:bg-restaurant-accent-dark transition-colors"
            >
              Clear Filters
            </button>

          </div>
        )}

      </main>

      {/* =====================================================
          ITEM MODAL
          ===================================================== */}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          isFavorite={favorites.has(
            selectedItem.id
          )}
          onFavorite={
            handleFavorite
          }
          onClose={() =>
            setSelectedItem(null)
          }
        />
      )}

      {/* =====================================================
          FOOTER
          ===================================================== */}

      <footer className="border-t border-cream-200 dark:border-slate-800 mt-16 py-8 px-4 sm:px-6 lg:px-8">

        <div className="max-w-7xl mx-auto text-center text-sm text-restaurant-text-light dark:text-gray-400">

          <p>
            &copy;{' '}
            {new Date().getFullYear()}{' '}
            {restaurantData.name.en}.
            All rights reserved.
          </p>

        </div>

      </footer>

    </div>
  );
}

// ===========================================================
// CATEGORY ICON
// ===========================================================

function getIconEmoji(
  icon?: string
): string {
  const iconMap: Record<
    string,
    string
  > = {
    Coffee: '☕',
    Utensils: '🍽️',
    Leaf: '🌿',
    Users: '👥',
  };

  return (
    iconMap[icon || ''] ||
    '🍽️'
  );
}

// ===========================================================
// ITEM DETAIL MODAL
// ===========================================================

interface ItemDetailModalProps {
  item: MenuItem;

  isFavorite: boolean;

  onFavorite: (
    id: string,
    isFavorite: boolean
  ) => void;

  onClose: () => void;
}

function ItemDetailModal({
  item,
  isFavorite,
  onFavorite,
  onClose,
}: ItemDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >

      <div
        className="restaurant-card w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) =>
          e.stopPropagation()
        }
      >

        {/* =================================================
            HEADER
            ================================================= */}

        <div className="flex items-center justify-between p-4 border-b border-cream-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">

          <h2 className="text-xl font-serif font-bold text-restaurant-text dark:text-white flex-1 line-clamp-2">
            {item.name.en}
          </h2>

          <button
            onClick={onClose}
            className="ml-2 p-2 hover:bg-cream-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            ✕
          </button>

        </div>

        {/* =================================================
            CONTENT
            ================================================= */}

        <div className="p-6 space-y-6">

          {/* Image */}

          {item.image && (
            <div className="w-full h-64 bg-cream-100 dark:bg-slate-800 rounded-lg overflow-hidden">

              <img
                src={item.image}
                alt={item.name.en}
                className="w-full h-full object-cover"
              />

            </div>
          )}

          {/* Names */}

          <div>

            <p className="text-lg font-serif font-bold text-restaurant-text dark:text-white">
              {item.name.en}
            </p>

            {item.name.am && (
              <p className="text-base text-restaurant-text-light dark:text-gray-400">
                {item.name.am}
              </p>
            )}

          </div>

          {/* Description */}

          <div>

            <h3 className="font-semibold text-restaurant-text dark:text-white mb-2">
              Description
            </h3>

            <p className="text-sm text-restaurant-text-light dark:text-gray-400 leading-relaxed">
              {item.description.en}
            </p>

            {item.description.am && (
              <p className="text-sm text-restaurant-text-light dark:text-gray-400 leading-relaxed mt-1">
                {item.description.am}
              </p>
            )}

          </div>

          {/* Ingredients */}

          {item.ingredients &&
            item.ingredients.length >
              0 && (
              <div>

                <h3 className="font-semibold text-restaurant-text dark:text-white mb-2">
                  Ingredients
                </h3>

                <div className="flex flex-wrap gap-2">

                  {item.ingredients.map(
                    (ingredient) => (
                      <span
                        key={
                          ingredient
                        }
                        className="text-xs bg-cream-100 dark:bg-slate-800 text-restaurant-text dark:text-gray-300 px-3 py-1 rounded-full"
                      >
                        {
                          ingredient
                        }
                      </span>
                    )
                  )}

                </div>

              </div>
            )}

          {/* Indicators */}

          <div className="flex flex-wrap gap-2">

            {item.vegetarian && (
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-full font-medium">
                🌱 Vegetarian
              </span>
            )}

            {item.fasting && (
              <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full font-medium">
                📿 Fasting
              </span>
            )}

            {item.spicy && (
              <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-1 rounded-full font-medium">
                🌶️ Spicy
              </span>
            )}

          </div>

          {/* Price */}

          <div className="border-t border-cream-200 dark:border-slate-800 pt-6 flex items-center justify-between gap-4">

            <div>

              <p className="text-sm text-restaurant-text-light dark:text-gray-400">
                Price
              </p>

              <p className="text-2xl font-serif font-bold text-restaurant-accent">
                {item.price}{' '}
                {item.currency}
              </p>

            </div>

            <button
              onClick={() =>
                onFavorite(
                  item.id,
                  !isFavorite
                )
              }
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                isFavorite
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'bg-cream-100 dark:bg-slate-800 text-restaurant-text dark:text-white hover:bg-cream-200 dark:hover:bg-slate-700'
              }`}
            >
              {isFavorite
                ? '❤️ Saved'
                : '🤍 Save'}
            </button>

          </div>

        </div>
      </div>
    </div>
  );
}