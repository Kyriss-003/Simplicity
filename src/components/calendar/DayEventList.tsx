import { useState } from 'react';
import { Pin, Plus } from 'lucide-react';
import { Radius, Typography, primaryTheme, surfaceTheme, type Theme } from '../../theme';
import type { Event } from '../../types';
import { durationLabel, minutesFromMidnight, timePreciseLabel } from './calendarUtils';
import { Card } from '../shared/Card';
import { ContextMenu, type ContextMenuAction } from '../shared/ContextMenu';

const ROW_HEIGHT = 48;

export function DayEventList({
  theme,
  events,
  onOpenEvent,
  onDeleteEvent,
  onAdd,
  primary = false,
}: {
  theme: Theme;
  events: Event[];
  onOpenEvent: (event: Event) => void;
  onDeleteEvent: (id: number) => void;
  onAdd: () => void;
  primary?: boolean;
}) {
  const ink = primary ? primaryTheme(theme) : surfaceTheme(theme);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuEventId, setMenuEventId] = useState<number | null>(null);

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuEventId(null);
  };

  const menuEvent = menuEventId === null ? null : events.find((e) => e.id === menuEventId);
  const menuActions: ContextMenuAction[] = !menuEvent
    ? []
    : [
        {
          label: 'Edit',
          iconName: 'pencil-outline',
          onPress: () => {
            closeMenu();
            onOpenEvent(menuEvent);
          },
        },
        {
          label: 'Delete',
          iconName: 'trash-can-outline',
          destructive: true,
          onPress: () => onDeleteEvent(menuEvent.id),
        },
      ];

  return (
    <Card theme={ink} style={{ padding: '4px 16px' }}>
      {events.map((ev) => {
        const minutes = minutesFromMidnight(ev.startsAt);
        const priority = ev.priority;

        return (
          <button
            key={ev.id}
            type="button"
            onClick={() => onOpenEvent(ev)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuEventId(ev.id);
              setMenuAnchor({ x: e.pageX, y: e.pageY });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              height: ROW_HEIGHT,
              border: 'none',
              borderBottom: `1px solid ${ink.border}`,
              backgroundColor: 'transparent',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                width: 4,
                height: 20,
                borderRadius: Radius.full,
                flexShrink: 0,
                backgroundColor: priority ? ink.priority[priority] : 'transparent',
              }}
            />

            <span style={{ ...Typography.app.body, color: ink.textMuted, width: 72, flexShrink: 0 }}>
              {minutes === null ? '—' : timePreciseLabel(minutes)}
            </span>

            <span
              style={{
                ...Typography.app.bodyStrong,
                color: ink.text,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ev.title}
            </span>

            {ev.isPinned ? <Pin size={14} color={theme.accent} style={{ flexShrink: 0 }} /> : null}

            <span
              style={{
                ...Typography.app.caption,
                color: ink.textMuted,
                width: 64,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {durationLabel(ev.durationMinutes)}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        aria-label="Add an event to this day"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          height: ROW_HEIGHT,
          border: 'none',
          backgroundColor: 'transparent',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ width: 84, flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} color={theme.accent} />
          <span style={{ ...Typography.app.bodyStrong, color: theme.accent }}>Add event</span>
        </div>
      </button>

      <ContextMenu anchor={menuAnchor} actions={menuActions} onDismiss={closeMenu} theme={theme} />
    </Card>
  );
}
