import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { Theme } from '../../theme';

/**
 * Reusable surface card. Applies the theme's surface background, a hairline
 * border, rounded corners, and default padding. Pass `style` to override or
 * extend — merged last so callers win.
 */
export function Card({
  theme,
  children,
  style,
}: {
  theme: Theme;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
});
