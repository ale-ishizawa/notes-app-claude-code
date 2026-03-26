'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Tag, Lock, Users, Globe } from 'lucide-react'
import { useOrg } from '@/hooks/use-org'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Note } from '@/types/database'
import { cn } from '@/lib/utils'

const visibilityIcon = {
  private: Lock,
  shared: Users,
  org: Globe,
}
const visibilityLabel = { private: 'Private', shared: 'Shared', org: 'Org' }

export default function NotesPage() {
  const { org } = useOrg()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const fetchNotes = useCallback(async () => {
    if (!org) return
    setLoading(true)
    const params = new URLSearchParams({ orgId: org.id })
    if (search) params.set('search', search)
    if (tagFilter) params.set('tag', tagFilter)

    const res = await fetch(`/api/notes?${params}`)
    const data = await res.json()
    setNotes(data.notes ?? [])
    setLoading(false)
  }, [org, search, tagFilter])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <h2 className="text-xl font-semibold">No organization yet</h2>
        <p className="text-muted-foreground">Create or join an organization using the sidebar.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <Link href="/notes/new">
          <Button size="sm"><Plus className="h-4 w-4 mr-2" />New Note</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <Input
          placeholder="Filter by tag..."
          value={tagFilter}
          onChange={e => setTagFilter(e.target.value)}
          className="max-w-[180px]"
        />
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No notes yet.</p>
          <Link href="/notes/new" className="text-primary hover:underline text-sm mt-2 inline-block">
            Create your first note →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => {
            const Icon = visibilityIcon[note.visibility]
            return (
              <Link
                key={note.id}
                href={`/notes/${note.id}`}
                className="block p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{note.title}</h3>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {note.content ? note.content.slice(0, 120) : 'No content'}
                    </p>
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(note.tags as { tag: string }[]).map((t) => (
                          <span
                            key={t.tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-xs"
                          >
                            <Tag className="h-2.5 w-2.5" />{t.tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                      note.visibility === 'private' && 'bg-muted text-muted-foreground',
                      note.visibility === 'shared' && 'bg-blue-100 text-blue-700',
                      note.visibility === 'org' && 'bg-green-100 text-green-700',
                    )}>
                      <Icon className="h-3 w-3" />
                      {visibilityLabel[note.visibility]}
                    </span>
                    <span className="text-xs text-muted-foreground">v{note.version}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
