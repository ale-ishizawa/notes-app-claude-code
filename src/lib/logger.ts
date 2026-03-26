import { createClient } from '@/lib/supabase/server'

type AuditAction =
  | 'auth.login' | 'auth.logout' | 'auth.signup'
  | 'org.create' | 'org.update' | 'org.invite' | 'org.member_remove'
  | 'note.create' | 'note.update' | 'note.delete' | 'note.share' | 'note.unshare'
  | 'file.upload' | 'file.delete' | 'file.access'
  | 'ai.summary_request' | 'ai.summary_complete' | 'ai.summary_accept' | 'ai.summary_reject'
  | 'permission.denied'

interface AuditLogEntry {
  org_id?: string
  user_id?: string
  action: AuditAction
  resource_type?: string
  resource_id?: string
  metadata?: Record<string, unknown>
  ip_address?: string
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = await createClient()

    // Use service role if available to bypass RLS for audit inserts
    const { error } = await supabase.from('audit_logs').insert({
      org_id: entry.org_id ?? null,
      user_id: entry.user_id ?? null,
      action: entry.action,
      resource_type: entry.resource_type ?? null,
      resource_id: entry.resource_id ?? null,
      metadata: entry.metadata ?? {},
      ip_address: entry.ip_address ?? null,
    })

    if (error) {
      // Don't throw — logging failures must not break the main operation
      console.error('[audit] Failed to write log:', error.message, entry)
    }
  } catch (err) {
    console.error('[audit] Unexpected error:', err, entry)
  }
}

// Server-side structured log helper
export function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: Record<string, unknown>
) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...context,
  }
  if (level === 'error') {
    console.error(JSON.stringify(entry))
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}
