import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit, log } from '@/lib/logger'

// GET /api/orgs — list user's orgs
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('organization_members')
    .select('role, organization:organizations(id, name, slug, created_by, created_at, updated_at)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    log('error', 'Failed to list orgs', { userId: user.id, error: error.message })
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  }

  return NextResponse.json({ orgs: data })
}

// POST /api/orgs — create new org
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await request.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
  }

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  // Use admin client for inserts — RLS auth.uid() can be NULL server-side for freshly
  // signed-up users whose JWT hasn't fully propagated into the cookie store yet.
  // Auth is already verified above via supabase.auth.getUser().
  const admin = createAdminClient()

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: name.trim(), slug, created_by: user.id })
    .select()
    .single()

  if (orgError) {
    log('error', 'Failed to create org', { userId: user.id, error: orgError.message })
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
  }

  // Add creator as owner (admin client — same reason as above)
  const { error: memberError } = await admin
    .from('organization_members')
    .insert({ org_id: org.id, user_id: user.id, role: 'owner' })

  if (memberError) {
    log('error', 'Failed to add owner membership', { userId: user.id, orgId: org.id, error: memberError.message })
    return NextResponse.json({ error: 'Failed to set up organization membership' }, { status: 500 })
  }

  await logAudit({
    org_id: org.id,
    user_id: user.id,
    action: 'org.create',
    resource_type: 'organization',
    resource_id: org.id,
    metadata: { name: org.name },
  })

  return NextResponse.json({ org }, { status: 201 })
}
