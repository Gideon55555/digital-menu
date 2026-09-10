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

const DATA_DIR = path.join(
  process.cwd(),
  'data'
);

const RESTAURANT_FILE = path.join(
  DATA_DIR,
  'restaurant.json'
);

/**
 * Repository Implementation
 *
 * Menu items and categories are stored in Supabase.
 *
 * Restaurant settings are currently stored
 * in restaurant.json.
 *
 * Category types:
 *
 * food  -> Food Kitchen
 * drink -> Drink Kitchen
 */
export class JsonRepository {

  // =========================================================
  // MENU ITEMS
  // =========================================================

  static async getMenuItems(): Promise<MenuItem[]> {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('display_order', {
        ascending: true,
      });

    if (error) {
      console.error(
        'Error reading menu items from Supabase:',
        error
      );

      return [];
    }

    return (data ?? []).map((item) => ({
      id: item.id,

      categoryId:
        item.category_id,

      name:
        item.name,

      description:
        item.description,

      price:
        Number(item.price),

      currency:
        item.currency,

      spicy:
        item.spicy,

      image:
        item.image,

      available:
        item.available,

      featured:
        item.featured,

      fasting:
        item.fasting,

      vegetarian:
        item.vegetarian,

      displayOrder:
        item.display_order,

      costInfo:
        item.cost_info || null,

      createdAt:
        item.created_at,

      updatedAt:
        item.updated_at,
    }));
  }

  // =========================================================
  // MENU ITEMS BY CATEGORY
  // =========================================================

  static async getMenuItemsByCategory(
    categoryId: string
  ): Promise<MenuItem[]> {
    const items =
      await this.getMenuItems();

    return items.filter(
      (item) =>
        item.categoryId === categoryId
    );
  }

  // =========================================================
  // GET SINGLE MENU ITEM
  // =========================================================

