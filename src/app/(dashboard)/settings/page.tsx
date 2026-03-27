'use client'

import { useEffect, useState, useCallback } from 'react'
import { useOrg } from '@/hooks/use-org'

interface Member {
  id: string
  role: string
  profile: { id: string; full_name: string; email: string }
}

const roleBadge: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800',
  admin: 'bg-orange-100 text-orange-700',
  member: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
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

  if (!org) return <div className="p-6 text-gray-500">Select an organization first.</div>

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{org.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Your role: <strong className="text-gray-700">{role}</strong></p>
      </div>

      {/* Members */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Members</h2>
        <div className="space-y-2 mb-4">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white/60">
              <div>
                <p className="text-sm font-medium text-gray-800">{m.profile?.full_name}</p>
                <p className="text-xs text-gray-500">{m.profile?.email}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${roleBadge[m.role] ?? 'bg-gray-100 text-gray-600'}`}>
                {m.role}
              </span>
            </div>
          ))}
        </div>

        {isAdminOrOwner && (
          <form onSubmit={handleInvite} className="space-y-3 p-4 border border-gray-200 rounded-lg bg-white/60">
            <h3 className="font-medium text-sm text-gray-700">Invite Member</h3>
            <div className="flex gap-3">
              <input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                required
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={inviting}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 transition-all shadow-sm"
              >
                {inviting ? 'Inviting...' : 'Invite'}
              </button>
            </div>
            {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
            {inviteSuccess && <p className="text-xs text-green-600">Member invited successfully!</p>}
          </form>
        )}
      </section>

      {/* Audit Logs */}
      {isAdminOrOwner && auditLogs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <div className="rounded-lg border border-gray-200 bg-white/60 overflow-hidden">
            {auditLogs.map((log, i) => (
              <div
                key={log.id}
                className={`flex items-center justify-between px-4 py-2.5 text-sm ${i < auditLogs.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="font-mono text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{log.action}</span>
                <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
