import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'notes.db';

export interface NoteRow {
  id: number;
  uuid: string;
  title: string;
  content: string; // Raw Markdown payload
  tags: string; // Stringified JSON array e.g. '["work", "idea"]'
  folder_id: string; // Owning folder uuid; 'main' for the root folder
  created_at: string;
  updated_at: string;
  is_deleted: number; // 0 or 1
  is_synced: number; // 0 or 1
}

export interface FolderRow {
  id: string;
  uuid: string;
  label: string;
  parent_id: string | null; // null for the root folder
  is_deleted: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: number;
  uuid: string;
  title: string;
  notes: string;
  starts_at: string; // ISO 8601 instant, stored UTC and rendered in local time
  duration_minutes: number;
  /** `'urgent' | 'high' | 'medium' | 'low'`; null means no priority flag. */
  priority: string | null;
  is_pinned: number; // 0 or 1
  is_deleted: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

/**
 * Schema definition executed once per database to bring it to its current shape.
 */
const SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    folder_id TEXT NOT NULL DEFAULT 'main',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    is_synced INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    uuid TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    parent_id TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prefs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    starts_at TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    priority TEXT,
    is_pinned INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events (starts_at);
`;

/**
 * Current schema version, stored in SQLite's `user_version` pragma.
 *
 * **The reason this exists at all:** `SCHEMA_SQL` is `CREATE TABLE IF NOT EXISTS`,
 * so editing a table definition only affects *fresh* databases. A device that
 * already has `notes.db` would keep the old table — and because every write in
 * `EventRepository` names its columns explicitly, a column the table does not
 * have turns every insert and update into a runtime error rather than a silent
 * no-op. Adding `priority` to the DDL on its own would have shipped that crash.
 */
const SCHEMA_VERSION = 2;

/**
 * Statements applied in order to bring an older database up to `SCHEMA_VERSION`.
 *
 * Each one is additive and idempotent-by-probe (see `applyMigrations`). Do not
 * edit a shipped entry; append a new one and raise `SCHEMA_VERSION`, or users
 * who already ran the old one will never apply the new one.
 */
const MIGRATIONS: readonly { version: number; sql: string }[] = [
  // v1 — the events table gains a priority flag, replacing the free-text tint.
  {
    version: 1,
    sql: `ALTER TABLE events ADD COLUMN priority TEXT`,
  },
  // v2 — events gain an optional notes field. Existing events read as empty.
  {
    version: 2,
    sql: `ALTER TABLE events ADD COLUMN notes TEXT NOT NULL DEFAULT ''`,
  },
];

/** Whether `events` already carries `priority`, without throwing if it does not. */
async function hasPriorityColumn(db: SQLiteDatabase): Promise<boolean> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(events)`);
  return columns.some((c) => c.name === 'priority');
}

async function hasNotesColumn(db: SQLiteDatabase): Promise<boolean> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(events)`);
  return columns.some((c) => c.name === 'notes');
}

/**
 * Brings an existing database up to `SCHEMA_VERSION`.
 *
 * Two guards, because either alone is a way to ship a broken database:
 * `user_version` says which migrations are outstanding, and each `ALTER` is
 * *probed* before it runs — a fresh install already has the column from
 * `SCHEMA_SQL` while still reporting `user_version = 0`, so a version check on
 * its own would try to add a column that exists and abort every launch.
 *
 * The `try/catch` is belt and braces for the same race, not the primary guard.
 *
 * **The web path never reaches this.** `localStorage` holds whole JSON objects,
 * so an older payload simply lacks the field and `toEvent` treats it as unset.
 */
async function applyMigrations(db: SQLiteDatabase): Promise<void> {
  let current = 0;
  try {
    const row = await db.getFirstAsync<{ user_version: number }>(`PRAGMA user_version`);
    current = row?.user_version ?? 0;
  } catch {
    current = 0;
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    if (migration.version === 1 && (await hasPriorityColumn(db))) continue;
    if (migration.version === 2 && (await hasNotesColumn(db))) continue;
    try {
      await db.execAsync(migration.sql);
    } catch {
      // Already applied by some earlier build that did not bump the version.
    }
  }

  if (current < SCHEMA_VERSION) {
    try {
      await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    } catch {
      // Not fatal: the probe above is what actually keeps the schema correct.
    }
  }
}

let dbInstance: SQLiteDatabase | null = null;
let dbInitialization: Promise<SQLiteDatabase> | null = null;

/**
 * Opens (or returns the cached) database connection and ensures the schema is
 * initialized. The same singleton connection is reused for the lifetime of the
 * app to avoid re-opening and re-migrating on every call.
 */
export async function initDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!dbInitialization) {
    dbInitialization = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(SCHEMA_SQL);
      await applyMigrations(db);

      dbInstance = db;
      return db;
    })().catch((error: unknown) => {
      dbInitialization = null;
      throw error;
    });
  }

  return dbInitialization;
}
