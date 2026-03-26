# AI_USAGE.md — Agent Usage Documentation

## Agents Used
- **Claude Code (Opus 4.6):** Primary coding agent — planning, implementation, review, git management
- **Claude Code subagents:** Used for parallel exploration and architecture planning

## How Work Was Split
- Architecture planning: Single agent session analyzing PDFs, designing schema, planning phases
- Implementation: Sequential phase execution with frequent commits
- Review: Continuous review during implementation, with dedicated hardening phase

## What Ran in Parallel
- Multiple file creation operations in Phase 1 (config files, UI components, lib files)
- Exploration agents for codebase analysis (during planning phase)

## Where Agents Were Wrong
*(Updated throughout the build)*
- TypeScript 6 strict CSS import checking — agent initially didn't account for this, required adding `css.d.ts` type declaration

## Where I Intervened
*(Updated throughout the build)*
- Chose OpenAI over Claude API for summaries (user preference)
- Chose local Supabase over hosted (user preference)
- Deferred Railway deployment (user preference)

## What I Don't Trust Agents To Do
- Write correct RLS policies without manual review — tenant isolation is critical
- Handle edge cases in permission enforcement — must verify cross-org leakage manually
- Generate seed data that properly exercises all visibility/sharing permutations
- Write correct diff rendering without testing with real data
