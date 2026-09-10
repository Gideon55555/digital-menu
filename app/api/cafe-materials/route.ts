import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

const DATA_FILE = path.join(process.cwd(), 'data', 'cafe_materials.json')

export type CafeMaterial = {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  condition: 'good' | 'fair' | 'needs_repair' | 'broken'
  location: string
  notes?: string | null
  created_at: string
  updated_at: string
}

async function readLocalFile(): Promise<CafeMaterial[]> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeLocalFile(items: CafeMaterial[]): Promise<void> {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8')
  } catch (e) {
    // Read-only filesystem in Vercel serverless
    console.warn('Cannot write to local file (read-only filesystem):', e)
  }
}

/* =========================================================
   GET /api/cafe-materials
========================================================= */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.toLowerCase().trim()
    const category = searchParams.get('category')?.trim()
    const condition = searchParams.get('condition')?.trim()

    let items: CafeMaterial[] = []
    let usedSupabase = false
    let tableNotCreated = false

    // Query Supabase
    const { data, error } = await supabase
      .from('cafe_materials')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      if (
        error.code === '42P01' ||
        error.message.includes('schema cache') ||
        error.message.includes('does not exist')
      ) {
        tableNotCreated = true
        // Fall back to local file for local dev demo
        items = await readLocalFile()
      } else {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    } else if (data) {
      items = data
      usedSupabase = true
    }

    // Filter
    if (search) {
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(search) ||
          item.category.toLowerCase().includes(search) ||
          (item.location && item.location.toLowerCase().includes(search)) ||
          (item.notes && item.notes.toLowerCase().includes(search))
      )
    }

    if (category && category !== 'all') {
      items = items.filter(
        (item) => item.category.toLowerCase() === category.toLowerCase()
      )
    }

    if (condition && condition !== 'all') {
      items = items.filter(
        (item) => item.condition.toLowerCase() === condition.toLowerCase()
      )
    }

    return NextResponse.json({
      success: true,
      data: items,
      source: usedSupabase ? 'supabase' : 'file',
      tableNotCreated,
    })
  } catch (error: any) {
    console.error('GET /api/cafe-materials error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch materials' },
      { status: 500 }
    )
  }
}

/* =========================================================
   POST /api/cafe-materials
========================================================= */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      category = 'Other',
      quantity = 1,
      unit = 'pcs',
      condition = 'good',
      location = 'Main Dining Area',
      notes = null,
    } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Item name is required' },
        { status: 400 }
      )
    }

    const newItem: CafeMaterial = {
      id: crypto.randomUUID(),
      name: name.trim(),
      category: category.trim(),
      quantity: Math.max(0, Number(quantity) || 0),
      unit: unit.trim() || 'pcs',
      condition: ['good', 'fair', 'needs_repair', 'broken'].includes(condition)
        ? condition
        : 'good',
      location: location.trim() || 'Main Dining Area',
      notes: notes?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Try Supabase first
    const { data, error } = await supabase
      .from('cafe_materials')
      .insert(newItem)
      .select()
      .single()

    if (!error && data) {
      return NextResponse.json({ success: true, data }, { status: 201 })
    }

    if (
      error &&
      (error.code === '42P01' ||
        error.message.includes('schema cache') ||
        error.message.includes('does not exist'))
    ) {
      // Local fallback for local dev
      const items = await readLocalFile()
      items.unshift(newItem)
      await writeLocalFile(items)

      return NextResponse.json({
        success: true,
        data: newItem,
        tableNotCreated: true,
      }, { status: 201 })
    }

    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create material' },
      { status: 500 }
    )
  } catch (error: any) {
    console.error('POST /api/cafe-materials error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create material' },
      { status: 500 }
    )
  }
}

/* =========================================================
   PUT /api/cafe-materials
========================================================= */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, category, quantity, unit, condition, location, notes } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Material id is required' },
        { status: 400 }
      )
    }

    const updates: Partial<CafeMaterial> = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updates.name = name.trim()
    if (category !== undefined) updates.category = category.trim()
    if (quantity !== undefined) updates.quantity = Math.max(0, Number(quantity) || 0)
    if (unit !== undefined) updates.unit = unit.trim()
    if (condition !== undefined) updates.condition = condition
    if (location !== undefined) updates.location = location.trim()
    if (notes !== undefined) updates.notes = notes?.trim() || null

    // Try Supabase first
    const { data, error } = await supabase
      .from('cafe_materials')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (!error && data) {
      return NextResponse.json({ success: true, data })
    }

    if (
      error &&
      (error.code === '42P01' ||
        error.message.includes('schema cache') ||
        error.message.includes('does not exist'))
    ) {
      // Local fallback for local dev
      const items = await readLocalFile()
      const index = items.findIndex((i) => i.id === id)
      if (index === -1) {
        return NextResponse.json(
          { success: false, error: 'Material not found' },
          { status: 404 }
        )
      }
      items[index] = { ...items[index], ...updates }
      await writeLocalFile(items)
      return NextResponse.json({ success: true, data: items[index], tableNotCreated: true })
    }

    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update material' },
      { status: 500 }
    )
  } catch (error: any) {
    console.error('PUT /api/cafe-materials error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update material' },
      { status: 500 }
    )
  }
}

/* =========================================================
   DELETE /api/cafe-materials?id=...
========================================================= */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Material id is required' },
        { status: 400 }
      )
    }

    // Try Supabase first
    const { error } = await supabase
      .from('cafe_materials')
      .delete()
      .eq('id', id)

    if (!error) {
      // Clean local file if present
      const items = await readLocalFile()
      await writeLocalFile(items.filter((i) => i.id !== id))
      return NextResponse.json({ success: true, message: 'Material deleted' })
    }

    if (
      error &&
      (error.code === '42P01' ||
        error.message.includes('schema cache') ||
        error.message.includes('does not exist'))
    ) {
      const items = await readLocalFile()
      const filtered = items.filter((i) => i.id !== id)
      await writeLocalFile(filtered)
      return NextResponse.json({ success: true, message: 'Material deleted' })
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  } catch (error: any) {
    console.error('DELETE /api/cafe-materials error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete material' },
      { status: 500 }
    )
  }
}
