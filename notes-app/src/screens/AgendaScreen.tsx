import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRef, useState } from 'react';
import { MaterialCommunityIcons } from '../components/shared/icons';
import { Layout, Radius, Typography, surfaceTheme, type Theme } from '../theme';
import type { Event, Task } from '../types';
import { AnimatedPressable } from '../components/shared/motion';
import { WeekStrip } from '../components/calendar/WeekStrip';
import { DayEventList } from '../components/calendar/DayEventList';
import {
  MonthPickerPopover,
  type MonthPickerAnchor,
} from '../components/calendar/MonthPickerPopover';
import {
  addDays,
  dayHeadingLabel,
  eventsOnDay,
  isSameDay,
  nextFreeSlot,
} from '../components/calendar/calendarUtils';
import { TasksCard } from '../components/cards/TasksCard';

/** 44px box — the tap target, not the painted size. */
const NAV_BTN = 44;
/** The header bar's height, used to drop the picker below the heading. */
const HEADER_HEIGHT = 64;

/**
 * Agenda: a day, and what is on it.
 *
 * **One screen, one idea, one heading.** This is the third version:
 *
 * 1. A `Today / Week / Month` tab strip over a seven-slot timeline. The arrows
 *    moved a month or a day depending on the tab — the same button meaning two
 *    different things.
 * 2. A month grid above a day timeline, tabs removed. The ambiguity went, but the
 *    screen still asked the user to interpret a 42-cell grid *and* an hour lane
 *    with two separate headings, and a non-neurodivergent user reported that it
 *    took them a while to work out how it fit together.
 * 3. A heading, a week strip and a list of the day's events — with no way to
 *    reach any other month, and no way to change an event's date, time, length
 *    or priority at all. Rename was the only edit that existed.
 * 4. This. The month is reachable through **one explicit control** — the
 *    heading, which opens a month picker — so the day list stays the only thing
 *    permanently on screen and ‹ › keep meaning one thing. Every row opens the
 *    editor, which is where date, time, length and priority are set.
 *
 * Every control now means one thing — the arrows move a day, the heading picks a
 * day, a row edits that event, "+ Add event" adds to the day on screen — and the
 * list is the same shape as the Overview's Upcoming and the Tasks card, so it is
 * a pattern already in the user's hands.
 *
 * `anchor` is owned by `HomeScreen` because the FAB's "New Event" has to drive
 * it: creating from the Overview and landing on a day you were not looking at
 * would hide the thing you just made.
 */
