import type { CalendarEvent, Event } from '../../types';

/**
 * Pure date helpers for the calendar.
 *
 * Everything here works in **local** time and every conversion goes through
 * `Date`, never through a string slice. The tempting one-liner —
 * `date.toISOString().slice(0, 10)` for a "YYYY-MM-DD" key — is a day-bug
 * generator: it converts to UTC first, so for anyone east or west of Greenwich
 * an evening event files itself under tomorrow (or yesterday), and the calendar
 * then paints an event on a day the user never put it on.
 *
 * The store keeps events in UTC ISO strings precisely so this module is the one
 * place the conversion happens.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Column order for the week strip. Weeks start on Monday. */
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** First hour the editor will schedule into. */
export const DAY_START_HOUR = 8;
/** Last hour it will schedule into — the rest of the day is not offered. */
export const DAY_END_HOUR = 21;

/**
 * The durations the editor offers, in minutes.
 *
 * A fixed list rather than a free number field: it is the same shape as the
 * thing it fills (a row whose right-hand column says "1 hr 30 min"), and it
 * needs no numeric keypad to reach a sensible answer.
 */
export const DURATION_OPTIONS: readonly number[] = [15, 30, 60, 90, 120];

/** The duration an event gets when nobody chooses one. */
export const DEFAULT_DURATION_MINUTES = 60;

// ---- Dates ------------------------------------------------------------

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Month arithmetic that cannot skip a month.
 *
 * `setMonth` on the 31st of a short month rolls **forward** — `addMonths` built
 * the naive way turns 31 January + 1 month into 3 March, quietly losing the
 * month that was asked for. Clamping to the 1st before moving, then back down to
 * the target month's length, is the whole fix.
 */
export function addMonths(date: Date, months: number): Date {
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), lastDay));
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * Six weeks of days covering `anchor`'s month, starting on a Monday.
 *
 * **Always six rows**, including for a month that fits in five. A grid that
 * shrank as you paged through would move everything below it — and a layout
 * change caused by the calendar's own contents is the one thing a date view must
 * never do. The empty sixth row is the price of a picker that holds still.
 */
export function monthGrid(anchor: Date): Date[][] {
  const gridStart = startOfWeek(startOfMonth(anchor));
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w += 1) {
    weeks.push(Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)));
  }
  return weeks;
}

