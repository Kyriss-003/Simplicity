# Expo HAS CHANGED

**MCP access**: The Paper MCP server is at `~/.paper/bin/paper.exe` — spawn it with the `mcp` subcommand and speak JSON-RPC 2.0 over stdin/stdout (newline-delimited JSON). When asked to use an MCP, go directly to this path; do not search for it.

**Rendering the app in Paper**: the Overview lives in file `01M49KCGDK2921V20QR4VC1CBW`, page `Simplicity — Mobile Overview` (`p-3-0`), artboard `Overview — Mobile` (`8T-0`, 375×812). Build it with `write_html` (insert-children into `8T-0`) using the B&W theme tokens from `src/theme.ts`; verify with `get_screenshot` and release with `finish_working_on_nodes`. Paper's MCP has a weekly call limit — batch writes and skip re-reading the tree to conserve it. When the limit is hit, `get_screenshot` fails with "Weekly MCP limit reached" while `finish_working_on_nodes` still works; it resets the next day, so finish the design first and screenshot after.

## Core Stack
- Expo SDK 57 · React Native 0.86.3 · React 19.2.3 · TypeScript 6.0.3 (`strict`)
- State: Zustand 5. Storage: SQLite via `expo-sqlite` (native) / `localStorage` (web preview)
  - **Subscribe field by field, never to the whole store.** `useNoteStore()` with no selector
    subscribes to the entire state object, so every `isLoading` flip — two per repository call —
    re-renders the whole app tree. `HomeScreen` uses one selector per field it renders and reads
    the (identity-stable) actions off `useNoteStore.getState()`.
- Styling: `StyleSheet.create` + tokens from `src/theme.ts`. **No Tailwind, no nativewind** — those packages were removed.
- Animation: `react-native-reanimated` 4.5.1 (already a dependency — do not add a second animation library)
- Markdown: `react-native-markdown-display` (dashboard cards) · `@expensify/react-native-live-markdown` (the note editor) · Icons: `@expo/vector-icons`
- Web: `react-native-web` 0.21 — not just a preview layer, see **Web runtime** below.
- Tests: Jest 29 + `jest-expo`, 11 suites in `__tests__/` (234 tests)

**The editor's markdown engine is a dependency decision, not a free choice.**
`@expensify/react-native-live-markdown` was adopted deliberately after rejecting a
block/line-splitting `TextInput` (impossible: one text style) and CodeMirror-in-a-WebView
(`react-native-webview` has no web build, so it could not be verified where this app is
verified). It brings `expensify-common` and a pinned `html-entities@2.5.3`. See
`AGENTS.md` → Markdown Editor before touching it.

## Commands
- `npm run typecheck` (`tsc --noEmit`) — required before committing
- `npm test` — Jest
- `npx expo start` — dev server
- **After any dependency change, restart the dev server with `npx expo start --clear`.** A
  running Metro instance caches module resolution, so installing a package underneath it
  yields `Unable to resolve "<pkg>"` for a package that is present and valid. It is a stale
  cache, not a broken dependency — confirm with `npx expo export --platform web --clear`.

## Layer Boundaries (DO NOT CROSS)
- `src/db/` — SQL only. Exports repository classes plus singletons (`noteRepository`, `folderRepository`, `prefsRepository`). No UI, no state.
- `src/store/` — Zustand only. Delegates to the repositories. No SQL. `useNoteStore` is user content; `usePrefsStore` is app configuration. Do not merge them.
- `src/types.ts` — shared app types (`Note`, `Folder`, `Task`, `CalendarEvent`, `FolderNode`, `ScreenKey`, `LayoutPrefs`). Components import from here, **never** from `src/db/`.
- `src/components/` — presentational. Theme, data, and callbacks via props only. No store imports.
- `src/screens/` — orchestration. `HomeScreen` is the shell (state, handlers, sidebar, dock, FAB, modals); `OverviewScreen` / `NotesScreen` / `AgendaScreen` / `SettingsScreen` are presentational.
- `src/hooks/` — `useDebouncedPersist` (data) and `useScrollRedirection` (scroll chrome).
  Deliberately different in kind: the first owns persistence, the second owns a DOM listener, and
  neither knows about the other.
- `src/theme.ts` — single source of truth for color, type scale, spacing, radius, and **motion**.

## Web runtime (`react-native-web`)
The web build is a first-class preview and the editor runs on it. Verified against
`node_modules/react-native-web/dist/exports/TextInput/index.js` and
`node_modules/@expensify/react-native-live-markdown/lib/module/MarkdownTextInput.web.js` —
re-check them after an upgrade rather than trusting this note.
- `multiline` renders a real `<textarea>`: one text style, no styled spans, plus the UA focus ring, a 2px border and a resize grip. `Editor.tsx` resets those with a web-only `webInputReset` style. This is why a *stock* `TextInput` can never dim syntax — see Markdown Editor.
- The `selection` prop is applied in a `useLayoutEffect` keyed on **object identity** (`index.js:314`), and the DOM's real selection is written back on every change (`index.js:305`). If you ever impose a caret, hold it in state; a fresh literal in render re-pins the caret every keystroke.
- `MarkdownTextInput.web.js` imports **only** `react-native` and `react` — no worklets, no third-party code. The web editor path is therefore pure JS and cannot be broken by a native/worklets version skew.
- `onPress` is bound to the native `click` event (`usePressEvents/PressResponder.js:303`). Right-click fires `contextMenu` only, so a row's `onContextMenu` and `onPress` cannot both fire.
- `Animated` must pass `useNativeDriver: false` on web or the native module is missing.
- RN 0.86 deprecates the `pointerEvents` **prop**; it belongs in `style.pointerEvents` now.
  A `pointerEvents=` prop in a render logs a deprecation warning on every mount.
- Chromium's default framed scrollbar (arrow buttons and all) is replaced app-wide by the one-shot `<style>` injection in `App.tsx`. Do not add per-component scrollbar CSS.
- The app's motion is Reanimated, not RN's `Animated`. Reanimated has no `useNativeDriver` flag, so that warning above applies only if you reach for the legacy API.

## Accessibility & Clarity — the app is for neurodivergent users
**This app is marketed to neurodivergent users. That is a design constraint, not a
marketing line, and it outranks almost everything else in this file.** It is stated
here at the top because it is the rule that decides the cases the other rules do not.

- **The test is instant comprehension by someone who is not neurodivergent.** If a
  neurotypical user has to work out how a screen works, **that is a design flaw** — not a
  documentation gap, not a training issue. The user's own words, after a calendar screen
  took them a while to parse: *"if me (someone who isn't neurodivergent) couldn't understand
  immediately, THAT'S A DESIGN FLAW."* Build for the person who has to re-read it.
- **One idea per screen, and one way to do each thing.** A screen that answers a question and
  poses a second one costs the user the first answer. Every extra panel, mode, view switch or
  parallel representation is something to hold in working memory while reading.
- **No modes.** A control that changes what the *other* controls mean makes the interface's
  behaviour depend on hidden state. The Agenda's Month/Day tabs were removed for exactly this:
  the ‹ / › arrows stepped a month on one tab and a day on the other, so the same button did
  two different things depending on invisible state. If two buttons can mean different things
  depending on context, one of them is in the wrong place.
- **Every control states its own effect, and its label matches it.** No icons that need a
  legend, no affordances that must be discovered by trial, nothing whose function is "press and
  see".
- **A tap always has a visible, local consequence.** Changing state somewhere the user is not
  looking is a failed interaction even when the state changed correctly.
- **Say one thing per block.** Stacked secondary text under a list of destinations is a
  paragraph to parse before choosing. Prefer the minimum that carries meaning, and put detail
  where it is needed — in the destination's own heading, not everywhere at once.
- **Reuse a pattern the user has already understood elsewhere in the app.** A second shape for
  a familiar thing is a new thing to learn. The Agenda's day list is a list *because* the
  Overview's "Upcoming" and the Tasks card are lists.
- **Predictability beats cleverness.** The same gesture should do the same thing everywhere.
  Relying on "it's obvious" is how the rules above get violated.
- **When simplification is requested, remove the mechanism, not just the labels.** Two attempts
  here failed before one worked: adding clearer labels to an ambiguous control, and then hiding
  one of two views. The fix was to delete the mode so the ambiguity had nowhere to live.

## Design System (enforced)

