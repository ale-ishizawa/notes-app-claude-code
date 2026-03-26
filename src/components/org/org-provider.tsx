'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { OrgContext } from '@/hooks/use-org'
import type { Organization, OrgRole } from '@/types/database'

interface OrgProviderProps {
  children: React.ReactNode
  initialOrg: Organization | null
  initialRole: OrgRole | null
  orgs: { org: Organization; role: OrgRole }[]
}

export function OrgProvider({ children, initialOrg, initialRole, orgs }: OrgProviderProps) {
  const [activeOrg, setActiveOrg] = useState(initialOrg)
  const [activeRole, setActiveRole] = useState(initialRole)
  const router = useRouter()

  const switchOrg = useCallback((orgId: string) => {
    const found = orgs.find((o) => o.org.id === orgId)
    if (found) {
      setActiveOrg(found.org)
      setActiveRole(found.role)
      // Persist active org in cookie via API
      fetch('/api/orgs/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      }).then(() => router.refresh())
    }
  }, [orgs, router])

  return (
    <OrgContext.Provider value={{ org: activeOrg, role: activeRole, orgs, switchOrg }}>
      {children}
    </OrgContext.Provider>
  )
}
