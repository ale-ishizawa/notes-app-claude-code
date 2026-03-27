'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Trash2, History, Share2, Sparkles, Lock, Users, Globe, Tag, X, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { useOrg } from '@/hooks/use-org'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DiffViewer } from '@/components/notes/diff-viewer'
import type { Note, NoteVersion, AiSummary } from '@/types/database'
import { cn } from '@/lib/utils'

const visibilityOptions = [
  { value: 'private', label: 'Private', icon: Lock },
  { value: 'shared', label: 'Shared', icon: Users },
  { value: 'org', label: 'Org', icon: Globe },
] as const

export default function NoteDetailPage() {
  const { noteId } = useParams<{ noteId: string }>()
  const router = useRouter()
  const { role } = useOrg()

  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'shared' | 'org'>('private')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [diffBase, setDiffBase] = useState<NoteVersion | null>(null)
  const [diffTarget, setDiffTarget] = useState<NoteVersion | null>(null)

  const [showShare, setShowShare] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [shareError, setShareError] = useState<string | null>(null)

  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null)
  const [summarizing, setSummarizing] = useState(false)

  const canEdit = role && ['owner', 'admin', 'member'].includes(role)

  const fetchNote = useCallback(async () => {
    const res = await fetch(`/api/notes/${noteId}`)
    if (!res.ok) { router.push('/notes'); return }
    const { note } = await res.json()
    setNote(note)
    setTitle(note.title)
    setContent(note.content)
    setVisibility(note.visibility)
    setTags((note.tags ?? []).map((t: { tag: string }) => t.tag))
  }, [noteId, router])

  const fetchVersions = useCallback(async () => {
    const res = await fetch(`/api/notes/${noteId}/versions`)
    const { versions } = await res.json()
    setVersions(versions ?? [])
  }, [noteId])

  const fetchSummary = useCallback(async () => {
    const res = await fetch(`/api/notes/${noteId}/summary`)
    if (res.ok) {
      const data = await res.json()
      setAiSummary(data.summary ?? null)
    }
  }, [noteId])

  useEffect(() => { fetchNote() }, [fetchNote])
  useEffect(() => { if (showVersions) fetchVersions() }, [showVersions, fetchVersions])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  async function handleSave() {
    if (!note || !canEdit) return
    setSaving(true)
    const res = await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, visibility, tags }),
    })
    if (res.ok) {
      const { note: updated } = await res.json()
      setNote(updated)
      if (showVersions) fetchVersions()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this note? This cannot be undone.')) return
    setDeleting(true)
    await fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
    router.push('/notes')
  }

  async function handleShare(e: React.FormEvent) {
    e.preventDefault()
    setShareError(null)
    // Look up user by email first
    const lookupRes = await fetch(`/api/users/by-email?email=${encodeURIComponent(shareEmail)}`)
    if (!lookupRes.ok) { setShareError('User not found'); return }
    const { userId } = await lookupRes.json()

    const res = await fetch(`/api/notes/${noteId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (res.ok) { setShareEmail(''); fetchNote() }
    else { const d = await res.json(); setShareError(d.error) }
  }

  async function handleSummarize() {
    setSummarizing(true)
    const res = await fetch(`/api/notes/${noteId}/summarize`, { method: 'POST' })
    if (res.ok) {
      const { summary } = await res.json()
      setAiSummary(summary)
    }
    setSummarizing(false)
  }

  async function handleSummaryAction(action: 'accept' | 'reject') {
    if (!aiSummary) return
    await fetch(`/api/notes/${noteId}/summary/${aiSummary.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    fetchSummary()
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagInput('')
  }

  if (!note) return <div className="p-6 text-gray-500 text-sm">Loading...</div>

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/notes"><Button variant="ghost" size="icon" className="text-gray-600 hover:bg-amber-50 hover:text-amber-700"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <span className="text-sm text-gray-400">v{note.version}</span>
        <div className="flex-1" />
        {canEdit && (
          <>
            <Button size="sm" variant="ghost" className="text-gray-600 hover:bg-amber-50 hover:text-amber-700" onClick={() => setShowShare(!showShare)}>
              <Share2 className="h-4 w-4 mr-2" />Share
            </Button>
            <Button size="sm" variant="ghost" className="text-gray-600 hover:bg-amber-50 hover:text-amber-700" onClick={() => setShowVersions(!showVersions)}>
              <History className="h-4 w-4 mr-2" />History
            </Button>
            <Button size="sm" variant="ghost" className="text-gray-600 hover:bg-amber-50 hover:text-amber-700" onClick={handleSummarize} disabled={summarizing}>
              <Sparkles className="h-4 w-4 mr-2" />{summarizing ? 'Summarizing...' : 'AI Summary'}
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Title */}
      <Input
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="text-2xl font-bold border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-800 placeholder:text-gray-300"
        disabled={!canEdit}
        placeholder="Note title"
      />

      {/* Visibility + Tags */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {visibilityOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => canEdit && setVisibility(value)}
              disabled={!canEdit}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors',
                visibility === value
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-amber-50 hover:border-amber-300'
              )}
            >
              <Icon className="h-3 w-3" />{label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 items-center">
          {tags.map(t => (
            <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">
              <Tag className="h-2.5 w-2.5" />{t}
              {canEdit && <button onClick={() => setTags(tags.filter(x => x !== t))}><X className="h-2.5 w-2.5" /></button>}
            </span>
          ))}
          {canEdit && (
            <div className="flex gap-1">
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Add tag..."
                className="h-6 text-xs w-24 px-2 bg-white border-gray-200 text-gray-800 placeholder:text-gray-400 focus-visible:ring-amber-300"
              />
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-gray-600 hover:bg-amber-50 hover:text-amber-700" onClick={addTag}>+</Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        disabled={!canEdit}
        rows={16}
        placeholder="Write your note here..."
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-y font-mono"
      />

      {/* Share Panel */}
      {showShare && canEdit && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white/60">
          <h3 className="font-medium text-sm text-gray-700">Share with team member</h3>
          {note.visibility !== 'shared' && (
            <p className="text-xs text-amber-600">Note: set visibility to &quot;Shared&quot; for specific sharing to take effect.</p>
          )}
          <form onSubmit={handleShare} className="flex gap-2">
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={shareEmail}
              onChange={e => setShareEmail(e.target.value)}
              required
              className="bg-white border-gray-200 text-gray-800 placeholder:text-gray-400 focus-visible:ring-amber-300"
            />
            <Button type="submit" size="sm" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0">Share</Button>
          </form>
          {shareError && <p className="text-xs text-destructive">{shareError}</p>}
          {(note.shares as Array<{ shared_with: string; profile?: { full_name: string; email: string } }> | undefined)?.length ? (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-medium">Shared with:</p>
              {(note.shares as Array<{ shared_with: string; profile?: { full_name: string; email: string } }>).map(s => (
                <div key={s.shared_with} className="flex items-center justify-between text-xs">
                  <span>{s.profile?.full_name ?? s.profile?.email ?? s.shared_with}</span>
                  <button
                    onClick={async () => {
                      await fetch(`/api/notes/${noteId}/share`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: s.shared_with }),
                      })
                      fetchNote()
                    }}
                    className="text-destructive hover:underline"
                  >Remove</button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* AI Summary */}
      {aiSummary && aiSummary.status !== 'rejected' && (
        <div className="border border-amber-200 rounded-lg p-4 space-y-3 bg-amber-50/60">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm text-gray-700 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />AI Summary
              <span className="text-xs text-amber-600 font-normal">({aiSummary.status})</span>
            </h3>
            {aiSummary.status === 'completed' && (
              <div className="flex gap-2">
                <button onClick={() => handleSummaryAction('accept')} className="px-3 py-1.5 text-xs rounded-md font-medium border border-amber-300 bg-white text-amber-700 hover:bg-amber-50 transition-colors">Accept</button>
                <button onClick={() => handleSummaryAction('reject')} className="px-3 py-1.5 text-xs rounded-md font-medium text-gray-500 hover:bg-gray-100 transition-colors">Reject</button>
              </div>
            )}
          </div>
          {aiSummary.summary?.summary && <p className="text-sm text-gray-700">{aiSummary.summary.summary}</p>}
          {aiSummary.summary?.key_points?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Key Points</p>
              <ul className="text-sm text-gray-700 space-y-0.5 list-disc list-inside">
                {aiSummary.summary.key_points.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {aiSummary.summary?.action_items?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Action Items</p>
              <ul className="text-sm text-gray-700 space-y-0.5 list-disc list-inside">
                {aiSummary.summary.action_items.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
          {aiSummary.summary?.topics?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {aiSummary.summary.topics.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Version History */}
      {showVersions && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white/60">
          <h3 className="font-medium text-sm text-gray-700">Version History ({versions.length} versions)</h3>
          {versions.length === 0 ? (
            <p className="text-sm text-gray-500">No previous versions.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-200 last:border-0">
                  <div>
                    <span className="font-semibold text-gray-800 text-sm">v{v.version}</span>
                    <span className="text-gray-600 ml-2 text-xs">
                      by {(v.changer as { full_name: string } | undefined)?.full_name ?? 'Unknown'}
                    </span>
                    <span className="text-gray-500 ml-2 text-xs">
                      {new Date(v.created_at).toLocaleString()}
                    </span>
                    <p className="text-gray-700 text-sm truncate max-w-xs mt-0.5">{v.title}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="text-gray-600 hover:bg-amber-50 hover:text-amber-700" onClick={() => setDiffBase(diffBase?.id === v.id ? null : v)}>
                      {diffBase?.id === v.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {diffBase?.id === v.id ? 'Hide' : 'Diff from here'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Diff view */}
          {diffBase && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                Comparing v{diffBase.version} → current (v{note.version})
              </p>
              <p className="text-xs font-semibold text-gray-700">Title diff:</p>
              <DiffViewer oldText={diffBase.title} newText={note.title} />
              <p className="text-xs font-semibold text-gray-700 mt-2">Content diff:</p>
              <DiffViewer oldText={diffBase.content} newText={note.content} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
