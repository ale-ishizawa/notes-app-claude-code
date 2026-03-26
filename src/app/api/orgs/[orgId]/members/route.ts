import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit, log } from '@/lib/logger'

// GET /api/orgs/[orgId]/members
export async function GET(_req: Request, { params }: { params: { orgId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('organization_members')
    .select('id, role, created_at, profile:profiles(id, email, full_name, avatar_url)')
    .eq('org_id', params.orgId)
    .order('created_at', { ascending: true })

  if (error) {
    log('error', 'Failed to list org members', { orgId: params.orgId, error: error.message })
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }

  return NextResponse.json({ members: data })
}

// POST /api/orgs/[orgId]/members — invite by email
export async function POST(request: Request, { params }: { params: { orgId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Check requester is owner/admin
  const { data: myMembership } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', params.orgId)
    .eq('user_id', user.id)
    .single()

  if (!myMembership || !['owner', 'admin'].includes(myMembership.role)) {
    await logAudit({
      org_id: params.orgId, user_id: user.id, action: 'permission.denied',
      metadata: { attempted: 'org.invite' },
    })
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { email, role = 'member' } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  // Look up user by email
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'User not found. They must sign up first.' }, { status: 404 })
  }

  const { data: member, error } = await admin
    .from('organization_members')
    .insert({ org_id: params.orgId, user_id: profile.id, role })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'User is already a member' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }

  await logAudit({
    org_id: params.orgId, user_id: user.id, action: 'org.invite',
    resource_type: 'organization_member', resource_id: member.id,
    metadata: { invited_user_id: profile.id, role },
  })

  return NextResponse.json({ member }, { status: 201 })
}
