import { create } from 'zustand';
import {
  noteRepository,
  type Note,
  type NewNoteInput,
  type NoteUpdateInput,
} from '../db/NoteRepository';
import {
  folderRepository,
  ROOT_FOLDER_ID,
  type Folder,
} from '../db/FolderRepository';

/**
 * Zustand store bridging the UI with the SQLite-backed repositories.
 *
 * The repositories own all persistence; this store simply mirrors the result of
 * each operation into `notes` / `folders` and tracks loading/error state for
 * callers that want to bind to it via hooks.
 *
 * Context-menu style actions always take explicit target ids so operating on
 * an unselected folder/note never disturbs the active view state.
 */
export interface NoteStoreState {
  /** Live (non-deleted) notes for the selected folder, newest first. */
  notes: Note[];
  /** Live folder rows (flat; UI builds the tree). */
  folders: Folder[];
  /** True while a repository operation is in flight. */
  isLoading: boolean;
  /** Last error thrown by a repository operation, if any. */
  error: string | null;
  /** Currently selected folder for main-view filtering and note creation. */
  selectedFolderId: string | null;
  /** Note counts per folder id (live, updated on every note mutation). */
  noteCounts: Record<string, number>;

  /** Load all folders, then notes for the selected folder. */
  initialize: () => Promise<void>;
  /** Load notes for the selected folder into `notes`. */
  getAllNotes: () => Promise<void>;
  /** Load all folders into `folders`. */
  getAllFolders: () => Promise<void>;
  /** Create a note (defaults to the selected folder) and prepend it to `notes`. */
  createNote: (input: NewNoteInput) => Promise<Note | null>;
  /** Update a note by id and refresh it in `notes`. */
  updateNote: (id: number, input: NoteUpdateInput) => Promise<Note | null>;
  /** Soft-delete a note by id and drop it from `notes`. */
  softDeleteNote: (id: number) => Promise<void>;
  /** Duplicate a note into the same folder. */
  duplicateNote: (id: number) => Promise<Note | null>;
  /** Move a note to another folder by explicit ids. */
  moveNote: (noteId: number, targetFolderId: string) => Promise<void>;
  /** Set the active folder and reload notes for it. */
  setSelectedFolder: (id: string | null) => Promise<void>;
  /** Fetch all notes and recompute counts per folder. */
  refreshNoteCounts: () => Promise<void>;

  /** Create a sub-folder under `parentId` and refresh `folders`. */
  createFolder: (label: string, parentId: string) => Promise<Folder | null>;
  /** Rename a folder by id and refresh `folders`. */
  renameFolder: (id: string, label: string) => Promise<void>;
  /** Move a folder under a new parent (cycle-safe) and refresh `folders`. */
  moveFolder: (id: string, targetParentId: string) => Promise<void>;
  /** Deep-clone a folder as a sibling and refresh `folders`. */
  duplicateFolder: (id: string) => Promise<void>;
  /** Soft-delete a folder subtree (and its notes) then refresh state. */
  deleteFolder: (id: string) => Promise<void>;
}

