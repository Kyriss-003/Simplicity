import { useState, type FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Radius, Typography, THEMES, withAccent } from '../theme';
import { useAuthStore } from '../store/useAuthStore';
import { usePrefsStore } from '../store/usePrefsStore';

export function AuthScreen({ onBack }: { onBack: () => void }) {
  const themeName = usePrefsStore((s) => s.themeName);
  const accent = usePrefsStore((s) => s.accent);
  const theme = withAccent(THEMES[themeName], accent);

  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail);
  const error = useAuthStore((s) => s.error);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, fullName);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: theme.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: Radius.modal,
          padding: 24,
          boxShadow: `0 16px 40px ${theme.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to welcome"
            style={{
              width: 36,
              height: 36,
              borderRadius: Radius.md,
              border: `1px solid ${theme.border}`,
              backgroundColor: 'transparent',
              color: theme.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ ...Typography.app.cardHeader, color: theme.text }}>
              {mode === 'signin' ? 'Sign in to Simplicity' : 'Create your workspace'}
            </div>
            <div style={{ ...Typography.app.caption, color: theme.textMuted }}>
              Notes, events, and preferences stay local to this browser.
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'signup' ? (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ ...Typography.app.captionStrong, color: theme.text }}>Name</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                style={{
                  height: 44,
                  padding: '0 12px',
                  borderRadius: Radius.input,
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.background,
                  color: theme.text,
                  ...Typography.app.body,
                }}
              />
            </label>
          ) : null}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ ...Typography.app.captionStrong, color: theme.text }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              style={{
                height: 44,
                padding: '0 12px',
                borderRadius: Radius.input,
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.background,
                color: theme.text,
                ...Typography.app.body,
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ ...Typography.app.captionStrong, color: theme.text }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 4 characters"
              required
              style={{
                height: 44,
                padding: '0 12px',
                borderRadius: Radius.input,
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.background,
                color: theme.text,
                ...Typography.app.body,
              }}
            />
          </label>

          {error ? (
            <div style={{ ...Typography.app.caption, color: theme.error }}>{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            style={{
              height: 48,
              borderRadius: Radius.button,
              border: 'none',
              backgroundColor: theme.accent,
              color: theme.accentText,
              cursor: 'pointer',
              marginTop: 4,
              ...Typography.app.bodyStrong,
            }}
          >
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            color: theme.textMuted,
            cursor: 'pointer',
            ...Typography.app.caption,
          }}
        >
          {mode === 'signin'
            ? "Don't have an account? Create one"
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
