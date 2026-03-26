import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/notes/[noteId]/versions
export async function GET(_req: Request, { params }: { params: { noteId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS on note_versions checks note access via notes RLS
  const { data: versions, error } = await supabase
    .from('note_versions')
    .select(`
      id, note_id, version, title, content, change_summary, created_at,
      changer:profiles!note_versions_changed_by_fkey(id, full_name, email)
    `)
    .eq('note_id', params.noteId)
    .order('version', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 })
  }

  return NextResponse.json({ versions: versions ?? [] })
}
