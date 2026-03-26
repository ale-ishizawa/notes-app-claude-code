import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/logger'

// POST /api/notes/[noteId]/share — add share
export async function POST(request: Request, { params }: { params: { noteId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

  // Verify note exists and is accessible
  const { data: note } = await supabase
    .from('notes')
    .select('id, org_id, created_by, visibility')
    .eq('id', params.noteId)
    .single()

  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  // Verify target user is in same org
  const { data: targetMembership } = await supabase
    .from('organization_members')
    .select('id')
    .eq('org_id', note.org_id)
    .eq('user_id', userId)
    .single()

  if (!targetMembership) {
    return NextResponse.json({ error: 'User is not a member of this organization' }, { status: 400 })
  }

  const { error } = await supabase
    .from('note_shares')
    .insert({ note_id: params.noteId, shared_with: userId })

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Already shared' }, { status: 409 })
    return NextResponse.json({ error: 'Failed to share note' }, { status: 500 })
  }

  await logAudit({
    org_id: note.org_id, user_id: user.id, action: 'note.share',
    resource_type: 'note', resource_id: params.noteId,
    metadata: { shared_with: userId },
  })

  return NextResponse.json({ ok: true })
}

// DELETE /api/notes/[noteId]/share — remove share
export async function DELETE(request: Request, { params }: { params: { noteId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await request.json()

  const { data: note } = await supabase.from('notes').select('id, org_id').eq('id', params.noteId).single()
  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  await supabase.from('note_shares').delete()
    .eq('note_id', params.noteId)
    .eq('shared_with', userId)

  await logAudit({
    org_id: note.org_id, user_id: user.id, action: 'note.unshare',
    resource_type: 'note', resource_id: params.noteId,
    metadata: { removed_user: userId },
  })

  return NextResponse.json({ ok: true })
}
