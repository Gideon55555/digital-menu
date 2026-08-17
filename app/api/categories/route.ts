import { NextResponse } from 'next/server';
import { repository } from '@/lib/menu/repository';

export async function GET() {
  try {
    const categories = await repository.getCategories();

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('GET /api/categories error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load categories',
      },
      { status: 500 }
    );
  }
}
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const category = await repository.createCategory(body);

    return NextResponse.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('POST /api/categories error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create category',
      },
      { status: 400 }
    );
  }
}