**Depth & surfaces — read this before picking a fill or a border.** These are app-wide rules, not
per-theme preferences.

- **Never `#FFFFFF` as a canvas.** Pure white is a full-glare surface under a bright light, and
  it leaves the cards nothing to be lighter than. Every canvas is a soft off-white or a neutral
  grey: `#F4F4F5` (B&W) · `#F2F0E3` (Light) · `#121212` / `#000000` (the dark canvases). Pure
  white is **reserved for the card / floating layer** — that reservation is what creates depth.
- **Layers are separated by shadow, not by outline.** A card is `1px / 3px blur` in
  `theme.cardShadow` plus a hairline that is allowed to be a whisper. Do not reach for a heavier
  border to draw an edge. `cardShadow` and `shadow` are separate tokens precisely because a
  modal backdrop has to knock the page out while a card only whispers.
- **One or two depth levels, never more.** Canvas → card → floating chrome. A fourth level
  always reads as clutter. If something does not fit in two, it is probably a card rather than a
  new surface.
- **Four states, four gentle indicators, no heavy effects.** `hoverBg` is a transient wash;
  active / selected is a step darker (`pillBg`) or the accent; focus is the accent ring
  (`--app-accent` in `App.tsx`); disabled is `textMuted`. Prefer a gentle shadow-depth shift, a
  soft border-colour change or a hairline over anything with a fill or a scale change — an
  aggressive hover treatment is what made a segmented control look like it was glitching.
- The accent stays the one high-contrast thing on a light page. If a screen has no obvious
  focal point, that is usually a sign a *primary card* is missing (`primaryTheme`), not that
  something needs to be bolder.

**Color — 60/30/10.** `theme.ts` separates the two axes that a palette usually muddles: a **theme is the canvas** (`Dark` / `OLED` / `Light` / `B&W`) and the **accent is the 10% layer** (`Coral` / `Lavender`). Canvas `#121212` (Dark) · `#000000` (OLED) · `#F2F0E3` (Light) · `#F4F4F5` (B&W); surface `#1E1E1E` (Dark) · `#2A2A2A` (OLED) · `#E8E5D8` (Light) · `#FFFFFF` (B&W). Sidebar matches the canvas so the 30% layer stays reserved for cards. Accent is only for the FAB, active nav, selected state, checkboxes, and focus.
- **Dark is a neutral reference palette** — `#121212` canvas, `#1E1E1E` cards, `#F5F5F5` text — and the warm "Zen" cast it used to carry is gone on purpose: a neutral grey is what lets a coral accent read as an accent rather than as part of the background. It has exactly two surface values (`surfaceRaised` equals `surface`), so `surfaceTheme` hands it back untouched and it shares one ink across canvas and card.
- **Its muted text is `#8E8E8E`, not the reference's `#757575`.** `#757575` is 4.07:1 on `#121212` — under AA. Lifting it to 5.7:1 is the one place the palette departs from its reference, and it is a deliberate one: every other text pair here is held to AA by a test.
- **Every theme still ships `accent: '#f76f53'`** — that orange is the default, and the accent axis is what changes it. The picker offers **Claude / Lavender / Black / White**. `Coral` was renamed to `Claude`: same colour, new name, and `LEGACY_ACCENTS` in `usePrefsStore` maps the old stored value across so a rename costs returning users nothing.
- **An accent is a *pair*, not a hex.** `ACCENTS[x]` is `{ value, text }`, because the two accents before `Black` were both light-mid and both wanted dark glyphs, and that assumption was baked into `withAccent` not touching `accentText` at all. `Black` and `White` are the first that need the opposite, so `withAccent` now sets both and its identity guard compares both. A test asserts every accent's glyph colour clears AA on its own fill — otherwise an accent with unreadable text on it ships.
- **A monochrome accent is low-contrast on the canvas it matches, and that is allowed.** `Black` on `Dark` / `OLED` and `White` on `Light` / `B&W` are the same trade in opposite directions: the accent disappears into its own ground. That is the user choosing a monochrome accent on a matching theme, not a rendering fault, and it is not worth a per-theme special case. Worth knowing where it bites: the sidebar's 2px active stripe and a white `TextInput` border are the two places a vanished accent is most obvious.
- **Lavender is an accent, not a theme.** `withAccent(theme, accent)` overlays it at the single point where the theme is resolved (`HomeScreen`). It was briefly a fourth `ThemeName`; that was wrong — a fourth entry in a control labelled "theme" says a fourth canvas, and lavender is not one. (`B&W` *is* a fourth canvas, and earned its place.) `THEME_NAMES` and `ACCENT_NAMES` drive the two pickers — the Settings rows spread those constants rather than re-listing them, so adding a theme cannot leave the picker behind.
- **`ACCENT_NAMES` is imported from `theme` everywhere, never redeclared.** `usePrefsStore` had its own copy of the list, and that is the one that would have survived adding a third accent: `parseAccentName` fell back to a hardcoded default for anything it did not recognise, so a new accent would have been written to storage, read back, and silently dropped on the next launch — with no error anywhere. The store now imports it. **Never resolve an unknown stored value by fallback alone**: the fallback moves every time a name changes, so the `Coral` → `Claude` rename would have repainted everyone's accent the day the default was next touched. A rename belongs in `LEGACY_ACCENTS`.
- OLED's `textMuted` is `#a0a0a0`, brighter than the other themes on purpose: `#888888` passed AA on black but still read as washed out beside white body text, and an OLED canvas has no surface tint to lift it. Its `syntaxDim` is re-blended to match, and a test pins the ratio.
- Elevation and scrims use **`theme.shadow`**, never a literal `rgba()`. A hard-coded scrim vanishes on OLED and is far too heavy on Light.
- **A component that draws onto a card calls `surfaceTheme(theme)`** once at the top and uses the result for everything on that card. Do not sprinkle the tokens through the call sites: "I am drawing on a card" has to stay one decision, or a file ends up half-migrated. It returns the **identical object** for every theme today (all four share one ink across canvas and card), so it is safe in a `useMemo` and left every existing pixel untouched.
- **`primaryTheme(theme)` is the one black card.** `B&W` is the reason it exists: with every dashboard card painted `#000000` the page was four identical black slabs and had no focal point. So `B&W` reserves the black for **one** card — the first visible section — and the other three are quiet white. It at 17:1 against the canvas is by far the highest contrast on the page, which is the entire point. The other three themes set `inverse` to their own surface and ink, so a primary card is indistinguishable from a normal one and `primaryTheme` hands them straight back; a test pins that.
- The four dashboard cards take a **`primary` prop** and pass the resolved ink to `<Card theme={ink}>`, so `Card` needs no idea whether it is primary. `OverviewScreen` computes the primary from the **visible** order, so it follows the user's drag-reorder and respects anything they have hidden. `scratchPad` folds into the row above it when paired, so the first block can be a two-card row — only `tasks` is eligible then, or the page would carry two blacks.
- **B&W is a soft base, white cards, one black** — `#F4F4F5` canvas, `#FFFFFF` cards, `#111111` primary, the concrete instance of the depth rules above. Its card border is a whisper at 1.11:1 and the 1px/3px `cardShadow` is what draws the edge. `surfaceRaised` equals `surface` here, because a white panel on a near-white canvas cannot be separated by fill value.
- The sidebar's hover wash is its own **`hoverBg`** token rather than `surface`. It only worked as `surface` because every theme had a surface one step off its canvas; on `B&W` it flashed a black block.
- `onSurfaceError` exists because **no single red clears AA as text on a black card, as text on a white canvas, and as a fill behind white text.** Adding that test also caught `Dark` and `Light` shipping destructive text below AA inside cards (4.42 and 4.31) — their reds are now `#e5786a` and `#b3352a`.
- Never hard-code a hex value or a bare `borderRadius`. Use `theme.*` and `Radius.*`.

**Type — 4 sizes × 2 weights, via `Typography.app`.** Sizes 24 / 18 / 14 / 12. Weights 400 / 600. Tokens: `pageHeader`, `cardHeader`, `body`, `caption`, each with a `…Regular` / `…Strong` variant. Raw `fontSize` / `fontWeight` is permitted only inside `theme.ts`.
- **`wordmark` is the one token with non-zero `letterSpacing`** (2). Set in caps and tracked out, a short all-caps word reads as a logotype; at `letterSpacing: 0` the same word reads as a heading that lost its casing, which is what the header looked like before. Size and weight stay inside the scale, so the type test still holds.

