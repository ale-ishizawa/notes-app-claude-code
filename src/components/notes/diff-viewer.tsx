'use client'

import { useMemo } from 'react'

interface DiffViewerProps {
  oldText: string
  newText: string
}

// LCS-based line diff — no external dependencies
function diffLines(oldText: string, newText: string): [number, string][] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const m = oldLines.length
  const n = newLines.length

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  const result: [number, string][] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift([0, oldLines[i - 1] + '\n'])
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift([1, newLines[j - 1] + '\n'])
      j--
    } else {
      result.unshift([-1, oldLines[i - 1] + '\n'])
      i--
    }
  }

  return result
}

export function DiffViewer({ oldText, newText }: DiffViewerProps) {
  const diffs = useMemo(() => diffLines(oldText, newText), [oldText, newText])

  return (
    <div className="font-mono text-sm whitespace-pre-wrap bg-gray-50 border border-gray-200 text-gray-800 rounded-md p-4 overflow-auto max-h-96">
      {diffs.map(([op, text], i) => {
        if (op === 0) return <span key={i}>{text}</span>
        if (op === -1) return <span key={i} className="bg-red-200 text-red-900 line-through">{text}</span>
        if (op === 1) return <span key={i} className="bg-green-200 text-green-900">{text}</span>
        return null
      })}
    </div>
  )
}
