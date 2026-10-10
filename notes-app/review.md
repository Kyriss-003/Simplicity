# CODEBASE REVIEW & TECHNICAL MAP

> **Date:** 2026-09-27 · **Revision 5** (single-input live markdown editor)
> **Stack:** Expo SDK 57 · RN 0.86.3 · React 19.2.3 · TypeScript 6.0.3 (strict) · Zustand 5.0.14 · `expo-sqlite` 57 · `@expensify/react-native-live-markdown` 0.1.342 · `react-native-web` 0.21 · Jest 29 + `jest-expo`
> **Verification:** `npx tsc --noEmit` → 0 errors · `npx jest` → **51 passed** / 4 suites / 0 failed · project diagnostics → 0 errors, 0 warnings. Design-system compliance confirmed by repo-wide regex sweeps. App rendered in the browser and screenshotted; Android and iOS not yet run. `npx expo export --platform web` is blocked by the pre-existing `wa-sqlite.wasm` gotcha, so the editor was verified by unit tests + a clean web module graph, not by a production bundle.
> **Known gap:** partial runtime verification. The sidebar, folder tree, and Tasks card are visually confirmed on web. The revision-5 editor has **never been rendered** — parser, styling and token behaviour are unverified.

---

## 1. Executive Summary & Health Rating

### [Overall System Score: 8/10] — up from 6/10 in revision 1

| Dimension | Rev 1 | Rev 2 |
|---|---|---|
| Architecture & layering | 9/10 | **9.5/10** |
| Data layer & persistence | 8/10 | **8.5/10** |
| Design system compliance | 3/10 | **9/10** |
| State & feature wiring | 6/10 | **7.5/10** |
| Code health & tooling | 4/10 | **7/10** |

**Summary.** The architecture was always this project's strength; the design system was documentation without an implementation. That gap is now closed. `src/theme.ts` ships a coherent Zen palette and — critically — components actually consume it: zero raw `fontSize`/`fontWeight` literals and zero hardcoded hex outside the token file. Two categories of violation survive a stricter revision-4 sweep — 11 `rgba()` shadows/scrims and one bare `borderRadius` — and are tracked in §3.6.

What has *not* changed is persistence breadth. Notes and folders are durable. **Tasks and calendar events are still `useState` and vanish on every reload.** Supabase is entirely unbuilt. Those are scope decisions, not defects, but they bound what the app can promise a user.

**Wins**

- The token system went from **0 imports to 100% adoption** across all 20 components, while shedding ~250 lines of dead exports.
- Both revision-1 P0 defects are closed and test-covered: note-move works, and autosave no longer writes to SQLite per keystroke.
- Data integrity is regression-protected by 59 tests — cycle-safe moves, deep-clone depth, soft-delete cascade, root guards, orphan attachment, note↔row mapping, and the editor's block AST, merge and metric-lock rules.
- The `src/components/` → `src/db/` layer boundary is clean for the first time.
- Type-checking became honest. It previously reported green by *excluding* the tests; it now genuinely checks them.

---

## 2. Architecture & File Tree

```
notes-app/
├── App.tsx · index.ts · app.json · package.json · tsconfig.json
├── jest.config.js · jest.setup.js
├── AGENTS.md · version.md (stale) · .env (now gitignored) · .agents/goal.md (active goal ledger)
├── __tests__/            3 suites, 59 tests
│   ├── folderTree.test.ts · repositories.test.ts · utils.test.ts
└── src/                  28 files
    ├── theme.ts          Zen palette + Spacing/Typography/Radius/Layout
    ├── types.ts          Note, Folder, Task, CalendarEvent, FolderNode, ScreenKey
    ├── db/               schema.ts, NoteRepository.ts, FolderRepository.ts
    ├── hooks/            useFolderTree.ts (no hook), useDebouncedPersist.ts
    ├── store/            useNoteStore.ts (15 actions, zero SQL)
    ├── screens/          HomeScreen.tsx (shell), Overview, Notes, Agenda
    └── components/       16 presentational components
        ├── Sidebar · TopHeader · CapsuleSwitcher · FloatingActionFab
        ├── cards/        CalendarTimeline, NotesCardRow, TasksCard, ScratchPadCard
        ├── notes/        NotesView, Editor
        └── shared/       Card, ConfirmDialog, ContextMenu, MoveToModal,
                          SectionHeader, utils.ts (block AST + decoration layer)
```

