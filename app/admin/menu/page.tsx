    'use client';

    import { useEffect, useState } from 'react';
    import { MenuItem, MenuCategory } from '@/lib/types';
    import { AdminLayout } from '@/components/admin/AdminLayout';
    import {
    Edit2,
    Trash2,
    Plus,
    Eye,
    EyeOff,
    X,
    Save,
    } from 'lucide-react';

    export default function MenuManagementPage() {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [saving, setSaving] = useState(false);

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
        alert('Failed to load menu data.');
        } finally {
        setLoading(false);
        }
    }

    const filteredItems = items.filter((item) => {
        if (filter === 'all') return true;
        if (filter === 'available') return item.available;
        if (filter === 'sold-out') return !item.available;

        return item.categoryId === filter;
    });

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
        alert('Failed to update availability.');
        }
    }

    async function handleDelete(id: string) {
        if (!window.confirm('Are you sure you want to delete this item?')) {
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
        alert('Failed to delete menu item.');
        }
    }

    function handleEdit(item: MenuItem) {
        setEditingItem({
        ...item,
        name: { ...item.name },
        description: { ...item.description },
        ingredients: item.ingredients ? [...item.ingredients] : [],
        allergens: item.allergens ? [...item.allergens] : [],
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
        });

        setIsAdding(true);
    }

    async function handleSave() {
        if (!editingItem) return;

        if (!editingItem.name.en.trim()) {
        alert('English name is required.');
        return;
        }

        if (!editingItem.categoryId) {
        alert('Please select a category.');
        return;
        }

        if (editingItem.price <= 0) {
        alert('Price must be greater than 0.');
        return;
        }

        try {
        setSaving(true);

        const url = isAdding
            ? '/api/menu'
            : `/api/menu/${editingItem.id}`;

        const method = isAdding ? 'POST' : 'PUT';

       const { id, createdAt, updatedAt, ...updateBody } = editingItem;

const body = isAdding
  ? {
      ...editingItem,
    }
  : updateBody;

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
            prev.map((item) =>
                item.id === result.data.id ? result.data : item
            )
            );
        }

        setEditingItem(null);
        setIsAdding(false);
        } catch (error) {
        console.error(error);
        alert(
            error instanceof Error
            ? error.message
            : 'Failed to save menu item.'
        );
        } finally {
        setSaving(false);
        }
    }

    if (loading) {
        return (
        <AdminLayout>
            <div className="p-8 text-center">
            Loading menu...
            </div>
        </AdminLayout>
        );
    }

    return (
        <AdminLayout>
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-serif font-bold text-restaurant-text dark:text-white">
                Menu Items
                </h1>

                <p className="text-restaurant-text-light dark:text-gray-400 mt-1">
                Manage and organize your menu items
                </p>
            </div>

            <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-restaurant-accent text-white rounded-lg hover:bg-restaurant-accent-dark transition-colors font-medium"
            >
                <Plus size={20} />
                Add Item
            </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
            {['all', 'available', 'sold-out'].map((f) => (
                <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === f
                    ? 'bg-restaurant-accent text-white'
                    : 'bg-cream-100 dark:bg-slate-800 text-restaurant-text dark:text-white hover:bg-cream-200 dark:hover:bg-slate-700'
                }`}
                >
                {f.replace('-', ' ').toUpperCase()}
                </button>
            ))}

            <div className="flex-1" />

            <select
                value={
                ['all', 'available', 'sold-out'].includes(filter)
                    ? ''
                    : filter
                }
                onChange={(e) => setFilter(e.target.value || 'all')}
                className="px-4 py-2 bg-cream-100 dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg border border-cream-200 dark:border-slate-700"
            >
                <option value="">Filter by category</option>

                {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                    {cat.name.en}
                </option>
                ))}
            </select>
            </div>

            {/* Table */}
            <div className="restaurant-card overflow-x-auto">
            <table className="w-full">
                <thead className="border-b border-cream-200 dark:border-slate-800 bg-cream-50 dark:bg-slate-800">
                <tr>
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">Category</th>
                    <th className="px-6 py-3 text-left">Price</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                </tr>
                </thead>

                <tbody className="divide-y dark:divide-slate-800">
                {filteredItems.map((item) => {
                    const category = categories.find(
                    (c) => c.id === item.categoryId
                    );

                    return (
                    <tr
                        key={item.id}
                        className="hover:bg-cream-50 dark:hover:bg-slate-800/50"
                    >
                        <td className="px-6 py-4">
                        <p className="font-medium">
                            {item.name.en}
                        </p>

                        {item.name.am && (
                            <p className="text-sm text-gray-400">
                            {item.name.am}
                            </p>
                        )}
                        </td>

                        <td className="px-6 py-4">
                        {category?.name.en || 'Unknown'}
                        </td>

                        <td className="px-6 py-4 font-semibold text-restaurant-accent">
                        {item.price} {item.currency}
                        </td>

                        <td className="px-6 py-4 text-center">
                        <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            item.available
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                        >
                            {item.available
                            ? 'Available'
                            : 'Sold Out'}
                        </span>
                        </td>

                        <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                            <button
                            onClick={() =>
                                handleToggleAvailability(item)
                            }
                            className="p-2 rounded-lg hover:bg-cream-100 dark:hover:bg-slate-700"
                            title={
                                item.available
                                ? 'Mark sold out'
                                : 'Mark available'
                            }
                            >
                            {item.available ? (
                                <Eye
                                size={18}
                                className="text-green-600"
                                />
                            ) : (
                                <EyeOff
                                size={18}
                                className="text-red-600"
                                />
                            )}
                            </button>

                            <button
                            onClick={() => handleEdit(item)}
                            className="p-2 rounded-lg hover:bg-cream-100 dark:hover:bg-slate-700"
                            title="Edit item"
                            >
                            <Edit2
                                size={18}
                                className="text-blue-600"
                            />
                            </button>

                            <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 rounded-lg hover:bg-cream-100 dark:hover:bg-slate-700"
                            title="Delete item"
                            >
                            <Trash2
                                size={18}
                                className="text-red-600"
                            />
                            </button>
                        </div>
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
            </div>

            {/* Editor Modal */}
            {editingItem && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b dark:border-slate-800">
                    <h2 className="text-2xl font-serif font-bold">
                    {isAdding ? 'Add Menu Item' : 'Edit Menu Item'}
                    </h2>

                    <button
                    onClick={() => setEditingItem(null)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
                    >
                    <X />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Names */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label>
                        <span className="block mb-2 font-medium">
                        Name (English)
                        </span>

                        <input
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
                        className="w-full px-4 py-2 rounded-lg border"
                        />
                    </label>

                    <label>
                        <span className="block mb-2 font-medium">
                        Name (Amharic)
                        </span>

                        <input
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
                        className="w-full px-4 py-2 rounded-lg border"
                        />
                    </label>
                    </div>

                    {/* Descriptions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label>
                        <span className="block mb-2 font-medium">
                        Description (English)
                        </span>

                        <textarea
                        rows={4}
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
                        className="w-full px-4 py-2 rounded-lg border"
                        />
                    </label>

                    <label>
                        <span className="block mb-2 font-medium">
                        Description (Amharic)
                        </span>

                        <textarea
                        rows={4}
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
                        className="w-full px-4 py-2 rounded-lg border"
                        />
                    </label>
                    </div>

                    {/* Price / category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label>
                        <span className="block mb-2 font-medium">
                        Price
                        </span>

                        <input
                        type="number"
                        min="1"
                        value={editingItem.price}
                        onChange={(e) =>
                            setEditingItem({
                            ...editingItem,
                            price: Number(e.target.value),
                            })
                        }
                        className="w-full px-4 py-2 rounded-lg border"
                        />
                    </label>

                    <label>
                        <span className="block mb-2 font-medium">
                        Category
                        </span>

                        <select
                        value={editingItem.categoryId}
                        onChange={(e) =>
                            setEditingItem({
                            ...editingItem,
                            categoryId: e.target.value,
                            })
                        }
                        className="w-full px-4 py-2 rounded-lg border"
                        >
                        {categories.map((category) => (
                            <option
                            key={category.id}
                            value={category.id}
                            >
                            {category.name.en}
                            </option>
                        ))}
                        </select>
                    </label>
                    </div>

                    {/* Image */}
                    <label>
                    <span className="block mb-2 font-medium">
                        Image URL
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
                        className="w-full px-4 py-2 rounded-lg border"
                    />
                    </label>

                    {/* Flags */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                        ['available', 'Available'],
                        ['featured', 'Featured'],
                        ['fasting', 'Fasting'],
                        ['vegetarian', 'Vegetarian'],
                        ['spicy', 'Spicy'],
                    ].map(([key, label]) => (
                        <label
                        key={key}
                        className="flex items-center gap-2"
                        >
                        <input
                            type="checkbox"
                            checked={
                            editingItem[
                                key as keyof MenuItem
                            ] as boolean
                            }
                            onChange={(e) =>
                            setEditingItem({
                                ...editingItem,
                                [key]: e.target.checked,
                            })
                            }
                        />

                        <span>{label}</span>
                        </label>
                    ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t dark:border-slate-800">
                    <button
                    onClick={() => setEditingItem(null)}
                    className="px-5 py-2 rounded-lg border"
                    >
                    Cancel
                    </button>

                    <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 bg-restaurant-accent text-white rounded-lg disabled:opacity-50"
                    >
                    <Save size={18} />

                    {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
                </div>
            </div>
            )}
        </div>
        </AdminLayout>
    );
    }