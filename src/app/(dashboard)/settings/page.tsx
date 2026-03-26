'use client'

import { useEffect, useState, useCallback } from 'react'
import { useOrg } from '@/hooks/use-org'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Member {
  id: string
  role: string
  profile: { id: string; full_name: string; email: string }
}

export default function SettingsPage() {
  const { org, role } = useOrg()
  const [members, setMembers] = useState<Member[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; action: string; created_at: string; metadata: Record<string, unknown> }>>([])

  const isAdminOrOwner = role && ['owner', 'admin'].includes(role)

  const fetchMembers = useCallback(async () => {
    if (!org) return
    const res = await fetch(`/api/orgs/${org.id}/members`)
    const data = await res.json()
    setMembers(data.members ?? [])
  }, [org])

  const fetchAuditLogs = useCallback(async () => {
    if (!org || !isAdminOrOwner) return
    const res = await fetch(`/api/audit?orgId=${org.id}&limit=20`)
    if (res.ok) {
      const data = await res.json()
      setAuditLogs(data.logs ?? [])
    }
  }, [org, isAdminOrOwner])

  useEffect(() => { fetchMembers() }, [fetchMembers])
  useEffect(() => { fetchAuditLogs() }, [fetchAuditLogs])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!org) return
    setInviting(true); setInviteError(null); setInviteSuccess(false)

    const res = await fetch(`/api/orgs/${org.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })

    if (res.ok) {
      setInviteEmail(''); setInviteSuccess(true); fetchMembers()
    } else {
      const d = await res.json(); setInviteError(d.error)
    }
    setInviting(false)
  }

  if (!org) return <div className="p-6 text-muted-foreground">Select an organization first.</div>

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <p className="text-sm text-muted-foreground">Your role: <strong>{role}</strong></p>
      </div>

      {/* Members */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Members</h2>
        <div className="space-y-2 mb-4">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium">{m.profile?.full_name}</p>
                <p className="text-xs text-muted-foreground">{m.profile?.email}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-muted capitalize">{m.role}</span>
            </div>
          ))}
        </div>

        {isAdminOrOwner && (
          <form onSubmit={handleInvite} className="space-y-3 p-4 border border-border rounded-lg">
            <h3 className="font-medium text-sm">Invite Member</h3>
            <div className="flex gap-3">
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="px-3 py-2 text-sm border border-border rounded-md bg-background"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              <Button type="submit" disabled={inviting}>{inviting ? 'Inviting...' : 'Invite'}</Button>
            </div>
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-green-600">Member invited successfully!</p>}
          </form>
        )}
      </section>

      {/* Audit Logs */}
      {isAdminOrOwner && auditLogs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2 border-b border-border text-sm">
                <span className="font-mono text-xs text-primary">{log.action}</span>
                <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
