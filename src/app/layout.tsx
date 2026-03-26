import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TeamNotes — Multi-tenant Team Notes',
  description: 'Collaborative notes app with organizations, versioning, and AI summaries',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
