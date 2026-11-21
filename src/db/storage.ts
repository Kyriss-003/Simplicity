import {
  EVENT_PRIORITIES,
  type Event,
  type EventPriority,
  type EventUpdateInput,
  type Folder,
  type NewEventInput,
  type NewNoteInput,
  type Note,
  type NoteUpdateInput,
} from '../types';
import { collectSubtreeIds } from '../utils';

export const ROOT_FOLDER_ID = 'main';

const NOTES_KEY = 'notes_app_data';
const FOLDERS_KEY = 'notes_app_folders';
const EVENTS_KEY = 'notes_app_events';
const PREFS_KEY = 'notes_app_prefs';
const SEEDED_KEY = 'simplicity_seeded_v1';

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

interface NoteRow {
  id: number;
  uuid: string;
  title: string;
  content: string;
  tags: string;
  folder_id: string;
  is_pinned?: number;
  created_at: string;
  updated_at: string;
  is_deleted: number;
  is_synced: number;
}

interface FolderRow {
  id: string;
  uuid: string;
  label: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

interface EventRow {
  id: number;
  uuid: string;
  title: string;
  notes: string;
  starts_at: string;
  duration_minutes: number;
  priority: string | null;
  is_pinned: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

function ensureSeeded(): void {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(SEEDED_KEY)) return;
  localStorage.setItem(SEEDED_KEY, '1');

  const now = new Date();
  const isoNow = now.toISOString();
  const hourAgo = new Date(now.getTime() - 3600_000).toISOString();
  const dayAgo = new Date(now.getTime() - 86400_000).toISOString();

  if (!localStorage.getItem(FOLDERS_KEY)) {
    const folders: FolderRow[] = [
      {
        id: ROOT_FOLDER_ID,
        uuid: makeUuid(),
        label: 'Main',
        parent_id: null,
        is_deleted: 0,
        created_at: dayAgo,
        updated_at: dayAgo,
      },
      {
        id: 'folder_work',
        uuid: makeUuid(),
        label: 'Work',
        parent_id: ROOT_FOLDER_ID,
        is_deleted: 0,
        created_at: dayAgo,
        updated_at: dayAgo,
      },
      {
        id: 'folder_journal',
        uuid: makeUuid(),
        label: 'Journal',
        parent_id: ROOT_FOLDER_ID,
        is_deleted: 0,
        created_at: dayAgo,
        updated_at: dayAgo,
      },
    ];
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }

  if (!localStorage.getItem(NOTES_KEY)) {
    const notes: NoteRow[] = [
      {
        id: 1,
        uuid: makeUuid(),
        title: 'Welcome to Simplicity',
        content:
          '# Welcome to Simplicity\n\nA calm, **local-first** workspace designed for focus.\n\n- Type in *live Markdown* with auto-closing brackets and quotes\n- Switch themes (`Dark`, `OLED`, `Light`, `B&W`) and accents in Settings\n- Right-click any note or folder for quick actions\n\n> Tip: Press `Ctrl/⌘ + K` to jump to any note or folder.',
        tags: JSON.stringify(['Notebook']),
        folder_id: ROOT_FOLDER_ID,
        created_at: dayAgo,
        updated_at: isoNow,
        is_deleted: 0,
        is_synced: 0,
      },
      {
        id: 2,
        uuid: makeUuid(),
        title: 'Weekly Focus',
        content:
          '# Weekly Focus\n\n- Finalize product roadmap milestones\n- Review `markdownParser.ts` edge cases\n- Keep meetings under **30 minutes**',
        tags: JSON.stringify(['Work']),
        folder_id: 'folder_work',
        created_at: dayAgo,
        updated_at: hourAgo,
        is_deleted: 0,
        is_synced: 0,
      },
      {
        id: 3,
        uuid: makeUuid(),
        title: 'Reading Notes',
        content:
          '# Reading Notes\n\nOne idea per screen, one way to do each thing.\n\n- Calm interfaces reduce cognitive load\n- Clear hierarchy guides the eye without noise',
        tags: JSON.stringify(['Notebook']),
        folder_id: ROOT_FOLDER_ID,
        created_at: dayAgo,
        updated_at: dayAgo,
        is_deleted: 0,
        is_synced: 0,
      },
    ];
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }

