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

    const category = await repository.updateCategory(id, body);

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('PUT /api/categories/[id] error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update category',
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    await repository.deleteCategory(id);

    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    console.error('DELETE /api/categories/[id] error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete category',
      },
      { status: 400 }
    );
  }
}