export function AgendaScreen({
  theme,
  isMobile,
  anchor,
  onAnchorChange,
  events,
  onCreateEvent,
  onOpenEvent,
  onDeleteEvent,
  tasks,
  newTask,
  onNewTaskChange,
  onAddTask,
  onToggleTask,
  onToggleSidebar,
}: {
  theme: Theme;
  isMobile: boolean;
  /** The selected day. */
  anchor: Date;
  onAnchorChange: (date: Date) => void;
  events: Event[];
  /** Opens the editor with a blank event at this start time. */
  onCreateEvent: (start: Date) => void;
  /** Opens the editor on an existing event. */
  onOpenEvent: (event: Event) => void;
  onDeleteEvent: (id: number) => void;
  tasks: Task[];
  newTask: string;
  onNewTaskChange: (t: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: number) => void;
  onToggleSidebar?: () => void;
}) {
  const ink = surfaceTheme(theme);
  const dayEvents = eventsOnDay(events, anchor);
  const isTodaySelected = isSameDay(anchor, new Date());
  const [monthAnchor, setMonthAnchor] = useState<MonthPickerAnchor | null>(null);
  const headingRef = useRef<View>(null);

  /**
   * Open the month picker under the heading.
   *
   * Measured, not taken from the press event — RNW's synthetic press event has
   * no `locationX`, the same gap that made the Agenda's tap-to-create fail and
   * that made `SelectRow`'s menu come back pinned to the window's edge.
   */
  const openMonthPicker = () => {
    const node = headingRef.current;
    if (!node) {
      setMonthAnchor({ x: 0, y: 0, width: 0 });
      return;
    }
    node.measureInWindow((x, y, width) => {
      setMonthAnchor({
        x: typeof x === 'number' ? x : 0,
        y: (typeof y === 'number' ? y : 0) + HEADER_HEIGHT,
        width: typeof width === 'number' ? width : 0,
      });
    });
  };

  return (
    <ScrollView
      style={styles.canvas}
      contentContainerStyle={[styles.inner, isMobile && styles.innerMobile]}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      {/*
        The heading is the month control. It reads as the name of the day you
        are looking at *and* is the way out to any other month — which is the
        whole point of the "one explicit control" rule: the month view came back
        without a second panel competing with the list, and without an arrow
        that means two different things.
      */}
      <View style={styles.headingRow}>
        {onToggleSidebar ? (
          <AnimatedPressable
            onPress={onToggleSidebar}
            style={styles.sidebarToggle}
            accessibilityRole="button"
            accessibilityLabel="Open sidebar"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="menu" size={20} color={ink.text} />
          </AnimatedPressable>
        ) : null}
        <AnimatedPressable
          ref={headingRef}
          onPress={openMonthPicker}
          containerStyle={styles.headingContainer}
          style={styles.heading}
          accessibilityRole="button"
          accessibilityLabel={`${dayHeadingLabel(anchor)}. Choose a date.`}
        >
          <Text style={[styles.headingText, { color: theme.text }]} numberOfLines={1}>
            {dayHeadingLabel(anchor)}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={18} color={theme.textMuted} />
        </AnimatedPressable>

        <View style={styles.nav}>
          <NavButton
            theme={theme}
            icon="chevron-left"
            label="Previous day"
            onPress={() => onAnchorChange(addDays(anchor, -1))}
          />
          {/* "Today" disables rather than hides. A control that appears and
              disappears moves the buttons beside it, and here it would also
              remove the only way back once you had browsed away. */}
          <AnimatedPressable
            onPress={() => onAnchorChange(new Date())}
            containerStyle={styles.todayContainer}
            style={[styles.todayBtn, { borderColor: ink.border }]}
            disabled={isTodaySelected}
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
          >
            <Text
              style={[
                styles.todayLabel,
                { color: isTodaySelected ? ink.textMuted : theme.accent },
              ]}
            >
              Today
            </Text>
          </AnimatedPressable>
          <NavButton
            theme={theme}
            icon="chevron-right"
            label="Next day"
            onPress={() => onAnchorChange(addDays(anchor, 1))}
          />
        </View>
      </View>

      <WeekStrip theme={theme} day={anchor} events={events} onSelectDay={onAnchorChange} />

      <DayEventList
        theme={theme}
        events={dayEvents}
        onOpenEvent={onOpenEvent}
        onDeleteEvent={onDeleteEvent}
        onAdd={() => onCreateEvent(nextFreeSlot(anchor, events))}
      />

      <TasksCard
        theme={theme}
        tasks={tasks}
        newTask={newTask}
        onNewTaskChange={onNewTaskChange}
        onAddTask={onAddTask}
        onToggleTask={onToggleTask}
      />

      <MonthPickerPopover
        theme={theme}
        anchor={monthAnchor}
        selected={anchor}
        events={events}
        onSelectDay={onAnchorChange}
        onDismiss={() => setMonthAnchor(null)}
      />
    </ScrollView>
  );
}

/** A bare chevron — no fill, no border, same rule as the header's icon buttons. */
function NavButton({
  theme,
  icon,
  label,
  onPress,
}: {
  theme: Theme;
  icon: 'chevron-left' | 'chevron-right';
  label: string;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      containerStyle={styles.navContainer}
      style={styles.navBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons name={icon} size={20} color={theme.text} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sidebarToggle: {
    width: NAV_BTN,
    height: NAV_BTN,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  headingContainer: { borderRadius: Radius.md },
  /** No fill and no border: a heading that looks like a button reads as a
      control, and it is one — this is how you reach the month picker. */
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginLeft: -4,
  },
  headingText: { ...Typography.app.cardHeader, flexShrink: 1 },
  inner: {
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    alignSelf: 'center',
    padding: 24,
    paddingBottom: 120,
    gap: 16,
  },
  innerMobile: { padding: 16, paddingBottom: 120, gap: 16 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navContainer: { borderRadius: Radius.lg },
  navBtn: { width: NAV_BTN, height: NAV_BTN, alignItems: 'center', justifyContent: 'center' },
  todayContainer: { borderRadius: Radius.lg },
  todayBtn: {
    height: 32,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.full,
  },
  todayLabel: { ...Typography.app.caption },
});
