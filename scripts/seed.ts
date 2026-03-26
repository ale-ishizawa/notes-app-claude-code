/**
 * Seed script — generates ~10k notes across 4 orgs for review/search testing.
 * Uses service role key to bypass RLS.
 *
 * Run: npm run seed
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Seed Data Definitions ────────────────────────────────────────────────────

const ORGS = [
  { name: 'Acme Corp', slug: 'acme-corp' },
  { name: 'Globex Inc', slug: 'globex-inc' },
  { name: 'Initech', slug: 'initech' },
  { name: 'Umbrella Corp', slug: 'umbrella-corp' },
]

const USERS = [
  { email: 'alice@example.com', password: 'password123', full_name: 'Alice Johnson' },
  { email: 'bob@example.com', password: 'password123', full_name: 'Bob Smith' },
  { email: 'carol@example.com', password: 'password123', full_name: 'Carol White' },
  { email: 'dave@example.com', password: 'password123', full_name: 'Dave Brown' },
  { email: 'eve@example.com', password: 'password123', full_name: 'Eve Davis' },
  { email: 'frank@example.com', password: 'password123', full_name: 'Frank Wilson' },
  { email: 'grace@example.com', password: 'password123', full_name: 'Grace Lee' },
  { email: 'henry@example.com', password: 'password123', full_name: 'Henry Taylor' },
]

// Overlapping tags across orgs (as required by spec)
const ALL_TAGS = [
  'design', 'product', 'engineering', 'marketing', 'sales', 'q1', 'q2', 'q3', 'q4',
  'planning', 'retrospective', 'roadmap', 'bug', 'feature', 'research', 'meeting',
  'onboarding', 'security', 'performance', 'ux', 'backend', 'frontend', 'api',
  'database', 'infrastructure', 'ops', 'finance', 'legal', 'hr', 'strategy',
]

const NOTE_TEMPLATES = [
  { title: 'Sprint Planning', content: 'Team capacity: {n} points. Goals: deliver auth, search, and file upload features. Dependencies: design review by {date}.' },
  { title: 'Architecture Decision Record', content: 'Decision: use Postgres full-text search over Elasticsearch. Rationale: native RLS integration, sufficient for {n}k documents, no additional infrastructure.' },
  { title: 'Bug Report: Login Flow', content: 'Users report intermittent 401 errors on session refresh. Root cause: missing cookie SameSite attribute. Fix: add SameSite=Lax. Priority: high.' },
  { title: 'Product Roadmap Q{q}', content: 'Theme: {theme}. Key initiatives: (1) user growth, (2) feature completeness, (3) performance. Target: {n}% improvement in key metrics.' },
  { title: 'Meeting Notes — {team}', content: 'Attendees: {n} people. Discussed: OKR progress, blockers, next steps. Action items: update roadmap, schedule follow-up.' },
  { title: 'Research: {topic}', content: 'Objective: understand user needs around {topic}. Methods: user interviews (n={n}), survey analysis. Key finding: simplicity matters most.' },
  { title: 'Security Review', content: 'Reviewed authentication, authorization, and data handling. Findings: {n} issues (2 critical, 3 medium). All critical issues resolved this sprint.' },
  { title: 'Performance Analysis', content: 'P99 latency: {n}ms. Throughput: {m}k RPS. Bottleneck: database query on notes table (no GIN index). Fix: add tsvector index.' },
  { title: 'Onboarding Checklist', content: 'Day 1: setup env, read docs. Week 1: ship first PR. Month 1: own a feature. Key contacts: engineering ({eng}), product ({pm}).' },
  { title: 'Weekly Update — {team}', content: 'Done: shipped {n} features, fixed {m} bugs. In progress: search implementation. Blocked: waiting on design sign-off.' },
  { title: 'Technical Debt Inventory', content: 'Total items: {n}. Critical: {m}. This quarter goal: reduce by 20%. Priority areas: auth, file handling, search queries.' },
  { title: 'OKR Review', content: 'Objective: {objective}. KR1: {n}% done. KR2: {m}% done. KR3: on track. Overall confidence: high.' },
]

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = randomInt(min, max)
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function fillTemplate(template: string): string {
  const teams = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales']
  const topics = ['user research', 'competitor analysis', 'market fit', 'technical architecture', 'pricing strategy']
  const themes = ['Growth', 'Reliability', 'User Delight', 'Platform Expansion']
  const objectives = ['Increase user retention', 'Reduce churn', 'Expand to new markets', 'Improve developer experience']

  return template
    .replace(/{n}/g, String(randomInt(10, 100)))
    .replace(/{m}/g, String(randomInt(3, 50)))
    .replace(/{q}/g, String(randomInt(1, 4)))
    .replace(/{date}/g, '2024-Q2')
    .replace(/{team}/g, randomItem(teams))
    .replace(/{topic}/g, randomItem(topics))
    .replace(/{theme}/g, randomItem(themes))
    .replace(/{objective}/g, randomItem(objectives))
    .replace(/{eng}/g, 'alice@example.com')
    .replace(/{pm}/g, 'bob@example.com')
}

async function createUser(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error && !error.message.includes('already registered')) {
    console.error(`Failed to create user ${email}:`, error.message)
    return null
  }
  if (data.user) return data.user.id

  // User exists — look up by email
  const { data: { users } } = await supabase.auth.admin.listUsers()
  return users.find(u => u.email === email)?.id ?? null
}

async function batchInsert<T extends object>(table: string, rows: T[], batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase.from(table).insert(batch)
    if (error) {
      console.error(`Batch insert into ${table} failed:`, error.message)
    }
    process.stdout.write(`\r  ${table}: ${Math.min(i + batchSize, rows.length)}/${rows.length}`)
  }
  console.log()
}

async function main() {
  console.log('🌱 Starting seed...\n')

  // ── Create users ────────────────────────────────────────────────────────────
  console.log('Creating users...')
  const userIds: string[] = []
  for (const u of USERS) {
    const id = await createUser(u.email, u.password, u.full_name)
    if (id) userIds.push(id)
    else console.warn(`  Skipped: ${u.email}`)
  }
  console.log(`  Created/found ${userIds.length} users`)

  if (userIds.length < 2) {
    console.error('Not enough users to seed. Aborting.')
    process.exit(1)
  }

  // ── Create orgs ─────────────────────────────────────────────────────────────
  console.log('Creating organizations...')
  const orgIds: string[] = []
  for (const org of ORGS) {
    const { data, error } = await supabase
      .from('organizations')
      .upsert({ name: org.name, slug: org.slug, created_by: userIds[0] }, { onConflict: 'slug' })
      .select('id')
      .single()
    if (error) console.warn(`  Failed to create org ${org.name}:`, error.message)
    else orgIds.push(data.id)
  }
  console.log(`  Created/found ${orgIds.length} orgs`)

  // ── Assign memberships ──────────────────────────────────────────────────────
  console.log('Assigning memberships...')
  // Distribution:
  // Acme: alice(owner), bob(admin), carol(member), eve(viewer)
  // Globex: carol(owner), alice(member), frank(admin), eve(viewer)
  // Initech: bob(owner), dave(member), grace(admin), henry(member)
  // Umbrella: dave(owner), henry(admin), grace(member), frank(member)
  const memberships = [
    // Acme (orgIds[0])
    { org_id: orgIds[0], user_id: userIds[0], role: 'owner' },
    { org_id: orgIds[0], user_id: userIds[1], role: 'admin' },
    { org_id: orgIds[0], user_id: userIds[2], role: 'member' },
    { org_id: orgIds[0], user_id: userIds[4], role: 'viewer' },
    // Globex (orgIds[1])
    { org_id: orgIds[1], user_id: userIds[2], role: 'owner' },
    { org_id: orgIds[1], user_id: userIds[0], role: 'member' },
    { org_id: orgIds[1], user_id: userIds[5], role: 'admin' },
    { org_id: orgIds[1], user_id: userIds[4], role: 'viewer' },
    // Initech (orgIds[2])
    { org_id: orgIds[2], user_id: userIds[1], role: 'owner' },
    { org_id: orgIds[2], user_id: userIds[3], role: 'member' },
    { org_id: orgIds[2], user_id: userIds[6], role: 'admin' },
    { org_id: orgIds[2], user_id: userIds[7], role: 'member' },
    // Umbrella (orgIds[3])
    { org_id: orgIds[3], user_id: userIds[3], role: 'owner' },
    { org_id: orgIds[3], user_id: userIds[7], role: 'admin' },
    { org_id: orgIds[3], user_id: userIds[6], role: 'member' },
    { org_id: orgIds[3], user_id: userIds[5], role: 'member' },
  ].filter(m => m.org_id && m.user_id)

  const { error: memberError } = await supabase
    .from('organization_members')
    .upsert(memberships, { onConflict: 'org_id,user_id' })
  if (memberError) console.warn('  Membership insert warning:', memberError.message)
  console.log(`  Assigned ${memberships.length} memberships`)

  // ── Generate ~10k notes ─────────────────────────────────────────────────────
  console.log('\nGenerating notes...')
  const TOTAL_NOTES = 10000
  const notesPerOrg = Math.floor(TOTAL_NOTES / orgIds.length)
  const visibilities: Array<'private' | 'shared' | 'org'> = ['org', 'org', 'org', 'private', 'private', 'shared']

  const notesToInsert = []
  const orgMemberMap: Record<string, string[]> = {}

  // Pre-compute org member lists for note assignment
  for (let i = 0; i < orgIds.length; i++) {
    orgMemberMap[orgIds[i]] = memberships
      .filter(m => m.org_id === orgIds[i] && m.role !== 'viewer')
      .map(m => m.user_id)
  }

  for (const orgId of orgIds) {
    const orgMembers = orgMemberMap[orgId]
    if (!orgMembers.length) continue

    for (let i = 0; i < notesPerOrg; i++) {
      const template = randomItem(NOTE_TEMPLATES)
      notesToInsert.push({
        org_id: orgId,
        title: fillTemplate(template.title),
        content: fillTemplate(template.content) + '\n\n' + fillTemplate(template.content),
        visibility: randomItem(visibilities),
        created_by: randomItem(orgMembers),
        updated_by: randomItem(orgMembers),
        version: 1,
      })
    }
  }

  // Disable triggers temporarily for bulk insert by using direct SQL
  // We'll insert without search_vector — then update in batches
  console.log(`  Inserting ${notesToInsert.length} notes...`)
  const noteIds: string[] = []
  const BATCH = 500
  for (let i = 0; i < notesToInsert.length; i += BATCH) {
    const batch = notesToInsert.slice(i, i + BATCH)
    const { data, error } = await supabase.from('notes').insert(batch).select('id')
    if (error) {
      console.error(`  Note batch failed:`, error.message)
    } else {
      noteIds.push(...(data ?? []).map((n: { id: string }) => n.id))
    }
    process.stdout.write(`\r  notes: ${Math.min(i + BATCH, notesToInsert.length)}/${notesToInsert.length}`)
  }
  console.log(`\n  Inserted ${noteIds.length} notes`)

  // ── Generate tags ────────────────────────────────────────────────────────────
  console.log('Generating tags...')
  const tagRows = []
  for (const noteId of noteIds.slice(0, 8000)) { // Tag 80% of notes
    const selectedTags = randomSubset(ALL_TAGS, 1, 4)
    for (const tag of selectedTags) {
      tagRows.push({ note_id: noteId, tag })
    }
  }
  await batchInsert('note_tags', tagRows)
  console.log(`  Inserted ${tagRows.length} tags`)

  // ── Generate note versions ──────────────────────────────────────────────────
  console.log('Generating note versions...')
  const versionRows = []
  const notesWithVersions = noteIds.slice(0, 500) // ~500 notes with history
  for (const noteId of notesWithVersions) {
    const versionCount = randomInt(1, 4)
    const noteInfo = notesToInsert[noteIds.indexOf(noteId)]
    const orgMembers = orgMemberMap[noteInfo?.org_id] ?? [userIds[0]]

    for (let v = 1; v <= versionCount; v++) {
      versionRows.push({
        note_id: noteId,
        version: v,
        title: fillTemplate(randomItem(NOTE_TEMPLATES).title),
        content: fillTemplate(randomItem(NOTE_TEMPLATES).content),
        changed_by: randomItem(orgMembers),
        change_summary: v === 1 ? 'Initial version' : `Updated content (v${v})`,
      })
    }
  }
  await batchInsert('note_versions', versionRows)
  console.log(`  Inserted ${versionRows.length} versions across ${notesWithVersions.length} notes`)

  // ── Generate note shares ─────────────────────────────────────────────────────
  console.log('Generating note shares...')
  const shareRows = []
  const sharedNotes = noteIds.slice(0, 200)
  for (const noteId of sharedNotes) {
    const noteInfo = notesToInsert[noteIds.indexOf(noteId)]
    if (!noteInfo) continue
    const orgMembers = orgMemberMap[noteInfo.org_id] ?? []
    if (orgMembers.length < 2) continue
    const shareWith = randomItem(orgMembers.filter(id => id !== noteInfo.created_by))
    if (shareWith) {
      shareRows.push({ note_id: noteId, shared_with: shareWith })
    }
  }
  // Deduplicate
  const uniqueShares = shareRows.filter((v, i, a) =>
    a.findIndex(s => s.note_id === v.note_id && s.shared_with === v.shared_with) === i
  )
  await batchInsert('note_shares', uniqueShares)
  console.log(`  Inserted ${uniqueShares.length} note shares`)

  // ── Generate AI summaries ───────────────────────────────────────────────────
  console.log('Generating AI summaries...')
  const summaryStatuses: Array<'completed' | 'accepted' | 'rejected'> = ['completed', 'completed', 'accepted', 'accepted', 'rejected']
  const summaryRows = noteIds.slice(0, 20).map((noteId, i) => {
    const noteInfo = notesToInsert[i]
    const orgMembers = orgMemberMap[noteInfo?.org_id] ?? [userIds[0]]
    const status = randomItem(summaryStatuses)
    return {
      note_id: noteId,
      org_id: noteInfo?.org_id ?? orgIds[0],
      summary: {
        summary: `This note covers ${randomItem(['planning', 'technical', 'research', 'operational'])} topics relevant to the team.`,
        key_points: ['Point 1: Key finding', 'Point 2: Important detail', 'Point 3: Next step'],
        action_items: ['Follow up with stakeholders', 'Update documentation'],
        topics: randomSubset(ALL_TAGS, 2, 4),
      },
      status,
      requested_by: randomItem(orgMembers),
      accepted_by: status === 'accepted' ? randomItem(orgMembers) : null,
      model: 'gpt-4o-mini',
      tokens_used: randomInt(200, 600),
    }
  })
  await batchInsert('ai_summaries', summaryRows)

  // ── Generate audit logs ─────────────────────────────────────────────────────
  console.log('Generating audit logs...')
  const auditActions = ['note.create', 'note.update', 'file.upload', 'auth.login', 'note.share', 'ai.summary_request']
  const auditRows = Array.from({ length: 200 }, (_, i) => {
    const orgIdx = i % orgIds.length
    const orgId = orgIds[orgIdx]
    const orgMembers = orgMemberMap[orgId] ?? [userIds[0]]
    return {
      org_id: orgId,
      user_id: randomItem(orgMembers),
      action: randomItem(auditActions),
      resource_type: 'note',
      resource_id: noteIds[i] ?? null,
      metadata: {},
      ip_address: `10.0.0.${randomInt(1, 254)}`,
    }
  })
  await batchInsert('audit_logs', auditRows)

  console.log('\n✅ Seed complete!')
  console.log(`\nDemo credentials:`)
  USERS.forEach(u => console.log(`  ${u.email} / ${u.password}`))
  console.log(`\nOrganizations:`)
  ORGS.forEach((o, i) => console.log(`  ${o.name} (${orgIds[i] ?? 'no id'})`))
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
