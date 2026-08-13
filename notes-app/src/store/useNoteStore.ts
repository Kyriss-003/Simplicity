import { create } from 'zustand';
import {
  noteRepository,
  type Note,
  type NewNoteInput,
  type NoteUpdateInput,
} from '../db/NoteRepository';

/**
 * Zustand store bridging the UI with the SQLite-backed {@link noteRepository}.
 *
 * The repository owns all persistence; this store simply mirrors the result of
 * each operation into `notes` and tracks loading/error state for callers that
 * want to bind to it via hooks.
 */
export interface NoteStoreState {
  /** Live (non-deleted) notes, newest first. */
  notes: Note[];
  /** True while a repository operation is in flight. */
  isLoading: boolean;
  /** Last error thrown by a repository operation, if any. */
  error: string | null;

  /** Load all notes from the database into `notes`. */
  getAllNotes: () => Promise<void>;
  /** Create a note and prepend it to `notes`. */
  createNote: (input: NewNoteInput) => Promise<Note | null>;
  /** Update a note by id and refresh it in `notes`. */
  updateNote: (id: number, input: NoteUpdateInput) => Promise<Note | null>;
  /** Soft-delete a note by id and drop it from `notes`. */
  softDeleteNote: (id: number) => Promise<void>;
}

export const useNoteStore = create<NoteStoreState>((set) => ({
  notes: [],
  isLoading: false,
  error: null,

  getAllNotes: async () => {
    set({ isLoading: true, error: null });
    try {
      const notes = await noteRepository.getAllNotes();
      set({ notes, isLoading: false });
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
    }
  },

  createNote: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const created = await noteRepository.createNote(input);
      set((state) => ({
        // Newest first: place the freshly created note at the head.
        notes: [created, ...state.notes].sort(orderByUpdatedDesc),
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
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
          isLoading: false,
        }));
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
