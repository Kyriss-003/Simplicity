# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Core Stack
- Expo SDK 57 · React Native 0.86.3 · React 19.2.3 · TypeScript 6.0.3 (`strict`)
- State: Zustand 5. Storage: SQLite via `expo-sqlite` (native) / `localStorage` (web preview)
- Styling: `StyleSheet.create` + tokens from `src/theme.ts`. **No Tailwind, no nativewind** — those packages were removed.
- Markdown: `react-native-markdown-display` · Icons: `@expo/vector-icons`
- Web: `react-native-web` 0.21 — not just a preview layer, see **Web runtime** below.
- Tests: Jest 29 + `jest-expo`, 3 suites in `__tests__/` (59 tests)

**No new dependencies were added for the live-preview editor.** It is built on the existing
`TextInput` + `react-native-markdown-display`. Do not reach for a rich-text engine
(ProseMirror, TipTap, CodeMirror) without asking first — see the rejected options in
`review.md` § Revision 4 and `AGENTS.md` → Markdown Editor.

## Commands
- `npm run typecheck` (`tsc --noEmit`) — required before committing
- `npm test` — Jest
- `npx expo start` — dev server

## Layer Boundaries (DO NOT CROSS)
- `src/db/` — SQL only. Exports repository classes plus singletons (`noteRepository`, `folderRepository`). No UI, no state.
- `src/store/` — Zustand only. Delegates to the repositories. No SQL.
- `src/types.ts` — shared app types (`Note`, `Folder`, `Task`, `CalendarEvent`, `FolderNode`, `ScreenKey`). Components import from here, **never** from `src/db/`.
- `src/components/` — presentational. Theme, data, and callbacks via props only. No store imports.
- `src/screens/` — orchestration. `HomeScreen` is the shell (state, handlers, sidebar, FAB, modals); `OverviewScreen` / `NotesScreen` / `AgendaScreen` are presentational.
- `src/hooks/` — `useDebouncedPersist` only.
- `src/theme.ts` — single source of truth for color, type scale, spacing, radius.

## Web runtime (`react-native-web`)
The web build is a first-class preview, and the editor depends on four of its behaviours.
Verified against `node_modules/react-native-web/dist/exports/TextInput/index.js` — re-check
them after any RNW upgrade rather than trusting this note.
- `multiline` renders a real `<textarea>`: one text style, **no styled spans**, plus the UA focus ring, a 2px border and a resize grip. `Editor.tsx` resets those with a web-only `webInputReset` style. This is why syntax markers cannot be dimmed inside the input.
- The `selection` prop is applied in a `useLayoutEffect` keyed on **object identity** (`index.js:314`), and the DOM's real selection is written back on every change (`index.js:305`). So an imposed caret must be a stable object in state — a fresh literal in render re-pins the caret on every keystroke.
- `onPress` is bound to the native `click` event (`usePressEvents/PressResponder.js:303`). Right-click fires `contextMenu` only, so a row's `onContextMenu` and `onPress` cannot both fire.
- `Animated` must pass `useNativeDriver: false` on web or the native module is missing.
- Chromium's default framed scrollbar (arrow buttons and all) is replaced app-wide by the one-shot `<style>` injection in `App.tsx`. Do not add per-component scrollbar CSS.

## Design System (enforced)
**Color — 60/30/10, accent `#f76f53`.** Themes `Dark` / `OLED` / `Light` live in `theme.ts`. Sidebar matches the canvas so the 30% layer stays reserved for cards. `accentText` is dark in every theme — `#f76f53` fails WCAG AA against white. Accent is only for the FAB, active nav, selected state, and focus.
- Never hard-code a hex value, an `rgba()` shadow, or a bare `borderRadius`. Use `theme.*` and `Radius.*`.

**Type — 4 sizes × 2 weights, via `Typography.app`.** Sizes 24 / 18 / 14 / 12. Weights 400 / 600. Tokens: `pageHeader`, `cardHeader`, `body`, `caption`, each with a `…Regular` / `…Strong` variant. Raw `fontSize` / `fontWeight` is permitted only inside `theme.ts`.

**Spacing — 4pt grid.** `Spacing.approved = [4, 8, 12, 16, 24, 32, 48, 64]`. No 7, 11, 13, 15, 22.

**48px row contract** (`height: 48` + `alignItems: 'center'`): task rows, the add-task bar, calendar slot body and header, sidebar rows, context-menu rows, modal and confirm buttons. Note rows and note cards are exempt — they need multi-line height.

## Persistence
- `useDebouncedPersist` debounces writes 400ms and flushes on unmount, on note switch, and on `AppState` `background` / `inactive`. Never call `updateNote` directly from a keystroke handler.
- Local SQLite is the only source of truth. **Supabase is not integrated** — no client, no env vars, no sync. The `uuid` and `is_synced` columns are unused scaffolding.
- Keep `Theme` selection and `selectedFolderId` in mind: neither is persisted, so both reset every launch.

