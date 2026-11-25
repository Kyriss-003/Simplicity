import { useEffect, useRef } from 'react';
import { CalendarPlus, CheckSquare, FilePlus2, Plus } from 'lucide-react';
import { Radius, Typography, surfaceTheme, type Theme } from '../theme';
import type { FabVariant } from '../types';

export interface FabAction {
  label: string;
  iconName: 'note' | 'task' | 'event';
  onPress: () => void;
}

function renderFabIcon(name: FabAction['iconName'], color: string, size = 16) {
  switch (name) {
    case 'note':
      return <FilePlus2 size={size} color={color} />;
    case 'task':
      return <CheckSquare size={size} color={color} />;
    case 'event':
      return <CalendarPlus size={size} color={color} />;
  }
}

export function FloatingActionFab({
  theme,
  isOpen,
  onToggle,
  actions,
  variant = 'iconLabel',
}: {
  theme: Theme;
  isOpen: boolean;
  onToggle: () => void;
  actions: FabAction[];
  variant?: FabVariant;
}) {
  const ink = surfaceTheme(theme);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <>
      {isOpen ? (
        <div
          onClick={onToggle}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 19,
            backgroundColor: theme.shadow,
            backdropFilter: 'blur(10px)',
          }}
        />
      ) : null}

      <div
        onMouseEnter={() => {
          if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = undefined;
          }
        }}
        onMouseLeave={() => {
          if (!isOpen) return;
          closeTimer.current = setTimeout(() => {
            onToggle();
          }, 150);
        }}
        style={{
          position: 'fixed',
          bottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
          right: 'max(16px, env(safe-area-inset-right, 16px))',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
            paddingBottom: 10,
            pointerEvents: isOpen ? 'auto' : 'none',
          }}
        >
          {isOpen && variant === 'icon' && actions.length > 1 ? (
            <div style={{ ...Typography.app.caption, color: ink.textMuted, paddingRight: 8 }}>
              Create
            </div>
          ) : null}

          {actions.map((action, index) => {
            const delay = (actions.length - 1 - index) * 30;
            return (
              <button
                key={action.label}
                type="button"
                aria-label={action.label}
                onClick={action.onPress}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: variant === 'icon' ? 'center' : 'flex-start',
                  gap: 8,
                  padding: variant === 'icon' ? 0 : '8px 16px',
                  width: variant === 'icon' ? 48 : undefined,
                  height: variant === 'icon' ? 48 : undefined,
                  borderRadius: variant === 'icon' ? Radius.full : Radius.lg,
                  backgroundColor: theme.surfaceRaised,
                  border: `1px solid ${ink.border}`,
                  boxShadow: `0 4px 12px ${theme.shadow}`,
                  cursor: 'pointer',
                  opacity: isOpen ? 1 : 0,
                  transform: isOpen ? 'translateY(0)' : 'translateY(12px)',
                  transition: `opacity 160ms ease ${delay}ms, transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1) ${delay}ms`,
                  pointerEvents: isOpen ? 'auto' : 'none',
                }}
              >
                {variant !== 'label' ? (
                  <span
                    style={{
                      width: variant === 'icon' ? 24 : 28,
                      height: variant === 'icon' ? 24 : 28,
                      borderRadius: Radius.md,
                      backgroundColor: variant === 'icon' ? 'transparent' : ink.pillBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {renderFabIcon(action.iconName, ink.text, 16)}
                  </span>
                ) : null}
                {variant !== 'icon' ? (
                  <span style={{ ...Typography.app.bodyStrong, color: ink.text, whiteSpace: 'nowrap' }}>
                    {action.label}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Create new"
          onClick={onToggle}
          onMouseEnter={() => {
            if (!isOpen) onToggle();
          }}
          style={{
            width: 56,
            height: 56,
            borderRadius: Radius.full,
            border: 'none',
            backgroundColor: theme.accent,
            color: theme.accentText,
            boxShadow: `0 6px 16px ${theme.shadow}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
              transition: 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            <Plus size={26} color={theme.accentText} />
          </span>
        </button>
      </div>
    </>
  );
}

export function FabMenuPreview({ theme, variant }: { theme: Theme; variant: FabVariant }) {
  const ink = surfaceTheme(theme);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: variant === 'icon' ? 'center' : 'flex-start',
        gap: 8,
        width: variant === 'icon' ? 40 : undefined,
        height: variant === 'icon' ? 40 : undefined,
        padding: variant === 'icon' ? 0 : '6px 12px',
        borderRadius: variant === 'icon' ? Radius.full : Radius.lg,
        backgroundColor: theme.surfaceRaised,
        border: `1px solid ${ink.border}`,
      }}
    >
      {variant !== 'label' ? (
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: Radius.md,
            backgroundColor: variant === 'icon' ? 'transparent' : ink.pillBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FilePlus2 size={variant === 'icon' ? 14 : 12} color={ink.text} />
        </span>
      ) : null}
      {variant !== 'icon' ? (
        <span style={{ ...Typography.app.captionStrong, color: ink.text }}>New Note</span>
      ) : null}
    </div>
  );
}
