import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { WelcomeScreen } from './welcome/WelcomeScreen';
import { AuthScreen } from '../screens/AuthScreen';

export function AuthGate({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const initialize = useAuthStore((s) => s.initialize);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [showEmailAuth, setShowEmailAuth] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          backgroundColor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f5f5f5',
          fontSize: 14,
        }}
      >
        Loading Simplicity…
      </div>
    );
  }

  if (!user) {
    if (showEmailAuth) {
      return <AuthScreen onBack={() => setShowEmailAuth(false)} />;
    }
    return (
      <WelcomeScreen
        onContinueWithEmail={() => setShowEmailAuth(true)}
        onContinueWithGoogle={() => {
          void signInWithGoogle();
        }}
        error={error}
      />
    );
  }

  return <>{children}</>;
}
