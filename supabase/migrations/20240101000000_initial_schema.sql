-- ============================================================================
-- Multi-Tenant Team Notes App — Initial Schema
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 2. ORGANIZATIONS
-- ============================================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

-- ============================================================================
-- 3. ORGANIZATION MEMBERS
-- ============================================================================
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(org_id);

-- ============================================================================
-- 4. NOTES
-- ============================================================================
CREATE TYPE note_visibility AS ENUM ('private', 'shared', 'org');

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  visibility note_visibility NOT NULL DEFAULT 'private',
  created_by UUID NOT NULL REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  version INT NOT NULL DEFAULT 1,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_org ON notes(org_id);
CREATE INDEX idx_notes_created_by ON notes(created_by);
CREATE INDEX idx_notes_search ON notes USING GIN(search_vector);
CREATE INDEX idx_notes_updated_at ON notes(org_id, updated_at DESC);

-- ============================================================================
-- 5. NOTE TAGS
-- ============================================================================
CREATE TABLE note_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  UNIQUE(note_id, tag)
);

CREATE INDEX idx_note_tags_tag ON note_tags(tag);
CREATE INDEX idx_note_tags_note ON note_tags(note_id);

-- ============================================================================
-- 6. NOTE SHARES (selective sharing within org)
-- ============================================================================
CREATE TABLE note_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(note_id, shared_with)
);

CREATE INDEX idx_note_shares_user ON note_shares(shared_with);
CREATE INDEX idx_note_shares_note ON note_shares(note_id);

-- ============================================================================
-- 7. NOTE VERSIONS (immutable revision history)
-- ============================================================================
CREATE TABLE note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  version INT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(id),
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(note_id, version)
);

CREATE INDEX idx_note_versions_note ON note_versions(note_id, version DESC);

-- ============================================================================
-- 8. NOTE FILES
-- ============================================================================
CREATE TABLE note_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_note_files_note ON note_files(note_id);
CREATE INDEX idx_note_files_org ON note_files(org_id);

-- ============================================================================
-- 9. AI SUMMARIES
-- ============================================================================
CREATE TYPE summary_status AS ENUM ('pending', 'completed', 'accepted', 'rejected');

CREATE TABLE ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  summary JSONB NOT NULL DEFAULT '{}',
  status summary_status NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL REFERENCES profiles(id),
  accepted_by UUID REFERENCES profiles(id),
  model TEXT,
  tokens_used INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_summaries_note ON ai_summaries(note_id);

-- ============================================================================
-- 10. AUDIT LOGS
-- ============================================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update search_vector on note insert/update
CREATE OR REPLACE FUNCTION update_note_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_note_search_vector
  BEFORE INSERT OR UPDATE OF title, content ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_note_search_vector();

-- Update search_vector when tags change
CREATE OR REPLACE FUNCTION update_note_search_from_tags()
RETURNS TRIGGER AS $$
DECLARE
  note_record RECORD;