**Spacing — 4pt grid.** `Spacing.approved = [4, 8, 12, 16, 24, 32, 48, 64]`. No 7, 11, 13, 15, 22. Every approved value except `4` is also a multiple of 8, so the 4pt grid satisfies an 8pt brief without a second scale.

**The dashboard is capped and centred** at `Layout.contentMaxWidth` (1280). A `maxWidth` alone leaves the width undefined, so it is always paired with `width: '100%'`. Without a cap a 1920px window stretched five note cards and two bottom panels across the full width — the type stayed 14px while the boxes grew to 900px, so the page read as sparse rather than wide.

**48px row contract** (`height: 48` + `alignItems: 'center'`): task rows, the add-task bar, upcoming-event rows, calendar slot header, sidebar rows, context-menu rows, modal and confirm buttons. Note rows and note cards are exempt — they need multi-line height. The Agenda timeline's *body* lane is 96px, sized to match the note card so its two sections line up. Settings rows are 56px because they carry a description line; the toggle alone would be 48.

**The Overview's calendar block is a list; the Agenda screen is the calendar.** `UpcomingEventsCard`
renders the next 5 events — pinned first, then by `startsAt` — and the Agenda screen owns the real
calendar (`WeekStrip` + `DayEventList`). The Overview used to draw the same `CalendarTimeline`
the Agenda began with: a timeline describes *one day's* slots, so on a dashboard it was a picture of a day
rather than a list of things to do, and it dropped every event outside the seven visible slots.
`CalendarTimeline` and its `Today / Week / Month` tabs are **gone** — those tabs only ever switched
the timeline's slot geometry, and with no timeline they would have been three controls rendering the
identical list. The Agenda briefly grew a `Month / Day` tab pair of its own and lost that too; see
Calendar below.

## Calendar (Agenda)
- **The `events` table exists.** `EventRepository` mirrors `NoteRepository`'s two-backend split under
  its own `localStorage` key (`notes_app_events`, deliberately *not* the notes key). `useEventStore`
  is a **separate store** from `useNoteStore` — an event has no folder, no markdown body and no sync
  story, and folding it in would put event writes behind the note store's shared `isLoading` boolean.
- **`events.priority` needed the migration this repo did not have.** `SCHEMA_SQL` is
  `CREATE TABLE IF NOT EXISTS`, so editing a table definition only affects *fresh* databases — and
  because `EventRepository` names its columns explicitly in `INSERT`/`UPDATE`, a column an old
  table lacks turns every write into a runtime error. Adding `priority` to the DDL alone would
  have shipped that crash. `applyMigrations` now reads `PRAGMA user_version`, applies each
  pending statement, and writes the version back, **probing `table_info` first** because a fresh
  install already has the column while still reporting `user_version = 0`. The web path needs
  none of it: `localStorage` holds whole objects, so an old payload just lacks the key.
- **`EventUpdateInput.priority` accepts `null`.** `undefined` means "leave it alone", so without
  `null` there would be no way to take a priority *off* — the same dead end `color` is documented
  as having. A flag you cannot clear is not a flag.
- **`startsAt` is a full ISO 8601 instant, stored UTC and rendered local.** Storing a bare date makes
  an event created at 11pm land on the previous day in another timezone. Every conversion goes through
  `Date` in `components/calendar/calendarUtils.ts` — **never `toISOString().slice(0, 10)`**, which
  converts to UTC first and files an evening event under the wrong day.
- **The screen is one idea: a day, and what is on it.** Heading, a week strip to pick the day, a
  list of that day's events, an "Add event" row. Every control means one thing — the arrows move
  a *day*, the strip picks a day, "Add event" adds to the day on screen. See the Accessibility &
  Clarity section above: this went through three shapes and the first two were rejected because a
  non-neurodivergent user could not parse them at a glance.
- **The hour timeline is gone; the month grid came back as a popover.** `DayTimeline.tsx` and
  `blockGeometry` are deleted — a 720px lane of positioned blocks was mostly empty on a quiet day
  and nothing could explain where an event sat without arithmetic. The month went the other way:
  it is reachable through **one explicit control**, the date heading, which opens
  `MonthPickerPopover` anchored under itself. That is the rule paying off rather than a
  compromise: the day list stays the only thing permanently on screen, ‹ › keep meaning exactly one
  thing (a day), and no second panel competes for attention.
- **Priority is the event's colour, and it lives in two ramps.** `Theme.priority` clears 4.5:1 on
  both `background` and `surface` (so one value works on the page *and* on any card);
  `InverseInk.priority` clears 4.5:1 on the primary card. The split is arithmetic, not taste: in
  `B&W` a single value cannot serve both, because a dark red reaches 4.8–6.1:1 on the light canvas
  but 3.07:1 on the `#111111` black card, and a light red is the exact mirror. Only `B&W` has a
  genuinely different set; the other three repeat theirs. `withAccent` leaves both alone — a
  lavender accent must not recolour a red flag.
- **Priority is a colour, not an ordering.** The Overview's Upcoming list stays chronological;
  `sortUpcoming` is untouched and a test pins it. A pin still floats above everything — which is
  the inconsistency to fix if someone next asks.
- **Every event row opens the editor; inline rename is gone from the calendar.** Before this, the
  only edit an event had was retyping its title, so date, time, length and priority were
  unreachable. `EventEditorDialog` is the one place an event is created or changed, and it is
  rendered at the shell so the FAB, the page menu and the Agenda's "Add event" row all open the
  same one. **Delete stays in the row's context menu** — two places to delete is one too many.
- **The editor's controls are chips, not dropdowns, on purpose.** Priority is four labelled
  swatches side by side, because choosing a colour means *comparing* them and a dropdown hides the
  thing being chosen. Time is hour chips plus `:00`/`:30`: a half-hour dropdown across the working
  day is 27 rows and about 1300px, taller than any phone, so `ContextMenu` clamped it and the
  afternoon was silently unreachable. That was found by probing, not by looking.
- **The editor's body height is derived from the window.** A fixed `maxHeight: 420` was a real bug:
  with five fields the last one landed below the clip, so the "Priority" label was visible and its
  swatches were unclickable. `min(600, winHeight * 0.68)` plus a tight rhythm (36px chips, 6px
  gaps) fits the whole form; the scroll region is now a fallback for a phone keyboard.
- **The title field focuses on two `requestAnimationFrame`s, not `autoFocus`.** The same race
  `useInlineRename` documents, in the opposite direction: a Modal hands focus back as it closes, so
  `autoFocus` on the way in loses about half the time — and the failure is silent, a dialog that
  looks perfect with no keyboard.
- **The list is the shape the app already teaches.** Same 48px row, same time/title columns as the
  Overview's Upcoming and the Tasks card, so the Agenda is a pattern already in the user's hands
  rather than a new one. The row states `9:00 am` precisely because the duration sits in the next
  column — "9 am … 30 min" makes the reader do the arithmetic.
- **`nextFreeSlot` ignores the wall clock.** "Add event" takes the first free hour from
  `DAY_START_HOUR` to `DAY_END_HOUR`, so the same day always offers the same slot whatever time you
  press it, and it never wraps to tomorrow — the row says it adds to *this* day. A slot that depends
  on the current hour is a control whose effect changes under the user.
- **`agendaAnchor` lives in `HomeScreen`, not `AgendaScreen`**, because the FAB's "New Event" has
  to drive it: creating from the Overview and landing on a day you were not looking at would hide
  the thing you just made.
- `useInlineRename` is generic over `{ id, title }` so event rows share the note rename state
  machine rather than growing a second, subtly different one.

**Column headers share one height.** `Layout.headerHeight` (64) is used by both the sidebar's brand row and `TopHeader`, so the two bars line up across the column boundary. They used to carry a bottom border as well, and that is gone: a rule under the header is a divider drawn between two things the sidebar's own vertical edge already separates, and the depth rules put shadow — not outlines — between layers. **Neither draws one now, and that is deliberate.** Half of it is the failure mode: a rule that stops dead at the column edge reads as a broken divider, not a shorter one. If either side ever grows a bottom border again, the other has to match it in the same change.