/** Monday of `date`'s week. `getDay()` is Sunday-based, hence the `+ 6`. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  return addDays(day, -((day.getDay() + 6) % 7));
}

/** The seven days of `date`'s week, Monday first. */
export function weekOf(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Local `YYYY-MM-DD`, the key every day-indexed lookup uses. */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Minutes since local midnight, or `null` for an unparsable timestamp. */
export function minutesFromMidnight(value: Date | string): number | null {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Replaces the picked date and time on one `Date`, keeping it on the same day.
 *
 * Rebuilding rather than calling `setHours` avoids the 23:30 → 24:00 rollover,
 * where `setHours` silently advances the date by one and an event quietly moves
 * to tomorrow.
 */
export function withTime(day: Date, minutes: number): Date {
  const start = startOfDay(day);
  start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return start;
}

/**
 * Every event starting on `day`, soonest first.
 */
export function eventsOnDay(events: readonly Event[], day: Date): Event[] {
  const key = dateKey(day);
  return events
    .filter((ev) => {
      const start = new Date(ev.startsAt);
      return !Number.isNaN(start.getTime()) && dateKey(start) === key;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * The first hour of `day` with nothing on it, for "Add event".
 *
 * Scans the working day rather than using the wall clock, so the result is the
 * same whatever time it is when you press the button and does not depend on
 * having a notion of "now" at all. It runs to `DAY_END_HOUR` and then stops
 * offering rather than wrapping to tomorrow: the row says "add to this day", and
 * quietly putting the event on a different day is exactly the kind of thing this
 * app's design rules forbid.
 */
export function nextFreeSlot(day: Date, events: readonly Event[]): Date {
  const taken = new Set<number>();
  for (const ev of eventsOnDay(events, day)) {
    const minutes = minutesFromMidnight(ev.startsAt);
    if (minutes !== null) taken.add(minutes);
  }
  for (let hour = DAY_START_HOUR; hour <= DAY_END_HOUR; hour += 1) {
    if (!taken.has(hour * 60)) return withTime(day, hour * 60);
  }
  return withTime(day, DAY_END_HOUR * 60);
}

// ---- Labels -----------------------------------------------------------

/** "Thursday, 1 October" — the day list's heading. */
export function dayHeadingLabel(date: Date): string {
  return `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

/** "October 2026" — the month picker's heading. */
export function monthYearLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * "Thu, 1 Oct" — the editor's compact date field.
 *
 * Shorter than `dayHeadingLabel` on purpose: inside a dialog the weekday is not
 * what you are choosing, and the long form wrapped at phone width.
 */
export function compactDateLabel(date: Date): string {
  return `${WEEKDAY_SHORT[(date.getDay() + 6) % 7]}, ${date.getDate()} ${
    MONTH_NAMES[date.getMonth()]!.slice(0, 3)
  }`;
}

/**
 * Every hour the editor offers, in minutes since midnight.
 *
 * This started as a chip row and became the hour wheel. The chips fixed a real
 * bug — a half-hour dropdown across the working day is 27 rows, about 1300px,
 * taller than any phone, so `ContextMenu` clamped it and the afternoon was
 * silently unreachable — but fourteen hour chips and two minute chips is a wall
 * of small targets, and choosing a time is a matter of sliding along a
 * dimension. See `TimeWheel`.
 */
export function hourOptions(): number[] {
  return Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => (DAY_START_HOUR + i) * 60);
}

/**
 * The minute marks the wheel offers, in quarter hours.
 *
 * Half hours were not enough once the minutes moved onto a wheel: a dial whose
 * steps are 30 minutes is too coarse to land on a quarter-hour start, and 15 is
 * the shortest length `DURATION_OPTIONS` offers — a duration you can choose that
 * produces a start time you cannot is not a coherent pair.
 */
export const MINUTE_OPTIONS: readonly number[] = [0, 15, 30, 45];

/** Minutes-since-midnight → "9 am", "12:30 pm". */
export function minutesLabel(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = hours24 < 12 ? 'am' : 'pm';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return mins === 0 ? `${hours12} ${suffix}` : `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/**
 * Minutes-since-midnight → "9:00 am".
 *
 * The list shows this rather than `minutesLabel` because the row already states
 * the duration on the right: "9 am … 30 min" leaves you doing the arithmetic to
 * find the end time, while "9:00 am … 30 min" is a column of clock times you can
 * scan. Consistent width is what makes it scannable.
 */
export function timePreciseLabel(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = hours24 < 12 ? 'am' : 'pm';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

export function timeLabel(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return minutesLabel(minutesFromMidnight(date) ?? 0);
}

/** "30 min", "1 hr", "1 hr 30 min" — what the row's right-hand column carries. */
export function durationLabel(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** The weekday abbreviation for a column in the week strip. */
export function weekdayShortLabel(date: Date): string {
  // `getDay()` is Sunday-based and `WEEKDAY_SHORT` is Monday-based.
  return WEEKDAY_SHORT[(date.getDay() + 6) % 7]!;
}

// ---- View models ------------------------------------------------------

/**
 * The Overview's upcoming list reads `CalendarEvent`, which is a *display*
 * shape: a pre-formatted `time` label and a slot index the deleted timeline
 * needed. Keeping the conversion here means the store never has to know about
 * either — and the two optional fields let an event without a colour or a pin
 * stay absent from the object rather than being written as `undefined`.
 */
export function toCalendarEvent(ev: Event): CalendarEvent {
  const start = new Date(ev.startsAt);
  return {
    title: ev.title,
    time: timeLabel(start),
    slotIndex: 0,
    // Key absent when the event has no priority, so the Overview's bar falls
    // through to the accent rather than painting an unflagged event a colour.
    ...(ev.priority ? { priority: ev.priority } : {}),
    startsAt: ev.startsAt,
    pinned: ev.isPinned,
  };
}
