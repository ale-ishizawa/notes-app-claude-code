import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { OrgProvider } from '@/components/org/org-provider'
import { Sidebar } from '@/components/layout/sidebar'
import type { Organization, OrgRole } from '@/types/database'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all orgs for this user
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('role, organization:organizations(id, name, slug, created_by, created_at, updated_at)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const orgs: { org: Organization; role: OrgRole }[] = (memberships ?? [])
    .filter((m): m is typeof m & { organization: Organization } => m.organization != null)
    .map((m) => ({ org: m.organization as Organization, role: m.role as OrgRole }))

  // Resolve active org from cookie or first org
  const cookieStore = await cookies()
  const activeOrgId = cookieStore.get('active_org_id')?.value
  const activeEntry = orgs.find((o) => o.org.id === activeOrgId) ?? orgs[0] ?? null

  return (
    <OrgProvider
      initialOrg={activeEntry?.org ?? null}
      initialRole={activeEntry?.role ?? null}
      orgs={orgs}
    >
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-gradient-to-br from-amber-50 via-orange-50 to-cyan-50">
          {children}
        </main>
      </div>
    </OrgProvider>
  )
}
