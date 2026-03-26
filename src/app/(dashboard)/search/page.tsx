'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { useOrg } from '@/hooks/use-org'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Note } from '@/types/database'

export default function SearchPage() {
  const { org } = useOrg()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Note[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org || !query.trim()) return
    setLoading(true)
    const params = new URLSearchParams({ orgId: org.id, search: query.trim() })
    const res = await fetch(`/api/notes?${params}`)
    const data = await res.json()
    setResults(data.notes ?? [])
    setSearched(true)
    setLoading(false)
  }, [org, query])

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Search Notes</h1>

      {!org ? (
        <p className="text-muted-foreground">Select an organization first.</p>
      ) : (
        <>
          <form onSubmit={handleSearch} className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search titles, content, tags..."
                className="pl-9"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={loading}>{loading ? 'Searching...' : 'Search'}</Button>
          </form>

          {searched && (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                {results.length} result{results.length !== 1 ? 's' : ''} in <strong>{org.name}</strong>
              </p>
              {results.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No notes found for &quot;{query}&quot;</p>
              ) : (
                <div className="space-y-2">
                  {results.map((note) => (
                    <Link
                      key={note.id}
                      href={`/notes/${note.id}`}
                      className="block p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors"
                    >
                      <h3 className="font-medium">{note.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {note.content?.slice(0, 150)}
                      </p>
                      {note.tags && (note.tags as { tag: string }[]).length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {(note.tags as { tag: string }[]).map(t => (
                            <span key={t.tag} className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-xs">{t.tag}</span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
