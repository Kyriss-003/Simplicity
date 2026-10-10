import React from 'react';
import { Modal, ScrollView, Text, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Spacing, Typography, type Theme } from '../../theme';
import type { LayoutOrder } from '../../types';
import { AnimatedPressable } from '../shared/motion';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { DraggableList } from '../shared/DraggableList';

/**
 * The same controls Settings already owns, reachable without leaving the page
 * they change.
 *
 * Visibility and order are one decision, not two, so both live in this one
 * panel: a list where the handle moves a row and the switch shows or hides it.
 * Settings keeps the same control as the permanent home for it — this is a
 * shortcut to it, not a second implementation with its own state.
 *
 * Reuses `DraggableList` deliberately. A second drag implementation here would
 * be the kind of copy that rots, and the row already knows how to open a gap
 * for itself.
 */

interface SectionCopy {
  label: string;
  description: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
}

export const SECTION_COPY: Record<LayoutOrder[number], SectionCopy> = {
  notes: {
    label: 'Recent / Suggested Notes',
    description: 'A horizontal row of note preview cards.',
    iconName: 'note-multiple-outline',
  },
  calendar: {
    label: 'Calendar Preview',
    description: 'The next few events on your agenda.',
    iconName: 'calendar-clock-outline',
  },
  tasks: {
    label: 'Tasks Preview',
    description: 'Checklist with an inline add-task row.',
    iconName: 'checkbox-marked-circle-outline',
  },
  scratchPad: {
    label: 'Scratch Pad',
    description: 'Quick note with the markdown toolbar.',
    iconName: 'pencil-outline',
  },
};

export function CustomizeOverview({
  theme,
  visible,
  order,
  onToggle,
  onReorder,
  onClose,
}: {
  theme: Theme;
  /** Which sections are on, by id. */
  visible: (id: LayoutOrder[number]) => boolean;
  order: LayoutOrder;
  onToggle: (id: LayoutOrder[number]) => void;
  onReorder: (from: number, to: number) => void;
  onClose: () => void;
}) {
  const shown = order.filter(visible).length;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Backdrop — dismiss on outside tap. */}
        <AnimatedPressable
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: theme.shadow }]}
          accessibilityLabel="Close customize"
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.text }]}>Customize</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                Drag a handle to reorder. {shown}/{order.length} sections shown.
              </Text>
            </View>
            <AnimatedPressable
              onPress={onClose}
              style={[styles.done, { borderColor: theme.border, backgroundColor: theme.pillBg }]}
              accessibilityLabel="Done"
              accessibilityRole="button"
            >
              <Text style={[styles.doneText, { color: theme.text }]}>Done</Text>
            </AnimatedPressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <DraggableList
              items={order}
              theme={theme}
              keyOf={(section) => section}
              onReorder={onReorder}
              rowStyle={(index) => [
                styles.row,
                index < order.length - 1 && {
                  borderBottomColor: theme.border,
                  borderBottomWidth: 1,
                },
              ]}
              renderItem={(section, _index, handle) => {
                const copy = SECTION_COPY[section];
                const on = visible(section);
                return (
                  <View style={styles.rowInner}>
                    {handle}
                    <MaterialCommunityIcons
                      name={copy.iconName}
                      size={16}
                      color={on ? theme.accent : theme.textMuted}
                    />
                    <View style={styles.rowText}>
                      <Text style={[styles.label, { color: theme.text }]}>{copy.label}</Text>
                      <Text
                        style={[styles.description, { color: theme.textMuted }]}
                        numberOfLines={1}
                      >
                        {copy.description}
                      </Text>
                    </View>
                    <ToggleSwitch
                      theme={theme}
                      value={on}
                      onPress={() => onToggle(section)}
                      accessibilityLabel={copy.label}
                    />
                  </View>
                );
              }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.semantic.gutter },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '80%',
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.semantic.cardPadding,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...Typography.app.cardHeader },
  subtitle: { ...Typography.app.caption },
  done: {
    height: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  doneText: { ...Typography.app.body },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 4 },
  row: { minHeight: 56 },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  rowText: { flex: 1, minWidth: 0 },
  label: { ...Typography.app.body },
  description: { ...Typography.app.caption, marginTop: 2 },
});