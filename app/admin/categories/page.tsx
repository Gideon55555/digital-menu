'use client';

import { useEffect, useState } from 'react';
import { MenuCategory } from '@/lib/types';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  Edit2,
  Trash2,
  Plus,
  X,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function CategoriesPage() {
  const [items, setItems] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
      console.error('Failed to load categories:', error);

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
      displayOrder: items.length,
      visible: true,
    });

    setIsAdding(true);
  }

  // =========================================================
  // EDIT CATEGORY
  // =========================================================

  function handleEdit(category: MenuCategory) {
    setEditingCategory({
      ...category,

      name: {
        en: category.name?.en || '',
        am: category.name?.am || '',
      },

      description: category.description
        ? {
            en: category.description.en || '',
            am: category.description.am || '',
          }
        : {
            en: '',
            am: '',
          },

      icon: category.icon || 'Utensils',

      displayOrder:
        typeof category.displayOrder === 'number'
          ? category.displayOrder
          : 0,

      visible: category.visible !== false,
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

  async function handleDelete(id: string) {
    if (actionLoading) return;

    const category = items.find(
      (item) => item.id === id
    );

    const categoryName =
      category?.name?.en || 'this category';

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

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.error || 'Failed to delete category'
        );
      }

      // Reload from server so the UI matches categories.json.
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

      // -------------------------------------------------------
      // CREATE
      // -------------------------------------------------------

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
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to create category (${response.status})`
          );
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(
            result.error ||
              'Failed to create category'
          );
        }

        setEditingCategory(null);
        setIsAdding(false);

        // Get the actual saved data from the server.
        await loadCategories();

        return;
      }

      // -------------------------------------------------------
      // UPDATE
      // -------------------------------------------------------

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
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to update category (${response.status})`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.error ||
            'Failed to update category'
        );
      }

      setEditingCategory(null);
      setIsAdding(false);

      // Get the actual saved data from the server.
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
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            visible: !category.visible,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to update visibility (${response.status})`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.error ||
            'Failed to update category visibility'
        );
      }

      // Reload from server to guarantee persistence.
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
  // LOADING STATE
  // =========================================================

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8 text-center">
          Loading categories...
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

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-restaurant-text dark:text-white">
              Categories
            </h1>

            <p className="text-restaurant-text-light dark:text-gray-400 mt-1">
              Manage menu categories
            </p>
          </div>

          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-restaurant-accent text-white rounded-lg hover:bg-restaurant-accent-dark transition-colors font-medium disabled:opacity-50"
          >
            <Plus size={20} />
            Add Category
          </button>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          {items.map((category) => {
            const isActionLoading =
              actionLoading === category.id;

            return (
              <div
                key={category.id}
                className="restaurant-card p-6 hover:shadow-md transition-shadow"
              >

                {/* Category Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-restaurant-text dark:text-white">
                      {category.name.en}
                    </h3>

                    {category.name.am && (
                      <p className="text-sm text-restaurant-text-light dark:text-gray-400">
                        {category.name.am}
                      </p>
                    )}
                  </div>

                  <div className="text-2xl">
                    {getCategoryEmoji(
                      category.icon
                    )}
                  </div>
                </div>

                {/* Description */}
                {category.description?.en && (
                  <p className="text-sm text-restaurant-text-light dark:text-gray-400 mb-4 line-clamp-2">
                    {category.description.en}
                  </p>
                )}

                {/* Bottom */}
                <div className="flex items-center justify-between pt-4 border-t border-cream-200 dark:border-slate-800">

                  {/* Visibility */}
                  <button
                    onClick={() =>
                      handleToggleVisibility(
                        category
                      )
                    }
                    disabled={isActionLoading}
                    className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50 ${
                      category.visible
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                    }`}
                    title={
                      category.visible
                        ? 'Hide category'
                        : 'Show category'
                    }
                  >
                    {category.visible ? (
                      <>
                        <Eye size={14} />
                        Visible
                      </>
                    ) : (
                      <>
                        <EyeOff size={14} />
                        Hidden
                      </>
                    )}
                  </button>

                  <div className="flex gap-2">

                    {/* Edit */}
                    <button
                      onClick={() =>
                        handleEdit(category)
                      }
                      disabled={isActionLoading}
                      className="p-2 hover:bg-cream-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                      title="Edit category"
                    >
                      <Edit2
                        size={18}
                        className="text-blue-600"
                      />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() =>
                        handleDelete(
                          category.id
                        )
                      }
                      disabled={isActionLoading}
                      className="p-2 hover:bg-cream-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete category"
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

        {/* Empty State */}
        {items.length === 0 && (
          <div className="restaurant-card p-10 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No categories found.
            </p>

            <button
              onClick={handleAdd}
              className="mt-4 px-4 py-2 bg-restaurant-accent text-white rounded-lg"
            >
              Add Your First Category
            </button>
          </div>
        )}

        {/* =====================================================
            EDITOR MODAL
        ====================================================== */}

        {editingCategory && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onMouseDown={(e) => {
              if (
                e.target === e.currentTarget &&
                !saving
              ) {
                closeEditor();
              }
            }}
          >
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b dark:border-slate-800">

                <h2 className="text-2xl font-serif font-bold text-restaurant-text dark:text-white">
                  {isAdding
                    ? 'Add Category'
                    : 'Edit Category'}
                </h2>

                <button
                  onClick={closeEditor}
                  disabled={saving}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-50"
                  title="Close"
                >
                  <X />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">

                {/* Names */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* English Name */}
                  <label>
                    <span className="block mb-2 font-medium">
                      Name (English)
                    </span>

                    <input
                      type="text"
                      value={
                        editingCategory.name.en
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
                      placeholder="e.g. Breakfast"
                      disabled={saving}
                      autoFocus
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                  {/* Amharic Name */}
                  <label>
                    <span className="block mb-2 font-medium">
                      Name (Amharic)
                    </span>

                    <input
                      type="text"
                      value={
                        editingCategory.name.am ||
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
                      placeholder="የምግብ ምድብ"
                      disabled={saving}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                </div>

                {/* Description */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* English Description */}
                  <label>
                    <span className="block mb-2 font-medium">
                      Description (English)
                    </span>

                    <textarea
                      rows={4}
                      value={
                        editingCategory
                          .description?.en || ''
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
                      placeholder="Category description..."
                      disabled={saving}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                  {/* Amharic Description */}
                  <label>
                    <span className="block mb-2 font-medium">
                      Description (Amharic)
                    </span>

                    <textarea
                      rows={4}
                      value={
                        editingCategory
                          .description?.am || ''
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
                      placeholder="የምድብ መግለጫ..."
                      disabled={saving}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                </div>

                {/* Icon / Display Order */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Icon */}
                  <label>
                    <span className="block mb-2 font-medium">
                      Icon
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
                        🍽️ Utensils
                      </option>

                      <option value="Coffee">
                        ☕ Coffee
                      </option>

                      <option value="Leaf">
                        🌿 Leaf
                      </option>

                      <option value="Users">
                        👥 Users
                      </option>
                    </select>
                  </label>

                  {/* Display Order */}
                  <label>
                    <span className="block mb-2 font-medium">
                      Display Order
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        editingCategory.displayOrder
                      }
                      onChange={(e) =>
                        setEditingCategory({
                          ...editingCategory,
                          displayOrder:
                            Math.max(
                              0,
                              Number(
                                e.target.value
                              ) || 0
                            ),
                        })
                      }
                      disabled={saving}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>

                </div>

                {/* Visibility */}
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
                    Visible on menu
                  </span>
                </label>

              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 p-6 border-t dark:border-slate-800">

                {/* Cancel */}
                <button
                  onClick={closeEditor}
                  disabled={saving}
                  className="px-5 py-2 rounded-lg border border-gray-300 dark:border-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>

                {/* Save */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-restaurant-accent text-white rounded-lg disabled:opacity-50"
                >
                  <Save size={18} />

                  {saving
                    ? 'Saving...'
                    : isAdding
                    ? 'Add Category'
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
  icon?: string
): string {
  const iconMap: Record<string, string> = {
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