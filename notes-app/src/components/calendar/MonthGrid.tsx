import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from '../shared/motion';
import { Radius, Typography, type Theme } from '../../theme';
import type { Event, EventPriority } from '../../types';
import {
  WEEKDAY_SHORT,
  dateKey,
  isSameDay,
  isSameMonth,
  isToday,
  monthGrid,
} from './calendarUtils';

/** Cell height — 4pt grid. */
const CELL_HEIGHT = 64;
/** Dots under a day: enough to show "busy", few enough to stay a glance. */
const MAX_DOTS = 3;

/**
 * Six weeks of days, the body of the month picker.
 *
 * No card chrome of its own — the popover supplies the surface — so the same
 * grid can be dropped into a dialog later without a card inside a card.
 *
 * **Priority is shown as colour, not as a count.** A day with one urgent event
 * and a day with three unimportant ones look different here, which is the
 * entire reason the priority colours exist; a dot count would flatten them back
 * into the same "3 events" and tell you nothing about which day needs you.
 */
export function MonthGrid({
  theme,
  anchor,
  events,
  selected,
  onSelectDay,
  width,
}: {
  theme: Theme;
  /** Any date inside the month on display. */
  anchor: Date;
  events: readonly Event[];
  selected: Date;
  onSelectDay: (day: Date) => void;
  /** Explicit width from the popover, so the grid never has to measure itself. */
  width: number;
}) {
  const weeks = monthGrid(anchor);

  // One pass for the whole grid rather than 42 — this runs on every render of
  // a picker the user is about to open, and a `Date` per event per cell is 42
  // passes over the whole collection for one screen.
  const byDay = groupByDay(events);

  return (
    <View style={{ width }}>
      <View style={styles.headerRow}>
        {WEEKDAY_SHORT.map((day) => (
          <Text key={day} style={[styles.headerCell, { color: theme.textMuted }]}>
            {day}
          </Text>
        ))}
      </View>

      {weeks.map((week, w) => (
        <View key={`w-${w}`} style={[styles.week, { borderTopColor: theme.border }]}>
          {week.map((day) => {
            const dayEvents = byDay.get(dateKey(day)) ?? [];
            const inMonth = isSameMonth(day, anchor);
            const isSelected = isSameDay(day, selected);
            const today = isToday(day);

            return (
              <AnimatedPressable
                key={dateKey(day)}
                onPress={() => onSelectDay(day)}
                containerStyle={styles.cellContainer}
                style={[
                  styles.cell,
                  { borderLeftColor: theme.border },
                  isSelected && { backgroundColor: theme.pillBg },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${day.getDate()}, ${pluralise(dayEvents.length, 'event')}`}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    {
                      color: isSelected || today ? theme.accent : theme.text,
                      // A day from the neighbouring month is readable, not
                      // hidden: dimming is enough, and dropping the opacity to
                      // nothing would make the grid look like it has holes.
                      opacity: inMonth ? 1 : 0.45,
                    },
                  ]}
                >
                  {day.getDate()}
                </Text>
                <View style={styles.dots}>
                  {dayEvents.slice(0, MAX_DOTS).map((ev, i) => (
                    <View
                      key={ev.id ?? `${dateKey(day)}-${i}`}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: ev.priority
                            ? priorityColour(theme, ev.priority)
                            : theme.textMuted,
                        },
                      ]}
                    />
                  ))}
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * The colour for a priority level on the picker.
 *
 * `pillBg` is the *selected* day's fill, and it is one step off the canvas, so a
 * ramp chosen to clear AA on both `background` and `surface` is also correct on
 * it. Reading it from the canvas ramp rather than adding a third variant is what
 * keeps the family to two sets instead of three.
 */
export function priorityColour(theme: Theme, level: EventPriority): string {
  return theme.priority[level];
}

/** Events grouped by local day, each bucket in time order. */
function groupByDay(events: readonly Event[]): Map<string, Event[]> {
  const map = new Map<string, Event[]>();
  for (const ev of events) {
    const start = new Date(ev.startsAt);
    if (Number.isNaN(start.getTime())) continue;
    const key = dateKey(start);
    const bucket = map.get(key);
    if (bucket) bucket.push(ev);
    else map.set(key, [ev]);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }
  return map;
}

function pluralise(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', height: 32, alignItems: 'center' },
  headerCell: { ...Typography.app.caption, flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row', height: CELL_HEIGHT, borderTopWidth: 1 },
  cellContainer: { flex: 1, minWidth: 0 },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderRadius: Radius.md,
    gap: 2,
  },
  dayNumber: { ...Typography.app.bodyStrong },
  dots: { flexDirection: 'row', gap: 2, height: 5, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: Radius.full },
});
