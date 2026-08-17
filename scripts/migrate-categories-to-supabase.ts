import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

dotenv.config({ path: '.env.local' });

type Category = {
  id: string;
  name: {
    en: string;
    am?: string;
  };
  description?: {
    en: string;
    am?: string;
  };
  icon?: string;
  displayOrder: number;
  visible: boolean;
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
  const filePath = path.join(process.cwd(), 'data', 'categories.json');

  const file = fs.readFileSync(filePath, 'utf-8');
  const categories: Category[] = JSON.parse(file);

  console.log(`Found ${categories.length} categories.`);

  const rows = categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description ?? {
      en: '',
      am: '',
    },
    icon: category.icon ?? null,
    display_order: category.displayOrder,
    visible: category.visible,
  }));

  console.log('Migrating categories...');

  const { data, error } = await supabase
    .from('categories')
    .upsert(rows, {
      onConflict: 'id',
    })
    .select();

  if (error) {
    console.error('Category migration failed:', error);
    process.exit(1);
  }

  console.log(
    `Successfully migrated ${data?.length ?? 0} categories.`
  );
}

migrate();