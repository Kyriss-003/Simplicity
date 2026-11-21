import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';

export function ConfirmDialog({
  visible,
  theme,
  title,
  message,
  confirmLabel = 'Delete',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  theme: Theme;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ink = surfaceTheme(theme);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onCancel]);

  if (!visible) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: theme.scrim,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: theme.surfaceRaised,
          border: `1px solid ${ink.border}`,
          borderRadius: Radius.modal,
          padding: 20,
          boxShadow: `0 16px 40px ${theme.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ ...Typography.app.cardHeader, color: ink.text }}>{title}</div>
        <div style={{ ...Typography.app.body, color: ink.textMuted }}>{message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: 40,
              padding: '0 16px',
              borderRadius: Radius.button,
              border: `1px solid ${ink.border}`,
              backgroundColor: 'transparent',
              color: ink.text,
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              height: 40,
              padding: '0 16px',
              borderRadius: Radius.button,
              border: 'none',
              backgroundColor: destructive ? theme.error : theme.accent,
              color: destructive ? theme.errorText : theme.accentText,
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
