import { NextRequest, NextResponse } from 'next/server';
import { repository } from '@/lib/menu/repository';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const item = await repository.updateMenuItem(id, body);

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('PUT /api/menu/[id] error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update menu item',
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    await repository.deleteMenuItem(id);

    return NextResponse.json({
      success: true,
      message: 'Menu item deleted successfully',
    });
  } catch (error) {
    console.error('DELETE /api/menu/[id] error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete menu item',
      },
      { status: 400 }
    );
  }
}