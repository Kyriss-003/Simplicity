# Goal — Hybrid AST Block-Level Live Preview (metric locking, cross-block caret)

**Objective:** one `multiline` input per AST block (never per line), with the active input
adopting the exact box model of the block type it represents, and native caret navigation
extended across block boundaries.

**Deliverable:** AST parser + pure helpers in `src/components/shared/utils.ts`, rewired
`src/components/notes/Editor.tsx`, tests in `__tests__/utils.test.ts`, updated `AGENTS.md`.

**Constraints (`AGENTS.md`):** components stay presentational · `theme.*` / `Radius.*` only ·
type 24/18/14/12 × 400/600 · 4pt grid · helpers pure + unit-tested in `utils.ts` · no
preview toggle · no new dependencies · `tsc --noEmit` + `npx jest` green.

**Non-goals:** per-character dimming of syntax markers (impossible in a `TextInput` — see
`Rejected` below) · heading de-list on backspace · platform-divergent web-only overlay.

## Rejected (with reason)
- **Per-line units (shipped last turn, now reverted).** One input per line shatters caret
  navigation: no shared arrow focus, no backspace line-merge, and the caret visually jumps
  when the value round-trips to a different buffer.
- **Dimmed syntax markers inside the active input.** A `TextInput` carries one text style;
  on web it is a `<textarea>` and cannot hold styled spans. Trimming markers from the value
  would break the 1:1 character-offset contract that keeps click targets accurate.
- **Enter splitting into a new AST block.** Would make a 2-line paragraph impossible. Enter
  stays a native soft break inside the block's multiline input; a blank line starts a block.

## Ledger

| ID | Sub-task | Files | Done when | Status |
|----|----------|-------|-----------|--------|
| G1 | `parseBlocks` AST: heading (depth) / paragraph / list / code (fence), line-walk offsets | `utils.ts` | Every block satisfies `content.slice(start,end)===text`; fence stays whole; regex-special lines exact | done |
| G2 | `activeBlockStyle(md, block)` — the md style key each kind renders with | `utils.ts` | Returns `md.headingN` / `md.code_block` / list+body / `md.body`; unit-tested per kind | done |
| G3 | `mergeWithPrevious(blocks, index, content)` — pure, returns new content + caret | `utils.ts` | Merges only equal-kind paragraph/list; result parses back to ONE block at `index-1`; null otherwise | done |
| G4 | Editor: block-level swap, shared `View gutter > child` box on both paths | `Editor.tsx` | Both paths spread `styles.block` on the wrapper and the kind style on the child | done |
| G5 | Cross-block keys: `ArrowUp`@0 / `ArrowDown`@end / `Backspace`@0 | `Editor.tsx` | Keys fire only at the buffer edge; intra-block keys are untouched | done |
| G6 | Programmatic caret placement via a stable `selection` state object | `Editor.tsx` | Object identity is stable while pending (never a fresh literal in render) or RNW pins the caret | done |
| G7 | Tests: rewrite segmentation suite; add style + merge coverage | `__tests__/utils.test.ts` | `npx jest` green, count ≥ previous 49 | done (59) |
| G8 | `AGENTS.md` editor contract matches the code | `AGENTS.md` | Grep `splitMarkdownUnits\|MdUnit` → 0; test count correct | done |
| G9 | Project gates | — | `npx tsc --noEmit` exit 0 · `npx jest` 0 failing · 0 editor diagnostics | done |
| G10 | Visual confirmation in the web preview | — | User verifies arrows across blocks, backspace-merge, heading metric lock | **awaiting user** |

## Evidence

- **G1** — 11 `parseBlocks` cases. Tests caught a real bug: the fence branch cleared
  `fence` *before* `close()`, so a closed fence reported `fence: null`. Fixed by letting
  `close()` own the reset.
- **G3** — `mergeWithPrevious` caught a second real bug: `editableBlock` spread
  `...block` without overriding `end`, so a middle block reported its own end while
  carrying text sliced to the next block's start — the `slice(start,end)===text`
  invariant failed. Fixed with an explicit `end`.
- Two further failures were my own stale expectations carried over from the per-line suite
  (`start === 6`) and a missing `{ tight: true }` in the style test; corrected against the
  design, not to make code pass.
- **G6** — verified `react-native-web/dist/exports/TextInput/index.js:314` applies
  `selection` in `useLayoutEffect` keyed on prop identity, and `:305` writes the DOM's
  real selection back into `prevSelection` on every change, so a held object does not
  fight typing. Hence a state object, never a render-time literal.
- **G7/G9** — `npx tsc --noEmit` exit 0 · `npx jest` → 3 suites, **59 passed / 0 failed**.
  Diagnostics clean on `Editor.tsx`, `utils.ts`, `utils.test.ts`.
  `grep -rn "splitMarkdownUnits|unitIndexAt|editableUnit|MdUnit" src/ __tests__/` → 0.
  `grep -rn "fontSize" src/ --include=*.tsx` → 0.
- **G10 (open)** — needs the user's browser check, not yet observed.

---

# Bug-fix pass (appended)

Audit of the whole tree, then reasoning on every candidate. Each fix below was
confirmed against the actual code path before being changed.

| ID | Bug | Root cause | Done when | Status |
|----|-----|-----------|-----------|--------|
| B1 | Tapping another block flashes the whole document and tears down the input | Press-*down* blurs before the press completes, so `focused=false` decorated every block and unmounted the input mid-gesture | `onBlur` collapses after a grace period that `focusBlock`/`onFocus` cancel; timer cleared on unmount | done |
| B2 | Opening a second note inherits the first note's caret, imposed selection and focus, aiming the new input at the old document's offsets | Editor state is component-local and was never reset on `note.id` change | Render-phase reset (no committed stale frame); `focusBlock` cancels any pending blur collapse | done |
| B3 | Two tasks added in the same millisecond collide: duplicate list keys, one tap toggles both | `addTask` used `Date.now()` as the id | Monotonic `useRef` counter | done |
| B4 | Right-click on a folder row also navigates to it | — | **Not a bug.** RNW binds `onPress` to the native `click` event (`PressResponder.js:303`), which right-click does not fire; `onContextMenu` is a separate path | closed, no change |

## Evidence — bug-fix pass

- `npx tsc --noEmit` exit 0 · `npx jest` → 3 suites, **59 passed / 0 failed** (unchanged —
  none of the three fixes are reachable from a unit test; they are input/gesture paths).
- Diagnostics clean on `Editor.tsx` and `HomeScreen.tsx`.
- **Deliberately not changed** (acknowledged debt, not defects): `isLoading` as one global
  boolean racing on mount · tasks/events in `useState`, lost on reload · FAB "New Task" /
  "New Event" only navigate · `CalendarTimeline` percent `marginLeft` behind a `@ts-ignore` ·
  `deriveTitle` rescanning per keystroke · `findNode` exported but unused outside its test ·
  11 hardcoded `rgba()` shadows and one bare `borderRadius: 12` (design-system violations from
  the audit, not bugs).
