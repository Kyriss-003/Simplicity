import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '../shared/Card';
import type { Theme } from '../../theme';

export interface Task {
  id: number;
  label: string;
  sourceNote: string;
  done: boolean;
}

/** Strict vertical height of every task row (8pt grid rule). */
const TASK_ROW_HEIGHT = 48;

/**
 * Interactive task list card with checkbox rows and an inline "+ Add task"
 * input. Each row is strictly 48px tall and uses a strict flex layout:
 * fixed-size checkbox container (`flexShrink: 0`) + `flex: 1` label wrap to
 * prevent overlap.
 */
export function TasksCard({
  theme,
  tasks,
  newTask,
  onNewTaskChange,
  onAddTask,
  onToggleTask,
  style,
}: {
  theme: Theme;
  tasks: Task[];
  newTask: string;
  onNewTaskChange: (t: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: number) => void;
  style?: ViewStyle | undefined;
}) {
  const isEmpty = tasks.length === 0;

  return (
    <Card theme={theme} style={[styles.container, style]}>
      <Text style={[styles.cardTitle, { color: theme.text }]}>Tasks</Text>

      {isEmpty ? (
        <View style={{ marginTop: 16 }}>
          <View style={[styles.taskRow, { borderBottomColor: theme.border, opacity: 0.6 }]}>
            <View
              style={[styles.checkbox, { borderColor: theme.border, backgroundColor: 'transparent' }]}
            />
            <View style={styles.taskLabelWrap}>
              <Text style={[styles.taskSub, { color: theme.textMuted }]}>
                No tasks scheduled.
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 8 }}>
          {tasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              onPress={() => onToggleTask(task.id)}
              activeOpacity={0.7}
              style={[styles.taskRow, { borderBottomColor: theme.border }]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: task.done ? theme.accent : 'transparent',
                    borderColor: task.done ? theme.accent : theme.border,
                  },
                ]}
              >
                {task.done ? (
                  <MaterialCommunityIcons name="check" size={14} color={theme.accentText} />
                ) : null}
              </View>
              <View style={styles.taskLabelWrap}>
                <Text
                  style={[
                    styles.taskLabel,
                    { color: task.done ? theme.textMuted : theme.text },
                    task.done && { textDecorationLine: 'line-through' },
                  ]}
                  numberOfLines={1}
                >
                  {task.label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Add task bar */}
      <View style={[styles.addTaskRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
        <MaterialCommunityIcons name="plus" size={16} color={theme.textMuted} />
        <TextInput
          value={newTask}
          onChangeText={onNewTaskChange}
          onSubmitEditing={onAddTask}
          placeholder="Add task"
          placeholderTextColor={theme.textMuted}
          style={[styles.addTaskInput, { color: theme.text }]}
          returnKeyType="done"
        />
        <TouchableOpacity onPress={onAddTask} hitSlop={8} style={styles.addSubmitBtn}>
          <MaterialCommunityIcons name="arrow-right" size={18} color={theme.accent} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 18, fontWeight: '600' },
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
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskLabelWrap: { flex: 1, minWidth: 0 },
  taskLabel: { fontSize: 14, fontWeight: '600' },
  taskSub: { fontSize: 12, marginTop: 0 },
  addTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  addTaskInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 4 },
  addSubmitBtn: { paddingHorizontal: 4, flexShrink: 0 },
});
