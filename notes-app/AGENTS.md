# Simplicity — notes-app

**Core stack**: Expo SDK 57 · RN 0.86.3 · React 19.2.3 · TypeScript 6.0 (strict).  
**State**: Zustand 5. **Storage**: `expo-sqlite` (native) / `localStorage` (web).  
**Styling**: `StyleSheet.create` + `src/theme.ts`. No Tailwind, no nativewind.  
**Animation**: `react-native-reanimated` 4.5.1 only.  
**Markdown**: `@expensify/react-native-live-markdown` (editor) · `react-native-markdown-display` (dashboard cards).  
**Icons**: `@expo/vector-icons`. **Tests**: Jest 29 + `jest-expo`, 11 suites (234 tests).  
**Web**: `react-native-web` 0.21 — the editor runs on it; `Animated` must pass `useNativeDriver: false` on web.

## Commands
- `npm run typecheck` — required before committing.
- `npm test` — Jest.
- `npx expo start` — dev server. Restart with `--clear` after any dependency change.
- `npx expo export --platform web --clear` to confirm a dep is healthy when Metro claims "Unable to resolve".

## Layer Boundaries
- `src/db/` — SQL only. Exports repository singletons. No UI, no state.
- `src/store/` — Zustand only. Delegates to repos. `useNoteStore` (user content), `usePrefsStore` (app config), `useEventStore` (calendar). **Never merged.**
- `src/types.ts` — shared types. Components import from here, never from `src/db/`.
- `src/components/` — presentational. Props only, no store imports.
- `src/screens/` — orchestration. `HomeScreen` is the shell; others are presentational.
- `src/hooks/` — `useDebouncedPersist`, `useScrollRedirection`.
- `src/theme.ts` — single source for color, type, spacing, radius, motion.

## Accessibility — neurodivergent users are the primary audience
One idea per screen, one way to do each thing. **No modes** — a control that changes what others mean makes behaviour depend on hidden state. Every control states its own effect with matching label. A tap has a visible, local consequence. When simplifying, remove the mechanism, not just the labels.

## Design System (depth, colour, type, spacing)
- **Depth**: canvas -> card -> floating chrome, never more than 3 layers. Separated by shadow, not outline. Canvas is off-white/grey, never `#FFFFFF`. Pure white is reserved for cards.
- **60/30/10 colour**: theme = canvas; accent = 10% layer (Claude, Lavender, Black, White). Never hard-code hex.
- **Typography**: 4 sizes x 2 weights via `Typography.app` — 24/18/14/12, 400/600. Tokens: `pageHeader`, `cardHeader`, `body`, `caption`, each with `...Regular`/`...Strong`.
- **Spacing**: 4pt grid — `[4, 8, 12, 16, 24, 32, 48, 64]`. No other values.
- **48px row contract**: tasks, upcoming events, sidebar, context-menu rows, modal buttons.
- **Dashboard**: capped at `Layout.contentMaxWidth` (1280), always paired with `width: '100%'`.
- **Motion**: `Motion` in `theme.ts` — 250ms base, `spring.gentle`/`spring.snappy`, `pressedScale` 0.97. Animations only in `components/shared/motion.tsx`.

## Key stores & state rules
- **Subscribe field by field, never to the whole store — an un-parameterised `useNoteStore()` re-renders the entire tree.
- `usePrefsStore` owns theme + accent + layout + order + `ready`. Malformed values fall back to defaults.
- `useEventStore` is separate from `useNoteStore`. Tasks are still `useState` — not persisted.
- `useDebouncedPersist`: debounces 400ms, flushes on unmount/AppState. Never call `updateNote` from a keystroke handler.

## Calendar (Agenda)
One day, one list. Hour timeline gone; month grid is a popover under the date heading. `startsAt` is full ISO 8601, stored UTC, rendered local. Priority is a colour (two ramps: `Theme.priority` on canvas/card, `InverseInk.priority` on primary card).

## Markdown Editor
`Editor.tsx` is one `MarkdownTextInput` from `@expensify/react-native-live-markdown` — no preview toggle. Scratch pad uses the same engine. Parser: `parseMarkdownRanges` in `src/components/notes/markdownParser.ts`.

## Folder Tree & Sidebar
- `buildFolderTree`/`flattenTree` in `src/hooks/useFolderTree.ts` — pure functions.
- Root folder is `Main`. Root offers only New Note / New Sub-folder.
- Clicking a folder navigates to Notes screen. Sidebar search covers only the active folder.

## Context Menu
`onContextMenu` (web) + `onLongPress` (native). Keyboard: `accessibilityRole="menu"`, `document` keydown for Escape/Arrow nav. Torn down on close/unmount.

## Welcome screen
- First paint for signed-out users. Legal footer links (Privacy Policy, Terms) are blank placeholders.

## Known gotchas
- **Schema migration**: `SCHEMA_SQL` is `CREATE TABLE IF NOT EXISTS` — editing DDL only affects fresh databases. Adding columns need `applyMigrations` + `PRAGMA user_version` + `table_info probe.
- **Web: `wa-sqlite.wasm`**: Metro needs `wasm` in `assetExts` (already in `metro.config.js`).
- **`RNW traps**: `selection` prop applied in `useLayoutEffect` keyed on object identity. `onPress` is native click; right-click fires only `contextMenu`. `focusable` deprecated on web, use `tabIndex`.
- **No Pin/Favourite**: needs a `pinned` column + migration. No UI without it.
- **Supabase is not integrated** — `uuid`/`is_synced` are unused scaffolding.
- `expo-modules-core` is an explicit devDependency for `jest-expo` hoisting. Do not remove.
- **No component/render tests** — Jest cannot see gestures, animations, or DOM paths.
- **Editor roadmap**: CodeMirror 6 in a WebView is deferred until a device test setup exists.
- **Settings**: Not in `DOCK_SCREENS` — hides dock and FAB. Own `SettingsNav` with search. Narrow = drill-down; wide = vertical rail + content.
