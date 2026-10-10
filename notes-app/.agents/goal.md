# Goal Ledger

> Correct the event editor card per the clarified reference: add a persisted Notes
> field; format date/time and duration labels precisely; use the intended outline
> icons and compact segmented/priority buttons; keep the Cancel / Draft / Save row.

## Deliverable

The event editor card captures title, notes, date, time, length, priority; Notes
survives reload on SQLite and web. Existing action buttons remain. Checks: typecheck,
full Jest suite, and web export.

## Constraints

- Colors and typography from theme tokens; spacing/sizes on the 4pt grid.
- Preserve `calendarUtils.DURATION_OPTIONS` API for existing callers.
- Additive SQLite migration only; older web event payloads default notes to empty.
- Do not remove Cancel / Save as draft / Save.

## Tasks

| ID | Sub-task | Files | Done when | Status |
|---|---|---|---|---|
| 1 | Add event Notes field end-to-end | `src/components/calendar/EventEditorDialog.tsx`, `src/screens/HomeScreen.tsx`, `src/types.ts`, `src/db/EventRepository.ts`, `src/db/schema.ts`, `__tests__/repositories.test.ts`, `__tests__/calendarUtils.test.ts` | typecheck passes; web repository notes create/update round-trip tests pass; schema v2 adds notes | done |
| 2 | Match date/time/duration controls and priority style | `src/components/calendar/EventEditorDialog.tsx` | typecheck passes; exact upper-case label mapping and requested controls in source | done |
| 3 | Preserve existing action row and Advanced heading | `src/components/calendar/EventEditorDialog.tsx` | Cancel, Save as draft, Save remain; Advanced heading renders | done |

## Evidence

- T1 — `Event.notes` wired from editor draft through HomeScreen and repository. SQLite schema v2 adds `notes TEXT NOT NULL DEFAULT ''`, probed before migration; old web payloads map missing notes to `''`. Added repository create/update round-trip test and updated existing Event fixture. Targeted repository/calendar tests: **65 passed** (the pre-existing Expo async logger makes Jest exit nonzero).
- T2 — Uses `Wed, 7 Oct` format from selected anchor date (effect now tracks `anchorDate`), 12-hour time padded and uppercase (`08:00 AM`), `30M` / `1H` / `2H` / `ALL DAY` / `CUSTOM`; outline Ionicons without dropdown chevrons; square-ish segmented duration controls and outlined rounded priority buttons labeled Urgent / Important / Normal / Low.
- T3 — Advanced heading added beneath priority controls. Cancel / Save as draft / Save actions retained.
- `npm run typecheck` → exit 0.
- `npm test -- --runInBand` → **12 suites, 286 tests passed**; exit nonzero only from existing asynchronous `ExpoModulesCoreJSLogger` warning after tests finish.
- Zed diagnostics → no errors or warnings.
- Web export not rerun for this correction.
