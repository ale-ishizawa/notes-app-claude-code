# AI_USAGE.md — Agent Usage Documentation

## Agents Used

- **Claude Code (Sonnet 4.6) — Primary orchestrator:** End-to-end planning, implementation, review, and git management across all 11 phases. Ran in a single long-lived session with full context of all files.
- **Claude Code subagents (Explore type):** Launched in parallel for codebase exploration during planning phase — searching for existing file patterns, verifying directory structure, and cross-referencing TypeScript config options.
- **Claude Code subagents (Plan type):** Used for architecture planning — analyzing PDF requirements, designing the data model, and mapping requirements to implementation phases before any code was written.
- **Context-mode MCP (ctx_batch_execute, ctx_search):** Used throughout to run shell commands and index large output (migrations, API routes) without flooding the primary context window. Allowed reviewing 6 files simultaneously in one round-trip.

---

## How Work Was Split

| Phase | How agent was used |
|-------|-------------------|
| Requirements analysis | Agent read both PDFs, extracted explicit + implied requirements, asked 3 clarifying questions |
| Architecture design | Agent designed full data model, RLS strategy, search approach, and 23-commit roadmap before writing any code |
| Schema + migrations | Agent wrote all 10 tables, triggers, helper functions, and RLS policies in one migration file |
| Auth + org tenancy | Agent implemented login/signup pages, middleware, org context, org switcher, and all membership API routes |
| Notes CRUD | Agent implemented full notes API (create, read, update, delete) with visibility controls, tagging, sharing |
| Versioning + diffs | Agent implemented BEFORE UPDATE trigger for versioning, version history UI, and diff-match-patch diff viewer |
| Search | Agent implemented FTS page using Supabase `textSearch` with tsvector/GIN — permission-safe via RLS |
| File uploads | Agent implemented Supabase Storage upload/download with signed URLs, org-scoped paths |
| AI summaries | Agent implemented OpenAI GPT-4o-mini integration with structured JSON output and accept/reject flow |
| Logging | Agent wired audit log calls to all mutation routes; `logAudit()` helper never throws |
| Seed script | Agent generated ~10k-note seed script with batch inserts, versions, shares, AI summaries |
| Docker | Agent wrote multi-stage Dockerfile with standalone Next.js output and non-root user |
| Hardening | Agent reviewed all security-critical paths, identified 6 bugs, fixed 4 in-place |

---

## What Ran in Parallel

- Auth pages (login, signup) + Supabase lib files (client, server, middleware) + type definitions — all created in parallel in Phase 2
- Multiple API routes within the same phase were designed together and written in parallel batches
- Context-mode `ctx_batch_execute` ran 6 file reads simultaneously during the security review pass

---

## Where Agents Were Wrong

- **TypeScript 6 strict CSS import** — Agent did not anticipate that TypeScript 6 would reject `.css` module imports without a type declaration. Required adding `src/types/css.d.ts`. (Fixed: commit a9ee8a4)
- **Supabase client throws at build time** — Agent's initial client code threw at prerender time when env vars were absent. Required adding placeholder fallbacks. (Fixed: commit a9ee8a4)
- **search_vector tag ordering (BUG-006)** — Agent wrote the PATCH handler with tags updated after the note, causing the search trigger to see stale tags. Caught during hardening review. (Fixed: hardening phase)
- **No file upload guards** — Agent implemented file upload without size or MIME validation. Identified and fixed during hardening. (BUG-001, BUG-003)

---

## Where I Intervened

- **OpenAI over Claude API** — User chose OpenAI GPT-4 for AI summaries instead of the default Claude API suggestion
- **Local Supabase over hosted** — User chose `supabase start` for full local control instead of Supabase cloud
- **Deferred Railway deployment** — User chose to skip Railway deployment and focus on code correctness + Docker
- **Context window management** — Used context-mode MCP tools to prevent large file reads from exhausting primary context

---

## What I Don't Trust Agents To Do Without Manual Review

- Write correct RLS policies without review — tenant isolation is the highest-stakes correctness requirement
- Verify storage policies are actually enforced by Supabase — must test with a running instance
- Guarantee no cross-org data leakage in search — needs end-to-end tests with separate user sessions
- Parse and validate OpenAI JSON output reliably at all edge cases — needs live testing
- Run seed scripts at 10k scale without performance issues — trigger overhead is unknown until tested
