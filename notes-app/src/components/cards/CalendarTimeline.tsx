import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../shared/Card';
import type { Theme } from '../../theme';

export interface CalendarEvent {
  title: string;
  time: string;
  slotIndex: number;
  color?: string;
}

/**
 * Fixed-height horizontal calendar strip with time slots and overlaid event
 * blocks. The body uses `position: 'relative'` so events can be absolutely
 * positioned by slot index.
 */
export function CalendarTimeline({
  theme,
  slots,
  events,
  compact = false,
}: {
  theme: Theme;
  slots: string[];
  events: CalendarEvent[];
  compact?: boolean;
}) {
  const slotCount = slots.length;
  const slotWidthPct = 100 / slotCount;
  const hasEvents = events.length > 0;

  return (
    <Card theme={theme} style={{ height: compact ? 88 : 112, padding: 0, overflow: 'hidden' }}>
      {/* slot header row */}
      <View style={[styles.calendarHeaderRow, { borderBottomColor: theme.border }]}>
        {slots.map((s) => (
          <Text key={s} style={[styles.calendarHeaderText, { color: theme.textMuted }]}>
            {s}
          </Text>
        ))}
      </View>

      {/* body with slot separators + event blocks */}
      <View style={styles.calendarBody}>
        {slots.map((_, idx) => (
          <View
            key={`sep-${idx}`}
            style={[
              styles.calendarSlot,
              idx > 0 && { borderLeftColor: theme.border },
              { flex: 1 },
            ]}
          />
        ))}

        {hasEvents ? (
          events.map((ev, idx) => (
            <View
              key={`ev-${idx}`}
              style={[
                styles.eventBlock,
                {
                  backgroundColor: theme.background,
                  borderColor: ev.color ?? theme.accent,
                  // @ts-ignore — RN Web supports percent string for marginLeft
                  marginLeft: `${(ev.slotIndex / slotCount) * 100}%`,
                  width: `${slotWidthPct}%`,
                },
              ]}
            >
              <View style={[styles.eventBar, { backgroundColor: ev.color ?? theme.accent }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={1}>
                  {ev.title}
                </Text>
                <Text style={[styles.eventSub, { color: theme.textMuted }]} numberOfLines={1}>
                  {ev.time}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCenter}>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No events for today.
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
  },
  calendarHeaderText: { fontSize: 11, flex: 1, textAlign: 'center' },
  calendarBody: { flexDirection: 'row', flex: 1, position: 'relative' },
  calendarSlot: { alignItems: 'center', borderLeftWidth: 0 },
  eventBlock: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    top: 8,
    overflow: 'hidden',
  },
  eventBar: { width: 3, height: 22, borderRadius: 2, flexShrink: 0 },
  eventTitle: { fontSize: 12, fontWeight: '700' },
  eventSub: { fontSize: 10, marginTop: 1 },
  emptyCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 12 },
});
