import {
  selectUpcomingEvents,
  sortUpcoming,
  upcomingOverflow,
  UPCOMING_LIMIT,
} from '../src/components/cards/upcomingEvents';
import type { CalendarEvent } from '../src/types';

function ev(over: Partial<CalendarEvent> & { title: string }): CalendarEvent {
  return { time: '9 am', slotIndex: 0, ...over };
}

describe('sortUpcoming', () => {
  it('puts pinned events above everything else, however far out they are', () => {
    const sorted = sortUpcoming([
      ev({ title: 'Soon', startsAt: '2026-10-01T09:00:00Z' }),
      ev({ title: 'Pinned later', startsAt: '2027-01-01T09:00:00Z', pinned: true }),
    ]);
    expect(sorted.map((e) => e.title)).toEqual(['Pinned later', 'Soon']);
  });

  it('orders by start time', () => {
    const sorted = sortUpcoming([
      ev({ title: 'Third', startsAt: '2026-10-03T09:00:00Z' }),
      ev({ title: 'First', startsAt: '2026-10-01T09:00:00Z' }),
      ev({ title: 'Second', startsAt: '2026-10-02T09:00:00Z' }),
    ]);
    expect(sorted.map((e) => e.title)).toEqual(['First', 'Second', 'Third']);
  });

  it('keeps undated events after dated ones instead of dropping them', () => {
    const sorted = sortUpcoming([
      ev({ title: 'Undated A' }),
      ev({ title: 'Dated', startsAt: '2026-10-01T09:00:00Z' }),
      ev({ title: 'Undated B' }),
    ]);
    expect(sorted.map((e) => e.title)).toEqual(['Dated', 'Undated A', 'Undated B']);
  });

  it('treats an unparsable startsAt as undated', () => {
    const sorted = sortUpcoming([
      ev({ title: 'Garbage', startsAt: 'not a date' }),
      ev({ title: 'Real', startsAt: '2026-10-01T09:00:00Z' }),
    ]);
    expect(sorted.map((e) => e.title)).toEqual(['Real', 'Garbage']);
  });

  it('does not mutate the input', () => {
    const input = [
      ev({ title: 'B', startsAt: '2026-10-02T09:00:00Z' }),
      ev({ title: 'A', startsAt: '2026-10-01T09:00:00Z' }),
    ];
    sortUpcoming(input);
    expect(input.map((e) => e.title)).toEqual(['B', 'A']);
  });
});

describe('selectUpcomingEvents', () => {
  it('caps the list at the glance limit', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      ev({ title: `E${i}`, startsAt: `2026-10-${String(i + 1).padStart(2, '0')}T09:00:00Z` })
    );
    expect(selectUpcomingEvents(many)).toHaveLength(UPCOMING_LIMIT);
    expect(selectUpcomingEvents(many).map((e) => e.title)).toEqual(['E0', 'E1', 'E2', 'E3', 'E4']);
  });

  it('honours an explicit limit and treats a negative one as empty', () => {
    const many = Array.from({ length: 4 }, (_, i) => ev({ title: `E${i}` }));
    expect(selectUpcomingEvents(many, 2)).toHaveLength(2);
    expect(selectUpcomingEvents(many, -1)).toHaveLength(0);
  });
});

describe('upcomingOverflow', () => {
  it('counts only what the list is hiding', () => {
    const many = Array.from({ length: 8 }, (_, i) => ev({ title: `E${i}` }));
    expect(upcomingOverflow(many)).toBe(3);
    expect(upcomingOverflow(many, 10)).toBe(0);
    expect(upcomingOverflow([])).toBe(0);
  });
});

describe('priority is a colour, not an ordering', () => {
  it('leaves the list chronological even when an urgent event is later', () => {
    // The decision, pinned. The Overview card answers "what is next", so a
    // re-sort by urgency would make it answer a different question depending on
    // what happened to be important that week.
    const ordered = selectUpcomingEvents([
      { title: 'Later but urgent', time: '4 pm', slotIndex: 0, startsAt: '2026-09-30T16:00:00Z', priority: 'urgent' },
      { title: 'Sooner but trivial', time: '9 am', slotIndex: 0, startsAt: '2026-09-30T09:00:00Z', priority: 'low' },
    ]);
    expect(ordered.map((e) => e.title)).toEqual(['Sooner but trivial', 'Later but urgent']);
  });
});
