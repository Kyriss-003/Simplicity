import { Platform } from 'react-native';
import { initDatabase } from './schema';
import type { FolderRow } from './schema';

/**
 * App-facing folder model. Booleans and camelCase keys keep this ergonomic for
 * the UI; the repository translates to/from the on-disk {@link FolderRow}.
 */
export interface Folder {
  id: string;
  uuid: string;
  label: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

/** Immutable id of the single root folder ("Main"). */
export const ROOT_FOLDER_ID = 'main';

/** localStorage key for the web-only preview store. */
const WEB_STORAGE_KEY = 'notes_app_folders';

/** Reusable crypto-backed UUID without importing a polyfill. */
function makeUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

function toFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    uuid: row.uuid,
    label: row.label,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted === 1,
  };
}

/**
 * Repository owning all folder persistence. Mirrors the dual backend pattern
 * of `NoteRepository`: native SQLite vs web `localStorage`.
 */
class FolderRepository {
  private readonly isWeb = Platform.OS === 'web';

  /** In-memory mirror of the localStorage payload (web only). */
  private webFolders: FolderRow[] = [];

  constructor() {
    if (this.isWeb) {
      this.webFolders = this.loadWebFolders();
    }
  }

  // ---- Web (localStorage) storage ------------------------------------

  private loadWebFolders(): FolderRow[] {
    const stored = localStorage.getItem(WEB_STORAGE_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as FolderRow[];
    } catch {
      return [];
    }
  }

