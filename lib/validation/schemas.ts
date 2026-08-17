import { z } from 'zod';

// ============================================================
// Language validation
// ============================================================

export const languageSchema = z.enum(['en', 'am']);

// ============================================================
// Localized string validation
// ============================================================

export const localizedStringSchema = z.object({
  en: z.string().min(1, 'English text is required'),
  am: z.string().optional(),
});

// ============================================================
// Menu Category validation
// ============================================================

/**
 * Full category schema.
 *
 * Used when reading/validating an existing category that already
 * has an ID.
 */
export const menuCategorySchema = z.object({
  id: z.string().min(1, 'Category ID is required'),

  name: localizedStringSchema,

  description: localizedStringSchema.optional(),

  icon: z.string().optional(),

  displayOrder: z
    .number()
    .int()
    .min(0, 'Display order cannot be negative'),

  visible: z.boolean().default(true),
});

export type MenuCategoryInput = z.infer<typeof menuCategorySchema>;

/**
 * Create category schema.
 *
 * ID is NOT required because the repository generates it.
 */
export const createMenuCategorySchema = menuCategorySchema.omit({
  id: true,
});

export type CreateMenuCategoryInput = z.infer<
  typeof createMenuCategorySchema
>;

/**
 * Update category schema.
 *
 * ID is NOT included because the ID comes from:
 *
 * /api/categories/[id]
 *
 * Every other field is optional so we can update only
 * one property, such as "visible".
 */
export const updateMenuCategorySchema =
  createMenuCategorySchema.partial();

export type UpdateMenuCategoryInput = z.infer<
  typeof updateMenuCategorySchema
>;

// ============================================================
// Menu Item validation
// ============================================================

export const menuItemSchema = z.object({
  id: z.string().min(1),

  categoryId: z.string().min(1, 'Category is required'),

  name: localizedStringSchema,

  description: localizedStringSchema,

  price: z.number().positive('Price must be positive'),

  currency: z.string().default('ETB'),

  image: z.string().nullable().optional(),

  available: z.boolean().default(true),

  featured: z.boolean().default(false),

  fasting: z.boolean().default(false),

  vegetarian: z.boolean().default(false),

  spicy: z.boolean().default(false),

  ingredients: z.array(z.string()).optional(),

  allergens: z.array(z.string()).optional(),

  displayOrder: z
    .number()
    .int()
    .min(0),

  createdAt: z.string().optional(),

  updatedAt: z.string().optional(),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;

// Create menu item (without ID and timestamps)
export const createMenuItemSchema = menuItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateMenuItemInput = z.infer<
  typeof createMenuItemSchema
>;

// Update menu item
export const updateMenuItemSchema =
  createMenuItemSchema.partial();

export type UpdateMenuItemInput = z.infer<
  typeof updateMenuItemSchema
>;

// ============================================================
// Catering Service validation
// ============================================================

export const cateringServiceSchema = z.object({
  id: z.string().min(1),

  name: localizedStringSchema,

  description: localizedStringSchema,

  price: z.number().positive().optional(),

  serviceTypes: z.array(z.string()),

  image: z.string().optional(),

  featured: z.boolean().default(false),

  displayOrder: z
    .number()
    .int()
    .min(0),
});

export type CateringServiceInput = z.infer<
  typeof cateringServiceSchema
>;

// ============================================================
// Opening Hours validation
// ============================================================

export const openingHoursSchema = z.object({
  monday: z.string().optional(),

  tuesday: z.string().optional(),

  wednesday: z.string().optional(),

  thursday: z.string().optional(),

  friday: z.string().optional(),

  saturday: z.string().optional(),

  sunday: z.string().optional(),

  notes: localizedStringSchema.optional(),
});

export type OpeningHoursInput = z.infer<
  typeof openingHoursSchema
>;

// ============================================================
// Restaurant Settings validation
// ============================================================

export const restaurantSettingsSchema = z.object({
  id: z.string().default('default'),

  name: localizedStringSchema,

  tagline: localizedStringSchema.optional(),

  description: localizedStringSchema.optional(),

  logo: z.string().optional(),

  coverImage: z.string().optional(),

  phone: z.string().min(1, 'Phone is required'),

  whatsapp: z.string().optional(),

  email: z.string().email().optional(),

  address: localizedStringSchema,

  googleMapsUrl: z.string().optional(),

  openingHours: openingHoursSchema,

  currency: z.string().default('ETB'),

  defaultLanguage: languageSchema.default('en'),

  availableLanguages: z
    .array(languageSchema)
    .default(['en', 'am']),

  social: z
    .object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      tiktok: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),

  catering: z
    .object({
      available: z.boolean().default(true),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      services: z.array(z.string()).default([]),
    })
    .optional(),
});

export type RestaurantSettingsInput = z.infer<
  typeof restaurantSettingsSchema
>;

// ============================================================
// Admin Login validation
// ============================================================

export const adminLoginSchema = z.object({
  email: z.string().email('Valid email required'),

  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
});

export type AdminLoginInput = z.infer<
  typeof adminLoginSchema
>;

// ============================================================
// Admin Password Change validation
// ============================================================

export const adminPasswordChangeSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Current password required'),

    newPassword: z
      .string()
      .min(6, 'Password must be at least 6 characters'),

    confirmPassword: z
      .string()
      .min(6, 'Confirm password is required'),
  })
  .refine(
    (data) => data.newPassword === data.confirmPassword,
    {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }
  );

export type AdminPasswordChangeInput = z.infer<
  typeof adminPasswordChangeSchema
>;