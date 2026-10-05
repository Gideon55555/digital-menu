import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/* =========================================================
   GET /api/daily-expenses
   Query params:
     - date   (YYYY-MM-DD) — defaults to today
     - from   (YYYY-MM-DD) — range start
     - to     (YYYY-MM-DD) — range end
     - period (today | week | month | year)
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const period = searchParams.get('period') || 'today'
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined

    const { start, end } = getDateRange(period, from, to)

    const { data, error } = await supabase
      .from('daily_expenses')
      .select('*')
      .gte('expense_date', start.toISOString().split('T')[0])
      .lte('expense_date', end.toISOString().split('T')[0])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Daily expenses fetch error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Calculate totals
    const expenses = data || []
    const totalExpenses = expenses.reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0
    )

    return NextResponse.json({
      success: true,
      data: {
        expenses,
        totalExpenses,
      },
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
      },
      { status: 500 }
    )
  }
}

/* =========================================================
   POST /api/daily-expenses
   Body: { description, amount, category, expense_date? }
========================================================= */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      description,
      amount,
      category = 'general',
      expense_date,
    } = body

    if (!description || !description.trim()) {
      return NextResponse.json(
        { success: false, error: 'Description is required' },
        { status: 400 }
      )
    }

    const expenseAmount = Number(amount)
    if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    const dateValue = expense_date || new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('daily_expenses')
      .insert({
        description: description.trim(),
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
   Body: { id }
========================================================= */

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

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
