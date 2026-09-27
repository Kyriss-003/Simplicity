/**
 * Minimal in-memory `localStorage` stub.
 *
 * Must be installed via `setupFiles` (not `setupFilesAfterEach`) so it exists
 * before `NoteRepository` / `FolderRepository` singletons construct themselves.
 */
class MemoryStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
  key(index) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

globalThis.localStorage = new MemoryStorage();
