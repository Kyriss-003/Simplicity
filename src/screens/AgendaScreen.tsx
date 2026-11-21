import { useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { Layout, Radius, Typography, surfaceTheme, type Theme } from '../theme';
import type { Event, Task } from '../types';
import {
  addDays,
  dayHeadingLabel,
  eventsOnDay,
  isSameDay,
  nextFreeSlot,
} from '../components/calendar/calendarUtils';
import { WeekStrip } from '../components/calendar/WeekStrip';
import { DayEventList } from '../components/calendar/DayEventList';
import { MonthPickerPopover, type MonthPickerAnchor } from '../components/calendar/MonthPickerPopover';
import { TasksCard } from '../components/cards/TasksCard';

export function AgendaScreen({
  theme,
  isMobile,
  anchor,
  onAnchorChange,
  events,
  onCreateEvent,
  onOpenEvent,
  onDeleteEvent,
  tasks,
  newTask,
  onNewTaskChange,
  onAddTask,
  onToggleTask,
  onToggleSidebar,
}: {
  theme: Theme;
  isMobile: boolean;
  anchor: Date;
  onAnchorChange: (date: Date) => void;
  events: Event[];
  onCreateEvent: (start: Date) => void;
  onOpenEvent: (event: Event) => void;
  onDeleteEvent: (id: number) => void;
  tasks: Task[];
  newTask: string;
  onNewTaskChange: (t: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: number) => void;
  onToggleSidebar?: () => void;
}) {
  const ink = surfaceTheme(theme);
  const dayEvents = eventsOnDay(events, anchor);
  const isTodaySelected = isSameDay(anchor, new Date());
  const [monthAnchor, setMonthAnchor] = useState<MonthPickerAnchor | null>(null);
  const headingRef = useRef<HTMLButtonElement>(null);

  const openMonthPicker = () => {
    const rect = headingRef.current?.getBoundingClientRect();
    if (!rect) {
      setMonthAnchor({ x: 16, y: 80, width: 280 });
      return;
    }
    setMonthAnchor({ x: rect.left, y: rect.bottom + 4, width: rect.width });
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div
        style={{
          width: '100%',
          maxWidth: Layout.contentMaxWidth,
          margin: '0 auto',
          padding: isMobile ? '16px 16px 120px 16px' : '24px 24px 120px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {onToggleSidebar ? (
              <button
                type="button"
                onClick={onToggleSidebar}
                aria-label="Open sidebar"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: Radius.md,
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

            <button
              ref={headingRef}
              type="button"
              onClick={openMonthPicker}
              aria-label={`${dayHeadingLabel(anchor)}. Choose a date.`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 6px',
                border: 'none',
                backgroundColor: 'transparent',
                color: theme.text,
                cursor: 'pointer',
                ...Typography.app.cardHeader,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dayHeadingLabel(anchor)}
              </span>
              <ChevronDown size={18} color={theme.textMuted} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => onAnchorChange(addDays(anchor, -1))}
              aria-label="Previous day"
              style={{
                width: 40,
                height: 40,
                borderRadius: Radius.lg,
                border: 'none',
                backgroundColor: 'transparent',
                color: theme.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={20} />
            </button>

            <button
              type="button"
              disabled={isTodaySelected}
              onClick={() => onAnchorChange(new Date())}
              aria-label="Jump to today"
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: Radius.full,
                border: `1px solid ${ink.border}`,
                backgroundColor: 'transparent',
                color: isTodaySelected ? ink.textMuted : theme.accent,
                cursor: isTodaySelected ? 'default' : 'pointer',
                ...Typography.app.caption,
              }}
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => onAnchorChange(addDays(anchor, 1))}
              aria-label="Next day"
              style={{
                width: 40,
                height: 40,
                borderRadius: Radius.lg,
                border: 'none',
                backgroundColor: 'transparent',
                color: theme.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <WeekStrip theme={theme} day={anchor} events={events} onSelectDay={onAnchorChange} />

        <DayEventList
          theme={theme}
          events={dayEvents}
          onOpenEvent={onOpenEvent}
          onDeleteEvent={onDeleteEvent}
          onAdd={() => onCreateEvent(nextFreeSlot(anchor, events))}
        />

        <TasksCard
          theme={theme}
          tasks={tasks}
          newTask={newTask}
          onNewTaskChange={onNewTaskChange}
          onAddTask={onAddTask}
          onToggleTask={onToggleTask}
        />

        <MonthPickerPopover
          theme={theme}
          anchor={monthAnchor}
          selected={anchor}
          events={events}
          onSelectDay={onAnchorChange}
          onDismiss={() => setMonthAnchor(null)}
        />
      </div>
    </div>
  );
}
