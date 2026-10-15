import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { Radius, Spacing, Typography, type Theme } from '../../theme';

/**
 * Shadcn-inspired Button primitive.
 *
 * Pattern: Button from shadcn/ui — variants (default, outline, ghost),
 * size (default, sm, lg), loading spinner, and icon support.
 * Translates the shadcn Button API to RN StyleSheet + theme tokens.
 */

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'default' | 'sm' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  theme: Theme;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** Icon element rendered at the start (maps to shadcn data-icon="inline-start") */
  iconStart?: React.ReactNode;
  /** Icon element rendered at the end (maps to shadcn data-icon="inline-end") */
  iconEnd?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

function getButtonStyles(variant: ButtonVariant, theme: Theme) {
  switch (variant) {
    case 'default':
      return { bg: theme.accent, text: theme.accentText, border: theme.accent };
    case 'outline':
      return { bg: 'transparent', text: theme.text, border: theme.border };
    case 'ghost':
      return { bg: 'transparent', text: theme.text, border: 'transparent' };
    case 'destructive':
      return { bg: theme.onSurfaceError, text: '#FFFFFF', border: theme.onSurfaceError };
  }
}

function getButtonHeight(size: ButtonSize): number {
  switch (size) {
    case 'sm': return 36;
    case 'default': return 48;
    case 'lg': return 56;
  }
}

export function Button({
  theme,
  variant = 'default',
  size = 'default',
  isLoading,
  iconStart,
  iconEnd,
  children,
  containerStyle,
  disabled,
  ...rest
}: ButtonProps) {
  const styles_ = getButtonStyles(variant, theme);
  const height = getButtonHeight(size);

  return (
    <Pressable
      {...rest}
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        styles.button,
        {
          height,
          backgroundColor: styles_.bg,
          borderColor: styles_.border,
          opacity: disabled ? 0.5 : pressed ? 0.9 : 1,
        },
        containerStyle,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={styles_.text} size="small" />
      ) : (
        <>
          {iconStart && <View style={styles.iconStart}>{iconStart}</View>}
          {typeof children === 'string' ? (
            <Text style={[styles.label, { color: styles_.text }]}>{children}</Text>
          ) : (
            children
          )}
          {iconEnd && <View style={styles.iconEnd}>{iconEnd}</View>}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.scale[2],
    paddingHorizontal: Spacing.scale[4],
  },
  label: {
    ...Typography.app.bodyStrong,
  },
  iconStart: { marginRight: Spacing.scale[1] },
  iconEnd: { marginLeft: Spacing.scale[1] },
});
