import { useState, useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '../components/shared/icons';
import { Layout, Spacing, THEMES, Typography, withAccent } from '../theme';
import { usePrefsStore } from '../store/usePrefsStore';
import { useAuthStore } from '../store/useAuthStore';
import { signInWithProvider } from '../lib/auth';
import { Card } from '../components/shared/Card';
import { Input, Button, Label, Separator, CardHeader, CardContent, CardFooter } from '../components/auth';

const PROVIDER_META = {
  google: { icon: 'google' as const, label: 'Continue with Google' },
} as const;

export function AuthScreen({
  initialMode = 'signIn',
}: {
  initialMode?: 'signIn' | 'signUp';
}) {
  const themeName = usePrefsStore((s) => s.themeName);
  const accentName = usePrefsStore((s) => s.accent);
  const theme = withAccent(THEMES[themeName], accentName);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
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
    const { signIn, signUp } = useAuthStore.getState();
    const ok =
      mode === 'signIn' ? await signIn(trimmed, password) : await signUp(trimmed, password);
    if (!ok) {
      const authError = useAuthStore.getState().error;
      setLocalError(authError ?? 'Could not complete that request.');
    }
  }, [mode, email, password]);

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
        {/* Brand wordmark — the app's logotype */}
        <View style={styles.brand}>
          <Text style={[styles.wordmark, { color: theme.accent }]}>SIMPLICITY</Text>
        </View>

        {/* Primary auth card — shadcn Card composition */}
        <Card theme={theme}>
          <CardHeader>
            <Text style={[styles.cardTitle, { color: theme.onSurface }]}>
              {mode === 'signIn' ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={[styles.cardDescription, { color: theme.onSurfaceMuted }]}>
              {mode === 'signIn'
                ? 'Enter your credentials to sign in'
                : 'Enter your details to get started'}
            </Text>
          </CardHeader>

          <CardContent>
            {/* Email field */}
            <View style={styles.fieldGroup}>
              <Label theme={theme}>Email</Label>
              <Input
                theme={theme}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                accessibilityLabel="Email"
              />
            </View>

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <Label theme={theme}>Password</Label>
              <Input
                theme={theme}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Enter your password"
                accessibilityLabel="Password"
              />
            </View>

            {/* Error text */}
            {shownError ? (
              <Text style={[styles.error, { color: theme.onSurfaceError }]}>
                {shownError}
              </Text>
            ) : null}

            {/* Primary submit button */}
            <View style={styles.submitWrapper}>
              <Button
                theme={theme}
                variant="default"
                size="default"
                isLoading={isLoading}
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {mode === 'signIn' ? 'Sign in' : 'Create account'}
              </Button>
            </View>
          </CardContent>

          {/* Footer with mode toggle link */}
          <CardFooter>
            <Text style={[styles.footerText, { color: theme.onSurfaceMuted }]}>
              {mode === 'signIn' ? "Don't have an account?" : 'Already have an account?'}
            </Text>
            <Button
              theme={theme}
              variant="ghost"
              size="sm"
              onPress={toggleMode}
              disabled={isLoading}
            >
              {mode === 'signIn' ? 'Sign up' : 'Sign in'}
            </Button>
          </CardFooter>
        </Card>

        {/* Separator + OAuth */}
        <View style={styles.dividerRow}>
          <Separator theme={theme} />
          <Text style={[styles.dividerLabel, { color: theme.textMuted }]}>
            or continue with
          </Text>
          <Separator theme={theme} />
        </View>

        {/* OAuth card */}
        <Card theme={theme}>
          <CardContent>
            <Button
              theme={theme}
              variant="outline"
              size="default"
              onPress={() => void handleOAuth('google')}
              disabled={isLoading}
              iconStart={
                <MaterialCommunityIcons
                  name={PROVIDER_META.google.icon}
                  size={18}
                  color={theme.text}
                />
              }
            >
              {PROVIDER_META.google.label}
            </Button>
          </CardContent>
        </Card>

        {/* Legal footnote */}
        <Text style={[styles.legal, { color: theme.textMuted }]}>
          By continuing you agree to our Terms and Privacy Policy. Your password is never stored
          on this device — it lives in your encrypted account.
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
    gap: Spacing.scale[6],
    maxWidth: Layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  brand: { alignItems: 'center', marginBottom: Spacing.scale[2] },
  wordmark: {
    ...Typography.app.wordmark,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 2,
    textAlign: 'center',
  },
  cardTitle: { ...Typography.app.pageHeader },
  cardDescription: { ...Typography.app.body, lineHeight: 20 },
  fieldGroup: { gap: Spacing.scale[1] },
  submitWrapper: { marginTop: Spacing.scale[1] },
  error: { ...Typography.app.caption, marginTop: Spacing.scale[1] },
  footerText: { ...Typography.app.body, textAlign: 'center' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.scale[3],
  },
  dividerLabel: { ...Typography.app.caption, flexShrink: 0 },
  legal: { ...Typography.app.caption, textAlign: 'center', lineHeight: 16 },
});
