# NOTES.md — Agent Scratchpad

Running log of plans, actions, decisions, and reasoning throughout the build.

---

## 2026-03-26 — Project Kickoff

### Analysis Phase
- Read Job Description: e3 group LATAM Full Stack Engineer — React, TypeScript, Supabase, AI tools
- Read Take-Home Assessment: Multi-tenant team notes app, 24-hour build, agent execution interview
- Extracted all explicit and implied requirements
- Identified highest-risk areas: RLS/tenant isolation, search at 10k scale, file access safety

### Architecture Decisions
- **Stack:** Next.js 14 (App Router) + Supabase (local) + Tailwind + OpenAI GPT-4
- **Why Next.js 14:** Single deployable, API routes + SSR, Docker-friendly, Railway-compatible
- **Why local Supabase:** Full control, reproducible setup, no external dependency
- **Why OpenAI:** User preference over Claude API; structured JSON output via response_format
- **Why Postgres FTS:** Native to Supabase, RLS-compatible, handles 10k notes easily with GIN index

### Data Model
- 10 tables: profiles, organizations, organization_members, notes, note_tags, note_shares, note_versions, note_files, ai_summaries, audit_logs
- RLS on every table — org-scoped access, visibility-based note filtering
- Versioning via BEFORE UPDATE trigger — immutable note_versions
- Full-text search via tsvector with GIN index, weighted (title/tags A, content B)

### Phase 1 Complete
- Next.js app initialized with TypeScript, Tailwind v4, core UI components
- Supabase client/server/middleware configured
- Auth-aware middleware set up
- Build verified — compiles successfully
- First commit: `a9ee8a4`

### Next Steps
- Create Supabase migrations for full schema
- Implement auth pages (login, signup)
- Implement org creation and switching
