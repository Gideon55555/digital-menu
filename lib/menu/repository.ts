import fs from 'fs/promises';
import path from 'path';
import { supabase } from '@/lib/supabase';
import {
  MenuItem,
  MenuCategory,
  RestaurantSettings,
} from '@/lib/types';

import {
  createMenuItemSchema,
  updateMenuItemSchema,
  menuCategorySchema,
  restaurantSettingsSchema,
} from '@/lib/validation/schemas';

const DATA_DIR = path.join(process.cwd(), 'data');

const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const RESTAURANT_FILE = path.join(DATA_DIR, 'restaurant.json');

/**
 * JSON Repository Implementation
 *
 * Handles all data persistence for local development.
 * Can later be replaced with Supabase/PostgreSQL without
 * changing the UI.
 */
export class JsonRepository {
  // =========================================================
  // MENU ITEMS
  // =========================================================

// =========================================================
// MENU ITEMS
// =========================================================

static async getMenuItems(): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error(
      'Error reading menu items from Supabase:',
      error
    );
    return [];
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    categoryId: item.category_id,
    name: item.name,
    description: item.description,
    price: Number(item.price),
    currency: item.currency,
    image: item.image,
    available: item.available,
    featured: item.featured,
    fasting: item.fasting,
    vegetarian: item.vegetarian,
    displayOrder: item.display_order,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
}

static async getMenuItemsByCategory(
  categoryId: string
): Promise<MenuItem[]> {
  const items = await this.getMenuItems();

  return items.filter(
    (item) => item.categoryId === categoryId
  );
}

static async getMenuItem(
  id: string
): Promise<MenuItem | null> {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(
      'Error reading menu item from Supabase:',
      error
    );
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    categoryId: data.category_id,
    name: data.name,
    description: data.description,
    price: Number(data.price),
    currency: data.currency,
    image: data.image,
    available: data.available,
    featured: data.featured,
    fasting: data.fasting,
    vegetarian: data.vegetarian,
    displayOrder: data.display_order,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

static async getFeaturedItems(): Promise<MenuItem[]> {
  const items = await this.getMenuItems();

  return items
    .filter(
      (item) => item.featured && item.available
    )
    .sort(
      (a, b) => a.displayOrder - b.displayOrder
    );
}

static async getAvailableItems(): Promise<MenuItem[]> {
  const items = await this.getMenuItems();

  return items.filter(
    (item) => item.available
  );
}

static async searchMenuItems(
  query: string
): Promise<MenuItem[]> {
  const items = await this.getMenuItems();

  const lowerQuery = query.toLowerCase();

  return items.filter((item) => {
    const nameMatch =
      item.name.en
        .toLowerCase()
        .includes(lowerQuery) ||
      Boolean(
        item.name.am
          ?.toLowerCase()
          .includes(lowerQuery)
      );

    const descMatch =
      item.description.en
        .toLowerCase()
        .includes(lowerQuery) ||
      Boolean(
        item.description.am
          ?.toLowerCase()
          .includes(lowerQuery)
      );

    return nameMatch || descMatch;
  });
}

static async createMenuItem(
  data: unknown
): Promise<MenuItem> {
  const validatedData =
    createMenuItemSchema.parse(data);

  const items = await this.getMenuItems();

  const newItem: MenuItem = {
    ...validatedData,
    id: this.generateId(),
    displayOrder:
      validatedData.displayOrder ?? items.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('menu_items')
    .insert({
      id: newItem.id,
      category_id: newItem.categoryId,
      name: newItem.name,
      description: newItem.description,
      price: newItem.price,
      currency: newItem.currency,
      image: newItem.image ?? null,
      available: newItem.available,
      featured: newItem.featured,
      fasting: newItem.fasting,
      vegetarian: newItem.vegetarian,
      display_order: newItem.displayOrder,
      created_at: newItem.createdAt,
      updated_at: newItem.updatedAt,
    });

  if (error) {
    console.error(
      'Error creating menu item in Supabase:',
      error
    );

    throw new Error(
      `Failed to create menu item: ${error.message}`
    );
  }

  return newItem;
}

static async updateMenuItem(
  id: string,
  data: unknown
): Promise<MenuItem> {
  const updateData =
    updateMenuItemSchema.parse(data);

  const updatePayload: Record<string, unknown> = {};

  if (updateData.categoryId !== undefined) {
    updatePayload.category_id =
      updateData.categoryId;
  }

  if (updateData.name !== undefined) {
    updatePayload.name = updateData.name;
  }

  if (updateData.description !== undefined) {
    updatePayload.description =
      updateData.description;
  }

  if (updateData.price !== undefined) {
    updatePayload.price = updateData.price;
  }

  if (updateData.currency !== undefined) {
    updatePayload.currency = updateData.currency;
  }

  if (updateData.image !== undefined) {
    updatePayload.image = updateData.image;
  }

  if (updateData.available !== undefined) {
    updatePayload.available =
      updateData.available;
  }

  if (updateData.featured !== undefined) {
    updatePayload.featured =
      updateData.featured;
  }

  if (updateData.fasting !== undefined) {
    updatePayload.fasting =
      updateData.fasting;
  }

  if (updateData.vegetarian !== undefined) {
    updatePayload.vegetarian =
      updateData.vegetarian;
  }

  if (updateData.displayOrder !== undefined) {
    updatePayload.display_order =
      updateData.displayOrder;
  }

  updatePayload.updated_at =
    new Date().toISOString();

  const {
    data: updatedData,
    error,
  } = await supabase
    .from('menu_items')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error(
      'Error updating menu item in Supabase:',
      error
    );

    throw new Error(
      `Failed to update menu item: ${error.message}`
    );
  }

  return {
    id: updatedData.id,
    categoryId: updatedData.category_id,
    name: updatedData.name,
    description: updatedData.description,
    price: Number(updatedData.price),
    currency: updatedData.currency,
    image: updatedData.image,
    available: updatedData.available,
    featured: updatedData.featured,
    fasting: updatedData.fasting,
    vegetarian: updatedData.vegetarian,
    displayOrder: updatedData.display_order,
    createdAt: updatedData.created_at,
    updatedAt: updatedData.updated_at,
  };
}

static async deleteMenuItem(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(
      'Error deleting menu item from Supabase:',
      error
    );

    throw new Error(
      `Failed to delete menu item: ${error.message}`
    );
  }
}

