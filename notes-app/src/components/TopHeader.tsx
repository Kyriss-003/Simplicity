import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { Theme } from '../theme';

/**
 * Top header bar: hamburger toggle + dynamic greeting/date on the left;
 * action pills (+ New Note / + New Event / + New Task) on the right for
 * desktop, or a search icon for mobile.
 */
export function TopHeader({
  theme,
  isMobile,
  userName,
  greetingText,
  dateText,
  onToggleSidebar,
  onNewNote,
  onNewEvent,
  onNewTask,
  onSearch,
}: {
  theme: Theme;
  isMobile: boolean;
  userName: string;
  greetingText: string;
  dateText: string;
  onToggleSidebar: () => void;
  onNewNote: () => void;
  onNewEvent: () => void;
  onNewTask: () => void;
  onSearch?: () => void;
}) {
  return (
    <View
      style={[
        styles.container,
        { borderBottomColor: theme.border, backgroundColor: theme.background },
      ]}
    >
      {/* Left: hamburger + greeting */}
      <View style={styles.left}>
        <TouchableOpacity
          onPress={onToggleSidebar}
          style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          accessibilityLabel="Toggle sidebar"
          hitSlop={6}
        >
          <Ionicons name="menu" size={18} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.greetingWrap}>
          <Text style={[styles.greeting, { color: theme.text }]} numberOfLines={1}>
            {greetingText}, {userName}
          </Text>
          <Text style={[styles.dateLine, { color: theme.textMuted }]} numberOfLines={1}>
            {dateText}
          </Text>
        </View>
      </View>

      {/* Right: action pills (desktop) or search icon (mobile) */}
      {!isMobile ? (
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onNewNote}
            style={[styles.primaryPill, { backgroundColor: theme.accent }]}
            accessibilityLabel="Create new note"
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus" size={16} color={theme.accentText} />
            <Text style={[styles.primaryPillText, { color: theme.accentText }]}>New Note</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onNewEvent}
            style={[styles.ghostPill, { backgroundColor: theme.surface, borderColor: theme.border }]}
            accessibilityLabel="Create new event"
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="calendar-plus" size={15} color={theme.textMuted} />
            <Text style={[styles.ghostPillText, { color: theme.textMuted }]}>New Event</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onNewTask}
            style={[styles.ghostPill, { backgroundColor: theme.surface, borderColor: theme.border }]}
            accessibilityLabel="Create new task"
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="checkbox-marked-circle-plus-outline" size={15} color={theme.textMuted} />
            <Text style={[styles.ghostPillText, { color: theme.textMuted }]}>New Task</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onSearch}
          style={[styles.iconBtn, { backgroundColor: 'transparent', borderColor: 'transparent' }]}
          accessibilityLabel="Search"
        >
          <Ionicons name="search" size={20} color={theme.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexShrink: 0,
  },
  greetingWrap: { flex: 1, minWidth: 0 },
  greeting: { fontSize: 17, fontWeight: '700' },
  dateLine: { fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  primaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  primaryPillText: { fontSize: 13, fontWeight: '700' },
  ghostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  ghostPillText: { fontSize: 13, fontWeight: '600' },
});
