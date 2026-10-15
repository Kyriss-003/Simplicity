import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '../shared/icons';
import { Card } from '../shared/Card';
import { Radius, Typography, primaryTheme, surfaceTheme, type Theme } from '../../theme';
import { PRIORITY_LABELS, type CalendarEvent } from '../../types';
import { selectUpcomingEvents, upcomingOverflow } from './upcomingEvents';

/** 48px row contract — every row in the list, empty state included. */
const ROW_HEIGHT = 48;

/**
 * The Overview's calendar block: the next few events, pinned ones first.
 *
 * This replaced a fixed-height horizontal timeline whose blocks were positioned
 * by a percent `marginLeft` behind a `@ts-ignore`. That geometry only ever
 * described *today's* slots, so the block was a picture of a day rather than a
 * list of things to do, and it silently lost every event outside the seven
 * visible slots. The Agenda screen keeps the timeline, where that geometry is
 * the point; on the dashboard a scannable list is what carries the same
 * information.
 */
export function UpcomingEventsCard({
  theme,
  events,
  primary = false,
  expanded = false,
}: {
  /** The page's primary card — in `B&W`, the one black slab. */
  primary?: boolean;
  /** Grow the card to fill the space a hidden section title left. */
  expanded?: boolean;
  theme: Theme;
  events: CalendarEvent[];
}) {
  // Everything here is drawn onto the card, so one `surfaceTheme` decision
  // covers all of it — see the depth rules in `AGENTS.md`.
  const ink = primary ? primaryTheme(theme) : surfaceTheme(theme);

  const rows = selectUpcomingEvents(events);
  const overflow = upcomingOverflow(events);
  const isEmpty = rows.length === 0;

  return (
    <Card theme={ink} style={[styles.card, expanded && styles.expanded]}>
      {isEmpty ? (
        <View style={styles.emptyWrap}>
          {/* The accent badge is the empty state's focal point — the
              one high-contrast mark on the card, in the accent the
              theme already pairs with a readable glyph colour. */}
          <View style={[styles.emptyBadge, { backgroundColor: theme.accent }]}>
            <MaterialCommunityIcons
              name="calendar-clock-outline"
              size={24}
              color={theme.accentText}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: ink.text }]}>
            Nothing scheduled
          </Text>
          <Text style={[styles.emptySubtitle, { color: ink.textMuted }]}>
            Your upcoming events will appear here.
          </Text>
        </View>
      ) : (
        rows.map((ev, idx) => (
          <View
            key={`${ev.title}-${idx}`}
            style={[styles.row, idx < rows.length - 1 && { borderBottomColor: ink.border }]}
          >
            {/* The priority flag, in the ramp for whatever this card is drawn on.
                An event with no priority falls back to the accent, so an
                unflagged event still reads as an event rather than as an
                unstyled line of text. */}
            <View
              style={[
                styles.bar,
                {
                  backgroundColor: ev.priority
                    ? primary
                      ? ink.priority[ev.priority]
                      : theme.priority[ev.priority]
                    : theme.accent,
                },
              ]}
            />
            <Text
              style={[styles.title, { color: ink.text }]}
              numberOfLines={1}
              accessibilityLabel={`${ev.title}, ${ev.time}${ev.pinned ? ', pinned' : ''}${
                ev.priority ? `, ${PRIORITY_LABELS[ev.priority]} priority` : ''
              }`}
            >
              {ev.title}
            </Text>
            {ev.pinned ? (
              <MaterialCommunityIcons name="pin" size={14} color={theme.accent} />
            ) : null}
            <Text style={[styles.time, { color: ink.textMuted }]} numberOfLines={1}>
              {ev.time}
            </Text>
          </View>
        ))
      )}

      {overflow > 0 ? (
        <Text style={[styles.overflow, { color: ink.textMuted }]}>
          {overflow} more in Agenda
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  /** No padding on the card: the rows own the insets, so the first row's text
      lines up with the section header above rather than sitting inside a well. */
  card: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    minHeight: ROW_HEIGHT * 2 + 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: ROW_HEIGHT,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  bar: { width: 4, height: 24, borderRadius: Radius.sm, flexShrink: 0 },
  title: { ...Typography.app.bodyStrong, flex: 1, minWidth: 0 },
  /** Fixed-width gutter so the times form a column the eye can scan down
      instead of a ragged edge that follows the length of each title. */
  time: { ...Typography.app.caption, flexShrink: 0, minWidth: 56, textAlign: 'right' },
  /** Not a 48px row: the empty state is a composed moment that
      sizes itself, or the row contract's fixed height would clip
      the badge mid-glyph. */
  emptyWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emptyBadge: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...Typography.app.cardHeader },
  emptySubtitle: { ...Typography.app.body, textAlign: 'center' },
  overflow: { ...Typography.app.caption, paddingTop: 12, paddingBottom: 8 },
  /**
   * Extra breathing room when the section title is hidden: the
   * card grows by roughly the height the heading occupied, so the
   * dashboard keeps its shape instead of collapsing inward.
   */
  expanded: { paddingVertical: 16, minHeight: 140 },
});
