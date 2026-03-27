# TeamNotes — Multi-Tenant Team Notes App

A full-stack collaborative notes application with multi-tenancy, RBAC, versioning, full-text search, file uploads, and AI-powered summaries.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **AI:** OpenAI GPT-4 for structured note summaries
- **Search:** PostgreSQL full-text search (tsvector + GIN index)
- **Deployment:** Docker, Railway-ready

## Features

- **Multi-tenancy:** Users belong to multiple organizations with role-based access (owner, admin, member, viewer)
- **Notes:** Full CRUD with tagging, visibility controls (private, shared, org), and selective sharing
- **Versioning:** Immutable version history with who/what/when tracking and diff viewing
- **Search:** Full-text search across titles, content, and tags — respects org boundaries and permissions
- **File Uploads:** Org-scoped file attachments with permission-safe access via signed URLs
- **AI Summaries:** Structured summaries with selective accept/reject — permission-safe
- **Audit Logging:** Auth events, mutations, AI requests, failures, and permission denials

## Prerequisites

- Node.js 20+
- Docker (for local Supabase)
- Supabase CLI (`npm install -g supabase`)
- OpenAI API key

## Setup

```bash
# Clone and install
git clone <repo-url>
cd note-app
npm install

# Start local Supabase
supabase start

# Copy env and fill in keys from `supabase status`
cp .env.example .env.local

# Run migrations
supabase db reset

# Seed data (~10k notes)
npm run seed

# Start dev server
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL (local: `http://localhost:54321`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (from `supabase status`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (from `supabase status`) |
| `OPENAI_API_KEY` | OpenAI API key for AI summaries |

## Demo Credentials (after seeding)

| Email | Password | Orgs |
|-------|----------|------|
| `alice@example.com` | `password123` | Acme Corp (owner), Globex Inc (member) |
| `bob@example.com` | `password123` | Acme Corp (admin), Initech (owner) |
| `carol@example.com` | `password123` | Globex Inc (owner), Umbrella Corp (member) |
| `dave@example.com` | `password123` | Initech (member), Umbrella Corp (owner) |
| `eve@example.com` | `password123` | Acme Corp (viewer), Globex Inc (viewer) |

## Docker

```bash
docker build -t teamnotes .
docker run -p 3000:3000 --env-file .env.local teamnotes
```

## Railway Deployment

Railway deploys directly from the Dockerfile. `railway.json` is pre-configured with health checks and restart policies.

### Step 1 — Create a Supabase cloud project

1. Go to [supabase.com](https://supabase.com) → New project
2. Once provisioned, open **SQL Editor** and run the full contents of `supabase/migrations/20240101000000_initial_schema.sql`
3. Go to **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`
4. Go to **Storage** → create a bucket named `note-files` (set to private)

### Step 2 — Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project and link repo
railway init

# Set environment variables
railway variables set NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
railway variables set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
railway variables set OPENAI_API_KEY=sk-...

# Deploy
railway up
```

Or via the Railway dashboard: create a new project → **Deploy from GitHub repo** → add the four env vars above → Railway auto-detects the Dockerfile and deploys.

### Step 3 — Verify

Once deployed, visit `https://<your-app>.railway.app/api/health` — should return `{"status":"ok"}`.

Then sign up for a new account and create your first organization.

> **Note:** The seed script (`npm run seed`) requires a `DATABASE_URL` pointing to the Supabase cloud Postgres instance. Find it in **Project Settings → Database → Connection string (URI)**. Run locally with `DATABASE_URL=<url> npm run seed`.

## Architecture

See [NOTES.md](NOTES.md) for detailed architecture decisions and reasoning.
