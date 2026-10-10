# Version History

## 0.9.0 — Settings gets its own sidebar, with five real sections (2026-09-28)

### Added
- **A dedicated Settings rail** (`components/settings/SettingsNav.tsx`): Accounts · General ·
  Preference · Shortcuts · Get help. A vertical rail above the tablet breakpoint, a horizontal chip
  row below it. The active section is local view state; the values are still props from
  `HomeScreen`.
- **Each section is its own file**, sharing `SettingsRow` / `SettingsGroup` / `SelectRow` /
  `ValueRow` so a row is defined once:
  - **Accounts** — no sign-in (the app has no auth), where data lives, live note/folder counts, and
    “Export everything”, which copies all notes and folders as JSON.
  - **General** — “Confirm before deleting” and “Open new notes straight away”, both wired to real
    behaviour (`handleDeleteNoteById` and `handleNewNote`).
  - **Preference** — the existing theme, accent and drag-reordered dashboard layout, unchanged.
  - **Shortcuts** — only the shortcuts that are actually implemented, checked against the code.
  - **Get help** — the three user-facing limitations that are genuinely true of this build, plus
    “Copy diagnostics” for bug reports.
- Two new persisted flags (`confirmDelete`, `openNewNote`) under a `general` preference key.

### Fixed
- `setBehaviour` wrote an unrecognised key into storage, where the parser would then silently
  ignore it — a setting that appeared to half-work. It now writes only known keys.
- Removed a dead `count` prop threaded through every `DraggableRow`.
- Clipboard writes go through one shared `copyToClipboard` helper instead of two ad-hoc
  `navigator.clipboard` calls that each re-implemented the platform guard.

### Verification
- **Walked all five sections in headless Chrome over CDP, 8/8:** the app mounts, the gear opens
  Settings, all five rail entries are present and clickable, and each pane shows its own heading
  and content. Screenshots reviewed for all five.
- `tsc --noEmit` clean; `jest` 137/137 across 9 suites (7 new tests for the behaviour flags).

## 0.8.3 — Vertical wheel now drives the note row, and the row can actually reach its end (2026-09-28)

Three bugs in the scroll redirection, **all three found by driving a real browser over CDP** rather
than by reading the code. None was visible to `tsc`, to Jest, or in a screenshot.

### Fixed
1. **The row only responded to sideways swipes.** `wheelDeltaFor` compared `deltaX` against
   `deltaY` to decide whether a gesture was "really" horizontal — and a genuine vertical trackpad
   swipe carries a little `deltaX`, so the comparison kept handing the gesture to the native
   scroller. A horizontal container has one meaningful direction, so both components now feed it:
   `deltaX + deltaY`.
2. **The interception never armed if the pointer was already inside.** The listener was gated on
   `mouseenter`, which only fires on a *transition into* the element. A wheel event is only
   delivered to the element under the pointer anyway, so the gate bought nothing and cost
   everything; the listener is now attached directly to the node.
3. **The row could never reach its end — the last card was unreachable.** The boundary rule tested
   the *whole* delta against the range, so one 300px notch from an offset of 420 with a max of 556
   was rejected outright because 420 + 300 overshoots. It stopped 136px short, permanently.
   `nextScrollOffset` now releases only when the container is *already at* the boundary, and
   otherwise moves **clamped** to the range.
4. **Late-mounting scrollers never got listeners.** The node was resolved in an effect, which does
   not re-run when the element mounts later — and both the note row and the task list render their
   `ScrollView` conditionally. The hook now returns a callback ref, which runs on mount and unmount.

### Also
- Touch now bails on a second finger (a pinch is not a scroll) and uses the same clamped boundary
  rule. `useContainerScroll` + `useTouchAxisRedirect` collapsed into one
  `useScrollRedirection` hook returning one callback ref, so a component cannot pass two refs to
  one `ScrollView`.

