# Version History

## 0.1.0 — Local SQLite persistence + Zustand store

### What was added

- **`src/db/NoteRepository.ts`** — Repository class backed by `expo-sqlite` v57 async API, exposed as a singleton `noteRepository`. Provides `createNote`, `updateNote`, `softDeleteNote`, and `getAllNotes`.
  - `createNote` inserts a row and returns the full `Note`.
  - `updateNote` does partial updates via `COALESCE`, skips soft-deleted rows, returns updated note or `null`.
  - `softDeleteNote` sets `is_deleted = 1` (row preserved for future sync/undo) and refreshes `updated_at`.
  - `getAllNotes` returns non-deleted notes ordered by `updated_at DESC`.
  - Translates on-disk `NoteRow` (integer booleans, JSON-stringified tags) into a clean app-facing `Note` type.
  - Typed with `Note`, `NewNoteInput`, and `NoteUpdateInput` interfaces.

- **`src/store/useNoteStore.ts`** — Zustand v5 store that delegates all CRUD to the repository and mirrors results into `notes` state. Tracks `isLoading` and `error` for UI binding.
  - `createNote` prepends the new note.
  - `updateNote` swaps the updated note in-place.
  - `softDeleteNote` filters the note out of the list.
  - All actions maintain newest-first ordering.

- **`src/db/schema.ts`** — `initDatabase()` refactored to cache the `SQLiteDatabase` connection as a singleton, preventing repeated opens/migrations. `NoteRow` interface and table schema unchanged.

### Verification

- `tsc --noEmit` passes under `strict: true` (all three files confirmed compiled via `--listFiles`).
- Runtime requires Expo/React Native — type-check only in this environment.

## 0.2.0 — UI layer + bug fixes (2026-08-11 01:27 WAT)

### What was added

- **`src/screens/HomeScreen.tsx`** — Full note-taking UI screen with sidebar note list, editor, and markdown preview.
  - `FlatList` renders non-deleted notes; `keyExtractor` uses `item.id`.
  - `renderItem` shows title and `updated_at` date; highlights the selected note.
  - Editor toolbar with Edit/Preview toggle and Delete button.
  - `TextInput` for editing; `react-native-markdown-display` for preview.
  - `handleCreate` calls `createNote` with title/content/tags; `handleContentChange` updates local state instantly and persists to SQLite.

### Bug fixes

- **`App.tsx`** — Removed invalid `height: '100vh'` from container style (React Native does not support CSS `vh` units; `flex: 1` already fills the screen).
- **`HomeScreen.tsx`** — Fixed broken import `'react me-native'` → `'react-native'` (typo caused `FlatList`/`View`/etc. to resolve to `any`, cascading into implicit-`any` errors on `keyExtractor` and `renderItem`).
- **`HomeScreen.tsx`** — Renamed `loadNotes` → `getAllNotes` to match the actual Zustand store method name.
- **`HomeScreen.tsx`** — Removed `uuid` from `createNote` call; the repository generates its own UUID internally (the `NewNoteInput` type omits `uuid`).
- **`HomeScreen.tsx`** — Fixed `item.updatedAt` → `item.updated_at` to match the `Note` interface's snake_case field names.
- **`HomeScreen.tsx`** — Restored missing imports (`useNoteStore`, `Note`, `Markdown`) and component wrapper that were lost during a prior edit.

### Verification

- `tsc --noEmit` passes under `strict: true` — 0 errors, 0 warnings across the project.
