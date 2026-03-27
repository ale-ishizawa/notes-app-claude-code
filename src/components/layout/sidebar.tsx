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
import { AppLogo } from '@/components/ui/app-logo'

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
    <aside className="w-60 flex flex-col h-screen border-r border-gray-200 bg-white">
      {/* Brand header */}
      <div className="bg-gradient-to-br from-amber-400 to-cyan-400 p-4 flex items-center gap-3">
        <AppLogo size={36} />
        <span className="font-bold text-white text-lg drop-shadow-sm tracking-tight">TeamNotes</span>
      </div>

      {/* Org Switcher */}
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={() => setShowOrgMenu(!showOrgMenu)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-amber-50 text-sm font-medium text-gray-800 transition-colors"
        >
          <span className="truncate">{org?.name ?? 'Select Organization'}</span>
          <ChevronDown className="h-4 w-4 shrink-0 ml-2 text-gray-500" />
        </button>

        {showOrgMenu && (
          <div className="mt-1 rounded-md border border-gray-200 bg-white shadow-md overflow-hidden">
            {orgs.map(({ org: o, role }) => (
              <button
                key={o.id}
                onClick={() => { switchOrg(o.id); setShowOrgMenu(false) }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-amber-50 text-left text-gray-700 transition-colors',
                  org?.id === o.id && 'bg-amber-50 font-medium text-amber-700'
                )}
              >
                <span className="truncate">{o.name}</span>
                <span className="text-xs text-gray-400 ml-2">{role}</span>
              </button>
            ))}
            <div className="border-t border-gray-200">
              <button
                onClick={() => { setShowCreateOrg(true); setShowOrgMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-amber-50 text-amber-600 font-medium transition-colors"
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
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded-md bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <Button type="submit" size="sm" className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0" disabled={creating}>
              {creating ? 'Creating...' : 'Create Organization'}
            </Button>
          </form>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium shadow-sm'
                  : 'hover:bg-amber-50 text-gray-700 hover:text-amber-700'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-amber-50 text-gray-500 hover:text-amber-700 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