| Boundary | Status | Evidence |
|---|---|---|
| `src/db/` — SQL only | ✅ | Zero SQL outside `src/db/` |
| `src/store/` — Zustand only | ✅ | Every action delegates to a repository |
| `src/components/` — no DB/store imports | ✅ **Fixed** | Sweep returns 0 matches |
| `src/screens/` — orchestration only | ✅ Improved | Markup extracted; shell retains state |
| `src/theme.ts` — single source of truth | ✅ **Fixed** | Was 0 imports, now 100% |
| No circular dependencies | ✅ | No cycle across 28 files |

**Remaining structural note.** `HomeScreen.tsx` holds 16 `useState` calls, ~20 handlers, and all shared chrome. The split moved markup out but not state — the deliberate low-risk choice. The next seam is a `useNoteActions()` hook.

---

## 3. Design System Audit (`AGENTS.md` Compliance)

### 3.1 Color — **PASS**

60/30/10 structure is correct and accent is confined to the FAB, active nav, selected states, and focused borders.

| Role | Light (Zen Cream) | Dark (Zen Charcoal) | OLED |
|---|---|---|---|
| Canvas 60% | `#f2f0e3` | `#1f1f1f` | `#000000` |
| Sidebar | `#f2f0e3` | `#1f1f1f` | `#0a0a0a` |
| Surface 30% | `#e8e5d8` | `#2a2a2a` | `#121212` |
| Border | `#dcd8c8` | `#383838` | `#222222` |
| Text primary | `#1f1f1f` | `#f2f0e3` | `#ffffff` |
| Text secondary | `#66645d` | `#a09e96` | `#888888` |
| **Accent 10%** | `#f76f53` | `#f76f53` | `#f76f53` |

Two decisions worth recording. **`accentText` is `#1f1f1f` in all three themes** — `#f76f53` has luminance ~0.32, so white gives ~2.8:1 (fails AA) and dark gives ~5.7:1 (passes); the FAB icon would have been illegible otherwise. **Sidebar matches the canvas, not the surface**, reserving the 30% layer for cards so they read as raised; rev 1 had `Dark.surface === Dark.sidebarBg`, flattening the hierarchy entirely.

**Hardcoded colors: 0.** The old `#3f1115` / `#f87171` / `#EF4444` literals are gone — the NotesView delete pill was a hardcoded dark red that would have been broken in Light and OLED.

### 3.2 Typography — **PASS**

Allowed 24/18/14/12 px and 400/600. **Violations in components: 0.** `Typography.app` defines 8 tokens covering exactly those 4 sizes × 2 weights.

| Token | Size/Weight | Consumers |
|---|---|---|
| `pageHeader` | 24/600 | greeting, markdown h1 |
| `cardHeader` | 18/600 | brand, card/note/editor titles, dialog titles, markdown h2 |
| `body` | 14/400 | nav labels, inline inputs, markdown body |
| `bodyStrong` | 14/600 | selected labels, task labels, list titles, markdown h3 |
| `caption` | 12/400 | counts, timestamps, previews, calendar labels |
| `captionStrong` | 12/600 | section labels, tab pills, badges |
| `pageHeaderRegular`, `cardHeaderRegular` | 24/400, 18/400 | *(unused)* |

Rev 1 had **9 distinct sizes and 3 weights**, including every value the `AGENTS.md` Design System spacing rule forbids (`11px, 13px, 15px, 22px`) plus weight `700` in 9 places.

**Fixed:** `getMarkdownStyles` accepted a `bodySize` parameter called with `14` in one place and `15` in another. Parameter removed; body is always 14.

### 3.3 Spacing & 8pt Grid — **PASS**

