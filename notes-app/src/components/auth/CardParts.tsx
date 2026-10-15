import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { Spacing } from '../../theme';

/**
 * Shadcn-inspired Card composition primitives.
 *
 * Pattern: shadcn/ui Card = CardHeader + CardTitle + CardDescription + CardContent + CardFooter.
 * Each is a lightweight View with standardised padding and gap, so any
 * combination reads as one composed card surface.
 *
 * Usage:
 *   <Card theme={theme}>
 *     <CardHeader>…</CardHeader>
 *     <CardContent>…</CardContent>
 *     <CardFooter>…</CardFooter>
 *   </Card>
 */

export function CardHeader({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.header, style]}>{children}</View>;
}

export function CardContent({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.content, style]}>{children}</View>;
}

export function CardFooter({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: Spacing.scale[2],
    gap: Spacing.scale[1],
  },
  content: {
    gap: Spacing.scale[2],
  },
  footer: {
    paddingTop: Spacing.scale[3],
    gap: Spacing.scale[2],
  },
});
