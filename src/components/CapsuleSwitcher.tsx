import { useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, FileText, LayoutDashboard } from 'lucide-react';
import { Radius, Typography, surfaceTheme, type Theme } from '../theme';
import { DOCK_SCREENS, type DockVariant, type ScreenKey } from '../types';

function renderDockIcon(key: ScreenKey, size: number, color: string) {
  switch (key) {
    case 'Overview':
      return <LayoutDashboard size={size} color={color} />;
    case 'Notes':
      return <FileText size={size} color={color} />;
    case 'Agenda':
      return <CalendarDays size={size} color={color} />;
    default:
      return null;
  }
}

export function CapsuleSwitcher({
  theme,
  active,
  onSelect,
  variant = 'iconLabel',
}: {
  theme: Theme;
  active: ScreenKey;
  onSelect: (k: ScreenKey) => void;
  variant?: DockVariant;
}) {
  const ink = surfaceTheme(theme);
  const { selectedFill, selectedText } = theme;
  const slotRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pillRect, setPillRect] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const el = slotRefs.current[active];
    if (el) {
      setPillRect({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [active, variant]);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: Radius.full,
        border: `1px solid ${ink.border}`,
        backgroundColor: theme.surfaceRaised,
        boxShadow: `0 4px 12px ${theme.shadow}`,
        padding: 4,
      }}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
        {pillRect.width > 0 ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: pillRect.left,
              width: pillRect.width,
              borderRadius: Radius.full,
              backgroundColor: selectedFill,
              transition: 'left 200ms cubic-bezier(0.2, 0.8, 0.2, 1), width 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              pointerEvents: 'none',
            }}
          />
        ) : null}

        {DOCK_SCREENS.map((key) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              ref={(el) => {
                slotRefs.current[key] = el;
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={key}
              onClick={() => onSelect(key)}
              style={{
                position: 'relative',
                zIndex: 1,
                border: 'none',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: variant === 'icon' ? '8px 12px' : '9px 12px',
                minWidth: variant === 'icon' ? 40 : undefined,
                borderRadius: Radius.full,
                cursor: 'pointer',
                color: isActive ? selectedText : ink.textMuted,
                transition: 'color 150ms ease',
                ...Typography.app.captionStrong,
              }}
            >
              {variant !== 'label'
                ? renderDockIcon(key, 14, isActive ? selectedText : ink.text)
                : null}
              {variant !== 'icon' ? <span>{key}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DockVariantPreview({
  theme,
  variant,
}: {
  theme: Theme;
  variant: DockVariant;
}) {
  const ink = surfaceTheme(theme);
  const { selectedFill, selectedText } = theme;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: Radius.full,
        border: `1px solid ${ink.border}`,
        backgroundColor: theme.surfaceRaised,
        padding: 3,
        gap: 2,
      }}
    >
      {DOCK_SCREENS.map((key, index) => {
        const isActive = index === 0;
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              minHeight: 24,
              padding: variant === 'icon' ? '0 8px' : '0 8px',
              borderRadius: Radius.full,
              backgroundColor: isActive ? selectedFill : 'transparent',
              color: isActive ? selectedText : ink.textMuted,
              ...Typography.app.captionStrong,
            }}
          >
            {variant !== 'label'
              ? renderDockIcon(key, 12, isActive ? selectedText : ink.text)
              : null}
            {variant !== 'icon' ? <span>{key}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