All values sit on the 4pt grid. The off-grid values `1, 1.5, 2, 3, 5, 6, 10, 14, 18, 22, 34, 0.5` are all corrected. Remaining small numbers are non-spacing: `borderWidth: 2`, `zIndex`, Reanimated spring constants.

| 48px row contract | Status |
|---|---|
| `TasksCard` task row + add-task bar | ✅ 48, `alignItems: 'center'` |
| `CalendarTimeline` slot body + header row | ✅ 48, `alignItems: 'center'` |
| `Sidebar` nav + folder rows · `ContextMenu` rows | ✅ 48 |
| `MoveToModal` / `ConfirmDialog` rows + buttons | ✅ 48 |

**Scope note:** note list rows and note cards were deliberately *not* forced to 48px — they render title + preview + timestamp and would clip. The contract covers task items and calendar slots.

### 3.4 Modals & Overlay — **PASS**

`MoveToModal` uses `min(winWidth × 0.9, 540)` × `min(winHeight × 0.8, 680)` at radius 16 — exact iPad-mini match. FAB backdrop: web `blur(12px)` at 40% alpha, native `BlurView intensity={48}` with luminance-detected tint. **Fixed** — rev 1 used `blur(1px)` / `intensity={5}`.

### 3.5 Token bloat (minor)

Nine `Theme` fields have **zero consumers**: `textDisabled`, `textTertiary`, `textSecondary`, `borderSecondary`, `accentHover`, `accentActive`, `warning`, `success`, `info`. Defensible as API surface, but currently accidental rather than chosen.

### 3.6 Remaining violations — **FAIL** (new in revision 4)

A repo-wide sweep found the compliance claim above overstated by two categories:

| Violation | Count | Sites |
|---|---|---|
| `rgba()` shadows / scrims outside `theme.ts` | **11** | `CapsuleSwitcher` ×1, `FloatingActionFab` ×3, `ConfirmDialog` ×2, `ContextMenu` ×1, `MoveToModal` ×2, `HomeScreen` ×2 |
| Bare `borderRadius` numeric | **1** | `TopHeader.tsx:90` → `borderRadius: 12` |

Every other sweep is clean: 0 hex, 0 `fontSize`/`fontWeight` outside `theme.ts`, 0 spacing values off the 4pt grid, 9 sites on the 48px row contract, 0 `src/components/` → store/db imports.

The scrims are not merely a lint failure: a flat `rgba(0,0,0,0.45)` is wrong on the OLED canvas, where the correct scrim is a black-on-black wash with no visible edge. They need a `scrim` + `shadow` token pair per theme.

---

## 4. State Management & Feature Wiring

`useNoteStore` remains clean: **zero SQL**, 15 actions (10 note, 5 folder), newest-first ordering maintained on every mutation, `error` surface, context-menu-safe signatures taking explicit target ids.

| Defect | Resolution |
|---|---|
| `createNote` prepended notes created in a *non-selected* folder into the current list | Splices only when `created.folderId === state.selectedFolderId` |
| `noteCounts` went stale after move/duplicate/delete | `refreshNoteCounts()` now called in all four mutation paths |
| Note-move rendered an empty picker (`excludeId ? … : []`) | `flatten()` handles `null`; signature widened to `string \| null` |

**Open:** `isLoading` is still a single global boolean across all 15 actions. `initialize()` and `refreshNoteCounts()` race on mount. The typing flicker is gone (the debounce removed that trigger) but the race remains.

### Context menu — folder rows

| Action | Working | Note |
|---|---|---|
| New Note | ⚠️ | Wrong-folder insertion fixed; counts refresh |
| New Sub-folder | ✅ | |
| Rename | ✅ | **New:** repository refuses `ROOT_FOLDER_ID` |
| Move to… / Duplicate / Delete | ✅ | Hidden on root; cascade + deep clone correct |

**Defense in depth:** the root folder now offers only "New Note" and "New Sub-folder", *and* `FolderRepository` refuses rename/move/duplicate/delete on it. Rev 1 offered all six on the root with three silently no-opping.

