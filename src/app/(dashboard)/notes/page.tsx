'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Tag, Lock, Users, Globe } from 'lucide-react'
import { useOrg } from '@/hooks/use-org'
import type { Note } from '@/types/database'
import { cn } from '@/lib/utils'

const visibilityIcon = {
  private: Lock,
  shared: Users,
  org: Globe,
}
const visibilityLabel = { private: 'Private', shared: 'Shared', org: 'Org' }

const PAGE_SIZE = 50

export default function NotesPage() {
  const { org } = useOrg()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [tagFilter, setTagFilter] = useState('')
  const [debouncedTag, setDebouncedTag] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTag(tagFilter), 300)
    return () => clearTimeout(t)
  }, [tagFilter])

  const fetchNotes = useCallback(async (pageNum = 1, append = false, signal?: AbortSignal) => {
    if (!org) return
    append ? setLoadingMore(true) : setLoading(true)
    const params = new URLSearchParams({ orgId: org.id, page: String(pageNum), limit: String(PAGE_SIZE) })
    if (debouncedTag) params.set('tag', debouncedTag)

    try {
      const res = await fetch(`/api/notes?${params}`, { signal })
      const data = await res.json()
      const fetched = data.notes ?? []
      setNotes(prev => append ? [...prev, ...fetched] : fetched)
      setTotalPages(data.pagination?.pages ?? 1)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    } finally {
      if (!signal?.aborted) {
        append ? setLoadingMore(false) : setLoading(false)
      }
    }
  }, [org, debouncedTag])

  useEffect(() => {
    const controller = new AbortController()
    setPage(1)
    fetchNotes(1, false, controller.signal)
    return () => controller.abort()
  }, [fetchNotes])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchNotes(nextPage, true)
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <h2 className="text-xl font-semibold text-gray-800">No organization yet</h2>
        <p className="text-gray-500">Create or join an organization using the sidebar.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{org.name}</h1>
        <Link href="/notes/new">
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm">
            <Plus className="h-4 w-4" />New Note
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          placeholder="Filter by tag..."
          value={tagFilter}
          onChange={e => setTagFilter(e.target.value)}
          className="max-w-[180px] px-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No notes yet.</p>
          <Link href="/notes/new" className="text-amber-600 hover:underline text-sm mt-2 inline-block">
            Create your first note →
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {notes.map((note) => {
              const Icon = visibilityIcon[note.visibility]
              return (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="block p-4 rounded-lg border border-gray-200 bg-white/60 hover:border-amber-300 hover:bg-amber-50/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 truncate">{note.title}</h3>
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {note.content ? note.content.slice(0, 120) : 'No content'}
                      </p>
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(note.tags as { tag: string }[]).map((t) => (
                            <span
                              key={t.tag}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs"
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
                        note.visibility === 'private' && 'bg-gray-100 text-gray-600',
                        note.visibility === 'shared' && 'bg-blue-100 text-blue-700',
                        note.visibility === 'org' && 'bg-green-100 text-green-700',
                      )}>
                        <Icon className="h-3 w-3" />
                        {visibilityLabel[note.visibility]}
                      </span>
                      <span className="text-xs text-gray-400">v{note.version}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
          {page < totalPages && (
            <div className="flex justify-center mt-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-sm rounded-md border border-gray-200 text-gray-600 bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : `Load more (page ${page + 1} of ${totalPages})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
