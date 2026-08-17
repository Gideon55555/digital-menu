import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('restaurant_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('GET /api/restaurant error:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to load restaurant settings',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('GET /api/restaurant error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load restaurant settings',
      },
      { status: 500 }
    );
  }
}