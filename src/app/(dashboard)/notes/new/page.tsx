'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/hooks/use-org'

export default function NewNotePage() {
  const { org, role } = useOrg()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'shared' | 'org'>('private')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!org || role === 'viewer') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-gray-500">You don&apos;t have permission to create notes in this organization.</p>
      </div>
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)

    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)

    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: org!.id, title, content, visibility, tags: tagList }),
    })

    if (res.ok) {
      const { note } = await res.json()
      router.push(`/notes/${note.id}`)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to create note')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">New Note</h1>
      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Note title"
            required
            autoFocus
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Content</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write your note here..."
            rows={12}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-y font-mono"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Visibility</label>
          <div className="flex gap-3">
            {(['private', 'shared', 'org'] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} />
                <span className="text-sm text-gray-700 capitalize">{v}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Tags <span className="text-gray-400 text-xs">(comma-separated)</span>
          </label>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="design, product, Q1"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 transition-all shadow-sm"
          >
            {saving ? 'Saving...' : 'Create Note'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
