import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Radius, Spacing, type Theme } from '../../theme';

/**
 * Reusable surface card. Applies the theme's surface background, a hairline
 * border, a soft lift, rounded corners, and default padding. Pass `style` to
 * override or extend — merged last so callers win.
 *
 * `theme` is the *resolved* ink, not necessarily the screen's theme: a card
 * passes `primaryTheme(theme)` when it is the page's primary card, and this
 * component needs no idea which is which.
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
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          // A soft lift rather than a heavier outline. In `B&W` the card is white
          // on a near-white canvas and its border sits at 1.11:1, so this is the
          // only thing that actually draws the edge.
          boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 3, color: theme.cardShadow }],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.semantic.cardPadding,
  },
});
