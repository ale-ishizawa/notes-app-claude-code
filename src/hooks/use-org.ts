'use client'

import { createContext, useContext } from 'react'
import type { Organization, OrgRole } from '@/types/database'

export interface OrgContextValue {
  org: Organization | null
  role: OrgRole | null
  orgs: { org: Organization; role: OrgRole }[]
  switchOrg: (orgId: string) => void
}

export const OrgContext = createContext<OrgContextValue>({
  org: null,
  role: null,
  orgs: [],
  switchOrg: () => {},
})

export function useOrg() {
  return useContext(OrgContext)
}
