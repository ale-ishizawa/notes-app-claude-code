import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit, log } from '@/lib/logger'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB (BUG-001)

const ALLOWED_MIME_TYPES = new Set([ // BUG-003
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain', 'text/markdown', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
])

// GET /api/files?orgId=...&noteId=...
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('orgId')
  const noteId = searchParams.get('noteId')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  if (!orgId) return NextResponse.json({ error: 'orgId is required' }, { status: 400 })

  let query = supabase
    .from('note_files')
    .select('id, note_id, org_id, file_name, file_size, mime_type, storage_path, created_at, uploader:profiles!note_files_uploaded_by_fkey(id, full_name)', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (noteId) query = query.eq('note_id', noteId)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })

  return NextResponse.json({ files: data ?? [], pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) } })
}

// POST /api/files — upload file
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const orgId = formData.get('orgId') as string | null
  const noteId = formData.get('noteId') as string | null

  if (!file || !orgId) {
    return NextResponse.json({ error: 'file and orgId are required' }, { status: 400 })
  }

  // BUG-001: Enforce file size limit
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 50 MB limit' }, { status: 413 })
  }

  // BUG-003: Validate MIME type against allowlist
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 415 })
  }

  // Verify membership + not viewer
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'viewer') {
    await logAudit({ org_id: orgId, user_id: user.id, action: 'permission.denied', metadata: { attempted: 'file.upload' } })
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const fileId = crypto.randomUUID()
  // Path: {orgId}/{noteId_or_org}/{fileId}/{filename}
  const storagePath = noteId
    ? `${orgId}/${noteId}/${fileId}/${file.name}`
    : `${orgId}/org/${fileId}/${file.name}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('note-files')
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    log('error', 'File upload to storage failed', { orgId, error: uploadError.message })
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }

  const { data: fileRecord, error: dbError } = await supabase
    .from('note_files')
    .insert({
      note_id: noteId ?? null,
      org_id: orgId,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (dbError) {
    // Clean up orphaned storage object
    await supabase.storage.from('note-files').remove([storagePath])
    return NextResponse.json({ error: 'Failed to record file metadata' }, { status: 500 })
  }

  await logAudit({
    org_id: orgId, user_id: user.id, action: 'file.upload',
    resource_type: 'note_file', resource_id: fileRecord.id,
    metadata: { file_name: file.name, file_size: file.size, note_id: noteId },
  })

  return NextResponse.json({ file: fileRecord }, { status: 201 })
}
