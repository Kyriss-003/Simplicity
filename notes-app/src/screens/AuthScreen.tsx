import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Layout, Radius, Spacing, THEMES, Typography, withAccent, type Theme } from '../theme';
import { usePrefsStore } from '../store/usePrefsStore';
import { useAuthStore } from '../store/useAuthStore';
import { signInWithProvider } from '../lib/auth';

/**
 * Auth gate: email/password sign-in and sign-up, plus OAuth buttons.
 *
 * Built natively with the app's design system (no Tailwind � shadcn/ui does not
 * run in React Native). One idea per screen: either you're signing in or you're
 * creating an account, expressed by the tab at the top. The OAuth buttons are
 * secondary, so they sit below the primary email form.
 */
export function AuthScreen({
  initialMode = 'signIn',
}: {
  initialMode?: 'signIn' | 'signUp';
}) {
  const themeName = usePrefsStore((s) => s.themeName);
  const accentName = usePrefsStore((s) => s.accent);
  const theme = withAccent(THEMES[themeName], accentName);
  const { signIn, signUp, isLoading, error } = useAuthStore.getState();
  const [mode, setMode] = useState<'signIn' | 'signUp'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
    setLocalError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setLocalError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      setLocalError('Enter both an email and a password.');
      return;
    }
    const ok = mode === 'signIn' ? await signIn(trimmed, password) : await signUp(trimmed, password);
    if (!ok) {
      const authError = useAuthStore.getState().error;
      setLocalError(authError ?? 'Could not complete that request.');
    }
  }, [mode, email, password, signIn, signUp]);

  const handleOAuth = useCallback(async (provider: 'google') => {
    setLocalError(null);
    const { error: oauthError } = await signInWithProvider(provider);
    if (oauthError) setLocalError(oauthError);
  }, []);

  const shownError = localError ?? error;

  return (
    <KeyboardAvoidingView
      style={[styles.shell, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.wordmark, { color: theme.accent }]}>SIMPLICITY</Text>
        <Text style={[styles.heading, { color: theme.text }]}>
          {mode === 'signIn' ? 'Welcome back' : 'Create your account'}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {mode === 'signIn'
            ? 'Sign in to sync your notes, calendar and folders.'
            : 'Your data is yours � encrypted and synced only to you.'}
        </Text>

        {/* Mode toggle: the only control that changes what the form means. */}
        <View style={styles.segmented}>
          {(['signIn', 'signUp'] as const).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  setMode(m);
                  setLocalError(null);
                }}
                style={[
                  styles.segment,
                  active ? { backgroundColor: theme.accent } : { backgroundColor: theme.pillBg },
                ]}
              >
                <Text
                  style={[
                    styles.segmentLabel,
                    { color: active ? theme.accentText : theme.text },
                  ]}
                >
                  {m === 'signIn' ? 'Sign in' : 'Sign up'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textMuted }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
            ]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={theme.textMuted}
            accessibilityLabel="Email"
          />
          <Text style={[styles.label, { color: theme.textMuted }]}>Password</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.background, color: theme.text, borderColor: theme.border },
            ]}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="��������"
            placeholderTextColor={theme.textMuted}
            accessibilityLabel="Password"
          />

          {shownError ? (
            <Text style={[styles.error, { color: theme.onSurfaceError }]}>{shownError}</Text>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.accentText} />
            ) : (
              <Text style={[styles.primaryButtonLabel, { color: theme.accentText }]}>
                {mode === 'signIn' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.dividerLabel, { color: theme.textMuted }]}>or continue with</Text>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {(
            [
              { provider: 'google', icon: 'google', label: 'Continue with Google' },
            ] as const
          ).map((o) => (
            <Pressable
              key={o.provider}
              onPress={() => void handleOAuth(o.provider)}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.oauthButton,
                { borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <MaterialCommunityIcons
                name={o.icon as 'google'}
                size={18}
                color={theme.text}
              />
              <Text style={[styles.oauthLabel, { color: theme.text }]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.legal, { color: theme.textMuted }]}>
          By continuing you agree to our Terms and Privacy Policy. Your password is never stored on
          this device � it lives in your encrypted account.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.semantic.gutter,
    gap: Spacing.semantic.sectionGap,
    maxWidth: Layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  wordmark: { ...Typography.app.wordmark, fontSize: 24, textAlign: 'center' },
  heading: { ...Typography.app.pageHeader, textAlign: 'center' },
  subtitle: { ...Typography.app.body, textAlign: 'center' },
  segmented: { flexDirection: 'row', borderRadius: Radius.button, overflow: 'hidden' },
  segment: {
    flex: 1,
    height: Spacing.scale[12],
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: { ...Typography.app.bodyStrong },
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: Spacing.semantic.cardPadding,
    gap: Spacing.scale[2],
  },
  label: { ...Typography.app.caption, marginTop: Spacing.scale[2] },
  input: {
    height: Spacing.scale[12],
    borderRadius: Radius.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.scale[3],
    fontSize: 14,
  },
  error: { ...Typography.app.caption, marginTop: Spacing.scale[1] },
  primaryButton: {
    height: Spacing.scale[12],
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.scale[3],
  },
  primaryButtonLabel: { ...Typography.app.bodyStrong },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.scale[3] },
  divider: { flex: 1, height: 1 },
  dividerLabel: { ...Typography.app.caption },
  oauthButton: {
    height: Spacing.scale[12],
    borderRadius: Radius.button,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.scale[2],
  },
  oauthLabel: { ...Typography.app.bodyStrong },
  legal: { ...Typography.app.caption, textAlign: 'center' },
});
