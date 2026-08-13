# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Core Stack
- Framework: React Native (Expo SDK) with TypeScript
- Platform Support: Android, Web, Windows, Linux (and future iOS, macOS)
- Primary Local Database: SQLite via `expo-sqlite` (Web via Wasm / OPFS)
- State Management: Zustand
- Styling: NativeWind (Tailwind CSS for React Native)
- Markdown Engine: `react-native-markdown-display`

## Architecture

### Data layer (`src/db/`)
- `schema.ts` — DB singleton via `initDatabase()`. `NoteRow` maps 1:1 to the `notes` table columns. Do NOT call `initDatabase` more than once at app startup.
- `NoteRepository.ts` — All SQL lives here. Exported as `noteRepository` singleton. Converts between `NoteRow` (on-disk) and `Note` (app-facing: `boolean` fields, parsed `string[]` tags). All mutations return the updated `Note` or `null`. Deleted rows are excluded from reads but kept in the table for future sync.

### State layer (`src/store/`)
- `useNoteStore.ts` — Zustand v5 store. Delegates every action to `noteRepository` and mirrors the result into `notes` (newest first). Exposes `isLoading` / `error` for UI binding. Do NOT duplicate SQLite logic here.

## Execution Rules
- Offline-First: Write all note edits to local SQLite instantly before queuing any network operations.
- Minimalist Dark UI: Focus on performance, zero-latency typing, and clean dark mode.
- Strict Type Safety: Define TypeScript interfaces for all data models and database rows.

## TODO — Future Persistence
- **Tasks**: Currently in-memory (`useState` in `HomeScreen`). Add a `tasks` table to `schema.ts` with columns (`id`, `uuid`, `label`, `source_note`, `done`, `created_at`, `updated_at`, `is_deleted`). Extend `NoteRepository` with task CRUD, then create a `useTaskStore` (Zustand) mirroring the note store pattern.
- **Calendar Events**: Currently in-memory (`useState` in `HomeScreen`). Add an `events` table (`id`, `uuid`, `title`, `time`, `slot_index`, `date`, `color`, `is_deleted`) and a `useEventStore`. The `CalendarTimeline` component already accepts `CalendarEvent[]` — just swap the data source.