**Flex on the bottom cards belongs to the split row, not the cards.** `TasksCard` and
`ScratchPadCard` carry **no** `flex`; `OverviewScreen` passes `pairStyle` — `flex: 1` in the row,
`alignSelf: 'stretch'` in the column. A `flex: 1` on a card in a *column* is a **zero-height box**:
`flexBasis` applies to the main axis, and a content-sized column has no free space to distribute, so
at iPad-mini width both cards collapsed to 0px and their contents overflowed through each other. In
a row the same `flex` is exactly right and `alignItems: 'stretch'` covers the height.

## Motion & Animation
`Motion` in `theme.ts` is the whole vocabulary: `duration` (base **250ms**), `spring.gentle` / `spring.snappy`, and `pressedScale` (**0.97**, one shared value for every pressable). Easing curves live in `components/shared/motion.tsx` because they need `Easing` — `theme.ts` must stay import-free of Reanimated so Jest can load it.
- **`components/shared/motion.tsx` is the only place animations are built.** `AnimatedPressable` (press scale), `ScreenTransition` (screen fade + lift), `DashboardSection` (dashboard block fade in/out), `useSlidingPill` (the indicator that slides between segments).
- **`AnimatedPressable` puts the card's box in `style`, not `containerStyle`.** The wrapper is a pure transform target with no layout, so it shrink-wraps the pressable and the scale always matches the visible box. `containerStyle` is only for making the *wrapper* grow in a flex parent (a `flex: 1` segment), where the pressable then needs `flex: 1` of its own. Putting padding / background / `flexDirection` on the wrapper instead leaves the inner pressable unstyled and its children stack as plain blocks — that is exactly how the FAB menu rendered as three tall cards.
- **There is no hover lift.** An earlier version scaled hovered elements to 1.02; on a segmented control the selected segment visibly grew under the cursor and read as a glitch. Press feedback only. Rows that predate `AnimatedPressable` (the sidebar's nav and folder rows) still track hover themselves, because a background change is not a transform.
- `SectionHeader`'s tab group and its tabs are `flexShrink: 0`, and the labels are `numberOfLines={1}`. The title was allowed to hold its size while that side shrank, and a squeezed tab row *wraps* its labels ("Suggest ed", "W eek") rather than clipping them — which looks broken and leaves a press target half the height it should be. The row may only overflow at a genuinely narrow width.
- **The tab's font weight is part of the active check.** `captionStrong` applied to every tab left
  the *inactive* label bold while the pill sat on the active one, so the two indicators disagreed
  and the control looked stuck on the wrong tab.
- `SectionHeader` carries no `marginBottom`: `DashboardSection`'s `gap` already supplies the space under it, and having both meant every section paid for the gap twice.
- **Sliding pills measure, they do not assume.** `onLayout` reports an item's position relative to the parent's *content* box, while an absolutely positioned child is placed against the *padding* box — so a container with padding would offset the pill by exactly that padding. `CapsuleSwitcher` and `SectionHeader` nest their segments in a zero-padding `track` view for this reason. There is no longer a segmented theme/accent control — both moved to dropdowns and the sidebar to a cycling icon — but `useSlidingPill` still serves the dock and the section tabs.
- **A segmented control's track needs a definite width.** Its options are `flex: 1`, and a row whose width is undefined resolves those to their *minimum content size* — labels clip and the pill drifts. A `maxWidth` alone does not fix this: a cap constrains a width that already exists, it does not give the container one.
- **Measure the slot, never the pressable.** `AnimatedPressable` renders `<Animated.View><Pressable {...rest}/></Animated.View>`, so an `onLayout` on the pressable is measured against *its own wrapper* — a separate flex child per item. Every segment then reports `x: 0`, `useSlidingPill` gets a valid `width` (origin-independent) and a useless `x`, and the pill pins itself to the first tab while only resizing. Each segment is therefore wrapped in a plain `View` that is the row's real flex child, and *that* is what measures. Two traps in one line: Reanimated's `Animated.View` does **not** deliver `onLayout` on web (it yields `width: 0`), and this failure is invisible to Jest and to any static DOM read — the pill is present and correctly sized throughout. See `Agent thoughts.md`.
- **A misaligned icon is usually not a misaligned box.** The dock's glyphs read as
  sitting above their labels while every `getBoundingClientRect()` centre matched to the
  decimal: `MaterialCommunityIcons` paints its artwork on the cap-height band, so its ink
  does not centre in a line box the way a word's does, and `alignItems: 'center'` cannot
  see it. `CapsuleSwitcher` carries a 2px `translateY` measured off the rendered pixels —
  a magic number that is load-bearing, so it is documented as size-specific (14px icon
  against a 12px label) rather than left as an unexplained fudge. **When a report says
  marks are not lined up, measure the ink, not the box**; a probe that only checks box
  geometry will report the original code as correct.
- `ScreenTransition` must sit under a `key` that changes with the screen; the remount is what replays the entrance.
- `DashboardSection` uses Reanimated's `entering` / `exiting` props instead, because those sections are not remounted on toggle — `exiting` is what holds the node until its leave finishes.
- The FAB menu fades in on a **bottom-to-top stagger**: `actions[0]` renders at the top of the column and the FAB sits under the last item, so the stagger offset is `(total - 1 - index) / total` and the reveal travels *up* out of the button. The items interpolate the parent's spring directly — an earlier version also wrapped them in `withTiming` *inside* the style hook, which started a fresh animation every frame and could strand an item mid-flight on a fast tap.

## Settings & Preferences
- `ScreenKey` is `Overview | Notes | Agenda | Settings`. `DOCK_SCREENS` is the dock's three; Settings is deliberately **not** in it — the dock switches where you work, settings change how the app works, and the Settings screen hides the dock entirely.
- **Settings hides the FAB too, not just the dock.** Same reasoning one step further: all three FAB actions (New Note / Task / Event) navigate *away* to create something, so on a preference surface the button can only take you off the thing you just opened. A 56px coral circle floating over a settings search field was the last piece of workspace chrome left on the screen.
- **Overview layout reorders by dragging a handle**, not by a pair of chevrons: `DraggableList` in `components/shared/`, geometry in `dragReorder.ts`. The dragged row is the *ghost* (follows the pointer, lifted and scaled) and the other rows spring aside by one slot, which is what leaves the visible **placeholder** that says where the row will land. A pair of chevrons could only express "one step"; the chevrons are gone.
- **The drag lives on a dedicated handle, never on the row.** These rows are also visibility toggles, so a draggable row would have to disambiguate a tap from a drag, and every threshold that introduces makes the toggle feel broken.
- `DraggableList`'s gesture state (`activeIndex`, `toIndex`) is **plain React**; only the ghost's travel and the other rows' springs are shared values. A gesture that never re-renders cannot redraw the hole. This is the opposite trade from `useSlidingPill`, which is entirely continuous — keep them separate.
- **Each row is its own component** so it owns its `PanResponder` and spring. Hooks called inside a parent's `.map()` make the hook count depend on the item count, so adding a section would silently reorder the hooks.
- `reorderSections(from, to)` replaced `moveSection(section, direction)` in `usePrefsStore`; the drop geometry is unit-tested in `__tests__/dragReorder.test.ts`, because a gesture component is unreachable from Jest.
- **Two `react-native-web` traps on the handle, both confirmed in `node_modules`:** `onAccessibilityAction` does **not exist** in RNW (absent from its dist), so the web keyboard path is `onKeyDown`, which RNW *does* forward — the `onAccessibilityAction` props are native-only. And `focusable` is deprecated in RNW (it `warnOnce`s); use `tabIndex`. `ContextMenu` still uses `focusable` on its rows and is warning on every mount.
- The handle's role is `button`, **not `adjustable`** — RNW maps `adjustable` to ARIA `slider`, which announces a value and a min/max that a reorder handle does not have.
- Settings is reachable from a gear button in the sidebar's footer, and leaves via a back chevron in `TopHeader`.
- **Settings has its own navigation** (`components/settings/SettingsNav.tsx`) with five sections —
  Accounts / General / Preference / Shortcuts / Get help. Above the tablet breakpoint it is a
  **vertical rail beside the content**; below it, a **vertical list that navigates**. `SettingsScreen`
  holds the active section as local view state; the *values* are props from `HomeScreen`, which owns
  the store.
- **The web build is not a desktop-only preview — phone is a first-class target.** A narrow layout
  is not a degraded desktop one. Two consequences that are easy to get wrong: a control that works
  with a mouse has to be reachable and legible with a thumb, and a horizontal swipe is a *real*
  navigation gesture, not a nicety.
- **A chip row is the wrong navigation on a phone.** Five 12px chips is a strip of labels the thumb
  has to cross to reach the last one, and a chip row *swaps content in place* — so a tap has no
  destination and back has nowhere to go. A list gives each section a target, a description of what
  is in it, and somewhere to go back **to**, which is what makes the screen navigable at all.
- **Narrow Settings is a drill-down: list → section → list.** `SettingsScreen` owns `atMenu`, and
  exposes `goBack()` through a ref so the header chevron pops one level before leaving the screen.
  Wide mode has no such level, so `goBack` returns `false` and the shell navigates away. The shell
  never learns which section is open — `AGENTS.md` is explicit that this is local view state.
- **Swipe between sections on narrow** (`hooks/useHorizontalSwipe.ts`), with dots under the section
  title as the affordance — a horizontal swipe has no visible handle, so without it the gesture is
  undiscoverable. Two rules make it safe: the axis is decided in `onMoveShouldSetPanResponder`
  *before* claiming, or a vertical drag is stolen out of the `ScrollView` halfway through; and
  `enabled` plus the callbacks live in refs so the `PanResponder` is built once — rebuilding it
  mid-gesture swaps the responder out from under a finger that is still down.
- **`goToSection` must not be a `setState` updater.** It was written as one that also called
  `setAtMenu` from inside the updater, which is a side effect during the update phase; an updater
  is re-run on every re-check, and a fast double-swipe left the two states out of step and rendered
  neither the menu nor a section.
- **Never drive two consecutive swipes in one synthetic-touch session.** Chrome keeps the previous
  touch sequence alive and the next gesture reports stale deltas — a rightward swipe arriving as
  `dx = -47`. Reload between gestures, or the harness will invent a bug that is not in the app.
- **The Settings shell changes `flexDirection` with the nav, and the two must be changed
  together.** Above the breakpoint the rail sits *beside* the content, so the shell is a
  row; below it the shell is a column, because the narrow layout is either the list on
  its own or the section on its own — never both. The shell was `row` unconditionally,
  which made the old chip `ScrollView` a row child: it sized itself to its full 436px of
  chips and the `flex: 1` pane beside it was starved to nothing, so the whole section was
  pushed off-screen at every phone and tablet width. `SettingsNav` is written for the
  parent the shell is actually providing — check the other one when either side changes.
  The rail renders on the **wide** branch only; an inverted guard once left the list
  stacked on top of the section content on a phone.
- Each section is its own file under `components/settings/`, and they share `SettingsRow` /
  `SettingsGroup` / `SelectRow` / `ValueRow` so a row is defined once. A section must contain only
  settings that are **actually implemented** — a row that looks real and does nothing is worse than
  its absence, which is why there is no sign-in, no sync toggle and no language picker.
- `usePrefsStore` also owns `confirmDelete` and `openNewNote` (the General section, stored under the
  `general` key). `setBehaviour` writes **only known keys**, so an unrecognised one cannot sit in
  storage being silently dropped on the next read.
- `SettingsRow` sets a colour on its label **before** the `tone` overrides. Leaving the default
  tone with no colour at all is the exact failure this file already documents: the label inherits
  the DOM's black, which is invisible on Dark and OLED and correct on Light.
- **The main sidebar gives way on Settings.** It has its own section rail (`SettingsNav`: Accounts / General / Preference / Shortcuts / Get help), so leaving the workspace tree up put two navigations side by side — one offering a place to go, the other a place to configure, with only the second useful while configuring. `HomeScreen` skips `Sidebar` when `activeScreen === 'Settings'`; the mobile scrim is gated on the same flag or mobile shows a dimmed overlay with nothing behind it.
- `SettingsNav` also carries a **search field**, shared by both shapes. It matches the section
  **subtitle as well as the label**, because the rows no longer show the subtitle: without it,
  "keyboard" misses Shortcuts and "bug" misses Get help, and the search silently fails on the words
  the copy is actually written in. It is presentational — query and handler belong to `SettingsNav`,
  which owns the filtered list. An empty result renders the message *instead of* the group card,
  because an empty raised card is a hairline box with no content and reads as a broken layout.
- **No `Text` may rely on an inherited colour — every one carries an explicit `theme.*`.** `SettingsRow` styled its label `[styles.rowLabel, tone === 'accent' && {…}, tone === 'muted' && {…}]`, and since `tone` defaults to `'default'` **neither branch fired**: no colour at all, so the label inherited the DOM's black. Invisible on Dark and OLED, correct on Light, and invisible to a grep because every row that *passes* a `tone` looks right. **An override chain needs an unconditional base.**
- **`TopHeader` is the main column's only top bar.** It carries the `SIMPLICITY` wordmark, the greeting as a subtitle on Overview, and the per-screen controls — so the Notes screen's "New" and list-collapse buttons live here. Notes used to draw its *own* header underneath, which meant two headers of two heights and a 64px empty strip on any screen that had nothing to put in it. `NotesView` now renders only the pane, and `HomeScreen` owns `notesListCollapsed` because the control is in the header.
- **A mark painted in the accent can be *absent*, and that is not a subtler accent.**
  `CapsuleSwitcher` draws its icons with `theme.accent`, and the selected tab's icon sits
  on `selectedFill` — so `White` is `#ffffff` on `#f5f5f5` and `Black` is `#000000` on
  `#000000`. The glyph is simply not there, and the hole it leaves reads as an
  *alignment* fault rather than a colour one, which is why measuring the boxes says
  everything is fine. It is a **mirror pair**: `White` kills the *selected* tab on
  `Dark` / `OLED` and the *unselected* tabs on `Light` / `B&W`, so fixing one leaves two
  of three icons gone.
- **`accentOn(accent, on, fallback)` is how a mark resolves, and its floor is 1.5, not
  3.** It catches a mark sitting on its own ground (~1.0) and nothing else. WCAG's 3:1
  for non-text content answers a *different* question — "can this graphic be identified?"
  — and applying it here rejected coral on the white pill at 2.86:1, the app's default
  selected tab, silently recolouring it to the label's ink. Only "is this present at all?"
  justifies overriding the user's accent, so only that fires. The fallback is an ink
  already proven against the same fill (`selectedText` on the pill, `textMuted` on the
  dock), never a third invented colour. **Ruled out: a per-theme "if White, use ink"
  special case** — the four-way conditional this file keeps rejecting, and it would need
  re-deriving for every future accent.
- **The create button's menu has three shapes, and one of them breaks a rule.**
  `fabVariant` is a persisted preference: icon-and-text (the default), text-only,
  icon-only. Icon-only is the one mode whose rows cannot say what they do, so it carries
  a **"Create" heading** naming the group — the "one idea per screen" contract restored
  at the only place it is broken. Every row keeps its `accessibilityLabel` in all three
  modes, since an unlabelled glyph set is the *silent* form of the "looks real and does
  nothing" failure. The default is the mode that names every action, and an unknown stored
  value falls back to it rather than to whichever name is listed first.
- **The bar is three columns — nav, wordmark, actions — and the outer two take equal flex.** That is what makes the wordmark *actually* centred: centring it in whatever space is left over looks centred only while the two sides happen to be the same width, and they stop matching the moment a back button appears. It does not repeat the screen's name, because the brand is the bar's one job and every screen already says what it is in its own heading.
- **Below the tablet breakpoint the Notes screen shows one pane at a time**, not a small
  split: the notebook fills the screen, tapping a note slides its typing space in over it,
  and a horizontal swipe either way goes back. The split is a desktop affordance — a 280px
  list beside the editor left the typing space about 110px wide on a phone. The two panes
  are `position: absolute` and one screen wide, sliding on `translateX`; they are **not**
  width-animated flex children, because that reflows the editor's text on every frame of
  the transition, and a typing surface that moves under the caret is exactly what the
  desktop list-collapse is careful to avoid. The offset is measured from `onLayout`, not a
  percentage transform — percentages in a transform are not dependable across the native
  and web renderers, and a pane that slides by the wrong amount parks itself half on
  screen. `HomeScreen` owns `notesEditorOpen` because the header's back chevron is the
  control that ends the drill-down, and a swipe with no visible handle is undiscoverable —
  the same reasoning as `settingsRef.goBack()` and Settings' swipe dots. The
  list-collapse chevron is desktop-only: there is nothing to collapse when the panes never
  share the screen. Reaching Notes from the dock or a folder opens the notebook; opening a
  note from a dashboard card opens the note.
- **The header's icon buttons are bare glyphs — no fill, no border.** They were `theme.surface` with a `theme.border` outline, which put a raised grey chip behind each one: heavier than the wordmark beside it, and on Settings a lone chip on the left balanced a centred title against an empty right-hand side. The 44px box stays — that is the tap target, and it is what makes the button comfortable to hit on a phone. Only the paint was wrong, not the control.
- **The three-dot page menu lives in the header's actions column, and its rows are per-screen.** One
  rule, not four bespoke lists: **the menu offers what you can create on the page you are on** — Notes
  is about notes so it offers a note, the Agenda is a calendar so it offers an event, Overview and
  Settings take both. `HomeScreen` builds the rows (`pageMenuActions`) because it owns the stores and
  the navigation; `TopHeader` only draws the button and the menu.
  - **It replaced a search button that had no `onPress` at all.** It rendered on every screen at
    phone width (`isMobile && !onNewNote`) and did nothing — the "looks real and does nothing is worse
    than its absence" failure, in the app's own top bar.
  - **Settings is where it earns its place.** Settings *hides* the FAB, because a create button over
    a preferences surface can only take you off the thing you just opened. That left Settings with no
    way to create anything, and this puts one back.
  - **"New task" is deliberately absent** from every menu. The FAB's version only *navigates*, so a
    row labelled "New task" that then created nothing would be the exact bug this replaced. Add it
    when `useTaskStore` exists, not before.
  - **The menu anchors by measuring its own button** (`measureInWindow` through the `AnimatedPressable`
    ref), not from the press event: RNW's synthetic event has no `locationX`, the same gap that made
    the Agenda's tap-to-create fail.
- **The mobile settings list has leading icons** (`SETTINGS_NAV[x].iconName`, previously used only by the wide rail). They sit outside `SettingsRow`'s `control` slot — that slot is right-aligned and reserved for the value or chevron, and a leading glyph has to lead — and the row divider moves onto the wrapper so it runs the full width of the card, under the icon as well as the text. The rows carry **no description**: five subtitles stacked read as a paragraph to parse before choosing, and the section you open says what it is anyway. The subtitle stays in the row's accessibility label so it is still announced.
- The sidebar footer is **one 64px row**: a gear button and a single icon that cycles the themes. A full picker there is a lot of chrome for a preference most people change twice a year, and it squeezed its own labels; the full picker lives in Settings. `THEME_ICON` is keyed by `ThemeName`, so the compiler refuses a theme with no glyph.
- Settings follows a desktop-preferences shape: page title + one-line subtitle, then labelled groups of rows, each row's control pushed right. **Structure only — do not copy components from a reference UI.** A card per *heading* was tried first and read as a wall of identical slabs; a card holding one title and one control is mostly padding.
- **A group is a card; a row is not.** The group sits in a raised `surface` container with a
  border, and its rows are separated by hairlines *inside* it. Rows laid straight on the
  canvas read as one undifferentiated list however many groups there are — the eye has to
  parse the text to find where a group ends. Lifting the block gives hierarchy from
  placement, which is cheaper than adding more dividers. Its radius is `Radius.card` (16), not
  `Radius.lg`: at 12px the corners read as almost square next to the 44px controls inside, and
  16 is the top of the scale short of a pill. This is the one place the app
  deliberately uses a card, and the distinction from the rejected "card per heading" is the
  whole point.
- **Everything inside a group is on a surface, so it takes `surfaceTheme(theme)` ink** —
  the rows, `ValueRow`'s value, `SelectRow`'s control, and `ToggleSwitch`'s off states. Two
  of these silently vanish otherwise: `SelectRow` filled its control with `theme.surface`
  (now the *group's* fill, so the control disappeared into the card — it takes `ink.pillBg`),
  and a toggle's off-track painted with `theme.border` put a light-grey bar on a dark card,
  louder than the row it sits in.
- Settings rows are 56px because they carry a description line; the 48px contract covers the toggle on its own.
- `SelectRow` reuses the shared `ContextMenu` rather than building a popover — it already clamps to the window and escapes ancestor `overflow`. It anchors from the **press event's window coordinates**, not from `measureInWindow` on the trigger: a measurement there returned nothing usable and the menu came back pinned to the window's left margin, and a wrong anchor is worse than an approximate one. `align="right"` lines the menu up with the control, not the row.
- `ContextMenuAction.selected` renders a **radio dot** (hollow ring, filled when chosen) and drops the row's icon. It used to render the icon *and* a trailing check, which was two indicators for one bit of state and read as "not selected but checked".
- `ToggleSwitch` is a plain knob switch. A labelled variant (`Enabled` / `Disabled` inside the track) was added and then reverted: at 64px wide it crowded the row's text, and the label only ever restated the knob position.
- `PrefsRepository` (table `prefs`, key/value) mirrors the `NoteRepository` two-backend split: SQLite on native, `localStorage` on web. Unlike `NoteRepository` it keeps **no in-memory mirror** — the bag is a few keys read once at launch, and a cache there is a stale-state bug the moment a second instance or tab writes.
- `usePrefsStore` owns `themeName` + `accent` + `layout` (visibility) + `order` (sequence), and a `ready` latch. `HomeScreen` subscribes to it; **there is no local `themeName` `useState` any more.**
- **Visibility and order are separate settings.** A stored order that is missing a section has it *appended*, and unknown or duplicated ids are dropped — a section added in a later release must appear, not silently vanish from the dashboard.
- Malformed stored values fall back to defaults rather than throwing — a corrupt `localStorage` entry must never block the app from opening.

## Persistence
- `useDebouncedPersist` debounces writes 400ms and flushes on unmount, on note switch, and on `AppState` `background` / `inactive`. Never call `updateNote` directly from a keystroke handler.
- Local SQLite is the only source of truth. **Supabase is not integrated** — no client, no env vars, no sync. The `uuid` and `is_synced` columns are unused scaffolding.
- **Theme and Overview layout are persisted** (via `usePrefsStore`). `selectedFolderId` still is not, so it resets every launch.
- **Events are persisted** too — `events` table, `EventRepository`, `useEventStore`. Tasks are not: they are still `useState` in `HomeScreen` and are lost on reload.

## Markdown Editor
- `src/components/notes/Editor.tsx` is **one `MarkdownTextInput` for the whole note**, from `@expensify/react-native-live-markdown` (Software Mansion + Expensify). It is a drop-in `TextInput` that owns text rendering, so it can style markdown *per token* while the caret, word wrap, selection and line-merge stay 100% native. There is **no preview toggle** — do not add one back.
- **The scratch pad uses the same engine**, so `**bold**` renders as you type there too. It previously carried its own preview toggle backed by `react-native-markdown-display` — a second markdown engine for one small field, and formatting that was invisible until you went looking for it. One engine, two call sites.
- `MarkdownLabel` (shared) renders markdown as *static inline text* — used by the task list, so a task written as `**hey**` shows as **hey**. It reuses `parseMarkdownRanges` rather than `react-native-markdown-display` (a block renderer, far too heavy for one row) and **drops `syntax` ranges** instead of dimming them, because a rendered label shows text and not its markers. It also **drops a range that strictly contains a shorter one**: the parser is built for the live editor where `# **head**` legitimately emits a heading range *and* a bold range inside it, and a flat render can only apply one.
- **Do not rebuild a block/line-splitting editor.** A stock `TextInput` carries a single text style, so a paragraph can never show one line rendered and the next raw. Two architectures were tried and reverted before this: blank-line blocks, then per-line inputs. Per-line shattered the caret, because separate inputs cannot share arrow focus, word-wrap or line merging.
- The parser is `parseMarkdownRanges` in `src/components/notes/markdownParser.ts` (pure, unit-tested in `__tests__/markdownParser.test.ts`). It returns character ranges; it **never rewrites the text**. Markers are dimmed in place, so offsets stay exact and clicks land where they look.
- The parser is a `'worklet'` — it runs on the UI thread on every keystroke. Therefore it must stay **self-contained** (no calls to ordinary module functions) and must not read module scope (hence the inlined 20k budget). Both constraints are invisible to Jest; violating them compiles, passes tests, then throws on device.
- Construct precedence: fences claim their body, then code spans, then links, then `~~`/`**`/`__`/`*`/`_`. Each construct emits its ranges and *then* claims its span — emitting after claiming makes a range collide with its own claim and vanish.
- **A list marker must be followed by whitespace.** The bullet branch used `[-*+]` with nothing after it, so any line opening `*emphasis*` or `**bold**` matched the *bullet* branch and emitted a stray marker range at offset 0.
- **A rejected inline match re-scans from one character later.** The engine's next match after a rejected candidate started past it, and a rejected candidate is usually the *closing* marker of an already-claimed construct paired with the *opening* marker of the next one — `**bold** *em*` made the italic pass match the `*`·space·`*` spanning the gap, and the characters it consumed meant the real `*em*` was never offered at all. Resuming at `start + 1` reaches what the user typed. Safe from a livelock: a match beginning at `start` cannot be produced again.
- Styling is `liveMarkdownStyle(theme)` in `utils.ts`. Every colour must come from a theme token; the editor gets no second colour vocabulary just because it styles per token. The library scales headings by **size only**, so only `h1` can differ from body.
- The input's own `color` **must** be set to `theme.text`. It has no default: unset means the browser's black, which is invisible on the Dark and OLED canvases. That is not a styling preference, it is a legibility bug.
- `theme.syntaxDim` dims raw markers to `SYNTAX_DIM_MIX` (50%) of `textMuted` over the canvas. The library exposes `syntax` as a **color only** — no width, no size, no replace — and `parser` never sees the selection, so markers can be dimmed but never collapsed or revealed near the caret. Do not set it to 0%: hidden markers still occupy width, so they leave a gap that reads worse than a faint marker.
- `html-entities` is pinned to exactly `2.5.3` and `expensify-common` must be present: the package statically re-exports `parseExpensiMark`, so both load even though we pass our own parser. `react-native-worklets` stays at Expo's `0.10.1`; the library's peer range (`>=0.7.0`) is satisfied, and its README matrix only tests `0.10.2+`.
- Persistence is unchanged: the editor still calls `onContentChange` per keystroke and `HomeScreen` debounces. Never call `updateNote` from the editor.

## Reading a design request
Rules that come from getting them wrong, not from theory. Each cost a correction here.

- **A UI request names a *visual*, not an element.** "Weight", "shadow", "grey box" and "the
  thing behind the button" are all descriptions of how something *looks*. Search the rendering,
  not the source text — `grep -i weight` finds nothing when the complaint is about a
  `theme.surface` fill. Read the request as "remove the paint", not "remove the thing".
- **Removing a fill is not removing a control.** They look identical in a sentence and are not
  identical in code: the box *is* the tap target. Strip `backgroundColor` / `borderWidth` /
  `boxShadow` and keep the size. Check what the element does before deleting it — a header
  control may be the only exit from a screen.
- **When a correction arrives, revert the whole wrong branch before starting the new one.** A
  misread that gets "fixed" locally propagates: here one bad reading turned into a deleted
  button, then a new exit row, a new prop and a changed swipe behaviour — four changes, all
  consequences of the first mistake, and all wrong. Unwind to a clean state, then re-read.
- **Ask when the referent genuinely cannot be located — but look first.** Searching the code,
  the reference and every breakpoint is not the same as looking at the screen. Ask at most once;
  if the answer does not resolve it, say what you found and propose candidates rather than
  guessing at a deletion.
- **Cognitive load is a design constraint, not a preference.** Stacked secondary text under a
  list of destinations is a paragraph to parse before choosing. Prefer the minimum that
  carries meaning, and keep the detail where it is needed (as the destination's own heading)
  rather than everywhere at once.

## Roadmap — the editor's real end state
**CodeMirror 6 in a `react-native-webview` is the main long-term goal** for the note editor,
deferred rather than rejected. It is the only engine that *replaces* marker ranges with
zero-width widgets, which is what true Obsidian Live Preview needs: no gap where a hidden `**`
used to be, and markers revealed near the caret. Two things must exist first:

1. **A device test setup.** `react-native-webview` has no web build, so a WebView editor
   cannot be verified in the browser — the only place this app has ever run.
2. **A decision on the integration.** Either two paths (WebView on native, DOM mount on web)
   or an editor that ships unrendered on the platform that matters.

Until then `@expensify/react-native-live-markdown` is the engine. Reassess when both
conditions are met. Reasoning: `Agent thoughts.md`.

## Context Menu
- Trigger: `onContextMenu` (web) + `onLongPress` (native), using real event coordinates.
- Menu state lives in `Sidebar` / `NotesView` / `NotesCardRow` / `SettingsScreen` local state.
- `ContextMenuAction` has a `selected` flag for single-choice menus and a `disabled` flag for
  non-activatable rows; `align="right"` lines the menu up with the right edge of its trigger.
- **Keyboard**: the menu carries `accessibilityRole="menu"`, rows are `menuitem` / `menuitemradio`,
  and on web a `document` keydown listener handles `Escape` (dismiss) and `ArrowUp` / `ArrowDown` /
  `Home` / `End` (roving focus). The listener is on `document` rather than the menu because the
  menu lives in a `Modal`, so focus may be on the trigger or the body and a subtree-only listener
  would miss Escape. Every listener is torn down on close and on unmount.
- **The root folder (`main`)** offers only **New Note** and **New Sub-folder**. Other folders add Rename / Move to… / Duplicate / Delete Folder (6 total). `FolderRepository` refuses rename, move, duplicate, and delete on the root — the UI mirrors that guard rather than relying on it.
- Notes offer Rename (inline on the card) / Move to folder / Duplicate / Copy content / Delete.
- Modals use the iPad-mini form factor: `min(90% width, 540)` × `min(80% height, 680)`, radius 16.

## Container Scroll Redirection
`src/hooks/useContainerScroll.ts` redirects input into a scroll container while the pointer is
inside it, and returns a **callback ref** for the `ScrollView`.

- **The ref is a callback, and that is load-bearing.** A plain ref plus an effect has two silent
  failure modes: an effect does not re-run when the element it measured *mounts later* (both the
  note row and the task list render their `ScrollView` conditionally), and resolving the node inside
  the effect makes a null in that instant a permanent no-op. A ref callback runs on mount *and*
  unmount, so it is the only place the listener lifetime can be managed correctly.
- **No `mouseenter` gate.** A wheel event only reaches the element under the pointer anyway, so
  attaching to the node *is* the hover scope — and `mouseenter` only fires on a *transition into*
  the element, so a pointer already resting inside when the listener attached never armed the
  feature at all. That is why the note row appeared to do nothing until you scrolled sideways.
- `wheelDeltaFor` maps `deltaX + deltaY` for a horizontal container. An earlier version compared
  the two components to decide whether a gesture was "really" horizontal, and a genuine vertical
  swipe carries a little `deltaX`, so that comparison kept handing the gesture to the native
  scroller and the row only ever moved for sideways swipes.
- `nextScrollOffset` is the boundary rule: release when there is nothing to scroll, and release
  once the container is **already at** the boundary; otherwise move, **clamped** to the range. The
  version this replaced tested the whole delta against the range, so one notch of 300px from 420
  with a max of 556 was rejected outright and the row stopped 136px short *permanently* — the last
  card was unreachable however long you scrolled.
- Touch is redirected for a **horizontal** container only, mapping a vertical swipe to `scrollLeft`
  with the same boundary rule, and a clearly horizontal drag is left to the native scroller (taking
  it too would double-scroll). A second finger bails out: that is a pinch, not a scroll.
- Web only, and native momentum is never replaced — this adds a mapping, not a scroller.
- Both scrollers are real `ScrollView`s with `nestedScrollEnabled`. The task list used to be a
  plain `View` with `overflow: hidden`, which on native means anything past the 168px cap was
  unreachable. A horizontal `ScrollView` inside a vertical one also needs the flag on Android, or
  the row swallows vertical drags and the page cannot be scrolled past it.
- **Verified in a real browser** over the DevTools protocol: vertical wheel advances the row
  (`scrollLeft 0 → 120`), the page stays put while the row can move, the row reaches its exact end
  (`556 of 556`) without overshooting, the row stops cancelling the event there, the released
  gestures scroll the page to its own end, and hovering away leaves the row alone.

## Sidebar Search
- `SidebarSearch` is presentational: query, results and the selection handler all come from `HomeScreen`, which owns the notes and folders being searched.
- `Ctrl/⌘ K` focuses the field. The listener is on `document` (web only), not the sidebar, so the shortcut works while you are typing in the editor.
- While a query is active the nav and folder tree are replaced by the results — the field *is* the navigation until it is cleared. Escape or the close button clears it.
- Folders rank above notes: there are fewer of them and a folder is the broader target.
- **It searches only the notes currently loaded**, which are scoped to the active folder. A cross-folder search needs its own repository query in `useNoteStore`.

## Folder Tree
- `src/hooks/useFolderTree.ts` holds two **pure functions** — `buildFolderTree` and `flattenTree`. Despite the filename it contains no hook.
- The subtree walk for the delete cascade lives in exactly one place: `FolderRepository.collectSubtreeIds`, exported and shared with the store. Two byte-identical copies used to live in `useNoteStore` and `useFolderTree` (where it was dead). Do not reintroduce a second copy.
- Mutations live in `FolderRepository`: `moveFolder` refuses cycles, `duplicateFolder` deep-clones at the correct sibling depth, `softDeleteFolder` cascades the subtree and its notes.
- The root folder is seeded as `Main` on both storage backends.
- **Clicking a folder navigates to the Notes screen**, not just re-scopes the store. A folder row is a destination: staying on Overview made the click look dead, because nothing on screen changed even though the store quietly rescoped.

## Known Gaps
- **Web preview only, and now it has actually been rendered.** Headless Chrome against the dev server at 1400 / 744 / 540px: the sidebar, folder tree, Tasks card, section tabs and the bottom-card split are visually confirmed at all three widths. That pass found a real layout bug no type-check or test could (see **Flex on the bottom cards** under Design System). Still never run: Android, iOS, and the touch/wheel scroll redirection, which needs a real pointer or a real finger.
- **How to render it yourself** (worth repeating, it is cheap and it works): start the dev server, then
  `"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --no-sandbox --window-size=<W>,900 --virtual-time-budget=30000 --screenshot=/tmp/s.png http://localhost:8099/`.
  A screenshot is ground truth; `--dump-dom` is *not* — it captured a partially hydrated tree and
  silently omitted whole elements, which is how a missing style can look like a missing rule.
- **Chrome also speaks CDP, and Node 24 has a global `WebSocket`.** Launch with
  `--remote-debugging-port=9222`, read the page target from `http://127.0.0.1:9222/json`, and drive
  `Runtime.evaluate` / `Input.dispatchMouseEvent` to assert on real behaviour. Two bugs in the
  scroll redirection were found this way and neither was visible in a screenshot or a test.
- **Pre-warm the bundle before probing.** The dev bundle is ~8MB and takes 20–35s to build cold, so
  a browser launched straight after `expo start` probes an *empty document* and every assertion
  fails for a reason that has nothing to do with the code. `curl` the bundle first, then poll
  `document.body.innerText` for a known string until the app has actually mounted. This produced a
  confident, completely wrong "the app has no ARIA attributes at all" finding before it was caught.
- **The animation layer has never been seen moving** (revision 6). The bundle builds and every animation is
  type-checked, but nobody has watched them run. First things to check: the sidebar collapse (does
  the main column re-flow smoothly rather than jump), and the theme pill landing on the right
  segment.
- The live editor has **never been rendered at all** (revision 5). Its parser is unit-tested and the web bundle resolves, but the token styling, the dimmed markers, and native behaviour are unverified.
- Native builds need an **Expo dev client**, not Expo Go: `@expensify/react-native-live-markdown` ships native code. Web is unaffected.
- `deriveTitle` rescans the entire note on every keystroke (`HomeScreen.tsx`). Only the write is debounced.
- The parser is capped at 20k characters per keystroke; past that the note renders as plain text (still fully editable) rather than stalling the UI thread.
- `CalendarTimeline` is gone, and with it the percent `marginLeft` `@ts-ignore` it was recorded as
  having. So is the day timeline that replaced it — see `AGENTS.md` → Calendar for why the Agenda
  settled on a list.
- `isLoading` is a single global boolean shared across all 15 store actions and races on mount. `usePrefsStore.ready` is separate and does not feed it.
- Tasks are `useState` — lost on reload, and the FAB "New Task" action only navigates. **Events are not:** they have a table, a repository and a store, and the FAB's "New Event" creates a real one.
- **There is no Pin/Favourite on a note card's context menu.** It needs a `pinned` column, and
  `schema.ts` has no migration path — it is `CREATE TABLE IF NOT EXISTS`, so an existing database
  would not gain the column and every pinned read would fail. That is a schema-migration project,
  not a menu item; do not add the button without the migration behind it.
- Sidebar search covers only the active folder's notes (see **Sidebar Search**).
- No component or render tests, and no store tests. The defects fixed in revision 4 were gesture/prop-transition paths — exactly what a pure-logic suite cannot reach. The revision 6 motion work is in the same blind spot: nothing in Jest can see an animation. **The same applies to every web-interaction feature here** — the scroll-redirection hooks, the context menu's keyboard handling and the inline rename are all DOM paths that type-check but have never been run in a browser.
- `expo-modules-core` is an explicit devDependency to force hoisting for `jest-expo`. Do not remove it.

## Debloat — what is and is not removable
Measured against the dev-server web bundle (1132 modules, ~8.2 MB dev build). Recording
this because "the bundle is too big" invites the wrong deletions:
- **`react-native-markdown-display` (and therefore `markdown-it`, `punycode`, `linkify-it`,
  `uc.micro`, `mdurl`, `entities`) is NOT removable.** It looks like one preview toggle in
  `ScratchPadCard`, but `Editor.tsx` imports it for the note editor's **read mode** as well.
  Removing the scratch-pad import alone changes the module count by zero. Swap the editor's
  read mode to the live editor first, and the whole tree can go.
- **`react-native-reanimated` is the single largest item** and it is load-bearing — the entire
  motion layer runs on it. Do not trade it for a lighter animation library.
- The dead-code pass (duplicate subtree walks, the unused `subtreeIds`/`findNode` pair, 11 dead
  theme tokens, a dead `useState`, dead locals in the per-keystroke parser) moved the bundle by
  ~300 bytes. It was worth doing for correctness and reviewability, not for size — do not expect
  a similar pass to move the needle again.
- Real compile-time levers left are Metro resolver tuning (`disableHierarchicalLookup` and
  friends), which cannot be verified here because the app has never run on a device. Treat them
  as unverified until someone runs it on hardware.

## TODO
- **Tasks**: add a `tasks` table (`id`, `uuid`, `label`, `source_note`, `done`, `created_at`, `updated_at`, `is_deleted`), repository CRUD, and a `useTaskStore` mirroring the note store.
- **Decide on Supabase**: build the client, or drop the `uuid` / `is_synced` columns so the schema stops implying a feature that does not exist.

## Known Bundling Gotchas
- **Web: `wa-sqlite.wasm`.** `expo-sqlite/web/worker.ts` does `import './wa-sqlite/wa-sqlite.wasm'`, and the file **is** present in `node_modules` — Metro's `assetExts` just does not include `wasm`, so the import fails to resolve and the entire web bundle 500s. This blocks `npx expo start` on web as well as `npx expo export`, so the browser is *not* a usable verification path without a fix. `metro.config.js` adds `wasm` to `assetExts`; with it the web bundle builds (1132 modules, HTTP 200). Kept deliberately: a UI refactor nobody can load is not verifiable. Remove it once `expo-sqlite` drops the wasm import.
- Android: `punycode` (markdown-it dep)

## Known Narrow-Screen Concern
- The dock and `FloatingActionFab` are both `zIndex: 20` floating elements. The dock carries three tabs, so below ~375px it grows wide enough to reach the FAB; the FAB's 56×56 tap target still works and the dock's own targets are unaffected. Not a crash.
- The Notes list pane collapses to a 48px rail via a `chevron-double-left` button in its header, and re-opens from a rail button. The pane is `theme.background`, not `theme.surface`: a raised surface only reads as correct for a *card* on the canvas, and the list is a pane. It used `surface`, which painted a lighter slab that made the Notes screen look like a different app from the Overview.
- Chromium's default focus ring is suppressed and replaced with a `:focus-visible` ring drawn in `theme.accent` via the `--app-accent` custom property, which `HomeScreen` keeps in sync. The stock white outline ignored the theme and read as a rendering bug.
