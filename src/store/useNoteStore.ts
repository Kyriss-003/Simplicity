import { create } from 'zustand';
import { folderRepository, noteRepository, ROOT_FOLDER_ID } from '../db/storage';
import type { Folder, NewNoteInput, Note, NoteUpdateInput } from '../types';
import { collectSubtreeIds } from '../utils';

export interface NoteStoreState {
  notes: Note[];
  allNotes: Note[];
  folders: Folder[];
  isLoading: boolean;
  error: string | null;
  selectedFolderId: string | null;
  noteCounts: Record<string, number>;

  initialize: () => Promise<void>;
  getAllNotes: () => Promise<void>;
  getAllFolders: () => Promise<void>;
  createNote: (input: NewNoteInput) => Promise<Note | null>;
  updateNote: (id: number, input: NoteUpdateInput) => Promise<Note | null>;
  togglePinNote: (id: number) => Promise<Note | null>;
  importNotes: (
    items: Array<NewNoteInput & { createdAt?: string; updatedAt?: string }>
  ) => Promise<Note[]>;
  syncNoteInState: (updated: Note) => void;
  softDeleteNote: (id: number) => Promise<void>;
  duplicateNote: (id: number) => Promise<Note | null>;
  moveNote: (noteId: number, targetFolderId: string) => Promise<void>;
  setSelectedFolder: (id: string | null) => Promise<void>;
  refreshNoteCounts: () => Promise<void>;

  createFolder: (label: string, parentId: string) => Promise<Folder | null>;
  renameFolder: (id: string, label: string) => Promise<void>;
  moveFolder: (id: string, targetParentId: string) => Promise<void>;
  duplicateFolder: (id: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
}

function orderByUpdatedDesc(a: Note, b: Note): number {
  const pinDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
  return pinDiff !== 0 ? pinDiff : b.updatedAt.localeCompare(a.updatedAt);
}

export const useNoteStore = create<NoteStoreState>((set, get) => ({
  notes: [],
  allNotes: [],
  folders: [],
  isLoading: false,
  error: null,
  selectedFolderId: ROOT_FOLDER_ID,
  noteCounts: {},

  initialize: async () => {
    await get().getAllFolders();
    await get().getAllNotes();
    await get().refreshNoteCounts();
  },

  getAllNotes: async () => {
    set({ isLoading: true, error: null });
    try {
      const { selectedFolderId } = get();
      const [notes, allNotes] = await Promise.all([
        noteRepository.getAllNotes(selectedFolderId ?? undefined),
        noteRepository.getAllNotes(),
      ]);
      set({ notes, allNotes, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
    }
  },

  getAllFolders: async () => {
    set({ isLoading: true, error: null });
    try {
      const folders = await folderRepository.getAllFolders();
      set({ folders, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
    }
  },

  createNote: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const { selectedFolderId } = get();
      const folderId = input.folderId ?? selectedFolderId ?? ROOT_FOLDER_ID;
      const created = await noteRepository.createNote({ ...input, folderId });
      set((state) => ({
        notes:
          created.folderId === state.selectedFolderId
            ? [created, ...state.notes].sort(orderByUpdatedDesc)
            : state.notes,
        allNotes: [created, ...state.allNotes].sort(orderByUpdatedDesc),
        noteCounts: {
          ...state.noteCounts,
          [folderId]: (state.noteCounts[folderId] ?? 0) + 1,
        },
        isLoading: false,
      }));
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
      return null;
    }
  },

  updateNote: async (id, input) => {
    try {
      const updated = await noteRepository.updateNote(id, input);
      if (updated) {
        set((state) => ({
          notes: state.notes
            .map((note) => (note.id === id ? updated : note))
            .sort(orderByUpdatedDesc),
          allNotes: state.allNotes
            .map((note) => (note.id === id ? updated : note))
            .sort(orderByUpdatedDesc),
        }));
      }
      return updated;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' });
      return null;
    }
  },

  syncNoteInState: (updated) => {
    set((state) => ({
      notes: state.notes
        .map((note) => (note.id === updated.id ? updated : note))
        .sort(orderByUpdatedDesc),
      allNotes: state.allNotes
        .map((note) => (note.id === updated.id ? updated : note))
        .sort(orderByUpdatedDesc),
    }));
  },

  togglePinNote: async (id) => {
    const { allNotes, notes } = get();
    const target = allNotes.find((n) => n.id === id) ?? notes.find((n) => n.id === id);
    if (!target) return null;
    return get().updateNote(id, { isPinned: !target.isPinned });
  },

  importNotes: async (items) => {
    set({ isLoading: true, error: null });
    try {
      const created = await noteRepository.importNotes(items);
      await get().getAllNotes();
      await get().refreshNoteCounts();
      set({ isLoading: false });
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
      return [];
    }
  },

  softDeleteNote: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const removed = await noteRepository.softDeleteNote(id);
      if (removed) {
        set((state) => {
          const note = state.allNotes.find((n) => n.id === id) ?? state.notes.find((n) => n.id === id);
          const folderId = note?.folderId;
          return {
            notes: state.notes.filter((n) => n.id !== id),
            allNotes: state.allNotes.filter((n) => n.id !== id),
            noteCounts: folderId
              ? {
                  ...state.noteCounts,
                  [folderId]: Math.max(0, (state.noteCounts[folderId] ?? 1) - 1),
                }
              : state.noteCounts,
            isLoading: false,
          };
        });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
    }
  },

  duplicateNote: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { allNotes, notes } = get();
      const source = allNotes.find((note) => note.id === id) ?? notes.find((note) => note.id === id);
      if (!source) {
        set({ isLoading: false });
        return null;
      }
      const created = await noteRepository.createNote({
        title: `${source.title} copy`,
        content: source.content,
        tags: [...source.tags],
        folderId: source.folderId,
      });
      set((state) => ({
        notes:
          created.folderId === state.selectedFolderId
            ? [created, ...state.notes].sort(orderByUpdatedDesc)
            : state.notes,
        allNotes: [created, ...state.allNotes].sort(orderByUpdatedDesc),
        isLoading: false,
      }));
      await get().refreshNoteCounts();
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
      return null;
    }
  },

  moveNote: async (noteId, targetFolderId) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await noteRepository.updateNote(noteId, { folderId: targetFolderId });
      set((state) => ({
        notes: !updated
          ? state.notes
          : updated.folderId !== state.selectedFolderId
            ? state.notes.filter((note) => note.id !== noteId)
            : state.notes
                .map((note) => (note.id === noteId ? updated : note))
                .sort(orderByUpdatedDesc),
        allNotes: updated
          ? state.allNotes
              .map((note) => (note.id === noteId ? updated : note))
              .sort(orderByUpdatedDesc)
          : state.allNotes,
        isLoading: false,
      }));
      await get().refreshNoteCounts();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
    }
  },

