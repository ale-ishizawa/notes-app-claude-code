import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit, log } from '@/lib/logger'

type Params = { params: { noteId: string } }

// GET /api/notes/[noteId]
export async function GET(_req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: note, error } = await supabase
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

  return NextResponse.json({ note })
}

// PATCH /api/notes/[noteId]
export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch existing note to verify access
  const { data: existing } = await supabase
    .from('notes')
    .select('id, org_id, created_by, visibility')
    .eq('id', params.noteId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  const { title, content, visibility, tags } = await request.json()

  const updates: Record<string, unknown> = { updated_by: user.id }
  if (title !== undefined) updates.title = title.trim()
  if (content !== undefined) updates.content = content
  if (visibility !== undefined) updates.visibility = visibility

  const { data: note, error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', params.noteId)
    .select()
    .single()

  if (error) {
    log('error', 'Failed to update note', { noteId: params.noteId, error: error.message })
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }

  // Replace tags if provided
  if (tags !== undefined) {
    await supabase.from('note_tags').delete().eq('note_id', params.noteId)
    if (tags.length > 0) {
      await supabase.from('note_tags').insert(
        tags.map((tag: string) => ({ note_id: params.noteId, tag: tag.trim().toLowerCase() }))
      )
    }
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

  const { data: existing } = await supabase
    .from('notes')
    .select('id, org_id')
    .eq('id', params.noteId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  const { error } = await supabase.from('notes').delete().eq('id', params.noteId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }

  await logAudit({
    org_id: existing.org_id, user_id: user.id, action: 'note.delete',
    resource_type: 'note', resource_id: params.noteId,
  })

  return NextResponse.json({ ok: true })
}
