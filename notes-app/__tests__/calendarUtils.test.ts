import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  DURATION_OPTIONS,
  MINUTE_OPTIONS,
  addDays,
  addMonths,
  compactDateLabel,
  dateKey,
  dayHeadingLabel,
  daysInMonth,
  durationLabel,
  eventsOnDay,
  isSameDay,
  isSameMonth,
  isToday,
  minutesFromMidnight,
  minutesLabel,
  monthGrid,
  monthYearLabel,
  nextFreeSlot,
  startOfDay,
  startOfMonth,
  startOfWeek,
  timeLabel,
  hourOptions,
  timePreciseLabel,
  toCalendarEvent,
  weekOf,
  weekdayShortLabel,
  withTime,
} from '../src/components/calendar/calendarUtils';
import type { Event } from '../src/types';

/**
 * Every date here is built from *local* components (`new Date(2026, 8, 30)`)
 * rather than parsed from an ISO string, so these assertions describe the same
 * instant no matter what timezone the suite runs in. Parsing `'2026-09-30'` is
 * UTC midnight, which is a different day west of Greenwich — which is exactly
 * the bug `dateKey` documents and why it never calls `toISOString`.
 */

function ev(over: Partial<Event> = {}): Event {
  const at = over.startsAt ?? new Date(2026, 8, 30, 9, 0).toISOString();
  return {
    id: 1,
    uuid: 'e1',
    title: 'Event',
    notes: '',
    startsAt: at,
    durationMinutes: 60,
    isPinned: false,
    createdAt: at,
    updatedAt: at,
    isDeleted: false,
    ...over,
  };
}

const at = (h: number, m = 0, day = 30) => new Date(2026, 8, day, h, m).toISOString();

