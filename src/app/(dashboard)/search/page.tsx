'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Search, Tag } from 'lucide-react'
import { useOrg } from '@/hooks/use-org'
import type { Note } from '@/types/database'

const PAGE_SIZE = 50

export default function SearchPage() {
  const { org } = useOrg()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Note[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [lastQuery, setLastQuery] = useState('')

  const doSearch = useCallback(async (searchQuery: string, pageNum: number, append: boolean) => {
    if (!org || !searchQuery.trim()) return
    append ? setLoadingMore(true) : setLoading(true)
    const params = new URLSearchParams({ orgId: org.id, search: searchQuery.trim(), page: String(pageNum), limit: String(PAGE_SIZE) })
    const res = await fetch(`/api/notes?${params}`)
    const data = await res.json()
    setResults(prev => append ? [...prev, ...(data.notes ?? [])] : (data.notes ?? []))
    setTotal(data.pagination?.total ?? 0)
    setTotalPages(data.pagination?.pages ?? 1)
    setSearched(true)
    append ? setLoadingMore(false) : setLoading(false)
  }, [org])

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!org || !query.trim()) return
    setPage(1)
    setLastQuery(query)
    doSearch(query, 1, false)
  }, [org, query, doSearch])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    doSearch(lastQuery, nextPage, true)
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Search Notes</h1>

      {!org ? (
        <p className="text-gray-500">Select an organization first.</p>
      ) : (
        <>
          <form onSubmit={handleSearch} className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search titles, content, tags..."
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-md text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 transition-all shadow-sm"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searched && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                {total} result{total !== 1 ? 's' : ''} in <strong className="text-gray-700">{org.name}</strong>
              </p>
              {results.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No notes found for &quot;{lastQuery}&quot;</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {results.map((note) => (
                      <Link
                        key={note.id}
                        href={`/notes/${note.id}`}
                        className="block p-4 rounded-lg border border-gray-200 bg-white/60 hover:border-amber-300 hover:bg-amber-50/40 transition-colors"
                      >
                        <h3 className="font-medium text-gray-800">{note.title}</h3>
                        <p className="text-sm text-gray-500 mt-0.5 truncate">
                          {note.content?.slice(0, 150)}
                        </p>
                        {note.tags && (note.tags as { tag: string }[]).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(note.tags as { tag: string }[]).map(t => (
                              <span key={t.tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">
                                <Tag className="h-2.5 w-2.5" />{t.tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                  {page < totalPages && (
                    <div className="flex justify-center mt-4">
                      <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="px-4 py-2 text-sm rounded-md border border-gray-200 text-gray-600 bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition-colors disabled:opacity-50"
                      >
                        {loadingMore ? 'Loading...' : `Load more (${results.length} of ${total})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
