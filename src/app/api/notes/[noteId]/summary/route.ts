import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/notes/[noteId]/summary — fetch latest summary
export async function GET(_req: Request, { params }: { params: { noteId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: summary } = await admin
    .from('ai_summaries')
    .select('*')
    .eq('note_id', params.noteId)
    .neq('status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ summary: summary ?? null })
}
