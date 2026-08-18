import { Platform } from 'react-native';
import { initDatabase } from './schema';
import type { NoteRow } from './schema';

/**
 * App-facing note model. Booleans and parsed `tags` make this shape ergonomic
 * for the UI; the repository translates to/from the on-disk {@link NoteRow}.
 */
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

/** localStorage key for the web-only preview store. */
const WEB_STORAGE_KEY = 'notes_app_data';

/** Reusable crypto-backed UUID without importing a polyfill. */
function makeUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * Repository owning all note persistence.
 *
 * - Native (Android/iOS/desktop): backed by `expo-sqlite` with full CRUD.
 * - Web: backed by `localStorage` so the app runs in browser previews without a
 *   native database. The two paths never cross — every method branches on
 *   `Platform.OS === 'web'` exactly once.
 */
class NoteRepository {
  private readonly isWeb = Platform.OS === 'web';

  /** In-memory mirror of the localStorage payload (web only). */
  private webNotes: NoteRow[] = [];

  constructor() {
    if (this.isWeb) {
      this.webNotes = this.loadWebNotes();
    }
  }

  // ---- Shared mapping -------------------------------------------------

  private toNote(row: NoteRow): Note {
    return {
      id: row.id,
      uuid: row.uuid,
      title: row.title,
      content: row.content,
      tags: parseTags(row.tags),
      folderId: row.folder_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isDeleted: row.is_deleted === 1,
      isSynced: row.is_synced === 1,
    };
  }

  // ---- Web (localStorage) storage ------------------------------------

  private loadWebNotes(): NoteRow[] {
    const stored = localStorage.getItem(WEB_STORAGE_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as NoteRow[];
    } catch {
      return [];
    }
  }

  private persistWebNotes(): void {
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(this.webNotes));
  }

  private nextWebId(): number {
    return this.webNotes.reduce((max, n) => Math.max(max, n.id), 0) + 1;
  }

  // ---- Public API -----------------------------------------------------

  async getAllNotes(folderId?: string): Promise<Note[]> {
    const filter = folderId ? ` AND folder_id = ${escapeSql(folderId)}` : '';
    if (this.isWeb) {
      return this.webNotes
        .filter((n) => n.is_deleted === 0 && (!folderId || n.folder_id === folderId))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map(this.toNote);
    }

    const db = await initDatabase();
    const rows = await db.getAllAsync<NoteRow>(
      `SELECT * FROM notes WHERE is_deleted = 0${filter} ORDER BY updated_at DESC`,
    );
    return rows.map(this.toNote);
  }

  async createNote(input: NewNoteInput): Promise<Note> {
    const now = new Date().toISOString();
    const uuid = makeUuid();
    const folderId = input.folderId ?? 'main';
    const row: NoteRow = {
      id: 0,
      uuid,
      title: input.title || 'Untitled Note',
      content: input.content || '',
      tags: JSON.stringify(input.tags ?? []),
      folder_id: folderId,
      created_at: now,
      updated_at: now,
      is_deleted: 0,
      is_synced: 0,
    };

    if (this.isWeb) {
      row.id = this.nextWebId();
      this.webNotes.unshift(row);
      this.persistWebNotes();
      return this.toNote(row);
    }

    const db = await initDatabase();
    const result = await db.runAsync(
      `INSERT INTO notes (uuid, title, content, tags, folder_id, created_at, updated_at, is_deleted, is_synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [row.uuid, row.title, row.content, row.tags, row.folder_id, row.created_at, row.updated_at],
    );
    row.id = result.lastInsertRowId;
    return this.toNote(row);
  }

  async updateNote(id: number, input: NoteUpdateInput): Promise<Note | null> {
    const now = new Date().toISOString();

    if (this.isWeb) {
      const index = this.webNotes.findIndex((n) => n.id === id);
      if (index === -1) return null;
      const current = this.webNotes[index];
      const next: NoteRow = {
        ...current,
        title: input.title ?? current.title,
        content: input.content ?? current.content,
        tags: input.tags ? JSON.stringify(input.tags) : current.tags,
        folder_id: input.folderId ?? current.folder_id,
        updated_at: now,
      };
      this.webNotes[index] = next;
      this.persistWebNotes();
      return this.toNote(next);
    }

    const db = await initDatabase();
    const existing = await db.getFirstAsync<NoteRow>(
      `SELECT * FROM notes WHERE id = ? AND is_deleted = 0`,
      [id],
    );
    if (!existing) return null;

    const title = input.title ?? existing.title;
    const content = input.content ?? existing.content;
    const tags = input.tags ? JSON.stringify(input.tags) : existing.tags;
    const folderId = input.folderId ?? existing.folder_id;

    await db.runAsync(
      `UPDATE notes SET title = ?, content = ?, tags = ?, folder_id = ?, updated_at = ? WHERE id = ?`,
      [title, content, tags, folderId, now, id],
    );

    return this.toNote({ ...existing, title, content, tags, folder_id: folderId, updated_at: now });
  }

  async softDeleteNote(id: number): Promise<boolean> {
    const now = new Date().toISOString();

    if (this.isWeb) {
      const index = this.webNotes.findIndex((n) => n.id === id);
      if (index === -1) return false;
      this.webNotes[index] = { ...this.webNotes[index], is_deleted: 1, updated_at: now };
      this.persistWebNotes();
      return true;
    }

    const db = await initDatabase();
    await db.runAsync(
      `UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id = ?`,
      [now, id],
    );
    return true;
  }

  /** Soft-deletes every live note owned by any of `folderIds` (folder cascade). */
  async softDeleteNotesInFolders(folderIds: string[]): Promise<number> {
    if (folderIds.length === 0) return 0;
    const now = new Date().toISOString();

    if (this.isWeb) {
      let changed = 0;
      this.webNotes = this.webNotes.map((n) => {
        if (n.is_deleted === 0 && folderIds.includes(n.folder_id)) {
          changed += 1;
          return { ...n, is_deleted: 1, updated_at: now };
        }
        return n;
      });
      this.persistWebNotes();
      return changed;
    }

    const db = await initDatabase();
    const placeholders = folderIds.map(() => '?').join(', ');
    const result = await db.runAsync(
      `UPDATE notes SET is_deleted = 1, updated_at = ? WHERE is_deleted = 0 AND folder_id IN (${placeholders})`,
      [now, ...folderIds],
    );
    return result.changes;
  }
}

/** Tolerantly parse a `tags` column/value into a `string[]`. */
function parseTags(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Escape a string for safe inclusion in a raw SQL fragment. */
function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

export const noteRepository = new NoteRepository();
