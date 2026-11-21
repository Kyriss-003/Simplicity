import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import type { Event } from '../../types';
import {
  WEEKDAY_SHORT,
  addMonths,
  eventsOnDay,
  isSameDay,
  isSameMonth,
  isToday,
  monthGrid,
  monthYearLabel,
} from './calendarUtils';

export interface MonthPickerAnchor {
  x: number;
  y: number;
  width: number;
}

export function MonthPickerPopover({
  theme,
  anchor,
  selected,
  events,
  onSelectDay,
  onDismiss,
}: {
  theme: Theme;
  anchor: MonthPickerAnchor | null;
  selected: Date;
  events: readonly Event[];
  onSelectDay: (day: Date) => void;
  onDismiss: () => void;
}) {
  const ink = surfaceTheme(theme);
  const [browsing, setBrowsing] = useState(selected);

  useEffect(() => {
    if (anchor) setBrowsing(selected);
  }, [anchor, selected]);

  useEffect(() => {
    if (!anchor) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [anchor, onDismiss]);

  const pick = useCallback(
    (day: Date) => {
      onSelectDay(day);
      onDismiss();
    },
    [onSelectDay, onDismiss]
  );

  if (!anchor) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const width = Math.min(360, Math.max(280, Math.round(vw * 0.9)));
  const cardHeight = 380;
  const left = Math.min(Math.max(anchor.x, 8), Math.max(8, vw - width - 8));
  const top = Math.min(Math.max(anchor.y, 8), Math.max(8, vh - cardHeight - 8));
  const weeks = monthGrid(browsing);

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200 }} onClick={onDismiss}>
      <div
        role="dialog"
        aria-label="Choose a date"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top,
          left,
          width,
          backgroundColor: theme.surface,
          border: `1px solid ${ink.border}`,
          borderRadius: Radius.modal,
          padding: '8px 10px 12px 10px',
          boxShadow: `0 8px 24px ${theme.shadow}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 44,
          }}
        >
          <button
            type="button"
            onClick={() => setBrowsing((m) => addMonths(m, -1))}
            aria-label="Previous month"
            style={{
              width: 36,
              height: 36,
              borderRadius: Radius.md,
              border: 'none',
              backgroundColor: 'transparent',
              color: ink.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={18} />
          </button>

          <span style={{ ...Typography.app.cardHeader, color: ink.text }}>
            {monthYearLabel(browsing)}
          </span>

          <button
            type="button"
            onClick={() => setBrowsing((m) => addMonths(m, 1))}
            aria-label="Next month"
            style={{
              width: 36,
              height: 36,
              borderRadius: Radius.md,
              border: 'none',
              backgroundColor: 'transparent',
              color: ink.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
            marginBottom: 4,
          }}
        >
          {WEEKDAY_SHORT.map((label) => (
            <div
              key={label}
              style={{
                textAlign: 'center',
                ...Typography.app.caption,
                color: ink.textMuted,
                height: 24,
                lineHeight: '24px',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {weeks.map((week, wi) => (
            <div
              key={wi}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}
            >
              {week.map((day) => {
                const inMonth = isSameMonth(day, browsing);
                const isSel = isSameDay(day, selected);
                const isTod = isToday(day);
                const dayEvents = eventsOnDay(events, day);
                const leadPriority = dayEvents[0]?.priority;
                const dotColor = leadPriority ? ink.priority[leadPriority] : theme.accent;

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => pick(day)}
                    style={{
                      height: 44,
                      borderRadius: Radius.md,
                      border: isTod && !isSel ? `1px solid ${theme.accent}` : '1px solid transparent',
                      backgroundColor: isSel ? theme.accent : 'transparent',
                      color: isSel
                        ? theme.accentText
                        : inMonth
                          ? ink.text
                          : ink.textMuted,
                      opacity: inMonth ? 1 : 0.45,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      cursor: 'pointer',
                      ...Typography.app.bodyStrong,
                    }}
                  >
                    <span>{day.getDate()}</span>
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: Radius.full,
                        backgroundColor: dayEvents.length > 0 ? (isSel ? theme.accentText : dotColor) : 'transparent',
                      }}
                    />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