static async toggleMenuItemAvailability(
  id: string
): Promise<MenuItem> {
  const item = await this.getMenuItem(id);

  if (!item) {
    throw new Error(
      `Menu item with id ${id} not found`
    );
  }

  return this.updateMenuItem(id, {
    available: !item.available,
  });
}

static async reorderMenuItems(
  items: Array<{
    id: string;
    displayOrder: number;
  }>
): Promise<void> {
  for (const {
    id,
    displayOrder,
  } of items) {
    const { error } = await supabase
      .from('menu_items')
      .update({
        display_order: displayOrder,
      })
      .eq('id', id);

    if (error) {
      console.error(
        `Error reordering menu item ${id}:`,
        error
      );

      throw new Error(
        `Failed to reorder menu item: ${error.message}`
      );
    }
  }
}

  // =========================================================
  // CATEGORIES
  // =========================================================

  static async getCategories(): Promise<MenuCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error reading categories from Supabase:', error);
    return [];
  }

  return (data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    icon: category.icon,
    displayOrder: category.display_order,
    visible: category.visible,
  }));
}

  static async getCategory(
  id: string
): Promise<MenuCategory | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(
      'Error reading category from Supabase:',
      error
    );
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    icon: data.icon,
    displayOrder: data.display_order,
    visible: data.visible,
  };
}

  /**
   * CREATE CATEGORY
   *
   * ID is generated by the repository.
   * Therefore the client does NOT need to send an ID.
   */
 static async createCategory(
  data: unknown
): Promise<MenuCategory> {
  const createCategorySchema =
    menuCategorySchema.omit({
      id: true,
    });

  const validatedData =
    createCategorySchema.parse(data);

  const newCategory: MenuCategory = {
    ...validatedData,
    id: this.generateCategoryId(),
    displayOrder:
      validatedData.displayOrder ?? 0,
    visible:
      validatedData.visible ?? true,
  };

  const { error } = await supabase
    .from('categories')
    .insert({
      id: newCategory.id,
      name: newCategory.name,
      description: newCategory.description ?? null,
      icon: newCategory.icon ?? null,
      display_order: newCategory.displayOrder,
      visible: newCategory.visible,
    });

  if (error) {
    console.error(
      'Error creating category in Supabase:',
      error
    );

    throw new Error(
      `Failed to create category: ${error.message}`
    );
  }

  return newCategory;
}

  /**
   * UPDATE CATEGORY
   *
   * IMPORTANT:
   * We do NOT validate the ID from the request body.
   *
   * The ID comes from:
   *
   * /api/categories/[id]
   *
   * and is passed into this method as `id`.
   */
  static async updateCategory(
  id: string,
  data: unknown
): Promise<MenuCategory> {
  const updateCategorySchema =
    menuCategorySchema
      .omit({
        id: true,
      })
      .partial();

  const validatedData =
    updateCategorySchema.parse(data);

  const updatePayload: Record<string, unknown> = {};

  if (validatedData.name !== undefined) {
    updatePayload.name = validatedData.name;
  }

  if (validatedData.description !== undefined) {
    updatePayload.description =
      validatedData.description;
  }

  if (validatedData.icon !== undefined) {
    updatePayload.icon = validatedData.icon;
  }

  if (validatedData.displayOrder !== undefined) {
    updatePayload.display_order =
      validatedData.displayOrder;
  }

  if (validatedData.visible !== undefined) {
    updatePayload.visible =
      validatedData.visible;
  }

  const { data: updatedData, error } =
    await supabase
      .from('categories')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

  if (error) {
    console.error(
      'Error updating category in Supabase:',
      error
    );

    throw new Error(
      `Failed to update category: ${error.message}`
    );
  }

  return {
    id: updatedData.id,
    name: updatedData.name,
    description: updatedData.description,
    icon: updatedData.icon,
    displayOrder: updatedData.display_order,
    visible: updatedData.visible,
  };
}

  static async deleteCategory(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(
      'Error deleting category from Supabase:',
      error
    );

    throw new Error(
      `Failed to delete category: ${error.message}`
    );
  }
}

 static async reorderCategories(
  categories: Array<{
    id: string;
    displayOrder: number;
  }>
): Promise<void> {
  for (const {
    id,
    displayOrder,
  } of categories) {
    const { error } = await supabase
      .from('categories')
      .update({
        display_order: displayOrder,
      })
      .eq('id', id);

    if (error) {
      console.error(
        `Error reordering category ${id}:`,
        error
      );

      throw new Error(
        `Failed to reorder category: ${error.message}`
      );
    }
  }
}

  // =========================================================
  // RESTAURANT SETTINGS
  // =========================================================

  static async getRestaurantSettings(): Promise<RestaurantSettings> {
    try {
      const data = await fs.readFile(
        RESTAURANT_FILE,
        'utf-8'
      );

      const settings =
        JSON.parse(data);

      return restaurantSettingsSchema.parse(
        settings
      );
    } catch (error) {
      console.error(
        'Error reading restaurant settings:',
        error
      );

      throw new Error(
        'Failed to load restaurant settings'
      );
    }
  }

  static async updateRestaurantSettings(
    data: unknown
  ): Promise<RestaurantSettings> {
    const validatedData =
      restaurantSettingsSchema.parse(
        data
      );

    await this.writeRestaurantSettings(
      validatedData
    );

    return validatedData;
  }

  // =========================================================
  // PRIVATE FILE HELPERS
  // =========================================================

  private static async writeMenuItems(
    items: MenuItem[]
  ): Promise<void> {
    await fs.writeFile(
      MENU_FILE,
      JSON.stringify(
        items,
        null,
        2
      ),
      'utf-8'
    );
  }

  private static async writeCategories(
    categories: MenuCategory[]
  ): Promise<void> {
    await fs.writeFile(
      CATEGORIES_FILE,
      JSON.stringify(
        categories,
        null,
        2
      ),
      'utf-8'
    );
  }

  private static async writeRestaurantSettings(
    settings: RestaurantSettings
  ): Promise<void> {
    await fs.writeFile(
      RESTAURANT_FILE,
      JSON.stringify(
        settings,
        null,
        2
      ),
      'utf-8'
    );
  }

  // =========================================================
  // ID GENERATORS
  // =========================================================

  private static generateId(): string {
    return `item_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
  }

  private static generateCategoryId(): string {
    return `category_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
  }
}

