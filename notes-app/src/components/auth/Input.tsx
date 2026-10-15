import React from 'react';
import { TextInput as RNTextInput, StyleSheet, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { Radius, Spacing, type Theme } from '../../theme';

/**
 * Shadcn-inspired Input primitive.
 *
 * Pattern: Input from shadcn/ui — a bordered, rounded text field with
 * consistent padding and typography, themed via the app's design tokens.
 * Works on both Native and Web (react-native-web uses a real <textarea> for
 * multiline; for single-line we use the default <input>).
 */

export interface InputProps extends Omit<TextInputProps, 'style'> {
  theme: Theme;
  /** Shadcn variant. default is a standard outlined input; ghost has no border. */
  variant?: 'default' | 'ghost';
  /** Error state — applies onSurfaceError border. */
  isError?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  theme,
  variant = 'default',
  isError,
  containerStyle,
  ...rest
}: InputProps) {
  return (
    <RNTextInput
      {...rest}
      style={[
        styles.input,
        {
          color: theme.text,
          backgroundColor: variant === 'ghost' ? 'transparent' : theme.background,
          borderColor: isError
            ? theme.onSurfaceError
            : variant === 'default'
              ? theme.border
              : 'transparent',
        },
        containerStyle,
      ]}
      placeholderTextColor={theme.textMuted}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderRadius: Radius.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.scale[3],
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
});