Triggers use real event coordinates in both `Sidebar` and `NotesView`; rev 1 hardcoded `{x: 140, y: 80}` for note long-press.

### Context menu — note rows

| Action | Working | Note |
|---|---|---|
| Move to folder | ✅ **Fixed** | Was completely non-functional |
| Duplicate | ✅ | |
| Delete | ✅ | Copy corrected — it is a soft delete, not permanent |

### Navigation

Sidebar and `CapsuleSwitcher` both expose exactly `Overview` / `Notes` / `Agenda` via a shared `ScreenKey` in `src/types.ts`. The greeting is gated on `activeScreen === 'Overview'` and absent elsewhere. The `main` root folder is seeded on both backends and listed first.

### Persistence

| Data | Durable | Location |
|---|---|---|
| Notes | ✅ | `notes` table |
| Folders | ✅ | `folders` table |
| **Tasks** | ❌ | `useState` — lost on reload |
| **Calendar events** | ❌ | `useState` — lost on reload |
| Theme selection | ❌ | `useState` — resets to Dark every launch |
| Selected folder | ❌ | store default `'main'` every launch |

`is_synced` is written as `0` and never updated — vestigial scaffolding for a sync layer that does not exist.

### Supabase — **0% integrated**

No `@supabase/supabase-js`, no `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY`, no client module, no auth, no sync queue. Local SQLite is 100% of the ground truth. The `uuid` columns and soft-delete design are correct forward-compatibility scaffolding, but nothing consumes them. **`.env` is now gitignored** (rev 1 shipped it tracked).

---

## 5. Technical Debt & Anti-Patterns

### 5.1 Correctness & performance

| # | Issue | Location | Severity |
|---|---|---|---|
| 1 | **`deriveTitle` rescans the whole note per keystroke** — `split('\n')` + regex over every line, O(length) per character. The SQLite write is debounced; this is not. | `HomeScreen.tsx:163` | 🟠 Medium |
| 2 | **Percent `marginLeft` on an absolutely-positioned view** — RNW supports it, native Android does not reliably. | `CalendarTimeline.tsx:60` | 🟠 Medium |
| 3 | **`isLoading` single global boolean** racing across concurrent actions. | `useNoteStore.ts` | 🟠 Medium |
| 4 | **FAB hover boundary is asymmetric** — `mouseleave` closes but `mouseenter` deliberately does not open; the 150ms timer closes over stale `isOpen`, safe only because effect cleanup clears it. | `FloatingActionFab.tsx:66-92` | 🟡 Low |
| 5 | **Tasks and events not persisted** — FAB "New Task"/"New Event" navigate but create nothing. | `HomeScreen.tsx` | 🟠 Medium |
| 6 | **Theme and selected folder not persisted** — both reset every launch. | `HomeScreen.tsx` | 🟡 Low |

### 5.2 Type-safety gaps

| # | Issue | Location |
|---|---|---|
| 1 | Three `@ts-ignore` suppressions remain. | `FloatingActionFab.tsx:68,102`; `CalendarTimeline.tsx:60` |
| 2 | `useRef<View>` cast to `HTMLElement` then `.addEventListener()` — depends on RNW ref forwarding. | `FloatingActionFab.tsx:59,69` |
| 3 | `onContextMenu` spread via `as Record<string, unknown>` to defeat a missing RN type. | `Sidebar.tsx`, `NotesView.tsx` |
| 4 | Non-null assertion `byId.get(folder.id)!`. | `useFolderTree.ts` |
| 5 | `noUncheckedIndexedAccess` not enabled; it would catch #4. | `tsconfig.json` |
| 6 | `setNativeProps` (deprecated escape hatch) for cursor restoration. | `ScratchPadCard.tsx` |

### 5.3 Dead code & naming

| # | Issue |
|---|---|
| 1 | `useFolderTree.ts` contains **no hook** — four pure functions behind a `use*` filename. |
| 2 | Nine unused `Theme` fields (§3.5). |
| 3 | `is_synced` written but never updated or read. |
| 4 | `Sidebar` is the only default export; the other 20 are named exports. |
| 5 | `.zcode/plans/` holds 4 committed session-plan markdown files. |

