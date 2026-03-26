import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/audit?orgId=...&limit=...
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('orgId')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)

  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  // RLS on audit_logs already checks owner/admin role
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, resource_type, resource_id, metadata, created_at, user:profiles(id, full_name, email)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })

  return NextResponse.json({ logs: data ?? [] })
}
