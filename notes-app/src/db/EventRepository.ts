import { Platform } from 'react-native';
import { initDatabase } from './schema';
import type { EventRow } from './schema';
import { EVENT_PRIORITIES, type Event, type EventPriority, type EventUpdateInput, type NewEventInput } from '../types';
import { markEventPendingSync } from './sync';

/**
 * localStorage key for the web-only preview store. Separate from the notes key:
 * clearing one collection must never take the other with it.
 */
const WEB_STORAGE_KEY = 'notes_app_events';

/** An event with no duration is a marker, not a zero-height box. */
const MIN_DURATION_MINUTES = 15;
const DEFAULT_DURATION_MINUTES = 60;

/**
 * Narrows a stored string to a known level, or `null`.
 *
 * A stored value that is not in `EVENT_PRIORITIES` is **dropped, not trusted**.
 * `priority` is a TEXT column and this file is the only writer, so a bad value
 * can only arrive from a hand-edited `localStorage` payload, an older build, or
 * a database that never got migrated. Any of those should render an unflagged
 * event, not one wearing a colour the palette has no entry for — which would
 * read as "urgent" while meaning "corrupt".
 */
function parsePriority(raw: unknown): EventPriority | null {
  return EVENT_PRIORITIES.includes(raw as EventPriority) ? (raw as EventPriority) : null;
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/** Clamp to a drawable range and reject NaN, which `Number()` happily produces. */
function normalizeDuration(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_DURATION_MINUTES;
  return Math.min(24 * 60, Math.max(MIN_DURATION_MINUTES, Math.round(n)));
}

/**
 * Repository owning all event persistence.
 *
 * Mirrors `NoteRepository`'s two-backend split exactly: SQLite on native,
 * `localStorage` on web, branching on `Platform.OS === 'web'` once per method.
 *
 * There is **no in-memory mirror** of the rows beyond the web payload, and no
 * read filter by date: the calendar needs the whole set to lay out a month, and
 * an app this size holds a calendar's worth of events in memory without trouble.
 * Filtering by range would trade a whole-table read for a query whose only
 * benefit is a number that never gets large enough to matter.
 */
export class EventRepository {
  private readonly isWeb = Platform.OS === 'web';

  /** Web only — hydrated in the constructor, exactly like `NoteRepository`. */
  private webEvents: EventRow[] = [];

  constructor() {
    if (this.isWeb) {
      this.webEvents = this.loadWebEvents();
    }
  }

  // ---- Shared mapping -------------------------------------------------

  private toEvent(row: EventRow): Event {
    const priority = parsePriority(row.priority);
    return {
      id: row.id,
      uuid: row.uuid,
      title: row.title,
      notes: row.notes ?? '',
      startsAt: row.starts_at,
      durationMinutes: row.duration_minutes,
      // Key **absent** rather than `undefined`: "no priority" is a real state,
      // and the UI checks for it with `'priority' in ev`.
      ...(priority ? { priority } : {}),
      isPinned: row.is_pinned === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isDeleted: row.is_deleted === 1,
    };
  }

  // ---- Web (localStorage) storage ------------------------------------

  private loadWebEvents(): EventRow[] {
    const stored = localStorage.getItem(WEB_STORAGE_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed as EventRow[]) : [];
    } catch {
      return [];
    }
  }

  private persistWebEvents(): void {
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(this.webEvents));
  }

  private nextWebId(): number {
    return this.webEvents.reduce((max, e) => Math.max(max, e.id), 0) + 1;
  }

  // ---- Public API -----------------------------------------------------

  /** Every live event, soonest first. */
  async getAllEvents(): Promise<Event[]> {
    if (this.isWeb) {
      return this.webEvents
        .filter((e) => e.is_deleted === 0)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .map(this.toEvent);
    }

    const db = await initDatabase();
    const rows = await db.getAllAsync<EventRow>(
      `SELECT * FROM events WHERE is_deleted = 0 ORDER BY starts_at ASC`
    );
    return rows.map(this.toEvent);
  }

  async createEvent(input: NewEventInput): Promise<Event> {
    const now = new Date().toISOString();
    const row: EventRow = {
      id: 0,
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

    if (this.isWeb) {
      row.id = this.nextWebId();
      this.webEvents.push(row);
      this.persistWebEvents();
      return this.toEvent(row);
    }

    const db = await initDatabase();
    const result = await db.runAsync(
      `INSERT INTO events (uuid, title, notes, starts_at, duration_minutes, priority, is_pinned, is_deleted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        row.uuid,
        row.title,
        row.notes,
        row.starts_at,
        row.duration_minutes,
        row.priority,
        row.is_pinned,
        row.created_at,
        row.updated_at,
      ]
    );
    row.id = result.lastInsertRowId;
    markEventPendingSync(row.id);
    markEventPendingSync(row.id);
    return this.toEvent(row);
  }

  async updateEvent(id: number, input: EventUpdateInput): Promise<Event | null> {
    const now = new Date().toISOString();

    if (this.isWeb) {
      const index = this.webEvents.findIndex((e) => e.id === id);
      if (index === -1) return null;
      const current = this.webEvents[index]!;
      const next: EventRow = {
        ...current,
        title: input.title !== undefined ? input.title.trim() || 'Untitled Event' : current.title,
        notes: input.notes ?? current.notes ?? '',
        starts_at: input.startsAt ?? current.starts_at,
        duration_minutes:
          input.durationMinutes !== undefined
            ? normalizeDuration(input.durationMinutes)
            : current.duration_minutes,
        // `undefined` means "leave it alone" and `null` means "clear it", which
        // is what makes taking a priority *off* an event expressible at all.
        priority:
          input.priority === undefined
            ? current.priority
            : input.priority === null
              ? null
              : parsePriority(input.priority),
        is_pinned:
          input.isPinned !== undefined ? (input.isPinned ? 1 : 0) : current.is_pinned,
        updated_at: now,
      };
      this.webEvents[index] = next;
      this.persistWebEvents();
      return this.toEvent(next);
    }

    const db = await initDatabase();
    const existing = await db.getFirstAsync<EventRow>(
      `SELECT * FROM events WHERE id = ? AND is_deleted = 0`,
      [id]
    );
    if (!existing) return null;

    const title =
      input.title !== undefined ? input.title.trim() || 'Untitled Event' : existing.title;
    const notes = input.notes ?? existing.notes ?? '';
    const startsAt = input.startsAt ?? existing.starts_at;
    const duration =
      input.durationMinutes !== undefined
        ? normalizeDuration(input.durationMinutes)
        : existing.duration_minutes;
    const priority =
      input.priority === undefined
        ? existing.priority
        : input.priority === null
          ? null
          : parsePriority(input.priority);
    const isPinned = input.isPinned !== undefined ? (input.isPinned ? 1 : 0) : existing.is_pinned;

    await db.runAsync(
      `UPDATE events
          SET title = ?, notes = ?, starts_at = ?, duration_minutes = ?, priority = ?, is_pinned = ?, updated_at = ?
        WHERE id = ?`,
      [title, notes, startsAt, duration, priority, isPinned, now, id]
    );

    return this.toEvent({
      ...existing,
      title,
      notes,
      starts_at: startsAt,
      duration_minutes: duration,
      priority,
      is_pinned: isPinned,
      updated_at: now,
    });
    markEventPendingSync(id);
  }

  async softDeleteEvent(id: number): Promise<boolean> {
    const now = new Date().toISOString();

    if (this.isWeb) {
      const index = this.webEvents.findIndex((e) => e.id === id);
      if (index === -1) return false;
      this.webEvents[index] = { ...this.webEvents[index]!, is_deleted: 1, updated_at: now };
      this.persistWebEvents();
      return true;
    }

    const db = await initDatabase();
    await db.runAsync(`UPDATE events SET is_deleted = 1, updated_at = ? WHERE id = ?`, [now, id]);
    markEventPendingSync(id);
    markEventPendingSync(id);
    return true;
  }
}

export const eventRepository = new EventRepository();
