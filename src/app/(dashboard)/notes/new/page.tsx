'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/hooks/use-org'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
        <p className="text-muted-foreground">You don&apos;t have permission to create notes in this organization.</p>
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
      <h1 className="text-2xl font-bold mb-6">New Note</h1>
      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Note title" required autoFocus />
        </div>

        <div className="space-y-2">
          <Label>Content</Label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write your note here..."
            rows={12}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-y font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label>Visibility</Label>
          <div className="flex gap-3">
            {(['private', 'shared', 'org'] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="visibility" value={v} checked={visibility === v} onChange={() => setVisibility(v)} />
                <span className="text-sm capitalize">{v}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tags <span className="text-muted-foreground text-xs">(comma-separated)</span></Label>
          <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="design, product, Q1" />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Note'}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