  if (!localStorage.getItem(EVENTS_KEY)) {
    const todayAt = (h: number, m = 0) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      return d.toISOString();
    };
    const events: EventRow[] = [
      {
        id: 1,
        uuid: makeUuid(),
        title: 'Deep work block',
        notes: 'Uninterrupted writing & design time',
        starts_at: todayAt(9, 30),
        duration_minutes: 90,
        priority: 'high',
        is_pinned: 1,
        is_deleted: 0,
        created_at: isoNow,
        updated_at: isoNow,
      },
      {
        id: 2,
        uuid: makeUuid(),
        title: 'Design sync',
        notes: 'Walk through upcoming sprint priorities',
        starts_at: todayAt(14, 0),
        duration_minutes: 30,
        priority: 'medium',
        is_pinned: 0,
        is_deleted: 0,
        created_at: isoNow,
        updated_at: isoNow,
      },
    ];
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  }
}

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

class NoteRepository {
  private load(): NoteRow[] {
    ensureSeeded();
    const stored = localStorage.getItem(NOTES_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as NoteRow[];
    } catch {
      return [];
    }
  }

  private save(rows: NoteRow[]): void {
    localStorage.setItem(NOTES_KEY, JSON.stringify(rows));
  }

  private toNote(row: NoteRow): Note {
    return {
      id: row.id,
      uuid: row.uuid,
      title: row.title,
      content: row.content,
      tags: parseTags(row.tags),
      folderId: row.folder_id,
      isPinned: row.is_pinned === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isDeleted: row.is_deleted === 1,
      isSynced: row.is_synced === 1,
    };
  }

  async getAllNotes(folderId?: string): Promise<Note[]> {
    return this.load()
      .filter((n) => n.is_deleted === 0 && (!folderId || n.folder_id === folderId))
      .sort((a, b) => {
        const pinDiff = (b.is_pinned === 1 ? 1 : 0) - (a.is_pinned === 1 ? 1 : 0);
        return pinDiff !== 0 ? pinDiff : b.updated_at.localeCompare(a.updated_at);
      })
      .map((r) => this.toNote(r));
  }

  async createNote(input: NewNoteInput): Promise<Note> {
    const rows = this.load();
    const now = new Date().toISOString();
    const nextId = rows.reduce((max, n) => Math.max(max, n.id), 0) + 1;
    const row: NoteRow = {
      id: nextId,
      uuid: makeUuid(),
      title: input.title || 'Untitled Note',
      content: input.content || '',
      tags: JSON.stringify(input.tags ?? []),
      folder_id: input.folderId ?? ROOT_FOLDER_ID,
      is_pinned: input.isPinned ? 1 : 0,
      created_at: now,
      updated_at: now,
      is_deleted: 0,
      is_synced: 0,
    };
    rows.unshift(row);
    this.save(rows);
    return this.toNote(row);
  }

  async importNotes(
    items: Array<NewNoteInput & { createdAt?: string; updatedAt?: string }>
  ): Promise<Note[]> {
    if (items.length === 0) return [];
    const rows = this.load();
    const now = new Date().toISOString();
    let nextId = rows.reduce((max, n) => Math.max(max, n.id), 0) + 1;
    const createdRows: NoteRow[] = [];

    for (const item of items) {
      const createdAt =
        item.createdAt && !Number.isNaN(Date.parse(item.createdAt)) ? item.createdAt : now;
      const updatedAt =
        item.updatedAt && !Number.isNaN(Date.parse(item.updatedAt)) ? item.updatedAt : now;
      const row: NoteRow = {
        id: nextId++,
        uuid: makeUuid(),
        title: item.title.trim() || 'Imported Note',
        content: item.content ?? '',
        tags: JSON.stringify(item.tags ?? []),
        folder_id: item.folderId ?? ROOT_FOLDER_ID,
        is_pinned: item.isPinned ? 1 : 0,
        created_at: createdAt,
        updated_at: updatedAt,
        is_deleted: 0,
        is_synced: 0,
      };
      rows.unshift(row);
      createdRows.push(row);
    }

    this.save(rows);
    return createdRows.map((r) => this.toNote(r));
  }

  updateNoteSync(id: number, input: NoteUpdateInput): Note | null {
    const rows = this.load();
    const idx = rows.findIndex((n) => n.id === id && n.is_deleted === 0);
    if (idx === -1) return null;
    const cur = rows[idx]!;
    const next: NoteRow = {
      ...cur,
      title: input.title ?? cur.title,
      content: input.content ?? cur.content,
      tags: input.tags ? JSON.stringify(input.tags) : cur.tags,
      folder_id: input.folderId ?? cur.folder_id,
      is_pinned:
        input.isPinned !== undefined ? (input.isPinned ? 1 : 0) : (cur.is_pinned ?? 0),
      updated_at: new Date().toISOString(),
    };
    rows[idx] = next;
    this.save(rows);
    return this.toNote(next);
  }