describe('date keys', () => {
  it('keys a date by its local calendar day', () => {
    expect(dateKey(new Date(2026, 8, 30, 23, 59))).toBe('2026-09-30');
  });

  it('zero-pads month and day', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('date arithmetic', () => {
  it('startOfDay strips the time', () => {
    const d = startOfDay(new Date(2026, 8, 30, 17, 45));
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(30);
  });

  it('addDays crosses month and year boundaries', () => {
    expect(dateKey(addDays(new Date(2026, 8, 30), 1))).toBe('2026-10-01');
    expect(dateKey(addDays(new Date(2026, 0, 1), -1))).toBe('2025-12-31');
  });

  /**
   * `setMonth` on the 31st of January rolls *forward* into March, which is why
   * nothing in the calendar steps by month any more — but the overflow this
   * guards against is still reachable through `new Date(y, m, 31)`, which is a
   * silent way to end up on the wrong day.
   */
  it('an out-of-range day rolls into the next month rather than erroring', () => {
    // September has 30 days, so the 31st is 1 October.
    expect(dateKey(new Date(2026, 8, 31))).toBe('2026-10-01');
  });

  it('startOfWeek lands on the Monday, whatever the day', () => {
    // 30 Sep 2026 is a Wednesday.
    expect(dateKey(startOfWeek(new Date(2026, 8, 30)))).toBe('2026-09-28');
    // A Sunday belongs to the week that started the previous Monday, not the next.
    expect(dateKey(startOfWeek(new Date(2026, 9, 4)))).toBe('2026-09-28');
    expect(startOfWeek(new Date(2026, 9, 4)).getDay()).toBe(1);
  });

  it('weekOf returns seven consecutive days from that Monday', () => {
    const week = weekOf(new Date(2026, 8, 30));
    expect(week).toHaveLength(7);
    expect(dateKey(week[0]!)).toBe('2026-09-28');
    for (let i = 1; i < week.length; i += 1) {
      expect(dateKey(week[i]!)).toBe(dateKey(addDays(week[i - 1]!, 1)));
    }
  });

  it('labels the week columns Monday-first', () => {
    expect(weekdayShortLabel(new Date(2026, 8, 28))).toBe('Mon');
    expect(weekdayShortLabel(new Date(2026, 9, 4))).toBe('Sun');
  });

  it('compares days', () => {
    expect(isSameDay(new Date(2026, 8, 30, 1), new Date(2026, 8, 30, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 8, 30), new Date(2026, 9, 1))).toBe(false);
    expect(isToday(new Date())).toBe(true);
  });
});

describe('labels', () => {
  it('formats the day heading', () => {
    expect(dayHeadingLabel(new Date(2026, 8, 30))).toBe('Wednesday, 30 September');
  });

  it('formats a 12-hour time with correct noon and midnight', () => {
    expect(minutesLabel(0)).toBe('12 am');
    expect(minutesLabel(9 * 60)).toBe('9 am');
    expect(minutesLabel(12 * 60)).toBe('12 pm');
    expect(minutesLabel(13 * 60 + 30)).toBe('1:30 pm');
  });

  /**
   * The list row shows a *precise* time because the duration sits in the next
   * column: "9 am … 30 min" makes the reader do the arithmetic, "9:00 am … 30
   * min" does not.
   */
  it('always prints minutes in the precise form', () => {
    expect(timePreciseLabel(9 * 60)).toBe('9:00 am');
    expect(timePreciseLabel(9 * 60 + 5)).toBe('9:05 am');
    expect(timePreciseLabel(0)).toBe('12:00 am');
    expect(timePreciseLabel(13 * 60 + 45)).toBe('1:45 pm');
  });

  it('wraps a time outside the day rather than printing 25:00', () => {
    expect(minutesLabel(25 * 60)).toBe('1 am');
    // -30 is half an hour *before* midnight, so it wraps to 23:30.
    expect(minutesLabel(-30)).toBe('11:30 pm');
  });

  it('returns an empty label for an unparsable date', () => {
    expect(timeLabel('not a date')).toBe('');
    expect(minutesFromMidnight('not a date')).toBeNull();
  });

  it('formats durations the way the row states them', () => {
    expect(durationLabel(30)).toBe('30 min');
    expect(durationLabel(60)).toBe('1 hr');
    expect(durationLabel(90)).toBe('1 hr 30 min');
    expect(durationLabel(0)).toBe('0 min');
    expect(durationLabel(-5)).toBe('0 min');
  });
});

describe('eventsOnDay', () => {
  const day = new Date(2026, 8, 30, 0, 0);
  const events = [
    ev({ id: 1, title: 'Late', startsAt: at(17) }),
    ev({ id: 2, title: 'Early', startsAt: at(8) }),
    ev({ id: 3, title: 'Yesterday', startsAt: at(9, 0, 29) }),
  ];

  it('keeps only the requested day, in time order', () => {
    expect(eventsOnDay(events, day).map((e) => e.title)).toEqual(['Early', 'Late']);
  });

  it('matches on the local day, so a late event stays on its own date', () => {
    const lateNight = ev({ id: 4, startsAt: new Date(2026, 8, 30, 23, 30).toISOString() });
    expect(eventsOnDay([lateNight], day)).toHaveLength(1);
  });

  it('drops an event with an unparsable start', () => {
    expect(eventsOnDay([ev({ startsAt: 'nope' })], day)).toHaveLength(0);
  });
});

describe('nextFreeSlot', () => {
  const day = new Date(2026, 8, 30);

  it('offers the first working hour of an empty day', () => {
    const slot = nextFreeSlot(day, []);
    expect(slot.getHours()).toBe(DAY_START_HOUR);
    expect(slot.getMinutes()).toBe(0);
    expect(dateKey(slot)).toBe('2026-09-30');
  });

  it('skips an hour that is taken', () => {
    const slot = nextFreeSlot(day, [ev({ startsAt: at(8) })]);
    expect(slot.getHours()).toBe(9);
  });

  it('is unaffected by the wall clock — the same input gives the same hour', () => {
    const busy = [ev({ startsAt: at(8) }), ev({ id: 2, startsAt: at(9) })];
    const first = nextFreeSlot(day, busy).getHours();
    const second = nextFreeSlot(day, busy).getHours();
    expect(second).toBe(first);
    expect(first).toBe(10);
  });

  it('never wraps to another day — a full day still returns a slot on this one', () => {
    const full = Array.from({ length: 24 }, (_, h) => ev({ id: h, startsAt: at(h) }));
    const slot = nextFreeSlot(day, full);
    expect(dateKey(slot)).toBe('2026-09-30');
    expect(slot.getHours()).toBe(DAY_END_HOUR);
  });

  it('ignores events on other days', () => {
    const slot = nextFreeSlot(day, [ev({ startsAt: at(8, 0, 29) })]);
    expect(slot.getHours()).toBe(DAY_START_HOUR);
  });
});

describe('toCalendarEvent', () => {
  it('carries a display time, the sort key and the pin across', () => {
    const mapped = toCalendarEvent(
      ev({ startsAt: new Date(2026, 8, 30, 14, 0).toISOString(), isPinned: true })
    );
    expect(mapped.time).toBe('2 pm');
    expect(mapped.pinned).toBe(true);
    expect(mapped.startsAt).toBe(new Date(2026, 8, 30, 14, 0).toISOString());
  });

  it('omits priority entirely when the event has none', () => {
    expect('priority' in toCalendarEvent(ev())).toBe(false);
  });

  it('carries the priority through', () => {
    expect(toCalendarEvent(ev({ priority: 'urgent' })).priority).toBe('urgent');
  });
});

describe('month arithmetic', () => {
  /**
   * The bug this guards: `setMonth` on 31 January rolls **forward** into March,
   * so the obvious `addMonths` silently loses the month that was asked for.
   */
  it('clamps to the end of a short month instead of skipping it', () => {
    expect(dateKey(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
    expect(dateKey(addMonths(new Date(2024, 0, 31), 1))).toBe('2024-02-29');
  });

  it('keeps the day when the target month is long enough', () => {
    expect(dateKey(addMonths(new Date(2026, 0, 15), 1))).toBe('2026-02-15');
  });

  it('steps backwards without borrowing a day', () => {
    expect(dateKey(addMonths(new Date(2026, 2, 31), -1))).toBe('2026-02-28');
  });

  it('finds the first of the month and its length', () => {
    expect(dateKey(startOfMonth(new Date(2026, 1, 17)))).toBe('2026-02-01');
    expect(daysInMonth(new Date(2026, 1, 1))).toBe(28);
    expect(daysInMonth(new Date(2024, 1, 1))).toBe(29);
    expect(daysInMonth(new Date(2026, 0, 1))).toBe(31);
  });

  it('compares months', () => {
    expect(isSameMonth(new Date(2026, 8, 1), new Date(2026, 8, 30))).toBe(true);
    expect(isSameMonth(new Date(2026, 8, 30), new Date(2026, 9, 1))).toBe(false);
  });
});

describe('monthGrid', () => {
  const grid = monthGrid(new Date(2026, 8, 15));

  /**
   * Always six rows, including for a month that fits in five. A picker that
   * shrank as you paged through would move everything below it.
   */
  it('is always six weeks of seven days', () => {
    expect(grid).toHaveLength(6);
    for (const week of grid) expect(week).toHaveLength(7);
  });

  it('starts on a Monday and runs contiguously', () => {
    const flat = grid.flat();
    expect(flat[0]!.getDay()).toBe(1);
    for (let i = 1; i < flat.length; i += 1) {
      expect(dateKey(flat[i]!)).toBe(dateKey(addDays(flat[i - 1]!, 1)));
    }
  });

  it('contains the anchor day', () => {
    expect(grid.flat().some((d) => isSameDay(d, new Date(2026, 8, 15)))).toBe(true);
  });

  it('keeps six rows for a month that fits in five', () => {
    expect(monthGrid(new Date(2026, 9, 1))).toHaveLength(6);
  });

  it('spills into the neighbouring months where needed', () => {
    expect(monthGrid(new Date(2026, 8, 1)).flat().some((d) => !isSameMonth(d, new Date(2026, 8, 1)))).toBe(
      true
    );
  });
});

describe('editor fields', () => {
  const day = new Date(2026, 8, 30, 0, 0);

  /**
   * `setHours` on 23:30 rolls the date forward by a day, which would quietly
   * move an event to tomorrow. `withTime` rebuilds instead.
   */
  it('sets the time without ever moving to another day', () => {
    expect(dateKey(withTime(day, 0))).toBe('2026-09-30');
    expect(withTime(day, 0).getHours()).toBe(0);
    expect(withTime(day, 23 * 60 + 30).getHours()).toBe(23);
    expect(dateKey(withTime(day, 23 * 60 + 30))).toBe('2026-09-30');
  });

  /**
   * Hours, not a dropdown. A half-hour menu across the working day is 27 rows
   * and taller than a phone, so the late options would be clamped out of reach.
   */
  it('offers every hour in the working day, and nothing outside it', () => {
    const options = hourOptions();
    expect(options[0]).toBe(DAY_START_HOUR * 60);
    expect(options[options.length - 1]).toBe(DAY_END_HOUR * 60);
    expect(options).toHaveLength(DAY_END_HOUR - DAY_START_HOUR + 1);
    expect(options.every((m, i) => i === 0 || m - options[i - 1] === 60)).toBe(true);
  });

  it('offers quarter-hour minute marks for the wheel', () => {
    // Quarter hours, because 15 min is the shortest duration offered — a length
    // you can pick that produces a start you cannot is not a coherent pair.
    expect(MINUTE_OPTIONS).toEqual([0, 15, 30, 45]);
  });

  it('offers a short fixed list of durations', () => {
    expect(DURATION_OPTIONS).toEqual([15, 30, 60, 90, 120]);
  });

  it('labels the month, the day and the compact editor date', () => {
    expect(monthYearLabel(new Date(2026, 8, 1))).toBe('September 2026');
    expect(compactDateLabel(day)).toBe('Wed, 30 Sep');
  });
});
