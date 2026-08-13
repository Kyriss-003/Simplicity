# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Core Stack
- Framework: React Native (Expo SDK) with TypeScript
- Platform Support: Android, Web, Windows, Linux (and future iOS, macOS)
- Primary Local Database: SQLite via `expo-sqlite` (Web via Wasm / OPFS)
- State Management: Zustand v5
- Styling: **StyleSheet.create** + inline theme tokens from `src/theme.ts`. `nativewind` is declared in `package.json` but **NOT wired up** — no `babel-preset-nativewind`, no `className=` usage anywhere in `src/`. Do NOT use Tailwind classes.
- Markdown Engine: `react-native-markdown-display`
- Icons: `@expo/vector-icons` (Ionicons + MaterialCommunityIcons)

## Build & Verification Commands
- `npx tsc --noEmit` — type-check (required before committing)
- `npx expo start` — dev server (web/ios/android)
- **Known bundling gotchas**: Web build fails on `wa-sqlite.wasm` resolution; Android build fails on `punycode` (markdown-it dep). These are pre-existing packaging issues — do not try to fix them unless asked.

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

## Layer Boundaries (DO NOT CROSS)
- `src/db/` — SQL only. No UI, no state, no navigation.
- `src/store/` — Zustand stores only. Delegates to `noteRepository`. No SQLite calls here.
- `src/components/` — Presentational. Receives theme + data + callbacks. No direct DB or store imports.
- `src/screens/` — Orchestrators only. Wire components + state + handlers. No SQL, no business logic.
- `src/theme.ts` — Single source of truth for colors. All components consume `theme.accent` / `theme.surface` etc. — never hard-code hex values.

# AGENT UI DESIGN SYSTEM RULES

## 1. COLOR DISTRIBUTION (60 - 30 - 10 RULE)
- **60% Primary Neutral Base**: Main canvas & background.
  - Dark Theme: `#0D0D0E`
  - OLED Theme: `#000000`
  - Light Theme: `#F8F9FA` / `#FFFFFF`
- **30% Secondary Structural Base**: Surfaces, cards, structural borders, text contrast.
  - Card Surfaces: `#161618`
  - Borders/Dividers: `#232326`
  - Text Primary: `#EDEDED` | Text Secondary: `#8E8E93`
- **10% Brand Accent**: **Lavender** (`#B497FF` or `#A855F7`)
  - Reserved strictly for active state highlights, primary action buttons, selected icons, and toggles.

## 2. STRICT TYPOGRAPHY HIERARCHY
Eliminate size and weight randomness across all components.
- **Maximum 4 Font Sizes**:
  - `Size 1 (Page Headers / Dynamic Greetings)`: 24px
  - `Size 2 (Card Headers / Titles)`: 18px
  - `Size 3 (Body Text / Input Fields / Task Items)`: 14px
  - `Size 4 (Captions / Date Subtext / Nav Labels)`: 12px
- **Maximum 2 Font Weights**:
  - `Regular` (400)
  - `Semibold` (600)

## 3. SPACING & SIZING (STRICT 8pt / 4pt GRID SYSTEM)
- All paddings, margins, gaps, container dimensions, and row heights **MUST be divisible by 8 or 4**.
- Approved spacing scale: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`.
- **Row Heights Constraint**:
  - Task items and Calendar time rows MUST be set strictly to **48px** vertical height.
- Never use arbitrary numbers (e.g., do NOT use 7px, 11px, 13px, 15px, 22px).


## 4. LIGHT THEME & MODAL OVERLAY SPECIFICATIONS
- **Light Theme Colors**:
  - Primary Base (60%): Main Canvas = `#FFFFFF` | Sidebar Tint = `#F4F4F6`
  - Complimentary Base (30%): Text/Pills = `#18181B` (Zinc-900)
  - Brand Accent (10%): Lavender (`#B497FF` or `#8B5CF6`)
- **FAB Overlay**: Use a true backdrop blur (`backdrop-filter: blur(12px)`) with 40% alpha backdrop tint when the FAB speed dial is active.
- **Modals**: Standard picker modals must use an iPad-mini responsive form factor (`maxWidth: 540`, `maxHeight: 680`, `borderRadius: 16`).


