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

### Phases 2–11 Complete (2026-03-26)

#### Phase 2 — Auth + Multi-tenancy
- Supabase migration written: 10 tables, all RLS policies, helper functions, triggers, storage bucket
- Login/signup pages implemented with Supabase Auth
- `OrgProvider` + `useOrg()` hook for active org context
- Org switcher in sidebar; active org persisted via `active_org_id` cookie
- Commits: `e661e44`, `a44ba5c`

#### Phase 3 — Notes CRUD
- `GET/POST /api/notes` with FTS search, tag filter, org scoping
- `GET/PATCH/DELETE /api/notes/[noteId]` with full RLS enforcement
- Visibility controls (private / shared / org), tagging, selective sharing
- Share/unshare API validates target user is in same org
- Commit: part of main feature set

#### Phase 4 — Versioning + Diffs
- BEFORE UPDATE trigger saves previous note state to `note_versions` on title/content change
- `GET /api/notes/[noteId]/versions` endpoint
- Version history timeline in note detail UI
- Client-side diff rendering via `diff-match-patch`

#### Phase 5 — Search
- FTS page uses Supabase `textSearch` on `search_vector` column
- GIN index ensures sub-second queries at 10k scale
- RLS automatically filters search results to accessible notes — no extra enforcement needed

#### Phase 6 — File Uploads
- Supabase Storage bucket `note-files` with org-scoped paths (`{orgId}/{noteId}/{fileId}/{name}`)
- Upload returns signed URLs (1-hour expiry); storage paths are UUID-based
- Files UI in dashboard settings

#### Phase 7 — AI Summaries
- `POST /api/notes/[noteId]/summarize` calls OpenAI `gpt-4o-mini` with `response_format: json_object`
- Structured output: `{ key_points, action_items, summary, topics }`
- Accept/reject flow: summary stored as `pending` → user accepts or rejects
- All OpenAI calls logged to `audit_logs` with token count

#### Phase 8 — Logging
- `logAudit()` helper writes to `audit_logs` table — never throws, failures are silent
- Auth events, note mutations, file ops, AI requests, permission denials all logged
- Audit log UI (owner/admin only) in dashboard settings

#### Phase 9 — Seed Script
- `scripts/seed.ts` generates ~10k notes across 4 orgs and 8 users
- Mix: 60% org visibility, 25% private, 15% shared; ~30 unique tags
- ~500 notes with 2–5 versions, ~20 AI summaries, batch inserts of 500 rows
- Commit: `460b2f8`

#### Phase 10 — Hardening
- Security review pass: read all API routes + RLS policies
- Found and documented 6 bugs in BUGS.md
- Fixed 4 in-place:
  - BUG-003: Added MIME type allowlist to file upload
  - BUG-001: Added 50 MB file size limit to file upload
  - BUG-006: Reordered PATCH handler to update tags before note (fixes search vector ordering)
  - BUG-004, BUG-005: Already fixed during initial setup
- BUG-002 (race condition in RLS) mitigated by API design; documented

#### Phase 11 — Docker
- Multi-stage Dockerfile: `deps` → `builder` (standalone) → `runner` (non-root `nextjs` user)
- `docker-compose.yml` with healthcheck on `/api/health`
- Commit: `ffbe07c`

### Phase 12 — Runtime Bug Fixes (2026-03-26, post-browser testing)

#### BUG-007: RLS infinite recursion on notes_select
- `notes_select` → `note_shares` → `note_shares_select` → `notes` → infinite loop
- Fix: extracted `is_note_shared_with_me(note_uuid)` as `SECURITY DEFINER` function; breaks RLS cycle
- Commit: `a993292`

#### BUG-008: note_versions INSERT blocked — trigger ran as session user
- `create_note_version()` and `update_note_search_from_tags()` were not `SECURITY DEFINER`
- RLS blocked their INSERTs/UPDATEs since `note_versions` has no INSERT policy for regular users
- Fix: added `SECURITY DEFINER` to both trigger functions
- Commit: `cfe965e`

#### BUG-009: audit_logs INSERT blocked — logAudit() used session client
- `logAudit()` called `createClient()` (session user); `audit_logs` has no INSERT policy for users
- Fix: changed to `createAdminClient()` (service role bypasses RLS)
- Commit: `cfe965e`

#### Auth trigger robustness
- `handle_new_user` trigger could roll back auth user creation if profile insert failed
- Fix: added `ON CONFLICT DO NOTHING` + `EXCEPTION WHEN OTHERS THEN RAISE WARNING; RETURN NEW`
- Commit: `100cd04`

### Phase 13 — Hardening Pass 2 (2026-03-26)

- Rate limiting: `POST /api/notes/[noteId]/summarize` — max 5 req/user/60s; returns 429
- Pagination: `GET /api/notes` and `GET /api/files` — `page`/`limit` params with `pagination` metadata
- Input validation: note title capped at 255 chars, content at 500k chars (both endpoints)
- Notes list UI: paginated load-more (50 per page) replaces unbounded fetch
- All REVIEW.md "would review next" items now resolved

### Key Decisions Made During Build
- Reordered tag+note update to fix search vector correctness (BUG-006)
- Chose placeholder Supabase env var fallbacks over throwing at build time (BUG-005)
- Used admin client for org creation to close RLS race window (BUG-002 mitigation)
- `logAudit()` designed to never throw — logging must not break primary operations
- All trigger functions that INSERT/UPDATE RLS-protected tables must be `SECURITY DEFINER`
- In-memory rate limiter is sufficient for single-process deployment; Redis would be needed for multi-instance
