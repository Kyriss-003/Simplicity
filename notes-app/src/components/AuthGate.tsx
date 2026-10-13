import { useEffect, useState, type ReactNode } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { THEMES, withAccent } from '../theme';
import { usePrefsStore } from '../store/usePrefsStore';
import { useAuthStore } from '../store/useAuthStore';
import { AuthScreen } from '../screens/AuthScreen';

/**
 * Auth gate: shows the auth screen until a session exists, then renders the
 * app. Restores the persisted Supabase session on mount.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const [started, setStarted] = useState(false);

  const themeName = usePrefsStore((s) => s.themeName);
  const accentName = usePrefsStore((s) => s.accent);
  const theme = withAccent(THEMES[themeName], accentName);

  useEffect(() => {
    if (!started) {
      setStarted(true);
      void initializeAuth();
    }
  }, [started, initializeAuth]);

  // While the persisted session is being restored, hold a loading screen so we
  // do not flash the auth form at a returning signed-in user.
  if (isLoading && !session) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
