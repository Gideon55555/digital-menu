import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/menu/repository';

export async function GET() {
  try {
    const items = await repository.getMenuItems();

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('GET /api/menu error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load menu items',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const item = await repository.createMenuItem(body);

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('POST /api/menu error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create menu item',
      },
      { status: 400 }
    );
  }
}