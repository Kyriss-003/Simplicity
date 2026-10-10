import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AnimatedPressable } from '../shared/motion';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import type { Event } from '../../types';
import { eventsOnDay, isSameDay, isToday, weekOf, weekdayShortLabel } from './calendarUtils';

/** Each day is a 56px target: a comfortable thumb on a phone. */
const STRIP_HEIGHT = 56;

/**
 * Seven buttons — the days of the selected day’s week. Tap one and the list
 * below shows it.
 *
 * This is a *picker with one job*, and that is why it replaced a 42-cell month
 * grid: a month grid is a second calendar to interpret, it competes with the
 * list below it for attention, and it needs its own heading to say what it is.
 * A week is one row, obviously "pick a day", and it needs no explanation.
 *
 * Dots under a day mark that it has something on it, so the strip answers "which
 * days are busy" at a glance without you having to select each one.
 */
export function WeekStrip({
  theme,
  day,
  events,
  onSelectDay,
}: {
  theme: Theme;
  /** The selected day — the strip always shows this day's week. */
  day: Date;
  events: readonly Event[];
  onSelectDay: (day: Date) => void;
}) {
  const ink = surfaceTheme(theme);
  const days = weekOf(day);

  return (
    <View style={styles.strip}>
      {days.map((d) => {
        const selected = isSameDay(d, day);
        const today = isToday(d);
        const dayEvents = eventsOnDay(events, d);
        const count = dayEvents.length;

        /**
         * The dots take the colour of the day's **first** event's priority, so a
         * day holding something urgent looks different from a day holding three
         * unimportant things. A plain count could not tell you that, which is the
         * whole reason the priority colours exist.
         */
        const leadPriority = dayEvents[0]?.priority;
        // The strip is drawn on the canvas, so the base ramp is right for an
        // unselected cell; a selected one is filled with pillBg, one step off the
        // canvas and still inside the range the ramp is contrast-tested against.
        const ramp = selected ? ink.priority : theme.priority;
        const dotColour =
          (leadPriority && ramp[leadPriority]) || (selected || today ? theme.accent : ink.textMuted);

        return (
          <AnimatedPressable
            key={d.toDateString()}
            onPress={() => onSelectDay(d)}
            containerStyle={styles.slot}
            style={[styles.cell, selected && { backgroundColor: ink.pillBg }]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${weekdayShortLabel(d)} ${d.getDate()}, ${count} ${count === 1 ? 'event' : 'events'}`}
          >
            <Text style={[styles.weekday, { color: selected ? theme.accent : ink.textMuted }]}>
              {weekdayShortLabel(d)}
            </Text>
            <Text
              style={[
                styles.number,
                { color: selected ? theme.accent : ink.text },
                today && !selected && { color: theme.accent },
              ]}
            >
              {d.getDate()}
            </Text>
            <View style={styles.dots}>
              {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: dotColour }]} />
              ))}
            </View>
          </AnimatedPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: 4 },
  slot: { flex: 1, minWidth: 0 },
  cell: {
    height: STRIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    gap: 1,
  },
  weekday: { ...Typography.app.caption },
  number: { ...Typography.app.bodyStrong },
  dots: { flexDirection: 'row', gap: 2, height: 4, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: Radius.full },
});
