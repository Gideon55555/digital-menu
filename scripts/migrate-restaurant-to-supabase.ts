import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

dotenv.config({ path: '.env.local' });

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
  const filePath = path.join(
    process.cwd(),
    'data',
    'restaurant.json'
  );

  const file = fs.readFileSync(filePath, 'utf-8');
  const restaurant = JSON.parse(file);

  console.log('Migrating restaurant settings...');

  const row = {
    id: restaurant.id,
    name: restaurant.name,
    tagline: restaurant.tagline ?? null,
    description: restaurant.description ?? null,
    logo: restaurant.logo ?? null,
    cover_image: restaurant.coverImage ?? null,
    phone: restaurant.phone,
    whatsapp: restaurant.whatsapp ?? null,
    email: restaurant.email ?? null,
    address: restaurant.address,
    google_maps_url: restaurant.googleMapsUrl ?? null,
    opening_hours: restaurant.openingHours,
    currency: restaurant.currency,
    default_language: restaurant.defaultLanguage,
    available_languages: restaurant.availableLanguages,
    social: restaurant.social ?? null,
    catering: restaurant.catering ?? null,
  };

  const { data, error } = await supabase
    .from('restaurant_settings')
    .upsert(row, {
      onConflict: 'id',
    })
    .select()
    .single();

  if (error) {
    console.error('Restaurant settings migration failed:', error);
    process.exit(1);
  }

  console.log('Successfully migrated restaurant settings.');
  console.log(data);
}

migrate();