### Verification
- **Driven in headless Chrome over CDP, 8/8:** vertical wheel advances the row (`scrollLeft
  0 → 120`); the page stays at `0` while the row can move; the row reaches its exact end
  (`556 of 556`) without overshooting; the row stops cancelling the event at the end
  (`defaultPrevented: false`); released gestures scroll the page to its own end (`357 of 357`);
  hovering away leaves the row untouched.
- `tsc --noEmit` clean; `jest` 115/115 across 8 suites, including
  `__tests__/scrollRedirection.test.ts` pinning the delta mapping and the boundary release.
- Still untested: real touch, which needs a finger.

## 0.8.2 — Cards folded into each other at iPad-mini width (2026-09-27)

### Fixed
- **The Tasks and Scratch Pad cards collapsed to 0px height and overlapped at iPad-mini width.**
  Both cards carried `flex: 1, flexBasis: 0` to split the desktop row evenly. `flexBasis` applies
  to the **main** axis, and the mobile layout is a *column* — so the basis was height, the column
  had no free space to distribute, and both cards collapsed while their contents overflowed
  straight through each other. Visible as a border line cutting across the Tasks card with the
  Scratch Pad drawn on top of it.
- Flex now belongs to the **split row**: `OverviewScreen` passes `flex: 1` when horizontal and
  `alignSelf: 'stretch'` when stacked, and the cards carry no flex of their own. The same latent
  bug would have hit a lone card the moment the other was hidden in Settings.

### Verification
- **Rendered in headless Chrome at 1400 / 744 / 540px** and inspected: the row splits evenly on
  desktop, and the cards stack without folding at both narrower widths. Desktop re-checked
  specifically, since moving the flex out of the cards was a regression risk for the row layout.
- `tsc --noEmit` clean; `jest` 104/104 across 7 suites.
- Still unrun: the touch/wheel scroll redirection, which needs a real finger or trackpad.

## 0.8.1 — Touch scroll redirection, and the tab weight that was always bold (2026-09-27)

### Fixed
- **The section tab switcher did not switch the right way.** `Typography.app.captionStrong` was
  applied to *every* tab rather than only the active one, so the inactive label stayed bold while
  the sliding pill sat on the active tab. Colour was correct and weight was not, which means the
  two indicators disagreed and the control looked stuck on the wrong tab. The weight is now part
  of the active check.
- **The task list could not be scrolled on touch at all.** It was a plain `View` with
  `overflow: hidden` and a 168px cap, which on native means anything past the cap was
  unreachable — no momentum, no scroll, no way back. It is a real `ScrollView` now.

### Added
- **`useTouchAxisRedirect`** — maps a *vertical* swipe onto the horizontal note row. A
  predominantly horizontal drag is left to the native scroller; only a clearly vertical gesture
  over a row the user is aiming along is claimed, and the moment the row hits either end the
  gesture goes back to the page. Native scrolling is never replaced.
- `nestedScrollEnabled` on both the note row and the task list, so Android lets a drag chain to
  the page once the container is at its end.
- `useHoverWheel` renamed `useContainerScroll` — it no longer only handles hover.

### Verification
- `tsc --noEmit` clean, and clean under `--noUnusedLocals --noUnusedParameters`.
- `jest` 104/104 across 7 suites.
- Web bundle builds (1134 modules, HTTP 200).
- **Not verified in a browser** — the whole of this feature is DOM touch/wheel paths.

## 0.8.0 — Note context menu, hover wheel scoping, compact task creation (2026-09-27)

### Added
- **Note card context menu** on the Overview. Right-click (web) or long-press (native) a card for
  Rename / Move to folder / Duplicate / Copy content / Delete, with the browser menu suppressed.
  Rename edits the title in place — Enter or blur commits, Escape cancels, and a guard prevents the
  submit-then-blur pair writing the same rename twice. Every action routes through existing
  orchestrator handlers, so Delete still confirms and Move still reuses `MoveToModal`.
- **Keyboard support on the shared `ContextMenu`**: `accessibilityRole="menu"` with
  `menuitem` / `menuitemradio` rows, plus a `document` keydown listener for Escape and
  ArrowUp/ArrowDown/Home/End. The listener is on `document` because the menu lives in a `Modal`
  and focus may be on the trigger or the body. Torn down on close and unmount.
