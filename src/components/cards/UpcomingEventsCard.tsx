import { CalendarClock, Pin } from 'lucide-react';
import { Radius, Typography, primaryTheme, surfaceTheme, type Theme } from '../../theme';
import type { CalendarEvent } from '../../types';
import { selectUpcomingEvents, upcomingOverflow } from '../calendar/calendarUtils';
import { Card } from '../shared/Card';

const ROW_HEIGHT = 48;

export function UpcomingEventsCard({
  theme,
  events,
  primary = false,
  expanded = false,
}: {
  primary?: boolean;
  expanded?: boolean;
  theme: Theme;
  events: CalendarEvent[];
}) {
  const ink = primary ? primaryTheme(theme) : surfaceTheme(theme);
  const rows = selectUpcomingEvents(events);
  const overflow = upcomingOverflow(events);
  const isEmpty = rows.length === 0;

  return (
    <Card
      theme={ink}
      style={{
        padding: expanded ? '16px 16px' : '4px 16px',
        minHeight: expanded ? 140 : ROW_HEIGHT * 2 + 10,
      }}
    >
      {isEmpty ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 0',
            gap: 8,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: Radius.full,
              backgroundColor: theme.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CalendarClock size={24} color={theme.accentText} />
          </div>
          <div style={{ ...Typography.app.cardHeader, color: ink.text }}>Nothing scheduled</div>
          <div style={{ ...Typography.app.body, color: ink.textMuted, textAlign: 'center' }}>
            Your upcoming events will appear here.
          </div>
        </div>
      ) : (
        rows.map((ev, idx) => (
          <div
            key={`${ev.title}-${idx}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              height: ROW_HEIGHT,
              borderBottom: idx < rows.length - 1 ? `1px solid ${ink.border}` : 'none',
            }}
          >
            <div
              style={{
                width: 4,
                height: 24,
                borderRadius: Radius.sm,
                flexShrink: 0,
                backgroundColor: ev.priority
                  ? primary
                    ? ink.priority[ev.priority]
                    : theme.priority[ev.priority]
                  : theme.accent,
              }}
            />
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
            {ev.pinned ? <Pin size={14} color={theme.accent} style={{ flexShrink: 0 }} /> : null}
            <span
              style={{
                ...Typography.app.caption,
                color: ink.textMuted,
                flexShrink: 0,
                minWidth: 56,
                textAlign: 'right',
              }}
            >
              {ev.time}
            </span>
          </div>
        ))
      )}

      {overflow > 0 ? (
        <div style={{ ...Typography.app.caption, color: ink.textMuted, padding: '12px 0 8px 0' }}>
          {overflow} more in Agenda
        </div>
      ) : null}
    </Card>
  );
}
