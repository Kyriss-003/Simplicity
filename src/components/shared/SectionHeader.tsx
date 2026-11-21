import { useLayoutEffect, useRef, useState } from 'react';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';

export function SectionHeader({
  title,
  theme,
  tabs,
  activeTab,
  onSelectTab,
}: {
  title?: string;
  theme: Theme;
  tabs?: string[];
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}) {
  const ink = surfaceTheme(theme);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pillRect, setPillRect] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useLayoutEffect(() => {
    if (!tabs || !activeTab) return;
    const btn = tabRefs.current[activeTab];
    const track = trackRef.current;
    if (btn && track) {
      setPillRect({
        left: btn.offsetLeft,
        width: btn.offsetWidth,
      });
    }
  }, [tabs, activeTab]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        minHeight: 36,
        marginBottom: 8,
        flexWrap: 'wrap',
      }}
    >
      {title ? (
        <h2 style={{ margin: 0, ...Typography.app.cardHeader, color: theme.text }}>{title}</h2>
      ) : (
        <div />
      )}

      {tabs && tabs.length > 0 && activeTab && onSelectTab ? (
        <div
          ref={trackRef}
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            padding: 3,
            borderRadius: Radius.full,
            backgroundColor: theme.surfaceRaised,
            border: `1px solid ${ink.border}`,
          }}
        >
          {pillRect.width > 0 ? (
            <div
              style={{
                position: 'absolute',
                top: 3,
                bottom: 3,
                left: pillRect.left,
                width: pillRect.width,
                borderRadius: Radius.full,
                backgroundColor: theme.selectedFill,
                transition: 'left 180ms cubic-bezier(0.2, 0.8, 0.2, 1), width 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                pointerEvents: 'none',
              }}
            />
          ) : null}
          {tabs.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                ref={(el) => {
                  tabRefs.current[tab] = el;
                }}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectTab(tab)}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  border: 'none',
                  backgroundColor: 'transparent',
                  padding: '4px 12px',
                  borderRadius: Radius.full,
                  color: isActive ? theme.selectedText : ink.textMuted,
                  cursor: 'pointer',
                  transition: 'color 150ms ease',
                  ...Typography.app.captionStrong,
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
