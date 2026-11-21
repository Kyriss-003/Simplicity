import { Mail } from 'lucide-react';
import { GlobeView } from './GlobeView';

function GoogleG() {
  const quadrants = [
    { color: '#4285F4', left: 0, top: 0, ix: 0, iy: 0 },
    { color: '#EA4335', left: 10, top: 0, ix: -10, iy: 0 },
    { color: '#FBBC05', left: 0, top: 10, ix: 0, iy: -10 },
    { color: '#34A853', left: 10, top: 10, ix: -10, iy: -10 },
  ];
  return (
    <span aria-label="Google logo" style={{ width: 20, height: 20, position: 'relative', display: 'inline-block' }}>
      {quadrants.map((q) => (
        <span
          key={q.color}
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            left: q.left,
            top: q.top,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              position: 'absolute',
              width: 20,
              height: 20,
              left: q.ix,
              top: q.iy,
              color: q.color,
              fontSize: 20,
              lineHeight: '20px',
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            G
          </span>
        </span>
      ))}
    </span>
  );
}

export function WelcomeScreen({
  onContinueWithEmail,
  onContinueWithGoogle,
  isLoading = false,
  error = null,
}: {
  onContinueWithEmail: () => void;
  onContinueWithGoogle: () => void;
  isLoading?: boolean;
  error?: string | null;
}) {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '24px 24px 40px 24px',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          minHeight: 280,
        }}
      >
        <GlobeView />
      </div>

      <h1
        style={{
          margin: 0,
          color: '#ffffff',
          fontSize: 36,
          fontWeight: 600,
          textAlign: 'center',
          lineHeight: '42px',
        }}
      >
        Ready to be productive?
      </h1>
      <p
        style={{
          margin: '8px 0 18px 0',
          color: '#8e8e8e',
          fontSize: 14,
          fontWeight: 400,
          textAlign: 'center',
        }}
      >
        Your journey starts from here
      </p>

      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          type="button"
          onClick={onContinueWithEmail}
          disabled={isLoading}
          style={{
            height: 56,
            borderRadius: 28,
            border: 'none',
            backgroundColor: '#f5f5f5',
            color: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          <Mail size={20} color="#0a0a0a" />
          <span>Continue with Email</span>
        </button>

        <button
          type="button"
          onClick={onContinueWithGoogle}
          disabled={isLoading}
          style={{
            height: 56,
            borderRadius: 28,
            border: 'none',
            backgroundColor: '#262626',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          <GoogleG />
          <span>Continue with Google</span>
        </button>

        {error ? (
          <div style={{ color: '#e5786a', fontSize: 12, textAlign: 'center', marginTop: 4 }}>{error}</div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginTop: 16,
          color: '#8e8e8e',
          fontSize: 12,
        }}
      >
        <span style={{ textDecoration: 'underline' }}>Local-First Storage</span>
        <span>·</span>
        <span style={{ textDecoration: 'underline' }}>Privacy First</span>
      </div>
    </div>
  );
}