**Pruned in rev 2:** `Elevation`, `Animation`, `Grayscale`, `Brand`, three token factories, `Typography.scale`, `Typography.fontFamilies`, `Layout.safeArea`, plus 4 unused dependencies (`nativewind`, `tailwindcss`, `expo-file-system`, `expo-status-bar`) — roughly 250 lines of dead code and a large transitive tree.

### 5.4 Documentation drift

- `version.md` describes a deleted `FlatList` HomeScreen. Stale since 0.2.0 — the last remaining document that contradicts the code.
- `AGENTS.md` was rewritten in revision 2 and is current: it documents the `useFolderTree.ts` filename accurately, the Zen palette, and the live markdown editor.

### 5.5 Testing & tooling

**Strong:** 59 tests / 3 suites passing; `typecheck`, `test`, `test:watch` scripts; test files genuinely inside the type-checked program.

**Gaps:** no component or render tests — everything covered is pure logic, and nothing verifies that a screen actually renders or that a keystroke lands. The three defects fixed in revision 4 (§ Revision 4) were all gesture and prop-transition paths, which is precisely the class a pure-logic suite cannot reach; they were found by reading code, not by a failing test. No store tests, despite `useNoteStore` being the largest untested surface. 13 `npm audit` vulnerabilities (11 moderate, 2 high) in transitive deps; `audit fix --force` is unsafe against an SDK 57 tree.

---

## 6. Actionable Master Checklist

### 🔴 P1 — Correctness

- [ ] **Debounce `deriveTitle`**, or re-derive only when the first line changes. Last remaining per-keystroke O(n) cost in the editor. → §5.1 #1
- [ ] **Replace the percent `marginLeft`** in `CalendarTimeline` with absolute pixel offsets from a measured container width — removes the `@ts-ignore` and the Android risk together. → §5.1 #2
- [ ] **Fix `isLoading`** — counter or per-operation flags, or drop the indicator now that the flicker is gone. → §5.1 #3
- [ ] **Add a store test suite** for the 15 `useNoteStore` actions, especially the ordering invariant and `noteCounts` correctness.

### 🟠 P2 — Persistence

- [ ] **Persist tasks** — `tasks` table (`id`, `uuid`, `label`, `source_note`, `done`, `created_at`, `updated_at`, `is_deleted`), repository CRUD, `useTaskStore`. Also makes FAB "New Task" create something. → §4.5
- [ ] **Persist calendar events** — `events` table (`id`, `uuid`, `title`, `time`, `slot_index`, `date`, `color`, `is_deleted`) + `useEventStore`. `CalendarTimeline` already accepts `CalendarEvent[]`; only the data source changes. → §4.5
- [ ] **Persist theme + selected folder** so neither resets on launch. → §5.1 #6
- [ ] **Decide on Supabase.** Either stand it up (`@supabase/supabase-js`, `src/lib/supabase.ts`, consume the existing `uuid` / `is_synced` / `is_deleted` scaffolding) or drop those columns so the schema stops implying a feature that does not exist.

### 🟡 P3 — Hygiene

- [ ] Replace the 3 `@ts-ignore` suppressions. → §5.2 #1
- [ ] **Render the revision-5 editor in a browser.** The parser is unit-tested (21 cases) and the web graph resolves, but token styling, dimmed markers and the soft keyboard have never been seen. → § Revision 5
- [ ] Tokenise the 11 `rgba()` shadows/scrims as a `scrim` + `shadow` pair per theme, and fix `TopHeader.tsx:90` `borderRadius: 12` → `Radius.lg`. → §3.6
- [ ] Rename `useFolderTree.ts` → `folderTree.ts`. → §5.3 #1
- [ ] Delete `findNode` from `useFolderTree.ts` — exported and unit-tested, but zero call sites in `src/`.
- [ ] Prune or deliberately keep the 9 unused `Theme` fields. → §3.5
- [ ] Enable `noUncheckedIndexedAccess`. → §5.2 #5
- [ ] Unify the FAB hover hitbox (open on wrap `mouseenter`, use a ref for the timer). → §5.1 #4
- [ ] Make `Sidebar` a named export; add missing `accessibilityLabel`s. → §5.3 #4
- [ ] Remove `.zcode/plans/`. → §5.3 #5
- [ ] **Update `AGENTS.md` and `version.md`** to match reality. `AGENTS.md` is current as of revision 4; `version.md` is still stale. → §5.4
- [ ] Add a component/render smoke test so the UI is exercised at least once in CI.
- [ ] Review the 13 npm audit advisories deliberately (not with `--force`).