- **`src/hooks/useHoverWheel.ts`** — hover-scoped wheel interception. `horizontal` maps vertical
  wheel onto `scrollLeft` for the note row; `vertical` contains the wheel inside the task list.

### Changed
- **Task creation is a `+` in the header.** The permanent "Add task" input was a 48px row and a
  text cursor's worth of chrome on screen for everyone who was not adding a task, and it made the
  card taller than its sibling. The `+` expands an inline composer that stays open across
  consecutive adds; the task list is capped at 168px so short lists never trap the page scroll.

### Notes
- "Copy content", not "Copy link" — the app has no router, so a note has no URL and inventing one
  would hand the user a dead string.
- **Pin/Favourite is deliberately absent.** It needs a `pinned` column, and `schema.ts` is
  `CREATE TABLE IF NOT EXISTS` with no migration path: an existing database would not gain the
  column and every pinned read would fail. Recorded in `AGENTS.md` → Known Gaps rather than
  shipping a toggle that silently does nothing.

### Verification
- `tsc --noEmit` clean, and clean under `--noUnusedLocals --noUnusedParameters`.
- `jest` 104/104 across 7 suites.
- Web bundle builds (1134 modules, HTTP 200).
- **Not verified in a browser.** `useHoverWheel`, the roving keyboard focus and the inline rename
  are all DOM paths; see `AGENTS.md` → Known Gaps.

## 0.7.0 — Markdown in tasks, live scratch pad, list rows, wide-viewport scaling (2026-09-27)

### Parser bugs (both found by the new tests, both fixed in the worklet)
- **A line opening `*` was parsed as a list bullet.** The bullet branch used `[-*+]` with
  nothing after it, so `*emphasis*` and `**bold**` at the start of a line emitted a stray
  marker range at offset 0. The marker must be followed by whitespace.
- **An emphasis after a bold run was never matched.** After a rejected candidate the regex
  engine resumed *past* it, and the rejected candidate was usually the closing `**` paired
  with the opening `*` of the next construct — `**bold** *em*` made the italic pass match the
  `*`·space·`*` spanning the gap, and the characters it consumed meant the real `*em*` was
  never offered. A rejected match now re-scans from `start + 1`. The 21 existing parser tests
  still pass.

### Added
- **`MarkdownLabel`** — renders markdown as static inline text, built on the app's own
  `parseMarkdownRanges` rather than `react-native-markdown-display` (a block renderer, far too
  heavy for one row). Task labels now format, so `**hey**` reads as **hey**.
- The scratch pad now uses `MarkdownTextInput`, the note editor's own engine, so it renders
  markdown as you type. Its `react-native-markdown-display` preview toggle and the second
  markdown engine behind it are gone.
- Vertical three-dot button on every note list row, opening the same context menu as
  long-press; anchored from the press point, per the `SelectRow` lesson.

### Changed
- The content preview line is gone from note list rows — the title and timestamp are enough,
  and the row was three lines tall for two facts.
- The dashboard is capped and centred at `Layout.contentMaxWidth` (1280), so a 1920px window
  composes instead of stretching. Tasks and Scratch Pad both carry `flexBasis: 0` and the split
  is `alignItems: 'stretch'`, so the seam down the middle is gone.
- `SectionHeader` tabs no longer wrap (see below), and the header no longer doubles its own
  bottom margin.

### Verification
- `tsc --noEmit` clean, and clean under `--noUnusedLocals --noUnusedParameters`.
- `jest` 104/104 across 7 suites.
- Web bundle builds (1133 modules, HTTP 200).

## 0.6.1 — Dropdown anchoring, generic toggle, one top bar (2026-09-27)

### Fixes

