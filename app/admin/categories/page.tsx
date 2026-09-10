'use client';

import { useEffect, useState } from 'react';
import {
  MenuCategory,
  MenuCategoryType,
} from '@/lib/types';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext';

import {
  Edit2,
  Trash2,
  Plus,
  X,
  Save,
  Eye,
  EyeOff,
  Utensils,
  Coffee,
} from 'lucide-react';

export default function CategoriesPage() {
  const { isAmharic } = useAdminLanguage();
  const [items, setItems] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] =
    useState<string | null>(null);

  const [editingCategory, setEditingCategory] =
    useState<MenuCategory | null>(null);

  const [isAdding, setIsAdding] = useState(false);

  // =========================================================
  // LOAD CATEGORIES
  // =========================================================

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      setLoading(true);

      const response = await fetch('/api/categories', {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load categories (${response.status})`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.error || 'Failed to load categories'
        );
      }

      const categories = Array.isArray(result.data)
        ? result.data
        : [];

      categories.sort(
        (a: MenuCategory, b: MenuCategory) =>
          a.displayOrder - b.displayOrder
      );

      setItems(categories);
    } catch (error) {
      console.error(
        'Failed to load categories:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Failed to load categories.'
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // ADD CATEGORY
  // =========================================================

  function handleAdd() {
    setEditingCategory({
      id: '',
      name: {
        en: '',
        am: '',
      },
      description: {
        en: '',
        am: '',
      },
      icon: 'Utensils',

      // NEW
      type: 'food',

      displayOrder: items.length + 1,
      visible: true,
    });

    setIsAdding(true);
  }

  // =========================================================
  // EDIT CATEGORY
  // =========================================================

  function handleEdit(
    category: MenuCategory
  ) {
    setEditingCategory({
      ...category,

      name: {
        en: category.name?.en || '',
        am: category.name?.am || '',
      },

      description: category.description
        ? {
            en:
              category.description.en || '',
            am:
              category.description.am || '',
          }
        : {
            en: '',
            am: '',
          },

      icon:
        category.icon || 'Utensils',

      // NEW
      type:
        category.type === 'drink'
          ? 'drink'
          : 'food',

      displayOrder:
        typeof category.displayOrder ===
        'number'
          ? category.displayOrder
          : 0,

      visible:
        category.visible !== false,
    });

    setIsAdding(false);
  }

  // =========================================================
  // CLOSE MODAL
  // =========================================================

  function closeEditor() {
    if (saving) return;

    setEditingCategory(null);
    setIsAdding(false);
  }

  // =========================================================
  // DELETE CATEGORY
  // =========================================================

  async function handleDelete(
    id: string
  ) {
    if (actionLoading) return;

    const category = items.find(
      (item) => item.id === id
    );

    const categoryName =
      category?.name?.en ||
      'this category';

    const confirmed = window.confirm(
      `Are you sure you want to delete "${categoryName}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(id);

      const response = await fetch(
        `/api/categories/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to delete category (${response.status})`
        );
      }

      const result =
        await response.json();

      if (!result.success) {
        throw new Error(
          result.error ||
            'Failed to delete category'
        );
      }

      await loadCategories();
    } catch (error) {
      console.error(
        'Failed to delete category:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Failed to delete category.'
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =========================================================
  // SAVE CATEGORY
  // =========================================================

  async function handleSave() {
    if (!editingCategory || saving) {
      return;
    }

    const englishName =
      editingCategory.name.en.trim();

    if (!englishName) {
      alert(
        'English category name is required.'
      );
      return;
    }

    if (
      !Number.isInteger(
        editingCategory.displayOrder
      ) ||
      editingCategory.displayOrder < 0
    ) {
      alert(
        'Display order must be a whole number greater than or equal to 0.'
      );
      return;
    }

    try {
      setSaving(true);

      // =====================================================
      // CREATE
      // =====================================================

      if (isAdding) {
        const body = {
          name: {
            en: englishName,
            am:
              editingCategory.name.am?.trim() ||
              undefined,
          },

          description:
            editingCategory.description &&
            (
              editingCategory.description.en.trim() ||
              editingCategory.description.am?.trim()
            )
              ? {
                  en:
                    editingCategory.description.en.trim(),

                  am:
                    editingCategory.description.am?.trim() ||
                    undefined,
                }
              : undefined,

          icon:
            editingCategory.icon ||
            'Utensils',

          // NEW
          type:
            editingCategory.type,

          displayOrder:
            editingCategory.displayOrder,

          visible:
            editingCategory.visible,
        };

        const response = await fetch(
          '/api/categories',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to create category (${response.status})`
          );
        }

        const result =
          await response.json();

        if (!result.success) {
          throw new Error(
            result.error ||
              'Failed to create category'
          );
        }

        setEditingCategory(null);
        setIsAdding(false);

        await loadCategories();

        return;
      }

      // =====================================================
      // UPDATE
      // =====================================================

      if (!editingCategory.id) {
        throw new Error(
          'Category ID is missing.'
        );
      }

      const body = {
        name: {
          en: englishName,
          am:
            editingCategory.name.am?.trim() ||
            undefined,
        },

        description:
          editingCategory.description &&
          (
            editingCategory.description.en.trim() ||
            editingCategory.description.am?.trim()
          )
            ? {
                en:
                  editingCategory.description.en.trim(),

                am:
                  editingCategory.description.am?.trim() ||
                  undefined,
              }
            : undefined,

        icon:
          editingCategory.icon ||
          'Utensils',

        // NEW
        type:
          editingCategory.type,

        displayOrder:
          editingCategory.displayOrder,

        visible:
          editingCategory.visible,
      };

      const response = await fetch(
        `/api/categories/${encodeURIComponent(
          editingCategory.id
        )}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to update category (${response.status})`
        );
      }

      const result =
        await response.json();

      if (!result.success) {
        throw new Error(
          result.error ||
            'Failed to update category'
        );
      }

      setEditingCategory(null);
      setIsAdding(false);

      await loadCategories();
    } catch (error) {
      console.error(
        'Failed to save category:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Failed to save category.'
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // TOGGLE VISIBILITY
  // =========================================================

  async function handleToggleVisibility(
    category: MenuCategory
  ) {
    if (actionLoading) return;

    try {
      setActionLoading(category.id);

      const response = await fetch(
        `/api/categories/${encodeURIComponent(
          category.id
        )}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            visible:
              !category.visible,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to update visibility (${response.status})`
        );
      }

      const result =
        await response.json();

      if (!result.success) {
        throw new Error(
          result.error ||
            'Failed to update category visibility'
        );
      }

      await loadCategories();
    } catch (error) {
      console.error(
        'Failed to update category visibility:',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Failed to update category visibility.'
      );
    } finally {
      setActionLoading(null);
    }
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8 text-center text-gray-500">
          {isAmharic ? 'ምድቦችን በመጫን ላይ...' : 'Loading categories...'}
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

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="flex items-center justify-between gap-4">

          <div>
            <h1 className="text-3xl font-serif font-bold text-restaurant-text dark:text-white">
              {isAmharic ? 'የምግብ እና መጠጥ ምድቦች' : 'Categories'}
            </h1>

            <p className="text-restaurant-text-light dark:text-gray-400 mt-1">
              {isAmharic
                ? 'የምግብና የመጠጥ ምድቦችን ያስተዳድሩ እና ቅደም ተከተል ያስተካክሉ'
                : 'Manage menu categories and food/drink types'}
            </p>
          </div>

          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-restaurant-accent text-white rounded-lg hover:bg-restaurant-accent-dark transition-colors font-medium disabled:opacity-50"
          >
            <Plus size={20} />
            {isAmharic ? 'አዲስ ምድብ ጨምር' : 'Add Category'}
          </button>

        </div>

        {/* ===================================================
            CATEGORIES GRID
        =================================================== */}

        {items.length === 0 ? (
          <div className="restaurant-card p-12 text-center text-gray-500">
            {isAmharic ? 'ምንም ምድብ አልተገኘም' : 'No categories found.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {items.map((category) => {

              const isActionLoading =
                actionLoading ===
                category.id;

              const isDrink =
                category.type ===
                'drink';

              const primaryName = isAmharic && category.name.am ? category.name.am : category.name.en;
              const secondaryName = isAmharic && category.name.am ? category.name.en : category.name.am;

              return (
                <div
                  key={category.id}
                  className="restaurant-card p-6 hover:shadow-md transition-shadow"
                >

                  {/* =================================================
                      CATEGORY HEADER
                  ================================================= */}

                  <div className="flex items-start justify-between mb-4">

                    <div className="flex-1">

                      <h3 className="text-lg font-semibold text-restaurant-text dark:text-white">
                        {primaryName}
                      </h3>

                      {secondaryName && secondaryName !== primaryName && (
                        <p className="text-sm text-restaurant-text-light dark:text-gray-400">
                          {secondaryName}
                        </p>
                      )}

                    </div>

                    <div className="text-2xl">
                      {getCategoryEmoji(
                        category.icon,
                        category.type
                      )}
                    </div>

                  </div>

                  {/* =================================================
                      TYPE BADGE
                  ================================================= */}

                  <div className="mb-4">

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        isDrink
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                      }`}
                    >

                      {isDrink ? (
                        <Coffee size={14} />
                      ) : (
                        <Utensils size={14} />
                      )}

                      {isDrink
                        ? (isAmharic ? 'መጠጥ' : 'Drink')
                        : (isAmharic ? 'ምግብ' : 'Food')}

                    </span>

                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 ml-2">
                      #{category.displayOrder}
                    </span>

                  </div>

                  {/* =================================================
                      DESCRIPTION
                  ================================================= */}

                  {category.description && (
                    <p className="text-sm text-restaurant-text-light dark:text-gray-400 mb-4 line-clamp-2">
                      {isAmharic && category.description.am
                        ? category.description.am
                        : category.description.en || ''}
                    </p>
                  )}

                  {/* =================================================
                      BOTTOM
                  ================================================= */}

                  <div className="flex items-center justify-between pt-4 border-t border-cream-200 dark:border-slate-800">

                    {/* VISIBILITY */}

                    <button
                      onClick={() =>
                        handleToggleVisibility(
                          category
                        )
                      }
                      disabled={
                        isActionLoading
                      }
                      className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50 ${
                        category.visible
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                      }`}
                      title={
                        category.visible
                          ? (isAmharic ? 'ምድብ ደብቅ' : 'Hide category')
                          : (isAmharic ? 'ምድብ አሳይ' : 'Show category')
                      }
                    >

                      {category.visible ? (
                        <>
                          <Eye size={14} />
                          {isAmharic ? 'ይታያል' : 'Visible'}
                        </>
                      ) : (
                        <>
                          <EyeOff size={14} />
                          {isAmharic ? 'ተደብቋል' : 'Hidden'}
                        </>
                      )}

                    </button>

                    {/* ACTIONS */}

                    <div className="flex gap-2">

                      {/* EDIT */}

                      <button
                        onClick={() =>
                          handleEdit(
                            category
                          )
                        }
                        disabled={
                          isActionLoading
                        }
                        className="p-2 hover:bg-cream-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                        title={isAmharic ? 'ምድብ አሻሽል' : 'Edit category'}
                      >
                        <Edit2
                          size={18}
                          className="text-blue-600"
                        />
                      </button>

                      {/* DELETE */}

                      <button
                        onClick={() =>
                          handleDelete(
                            category.id
                          )
                        }
                        disabled={
                          isActionLoading
                        }
                        className="p-2 hover:bg-cream-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                        title={isAmharic ? 'ምድብ ሰርዝ' : 'Delete category'}
                      >
                        <Trash2
                          size={18}
                          className="text-red-600"
                        />
                      </button>

                    </div>

                  </div>

                </div>
              );
            })}

          </div>
        )}

        {/* ===================================================
            EDITOR MODAL
        =================================================== */}

        {editingCategory && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onMouseDown={(e) => {
              if (
                e.target ===
                  e.currentTarget &&
                !saving
              ) {
                closeEditor();
              }
            }}
          >

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

              {/* =================================================
                  MODAL HEADER
              ================================================= */}

              <div className="flex items-center justify-between p-6 border-b dark:border-slate-800">

                <h2 className="text-2xl font-serif font-bold text-restaurant-text dark:text-white">
                  {isAdding
                    ? isAmharic
                      ? 'አዲስ ምድብ ጨምር'
                      : 'Add Category'
                    : isAmharic
                    ? 'ምድብ አሻሽል'
                    : 'Edit Category'}
                </h2>

                <button
                  onClick={
                    closeEditor
                  }
                  disabled={saving}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50"
                  title={isAmharic ? 'ዝጋ' : 'Close'}
                >
                  <X />
                </button>

              </div>

              {/* =================================================
                  MODAL BODY
              ================================================= */}

              <div className="p-6 space-y-6">

                {/* =================================================
                    NAMES
                ================================================= */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* ENGLISH */}

                  <label>
                    <span className="block mb-2 font-medium">
                      {isAmharic ? 'ስም (እንግሊዝኛ) *' : 'Name (English) *'}
                    </span>

                    <input
                      type="text"
                      value={
                        editingCategory
                          .name.en
                      }
                      onChange={(e) =>
                        setEditingCategory({
                          ...editingCategory,
                          name: {
                            ...editingCategory.name,
                            en: e.target.value,
                          },
                        })
                      }
                      placeholder={isAmharic ? 'ምሳሌ፡ ቁርስ' : 'e.g. Breakfast'}
                      disabled={saving}
                      autoFocus
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                  {/* AMHARIC */}

                  <label>
                    <span className="block mb-2 font-medium">
                      {isAmharic ? 'ስም (አማርኛ)' : 'Name (Amharic)'}
                    </span>

                    <input
                      type="text"
                      value={
                        editingCategory
                          .name.am ||
                        ''
                      }
                      onChange={(e) =>
                        setEditingCategory({
                          ...editingCategory,
                          name: {
                            ...editingCategory.name,
                            am: e.target.value,
                          },
                        })
                      }
                      placeholder={isAmharic ? 'ምሳሌ፡ ቁርስ' : 'የምግብ ምድብ'}
                      disabled={saving}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                </div>

                {/* =================================================
                    CATEGORY TYPE
                ================================================= */}

                <div>

                  <label>
                    <span className="block mb-2 font-medium">
                      {isAmharic ? 'የምድብ አይነት' : 'Category Type'}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                      {/* FOOD */}

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          setEditingCategory({
                            ...editingCategory,
                            type: 'food',
                            icon:
                              editingCategory.icon ===
                                'Coffee'
                                ? 'Utensils'
                                : editingCategory.icon ||
                                  'Utensils',
                          })
                        }
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
                          editingCategory.type ===
                          'food'
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                            : 'border-gray-200 dark:border-slate-700 hover:border-gray-400'
                        }`}
                      >

                        <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                          <Utensils
                            size={22}
                            className="text-orange-600"
                          />
                        </div>

                        <div>
                          <div className="font-semibold">
                            {isAmharic ? 'ምግብ' : 'Food'}
                          </div>

                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {isAmharic ? 'የማብሰያ ቤት የምግብ እቃዎች' : 'Kitchen food items'}
                          </div>
                        </div>

                      </button>

                      {/* DRINK */}

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          setEditingCategory({
                            ...editingCategory,
                            type: 'drink',
                            icon:
                              editingCategory.icon ===
                                'Utensils'
                                ? 'Coffee'
                                : editingCategory.icon ||
                                  'Coffee',
                          })
                        }
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
                          editingCategory.type ===
                          'drink'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-slate-700 hover:border-gray-400'
                        }`}
                      >

                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                          <Coffee
                            size={22}
                            className="text-blue-600"
                          />
                        </div>

                        <div>
                          <div className="font-semibold">
                            {isAmharic ? 'መጠጥ' : 'Drink'}
                          </div>

                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {isAmharic ? 'መጠጦች እና ቡናዎች' : 'Drinks and beverages'}
                          </div>
                        </div>

                      </button>

                    </div>

                  </label>

                </div>

                {/* =================================================
                    DESCRIPTION
                ================================================= */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* ENGLISH */}

                  <label>
                    <span className="block mb-2 font-medium">
                      {isAmharic ? 'ገለጻ (እንግሊዝኛ)' : 'Description (English)'}
                    </span>

                    <textarea
                      rows={4}
                      value={
                        editingCategory
                          .description
                          ?.en || ''
                      }
                      onChange={(e) =>
                        setEditingCategory({
                          ...editingCategory,
                          description: {
                            ...(editingCategory.description || {
                              en: '',
                              am: '',
                            }),
                            en: e.target.value,
                          },
                        })
                      }
                      placeholder={isAmharic ? 'የምድብ መግለጫ በእንግሊዝኛ...' : 'Category description...'}
                      disabled={saving}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                  {/* AMHARIC */}

                  <label>
                    <span className="block mb-2 font-medium">
                      {isAmharic ? 'ገለጻ (አማርኛ)' : 'Description (Amharic)'}
                    </span>

                    <textarea
                      rows={4}
                      value={
                        editingCategory
                          .description
                          ?.am || ''
                      }
                      onChange={(e) =>
                        setEditingCategory({
                          ...editingCategory,
                          description: {
                            ...(editingCategory.description || {
                              en: '',
                              am: '',
                            }),
                            am: e.target.value,
                          },
                        })
                      }
                      placeholder={isAmharic ? 'የምድብ መግለጫ በአማርኛ...' : 'የምድብ መግለጫ...'}
                      disabled={saving}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                </div>

                {/* =================================================
                    ICON / DISPLAY ORDER
                ================================================= */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* ICON */}

                  <label>
                    <span className="block mb-2 font-medium">
                      {isAmharic ? 'ምልክት' : 'Icon'}
                    </span>

                    <select
                      value={
                        editingCategory.icon ||
                        'Utensils'
                      }
                      onChange={(e) =>
                        setEditingCategory({
                          ...editingCategory,
                          icon: e.target.value,
                        })
                      }
                      disabled={saving}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="Utensils">
                        🍽️ {isAmharic ? 'ምግብ (Utensils)' : 'Utensils'}
                      </option>

                      <option value="Coffee">
                        ☕ {isAmharic ? 'ቡና / መጠጥ (Coffee)' : 'Coffee'}
                      </option>

                      <option value="Leaf">
                        🌿 {isAmharic ? 'ቅጠላቅጠል (Leaf)' : 'Leaf'}
                      </option>

                      <option value="Users">
                        👥 {isAmharic ? 'ቤተሰብ / ቡድን (Users)' : 'Users'}
                      </option>
                    </select>
                  </label>

                  {/* DISPLAY ORDER */}

                  <label>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-xs">
                        {isAmharic ? 'የማሳያ ቅደም ተከተል ቁጥር' : 'Display Order / Position Index'}
                      </span>
                      <span className="text-[10px] text-restaurant-accent font-semibold">
                        {isAmharic ? 'ሌሎችን በራስ-ሰር ያስተካክላል' : 'Auto-adjusts other categories'}
                      </span>
                    </div>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={
                        editingCategory.displayOrder
                      }
                      onChange={(e) =>
                        setEditingCategory({
                          ...editingCategory,
                          displayOrder:
                            Math.max(
                              1,
                              Number(
                                e.target.value
                              ) || 1
                            ),
                        })
                      }
                      disabled={saving}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                    <span className="block mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      {isAmharic
                        ? 'ይህን ምድብ በ2ኛ ደረጃ ካደረጉት፣ አሁን 2 የነበረው ወደ 3፣ 3 የነበረው ወደ 4 ይቀየራል'
                        : 'If you set this category to 2, the current #2 will move to #3, #3 to #4, etc.'}
                    </span>
                  </label>

                </div>

                {/* =================================================
                    VISIBILITY
                ================================================= */}

                <label className="flex items-center gap-3 cursor-pointer">

                  <input
                    type="checkbox"
                    checked={
                      editingCategory.visible
                    }
                    onChange={(e) =>
                      setEditingCategory({
                        ...editingCategory,
                        visible:
                          e.target.checked,
                      })
                    }
                    disabled={saving}
                    className="w-4 h-4"
                  />

                  <span className="font-medium">
                    {isAmharic ? 'በሜኑ ላይ ለደንበኞች ይታይ' : 'Visible on menu'}
                  </span>

                </label>

              </div>

              {/* =================================================
                  MODAL FOOTER
              ================================================= */}

              <div className="flex justify-end gap-3 p-6 border-t dark:border-slate-800">

                {/* CANCEL */}

                <button
                  onClick={
                    closeEditor
                  }
                  disabled={saving}
                  className="px-5 py-2 rounded-lg border border-gray-300 dark:border-slate-700 disabled:opacity-50"
                >
                  {isAmharic ? 'ይቅር' : 'Cancel'}
                </button>

                {/* SAVE */}

                <button
                  onClick={
                    handleSave
                  }
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-restaurant-accent text-white rounded-lg disabled:opacity-50 font-bold shadow-sm"
                >

                  <Save size={18} />

                  {saving
                    ? isAmharic
                      ? 'በማስቀመጥ ላይ...'
                      : 'Saving...'
                    : isAdding
                    ? isAmharic
                      ? 'ምድብ ጨምር'
                      : 'Add Category'
                    : isAmharic
                    ? 'ለውጦችን መዝግብ'
                    : 'Save Changes'}

                </button>

              </div>

            </div>

          </div>
        )}

      </div>
    </AdminLayout>
  );
}

// =========================================================
// CATEGORY ICON
// =========================================================

function getCategoryEmoji(
  icon?: string,
  type?: MenuCategoryType
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

  if (type === 'drink') {
    return '🥤';
  }

  return (
    iconMap[icon || ''] ||
    '🍽️'
  );
}