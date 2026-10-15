import React from 'react';
import { Text, StyleSheet, type TextProps } from 'react-native';
import { Typography, type Theme } from '../../theme';

/**
 * Shadcn-inspired Label primitive.
 *
 * Pattern: Label from shadcn/ui — a small, muted text label for form fields.
 */

export interface LabelProps extends Omit<TextProps, 'style'> {
  theme: Theme;
}

export function Label({ theme, children, ...rest }: LabelProps) {
  return (
    <Text {...rest} style={[styles.label, { color: theme.textMuted }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Typography.app.caption,
    marginBottom: 4,
  },
});