export const useNoteStore = create<NoteStoreState>((set) => ({
  notes: [],
  folders: [],
  isLoading: false,
  error: null,
  selectedFolderId: ROOT_FOLDER_ID,
  noteCounts: {},

  initialize: async () => {
    await useNoteStore.getState().getAllFolders();
    await useNoteStore.getState().getAllNotes();
  },

  getAllNotes: async () => {
    set({ isLoading: true, error: null });
    try {
      const { selectedFolderId } = useNoteStore.getState();
      const notes = await noteRepository.getAllNotes(selectedFolderId ?? undefined);
      set({ notes, isLoading: false });
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
    }
  },

  getAllFolders: async () => {
    set({ isLoading: true, error: null });
    try {
      const folders = await folderRepository.getAllFolders();
      set({ folders, isLoading: false });
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
    }
  },

  createNote: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const { selectedFolderId } = useNoteStore.getState();
      const folderId = input.folderId ?? selectedFolderId ?? ROOT_FOLDER_ID;
      const created = await noteRepository.createNote({ ...input, folderId });
      set((state) => ({
        // Newest first: place the freshly created note at the head.
        notes: [created, ...state.notes].sort(orderByUpdatedDesc),
        noteCounts: {
          ...state.noteCounts,
          [folderId]: (state.noteCounts[folderId] ?? 0) + 1,
        },
        isLoading: false,
      }));
      return created;
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
      return null;
    }
  },

  updateNote: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await noteRepository.updateNote(id, input);
      if (updated) {
        set((state) => ({
          notes: state.notes
            .map((note) => (note.id === id ? updated : note))
            .sort(orderByUpdatedDesc),
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
      return updated;
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
      return null;
    }
  },

  softDeleteNote: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const removed = await noteRepository.softDeleteNote(id);
      if (removed) {
        set((state) => {
          const note = state.notes.find((n) => n.id === id);
          const folderId = note?.folderId;
          return {
            notes: state.notes.filter((n) => n.id !== id),
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
      set({ error: toMessage(err), isLoading: false });
    }
  },

  duplicateNote: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { notes } = useNoteStore.getState();
      const source = notes.find((note) => note.id === id);
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
        notes: [created, ...state.notes].sort(orderByUpdatedDesc),
        isLoading: false,
      }));
      return created;
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
      return null;
    }
  },

  moveNote: async (noteId, targetFolderId) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await noteRepository.updateNote(noteId, { folderId: targetFolderId });
      set((state) => ({
        // Drop the note from the current view when it left the selected folder.
        notes: !updated
          ? state.notes
          : updated.folderId !== state.selectedFolderId
            ? state.notes.filter((note) => note.id !== noteId)
            : state.notes
                .map((note) => (note.id === noteId ? updated : note))
                .sort(orderByUpdatedDesc),
        isLoading: false,
      }));
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
    }
  },

  setSelectedFolder: async (id) => {
    set({ selectedFolderId: id });
    await useNoteStore.getState().getAllNotes();
  },

  refreshNoteCounts: async () => {
    try {
      const allNotes = await noteRepository.getAllNotes();
      const counts: Record<string, number> = {};
      allNotes.forEach((n) => {
        counts[n.folderId] = (counts[n.folderId] ?? 0) + 1;
      });
      set({ noteCounts: counts });
    } catch {
      // Silently ignore — counts are a display optimization.
    }
  },

  createFolder: async (label, parentId) => {
    set({ isLoading: true, error: null });
    try {
      const created = await folderRepository.createFolder(label, parentId);
      set((state) => ({ folders: [...state.folders, created], isLoading: false }));
      return created;
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
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
      set({ error: toMessage(err), isLoading: false });
    }
  },

  moveFolder: async (id, targetParentId) => {
    set({ isLoading: true, error: null });
    try {
      const moved = await folderRepository.moveFolder(id, targetParentId);
      if (moved) {
        await useNoteStore.getState().getAllFolders();
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
    }
  },

  duplicateFolder: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await folderRepository.duplicateFolder(id);
      await useNoteStore.getState().getAllFolders();
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
    }
  },

  deleteFolder: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const removed = await folderRepository.softDeleteFolder(id);
      if (removed) {
        // The repository's native path already cascaded notes; on web the
        // store-level refresh below reconciles `notes` with the repository.
        await noteRepository.softDeleteNotesInFolders(subtreeIds(useNoteStore.getState().folders, id));
        set((state) => {
          const doomed = subtreeIds(state.folders, id);
          const folders = state.folders.filter((folder) => !doomed.includes(folder.id));
          const selectedFolderId = doomed.includes(state.selectedFolderId ?? '')
            ? ROOT_FOLDER_ID
            : state.selectedFolderId;
          return { folders, selectedFolderId, isLoading: false };
        });
        await useNoteStore.getState().getAllNotes();
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
    }
  },
}));

/** Reduce any thrown value to a human-readable string. */
function toMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return typeof err === 'string' ? err : 'Unknown error';
}

/** Comparator keeping `notes` ordered by `updatedAt` descending. */
function orderByUpdatedDesc(a: Note, b: Note): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

/** All folder ids in the subtree rooted at `rootId` (inclusive). */
function subtreeIds(folders: Folder[], rootId: string): string[] {
  const result: string[] = [];
  const visit = (id: string): void => {
    result.push(id);
    folders.filter((f) => f.parentId === id).forEach((child) => visit(child.id));
  };
  visit(rootId);
  return result;
}
