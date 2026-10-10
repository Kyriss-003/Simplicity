import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '../shared/Card';
import { AnimatedPressable } from '../shared/motion';
import { ContextMenu, type ContextMenuAction } from '../shared/ContextMenu';
import { Radius, Typography, primaryTheme, surfaceTheme, type Theme } from '../../theme';
import { PRIORITY_LABELS, type Event } from '../../types';
import { durationLabel, minutesFromMidnight, timePreciseLabel } from './calendarUtils';

/** 48px row contract — every row here, the add row included. */
const ROW_HEIGHT = 48;
/** Fixed gutters so the times and durations form two scannable columns. */
const TIME_COLUMN = 72;
const DURATION_COLUMN = 64;
const FLAG_WIDTH = 12;

/** Shared shape for the web context-menu / native long-press anchor. */
interface AnchorEvent {
  preventDefault?: () => void;
  nativeEvent: { pageX: number; pageY: number };
}

/**
 * One day, as a list: time, title, length.
 *
 * **Every row opens the editor.** The list used to offer inline rename as the
 * only edit, which meant an event's date, time, length and priority could never
 * be changed at all — you could retype the title or nothing. A tap now opens the
 * one dialog that can edit any of it.
 *
 * The row shape is deliberately the same as the Overview's Upcoming list and the
 * Tasks card: the user already knows what a row with a time on the left and a
 * duration on the right looks like, and reusing it costs them nothing to learn.
 */
export function DayEventList({
  theme,
  events,
  onOpenEvent,
  onDeleteEvent,
  onAdd,
  primary = false,
}: {
  theme: Theme;
  /** The selected day's events, soonest first. */
  events: Event[];
  onOpenEvent: (event: Event) => void;
  onDeleteEvent: (id: number) => void;
  onAdd: () => void;
  primary?: boolean;
}) {
  const ink = primary ? primaryTheme(theme) : surfaceTheme(theme);

  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuEventId, setMenuEventId] = useState<number | null>(null);

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuEventId(null);
  };

  // Resolved from the *live* list, so an id left over from a stale menu cannot
  // point the menu at an event the user has already deleted.
  const menuEvent = menuEventId === null ? null : events.find((e) => e.id === menuEventId);
  const menuActions: ContextMenuAction[] = !menuEvent
    ? []
    : [
        {
          label: 'Edit',
          iconName: 'pencil-outline',
          onPress: () => {
            closeMenu();
            onOpenEvent(menuEvent);
          },
        },
        {
          label: 'Delete',
          iconName: 'trash-can-outline',
          destructive: true,
          onPress: () => onDeleteEvent(menuEvent.id),
        },
      ];

  const openMenu = (id: number, e: AnchorEvent) => {
    e.preventDefault?.();
    setMenuEventId(id);
    setMenuAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
  };

  return (
    <Card theme={ink} style={styles.card}>
      {events.map((ev, idx) => {
        const minutes = minutesFromMidnight(ev.startsAt);
        const priority = ev.priority;

        return (
          <AnimatedPressable
            key={ev.id}
            onPress={() => onOpenEvent(ev)}
            {...({
              onContextMenu: (e: AnchorEvent) => openMenu(ev.id, e),
              onLongPress: (e: unknown) => openMenu(ev.id, e as unknown as AnchorEvent),
            } as Record<string, unknown>)}
            containerStyle={styles.rowContainer}
            style={[styles.row, idx < events.length - 1 && { borderBottomColor: ink.border }]}
            accessibilityRole="button"
            accessibilityLabel={
              `${ev.title}, ${minutes === null ? '' : timePreciseLabel(minutes)}` +
              (priority ? `, ${PRIORITY_LABELS[priority]} priority` : '')
            }
            accessibilityHint="Opens the event editor. Right-click or long-press for more actions."
          >
            {/* The priority flag. A **bar**, not a dot, because the row's text is
                already the thing you read and the flag only has to be findable
                while scanning down the times column. Empty box when there is no
                priority, so the column stays aligned. */}
            <View
              style={[
                styles.flag,
                { backgroundColor: priority ? ink.priority[priority] : 'transparent' },
              ]}
            />

            <Text style={[styles.time, { color: ink.textMuted }]} numberOfLines={1}>
              {minutes === null ? '—' : timePreciseLabel(minutes)}
            </Text>

            <Text style={[styles.title, { color: ink.text }]} numberOfLines={1}>
              {ev.title}
            </Text>

            {ev.isPinned ? (
              <MaterialCommunityIcons name="pin" size={14} color={theme.accent} />
            ) : null}
            <Text style={[styles.duration, { color: ink.textMuted }]} numberOfLines={1}>
              {durationLabel(ev.durationMinutes)}
            </Text>
          </AnimatedPressable>
        );
      })}

      {/* The way to add an event, on the same surface as the events themselves —
          so "what can I do here" is answered by looking. */}
      <AnimatedPressable
        onPress={onAdd}
        containerStyle={styles.rowContainer}
        style={[styles.row, events.length > 0 && { borderTopColor: ink.border }]}
        accessibilityRole="button"
        accessibilityLabel="Add an event to this day"
      >
        <View style={{ width: FLAG_WIDTH + TIME_COLUMN + 8 }} />
        <View style={styles.addLabel}>
          <MaterialCommunityIcons name="plus" size={16} color={theme.accent} />
          <Text style={[styles.addText, { color: theme.accent }]}>Add event</Text>
        </View>
      </AnimatedPressable>

      <ContextMenu anchor={menuAnchor} actions={menuActions} onDismiss={closeMenu} theme={theme} />
    </Card>
  );
}

const styles = StyleSheet.create({
  /** No padding: the rows own the insets, so the first row lines up with the
      heading above rather than sitting inside a well. */
  card: { paddingHorizontal: 16, paddingVertical: 4 },
  rowContainer: { borderRadius: Radius.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: ROW_HEIGHT,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  flag: { width: 4, height: 20, borderRadius: Radius.full, flexShrink: 0 },
  time: { ...Typography.app.body, width: TIME_COLUMN, flexShrink: 0 },
  title: { ...Typography.app.bodyStrong, flex: 1, minWidth: 0 },
  duration: { ...Typography.app.caption, width: DURATION_COLUMN, textAlign: 'right', flexShrink: 0 },
  addLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  addText: { ...Typography.app.bodyStrong },
});
