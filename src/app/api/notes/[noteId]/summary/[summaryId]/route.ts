import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/logger'

// PATCH /api/notes/[noteId]/summary/[summaryId] — accept or reject
export async function PATCH(request: Request, { params }: { params: { noteId: string; summaryId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action } = await request.json()
  if (!['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be accept or reject' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: summary } = await admin
    .from('ai_summaries')
    .select('id, org_id')
    .eq('id', params.summaryId)
    .single()

  if (!summary) return NextResponse.json({ error: 'Summary not found' }, { status: 404 })

  const status = action === 'accept' ? 'accepted' : 'rejected'
  const { error } = await admin
    .from('ai_summaries')
    .update({ status, accepted_by: action === 'accept' ? user.id : null })
    .eq('id', params.summaryId)

  if (error) return NextResponse.json({ error: 'Failed to update summary' }, { status: 500 })

  await logAudit({
    org_id: summary.org_id, user_id: user.id,
    action: action === 'accept' ? 'ai.summary_accept' : 'ai.summary_reject',
    resource_type: 'ai_summary', resource_id: params.summaryId,
  })

  return NextResponse.json({ ok: true })
}