  setSelectedFolder: async (id) => {
    set({ selectedFolderId: id });
    await get().getAllNotes();
  },

  refreshNoteCounts: async () => {
    try {
      const allNotes = await noteRepository.getAllNotes();
      const counts: Record<string, number> = {};
      allNotes.forEach((n) => {
        counts[n.folderId] = (counts[n.folderId] ?? 0) + 1;
      });
      set({ allNotes, noteCounts: counts });
    } catch {
      // ignore
    }
  },

  createFolder: async (label, parentId) => {
    set({ isLoading: true, error: null });
    try {
      const created = await folderRepository.createFolder(label, parentId);
      set((state) => ({ folders: [...state.folders, created], isLoading: false }));
      return created;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
      return null;
    }
  },

  renameFolder: async (id, label) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await folderRepository.renameFolder(id, label);
      if (updated) {
        set((state) => ({
          folders: state.folders.map((folder) => (folder.id === id ? updated : folder)),
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
    }
  },

  moveFolder: async (id, targetParentId) => {
    set({ isLoading: true, error: null });
    try {
      const moved = await folderRepository.moveFolder(id, targetParentId);
      if (moved) {
        await get().getAllFolders();
        await get().refreshNoteCounts();
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
    }
  },

  duplicateFolder: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await folderRepository.duplicateFolder(id);
      await get().getAllFolders();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
    }
  },

  deleteFolder: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const removed = await folderRepository.softDeleteFolder(id);
      if (removed) {
        await noteRepository.softDeleteNotesInFolders(
          collectSubtreeIds(get().folders, id)
        );
        set((state) => {
          const doomed = collectSubtreeIds(state.folders, id);
          const folders = state.folders.filter((folder) => !doomed.includes(folder.id));
          const selectedFolderId = doomed.includes(state.selectedFolderId ?? '')
            ? ROOT_FOLDER_ID
            : state.selectedFolderId;
          return { folders, selectedFolderId, isLoading: false };
        });
        await get().getAllNotes();
        await get().refreshNoteCounts();
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
    }
  },
}));