/**
 * Repository interface
 *
 * Allows replacing JSON storage with
 * Supabase/PostgreSQL later without
 * changing the UI.
 */
export interface IRepository {
  getMenuItems(): Promise<MenuItem[]>;

  getMenuItemsByCategory(
    categoryId: string
  ): Promise<MenuItem[]>;

  getMenuItem(
    id: string
  ): Promise<MenuItem | null>;

  getFeaturedItems(): Promise<MenuItem[]>;

  searchMenuItems(
    query: string
  ): Promise<MenuItem[]>;

  createMenuItem(
    data: unknown
  ): Promise<MenuItem>;

  updateMenuItem(
    id: string,
    data: unknown
  ): Promise<MenuItem>;

  deleteMenuItem(
    id: string
  ): Promise<void>;

  toggleMenuItemAvailability(
    id: string
  ): Promise<MenuItem>;

  reorderMenuItems(
    items: Array<{
      id: string;
      displayOrder: number;
    }>
  ): Promise<void>;

  getCategories(): Promise<MenuCategory[]>;

  getCategory(
    id: string
  ): Promise<MenuCategory | null>;

  createCategory(
    data: unknown
  ): Promise<MenuCategory>;

  updateCategory(
    id: string,
    data: unknown
  ): Promise<MenuCategory>;

  deleteCategory(
    id: string
  ): Promise<void>;

  getRestaurantSettings(): Promise<RestaurantSettings>;

  updateRestaurantSettings(
    data: unknown
  ): Promise<RestaurantSettings>;
}

/**
 * Singleton repository instance
 */
export const repository: IRepository =
  JsonRepository;