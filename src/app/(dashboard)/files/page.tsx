'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Upload, Download, Trash2, FileText } from 'lucide-react'
import { useOrg } from '@/hooks/use-org'
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
        <h1 className="text-2xl font-bold text-gray-800">Files</h1>
        {canUpload && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 transition-all shadow-sm"
            >
              <Upload className="h-4 w-4" />{uploading ? 'Uploading...' : 'Upload File'}
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          </>
        )}
      </div>

      {!org ? (
        <p className="text-gray-500">Select an organization first.</p>
      ) : files.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No files uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-white/60 hover:bg-amber-50/40 hover:border-amber-200 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-gray-800">{f.file_name}</p>
                  <p className="text-xs text-gray-500">
                    {formatBytes(f.file_size)} · {new Date(f.created_at).toLocaleDateString()}
                    {(f.uploader as { full_name?: string } | undefined)?.full_name && ` · ${(f.uploader as { full_name: string }).full_name}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleDownload(f.id, f.file_name)}
                  className="p-2 rounded-md text-gray-500 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
                {canUpload && (
                  <button
                    onClick={() => handleDelete(f.id)}
                    className="p-2 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
