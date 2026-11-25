import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
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
  centered = false,
  onSelectDay,
  onDismiss,
}: {
  theme: Theme;
  anchor: MonthPickerAnchor | null;
  selected: Date;
  events: readonly Event[];
  centered?: boolean;
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
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss();
      }
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
  const width = Math.min(340, Math.max(280, Math.round(vw * 0.9)));
  const allWeeks = monthGrid(browsing);
  const weeks = allWeeks.filter((week, idx) =>
    idx < 5 ? true : week.some((d) => isSameMonth(d, browsing))
  );
  const cardHeight = weeks.length * 40 + 140;
  const left = Math.min(Math.max(anchor.x, 8), Math.max(8, vw - width - 8));
  const top = Math.min(Math.max(anchor.y, 8), Math.max(8, vh - cardHeight - 8));

  return createPortal(
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        ...(centered
          ? {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              backgroundColor: theme.scrim,
              backdropFilter: 'blur(4px)',
            }
          : {}),
      }}
    >
      <div
        role="dialog"
        aria-modal={centered || undefined}
        aria-label="Choose a date"
        onClick={(e) => e.stopPropagation()}
        style={{
          ...(centered
            ? { width: '100%', maxWidth: 320 }
            : { position: 'fixed', top, left, width }),
          backgroundColor: theme.surface,
          border: `1px solid ${ink.border}`,
          borderRadius: Radius.modal,
          padding: centered ? 16 : '10px 12px 12px 12px',
          boxShadow: `0 16px 40px ${theme.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {centered ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...Typography.app.cardHeader, color: ink.text }}>Date</span>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Close date picker"
              style={{
                width: 34,
                height: 34,
                borderRadius: Radius.md,
                border: 'none',
                backgroundColor: 'transparent',
                color: ink.textMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 38,
          }}
        >
          <button
            type="button"
            onClick={() => setBrowsing((m) => addMonths(m, -1))}
            aria-label="Previous month"
            style={{
              width: 34,
              height: 34,
              borderRadius: Radius.md,
              border: 'none',
              backgroundColor: ink.pillBg,
              color: ink.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={16} />
          </button>

          <span style={{ ...Typography.app.bodyStrong, color: ink.text }}>
            {monthYearLabel(browsing)}
          </span>

          <button
            type="button"
            onClick={() => setBrowsing((m) => addMonths(m, 1))}
            aria-label="Next month"
            style={{
              width: 34,
              height: 34,
              borderRadius: Radius.md,
              border: 'none',
              backgroundColor: ink.pillBg,
              color: ink.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: 4,
          }}
        >
          {WEEKDAY_SHORT.map((label) => (
            <div
              key={label}
              style={{
                textAlign: 'center',
                ...Typography.app.caption,
                color: ink.textMuted,
                height: 22,
                lineHeight: '22px',
              }}
            >
              {label.slice(0, 2)}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {weeks.map((week, wi) => (
            <div
              key={wi}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}
            >
              {week.map((day) => {
                const inMonth = isSameMonth(day, browsing);
                const isSel = isSameDay(day, selected);
                const isTod = isToday(day);
                const dayEvents = inMonth ? eventsOnDay(events, day) : [];
                const leadPriority = dayEvents[0]?.priority;
                const dotColor = leadPriority ? ink.priority[leadPriority] : theme.accent;
                const cellKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;

                return (
                  <button
                    key={cellKey}
                    type="button"
                    onClick={() => pick(day)}
                    style={{
                      height: 38,
                      borderRadius: Radius.md,
                      border:
                        isTod && !isSel && inMonth
                          ? `1px solid ${theme.accent}`
                          : '1px solid transparent',
                      backgroundColor: isSel ? theme.accent : 'transparent',
                      color: isSel
                        ? theme.accentText
                        : inMonth
                          ? ink.text
                          : ink.textMuted,
                      opacity: inMonth ? 1 : 0.28,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      padding: 0,
                      cursor: 'pointer',
                      fontVariantNumeric: 'tabular-nums',
                      ...(isSel ? Typography.app.bodyStrong : Typography.app.body),
                    }}
                  >
                    <span style={{ lineHeight: '16px' }}>{day.getDate()}</span>
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: Radius.full,
                        backgroundColor:
                          dayEvents.length > 0
                            ? isSel
                              ? theme.accentText
                              : dotColor
                            : 'transparent',
                      }}
                    />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {centered ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
            <button
              type="button"
              onClick={() => pick(new Date())}
              style={{
                height: 36,
                padding: '0 12px',
                borderRadius: Radius.lg,
                border: `1px solid ${ink.border}`,
                backgroundColor: ink.pillBg,
                color: ink.text,
                cursor: 'pointer',
                ...Typography.app.captionStrong,
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={onDismiss}
              style={{
                height: 36,
                padding: '0 12px',
                borderRadius: Radius.lg,
                border: 'none',
                backgroundColor: 'transparent',
                color: ink.textMuted,
                cursor: 'pointer',
                ...Typography.app.captionStrong,
              }}
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
