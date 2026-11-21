import { create } from 'zustand';

const AUTH_KEY = 'simplicity_local_session_v1';

export interface LocalUser {
  id: string;
  email: string;
  fullName: string;
  provider: 'email' | 'google' | 'local';
}

export interface AuthState {
  user: LocalUser | null;
  isLoading: boolean;
  error: string | null;
  initialize: () => void;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  error: null,

  initialize: () => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalUser;
        set({ user: parsed, isLoading: false, error: null });
        return;
      }
    } catch {
      // ignore corrupted session
    }
    set({ user: null, isLoading: false, error: null });
  },

  signInWithEmail: async (email, password) => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      set({ error: 'Please enter a valid email address.' });
      return false;
    }
    if (password.length < 4) {
      set({ error: 'Password must be at least 4 characters.' });
      return false;
    }
    const user: LocalUser = {
      id: `user_${btoa(trimmed).slice(0, 12)}`,
      email: trimmed,
      fullName: trimmed.split('@')[0] || 'User',
      provider: 'email',
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    set({ user, error: null, isLoading: false });
    return true;
  },

  signUpWithEmail: async (email, password, fullName) => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      set({ error: 'Please enter a valid email address.' });
      return false;
    }
    if (password.length < 4) {
      set({ error: 'Password must be at least 4 characters.' });
      return false;
    }
    const user: LocalUser = {
      id: `user_${btoa(trimmed).slice(0, 12)}`,
      email: trimmed,
      fullName: fullName?.trim() || trimmed.split('@')[0] || 'User',
      provider: 'email',
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    set({ user, error: null, isLoading: false });
    return true;
  },

  signInWithGoogle: async () => {
    const user: LocalUser = {
      id: 'local_workspace',
      email: 'workspace@simplicity.local',
      fullName: 'Workspace',
      provider: 'google',
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    set({ user, error: null, isLoading: false });
    return true;
  },

  signOut: () => {
    localStorage.removeItem(AUTH_KEY);
    set({ user: null, error: null, isLoading: false });
  },
}));