## Markdown Editor
- `src/components/notes/Editor.tsx` renders **live and automatically**: the block holding the caret is a raw `TextInput`, every other block is rendered markdown. There is **no preview toggle** — do not add one back.
- Parsing (`parseBlocks` → heading/paragraph/list/code), `blockIndexAt`, `editableBlock`, the pure `decorationLayer(blocks, caret, active)`, `activeBlockStyle` and `mergeWithPrevious` all live in `src/components/shared/utils.ts` and are unit-tested. The editor must not re-derive the active block by hand.
- **Granularity is the block, never the line.** One input per line was tried and reverted: separate inputs cannot share arrow focus, word-wrap or line merging, so the caret teleported. Do not re-split it.
- A block's input holds only that block's text — the blank lines before it are excluded on purpose, which is what leaves Backspace at offset 0 free to merge. Enter is a native soft break inside the block; a blank line starts a new block.
- Boundary keys only, and only at the buffer edge: `ArrowUp` at 0, `ArrowDown` at the end, `Backspace` at 0. Every key *inside* a block belongs to the platform — never re-implement caret logic.
- `onBlur` must **not** collapse the document immediately. Press-down blurs before the press completes, so an instant collapse decorates everything and unmounts the input mid-gesture. Use `BLUR_GRACE_MS` and cancel it in `focusBlock` / `onFocus`; the timer is cleared on unmount.
- The Editor holds caret state in **document** coordinates, and the input holds **block** text. Any `note.id` change must reset that state during render (not in an effect), or the new note's input is aimed at the old note's offsets.
- Metric locking is structural: both paths render `View style={styles.block}` wrapping a child styled with the same `md` key (`activeBlockStyle` picks it), so an H1 input is 24/32/600 and a fence keeps its surface. Do not restate font, line-height or padding on either side.
- Syntax markers stay in the active buffer at full contrast: a `TextInput` has one text style (a `<textarea>` on web), so dimming markers would mean removing them and breaking the 1:1 offset contract. Not an oversight.
- The input fills the pane only when there is a single block (`fillsCanvas`); with anything else on screen the flow scrolls, because a full-height input would push the decorated blocks off the canvas.

## Context Menu
- Trigger: `onContextMenu` (web) + `onLongPress` (native), using real event coordinates.
- Menu state lives in `Sidebar` / `NotesView` local state.
- The root folder (`main`) offers only **New Note** and **New Sub-folder**. Other folders add Rename / Move to… / Duplicate / Delete Folder (6 total). `FolderRepository` refuses rename, move, duplicate, and delete on the root — the UI mirrors that guard rather than relying on it.
- Notes offer Move to folder / Duplicate / Delete.
- Modals use the iPad-mini form factor: `min(90% width, 540)` × `min(80% height, 680)`, radius 16.

## Folder Tree
- `src/hooks/useFolderTree.ts` holds four **pure functions** — `buildFolderTree`, `findNode`, `flattenTree`, `subtreeIds`. Despite the filename it contains no hook.
- Mutations live in `FolderRepository`: `moveFolder` refuses cycles, `duplicateFolder` deep-clones at the correct sibling depth, `softDeleteFolder` cascades the subtree and its notes.
- The root folder is seeded as `Main` on both storage backends.

## Known Gaps
- **Web preview only.** The app has been run and screenshotted in the browser; the sidebar, folder tree, and Tasks card are visually confirmed. Android and iOS have never been rendered, and the context-menu portal, desktop sidebar collapse, and live markdown editor are type-checked but not yet seen. Re-verify these after any change.
- `deriveTitle` rescans the entire note on every keystroke (`HomeScreen.tsx:163`). Only the write is debounced.
- `CalendarTimeline` positions events with a percent `marginLeft` behind a `@ts-ignore`; unreliable on native Android.
- `isLoading` is a single global boolean shared across all 15 store actions and races on mount.
- Tasks and calendar events are `useState` — lost on reload. The FAB "New Task" and "New Event" actions only navigate.
- No component or render tests, and no store tests. The three defects fixed in revision 4 were gesture/prop-transition paths — exactly what a pure-logic suite cannot reach.
- `findNode` in `useFolderTree.ts` is exported and unit-tested but has zero call sites in `src/`. Dead.
- 11 hardcoded `rgba()` shadows/scrims and one bare `borderRadius: 12` in `TopHeader.tsx` remain — the only design-system violations left. Tracked in `review.md` §3.6.
- `expo-modules-core` is an explicit devDependency to force hoisting for `jest-expo`. Do not remove it.

## TODO
- **Tasks**: add a `tasks` table (`id`, `uuid`, `label`, `source_note`, `done`, `created_at`, `updated_at`, `is_deleted`), repository CRUD, and a `useTaskStore` mirroring the note store.
- **Events**: add an `events` table (`id`, `uuid`, `title`, `time`, `slot_index`, `date`, `color`, `is_deleted`) plus `useEventStore`. `CalendarTimeline` already accepts `CalendarEvent[]` — only the data source changes.
- **Decide on Supabase**: build the client, or drop the `uuid` / `is_synced` columns so the schema stops implying a feature that does not exist.

## Known Bundling Gotchas
Pre-existing packaging issues — do not fix unless asked:
- Web: `wa-sqlite.wasm` resolution
- Android: `punycode` (markdown-it dep)

## Known Narrow-Screen Concern
`CapsuleSwitcher` (z 20, bottom 16, centered) and `FloatingActionFab` (z 20, bottom 24, right 24) can visually overlap below ~375px. The FAB's 56×56 tap target still works. Not a crash.