### ✅ Completed in revision 2

`MoveToModal` note-move fix · debounced autosave with unmount + AppState flush · flush-on-note-switch · root folder rename/move/duplicate/delete guards in both UI and repository · Zen theme rewrite · typography sweep (9 sizes → 0 violations) · spacing sweep · 48px row contract · hardcoded hex removal · FAB blur spec compliance · bound SQL parameters · `src/types.ts` extraction · layer-boundary closure · `HomeScreen` split into 3 screens · `Editor` extraction · `app.json` modernization · 4 unused dependencies removed · ~250 lines of dead theme code pruned · Jest + 32 tests · `tsconfig` contradiction fixed so tests are genuinely type-checked · `.env` gitignored.

---

## Revision 5 — Single-input live markdown editor

Revision 4 solved the caret by making the editor *bigger* than the caret: one input per
block. That worked, but it capped the experience — a multi-line paragraph was one raw
buffer, so nothing inside it could render, and the only way to see markdown was to click
away. Every fix downstream was mitigation (Enter-detach was scoped and then never built;
a caret clamp guard was scoped and then never needed).

The real constraint was stated but not acted on: **a stock `TextInput` carries one text
style, so a paragraph can never show one line rendered and the next raw.** That is
architectural, not a bug — until revision 5, where the answer arrived as a dependency.

### R1 The decision

`@expensify/react-native-live-markdown` (Software Mansion + Expensify, MIT, v0.1.342) is a
drop-in `TextInput` replacement that **owns the text rendering** and applies per-token
styling on the UI thread. That is the one capability the stock component cannot offer, and
it is what the whole editor was straining to approximate.

Adoption facts, each verified rather than assumed:

| Question | Answer | Consequence |
|---|---|---|
| Does it work on web? | `MarkdownTextInput.web.tsx` is a real 24KB implementation | The browser stays the verification path |
| …is it risky on web? | It imports **only** `react-native` and `react` | No worklets, no version skew on the path we test |
| RN 0.86? | Supported from 0.1.331+ | Compatible with the pinned RN |
| `react-native-worklets` | Peer `>=0.7.0`; we are on Expo's `0.10.1` | **Not bumped** — Expo's validated version beats an advisory README row |
| Extra deps | `expensify-common` (peer), `html-entities` (pinned `2.5.3`) | Both auto-installed; the pin is explicit because the package statically re-exports `parseExpensiMark` |

**CodeMirror 6 in a WebView was rejected on one fact:** `react-native-webview` has no web
implementation. It would run in the app the user cannot see, and force two editors. The
one rule that governs this project — verify where the app is verified — rules it out.

### R2 What it deleted

The block architecture is gone, and so is every workaround built to survive it:
`parseBlocks`, `blockIndexAt`, `editableBlock`, `decorationLayer`, `activeBlockStyle`,
`mergeWithPrevious`, the blur grace period, and the scoped-but-unbuilt Enter-detach and
caret clamp. `Editor.tsx` is now a title bar plus one input. There is no raw state to
leave, so the original complaint — markdown only rendering on click-away — cannot recur.

### R3 What we still own

`parseMarkdownRanges` (`src/components/notes/markdownParser.ts`): a pure, unit-tested
worklet that returns character ranges and **never rewrites text**, so markers keep exact
offsets and the caret never drifts. It runs on the UI thread every keystroke, so it is
deliberately self-contained and capped at 20k characters, degrading a very long note to
unstyled-but-editable rather than stalling the thread. `liveMarkdownStyle(theme)` maps every
token colour from `theme.*`, so per-token styling does not become a second colour vocabulary.