BEGIN
  -- Get the note_id depending on operation
  IF TG_OP = 'DELETE' THEN
    SELECT id, title, content INTO note_record FROM notes WHERE id = OLD.note_id;
  ELSE
    SELECT id, title, content INTO note_record FROM notes WHERE id = NEW.note_id;
  END IF;

  IF note_record.id IS NOT NULL THEN
    UPDATE notes SET
      search_vector =
        setweight(to_tsvector('english', COALESCE(note_record.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(note_record.content, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(
          (SELECT string_agg(tag, ' ') FROM note_tags WHERE note_id = note_record.id), ''
        )), 'A'),
      updated_at = now()
    WHERE id = note_record.id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_note_tags_search
  AFTER INSERT OR UPDATE OR DELETE ON note_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_note_search_from_tags();

-- Create note version on update (BEFORE UPDATE trigger)
CREATE OR REPLACE FUNCTION create_note_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO note_versions (note_id, version, title, content, changed_by, change_summary)
    VALUES (OLD.id, OLD.version, OLD.title, OLD.content, COALESCE(NEW.updated_by, OLD.created_by), NULL);
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_note_version
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION create_note_version();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_ai_summaries_updated_at
  BEFORE UPDATE ON ai_summaries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Helper: check if user is member of an org
CREATE OR REPLACE FUNCTION is_org_member(org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE org_id = org_uuid AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: get user's role in an org
CREATE OR REPLACE FUNCTION get_org_role(org_uuid UUID)
RETURNS org_role AS $$
DECLARE
  user_role org_role;
BEGIN
  SELECT role INTO user_role FROM organization_members
  WHERE org_id = org_uuid AND user_id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: check note_shares without triggering notes RLS (breaks recursion cycle)
CREATE OR REPLACE FUNCTION is_note_shared_with_me(note_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM note_shares
    WHERE note_id = note_uuid AND shared_with = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if user can view a note
CREATE OR REPLACE FUNCTION can_view_note(note_record notes)
RETURNS BOOLEAN AS $$
BEGIN
  -- Must be org member first
  IF NOT is_org_member(note_record.org_id) THEN
    RETURN FALSE;
  END IF;

  -- Org-visible notes: any member can see
  IF note_record.visibility = 'org' THEN
    RETURN TRUE;
  END IF;

  -- Private notes: only creator
  IF note_record.visibility = 'private' AND note_record.created_by = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- Shared notes: creator or explicitly shared
  IF note_record.visibility = 'shared' THEN
    IF note_record.created_by = auth.uid() THEN
      RETURN TRUE;
    END IF;
    IF EXISTS (SELECT 1 FROM note_shares WHERE note_id = note_record.id AND shared_with = auth.uid()) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ---- PROFILES ----
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);  -- All authenticated users can see profiles

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ---- ORGANIZATIONS ----
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgs_select" ON organizations
  FOR SELECT USING (is_org_member(id));

CREATE POLICY "orgs_insert" ON organizations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "orgs_update" ON organizations
  FOR UPDATE USING (
    get_org_role(id) IN ('owner', 'admin')
  );

-- ---- ORGANIZATION MEMBERS ----
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select" ON organization_members
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "org_members_insert" ON organization_members
  FOR INSERT WITH CHECK (
    -- Owner/admin can invite, OR user is creating their own membership (for new orgs)
    get_org_role(org_id) IN ('owner', 'admin')
    OR (user_id = auth.uid() AND NOT EXISTS (
      SELECT 1 FROM organization_members WHERE org_id = organization_members.org_id
    ))
  );

CREATE POLICY "org_members_delete" ON organization_members
  FOR DELETE USING (
    get_org_role(org_id) IN ('owner', 'admin')
    OR user_id = auth.uid()  -- Users can leave
  );

-- ---- NOTES ----
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select" ON notes
  FOR SELECT USING (
    is_org_member(org_id)
    AND (
      visibility = 'org'
      OR created_by = auth.uid()
      OR (visibility = 'shared' AND is_note_shared_with_me(id))
    )
  );

CREATE POLICY "notes_insert" ON notes
  FOR INSERT WITH CHECK (
    is_org_member(org_id)
    AND created_by = auth.uid()
    AND get_org_role(org_id) IN ('owner', 'admin', 'member')
  );

CREATE POLICY "notes_update" ON notes
  FOR UPDATE USING (
    is_org_member(org_id)
    AND (
      created_by = auth.uid()  -- Creator can always edit
      OR get_org_role(org_id) IN ('owner', 'admin')  -- Admins can edit org-visible notes
    )
  );

CREATE POLICY "notes_delete" ON notes
  FOR DELETE USING (
    is_org_member(org_id)
    AND (
      created_by = auth.uid()
      OR get_org_role(org_id) IN ('owner', 'admin')
    )
  );

-- ---- NOTE TAGS ----
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "note_tags_select" ON note_tags
  FOR SELECT USING (
    note_id IN (SELECT id FROM notes)  -- Relies on notes RLS
  );

CREATE POLICY "note_tags_insert" ON note_tags
  FOR INSERT WITH CHECK (
    note_id IN (SELECT id FROM notes WHERE created_by = auth.uid()
      OR get_org_role(org_id) IN ('owner', 'admin'))
  );

CREATE POLICY "note_tags_delete" ON note_tags
  FOR DELETE USING (
    note_id IN (SELECT id FROM notes WHERE created_by = auth.uid()
      OR get_org_role(org_id) IN ('owner', 'admin'))
  );

-- ---- NOTE SHARES ----
ALTER TABLE note_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "note_shares_select" ON note_shares
  FOR SELECT USING (
    note_id IN (SELECT id FROM notes)  -- Relies on notes RLS
  );

CREATE POLICY "note_shares_insert" ON note_shares
  FOR INSERT WITH CHECK (
    note_id IN (SELECT id FROM notes WHERE created_by = auth.uid()
      OR get_org_role(org_id) IN ('owner', 'admin'))
  );

CREATE POLICY "note_shares_delete" ON note_shares
  FOR DELETE USING (
    note_id IN (SELECT id FROM notes WHERE created_by = auth.uid()
      OR get_org_role(org_id) IN ('owner', 'admin'))
  );

-- ---- NOTE VERSIONS ----
ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "note_versions_select" ON note_versions
  FOR SELECT USING (
    note_id IN (SELECT id FROM notes)  -- Relies on notes RLS
  );

-- No insert/update/delete policies — versions are created by trigger only

-- ---- NOTE FILES ----
ALTER TABLE note_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "note_files_select" ON note_files
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "note_files_insert" ON note_files
  FOR INSERT WITH CHECK (
    is_org_member(org_id)
    AND uploaded_by = auth.uid()
    AND get_org_role(org_id) IN ('owner', 'admin', 'member')
  );

CREATE POLICY "note_files_delete" ON note_files
  FOR DELETE USING (
    uploaded_by = auth.uid()
    OR get_org_role(org_id) IN ('owner', 'admin')
  );

-- ---- AI SUMMARIES ----
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_summaries_select" ON ai_summaries
  FOR SELECT USING (
    is_org_member(org_id)
    AND note_id IN (SELECT id FROM notes)  -- Relies on notes RLS
  );

CREATE POLICY "ai_summaries_insert" ON ai_summaries
  FOR INSERT WITH CHECK (
    is_org_member(org_id)
    AND requested_by = auth.uid()
    AND get_org_role(org_id) IN ('owner', 'admin', 'member')
  );

CREATE POLICY "ai_summaries_update" ON ai_summaries
  FOR UPDATE USING (
    is_org_member(org_id)
    AND get_org_role(org_id) IN ('owner', 'admin', 'member')
  );

-- ---- AUDIT LOGS ----
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (
    org_id IS NOT NULL AND get_org_role(org_id) IN ('owner', 'admin')
  );

-- Insert allowed for service role only (via API routes)
-- No direct insert policy for regular users — logs are written server-side

-- ============================================================================
-- STORAGE
-- ============================================================================

-- Create storage bucket for note files
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-files', 'note-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "note_files_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'note-files'
    AND is_org_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "note_files_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'note-files'
    AND is_org_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "note_files_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'note-files'
    AND is_org_member((storage.foldername(name))[1]::uuid)
  );