- **The settings dropdown opened in the wrong place.** It was anchored from `measureInWindow` on
  the trigger, which returned nothing usable — the menu came back pinned to the window's left
  margin, overlapping the rows above. It now anchors from the press event's window coordinates,
  which are always correct on both platforms, and hangs off the window's right edge. `resolveMenuPosition`
  also learned to flip an over-wide `right`-aligned menu back on screen instead of clamping it to
  the far margin.
- **Dropdown options read as a radio group.** A choice menu drew its icon *and* a trailing check —
  two indicators for one bit of state, and on an unselected option a hollow ring next to a tick
  read as "not selected but checked". `selected` now renders a single radio dot and drops the icon.
- **The toggle is generic again.** The labelled `Enabled` / `Disabled` variant is reverted to a
  plain 40px knob switch; the label crowded the row's text and only restated the knob position.
- **Removed the duplicate top bar.** `TopHeader` renders a 64px empty strip on any screen with no
  greeting, no sidebar toggle and no back button — and the Notes screen then drew a *second*
  header underneath it, at a different height. `TopHeader` is now the main column's only top bar:
  it carries the greeting, the screen title, and the per-screen controls (`New` and the list
  collapse on Notes). `NotesView` renders only the pane, and `HomeScreen` owns `notesListCollapsed`.

### Verification

- `tsc --noEmit` clean, and clean under `--noUnusedLocals --noUnusedParameters`.
- `jest` 94/94 across 6 suites.
- Web bundle builds (1132 modules, HTTP 200).

## 0.6.0 — Sidebar search, labelled toggles, cycling theme icon, Notion-style Settings (2026-09-27)

### Added

- **Sidebar search** (`components/shared/SidebarSearch.tsx`). A "Search or ask" field with a
  `Ctrl/⌘ K` badge sits under the brand row; the shortcut listener is on `document`, so it works
  while typing in the editor. While a query is active the nav and folder tree are replaced by
  results — folders first, then notes. Presentational: the query and the notes/folders it searches
  are owned by `HomeScreen`.
- `ContextMenuAction` gained `selected` / `highlighted` flags, and `ContextMenu` an `align="right"`
  mode, so it can double as a single-choice dropdown.

### Changed

- **Toggles now state themselves.** `ToggleSwitch` carries its own `Enabled` / `Disabled` label
  inside the track, with the knob and label cross-fading to the accent together.
- **The sidebar theme picker is one icon** that cycles Dark → OLED → Light; the glyph is the
  current theme. The full picker lives in Settings.
- **Settings restructured** on a desktop-preferences shape — page title with subtitle, labelled
  groups of hairline-separated rows, controls pushed right. Theme and Accent are now `SelectRow`
  dropdowns reusing `ContextMenu` rather than stretched segmented controls.
- `AnimatedPressable` is a `forwardRef` component so `SelectRow` can `measureInWindow` its trigger.

### Removed

- `ThemeSegmented.tsx` and `AccentPicker.tsx` — both orphaned by the two changes above. Deleted
  rather than left as dead code. `useSlidingPill` survives; the dock and the section tabs still
  use it.

### Verification

- `tsc --noEmit` clean, and clean under `--noUnusedLocals --noUnusedParameters`.
- `jest` 94/94 across 6 suites.
- Web bundle builds (1132 modules, HTTP 200).

## 0.5.1 — Segmented control collapse, header gap, Settings redesign (2026-09-27)

### Fixes

- **The sidebar's theme picker collapsed to `Dark / OL… / Light` with the pill drifting over
  the labels.** A segmented control's options are `flex: 1`, and a row whose width is undefined
  resolves those to their *minimum content size* — the labels clipped, and the sliding pill, which
  is sized from the measured options, ended up offset. `ThemeSegmented` and `AccentPicker` now
  carry `flex: 1` on the track, and a `style` prop lets a wide caller supply a definite width.
- **The header gap.** The sidebar's brand row and `TopHeader` were sized independently, so their
  bottom borders met at different heights and read as a gap through the layout rather than a
  divider. Both are now `Layout.headerHeight` (64) and both carry a border, so the rule is
  continuous across the sidebar/main boundary.
