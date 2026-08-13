import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Theme } from '../theme';

export type ScreenKey = 'Overview' | 'Notes' | 'Agenda';

interface CapsuleItem {
  key: ScreenKey;
  label: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
}

const ITEMS: CapsuleItem[] = [
  { key: 'Overview', label: 'Overview', iconName: 'view-dashboard-outline' },
  { key: 'Notes', label: 'Notes', iconName: 'note-text-outline' },
  { key: 'Agenda', label: 'Agenda', iconName: 'calendar-month-outline' },
];

/**
 * Bottom capsule screen switcher. Shown on ALL screen sizes.
 * The active segment gets a pill-highlight background.
 */
export function CapsuleSwitcher({
  theme,
  active,
  onSelect,
}: {
  theme: Theme;
  active: ScreenKey;
  onSelect: (k: ScreenKey) => void;
}) {
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => onSelect(item.key)}
            activeOpacity={0.8}
            style={[styles.item, isActive && { backgroundColor: theme.pillBg }]}
          >
            <MaterialCommunityIcons
              name={item.iconName}
              size={16}
              color={isActive ? theme.text : theme.textMuted}
            />
            <Text
              style={[
                styles.label,
                { color: isActive ? theme.text : theme.textMuted },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    gap: 2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 12, color: 'rgba(0,0,0,0.25)' }],
    elevation: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  label: { fontSize: 12, fontWeight: '600' },
});
