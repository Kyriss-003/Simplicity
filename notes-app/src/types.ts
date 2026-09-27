/**
 * Shared app-level types.
 *
 * These live outside `src/db/` so presentational components never have to
 * import from the data layer. On-disk row shapes (`NoteRow`, `FolderRow`)
 * intentionally stay in `src/db/schema.ts`.
 */
import type { MaterialCommunityIcons } from '@expo/vector-icons';

/* ── Notes ──────────────────────────────────────────────────────────── */

export interface Note {
  id: number;
  uuid: string;
  title: string;
  content: string;
  tags: string[];
  folderId: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  isSynced: boolean;
}

export type NewNoteInput = Pick<Note, 'title' | 'content' | 'tags' | 'folderId'>;
export type NoteUpdateInput = Partial<Pick<Note, 'title' | 'content' | 'tags' | 'folderId'>>;

/* ── Folders ────────────────────────────────────────────────────────── */

export interface Folder {
  id: string;
  uuid: string;
  label: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

/** In-memory tree node the UI renders; built from the flat folder list. */
export interface FolderNode {
  id: string;
  label: string;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  children?: FolderNode[];
}

/** A flattened tree row with its indentation depth. */
export interface FlatFolderRow {
  node: FolderNode;
  depth: number;
}

/* ── Tasks & calendar ───────────────────────────────────────────────── */

export interface Task {
  id: number;
  label: string;
  sourceNote: string;
  done: boolean;
}

/**
 * `time` is a human-readable display label (e.g. "9 am"), NOT a parsable
 * date string — do not pass it to `new Date()`. `slotIndex` is the canonical
 * position within whatever slot set the active calendar tab is showing.
 */
export interface CalendarEvent {
  title: string;
  time: string;
  slotIndex: number;
  color?: string;
}

/* ── Navigation ─────────────────────────────────────────────────────── */

export type ScreenKey = 'Overview' | 'Notes' | 'Agenda';
