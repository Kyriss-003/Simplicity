import type { CalendarEvent } from '../../types';

/**
 * How many events the Overview's upcoming list shows. The list is a glance at
 * what is next, not a calendar — five rows is the point at which the block
 * stops being scannable and starts being a second Agenda screen.
 */
export const UPCOMING_LIMIT = 5;

/** Milliseconds, or `NaN` for an event with no usable `startsAt`. */
function startOf(ev: CalendarEvent): number {
  if (!ev.startsAt) return NaN;
  const t = Date.parse(ev.startsAt);
  return Number.isNaN(t) ? NaN : t;
}

/**
 * Orders events for the upcoming list: pinned first, then soonest, then
 * whatever is left in the order it arrived.
 *
 * Undated events sort *after* dated ones rather than being dropped. Nothing can
 * add an event yet — there is no `events` table — so a hand-built or seeded
 * event that never grew a `startsAt` would otherwise make the whole card look
 * broken when it is merely unscheduled. `sort` is stable in every runtime this
 * ships on, but the index tiebreak keeps the result identical regardless.
 */
export function sortUpcoming(events: readonly CalendarEvent[]): CalendarEvent[] {
  return events
    .map((ev, index) => ({ ev, index }))
    .sort((a, b) => {
      const aPinned = a.ev.pinned === true;
      const bPinned = b.ev.pinned === true;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;

      const at = startOf(a.ev);
      const bt = startOf(b.ev);
      const aDated = !Number.isNaN(at);
      const bDated = !Number.isNaN(bt);
      if (aDated && bDated && at !== bt) return at - bt;
      if (aDated !== bDated) return aDated ? -1 : 1;

      return a.index - b.index;
    })
    .map((entry) => entry.ev);
}

/**
 * The rows the card renders, in order. Everything the card needs about ordering
 * lives here so the gesture-free component above it only has to draw.
 */
export function selectUpcomingEvents(
  events: readonly CalendarEvent[],
  limit: number = UPCOMING_LIMIT
): CalendarEvent[] {
  return sortUpcoming(events).slice(0, Math.max(0, limit));
}

/**
 * How many events the list is hiding. Rendered as a count, never as a control:
 * the Agenda screen is the destination, and a row that only looks tappable is
 * the one thing worse than no row at all.
 */
export function upcomingOverflow(
  events: readonly CalendarEvent[],
  limit: number = UPCOMING_LIMIT
): number {
  return Math.max(0, events.length - Math.max(0, limit));
}
