export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'
export type NoteVisibility = 'private' | 'shared' | 'org'
export type SummaryStatus = 'pending' | 'completed' | 'accepted' | 'rejected'

export interface Profile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  created_at: string
  // Joined fields
  profile?: Profile
  organization?: Organization
}

export interface Note {
  id: string
  org_id: string
  title: string
  content: string
  visibility: NoteVisibility
  created_by: string
  updated_by: string | null
  version: number
  search_vector?: string
  created_at: string
  updated_at: string
  // Joined
  creator?: Profile
  updater?: Profile
  tags?: NoteTag[]
  shares?: NoteShare[]
}

export interface NoteTag {
  id: string
  note_id: string
  tag: string
}

export interface NoteShare {
  id: string
  note_id: string
  shared_with: string
  created_at: string
  // Joined
  profile?: Profile
}

export interface NoteVersion {
  id: string
  note_id: string
  version: number
  title: string
  content: string
  changed_by: string
  change_summary: string | null
  created_at: string
  // Joined
  changer?: Profile
}

export interface NoteFile {
  id: string
  note_id: string | null
  org_id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  uploaded_by: string
  created_at: string
  // Joined
  uploader?: Profile
}

export interface AiSummaryContent {
  summary: string
  key_points: string[]
  action_items: string[]
  topics: string[]
}

export interface AiSummary {
  id: string
  note_id: string
  org_id: string
  summary: AiSummaryContent
  status: SummaryStatus
  requested_by: string
  accepted_by: string | null
  model: string | null
  tokens_used: number | null
  created_at: string
  updated_at: string
  // Joined
  requester?: Profile
}

export interface AuditLog {
  id: string
  org_id: string | null
  user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  created_at: string
  // Joined
  user?: Profile
}

// Search result type
export interface NoteSearchResult extends Note {
  rank?: number
  headline?: string
}
