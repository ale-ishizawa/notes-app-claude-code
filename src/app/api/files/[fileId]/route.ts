import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAudit, log } from '@/lib/logger'

// GET /api/files/[fileId] — get signed download URL
export async function GET(_req: Request, { params }: { params: { fileId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: fileRecord } = await supabase
    .from('note_files')
    .select('id, org_id, storage_path, file_name')
    .eq('id', params.fileId)
    .single()

  if (!fileRecord) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  // RLS already verified org membership via note_files_select policy
  const { data: signedUrl, error } = await supabase.storage
    .from('note-files')
    .createSignedUrl(fileRecord.storage_path, 3600) // 1 hour expiry

  if (error || !signedUrl) {
    log('error', 'Failed to create signed URL', { fileId: params.fileId, error: error?.message })
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }

  await logAudit({
    org_id: fileRecord.org_id, user_id: user.id, action: 'file.access',
    resource_type: 'note_file', resource_id: params.fileId,
    metadata: { file_name: fileRecord.file_name },
  })

  return NextResponse.json({ url: signedUrl.signedUrl, expiresIn: 3600 })
}

// DELETE /api/files/[fileId]
export async function DELETE(_req: Request, { params }: { params: { fileId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: fileRecord } = await supabase
    .from('note_files')
    .select('id, org_id, storage_path')
    .eq('id', params.fileId)
    .single()

  if (!fileRecord) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  // Delete from storage first
  await supabase.storage.from('note-files').remove([fileRecord.storage_path])

  const { error } = await supabase.from('note_files').delete().eq('id', params.fileId)
  if (error) return NextResponse.json({ error: 'Failed to delete file record' }, { status: 500 })

  await logAudit({
    org_id: fileRecord.org_id, user_id: user.id, action: 'file.delete',
    resource_type: 'note_file', resource_id: params.fileId,
  })

  return NextResponse.json({ ok: true })
}
