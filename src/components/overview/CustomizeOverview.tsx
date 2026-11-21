import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckSquare,
  FileText,
  Pencil,
} from 'lucide-react';
import { Radius, Typography, type Theme } from '../../theme';
import type { LayoutOrder, LayoutSectionKey } from '../../types';
import { ToggleSwitch } from '../shared/ToggleSwitch';

export const SECTION_COPY: Record<
  LayoutSectionKey,
  { label: string; description: string }
> = {
  notes: {
    label: 'Recent / Suggested Notes',
    description: 'A horizontal row of note preview cards.',
  },
  calendar: {
    label: 'Calendar Preview',
    description: 'The next few events on your agenda.',
  },
  tasks: {
    label: 'Tasks Preview',
    description: 'Checklist with an inline add-task row.',
  },
  scratchPad: {
    label: 'Scratch Pad',
    description: 'Quick note with the markdown toolbar.',
  },
};

function renderSectionIcon(key: LayoutSectionKey, color: string) {
  switch (key) {
    case 'notes':
      return <FileText size={16} color={color} />;
    case 'calendar':
      return <CalendarClock size={16} color={color} />;
    case 'tasks':
      return <CheckSquare size={16} color={color} />;
    case 'scratchPad':
      return <Pencil size={16} color={color} />;
  }
}

export function CustomizeOverview({
  theme,
  visible,
  order,
  isSectionVisible,
  onToggle,
  onReorder,
  onClose,
}: {
  theme: Theme;
  visible: boolean;
  isSectionVisible: (id: LayoutSectionKey) => boolean;
  order: LayoutOrder;
  onToggle: (id: LayoutSectionKey) => void;
  onReorder: (from: number, to: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;

  const shown = order.filter(isSectionVisible).length;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: theme.scrim,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Customize overview"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '80vh',
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: Radius.card,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: `0 16px 40px ${theme.shadow}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...Typography.app.cardHeader, color: theme.text }}>Customize</div>
            <div style={{ ...Typography.app.caption, color: theme.textMuted }}>
              Reorder or toggle dashboard blocks. {shown}/{order.length} sections shown.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 40,
              padding: '0 16px',
              borderRadius: Radius.md,
              border: `1px solid ${theme.border}`,
              backgroundColor: theme.pillBg,
              color: theme.text,
              cursor: 'pointer',
              ...Typography.app.body,
            }}
          >
            Done
          </button>
        </div>

        <div style={{ overflowY: 'auto' }}>
          {order.map((section, index) => {
            const copy = SECTION_COPY[section];
            const on = isSectionVisible(section);
            return (
              <div
                key={section}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 56,
                  padding: '8px 0',
                  borderBottom: index < order.length - 1 ? `1px solid ${theme.border}` : 'none',
                }}
              >
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onReorder(index, index - 1)}
                    aria-label={`Move ${copy.label} up`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: Radius.sm,
                      border: `1px solid ${theme.border}`,
                      backgroundColor: 'transparent',
                      color: theme.textMuted,
                      opacity: index === 0 ? 0.35 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: index === 0 ? 'default' : 'pointer',
                    }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={index === order.length - 1}
                    onClick={() => onReorder(index, index + 1)}
                    aria-label={`Move ${copy.label} down`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: Radius.sm,
                      border: `1px solid ${theme.border}`,
                      backgroundColor: 'transparent',
                      color: theme.textMuted,
                      opacity: index === order.length - 1 ? 0.35 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: index === order.length - 1 ? 'default' : 'pointer',
                    }}
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>

                {renderSectionIcon(section, on ? theme.accent : theme.textMuted)}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...Typography.app.body, color: theme.text }}>{copy.label}</div>
                  <div
                    style={{
                      ...Typography.app.caption,
                      color: theme.textMuted,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copy.description}
                  </div>
                </div>

                <ToggleSwitch
                  theme={theme}
                  value={on}
                  onValueChange={() => onToggle(section)}
                  accessibilityLabel={copy.label}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
