import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit, log } from '@/lib/logger'

// GET /api/notes?orgId=...&search=...&tag=...&visibility=...
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('orgId')
  const search = searchParams.get('search')
  const tag = searchParams.get('tag')
  const visibility = searchParams.get('visibility')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  let query = supabase
    .from('notes')
    .select(`
      id, org_id, title, content, visibility, created_by, updated_by, version, created_at, updated_at,
      creator:profiles!notes_created_by_fkey(id, full_name, email),
      tags:note_tags(id, tag)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    // Full-text search via tsvector
    query = query.textSearch('search_vector', search, { type: 'plain', config: 'english' })
  }

  if (visibility) {
    query = query.eq('visibility', visibility)
  }

  const { data, error, count } = await query

  if (error) {
    log('error', 'Failed to list notes', { orgId, error: error.message })
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }

  // Filter by tag client-side (simpler than a join filter for now)
  const notes = tag
    ? data?.filter((n) => n.tags?.some((t: { tag: string }) => t.tag === tag)) ?? []
    : data ?? []

  return NextResponse.json({ notes, pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) } })
}

// POST /api/notes — create note
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId, title, content = '', visibility = 'private', tags = [] } = await request.json()
  if (!orgId || !title?.trim()) {
    return NextResponse.json({ error: 'orgId and title are required' }, { status: 400 })
  }
  if (title.trim().length > 255) {
    return NextResponse.json({ error: 'Title must be 255 characters or fewer' }, { status: 400 })
  }
  if (typeof content === 'string' && content.length > 500_000) {
    return NextResponse.json({ error: 'Content must be 500,000 characters or fewer' }, { status: 400 })
  }

  // Check membership + role (not viewer)
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'viewer') {
    await logAudit({ org_id: orgId, user_id: user.id, action: 'permission.denied', metadata: { attempted: 'note.create' } })
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { data: note, error } = await supabase
    .from('notes')
    .insert({ org_id: orgId, title: title.trim(), content, visibility, created_by: user.id, updated_by: user.id })
    .select()
    .single()

  if (error) {
    log('error', 'Failed to create note', { orgId, error: error.message })
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }

  // Insert tags
  if (tags.length > 0) {
    await supabase.from('note_tags').insert(
      tags.map((tag: string) => ({ note_id: note.id, tag: tag.trim().toLowerCase() }))
    )
  }

  await logAudit({ org_id: orgId, user_id: user.id, action: 'note.create', resource_type: 'note', resource_id: note.id, metadata: { title, visibility } })

  return NextResponse.json({ note }, { status: 201 })
}
