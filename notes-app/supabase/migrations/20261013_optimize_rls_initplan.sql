-- Optimize RLS policies to avoid per-row auth.uid() evaluation.
-- Wrap auth.uid() in (select auth.uid()) for initplan performance.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- Drop existing policies.
DROP POLICY IF EXISTS notes_select_own ON public.notes;
DROP POLICY IF EXISTS notes_insert_own ON public.notes;
DROP POLICY IF EXISTS notes_update_own ON public.notes;
DROP POLICY IF EXISTS notes_delete_own ON public.notes;
DROP POLICY IF EXISTS folders_select_own ON public.folders;
DROP POLICY IF EXISTS folders_insert_own ON public.folders;
DROP POLICY IF EXISTS folders_update_own ON public.folders;
DROP POLICY IF EXISTS folders_delete_own ON public.folders;
DROP POLICY IF EXISTS events_select_own ON public.events;
DROP POLICY IF EXISTS events_insert_own ON public.events;
DROP POLICY IF EXISTS events_update_own ON public.events;
DROP POLICY IF EXISTS events_delete_own ON public.events;
DROP POLICY IF EXISTS prefs_select_own ON public.prefs;
DROP POLICY IF EXISTS prefs_insert_own ON public.prefs;
DROP POLICY IF EXISTS prefs_update_own ON public.prefs;
DROP POLICY IF EXISTS prefs_delete_own ON public.prefs;

-- Recreate with subquery-wrapped auth.uid() (initplan optimization).
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
