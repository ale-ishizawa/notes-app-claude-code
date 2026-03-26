'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Upload, Download, Trash2, FileText } from 'lucide-react'
import { useOrg } from '@/hooks/use-org'
import { Button } from '@/components/ui/button'
import type { NoteFile } from '@/types/database'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilesPage() {
  const { org, role } = useOrg()
  const [files, setFiles] = useState<NoteFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canUpload = role && ['owner', 'admin', 'member'].includes(role)

  const fetchFiles = useCallback(async () => {
    if (!org) return
    const res = await fetch(`/api/files?orgId=${org.id}`)
    const data = await res.json()
    setFiles(data.files ?? [])
  }, [org])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !org) return
    setUploading(true)

    const form = new FormData()
    form.append('file', file)
    form.append('orgId', org.id)

    const res = await fetch('/api/files', { method: 'POST', body: form })
    if (res.ok) fetchFiles()
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDownload(fileId: string, fileName: string) {
    const res = await fetch(`/api/files/${fileId}`)
    if (!res.ok) return
    const { url } = await res.json()
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
  }

  async function handleDelete(fileId: string) {
    if (!confirm('Delete this file?')) return
    await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
    fetchFiles()
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Files</h1>
        {canUpload && (
          <>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" />{uploading ? 'Uploading...' : 'Upload File'}
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          </>
        )}
      </div>

      {!org ? (
        <p className="text-muted-foreground">Select an organization first.</p>
      ) : files.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No files uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium text-sm">{f.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(f.file_size)} · {new Date(f.created_at).toLocaleDateString()}
                    {(f.uploader as { full_name?: string } | undefined)?.full_name && ` · ${(f.uploader as { full_name: string }).full_name}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleDownload(f.id, f.file_name)}>
                  <Download className="h-4 w-4" />
                </Button>
                {canUpload && (
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(f.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
