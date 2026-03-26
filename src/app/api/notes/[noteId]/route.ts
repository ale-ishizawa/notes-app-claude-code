import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit, log } from '@/lib/logger'

type Params = { params: { noteId: string } }

// GET /api/notes/[noteId]
export async function GET(_req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: note, error } = await admin
    .from('notes')
    .select(`
      id, org_id, title, content, visibility, created_by, updated_by, version, created_at, updated_at,
      creator:profiles!notes_created_by_fkey(id, full_name, email),
      updater:profiles!notes_updated_by_fkey(id, full_name, email),
      tags:note_tags(id, tag),
      shares:note_shares(id, shared_with, profile:profiles(id, full_name, email))
    `)
    .eq('id', params.noteId)
    .single()

  if (error || !note) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  // Enforce access: user must be org member
  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', note.org_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  // Enforce visibility
  if (note.visibility === 'private' && note.created_by !== user.id) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }
  if (note.visibility === 'shared' && note.created_by !== user.id) {
    const { data: share } = await admin
      .from('note_shares')
      .select('id')
      .eq('note_id', note.id)
      .eq('shared_with', user.id)
      .single()
    if (!share) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  return NextResponse.json({ note })
}

// PATCH /api/notes/[noteId]
export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch existing note to verify access
  const { data: existing } = await admin
    .from('notes')
    .select('id, org_id, created_by, visibility')
    .eq('id', params.noteId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  const { title, content, visibility, tags } = await request.json()

  if (title !== undefined && title.trim().length > 255) {
    return NextResponse.json({ error: 'Title must be 255 characters or fewer' }, { status: 400 })
  }
  if (content !== undefined && typeof content === 'string' && content.length > 500_000) {
    return NextResponse.json({ error: 'Content must be 500,000 characters or fewer' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_by: user.id }
  if (title !== undefined) updates.title = title.trim()
  if (content !== undefined) updates.content = content
  if (visibility !== undefined) updates.visibility = visibility

  // Update tags BEFORE note update so trg_note_search_vector sees the correct tag set (BUG-006)
  if (tags !== undefined) {
    await admin.from('note_tags').delete().eq('note_id', params.noteId)
    if (tags.length > 0) {
      await admin.from('note_tags').insert(
        tags.map((tag: string) => ({ note_id: params.noteId, tag: tag.trim().toLowerCase() }))
      )
    }
  }

  const { data: note, error } = await admin
    .from('notes')
    .update(updates)
    .eq('id', params.noteId)
    .select()
    .single()

  if (error) {
    log('error', 'Failed to update note', { noteId: params.noteId, error: error.message })
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }

  await logAudit({
    org_id: existing.org_id, user_id: user.id, action: 'note.update',
    resource_type: 'note', resource_id: params.noteId,
    metadata: { changed_fields: Object.keys(updates) },
  })

  return NextResponse.json({ note })
}

// DELETE /api/notes/[noteId]
export async function DELETE(_req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('notes')
    .select('id, org_id')
    .eq('id', params.noteId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  const { error } = await admin.from('notes').delete().eq('id', params.noteId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }

  await logAudit({
    org_id: existing.org_id, user_id: user.id, action: 'note.delete',
    resource_type: 'note', resource_id: params.noteId,
  })

  return NextResponse.json({ ok: true })
}
