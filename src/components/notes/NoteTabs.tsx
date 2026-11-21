import { useState } from 'react';
import { ChevronLeft, ChevronRight, Menu, Plus, X } from 'lucide-react';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';

export interface NoteTab {
  id: number;
  title: string;
}

const STRIP_HEIGHT = 40;
const TAB_WIDTH = 180;

export function NoteTabs({
  theme,
  tabs,
  activeId,
  onSelect,
  onClose,
  onNewTab,
  onStepBack,
  onStepForward,
  onToggleSidebar,
}: {
  theme: Theme;
  tabs: NoteTab[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  onNewTab: () => void;
  onStepBack?: () => void;
  onStepForward?: () => void;
  onToggleSidebar?: () => void;
}) {
  const ink = surfaceTheme(theme);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: STRIP_HEIGHT,
        backgroundColor: theme.surface,
        flexShrink: 0,
      }}
    >
      {onToggleSidebar ? (
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Open sidebar"
          style={{
            width: 48,
            height: STRIP_HEIGHT,
            border: 'none',
            backgroundColor: 'transparent',
            color: ink.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Menu size={20} />
        </button>
      ) : null}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 2,
          padding: '0 8px',
          overflowX: 'auto',
          height: STRIP_HEIGHT,
        }}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          const hoveredTab = hovered === tab.id && !active;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(tab.id);
                }
              }}
              onMouseEnter={() => setHovered(tab.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                height: STRIP_HEIGHT,
                width: TAB_WIDTH,
                flexShrink: 0,
                paddingLeft: 14,
                paddingRight: 36,
                borderTopLeftRadius: Radius.md,
                borderTopRightRadius: Radius.md,
                backgroundColor: active
                  ? theme.background
                  : hoveredTab
                    ? ink.pillBg
                    : 'transparent',
                cursor: 'pointer',
                transition: 'background-color 120ms ease',
              }}
            >
              <span
                style={{
                  ...(active ? Typography.app.bodyStrong : Typography.app.body),
                  color: active ? ink.text : ink.textMuted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                }}
              >
                {tab.title}
              </span>

              <button
                type="button"
                aria-label={`Close ${tab.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  width: 24,
                  height: 24,
                  borderRadius: Radius.full,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: ink.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onNewTab}
          aria-label="New note in a new tab"
          style={{
            width: 40,
            height: STRIP_HEIGHT,
            border: 'none',
            backgroundColor: 'transparent',
            color: ink.textMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            borderTopLeftRadius: Radius.md,
            borderTopRightRadius: Radius.md,
          }}
        >
          <Plus size={18} />
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          height: STRIP_HEIGHT,
          flexShrink: 0,
          gap: 4,
          paddingRight: 8,
        }}
      >
        <button
          type="button"
          disabled={!onStepBack}
          onClick={onStepBack}
          aria-label="Previous note"
          style={{
            width: 28,
            height: STRIP_HEIGHT,
            border: 'none',
            backgroundColor: 'transparent',
            color: ink.textMuted,
            opacity: onStepBack ? 1 : 0.35,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: onStepBack ? 'pointer' : 'default',
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          disabled={!onStepForward}
          onClick={onStepForward}
          aria-label="Next note"
          style={{
            width: 28,
            height: STRIP_HEIGHT,
            border: 'none',
            backgroundColor: 'transparent',
            color: ink.textMuted,
            opacity: onStepForward ? 1 : 0.35,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: onStepForward ? 'pointer' : 'default',
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
