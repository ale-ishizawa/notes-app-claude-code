import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit, log } from '@/lib/logger'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

// Simple in-memory rate limiter: max 5 requests per user per 60 seconds
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000
const rateLimitMap = new Map<string, { count: number; windowStart: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// POST /api/notes/[noteId]/summarize
export async function POST(_req: Request, { params }: { params: { noteId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Fetch note
  const { data: note } = await admin
    .from('notes')
    .select('id, org_id, title, content, visibility')
    .eq('id', params.noteId)
    .single()

  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  // Check user is not a viewer
  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', note.org_id)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'viewer') {
    await logAudit({ org_id: note.org_id, user_id: user.id, action: 'permission.denied', metadata: { attempted: 'ai.summary_request', note_id: params.noteId } })
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: `Rate limit exceeded: max ${RATE_LIMIT} AI summary requests per minute` },
      { status: 429 }
    )
  }

  await logAudit({
    org_id: note.org_id, user_id: user.id, action: 'ai.summary_request',
    resource_type: 'note', resource_id: params.noteId,
  })

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that analyzes notes and produces structured summaries.
Return a JSON object with exactly these fields:
{
  "summary": "A 2-3 sentence summary of the note",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "action_items": ["Action 1", "Action 2"],
  "topics": ["topic1", "topic2"]
}
Be concise. key_points and action_items should have 1-5 items each. topics should be 1-5 single words.`,
        },
        {
          role: 'user',
          content: `Title: ${note.title}\n\nContent:\n${note.content || '(empty)'}`,
        },
      ],
      max_tokens: 600,
    })

    const rawContent = completion.choices[0]?.message?.content ?? '{}'
    let summaryContent
    try {
      summaryContent = JSON.parse(rawContent)
    } catch {
      summaryContent = { summary: rawContent, key_points: [], action_items: [], topics: [] }
    }

    const tokensUsed = completion.usage?.total_tokens ?? null

    // Delete any previous non-accepted summaries for this note
    await admin.from('ai_summaries')
      .delete()
      .eq('note_id', params.noteId)
      .neq('status', 'accepted')

    const { data: summary, error: insertError } = await admin
      .from('ai_summaries')
      .insert({
        note_id: params.noteId,
        org_id: note.org_id,
        summary: summaryContent,
        status: 'completed',
        requested_by: user.id,
        model: 'gpt-4o-mini',
        tokens_used: tokensUsed,
      })
      .select()
      .single()

    if (insertError) throw insertError

    await logAudit({
      org_id: note.org_id, user_id: user.id, action: 'ai.summary_complete',
      resource_type: 'note', resource_id: params.noteId,
      metadata: { tokens_used: tokensUsed, model: 'gpt-4o-mini' },
    })

    return NextResponse.json({ summary })
  } catch (err) {
    log('error', 'OpenAI summarize failed', { noteId: params.noteId, error: String(err) })
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
