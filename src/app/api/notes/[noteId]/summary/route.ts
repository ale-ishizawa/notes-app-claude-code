import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/notes/[noteId]/summary — fetch latest summary
export async function GET(_req: Request, { params }: { params: { noteId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: summary } = await supabase
    .from('ai_summaries')
    .select('*')
    .eq('note_id', params.noteId)
    .neq('status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ summary: summary ?? null })
}
