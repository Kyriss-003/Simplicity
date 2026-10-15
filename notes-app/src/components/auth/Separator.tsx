import React from 'react';
import { View, StyleSheet } from 'react-native';
import { type Theme } from '../../theme';

/**
 * Shadcn-inspired Separator primitive.
 *
 * Pattern: Separator from shadcn/ui — a thin horizontal or vertical divider.
 */

export interface SeparatorProps {
  theme: Theme;
  orientation?: 'horizontal' | 'vertical';
}

export function Separator({ theme, orientation = 'horizontal' }: SeparatorProps) {
  return (
    <View
      style={[
        styles.base,
        orientation === 'horizontal' ? styles.horizontal : styles.vertical,
        { backgroundColor: theme.border },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { flexShrink: 0 },
  horizontal: { height: 1, width: '100%' },
  vertical: { width: 1, height: '100%' },
});