  async updateNote(id: number, input: NoteUpdateInput): Promise<Note | null> {
    return this.updateNoteSync(id, input);
  }

  async softDeleteNote(id: number): Promise<boolean> {
    const rows = this.load();
    const idx = rows.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    rows[idx] = { ...rows[idx]!, is_deleted: 1, updated_at: new Date().toISOString() };
    this.save(rows);
    return true;
  }

  async softDeleteNotesInFolders(folderIds: string[]): Promise<number> {
    if (folderIds.length === 0) return 0;
    const now = new Date().toISOString();
    let changed = 0;
    const rows = this.load().map((n) => {
      if (n.is_deleted === 0 && folderIds.includes(n.folder_id)) {
        changed += 1;
        return { ...n, is_deleted: 1, updated_at: now };
      }
      return n;
    });
    this.save(rows);
    return changed;
  }
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

function isInsideSubtree(rows: FolderRow[], candidateId: string, rootId: string): boolean {
  let currentId: string | null = candidateId;
  while (currentId) {
    if (currentId === rootId) return true;
    const row = rows.find((r) => r.id === currentId);
    currentId = row?.parent_id ?? null;
  }
  return false;
}

class FolderRepository {
  private load(): FolderRow[] {
    ensureSeeded();
    const stored = localStorage.getItem(FOLDERS_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as FolderRow[];
    } catch {
      return [];
    }
  }

  private save(rows: FolderRow[]): void {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(rows));
  }

  async getAllFolders(): Promise<Folder[]> {
    const rows = this.load();
    if (!rows.some((f) => f.id === ROOT_FOLDER_ID)) {
      const now = new Date().toISOString();
      rows.unshift({
        id: ROOT_FOLDER_ID,
        uuid: makeUuid(),
        label: 'Main',
        parent_id: null,
        is_deleted: 0,
        created_at: now,
        updated_at: now,
      });
      this.save(rows);
    }
    return rows.filter((f) => f.is_deleted === 0).map(toFolder);
  }

  async createFolder(label: string, parentId: string): Promise<Folder> {
    const rows = this.load();
    const now = new Date().toISOString();
    const uuid = makeUuid();
    const row: FolderRow = {
      id: `folder_${uuid}`,
      uuid,
      label: label.trim() || 'New Folder',
      parent_id: parentId,
      is_deleted: 0,
      created_at: now,
      updated_at: now,
    };
    rows.push(row);
    this.save(rows);
    return toFolder(row);
  }

  async renameFolder(id: string, label: string): Promise<Folder | null> {
    if (id === ROOT_FOLDER_ID) return null;
    const trimmed = label.trim();
    if (!trimmed) return null;
    const rows = this.load();
    const idx = rows.findIndex((f) => f.id === id && f.is_deleted === 0);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx]!, label: trimmed, updated_at: new Date().toISOString() };
    this.save(rows);
    return toFolder(rows[idx]!);
  }

  async moveFolder(id: string, targetParentId: string): Promise<boolean> {
    if (id === targetParentId || id === ROOT_FOLDER_ID) return false;
    const rows = this.load();
    const live = rows.filter((f) => f.is_deleted === 0);
    if (isInsideSubtree(live, targetParentId, id)) return false;
    const idx = rows.findIndex((f) => f.id === id);
    if (idx === -1) return false;
    rows[idx] = { ...rows[idx]!, parent_id: targetParentId, updated_at: new Date().toISOString() };
    this.save(rows);
    return true;
  }

  async duplicateFolder(id: string): Promise<Folder | null> {
    if (id === ROOT_FOLDER_ID) return null;
    const folders = await this.getAllFolders();
    const source = folders.find((f) => f.id === id);
    if (!source) return null;
    const clones = new Map<string, Folder>();
    const cloneSubtree = async (folderId: string, newParentId: string): Promise<void> => {
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return;
      const label = folderId === id ? `${folder.label} copy` : folder.label;
      const clone = await this.createFolder(label, newParentId);
      clones.set(folderId, clone);
      for (const child of folders.filter((f) => f.parentId === folderId)) {
        await cloneSubtree(child.id, clone.id);
      }
    };
    await cloneSubtree(id, source.parentId ?? ROOT_FOLDER_ID);
    return clones.get(id) ?? null;
  }

  async softDeleteFolder(id: string): Promise<boolean> {
    if (id === ROOT_FOLDER_ID) return false;
    const folders = await this.getAllFolders();
    const doomed = collectSubtreeIds(folders, id);
    if (doomed.length === 0) return false;
    const now = new Date().toISOString();
    const rows = this.load().map((f) =>
      doomed.includes(f.id) ? { ...f, is_deleted: 1, updated_at: now } : f
    );
    this.save(rows);
    return true;
  }
}

