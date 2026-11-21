import { create } from 'zustand';
import { templateRepository } from '../db/templates';
import type { NewTemplateInput, NoteTemplate, TemplateUpdateInput } from '../types';

export interface TemplateStoreState {
  templates: NoteTemplate[];
  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  createTemplate: (input: NewTemplateInput) => Promise<NoteTemplate | null>;
  updateTemplate: (id: string, input: TemplateUpdateInput) => Promise<NoteTemplate | null>;
  deleteTemplate: (id: string) => Promise<boolean>;
  resetBuiltIns: () => Promise<void>;
}

export const useTemplateStore = create<TemplateStoreState>((set) => ({
  templates: [],
  isLoading: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const templates = await templateRepository.getAllTemplates();
      set({ templates, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
    }
  },

  createTemplate: async (input) => {
    try {
      const created = await templateRepository.createTemplate(input);
      set((state) => ({ templates: [created, ...state.templates] }));
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
      return null;
    }
  },

  updateTemplate: async (id, input) => {
    try {
      const updated = await templateRepository.updateTemplate(id, input);
      if (updated) {
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? updated : t)),
        }));
      }
      return updated;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
      return null;
    }
  },

  deleteTemplate: async (id) => {
    try {
      const ok = await templateRepository.deleteTemplate(id);
      if (ok) {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
      }
      return ok;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
      return false;
    }
  },

  resetBuiltIns: async () => {
    try {
      const templates = await templateRepository.resetBuiltIns();
      set({ templates });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  },
}));
