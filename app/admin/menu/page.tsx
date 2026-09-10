'use client';

import { useEffect, useMemo, useState } from 'react';
import { MenuItem, MenuCategory, IngredientItem, ItemCostInfo } from '@/lib/types';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageContext';
import {
  Edit2,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  X,
  Save,
  Calculator,
  ChefHat,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Percent,
  PlusCircle,
  MinusCircle,
  Copy,
  Info,
} from 'lucide-react';

const MEASUREMENT_UNITS = [
  { value: 'pcs', labelEn: 'Pieces (pcs)', labelAm: 'ፍሬ (pcs)' },
  { value: 'g', labelEn: 'Grams (g)', labelAm: 'ግራም (g)' },
  { value: 'kg', labelEn: 'Kilograms (kg)', labelAm: 'ኪሎግራም (kg)' },
  { value: 'ml', labelEn: 'Milliliters (ml)', labelAm: 'ሚሊ ሊትር (ml)' },
  { value: 'L', labelEn: 'Liters (L)', labelAm: 'ሊትር (L)' },
  { value: 'tbsp', labelEn: 'Tablespoon (tbsp)', labelAm: 'የሾርባ ማንኪያ (tbsp)' },
  { value: 'tsp', labelEn: 'Teaspoon (tsp)', labelAm: 'የሻይ ማንኪያ (tsp)' },
  { value: 'cup', labelEn: 'Cup (cup)', labelAm: 'ሲኒ / ኩባያ (cup)' },
  { value: 'portion', labelEn: 'Portion', labelAm: 'ክፍል / መጠን' },
  { value: 'slice', labelEn: 'Slice', labelAm: 'ቁራጭ' },
];

export function calculateItemCost(costInfo?: ItemCostInfo | null): number {
  if (!costInfo) return 0;
  if (costInfo.costType === 'bought') {
    return Number(costInfo.purchaseCost) || 0;
  }
  if (costInfo.costType === 'made' && Array.isArray(costInfo.ingredients)) {
    return costInfo.ingredients.reduce(
      (acc, curr) => acc + (Number(curr.cost) || 0),
      0
    );
  }
  return 0;
}

export function calculateMargin(
  price: number,
  cost: number,
  targetMargin = 60
): {
  grossProfit: number;
  marginPct: number;
  isTargetMet: boolean;
  suggestedPrice: number;
} {
  const p = Math.max(0, Number(price) || 0);
  const c = Math.max(0, Number(cost) || 0);
  const grossProfit = p - c;
  const marginPct = p > 0 ? (grossProfit / p) * 100 : 0;
  const isTargetMet = marginPct >= targetMargin;

  // Formula for 60% profit target: Cost is 40% of Price => Price = Cost / 0.40
  const marginFraction = Math.max(0.01, (100 - targetMargin) / 100);
  const suggestedPrice = c > 0 ? Math.ceil(c / marginFraction) : p;

  return { grossProfit, marginPct, isTargetMet, suggestedPrice };
}

