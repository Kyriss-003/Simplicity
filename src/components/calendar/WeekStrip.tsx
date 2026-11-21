import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import type { Event } from '../../types';
import { eventsOnDay, isSameDay, isToday, weekOf, weekdayShortLabel } from './calendarUtils';

export function WeekStrip({
  theme,
  day,
  events,
  onSelectDay,
}: {
  theme: Theme;
  day: Date;
  events: readonly Event[];
  onSelectDay: (day: Date) => void;
}) {
  const ink = surfaceTheme(theme);
  const days = weekOf(day);

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 4 }}>
      {days.map((d) => {
        const selected = isSameDay(d, day);
        const today = isToday(d);
        const dayEvents = eventsOnDay(events, d);
        const count = dayEvents.length;
        const leadPriority = dayEvents[0]?.priority;
        const ramp = selected ? ink.priority : theme.priority;
        const dotColour =
          (leadPriority && ramp[leadPriority]) || (selected || today ? theme.accent : ink.textMuted);

        return (
          <button
            key={d.toDateString()}
            type="button"
            onClick={() => onSelectDay(d)}
            aria-pressed={selected}
            aria-label={`${weekdayShortLabel(d)} ${d.getDate()}, ${count} ${count === 1 ? 'event' : 'events'}`}
            style={{
              flex: 1,
              minWidth: 0,
              height: 56,
              border: 'none',
              borderRadius: Radius.md,
              backgroundColor: selected ? ink.pillBg : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              cursor: 'pointer',
            }}
          >
            <span style={{ ...Typography.app.caption, color: selected ? theme.accent : ink.textMuted }}>
              {weekdayShortLabel(d)}
            </span>
            <span
              style={{
                ...Typography.app.bodyStrong,
                color: selected || today ? theme.accent : ink.text,
              }}
            >
              {d.getDate()}
            </span>
            <div style={{ display: 'flex', gap: 2, height: 4, alignItems: 'center' }}>
              {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                <span
                  key={i}
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: Radius.full,
                    backgroundColor: dotColour,
                  }}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