Four bugs the new tests caught, all silent: a bare ` ``` ` was treated as a complete empty
fence rather than an opener; the closing delimiter was swallowed into the `pre` body; a
`claim()` helper pushed a *new* object so an identity check could never match and every
construct silently dropped its own ranges; and the inline pass re-matched fence markers
because nothing reserved them. The suite is 51 tests / 4 suites, down from 59 because ~25
now test code that no longer exists.

### R4 Honest limits

**Post-review fixes (browser-verified defects).** First render in the browser exposed two
real bugs and one request:

- **Invisible body text on the Dark and OLED canvases.** The input's `color` was never set,
  so it fell back to the browser's black; only the `syntax` ranges carried an explicit
  colour, which is why the markers were the only visible thing on OLED. The colour is now
  `theme.text`, with a test asserting markers never resolve to the same colour as body text.
- **Markers dimmed to 0%.** Added `theme.syntaxDim`, set equal to `background` in all three
  themes, so raw syntax renders invisible while keeping 1:1 offsets. The trade-off is
  inherent: markers are real characters, so hiding them leaves a gap instead of collapsing
  the way Obsidian's replaced tokens do. Inside inline code and fenced blocks the canvas
  colour sits on a pill/surface background, so markers there stay faintly visible.
- **Pen / book switch.** `Editor` holds a local `write` / `read` mode and renders read mode
  through `react-native-markdown-display` (still used by `ScratchPadCard`), so the old
  renderer was kept rather than deleted. Local state is deliberate: `Editor` is not
  remounted on note change, so the mode persists, while the input is keyed on `note.id` to
  reset the caret.

- **The editor has never been rendered.** The parser is tested and the web module graph
  resolves, but token styling, dimmed markers and the soft keyboard are unverified. The
  browser is the gate, and the user owns it.
- Only `h1` can differ in size — the library scales headings by size only, and there is no
  `h2`/`h3` style key. Heading depth is emitted as `MarkdownRange.depth` for a future pass.
- Native needs a dev client, not Expo Go, because the package ships native code. Worklets
  `0.10.1` sits in an untested gap in the library's README matrix; it satisfies the enforced
  peer range and matches Expo's validated set, and is the first thing to bump if native
  misbehaves.

---

## Revision 4 — Block-based live preview, then a bug-fix pass (superseded by revision 5)

### 4.1 The editor: block AST, metric locking, cross-block caret

The revision-3 editor split the document on **blank lines** and made the whole blank-line run one input. That was replaced twice in this revision, and the path matters more than the destination.

**Attempt 1 — one input per source line (reverted).** Line granularity was meant to give finer live preview. It broke the editor. Separate inputs cannot share arrow-key focus, word-wrap or line merging, so the caret visually teleported: the buffer changed under a caret that had just been placed, and the only way back was to click. Two users' worth of complaint for a cosmetic gain.

**Settled design — AST block.** `parseBlocks` classifies blocks as `heading` (with depth) / `paragraph` / `list` / `code` (with fence), on a line-walk that keeps exact offsets. A fenced code block is one block whatever its length; consecutive list items stay one block; consecutive prose lines stay one block.

The enabling insight is that a block's input holds *only that block's text* — the blank lines before it are excluded on purpose. So at the buffer edges the platform has nothing to do: Backspace at offset 0 has no character to delete, and the arrows have no line to move to. Those keys are therefore free for cross-block navigation (`ArrowUp`@0 → previous block end, `ArrowDown`@end → next block start, `Backspace`@0 → `mergeWithPrevious`), while **every key inside a block is left entirely to the platform**. No caret logic is re-implemented anywhere.

**Metric locking is structural.** Both render paths are the same box — `View style={styles.block}` wrapping a child styled with the same `md` key, which `activeBlockStyle` selects. An H1 being edited is 24/32/600 because it is handed `md.heading1`, the very style the rendered version uses; a fence keeps its surface and padding while you type in it. There is no second place where a font or padding is written down.

**Two spec items deliberately not built, with reasons:**

- *Enter splitting into a new AST block* would make a two-line paragraph impossible. Enter stays a native soft break inside the block's `multiline` input — which is exactly what keeps the caret fluid — and a blank line starts a new block.
- *Dimmed syntax markers* are not implementable. A `TextInput` carries exactly one text style; on web it is a `<textarea>`, which cannot contain styled spans. Trimming markers from the value would break the 1:1 character-offset contract that keeps click targets accurate. The only route to real token dimming is Obsidian's own — a transparent input with a measured token layer behind it — which is web-only and would diverge native, so it was not shipped.

Tests caught two real bugs during the rewrite, both silent: the fence branch cleared `fence` *before* closing the block (closed fences reported `fence: null`), and `editableBlock` spread `...block` without overriding `end`, so a middle block reported its own end while carrying text sliced to the next block's start. Suite: 32 → **59 tests**.

### 4.2 Bug-fix pass

An audit of the whole tree, then reasoning on each candidate before changing anything. Three genuine defects, none reachable by the pure-logic suite:

| # | Defect | Root cause | Fix |
|---|---|---|---|
| B1 | Tapping another block flashes the whole document and tears down the input | Press-*down* blurs before the press completes, so `focused=false` decorated every block and unmounted the input mid-gesture | 200 ms blur grace period, cancelled by `focusBlock`/`onFocus`, cleared on unmount |
| B2 | Opening a second note inherits the first note's caret, imposed selection and focus, aiming the new input at the old document's offsets | Editor state is component-local and was never reset on `note.id` change | Render-phase reset, so no frame commits with stale offsets |
| B3 | Two tasks added in the same millisecond collide: duplicate list keys, one tap toggles both rows | `addTask` used `Date.now()` as the id | Monotonic `useRef` counter |

**One candidate checked and cleared, not changed:** right-clicking a folder row might have fired both `onContextMenu` and `onPress`, navigating as it opened the menu. It does not — RNW binds `onPress` to the native `click` event (`PressResponder.js:303`), and right-click does not fire `click`. Recorded so it is not "fixed" later.

### 4.3 Also in this revision

- **Full-height editor canvas.** The input fills the pane when the note is a single block; with anything else on screen the flow scrolls, because a full-height input would push the decorated blocks off the canvas. A latent alignment bug went with it — rendered blocks had no padding while the raw input had 16px, so every block jumped sideways the moment the caret left it. Both sides now share one gutter.
- **Sidebar modernisation.** Hover states via `onHoverIn`/`onHoverOut` (web-only, inert on touch), a 3px accent rail on the active row, pills on the 48px contract, strict 16px tree indent, labels locked to 14px.
- **Frameless scrollbars.** Chromium's default framed scrollbar (with arrow buttons) is replaced app-wide by a one-shot `<style>` injection in `App.tsx`; `showsVerticalScrollIndicator={false}` added to all seven remaining vertical scroll containers.
- **No new components** were added in revision 5.

## Revision 3 — UI fixes from screenshot review
- `ContextMenu` moved into a transparent `Modal` root portal with bidirectional edge flipping. It was rendering `position: absolute` inside the 240px `Sidebar` (`position: relative`), so window-absolute anchor coordinates were being resolved in the sidebar's coordinate space and the dismiss backdrop only covered the rail.
- Desktop sidebar collapse was inert: `HomeScreen` applied the hidden style only when `isMobile`, so at ≥768px the sidebar stayed visible while `TopHeader` still showed its hamburger. Collapse is now width-based and applies at every width. Sidebar toggle enlarged 32→40px with `hitSlop: 8`; `zIndex: 9999` removed from `Sidebar`.
- `Editor` converted from a manual preview toggle to automatic live rendering: caret-adjacent block raw, all others rendered markdown. Empty-note regression (no input at all) caught and fixed. 9 new tests cover the then-current block splitter (`splitMarkdownBlocks` / `blockIndexAt`) — both since replaced, see Revision 4.
