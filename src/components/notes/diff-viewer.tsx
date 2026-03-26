'use client'

import { useMemo } from 'react'
import { diff_match_patch } from 'diff-match-patch'

interface DiffViewerProps {
  oldText: string
  newText: string
}

export function DiffViewer({ oldText, newText }: DiffViewerProps) {
  const diffs = useMemo(() => {
    const dmp = new diff_match_patch()
    const d = dmp.diff_main(oldText, newText)
    dmp.diff_cleanupSemantic(d)
    return d
  }, [oldText, newText])

  return (
    <div className="font-mono text-sm whitespace-pre-wrap bg-muted rounded-md p-4 overflow-auto max-h-96">
      {diffs.map(([op, text], i) => {
        if (op === 0) return <span key={i}>{text}</span>
        if (op === -1) return <span key={i} className="bg-red-200 text-red-900 line-through">{text}</span>
        if (op === 1) return <span key={i} className="bg-green-200 text-green-900">{text}</span>
        return null
      })}
    </div>
  )
}