- **FAB menu flow.** The reveal now staggers bottom-to-top out of the button: the stagger is
  `(total - 1 - index) / total` because `actions[0]` renders at the top while the FAB sits under
  the last item. The items interpolate the parent's spring directly rather than re-wrapping the
  result in `withTiming` inside the style hook, which was restarting an animation every frame.

### Design

- **Settings restructured** from three near-identical full-width cards into labelled groups with
  a tighter 16px rhythm, caption-weight descriptions, single-line row summaries, and a footnote
  in place of the third card. Pickers are capped at 320px — left to fill a wide card, three short
  labels spread into three enormous empty pills, which is what made the screen look unfinished.
- Settings rows are 56px (they carry a description line); the 48px contract covers the toggle.

### Verification

- `tsc --noEmit` clean, and clean under `--noUnusedLocals --noUnusedParameters`.
- `jest` 94/94 across 6 suites.
- Web bundle builds (1133 modules, HTTP 200).

## 0.5.0 — Menus, accent axis, section reordering, density (2026-09-27)

### Fixes

- **The FAB menu rendered as three tall stacked cards.** `AnimatedPressable` takes two style
  props: `style` for the card's own box, `containerStyle` only for making the transform wrapper
  grow in a flex parent. The menu item had its box on `containerStyle` and nothing on `style`, so
  the inner `Pressable` was unstyled and its label and icon stacked as plain blocks. Fixed, and the
  distinction is now written down where the next person will read it.
- **A theme is a canvas; the accent is the 10% layer.** `Lavender` is no longer a fourth
  `ThemeName` — it is an `AccentName` applied through `withAccent(theme, accent)`, with its own
  section in Settings. `THEME_NAMES` and `ACCENT_NAMES` drive the two pickers.
- **Removed the hover "raise".** Hovering scaled elements to 1.02; on a segmented control the
  selected segment visibly grew under the cursor and read as a glitch. Press feedback only.
- **The FAB menu no longer rises.** Items used to lift and scale in on a stagger, which read as
  the menu rising out of the button and stranded items mid-flight on a fast tap. Fade only.
- **Replaced Chromium's focus ring.** The stock white outline ignored the theme and read as a
  rendering bug; focus is now a `:focus-visible` ring in `theme.accent` via `--app-accent`.
- **OLED muted text was too dim.** `#888888` passed AA on black but read as washed out next to
  white body text. Now `#a0a0a0` (8.0:1 on the canvas, 7.2:1 on the list surface), with
  `syntaxDim` re-blended to match.
- **The Notes screen stopped looking like a different app.** The list pane used `theme.surface`,
  painting a lighter slab down the left of a screen whose every other region is the canvas. A
  pane is not a card; it uses `theme.background` now.
- **Added a collapse control for the Notes list** — a 48px rail with a `chevron-double-left`
  button in the pane header, animated with the same spring the sidebar uses.

### Features

- **Overview sections can be re-ordered**, not just toggled. `order` is persisted next to
  `layout`; Settings rows carry up/down chevrons, disabled at the ends. Tasks and Scratch Pad
  share a row only while they are adjacent in the user's order.

### Density

- Dashboard padding and gap 24 → 16, note cards 224×160 → 200×144, and the calendar body lane
  48 → 96 so the calendar and the note row line up instead of the calendar floating in dead space.

### Verification

- `tsc --noEmit` clean, and clean under `--noUnusedLocals --noUnusedParameters`.
- `jest` 94/94 across 6 suites (11 new tests for accent and ordering).
- Web bundle builds (1133 modules, HTTP 200).

## 0.4.0 — Palette revert, dock fix, folder navigation, debloat (2026-09-27)

### Fixes

- **The brand accent is coral again.** `Dark` / `OLED` / `Light` are back to the original "Zen"
  warm-neutral palette (`#1F1F1F` canvas, `#2A2A2A` surface, `#F76F53` accent). `Lavender`
  survives as an *optional fourth theme* in the picker, on the Dark canvas with a `#B497FF`
  accent. The previous revision had made lavender the brand, which was wrong.