export default function MenuManagementPage() {
  const { isAmharic } = useAdminLanguage();

  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const [menuResponse, categoryResponse] = await Promise.all([
        fetch('/api/menu'),
        fetch('/api/categories'),
      ]);

      const menuResult = await menuResponse.json();
      const categoryResult = await categoryResponse.json();

      if (menuResult.success) {
        setItems(menuResult.data);
      }

      if (categoryResult.success) {
        setCategories(categoryResult.data);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
      alert(isAmharic ? 'የሜኑ መረጃዎችን መጫን አልተቻለም።' : 'Failed to load menu data.');
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'available') return item.available;
      if (filter === 'sold-out') return !item.available;

      return item.categoryId === filter;
    });
  }, [items, filter]);

  async function handleToggleAvailability(item: MenuItem) {
    try {
      const response = await fetch(`/api/menu/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          available: !item.available,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setItems((prev) =>
        prev.map((current) =>
          current.id === item.id ? result.data : current
        )
      );
    } catch (error) {
      console.error(error);
      alert(isAmharic ? 'ሁኔታውን መቀየር አልተቻለም።' : 'Failed to update availability.');
    }
  }

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        isAmharic
          ? 'ይህን የሜኑ እቃ መሰረዝ እርግጠኛ ነዎት?'
          : 'Are you sure you want to delete this item?'
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/menu/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error(error);
      alert(isAmharic ? 'እቃውን መሰረዝ አልተቻለም።' : 'Failed to delete menu item.');
    }
  }

  function handleEdit(item: MenuItem) {
    setEditingItem({
      ...item,
      name: { ...item.name },
      description: { ...item.description },
      ingredients: item.ingredients ? [...item.ingredients] : [],
      allergens: item.allergens ? [...item.allergens] : [],
      costInfo: item.costInfo
        ? {
            costType: item.costInfo.costType || 'made',
            purchaseCost: item.costInfo.purchaseCost ?? 0,
            ingredients: item.costInfo.ingredients
              ? item.costInfo.ingredients.map((ing) => ({ ...ing }))
              : [],
            targetMargin: item.costInfo.targetMargin ?? 60,
          }
        : {
            costType: 'made',
            purchaseCost: 0,
            ingredients: [],
            targetMargin: 60,
          },
    });

    setIsAdding(false);
  }

  function handleAdd() {
    setEditingItem({
      id: '',
      categoryId: categories[0]?.id || '',
      name: {
        en: '',
        am: '',
      },
      description: {
        en: '',
        am: '',
      },
      price: 0,
      currency: 'ETB',
      image: null,
      available: true,
      featured: false,
      fasting: false,
      vegetarian: false,
      spicy: false,
      ingredients: [],
      allergens: [],
      displayOrder: items.length,
      costInfo: {
        costType: 'made',
        purchaseCost: 0,
        ingredients: [],
        targetMargin: 60,
      },
    });

    setIsAdding(true);
  }

  // Cost & Ingredient Helpers for editingItem
  const currentItemCost = useMemo(() => {
    if (!editingItem) return 0;
    return calculateItemCost(editingItem.costInfo);
  }, [editingItem]);

  const currentMarginStats = useMemo(() => {
    if (!editingItem) {
      return { grossProfit: 0, marginPct: 0, isTargetMet: false, suggestedPrice: 0 };
    }
    return calculateMargin(
      editingItem.price,
      currentItemCost,
      editingItem.costInfo?.targetMargin ?? 60
    );
  }, [editingItem, currentItemCost]);

  function handleAddIngredientRow() {
    if (!editingItem) return;
    const newIng: IngredientItem = {
      id: `ing-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      quantity: 1,
      unit: 'pcs',
      cost: 0,
    };
    const currentIngs = editingItem.costInfo?.ingredients || [];
    setEditingItem({
      ...editingItem,
      costInfo: {
        ...(editingItem.costInfo || { costType: 'made', targetMargin: 60 }),
        costType: 'made',
        ingredients: [...currentIngs, newIng],
      },
    });
  }

  function handleUpdateIngredientRow(
    id: string,
    field: keyof IngredientItem,
    value: any
  ) {
    if (!editingItem || !editingItem.costInfo?.ingredients) return;
    const updated = editingItem.costInfo.ingredients.map((ing) => {
      if (ing.id === id) {
        return { ...ing, [field]: value };
      }
      return ing;
    });
    setEditingItem({
      ...editingItem,
      costInfo: {
        ...editingItem.costInfo,
        ingredients: updated,
      },
    });
  }

  function handleRemoveIngredientRow(id: string) {
    if (!editingItem || !editingItem.costInfo?.ingredients) return;
    const updated = editingItem.costInfo.ingredients.filter((ing) => ing.id !== id);
    setEditingItem({
      ...editingItem,
      costInfo: {
        ...editingItem.costInfo,
        ingredients: updated,
      },
    });
  }

  function handleApplySuggestedPrice() {
    if (!editingItem) return;
    if (currentMarginStats.suggestedPrice > 0) {
      setEditingItem({
        ...editingItem,
        price: currentMarginStats.suggestedPrice,
      });
    }
  }

  function handleCopySql() {
    const sql = `ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS cost_info JSONB DEFAULT NULL;`;
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  }

  async function handleSave() {
    if (!editingItem) return;

    if (!editingItem.name.en.trim()) {
      alert(isAmharic ? 'የእቃው የእንግሊዝኛ ስም ያስፈልጋል።' : 'English name is required.');
      return;
    }

    if (!editingItem.categoryId) {
      alert(isAmharic ? 'እባክዎ ምድብ ይምረጡ።' : 'Please select a category.');
      return;
    }

    if (editingItem.price <= 0) {
      alert(isAmharic ? 'ዋጋ ከ 0 በላይ መሆን አለበት።' : 'Price must be greater than 0.');
      return;
    }

    try {
      setSaving(true);

      const url = isAdding ? '/api/menu' : `/api/menu/${editingItem.id}`;
      const method = isAdding ? 'POST' : 'PUT';

      const { id, createdAt, updatedAt, ...updateBody } = editingItem;

      const body = isAdding ? { ...editingItem } : updateBody;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      if (isAdding) {
        setItems((prev) => [...prev, result.data]);
      } else {
        setItems((prev) =>
          prev.map((item) => (item.id === result.data.id ? result.data : item))
        );
      }

      setEditingItem(null);
      setIsAdding(false);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : isAmharic
          ? 'እቃውን ማስቀመጥ አልተቻለም።'
          : 'Failed to save menu item.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          {isAmharic ? 'ሜኑ በመጫን ላይ...' : 'Loading menu...'}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-restaurant-text dark:text-white">
              {isAmharic ? 'የሜኑ እቃዎች አስተዳደር' : 'Menu Items Management'}
            </h1>

            <p className="text-sm text-restaurant-text-light dark:text-gray-400 mt-1">
              {isAmharic
                ? 'ምግቦችን፣ መጠጦችን፣ የምግብ አሰራር ወጪዎችንና የትርፍ መጣኔዎችን ያስተዳድሩ'
                : 'Manage dishes, drinks, recipe ingredient costs, and 60% profit margins'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 bg-restaurant-accent hover:bg-restaurant-accent-dark text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition"
            >
              <Plus size={18} />
              <span>{isAmharic ? 'አዲስ እቃ ጨምር' : 'Add Menu Item'}</span>
            </button>
          </div>
        </div>

        {/* Categories / Status Filters */}
        <div className="flex flex-wrap gap-2 pb-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === 'all'
                ? 'bg-restaurant-accent text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-cream-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-cream-100 dark:hover:bg-slate-800'
            }`}
          >
            {isAmharic ? 'ሁሉም' : 'All'} ({items.length})
          </button>

          <button
            onClick={() => setFilter('available')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === 'available'
                ? 'bg-restaurant-accent text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-cream-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-cream-100 dark:hover:bg-slate-800'
            }`}
          >
            {isAmharic ? 'የሚገኙ' : 'Available'}
          </button>

          <button
            onClick={() => setFilter('sold-out')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
              filter === 'sold-out'
                ? 'bg-restaurant-accent text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-cream-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-cream-100 dark:hover:bg-slate-800'
            }`}
          >
            {isAmharic ? 'ያለቁ' : 'Sold Out'}
          </button>

          <div className="h-6 w-px bg-gray-200 dark:bg-slate-800 self-center hidden sm:block" />

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                filter === cat.id
                  ? 'bg-restaurant-accent text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-cream-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 hover:bg-cream-100 dark:hover:bg-slate-800'
              }`}
            >
              {isAmharic && cat.name.am ? cat.name.am : cat.name.en}
            </button>
          ))}
        </div>

        {/* Menu Table */}
        <div className="restaurant-card overflow-x-auto rounded-2xl border border-cream-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-cream-200 dark:border-slate-800 bg-cream-50/60 dark:bg-slate-800/60 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              <tr>
                <th className="px-5 py-3.5">{isAmharic ? 'የእቃው ስም' : 'Name'}</th>
                <th className="px-5 py-3.5">{isAmharic ? 'ምድብ' : 'Category'}</th>
                <th className="px-5 py-3.5">{isAmharic ? 'የመሸጫ ዋጋ' : 'Selling Price'}</th>
                <th className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <Calculator size={14} className="text-restaurant-accent" />
                    <span>{isAmharic ? 'ወጪና ትርፍ (ዒላማ 60%)' : 'Cost & Margin (60% Target)'}</span>
                  </div>
                </th>
                <th className="px-5 py-3.5 text-center">{isAmharic ? 'ሁኔታ' : 'Status'}</th>
                <th className="px-5 py-3.5 text-right">{isAmharic ? 'ድርጊት' : 'Actions'}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-cream-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                    {isAmharic ? 'ምንም የሜኑ እቃ አልተገኘም' : 'No menu items found.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const category = categories.find((c) => c.id === item.categoryId);
                  const cost = calculateItemCost(item.costInfo);
                  const hasCostData = Boolean(item.costInfo && (cost > 0 || item.costInfo.ingredients?.length));
                  const { marginPct, isTargetMet } = calculateMargin(item.price, cost);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-cream-50/50 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {item.name.en}
                        </div>
                        {item.name.am && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {item.name.am}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-5 py-4 text-xs font-medium text-gray-600 dark:text-gray-300">
                        {category
                          ? isAmharic && category.name.am
                            ? category.name.am
                            : category.name.en
                          : 'Unknown'}
                      </td>

                      {/* Selling Price */}
                      <td className="px-5 py-4 font-bold text-restaurant-accent">
                        {item.price} {item.currency}
                      </td>

                      {/* Cost & Profit Margin */}
                      <td className="px-5 py-4">
                        {!hasCostData ? (
                          <button
                            onClick={() => handleEdit(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-gray-300 dark:border-slate-700 text-xs font-medium text-gray-500 hover:text-restaurant-accent hover:border-restaurant-accent dark:text-gray-400 transition"
                          >
                            <Plus size={12} />
                            <span>{isAmharic ? 'ወጪ አስላ' : 'Add Recipe/Cost'}</span>
                          </button>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                              <span>{isAmharic ? 'ወጪ:' : 'Cost:'}</span>
                              <span className="font-semibold text-gray-900 dark:text-gray-200">
                                {cost} {item.currency}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                ({item.costInfo?.costType === 'bought'
                                  ? isAmharic
                                    ? 'የተገዛ'
                                    : 'Bought'
                                  : isAmharic
                                  ? `${item.costInfo?.ingredients?.length || 0} እቃዎች`
                                  : `${item.costInfo?.ingredients?.length || 0} ing.`})
                              </span>
                            </div>

                            <div>
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  isTargetMet
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                }`}
                                title={
                                  isTargetMet
                                    ? 'Hits owner target (≥60% profit)'
                                    : 'Below 60% profit target'
                                }
                              >
                                {isTargetMet ? (
                                  <CheckCircle2 size={12} />
                                ) : (
                                  <AlertTriangle size={12} />
                                )}
                                <span>
                                  {marginPct.toFixed(0)}% {isAmharic ? 'ትርፍ' : 'Profit'}
                                </span>
                              </span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Availability */}
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            item.available
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                          }`}
                        >
                          {item.available
                            ? isAmharic
                              ? 'ይገኛል'
                              : 'Available'
                            : isAmharic
                            ? 'አልቋል'
                            : 'Sold Out'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          <button
                            onClick={() => handleToggleAvailability(item)}
                            className="p-1.5 rounded-lg text-gray-500 hover:bg-cream-100 dark:hover:bg-slate-800 transition"
                            title={
                              item.available
                                ? isAmharic
                                  ? 'አልቋል በል'
                                  : 'Mark sold out'
                                : isAmharic
                                ? 'ይገኛል በል'
                                : 'Mark available'
                            }
                          >
                            {item.available ? (
                              <Eye size={17} className="text-emerald-600" />
                            ) : (
                              <EyeOff size={17} className="text-rose-600" />
                            )}
                          </button>

                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                            title={isAmharic ? 'አስተካክል' : 'Edit item'}
                          >
                            <Edit2 size={17} />
                          </button>

                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                            title={isAmharic ? 'ሰርዝ' : 'Delete item'}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Add / Edit Modal */}
        {editingItem && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-cream-200 dark:border-slate-800">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 sm:p-6 border-b border-cream-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-restaurant-accent/10 text-restaurant-accent">
                    <ChefHat size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-serif font-bold text-gray-900 dark:text-white">
                      {isAdding
                        ? isAmharic
                          ? 'አዲስ የሜኑ እቃ መዝግብ'
                          : 'Add Menu Item'
                        : isAmharic
                        ? 'የሜኑ እቃ አሻሽል'
                        : 'Edit Menu Item'}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isAmharic
                        ? 'የእቃውን መረጃ፣ ዋጋና የወጪ/የትርፍ ስሌት ያስገቡ'
                        : 'Configure item details, selling price, recipe cost, and profit margin'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setEditingItem(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
                {/* Names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                      {isAmharic ? 'የእቃ ስም (እንግሊዝኛ) *' : 'Name (English) *'}
                    </span>
                    <input
                      type="text"
                      value={editingItem.name.en}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          name: {
                            ...editingItem.name,
                            en: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g. Special Burger"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-cream-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-restaurant-accent"
                    />
                  </label>

                  <label className="block">
                    <span className="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                      {isAmharic ? 'የእቃ ስም (አማርኛ)' : 'Name (Amharic)'}
                    </span>
                    <input
                      type="text"
                      value={editingItem.name.am || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          name: {
                            ...editingItem.name,
                            am: e.target.value,
                          },
                        })
                      }
                      placeholder="ምሳሌ፡ ስፔሻል በርገር"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-cream-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-restaurant-accent"
                    />
                  </label>
                </div>

                {/* Descriptions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                      {isAmharic ? 'መግለጫ (እንግሊዝኛ)' : 'Description (English)'}
                    </span>
                    <textarea
                      rows={3}
                      value={editingItem.description.en}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          description: {
                            ...editingItem.description,
                            en: e.target.value,
                          },
                        })
                      }
                      placeholder="Juicy beef patty served with fresh lettuce..."
                      className="w-full px-3.5 py-2 rounded-xl border border-cream-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-restaurant-accent"
                    />
                  </label>

                  <label className="block">
                    <span className="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                      {isAmharic ? 'መግለጫ (አማርኛ)' : 'Description (Amharic)'}
                    </span>
                    <textarea
                      rows={3}
                      value={editingItem.description.am || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          description: {
                            ...editingItem.description,
                            am: e.target.value,
                          },
                        })
                      }
                      placeholder="ከኩሽና ትኩስ ሰላጣ ጋር የሚቀርብ..."
                      className="w-full px-3.5 py-2 rounded-xl border border-cream-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-restaurant-accent"
                    />
                  </label>
                </div>

                {/* Category & Selling Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                      {isAmharic ? 'ምድብ *' : 'Category *'}
                    </span>
                    <select
                      value={editingItem.categoryId}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          categoryId: e.target.value,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-cream-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-restaurant-accent"
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {isAmharic && category.name.am
                            ? category.name.am
                            : category.name.en}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                      {isAmharic ? 'የመሸጫ ዋጋ (ETB) *' : 'Selling Price (ETB) *'}
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={editingItem.price === 0 ? '' : editingItem.price}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            price: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        placeholder="0.00"
                        className="w-full px-3.5 py-2.5 pr-14 rounded-xl border border-cream-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-restaurant-accent"
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs font-bold text-gray-400">
                        {editingItem.currency}
                      </span>
                    </div>
                  </label>
                </div>

                {/* ============================================================
                    COST BREAKDOWN & 60% PROFIT MARGIN SECTION
                   ============================================================ */}
                <div className="rounded-2xl border-2 border-dashed border-restaurant-accent/30 bg-cream-50/50 dark:bg-slate-800/40 p-4 sm:p-5 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-cream-200 dark:border-slate-700/60">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-restaurant-accent text-white shadow-xs">
                        <Calculator size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>
                            {isAmharic
                              ? 'የወጪና የትርፍ ስሌት (ዒላማ 60%)'
                              : 'Recipe Cost & 60% Profit Margin Calculator'}
                          </span>
                        </h3>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {isAmharic
                            ? 'ባለቤቱ በእያንዳንዱ እቃ ቢያንስ 60% ትርፍ እንዲያገኝ ወጪውን ያስገቡ'
                            : 'Ensure at least 60% profit on every item sold by tracking cost'}
                        </p>
                      </div>
                    </div>

                    {/* Procurement Switcher: Made In-House vs Bought */}
                    <div className="inline-flex rounded-xl bg-gray-200/80 dark:bg-slate-800 p-1 self-start sm:self-auto shrink-0 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingItem({
                            ...editingItem,
                            costInfo: {
                              ...(editingItem.costInfo || { targetMargin: 60 }),
                              costType: 'made',
                            },
                          })
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                          (editingItem.costInfo?.costType || 'made') === 'made'
                            ? 'bg-white dark:bg-slate-750 text-restaurant-accent shadow-xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                        }`}
                      >
                        <ChefHat size={14} />
                        <span>{isAmharic ? '🍳 በቤት የሚሰራ (ግብአቶች)' : '🍳 Made In-House'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditingItem({
                            ...editingItem,
                            costInfo: {
                              ...(editingItem.costInfo || { targetMargin: 60 }),
                              costType: 'bought',
                            },
                          })
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                          editingItem.costInfo?.costType === 'bought'
                            ? 'bg-white dark:bg-slate-750 text-restaurant-accent shadow-xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                        }`}
                      >
                        <ShoppingBag size={14} />
                        <span>{isAmharic ? '📦 የተገዛ (ጅምላ / ዳግም ሽያጭ)' : '📦 Bought (Resale)'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Procurement Form Content */}
                  {editingItem.costInfo?.costType === 'bought' ? (
                    /* BOUGHT ITEM: DIRECT PURCHASE COST */
                    <div className="bg-white dark:bg-slate-850 rounded-xl p-4 border border-cream-200 dark:border-slate-700/60 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1">
                            {isAmharic
                              ? 'የጅምላ መግዣ ዋጋ (Wholesale Purchase Cost) *'
                              : 'Wholesale Purchase Cost from Supplier *'}
                          </label>
                          <p className="text-[11px] text-gray-500">
                            {isAmharic
                              ? 'ይህን እቃ ከፋብሪካ ወይም ከጅምላ ሻጭ ስንት ብር እንደገዙት ያስገቡ'
                              : 'How much the restaurant pays to buy this packaged item wholesale'}
                          </p>
                        </div>

                        <div className="relative w-full sm:w-56">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={
                              editingItem.costInfo?.purchaseCost === 0
                                ? ''
                                : editingItem.costInfo?.purchaseCost || ''
                            }
                            onChange={(e) =>
                              setEditingItem({
                                ...editingItem,
                                costInfo: {
                                  ...(editingItem.costInfo || { costType: 'bought', targetMargin: 60 }),
                                  costType: 'bought',
                                  purchaseCost: Math.max(0, Number(e.target.value) || 0),
                                },
                              })
                            }
                            placeholder="0.00"
                            className="w-full px-3.5 py-2 pr-12 rounded-xl border border-cream-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-restaurant-accent"
                          />
                          <span className="absolute right-3 top-2 text-xs font-bold text-gray-400">
                            {editingItem.currency}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* MADE IN-HOUSE: INGREDIENTS LIST */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                          {isAmharic ? 'የምግብ ግብአቶች ዝርዝር' : 'Recipe Ingredients List'} (
                          {editingItem.costInfo?.ingredients?.length || 0})
                        </span>

                        <button
                          type="button"
                          onClick={handleAddIngredientRow}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cream-200 dark:bg-slate-750 hover:bg-cream-300 dark:hover:bg-slate-700 text-xs font-bold text-gray-800 dark:text-gray-200 transition"
                        >
                          <Plus size={13} />
                          <span>{isAmharic ? 'ግብአት ጨምር' : 'Add Ingredient'}</span>
                        </button>
                      </div>

                      {(!editingItem.costInfo?.ingredients ||
                        editingItem.costInfo.ingredients.length === 0) ? (
                        <div className="text-center py-6 border border-dashed border-cream-300 dark:border-slate-700 rounded-xl bg-white/70 dark:bg-slate-850/50">
                          <p className="text-xs text-gray-400">
                            {isAmharic
                              ? 'ምንም ግብአት ገና አልተጨመረም። ከላይ "ግብአት ጨምር" የሚለውን ይጫኑ።'
                              : 'No ingredients listed yet. Click "+ Add Ingredient" above to build the recipe.'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {editingItem.costInfo.ingredients.map((ing, idx) => (
                            <div
                              key={ing.id || idx}
                              className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-850 border border-cream-200 dark:border-slate-700/60 shadow-2xs"
                            >
                              {/* Ingredient Name */}
                              <input
                                type="text"
                                value={ing.name}
                                onChange={(e) =>
                                  handleUpdateIngredientRow(ing.id, 'name', e.target.value)
                                }
                                placeholder={isAmharic ? 'የግብአት ስም (ምሳሌ፡ እንቁላል)' : 'Ingredient name (e.g. Eggs)'}
                                className="flex-2 min-w-[140px] px-2.5 py-1.5 rounded-lg border border-cream-200 dark:border-slate-700 bg-cream-50/50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-restaurant-accent"
                              />

                              {/* Quantity */}
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={ing.quantity || ''}
                                onChange={(e) =>
                                  handleUpdateIngredientRow(
                                    ing.id,
                                    'quantity',
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                                placeholder="Qty"
                                className="w-16 px-2 py-1.5 rounded-lg border border-cream-200 dark:border-slate-700 bg-cream-50/50 dark:bg-slate-800 text-xs text-center focus:outline-none focus:ring-1 focus:ring-restaurant-accent"
                              />

                              {/* Measurement Unit */}
                              <select
                                value={ing.unit}
                                onChange={(e) =>
                                  handleUpdateIngredientRow(ing.id, 'unit', e.target.value)
                                }
                                className="w-28 px-2 py-1.5 rounded-lg border border-cream-200 dark:border-slate-700 bg-cream-50/50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-restaurant-accent"
                              >
                                {MEASUREMENT_UNITS.map((u) => (
                                  <option key={u.value} value={u.value}>
                                    {isAmharic ? u.labelAm : u.labelEn}
                                  </option>
                                ))}
                              </select>

                              {/* Portion Cost in ETB */}
                              <div className="relative w-28">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={ing.cost === 0 ? '' : ing.cost}
                                  onChange={(e) =>
                                    handleUpdateIngredientRow(
                                      ing.id,
                                      'cost',
                                      Math.max(0, Number(e.target.value) || 0)
                                    )
                                  }
                                  placeholder="0.00"
                                  className="w-full px-2 py-1.5 pr-8 rounded-lg border border-cream-200 dark:border-slate-700 bg-cream-50/50 dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-restaurant-accent"
                                />
                                <span className="absolute right-2 top-1.5 text-[10px] font-bold text-gray-400">
                                  ETB
                                </span>
                              </div>

                              {/* Delete row */}
                              <button
                                type="button"
                                onClick={() => handleRemoveIngredientRow(ing.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg transition"
                                title="Remove ingredient"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* REAL-TIME PROFIT & MARGIN DASHBOARD CARD */}
                  <div className="rounded-xl bg-white dark:bg-slate-850 p-4 border border-cream-200 dark:border-slate-700/70 space-y-4">
                    {/* Metrics Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="p-3 rounded-xl bg-cream-50 dark:bg-slate-800 border border-cream-200/60 dark:border-slate-700/50">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">
                          {isAmharic ? 'የመሸጫ ዋጋ' : 'Selling Price'}
                        </span>
                        <span className="text-base font-bold text-gray-900 dark:text-white">
                          {editingItem.price} {editingItem.currency}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-cream-50 dark:bg-slate-800 border border-cream-200/60 dark:border-slate-700/50">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">
                          {isAmharic ? 'አጠቃላይ ወጪ' : 'Total Cost'}
                        </span>
                        <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                          {currentItemCost.toFixed(1)} {editingItem.currency}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-cream-50 dark:bg-slate-800 border border-cream-200/60 dark:border-slate-700/50">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">
                          {isAmharic ? 'ትርፍ መጠን' : 'Gross Profit'}
                        </span>
                        <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                          {currentMarginStats.grossProfit.toFixed(1)} {editingItem.currency}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-cream-50 dark:bg-slate-800 border border-cream-200/60 dark:border-slate-700/50">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 block font-medium">
                          {isAmharic ? 'የትርፍ መጣኔ %' : 'Profit Margin %'}
                        </span>
                        <span
                          className={`text-base font-extrabold ${
                            currentMarginStats.isTargetMet
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {currentMarginStats.marginPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* 60% Margin Progress Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        <span>0%</span>
                        <span className="text-restaurant-accent font-bold">
                          {isAmharic ? 'ዒላማ፡ 60% ትርፍ' : 'Target: 60% Profit'}
                        </span>
                        <span>100%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden relative">
                        <div
                          className={`h-full transition-all duration-300 ${
                            currentMarginStats.isTargetMet ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(0, currentMarginStats.marginPct))}%`,
                          }}
                        />
                        {/* 60% marker line */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-gray-900 dark:bg-white z-10"
                          style={{ left: '60%' }}
                          title="60% Target Line"
                        />
                      </div>
                    </div>

                    {/* Recommendation / Alert Banner */}
                    {currentItemCost > 0 && (
                      <div
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          currentMarginStats.isTargetMet
                            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-200'
                            : 'bg-amber-50/90 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-200'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          {currentMarginStats.isTargetMet ? (
                            <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
                          ) : (
                            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
                          )}
                          <div className="text-xs">
                            <span className="font-bold block">
                              {currentMarginStats.isTargetMet
                                ? isAmharic
                                  ? 'ጤናማ የትርፍ መጣኔ (≥60%)!'
                                  : 'Target Met: Healthy Profit Margin (≥60%)'
                                : isAmharic
                                ? 'የትርፍ መጣኔው ከ 60% በታች ነው!'
                                : 'Below Owner’s 60% Profit Target'}
                            </span>
                            <span className="text-[11px] opacity-90 leading-relaxed block mt-0.5">
                              {currentMarginStats.isTargetMet
                                ? isAmharic
                                  ? `ይህ እቃ የባለቤቱን የ 60% ትርፍ ግብ ያሟላል (${currentMarginStats.marginPct.toFixed(1)}% ትርፍ)።`
                                  : `This item comfortably meets the 60% profit target (${currentMarginStats.marginPct.toFixed(1)}% margin).`
                                : isAmharic
                                ? `60% ትርፍ ለማግኘት የመሸጫ ዋጋው ቢያንስ ${currentMarginStats.suggestedPrice} ${editingItem.currency} መሆን አለበት።`
                                : `To hit a 60% margin, suggested minimum price is ${currentMarginStats.suggestedPrice} ${editingItem.currency}.`}
                            </span>
                          </div>
                        </div>

                        {!currentMarginStats.isTargetMet && (
                          <button
                            type="button"
                            onClick={handleApplySuggestedPrice}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-xs shrink-0 self-start sm:self-auto transition"
                          >
                            <Sparkles size={13} />
                            <span>
                              {isAmharic
                                ? `ዋጋውን ${currentMarginStats.suggestedPrice} ETB አድርግ`
                                : `Set to ${currentMarginStats.suggestedPrice} ETB (60%)`}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Image URL */}
                <label className="block">
                  <span className="block mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                    {isAmharic ? 'የምስል አድራሻ (Image URL)' : 'Image URL'}
                  </span>
                  <input
                    type="url"
                    value={editingItem.image || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        image: e.target.value || null,
                      })
                    }
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-cream-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-restaurant-accent"
                  />
                </label>

                {/* Flags */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                  {[
                    ['available', isAmharic ? 'ይገኛል' : 'Available'],
                    ['featured', isAmharic ? 'ተመራጭ' : 'Featured'],
                    ['fasting', isAmharic ? 'የጾም' : 'Fasting'],
                    ['vegetarian', isAmharic ? 'አትክልት ብቻ' : 'Vegetarian'],
                    ['spicy', isAmharic ? 'የሚያቃጥል' : 'Spicy'],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 p-2 rounded-xl bg-cream-50/60 dark:bg-slate-800/60 border border-cream-200 dark:border-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={
                          editingItem[key as keyof MenuItem] as boolean
                        }
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            [key]: e.target.checked,
                          })
                        }
                        className="rounded text-restaurant-accent focus:ring-restaurant-accent"
                      />
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-5 sm:p-6 border-t border-cream-200 dark:border-slate-800 bg-cream-50/50 dark:bg-slate-850 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl border border-cream-300 dark:border-slate-700 text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                >
                  {isAmharic ? 'ተወው' : 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-restaurant-accent hover:bg-restaurant-accent-dark text-white text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50 transition"
                >
                  <Save size={16} />
                  <span>
                    {saving
                      ? isAmharic
                        ? 'በማስቀመጥ ላይ...'
                        : 'Saving...'
                      : isAmharic
                      ? 'አስቀምጥ'
                      : 'Save Changes'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}