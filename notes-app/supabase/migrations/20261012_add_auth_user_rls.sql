-- ============================================================
-- Add per-user row-level security for commercial launch.
-- Requires Supabase Auth (email/password + OAuth).
-- ============================================================

-- 1) Add a user_id column to each content table, FK to auth.users.
ALTER TABLE public.notes  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.events  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.prefs   ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2) Auto-set user_id from the authenticated user on INSERT.
CREATE OR REPLACE FUNCTION public.set_notes_user_id() RETURNS trigger AS 
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_notes_user_id  ON public.notes;
CREATE TRIGGER trg_notes_user_id BEFORE INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_notes_user_id();

DROP TRIGGER IF EXISTS trg_folders_user_id ON public.folders;
CREATE TRIGGER trg_folders_user_id BEFORE INSERT ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.set_notes_user_id();

DROP TRIGGER IF EXISTS trg_events_user_id  ON public.events;
CREATE TRIGGER trg_events_user_id BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_notes_user_id();

DROP TRIGGER IF EXISTS trg_prefs_user_id   ON public.prefs;
CREATE TRIGGER trg_prefs_user_id BEFORE INSERT ON public.prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_notes_user_id();

-- 3) Revoke overly-permissive anon policies from earlier schema.
DROP POLICY IF EXISTS notes_select_all  ON public.notes;
DROP POLICY IF EXISTS notes_insert_all  ON public.notes;
DROP POLICY IF EXISTS notes_update_all  ON public.notes;
DROP POLICY IF EXISTS notes_delete_all  ON public.notes;
DROP POLICY IF EXISTS folders_select_all  ON public.folders;
DROP POLICY IF EXISTS folders_insert_all  ON public.folders;
DROP POLICY IF EXISTS folders_update_all  ON public.folders;
DROP POLICY IF EXISTS folders_delete_all  ON public.folders;
DROP POLICY IF EXISTS events_select_all  ON public.events;
DROP POLICY IF EXISTS events_insert_all  ON public.events;
DROP POLICY IF EXISTS events_update_all  ON public.events;
DROP POLICY IF EXISTS events_delete_all  ON public.events;

-- 4) Authenticated-only owner-scoped policies, initplan-optimized.
CREATE POLICY "notes_select_own" ON public.notes FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "notes_insert_own" ON public.notes FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "notes_update_own" ON public.notes FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "notes_delete_own" ON public.notes FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY "folders_select_own" ON public.folders FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "folders_insert_own" ON public.folders FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "folders_update_own" ON public.folders FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "folders_delete_own" ON public.folders FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY "events_select_own" ON public.events FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "events_insert_own" ON public.events FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "events_update_own" ON public.events FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "events_delete_own" ON public.events FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY "prefs_select_own" ON public.prefs FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "prefs_insert_own" ON public.prefs FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "prefs_update_own" ON public.prefs FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "prefs_delete_own" ON public.prefs FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- 5) Revoke anon access to the exposed tables (defense in depth).
REVOKE ALL ON public.notes, public.folders, public.events, public.prefs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes, public.folders, public.events, public.prefs TO authenticated;

-- 6) Indexes for the ownership predicates.
CREATE INDEX IF NOT EXISTS idx_notes_user   ON public.notes (user_id);
CREATE INDEX IF NOT EXISTS idx_folders_user ON public.folders (user_id);
CREATE INDEX IF NOT EXISTS idx_events_user  ON public.events (user_id);
CREATE INDEX IF NOT EXISTS idx_prefs_user   ON public.prefs (user_id);
