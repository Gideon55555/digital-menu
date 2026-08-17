import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

type MenuItem = {
  id: string;
  categoryId: string;
  name: {
    en: string;
    am?: string;
  };
  description?: {
    en: string;
    am?: string;
  };
  price: number;
  currency: string;
  image?: string | null;
  available: boolean;
  featured: boolean;
  fasting: boolean;
  vegetarian: boolean;
  spicy?: boolean;
  ingredients?: string[];
  allergens?: string[];
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    transport: ws,
  },
});

async function migrate() {
  const filePath = path.join(process.cwd(), 'data', 'menu.json');

  const file = fs.readFileSync(filePath, 'utf-8');
  const menuItems: MenuItem[] = JSON.parse(file);

  console.log(`Found ${menuItems.length} menu items.`);

  const rows = menuItems.map((item) => ({
    id: item.id,
    category_id: item.categoryId,
    name: item.name,
    description: item.description ?? {
      en: '',
      am: '',
    },
    price: item.price,
    currency: item.currency,
    image: item.image ?? null,
    available: item.available,
    featured: item.featured,
    fasting: item.fasting,
    vegetarian: item.vegetarian,
    spicy: item.spicy ?? false,
    ingredients: item.ingredients ?? [],
    allergens: item.allergens ?? [],
    display_order: item.displayOrder,
    created_at: item.createdAt ?? new Date().toISOString(),
    updated_at: item.updatedAt ?? new Date().toISOString(),
  }));

  console.log('Migrating menu items...');

  const { data, error } = await supabase
    .from('menu_items')
    .upsert(rows, {
      onConflict: 'id',
    })
    .select();

  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  console.log(`Successfully migrated ${data?.length ?? 0} menu items.`);
}

migrate();