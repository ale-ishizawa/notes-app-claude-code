'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Search, Upload, Settings, LogOut, Plus, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/hooks/use-org'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/files', label: 'Files', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { org, orgs, switchOrg } = useOrg()
  const [showOrgMenu, setShowOrgMenu] = useState(false)
  const [showCreateOrg, setShowCreateOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!newOrgName.trim()) return
    setCreating(true)

    const res = await fetch('/api/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newOrgName.trim() }),
    })

    if (res.ok) {
      const { org } = await res.json()
      setNewOrgName('')
      setShowCreateOrg(false)
      // Set new org as active, then refresh so server re-renders the updated orgs list
      await fetch('/api/orgs/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id }),
      })
      router.refresh()
    }
    setCreating(false)
  }

  return (
    <aside className="w-60 flex flex-col h-screen border-r border-border bg-card">
      {/* Org Switcher */}
      <div className="p-3 border-b border-border">
        <button
          onClick={() => setShowOrgMenu(!showOrgMenu)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted text-sm font-medium"
        >
          <span className="truncate">{org?.name ?? 'Select Organization'}</span>
          <ChevronDown className="h-4 w-4 shrink-0 ml-2" />
        </button>

        {showOrgMenu && (
          <div className="mt-1 rounded-md border border-border bg-card shadow-md">
            {orgs.map(({ org: o, role }) => (
              <button
                key={o.id}
                onClick={() => { switchOrg(o.id); setShowOrgMenu(false) }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left',
                  org?.id === o.id && 'bg-muted font-medium'
                )}
              >
                <span className="truncate">{o.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{role}</span>
              </button>
            ))}
            <div className="border-t border-border">
              <button
                onClick={() => { setShowCreateOrg(true); setShowOrgMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-primary"
              >
                <Plus className="h-3 w-3" /> New Organization
              </button>
            </div>
          </div>
        )}

        {showCreateOrg && (
          <form onSubmit={handleCreateOrg} className="mt-2 flex flex-col gap-2">
            <input
              autoFocus
              value={newOrgName}
              onChange={e => setNewOrgName(e.target.value)}
              placeholder="Org name"
              className="w-full px-2 py-1 text-sm border border-border rounded-md bg-background"
            />
            <Button type="submit" size="sm" className="w-full" disabled={creating}>
              {creating ? 'Creating...' : 'Create Organization'}
            </Button>
          </form>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname.startsWith(href)
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Sign out */}
      <div className="p-2 border-t border-border">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
