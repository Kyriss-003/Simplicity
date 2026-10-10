import React, { useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '../shared/Card';
import { AnimatedPressable } from '../shared/motion';
import { MarkdownLabel } from '../shared/MarkdownLabel';
import { Motion, Radius, Typography, primaryTheme, surfaceTheme, type Theme } from '../../theme';
import type { Task } from '../../types';
import { useScrollRedirection } from '../../hooks/useContainerScroll';

/** Strict vertical height of every task row (8pt grid rule). */
const TASK_ROW_HEIGHT = 48;

/**
 * Interactive task list card.
 *
 * Rows are strictly 48px tall and use a strict flex layout: a fixed-size
 * checkbox container (`flexShrink: 0`) + `flex: 1` label wrap to prevent
 * overlap. Labels render markdown through `MarkdownLabel`.
 *
 * Task creation is a `+` in the header that expands an inline input. The input
 * used to be permanently docked at the bottom of the card, which meant a
 * 48px row and a text cursor's worth of chrome were on screen for every user
 * who was not adding a task — and, on the Overview, it made the card taller
 * than its sibling for no reason.
 */
export function TasksCard({
  theme,
  tasks,
  newTask,
  onNewTaskChange,
  onAddTask,
  onToggleTask,
  primary = false,
  expanded = false,
  style,
}: {
  /** The page's primary card — in `B&W`, the one black slab. */
  primary?: boolean;
  /** Grow the card to fill the space a hidden section title left. */
  expanded?: boolean;
  theme: Theme;
  tasks: Task[];
  newTask: string;
  onNewTaskChange: (t: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: number) => void;
  style?: ViewStyle | undefined;
}) {
  const isEmpty = tasks.length === 0;
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Hovering the list scrolls it instead of the page — see
  // `useScrollRedirection` for why it hands the wheel back at the boundaries. The
  // list is a real ScrollView, so touch needs no help here.
  const listRef = useScrollRedirection('vertical');
  // Everything above the composer is drawn onto the card; the composer paints
  // `theme.background`, a canvas-coloured inset, and keeps the canvas ink.
  const ink = primary ? primaryTheme(theme) : surfaceTheme(theme);

  const openComposer = () => {
    setIsAdding(true);
    // Focus once the row has actually mounted, not in the same tick.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const closeComposer = () => {
    setIsAdding(false);
    onNewTaskChange('');
  };

  const submit = () => {
    onAddTask();
    // Stay open: adding three tasks in a row should not mean three round trips
    // through the button.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <Card theme={ink} style={[styles.container, expanded && styles.expanded, style]}>
      <View style={styles.header}>
        {!isAdding ? (
          <AnimatedPressable
            onPress={openComposer}
            containerStyle={styles.addBtnContainer}
            style={[styles.addBtn, { borderColor: ink.border, backgroundColor: ink.pillBg }]}
            accessibilityLabel="Add task"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="plus" size={16} color={ink.text} />
          </AnimatedPressable>
        ) : null}
      </View>

      {isEmpty ? (
        <View style={{ marginTop: 16 }}>
          <View style={[styles.taskRow, { borderBottomColor: ink.border, opacity: 0.6 }]}>
            <View
              style={[styles.checkbox, { borderColor: ink.border, backgroundColor: 'transparent' }]}
            />
            <View style={styles.taskLabelWrap}>
              <Text style={[styles.taskSub, { color: ink.textMuted }]}>
                No tasks scheduled.
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          // Android only: lets a vertical drag inside the list chain to the
          // page once the list is at its end, instead of trapping it.
          nestedScrollEnabled
        >
          {tasks.map((task) => (
            <AnimatedPressable
              key={task.id}
              onPress={() => onToggleTask(task.id)}
              containerStyle={styles.taskRowContainer}
              style={[styles.taskRow, { borderBottomColor: ink.border }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: task.done }}
              accessibilityLabel={task.label}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: task.done ? theme.accent : 'transparent',
                    borderColor: task.done ? theme.accent : ink.border,
                  },
                ]}
              >
                {task.done ? (
                  <MaterialCommunityIcons name="check" size={14} color={theme.accentText} />
                ) : null}
              </View>
              <View style={styles.taskLabelWrap}>
                <MarkdownLabel
                  theme={ink}
                  value={task.label}
                  style={[
                    styles.taskLabel,
                    { color: task.done ? ink.textMuted : ink.text },
                    task.done && { textDecorationLine: 'line-through' },
                  ]}
                />
              </View>
            </AnimatedPressable>
          ))}
        </ScrollView>
      )}

      {/* Composer — expands in place, and keeps the wheel inside the list */}
      <Animated.View
        entering={FadeInDown.duration(Motion.duration.fast)}
        exiting={FadeOut.duration(Motion.duration.instant)}
      >
        {isAdding ? (
          <View
            style={[styles.addTaskRow, { borderColor: theme.border, backgroundColor: theme.background }]}
          >
            <MaterialCommunityIcons name="plus" size={16} color={theme.textMuted} />
            <TextInput
              ref={inputRef}
              value={newTask}
              onChangeText={onNewTaskChange}
              onSubmitEditing={submit}
              onBlur={() => {
                // Only tear down on blur if nothing was typed, so clicking
                // straight into the row does not close the composer under you.
                if (!newTask.trim()) closeComposer();
              }}
              placeholder="What needs doing?"
              placeholderTextColor={theme.textMuted}
              style={[styles.addTaskInput, { color: theme.text }]}
              returnKeyType="done"
              accessibilityLabel="New task"
            />
            <AnimatedPressable
              onPress={submit}
              containerStyle={styles.submitContainer}
              style={styles.submitBtn}
              accessibilityLabel="Save task"
            >
              <MaterialCommunityIcons name="check" size={16} color={theme.accent} />
            </AnimatedPressable>
            <AnimatedPressable
              onPress={closeComposer}
              containerStyle={styles.submitContainer}
              style={styles.submitBtn}
              accessibilityLabel="Cancel"
            >
              <MaterialCommunityIcons name="close" size={16} color={theme.textMuted} />
            </AnimatedPressable>
          </View>
        ) : null}
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  /**
   * No `flex` here. Flex on these cards belongs to the split row that holds
   * them — see the `pairStyle` note in `OverviewScreen`. A `flex: 1` in a column
   * is a zero-height box.
   */
  container: { minWidth: 0 },
  /**
   * Extra vertical padding when the section title is hidden: the card
   * grows by roughly the height the heading occupied, so the dashboard
   * keeps its shape instead of collapsing inward. The more specific
   * `paddingVertical` overrides the `Card`'s default vertical padding.
   */
  expanded: { paddingVertical: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    // Title now lives in the section header above the card, so this row
    // holds only the trailing control and it sits right.
    justifyContent: 'flex-end',
    minHeight: 32,
  },
  addBtnContainer: { borderRadius: Radius.md },
  addBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  /**
   * Capped so the card keeps its place beside the Scratch Pad, and a real
   * `ScrollView` so it can be scrolled once it outgrows that cap. It used to be
   * a plain `View` with `overflow: hidden`, which on native means the tasks past
   * the cap were simply unreachable — no momentum, no scroll, no way back.
   */
  list: { marginTop: 8, maxHeight: 168 },
  listContent: { paddingBottom: 4 },
  taskRowContainer: { borderRadius: Radius.md },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: TASK_ROW_HEIGHT,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  checkbox: {
    width: 24,
    height: 24,
    flexShrink: 0,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskLabelWrap: { flex: 1, minWidth: 0 },
  taskLabel: { ...Typography.app.bodyStrong },
  taskSub: { ...Typography.app.caption, marginTop: 0 },
  addTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  addTaskInput: { flex: 1, minWidth: 0, ...Typography.app.body, paddingVertical: 4 },
  submitContainer: { borderRadius: Radius.sm },
  submitBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
});