- **Removed the dock's quick-markdown buttons.** `format-bold` / `format-italic` /
  `format-header-2` render as the letterforms `B`, `I` and `H2`, so they read as broken text
  rather than controls — and markdown formatting already has a home in the scratch-pad toolbar.
  The dock is back to the three-screen switcher.
- **Clicking a folder now navigates to Notes** instead of only re-scoping the store. A folder row
  is a destination; rescoping silently made the click look dead.

### Debloat

- `HomeScreen` subscribes to the note store field by field instead of to the whole state object,
  which previously re-rendered the entire app tree on every `isLoading` flip.
- Deleted `findNode` and `useFolderTree.subtreeIds` — both dead; the subtree walk has a single
  canonical implementation in `FolderRepository.collectSubtreeIds`, which the store now shares
  instead of keeping a byte-identical copy.
- Dropped 11 theme tokens with no call sites (`backgroundSecondary`, `backgroundTertiary`,
  `textSecondary`, `textTertiary`, `textDisabled`, `borderSecondary`, `accentHover`,
  `accentActive`, `warning`, `success`, `info`).
- Removed a `useState` for calendar events that nothing could ever write to, a dead local in the
  per-keystroke markdown worklet, and two unused imports.
- Measured: the dead-code pass moved the web bundle by ~300 bytes. The real weight is in
  dependencies, and the obvious candidate (`react-native-markdown-display` → `markdown-it`) is
  **not** removable — `Editor.tsx` imports it for the note editor's read mode. Recorded in
  `AGENTS.md` → Debloat so the next person does not repeat the experiment.

### Verification

- `tsc --noEmit` clean, and clean under `--noUnusedLocals --noUnusedParameters`.
- `jest` 87/87 across 6 suites.
- Web bundle builds (1132 modules, HTTP 200).

## 0.3.0 — Motion, Settings, and the Overview layout preferences (2026-09-27)

### What changed

- **Animation layer** — `src/components/shared/motion.tsx` is now the single place animations
  are built: `AnimatedPressable` (0.97 press scale + hover lift), `ScreenTransition` (screen
  fade + lift), `DashboardSection` (block fade in/out), and `useSlidingPill` (measured
  indicator). `Motion` in `theme.ts` holds the shared durations, spring configs and press scale;
  it stays free of Reanimated so Jest can load it.
- **Sidebar** — collapse is now a 250 ms spring on one shared value driving width, content
  parallax and scrim opacity together, so the main column re-flows instead of jumping.
- **Dock** — one accent pill slides between segments; three quick-markdown actions sit behind a
  divider and feed the scratch pad (or open a seeded note off-Overview).
- **Settings** — new `src/screens/SettingsScreen.tsx`, reachable from a gear row in the sidebar
  footer. `ScreenKey` gained `Settings`; the dock is hidden there and `TopHeader` shows a back
  chevron. `DOCK_SCREENS` in `types.ts` is the dock's three.
- **Overview layout preferences** — four toggleable sections (notes, calendar, tasks, scratch
  pad) rendered conditionally by `OverviewScreen`. Persisted via the new `PrefsRepository`
  (`prefs` table / `localStorage`) and `usePrefsStore`. Theme selection is persisted too.
- **Palette** — coral → lavender. Canvas `#0D0D0E` / `#000000` / `#F8F9FA`, surface `#161618`,
  border `#232326`. New `theme.shadow` token retires every hardcoded `rgba()` scrim/shadow.
  Light darkens the accent to `#6A45F5` for WCAG AA.
- **Tests** — `__tests__/designSystem.test.ts` (contrast + token invariants) and
  `__tests__/prefs.test.ts` (repository round-trip, corrupt-value fallbacks, store behaviour).

### Verification

- `tsc --noEmit` clean; `jest` 82/82 across 6 suites.
- Web bundle builds (1132 modules, HTTP 200) against a dev server.
- Nothing has been rendered on a device, and the animations have not been watched moving.

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
