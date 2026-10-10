import { Platform } from 'react-native';
import { initDatabase } from './schema';

/** localStorage key for the web-only preview store. */
const WEB_STORAGE_KEY = 'notes_app_prefs';

/** Newline-delimited `key=value` pairs, so a hand-edited blob stays readable. */
const PAIR_SEPARATOR = '\n';
const KEY_VALUE_SEPARATOR = '=';

/**
 * Repository owning all user-preference persistence (theme, dashboard layout).
 *
 * Split out from `NoteRepository` rather than added to it: preferences are not
 * user content, they are app configuration. They also have a different shape —
 * a small key/value bag rather than rows — and mixing the two would make the
 * note queries carry a concern they have no business knowing about.
 *
 * Mirrors `NoteRepository`'s two backends: SQLite on native, `localStorage` on
 * the web preview. Values are stored as opaque strings; the store layer owns
 * JSON encoding and validation.
 */
export class PrefsRepository {
  private readonly isWeb = Platform.OS === 'web';

  /**
   * Parsed fresh on every read, with no in-memory mirror.
   *
   * `NoteRepository` caches because it owns a whole note table. Preferences do
   * not justify that: the bag is a handful of keys read once at launch, and a
   * cache here is a stale-state bug waiting to happen — a second instance (or
   * another tab) writing `localStorage` would leave the cached copy behind and
   * the app would silently keep rendering the old layout.
   */
  private loadWebPrefs(): Record<string, string> {
    const stored = localStorage.getItem(WEB_STORAGE_KEY);
    if (!stored) return {};
    const parsed: Record<string, string> = {};
    for (const line of stored.split(PAIR_SEPARATOR)) {
      if (!line) continue;
      // Split on the *first* separator only: a JSON layout value contains no
      // newlines but its `=`-free text is not guaranteed, and truncating a value
      // would silently reset a preference.
      const at = line.indexOf(KEY_VALUE_SEPARATOR);
      if (at <= 0) continue;
      parsed[line.slice(0, at)] = line.slice(at + 1);
    }
    return parsed;
  }

  private persistWebPrefs(prefs: Record<string, string>): void {
    const entries = Object.entries(prefs);
    localStorage.setItem(
      WEB_STORAGE_KEY,
      entries
        .map(([key, value]) => `${key}${KEY_VALUE_SEPARATOR}${value}`)
        .join(PAIR_SEPARATOR)
    );
  }

  /** Every stored preference. Returns `{}` on native, which reads per key. */
  async getAll(): Promise<Record<string, string>> {
    if (this.isWeb) return this.loadWebPrefs();

    const db = await initDatabase();
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM prefs`
    );
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  /** Read one preference, or `null` when it has never been written. */
  async get(key: string): Promise<string | null> {
    if (this.isWeb) return this.loadWebPrefs()[key] ?? null;

    const db = await initDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM prefs WHERE key = ?`,
      [key]
    );
    return row?.value ?? null;
  }

  /** Insert or update one preference. */
  async set(key: string, value: string): Promise<void> {
    if (this.isWeb) {
      this.persistWebPrefs({ ...this.loadWebPrefs(), [key]: value });
      return;
    }

    const db = await initDatabase();
    await db.runAsync(
      `INSERT INTO prefs (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    );
  }

  /** Write many preferences in one round trip. */
  async setMany(entries: Record<string, string>): Promise<void> {
    const keys = Object.keys(entries);
    if (keys.length === 0) return;

    if (this.isWeb) {
      this.persistWebPrefs({ ...this.loadWebPrefs(), ...entries });
      return;
    }

    const db = await initDatabase();
    for (const key of keys) {
      await db.runAsync(
        `INSERT INTO prefs (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, entries[key]]
      );
    }
  }
}

export const prefsRepository = new PrefsRepository();
