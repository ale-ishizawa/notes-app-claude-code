# BUGS.md — Bugs Found During Review

Tracking bugs discovered during code review, with descriptions, impact, and fix references.

---

### BUG-001: No file size validation on upload
- **Severity:** Medium
- **Found in:** `src/app/api/files/route.ts` (POST handler)
- **Impact:** A user with write access can upload arbitrarily large files, exhausting Supabase Storage quota and causing denial of service for all org members.
- **Root cause:** The upload handler passes the file directly to Supabase Storage without checking `file.size` against a maximum threshold. No storage size policy was set in the migration.
- **Fix:** Add a 50 MB server-side guard (`if (file.size > MAX_FILE_SIZE) return 413`) before the Supabase upload call.
- **Commit:** Identified post-commit ffbe07c; fix pending in hardening phase

---

### BUG-002: Race condition in org_members_insert RLS allows joining any empty org
- **Severity:** Low
- **Found in:** `supabase/migrations/20240101000000_initial_schema.sql` (org_members_insert policy)
- **Impact:** The self-join clause `NOT EXISTS (SELECT 1 FROM organization_members WHERE org_id = ...)` allows any authenticated user to insert themselves as a member of any org with zero members. If the org creation and first membership insert are not atomic, a second user could join before the owner membership is written.
- **Root cause:** The condition checks for zero members org-wide rather than scoping to the creating user.
- **Fix:** The `/api/orgs` POST route uses the admin (service role) client to insert owner membership immediately after org creation within the same request, closing the race window in practice. The RLS clause remains a latent risk if org creation is refactored.
- **Commit:** e661e44 (schema); mitigated by API route design

---

### BUG-003: Client-supplied MIME type stored without server-side validation
- **Severity:** Low
- **Found in:** `src/app/api/files/route.ts` (POST handler)
- **Impact:** The `mime_type` field is taken directly from `file.type` in FormData, which is client-controlled. A user could upload an HTML or script file with `image/png` as the declared type.
- **Root cause:** No server-side MIME validation or magic-byte checking was implemented.
- **Fix:** Add an allowlist check of `file.type` against known safe MIME types (images, PDFs, plain text, Office formats) before upload; reject with 415 Unsupported Media Type otherwise.
- **Commit:** Identified post-commit ffbe07c; fix pending in hardening phase

---

### BUG-004: TypeScript build error — CSS module import not recognized
- **Severity:** Low (build-time only, no runtime impact)
- **Found in:** `src/app/layout.tsx` importing `globals.css`
- **Impact:** TypeScript 6 strict mode does not recognize `.css` imports, causing `tsc` to fail during `next build`.
- **Root cause:** Next.js uses Webpack/Turbopack for CSS resolution; TypeScript has no built-in CSS module type and TypeScript 6 tightened this.
- **Fix:** Added `src/types/css.d.ts` with `declare module '*.css'`.
- **Commit:** a9ee8a4

---

### BUG-005: Supabase client throws during Next.js static prerender without env vars
- **Severity:** Low (breaks Docker build and CI without env vars)
- **Found in:** `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`
- **Impact:** `@supabase/ssr` throws "Your project's URL and API key are required" at build time if Supabase env vars are not set, breaking Docker and CI pipelines.
- **Root cause:** `createBrowserClient` / `createServerClient` validate arguments eagerly at construction time.
- **Fix:** Added `?? 'http://localhost:54321'` and `?? 'placeholder-anon-key'` fallbacks. Authenticated routes are never statically rendered so the placeholders never serve real requests.
- **Commit:** a9ee8a4

---

### BUG-006: search_vector may not include new tags if tag inserts follow note update
- **Severity:** Medium
- **Found in:** `src/app/api/notes/[noteId]/route.ts` (PATCH handler)
- **Impact:** When updating a note, the `trg_note_search_vector` trigger fires on the `UPDATE notes` statement and reads current `note_tags` rows. If new tags are inserted after the note update, they are missing from the search vector until the next tag change fires `trg_note_tags_search`.
- **Root cause:** PATCH handler order: (1) update note, (2) delete old tags, (3) insert new tags — the trigger fires during step 1 before new tags exist.
- **Fix:** Reorder PATCH handler to: (1) delete old tags, (2) insert new tags, (3) update note content — so `trg_note_search_vector` sees the correct tag set when it fires.
- **Commit:** Identified in review; fix applied to route handler