  static async getMenuItem(
    id: string
  ): Promise<MenuItem | null> {
    const { data, error } =
      await supabase
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

      categoryId:
        data.category_id,

      name:
        data.name,

      description:
        data.description,

      price:
        Number(data.price),

      currency:
        data.currency,

      spicy:
        data.spicy,

      image:
        data.image,

      available:
        data.available,

      featured:
        data.featured,

      fasting:
        data.fasting,

      vegetarian:
        data.vegetarian,

      displayOrder:
        data.display_order,

      costInfo:
        data.cost_info || null,

      createdAt:
        data.created_at,

      updatedAt:
        data.updated_at,
    };
  }

  // =========================================================
  // FEATURED ITEMS
  // =========================================================

  static async getFeaturedItems(): Promise<MenuItem[]> {
    const items =
      await this.getMenuItems();

    return items
      .filter(
        (item) =>
          item.featured &&
          item.available
      )
      .sort(
        (a, b) =>
          a.displayOrder -
          b.displayOrder
      );
  }

  // =========================================================
  // AVAILABLE ITEMS
  // =========================================================

  static async getAvailableItems(): Promise<MenuItem[]> {
    const items =
      await this.getMenuItems();

    return items.filter(
      (item) =>
        item.available
    );
  }

  // =========================================================
  // SEARCH MENU ITEMS
  // =========================================================

  static async searchMenuItems(
    query: string
  ): Promise<MenuItem[]> {
    const items =
      await this.getMenuItems();

    const lowerQuery =
      query.toLowerCase();

    return items.filter(
      (item) => {
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

        return (
          nameMatch ||
          descMatch
        );
      }
    );
  }

  // =========================================================
  // CREATE MENU ITEM
  // =========================================================

  static async createMenuItem(
    data: unknown
  ): Promise<MenuItem> {
    const validatedData =
      createMenuItemSchema.parse(
        data
      );

    const items =
      await this.getMenuItems();

    const newItem: MenuItem = {
      ...validatedData,

      id:
        this.generateId(),

      displayOrder:
        validatedData.displayOrder ??
        items.length,

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),
    };

    const insertPayload: Record<string, any> = {
      id: newItem.id,
      category_id: newItem.categoryId,
      name: newItem.name,
      description: newItem.description,
      price: newItem.price,
      currency: newItem.currency,
      spicy: newItem.spicy,
      image: newItem.image ?? null,
      available: newItem.available,
      featured: newItem.featured,
      fasting: newItem.fasting,
      vegetarian: newItem.vegetarian,
      display_order: newItem.displayOrder,
      cost_info: newItem.costInfo ?? null,
      created_at: newItem.createdAt,
      updated_at: newItem.updatedAt,
    };

    let { error } = await supabase
      .from('menu_items')
      .insert(insertPayload);

    // Fallback if cost_info column is not created yet
    if (error && (error.code === '42703' || error.message.includes('cost_info'))) {
      console.warn('cost_info column does not exist yet in menu_items. Retrying without it.');
      delete insertPayload.cost_info;
      const retry = await supabase
        .from('menu_items')
        .insert(insertPayload);
      error = retry.error;
    }

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

  // =========================================================
  // UPDATE MENU ITEM
  // =========================================================

  static async updateMenuItem(
    id: string,
    data: unknown
  ): Promise<MenuItem> {
    const updateData =
      updateMenuItemSchema.parse(
        data
      );

    const updatePayload:
      Record<string, unknown> = {};

    if (
      updateData.categoryId !==
      undefined
    ) {
      updatePayload.category_id =
        updateData.categoryId;
    }

    if (
      updateData.name !==
      undefined
    ) {
      updatePayload.name =
        updateData.name;
    }

    if (
      updateData.description !==
      undefined
    ) {
      updatePayload.description =
        updateData.description;
    }

    if (
      updateData.price !==
      undefined
    ) {
      updatePayload.price =
        updateData.price;
    }

    if (
      updateData.currency !==
      undefined
    ) {
      updatePayload.currency =
        updateData.currency;
    }

    if (
      updateData.spicy !==
      undefined
    ) {
      updatePayload.spicy =
        updateData.spicy;
    }

    if (
      updateData.image !==
      undefined
    ) {
      updatePayload.image =
        updateData.image;
    }

    if (
      updateData.available !==
      undefined
    ) {
      updatePayload.available =
        updateData.available;
    }

    if (
      updateData.featured !==
      undefined
    ) {
      updatePayload.featured =
        updateData.featured;
    }

    if (
      updateData.fasting !==
      undefined
    ) {
      updatePayload.fasting =
        updateData.fasting;
    }

    if (
      updateData.vegetarian !==
      undefined
    ) {
      updatePayload.vegetarian =
        updateData.vegetarian;
    }

    if (
      updateData.displayOrder !==
      undefined
    ) {
      updatePayload.display_order =
        updateData.displayOrder;
    }

    if (
      updateData.costInfo !==
      undefined
    ) {
      updatePayload.cost_info =
        updateData.costInfo;
    }

    updatePayload.updated_at =
      new Date().toISOString();

    let {
      data: updatedData,
      error,
    } = await supabase
      .from('menu_items')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    // Fallback if cost_info column does not exist yet
    if (error && (error.code === '42703' || error.message.includes('cost_info'))) {
      console.warn('cost_info column does not exist yet in menu_items. Retrying update without it.');
      delete updatePayload.cost_info;
      const retry = await supabase
        .from('menu_items')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single();
      updatedData = retry.data;
      error = retry.error;
    }

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
      id:
        updatedData.id,

      categoryId:
        updatedData.category_id,

      name:
        updatedData.name,

      description:
        updatedData.description,

      price:
        Number(updatedData.price),

      currency:
        updatedData.currency,

      spicy:
        updatedData.spicy,

      image:
        updatedData.image,

      available:
        updatedData.available,

      featured:
        updatedData.featured,

      fasting:
        updatedData.fasting,

      vegetarian:
        updatedData.vegetarian,

      displayOrder:
        updatedData.display_order,

      costInfo:
        updatedData.cost_info || null,

      createdAt:
        updatedData.created_at,

      updatedAt:
        updatedData.updated_at,
    };
  }

  // =========================================================
  // DELETE MENU ITEM
  // =========================================================

  static async deleteMenuItem(
    id: string
  ): Promise<void> {
    const { error } =
      await supabase
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

  // =========================================================
  // TOGGLE MENU ITEM AVAILABILITY
  // =========================================================

  static async toggleMenuItemAvailability(
    id: string
  ): Promise<MenuItem> {
    const item =
      await this.getMenuItem(id);

    if (!item) {
      throw new Error(
        `Menu item with id ${id} not found`
      );
    }

    return this.updateMenuItem(
      id,
      {
        available:
          !item.available,
      }
    );
  }

  // =========================================================
  // REORDER MENU ITEMS
  // =========================================================

  static async reorderMenuItems(
    items: Array<{
      id: string;
      displayOrder: number;
    }>
  ): Promise<void> {
    for (
      const {
        id,
        displayOrder,
      } of items
    ) {
      const { error } =
        await supabase
          .from('menu_items')
          .update({
            display_order:
              displayOrder,
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
    const { data, error } =
      await supabase
        .from('categories')
        .select('*')
        .order(
          'display_order',
          {
            ascending: true,
          }
        );

    if (error) {
      console.error(
        'Error reading categories from Supabase:',
        error
      );

      return [];
    }

    return (data ?? []).map(
      (category) => ({
        id:
          category.id,

        name:
          category.name,

        description:
          category.description,

        icon:
          category.icon,

        /**
         * Category type determines
         * which kitchen will prepare
         * its menu items.
         */
        type:
          category.type ===
          'drink'
            ? 'drink'
            : 'food',

        displayOrder:
          category.display_order,

        visible:
          category.visible,
      })
    );
  }

  // =========================================================
  // GET SINGLE CATEGORY
  // =========================================================

  static async getCategory(
    id: string
  ): Promise<MenuCategory | null> {
    const { data, error } =
      await supabase
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
      id:
        data.id,

      name:
        data.name,

      description:
        data.description,

      icon:
        data.icon,

      type:
        data.type ===
        'drink'
          ? 'drink'
          : 'food',

      displayOrder:
        data.display_order,

      visible:
        data.visible,
    };
  }

  // =========================================================
  // CREATE CATEGORY
  // =========================================================

  static async createCategory(
    data: unknown
  ): Promise<MenuCategory> {
    const createCategorySchema =
      menuCategorySchema.omit({
        id: true,
      });

    const validatedData =
      createCategorySchema.parse(
        data
      );

    const newCategory:
      MenuCategory = {
        ...validatedData,

        id:
          this.generateCategoryId(),

        displayOrder:
          validatedData.displayOrder ??
          0,

        visible:
          validatedData.visible ??
          true,

        /**
         * Default to food if
         * no valid type is supplied.
         */
        type:
          validatedData.type ===
          'drink'
            ? 'drink'
            : 'food',
      };

    if (newCategory.displayOrder !== undefined) {
      const targetOrder = Math.max(1, newCategory.displayOrder);
      const { data: allCats } = await supabase
        .from('categories')
        .select('id, display_order')
        .order('display_order', { ascending: true });

      if (allCats && allCats.length > 0) {
        const targetIndex = Math.min(Math.max(0, targetOrder - 1), allCats.length);
        allCats.splice(targetIndex, 0, { id: newCategory.id, display_order: targetOrder });
        for (let i = 0; i < allCats.length; i++) {
          const cat = allCats[i];
          const newOrder = i + 1;
          if (cat.id === newCategory.id) {
            newCategory.displayOrder = newOrder;
          } else if (cat.display_order !== newOrder) {
            await supabase.from('categories').update({ display_order: newOrder }).eq('id', cat.id);
          }
        }
      }
    }

    const { error } =
      await supabase
        .from('categories')
        .insert({
          id:
            newCategory.id,

          name:
            newCategory.name,

          description:
            newCategory.description ??
            null,

          icon:
            newCategory.icon ??
            null,

          /**
           * IMPORTANT:
           * Save food/drink type.
           */
          type:
            newCategory.type,

          display_order:
            newCategory.displayOrder,

          visible:
            newCategory.visible,
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

  // =========================================================
  // UPDATE CATEGORY
  // =========================================================

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
      updateCategorySchema.parse(
        data
      );

    const updatePayload:
      Record<string, unknown> = {};

    if (
      validatedData.name !==
      undefined
    ) {
      updatePayload.name =
        validatedData.name;
    }

    if (
      validatedData.description !==
      undefined
    ) {
      updatePayload.description =
        validatedData.description;
    }

    if (
      validatedData.icon !==
      undefined
    ) {
      updatePayload.icon =
        validatedData.icon;
    }

    /**
     * IMPORTANT:
     * Save category type when it
     * is changed.
     */
    if (
      validatedData.type !==
      undefined
    ) {
      updatePayload.type =
        validatedData.type;
    }

    if (
      validatedData.displayOrder !==
      undefined
    ) {
      const targetOrder = Math.max(1, validatedData.displayOrder);
      const { data: allCats } = await supabase
        .from('categories')
        .select('id, display_order')
        .order('display_order', { ascending: true });

      if (allCats && allCats.length > 0) {
        const others = allCats.filter((c) => c.id !== id);
        const targetIndex = Math.min(Math.max(0, targetOrder - 1), others.length);
        others.splice(targetIndex, 0, { id, display_order: targetOrder });

        for (let i = 0; i < others.length; i++) {
          const cat = others[i];
          const newOrder = i + 1;
          if (cat.id === id) {
            updatePayload.display_order = newOrder;
          } else if (cat.display_order !== newOrder) {
            await supabase.from('categories').update({ display_order: newOrder }).eq('id', cat.id);
          }
        }
      } else {
        updatePayload.display_order = targetOrder;
      }
    }

    if (
      validatedData.visible !==
      undefined
    ) {
      updatePayload.visible =
        validatedData.visible;
    }

    const {
      data: updatedData,
      error,
    } = await supabase
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
      id:
        updatedData.id,

      name:
        updatedData.name,

      description:
        updatedData.description,

      icon:
        updatedData.icon,

      type:
        updatedData.type ===
        'drink'
          ? 'drink'
          : 'food',

      displayOrder:
        updatedData.display_order,

      visible:
        updatedData.visible,
    };
  }

  // =========================================================
  // DELETE CATEGORY
  // =========================================================

  static async deleteCategory(
    id: string
  ): Promise<void> {
    const { error } =
      await supabase
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

  // =========================================================
  // REORDER CATEGORIES
  // =========================================================

  static async reorderCategories(
    categories: Array<{
      id: string;
      displayOrder: number;
    }>
  ): Promise<void> {
    for (
      const {
        id,
        displayOrder,
      } of categories
    ) {
      const { error } =
        await supabase
          .from('categories')
          .update({
            display_order:
              displayOrder,
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
      const data =
        await fs.readFile(
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

  // =========================================================
  // UPDATE RESTAURANT SETTINGS
  // =========================================================

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
 * Allows the UI/API to work with the repository
 * without depending directly on the storage
 * implementation.
 */
export interface IRepository {

  // =========================================================
  // MENU ITEMS
  // =========================================================

  getMenuItems():
    Promise<MenuItem[]>;

  getMenuItemsByCategory(
    categoryId: string
  ):
    Promise<MenuItem[]>;

  getMenuItem(
    id: string
  ):
    Promise<MenuItem | null>;

  getFeaturedItems():
    Promise<MenuItem[]>;

  searchMenuItems(
    query: string
  ):
    Promise<MenuItem[]>;

  createMenuItem(
    data: unknown
  ):
    Promise<MenuItem>;

  updateMenuItem(
    id: string,
    data: unknown
  ):
    Promise<MenuItem>;

  deleteMenuItem(
    id: string
  ):
    Promise<void>;

  toggleMenuItemAvailability(
    id: string
  ):
    Promise<MenuItem>;

  reorderMenuItems(
    items: Array<{
      id: string;
      displayOrder: number;
    }>
  ):
    Promise<void>;

  // =========================================================
  // CATEGORIES
  // =========================================================

  getCategories():
    Promise<MenuCategory[]>;

  getCategory(
    id: string
  ):
    Promise<MenuCategory | null>;

  createCategory(
    data: unknown
  ):
    Promise<MenuCategory>;

  updateCategory(
    id: string,
    data: unknown
  ):
    Promise<MenuCategory>;

  deleteCategory(
    id: string
  ):
    Promise<void>;

  // =========================================================
  // RESTAURANT SETTINGS
  // =========================================================

  getRestaurantSettings():
    Promise<RestaurantSettings>;

  updateRestaurantSettings(
    data: unknown
  ):
    Promise<RestaurantSettings>;
}

/**
 * Singleton repository instance
 */
export const repository:
  IRepository =
  JsonRepository;