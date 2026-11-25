import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarClock,
  CheckSquare,
  FileText,
  Menu,
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
  const draggedIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
              Drag the hamburger grip to reorder blocks. {shown}/{order.length} sections shown.
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

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {order.map((section, index) => {
            const copy = SECTION_COPY[section];
            const on = isSectionVisible(section);
            const isDraggingOver = dragOverIndex === index;
            return (
              <div
                key={section}
                draggable
                onDragStart={(e) => {
                  draggedIndexRef.current = index;
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== index) {
                    setDragOverIndex(index);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverIndex === index) {
                    setDragOverIndex(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = draggedIndexRef.current;
                  if (from !== null && from !== index) {
                    onReorder(from, index);
                  }
                  draggedIndexRef.current = null;
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  draggedIndexRef.current = null;
                  setDragOverIndex(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 56,
                  padding: '8px 12px',
                  borderRadius: Radius.md,
                  backgroundColor: isDraggingOver ? theme.pillBg : theme.surfaceRaised,
                  border: `1px solid ${isDraggingOver ? theme.accent : theme.border}`,
                  cursor: 'grab',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div
                  aria-label={`Drag to reorder ${copy.label}`}
                  title="Hold and drag to reorder"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: Radius.sm,
                    color: theme.textMuted,
                    cursor: 'grab',
                    flexShrink: 0,
                  }}
                >
                  <Menu size={18} />
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
