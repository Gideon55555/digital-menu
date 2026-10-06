import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function formatYMD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/* =========================================================
   GET /api/daily-expenses
   Query params:
     - date   (YYYY-MM-DD) — defaults to today
     - from   (YYYY-MM-DD) — range start
     - to     (YYYY-MM-DD) — range end
     - period (today | week | month | year | all | custom)
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const period = searchParams.get('period') || 'today'
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined

    let query = supabase.from('daily_expenses').select('*')

    if (period !== 'all') {
      const { start, end } = getDateRange(period, from, to)
      const startDateStr = formatYMD(start)
      const endDateStr = formatYMD(end)
      query = query.gte('expense_date', startDateStr).lte('expense_date', endDateStr)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Daily expenses fetch error:', error)
      return NextResponse.json({
        success: true,
        data: [],
        expenses: [],
        totalExpenses: 0,
        total: 0,
        warning: 'Table daily_expenses not ready or empty. Please run SQL script.',
      })
    }

    const expenses = data || []
    const totalExpenses = expenses.reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0
    )

    return NextResponse.json({
      success: true,
      data: expenses,
      expenses,
      totalExpenses,
      total: totalExpenses,
    })
  } catch (error) {
    console.error('Daily expenses error:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load daily expenses',
        expenses: [],
        totalExpenses: 0,
        total: 0,
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   POST /api/daily-expenses
   Body: { description, item, amount, price, category, expense_date? }
========================================================= */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Accept item or description
    const itemTitle = body.item || body.description
    // Accept price or amount
    const costValue = body.price !== undefined ? body.price : body.amount
    const category = body.category || 'general'
    const expense_date = body.expense_date

    if (!itemTitle || !String(itemTitle).trim()) {
      return NextResponse.json(
        { success: false, error: 'Item description is required' },
        { status: 400 }
      )
    }

    const expenseAmount = Number(costValue)
    if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Price/Amount must be a positive number' },
        { status: 400 }
      )
    }

    const dateValue = expense_date || formatYMD(new Date())

    const { data, error } = await supabase
      .from('daily_expenses')
      .insert({
        description: String(itemTitle).trim(),
        amount: expenseAmount,
        category: category || 'general',
        expense_date: dateValue,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Create expense error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Create expense error:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create expense',
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   DELETE /api/daily-expenses
   Supports body { id } or query param ?id=...
========================================================= */

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let id = searchParams.get('id')

    if (!id) {
      try {
        const body = await request.json()
        id = body?.id
      } catch (e) {
        // no body provided
      }
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Expense id is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('daily_expenses')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete expense error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Expense deleted',
    })
  } catch (error) {
    console.error('Delete expense error:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete expense',
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   PUT /api/daily-expenses
   Body: { id, description, item, amount, price, category, expense_date }
========================================================= */

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Expense ID is required for updating' },
        { status: 400 }
      )
    }

    const itemTitle = body.item || body.description
    const costValue = body.price !== undefined ? body.price : body.amount
    const category = body.category || 'general'
    const expense_date = body.expense_date

    if (!itemTitle || !String(itemTitle).trim()) {
      return NextResponse.json(
        { success: false, error: 'Item description is required' },
        { status: 400 }
      )
    }

    const expenseAmount = Number(costValue)
    if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Price/Amount must be a positive number' },
        { status: 400 }
      )
    }

    let { data, error } = await supabase
      .from('daily_expenses')
      .update({
        description: String(itemTitle).trim(),
        amount: expenseAmount,
        category: category || 'general',
        expense_date: expense_date || formatYMD(new Date()),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.warn('Update expense failed with primary fields, retrying without updated_at:', error.message)
      const fallback = await supabase
        .from('daily_expenses')
        .update({
          description: String(itemTitle).trim(),
          amount: expenseAmount,
          category: category || 'general',
          expense_date: expense_date || formatYMD(new Date()),
        })
        .eq('id', id)
        .select()
        .single()

      data = fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('Update expense error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('Update expense error:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update expense',
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   DATE RANGE HELPER
========================================================= */

function getDateRange(period: string, from?: string, to?: string) {
  const now = new Date()

  if (period === 'custom' && from) {
    const start = new Date(`${from}T00:00:00`)
    const end = to ? new Date(`${to}T23:59:59.999`) : new Date(`${from}T23:59:59.999`)
    return { start, end }
  }

  if (period === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }

  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1)
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    return { start, end }
  }

  // TODAY
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}