  private persistWebFolders(): void {
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(this.webFolders));
  }

  // ---- Public API -----------------------------------------------------

  /** All live folders, parent-first. Seeds the root folder on first read. */
  async getAllFolders(): Promise<Folder[]> {
    if (this.isWeb) {
      if (!this.webFolders.some((f) => f.id === ROOT_FOLDER_ID)) {
        const now = new Date().toISOString();
        this.webFolders.unshift({
          id: ROOT_FOLDER_ID,
          uuid: makeUuid(),
          label: 'Main',
          parent_id: null,
          is_deleted: 0,
          created_at: now,
          updated_at: now,
        });
        this.persistWebFolders();
      }
      return this.webFolders
        .filter((f) => f.is_deleted === 0)
        .map(toFolder);
    }

    const db = await initDatabase();
    const root = await db.getFirstAsync<FolderRow>(
      `SELECT * FROM folders WHERE id = ?`,
      [ROOT_FOLDER_ID],
    );
    if (!root) {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO folders (id, uuid, label, parent_id, is_deleted, created_at, updated_at)
         VALUES (?, ?, 'Main', NULL, 0, ?, ?)`,
        [ROOT_FOLDER_ID, makeUuid(), now, now],
      );
    }
    const rows = await db.getAllAsync<FolderRow>(
      `SELECT * FROM folders WHERE is_deleted = 0 ORDER BY created_at ASC`,
    );
    return rows.map(toFolder);
  }

  async createFolder(label: string, parentId: string): Promise<Folder> {
    const now = new Date().toISOString();
    const uuid = makeUuid();
    const id = `folder_${uuid}`;
    const row: FolderRow = {
      id,
      uuid,
      label: label.trim() || 'New Folder',
      parent_id: parentId,
      is_deleted: 0,
      created_at: now,
      updated_at: now,
    };

    if (this.isWeb) {
      this.webFolders.push(row);
      this.persistWebFolders();
      return toFolder(row);
    }

    const db = await initDatabase();
    await db.runAsync(
      `INSERT INTO folders (id, uuid, label, parent_id, is_deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [row.id, row.uuid, row.label, row.parent_id, row.created_at, row.updated_at],
    );
    return toFolder(row);
  }

  async renameFolder(id: string, label: string): Promise<Folder | null> {
    const now = new Date().toISOString();
    const trimmed = label.trim();
    if (!trimmed) return null;

    if (this.isWeb) {
      const index = this.webFolders.findIndex((f) => f.id === id && f.is_deleted === 0);
      if (index === -1) return null;
      this.webFolders[index] = { ...this.webFolders[index], label: trimmed, updated_at: now };
      this.persistWebFolders();
      return toFolder(this.webFolders[index]);
    }

    const db = await initDatabase();
    const existing = await db.getFirstAsync<FolderRow>(
      `SELECT * FROM folders WHERE id = ? AND is_deleted = 0`,
      [id],
    );
    if (!existing) return null;
    await db.runAsync(`UPDATE folders SET label = ?, updated_at = ? WHERE id = ?`, [
      trimmed,
      now,
      id,
    ]);
    return toFolder({ ...existing, label: trimmed, updated_at: now });
  }

  /**
   * Moves a folder under a new parent. Returns false when the move would
   * place the folder inside its own subtree (cycle) or onto itself.
   */
  async moveFolder(id: string, targetParentId: string): Promise<boolean> {
    if (id === targetParentId || id === ROOT_FOLDER_ID) return false;

    if (this.isWeb) {
      const all = this.webFolders.filter((f) => f.is_deleted === 0);
      if (isInsideSubtree(all, targetParentId, id)) return false;
      const index = this.webFolders.findIndex((f) => f.id === id);
      if (index === -1) return false;
      const now = new Date().toISOString();
      this.webFolders[index] = { ...this.webFolders[index], parent_id: targetParentId, updated_at: now };
      this.persistWebFolders();
      return true;
    }

    const db = await initDatabase();
    const all = (await db.getAllAsync<FolderRow>(`SELECT * FROM folders WHERE is_deleted = 0`)) as FolderRow[];
    if (isInsideSubtree(all, targetParentId, id)) return false;

    const now = new Date().toISOString();
    const result = await db.runAsync(
      `UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ? AND is_deleted = 0`,
      [targetParentId, now, id],
    );
    return result.changes > 0;
  }

  /**
   * Deep-clones a folder (and its subtree) as a sibling of the original,
   * suffixed with " copy". Contained notes are NOT copied.
   */
  async duplicateFolder(id: string): Promise<Folder | null> {
    if (id === ROOT_FOLDER_ID) return null;
    const folders = await this.getAllFolders();
    const source = folders.find((f) => f.id === id);
    if (!source) return null;

    // Clone the whole subtree depth-first, remapping parent ids. Only the
    // clone root gets the " copy" suffix; descendants keep their labels.
    const clones = new Map<string, Folder>();
    const cloneSubtree = async (folderId: string, newParentId: string): Promise<void> => {
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return;
      const label = folderId === id ? `${folder.label} copy` : folder.label;
      const clone = await this.createFolder(label, newParentId);
      clones.set(folderId, clone);
      const children = folders.filter((f) => f.parentId === folderId);
      for (const child of children) {
        await cloneSubtree(child.id, clone.id);
      }
    };

    await cloneSubtree(id, source.parentId ?? ROOT_FOLDER_ID);
    return clones.get(id) ?? null;
  }

  /**
   * Soft-deletes a folder, its descendant folders, and every note contained
   * in any of them. The root folder cannot be deleted.
   */
  async softDeleteFolder(id: string): Promise<boolean> {
    if (id === ROOT_FOLDER_ID) return false;
    const now = new Date().toISOString();

    const folders = await this.getAllFolders();
    const doomed = collectSubtreeIds(folders, id);
    if (doomed.length === 0) return false;

    if (this.isWeb) {
      this.webFolders = this.webFolders.map((f) =>
        doomed.includes(f.id) ? { ...f, is_deleted: 1, updated_at: now } : f,
      );
      this.persistWebFolders();
      // Cascade to notes kept in NoteRepository's storage is handled by the
      // store layer calling noteRepository.softDeleteNotesInFolders().
      return true;
    }

    const db = await initDatabase();
    const placeholders = doomed.map(() => '?').join(', ');
    await db.runAsync(
      `UPDATE folders SET is_deleted = 1, updated_at = ? WHERE id IN (${placeholders})`,
      [now, ...doomed],
    );
    await db.runAsync(
      `UPDATE notes SET is_deleted = 1, updated_at = ? WHERE is_deleted = 0 AND folder_id IN (${placeholders})`,
      [now, ...doomed],
    );
    return true;
  }
}

/** True when `candidateId` lies inside the subtree rooted at `rootId`. */
function isInsideSubtree(rows: FolderRow[], candidateId: string, rootId: string): boolean {
  let currentId: string | null = candidateId;
  while (currentId) {
    if (currentId === rootId) return true;
    const row = rows.find((r) => r.id === currentId);
    currentId = row?.parent_id ?? null;
  }
  return false;
}

/** All folder ids in the subtree rooted at `rootId` (inclusive). */
function collectSubtreeIds(folders: Folder[], rootId: string): string[] {
  const result: string[] = [];
  const visit = (id: string): void => {
    result.push(id);
    folders.filter((f) => f.parentId === id).forEach((child) => visit(child.id));
  };
  visit(rootId);
  return result;
}

export const folderRepository = new FolderRepository();
