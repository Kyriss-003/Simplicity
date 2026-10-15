import { create } from 'zustand';
import { getSupabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Zustand store owning the Supabase auth session.
 *
 * Separate from `usePrefsStore` (app configuration) and `useNoteStore` (user
 * content): a session is neither. It drives the shell's signed-in/out gate and
 * feeds the sync layer the identity it needs for per-user RLS.
 *
 * Kept tiny on purpose — sign in/out and a user object. Everything else about a
 * profile (display name, settings) belongs to a profile table, not here.
 */
export interface AuthState {
  /** The active Supabase session, or null when signed out. */
  session: Session | null;
  /** The authenticated Supabase user, or null when signed out. */
  user: User | null;
  /** True while an auth request is in flight. */
  isLoading: boolean;
  /** Last human-readable auth error, if any. */
  error: string | null;

  /** Restore the persisted session on launch. */
  initialize: () => Promise<void>;
  /** Email + password sign in. */
  signIn: (email: string, password: string) => Promise<boolean>;
  /** Email + password sign up. */
  signUp: (email: string, password: string) => Promise<boolean>;
  /** Sign out and clear the persisted session. */
  signOut: () => Promise<void>;
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Something went wrong';
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    const supabase = getSupabase();
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      set({ session: data.session, user: data.session?.user ?? null, isLoading: false });
      // Listen for future auth changes (refresh, sign out elsewhere).
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null });
      });
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
    }
  },

  signIn: async (email, password) => {
    const supabase = getSupabase();
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data } = await supabase.auth.getSession();
      set({ session: data.session, user: data.session?.user ?? null, isLoading: false });
      return true;
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
      return false;
    }
  },

  signUp: async (email, password) => {
    const supabase = getSupabase();
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // If email confirmation is enabled, the session may be null until the
      // user confirms. Reflect whatever we got back.
      set({ session: data.session, user: data.session?.user ?? null, isLoading: false });
      return true;
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
      return false;
    }
  },

  signOut: async () => {
    const supabase = getSupabase();
    set({ isLoading: true, error: null });
    try {
      await supabase.auth.signOut();
      set({ session: null, user: null, isLoading: false });
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
    }
  },
}));

