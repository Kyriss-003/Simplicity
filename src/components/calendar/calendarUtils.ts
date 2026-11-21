import type { CalendarEvent, Event } from '../../types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const WEEKDAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 21;
export const DURATION_OPTIONS: readonly number[] = [15, 30, 60, 90, 120];
export const DEFAULT_DURATION_MINUTES = 60;
export const MINUTE_OPTIONS: readonly number[] = [0, 15, 30, 45];

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(date.getDate(), lastDay));
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  return addDays(day, -((day.getDay() + 6) % 7));
}

export function weekOf(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthGrid(anchor: Date): Date[][] {
  const gridStart = startOfWeek(startOfMonth(anchor));
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w += 1) {
    weeks.push(Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)));
  }
  return weeks;
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

export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function minutesFromMidnight(value: Date | string): number | null {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

export function withTime(day: Date, minutes: number): Date {
  const start = startOfDay(day);
  start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return start;
}

export function eventsOnDay(events: readonly Event[], day: Date): Event[] {
  const key = dateKey(day);
  return events
    .filter((ev) => {
      const start = new Date(ev.startsAt);
      return !Number.isNaN(start.getTime()) && dateKey(start) === key;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

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

export function dayHeadingLabel(date: Date): string {
  return `${WEEKDAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

export function monthYearLabel(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function hourOptions(): number[] {
  return Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => (DAY_START_HOUR + i) * 60);
}

export function minutesLabel(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = hours24 < 12 ? 'am' : 'pm';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return mins === 0 ? `${hours12} ${suffix}` : `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

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

export function durationLabel(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function weekdayShortLabel(date: Date): string {
  return WEEKDAY_SHORT[(date.getDay() + 6) % 7]!;
}

export function toCalendarEvent(ev: Event): CalendarEvent {
  const start = new Date(ev.startsAt);
  return {
    title: ev.title,
    time: timeLabel(start),
    slotIndex: 0,
    ...(ev.priority ? { priority: ev.priority } : {}),
    startsAt: ev.startsAt,
    pinned: ev.isPinned,
  };
}

export function selectUpcomingEvents(events: readonly CalendarEvent[], max = 4): CalendarEvent[] {
  const pinned = events.filter((e) => e.pinned);
  const rest = events.filter((e) => !e.pinned);
  return [...pinned, ...rest].slice(0, max);
}

export function upcomingOverflow(events: readonly CalendarEvent[], max = 4): number {
  return Math.max(0, events.length - max);
}
