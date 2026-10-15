/*
 * Supabase schema for the Notes app.
 *
 * Mirrors the SQLite schema in src/db/schema.ts. Applied as a migration on the
 * remote Postgres instance via mcp__supabase__apply_migration. The local SQLite
 * database remains the source of truth; these tables exist to host the data in
 * the cloud for the sync bridge.
 */

CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS prefs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_uuid ON notes(uuid);
CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_notes_synced ON notes(is_synced);
CREATE INDEX IF NOT EXISTS idx_folders_uuid ON folders(uuid);
CREATE INDEX IF NOT EXISTS idx_events_uuid ON events(uuid);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(starts_at, is_deleted);
*/

-- @meta sync
-- @note Local SQLite is the source of truth. These tables host the data in the cloud.