function parsePriority(raw: unknown): EventPriority | null {
  return EVENT_PRIORITIES.includes(raw as EventPriority) ? (raw as EventPriority) : null;
}

function normalizeDuration(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 60;
  return Math.min(24 * 60, Math.max(15, Math.round(n)));
}

class EventRepository {
  private load(): EventRow[] {
    ensureSeeded();
    const stored = localStorage.getItem(EVENTS_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed as EventRow[]) : [];
    } catch {
      return [];
    }
  }

  private save(rows: EventRow[]): void {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(rows));
  }

  private toEvent(row: EventRow): Event {
    const priority = parsePriority(row.priority);
    return {
      id: row.id,
      uuid: row.uuid,
      title: row.title,
      notes: row.notes ?? '',
      startsAt: row.starts_at,
      durationMinutes: row.duration_minutes,
      ...(priority ? { priority } : {}),
      isPinned: row.is_pinned === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isDeleted: row.is_deleted === 1,
    };
  }

  async getAllEvents(): Promise<Event[]> {
    return this.load()
      .filter((e) => e.is_deleted === 0)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((r) => this.toEvent(r));
  }

  async createEvent(input: NewEventInput): Promise<Event> {
    const rows = this.load();
    const now = new Date().toISOString();
    const nextId = rows.reduce((max, e) => Math.max(max, e.id), 0) + 1;
    const row: EventRow = {
      id: nextId,
      uuid: makeUuid(),
      title: input.title.trim() || 'Untitled Event',
      notes: input.notes ?? '',
      starts_at: input.startsAt,
      duration_minutes: normalizeDuration(input.durationMinutes),
      priority: input.priority ?? null,
      is_pinned: input.isPinned ? 1 : 0,
      is_deleted: 0,
      created_at: now,
      updated_at: now,
    };
    rows.push(row);
    this.save(rows);
    return this.toEvent(row);
  }

  async updateEvent(id: number, input: EventUpdateInput): Promise<Event | null> {
    const rows = this.load();
    const idx = rows.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const cur = rows[idx]!;
    const next: EventRow = {
      ...cur,
      title: input.title !== undefined ? input.title.trim() || 'Untitled Event' : cur.title,
      notes: input.notes ?? cur.notes ?? '',
      starts_at: input.startsAt ?? cur.starts_at,
      duration_minutes:
        input.durationMinutes !== undefined
          ? normalizeDuration(input.durationMinutes)
          : cur.duration_minutes,
      priority:
        input.priority === undefined
          ? cur.priority
          : input.priority === null
            ? null
            : parsePriority(input.priority),
      is_pinned: input.isPinned !== undefined ? (input.isPinned ? 1 : 0) : cur.is_pinned,
      updated_at: new Date().toISOString(),
    };
    rows[idx] = next;
    this.save(rows);
    return this.toEvent(next);
  }

  async softDeleteEvent(id: number): Promise<boolean> {
    const rows = this.load();
    const idx = rows.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    rows[idx] = { ...rows[idx]!, is_deleted: 1, updated_at: new Date().toISOString() };
    this.save(rows);
    return true;
  }
}

class PrefsRepository {
  private load(): Record<string, string> {
    const stored = localStorage.getItem(PREFS_KEY);
    if (!stored) return {};
    const parsed: Record<string, string> = {};
    for (const line of stored.split('\n')) {
      if (!line) continue;
      const at = line.indexOf('=');
      if (at <= 0) continue;
      parsed[line.slice(0, at)] = line.slice(at + 1);
    }
    return parsed;
  }

  private save(prefs: Record<string, string>): void {
    localStorage.setItem(
      PREFS_KEY,
      Object.entries(prefs)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n')
    );
  }

  async getAll(): Promise<Record<string, string>> {
    return this.load();
  }

  async setMany(entries: Record<string, string>): Promise<void> {
    if (Object.keys(entries).length === 0) return;
    this.save({ ...this.load(), ...entries });
  }
}

export const noteRepository = new NoteRepository();
export const folderRepository = new FolderRepository();
export const eventRepository = new EventRepository();
export const prefsRepository = new PrefsRepository();
