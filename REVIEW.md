# REVIEW.md — Review Documentation

## What Was Reviewed Deeply

### RLS Policies (`supabase/migrations/20240101000000_initial_schema.sql`)
- Every table has RLS enabled — verified no table is accidentally left open
- `notes_select` policy: verified that all three visibility branches (org, private, shared) are correct; `can_view_note()` helper function checked line by line
- `organization_members` insert policy: identified race condition (BUG-002) — mitigated by API-level admin client use
- `note_versions_select`: relies on `notes` RLS via subquery — confirmed this is safe because the subquery is evaluated under the caller's session
- `ai_summaries`: both select and insert policies check org membership AND delegate note visibility to the notes RLS subquery — confirmed no cross-org leakage
- `audit_logs_select`: only owner/admin roles can see logs — verified against the role hierarchy

### Permission checks in API routes
- `POST /api/notes` — checks org membership + rejects `viewer` role before insert
- `PATCH /api/notes/[noteId]` — RLS on the initial fetch enforces read access; update goes through RLS
- `DELETE /api/notes/[noteId]` — RLS enforces delete policy at DB level
- `POST /api/notes/[noteId]/summarize` — explicitly fetches membership + rejects `viewer` before any OpenAI call; note content is never sent to OpenAI without this check
- `POST /api/notes/[noteId]/share` — verifies target user is in same org before inserting share; prevents cross-org share
- `POST /api/files` — checks membership + role; now also enforces file size and MIME type (BUG-001, BUG-003 fixed)
- `GET /api/files/[fileId]` — returns signed URL; storage path is UUID-based, not guessable

### search_vector trigger ordering (BUG-006)
- Confirmed that `trg_note_search_vector` fires on `UPDATE OF title, content` and reads `note_tags` at that moment
- Identified that the PATCH handler was updating the note before updating tags — fixed by reordering operations

### Seed script (`scripts/seed.ts`)
- Verified org/user/role assignments are consistent: each user inserted into `organization_members` with correct `org_id`
- Verified batch insert logic doesn't exceed Supabase's default request limits (500-row batches)
- Verified seed uses service role key (bypasses RLS correctly)

---

## What Was Sampled

- `src/app/(dashboard)/notes/[noteId]/page.tsx` — reviewed note detail UI; confirmed visibility radio, tag editor, share panel, version timeline, diff viewer, and AI summary flow are all wired to the correct API endpoints
- `src/components/notes/diff-viewer.tsx` — reviewed diff rendering using `diff-match-patch`; confirmed old/new version ordering is correct
- `src/app/(auth)/` — sampled login/signup pages; standard Supabase auth flow
- `src/app/(dashboard)/layout.tsx` — sampled org resolution from cookie; confirmed that all memberships are fetched server-side, active org validated against real membership list
- `docker-compose.yml` / `Dockerfile` — verified multi-stage build, non-root user, healthcheck on `/api/health`

---

## Risky Areas and Findings

| Area | Risk | Finding |
|------|------|---------|
| RLS tenant isolation | CRITICAL | Policies are correct; no cross-org leakage found |
| Search across orgs | HIGH | FTS query goes through RLS automatically — safe |
| File storage paths | HIGH | UUID-based paths + signed URLs — not guessable |
| AI summary permission | HIGH | Viewer check is in route before OpenAI call — correct |
| File upload size/type | MEDIUM | **BUG-001 + BUG-003** — fixed in hardening phase |
| search_vector tag ordering | MEDIUM | **BUG-006** — fixed in hardening phase |
| org_members self-join race | LOW | **BUG-002** — mitigated by API design; noted |
| MIME type spoofing | LOW | **BUG-003** — fixed in hardening phase |

---

## What Is Still Untrusted

- **Supabase Storage policies** — the migration defines them via SQL, but they have not been tested end-to-end with a running Supabase instance. Storage policies are separate from table RLS and require live verification.
- **OpenAI response parsing** — the `response_format: json_object` mode is used, but malformed or unexpected JSON from the model could cause silent failures. The route has a try/catch but the fallback behavior has not been tested.
- **Diff viewer with very large notes** — `diff-match-patch` is client-side; extremely large diffs (100k+ chars) could cause browser jank. Not tested at scale.
- **Seed script at 10k scale** — the batching logic is correct but has not been run against a live Supabase instance. Trigger overhead at insert time is unknown.

---

## What Would Be Reviewed Next With More Time

1. **End-to-end RLS testing** — write a test script that creates two users in different orgs and asserts they cannot read each other's notes, files, or summaries via the Supabase JS client (not the admin client).
2. **Storage policy verification** — deploy to a local Supabase instance and verify that the `note-files` bucket policies actually block cross-org access via signed URL guessing.
3. ~~**Rate limiting on AI routes**~~ — **Fixed:** `POST /api/notes/[noteId]/summarize` now enforces max 5 requests/user/60 s (in-memory, returns 429).
4. ~~**Input length caps**~~ — **Fixed:** `POST /api/notes` and `PATCH /api/notes/[noteId]` now reject title >255 chars (400) and content >500k chars (400).
5. ~~**Pagination on list endpoints**~~ — **Fixed:** `GET /api/notes` and `GET /api/files` now accept `page`/`limit` params and return `pagination` metadata.
