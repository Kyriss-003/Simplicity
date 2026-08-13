import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'notes.db';

export interface NoteRow {
  id: number;
  uuid: string;
  title: string;
  content: string; // Raw Markdown payload
  tags: string; // Stringified JSON array e.g. '["work", "idea"]'
  created_at: string;
  updated_at: string;
  is_deleted: number; // 0 or 1
  is_synced: number; // 0 or 1
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
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    is_synced INTEGER DEFAULT 0
  );
`;

let dbInstance: SQLiteDatabase | null = null;

/**
 * Opens (or returns the cached) database connection and ensures the schema is
 * initialized. The same singleton connection is reused for the lifetime of the
 * app to avoid re-opening and re-migrating on every call.
 */
export async function initDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await db.execAsync(SCHEMA_SQL);

  dbInstance = db;
  return db;
}
