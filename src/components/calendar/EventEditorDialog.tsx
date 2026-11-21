import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Calendar, ChevronDown, ChevronUp, FileText, Repeat, Settings, X } from 'lucide-react';
import { Radius, Typography, contrastRatio, surfaceTheme, type Theme } from '../../theme';
import { EVENT_PRIORITIES, PRIORITY_LABELS, type Event, type EventPriority } from '../../types';
import {
  DAY_START_HOUR,
  DEFAULT_DURATION_MINUTES,
  MINUTE_OPTIONS,
  dayHeadingLabel,
  durationLabel,
  hourOptions,
  minutesFromMidnight,
  startOfDay,
  withTime,
} from './calendarUtils';
import { MonthPickerPopover, type MonthPickerAnchor } from './MonthPickerPopover';

const EVENT_LENGTHS = [30, 60, 1440, 'custom'] as const;

export interface EventDraft {
  title: string;
  notes: string;
  startsAt: string;
  durationMinutes: number;
  priority?: EventPriority;
}

function priorityText(level: EventPriority): string {
  if (level === 'high') return 'Important';
  if (level === 'medium') return 'Normal';
  return PRIORITY_LABELS[level];
}

function editorTimeLabel(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(total / 60);
  const hour12 = hours24 % 12 || 12;
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  return `${String(hour12).padStart(2, '0')}:${String(total % 60).padStart(2, '0')} ${suffix}`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]!);
}

function fullDateLabel(date: Date): string {
  return `${dayHeadingLabel(date)}, ${ordinal(date.getDate())} ${date.getFullYear()}`;
}

export function EventEditorDialog({
  theme,
  visible,
  event,
  events,
  anchorDate,
  onSave,
  onSaveDraft,
  onDismiss,
}: {
  theme: Theme;
  visible: boolean;
  event: Event | null;
  events: readonly Event[];
  anchorDate: Date | null;
  onSave: (draft: EventDraft) => void;
  onSaveDraft?: (draft: EventDraft) => void;
  onDismiss: () => void;
}) {
  const ink = surfaceTheme(theme);
  const darkError = contrastRatio('#b3352a', ink.surface) >= 4.5 ? '#b3352a' : ink.onSurfaceError;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [day, setDay] = useState(() => startOfDay(anchorDate ?? new Date()));
  const [minutes, setMinutes] = useState(DAY_START_HOUR * 60);
  const [duration, setDuration] = useState<number | null>(DEFAULT_DURATION_MINUTES);
  const [customDuration, setCustomDuration] = useState<number | null>(null);
  const [priority, setPriority] = useState<EventPriority | undefined>(undefined);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [lengthOpen, setLengthOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reminder, setReminder] = useState('30 min before');
  const [repeat, setRepeat] = useState('Does not repeat');
  const [reminderOpen, setReminderOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [dateAnchor, setDateAnchor] = useState<MonthPickerAnchor | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!visible) return;
    if (event) {
      const start = new Date(event.startsAt);
      setTitle(event.title);
      setNotes(event.notes ?? '');
      setDay(startOfDay(start));
      setMinutes(minutesFromMidnight(start) ?? DAY_START_HOUR * 60);
      setDuration(event.durationMinutes);
      setPriority(event.priority);
    } else {
      setTitle('');
      setNotes('');
      setDay(startOfDay(anchorDate ?? new Date()));
      setMinutes(DAY_START_HOUR * 60);
      setDuration(DEFAULT_DURATION_MINUTES);
      setPriority(undefined);
    }
    setDateAnchor(null);
    setTimePickerOpen(false);
    setLengthOpen(false);
    setAdvancedOpen(false);
    requestAnimationFrame(() => titleRef.current?.focus());
  }, [visible, event, anchorDate]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onDismiss]);

  if (!visible) return null;

  const hours = hourOptions().map((m) => Math.floor(m / 60));
  const durationMinutes = duration ?? customDuration ?? DEFAULT_DURATION_MINUTES;
  const endTimeLabel = editorTimeLabel(minutes + durationMinutes);

  const buildDraft = (): EventDraft => ({
    title: title.trim() || 'Untitled Event',
    notes: notes.trim(),
    startsAt: withTime(day, minutes).toISOString(),
    durationMinutes,
    priority,
  });

  const openDatePicker = () => {
    const rect = dateTriggerRef.current?.getBoundingClientRect();
    if (!rect) {
      setDateAnchor({ x: 24, y: 120, width: 280 });
      return;
    }
    setDateAnchor({ x: rect.left, y: rect.bottom + 4, width: rect.width });
  };

  return createPortal(
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: theme.scrim,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={event ? 'Edit event' : 'New event'}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 540,
          backgroundColor: theme.surface,
          borderRadius: Radius.modal,
          border: `1px solid ${ink.border}`,
          padding: 16,
          boxShadow: `0 16px 40px ${theme.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxHeight: '90vh',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ ...Typography.app.pageHeader, color: ink.text }}>
            {event ? 'Edit event' : 'New event'}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            style={{
              width: 40,
              height: 40,
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
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 2 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ ...Typography.app.captionStrong, color: ink.text }}>
              Title <span style={{ color: darkError }}>(required)</span>
            </span>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design review with Sam"
              aria-label="Event title"
              style={{
                ...Typography.app.body,
                height: 48,
                borderRadius: 10,
                border: `1px solid ${ink.border}`,
                backgroundColor: theme.background,
                color: ink.text,
                padding: '0 12px',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ ...Typography.app.captionStrong, color: ink.text }}>Date</span>
            <button
              ref={dateTriggerRef}
              type="button"
              onClick={openDatePicker}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: 48,
                borderRadius: Radius.input,
                border: `1px solid ${ink.border}`,
                backgroundColor: ink.pillBg,
                color: ink.text,
                padding: '0 12px',
                cursor: 'pointer',
              }}
            >
              <Calendar size={16} color={ink.textMuted} />
              <span style={{ ...Typography.app.bodyStrong, flex: 1, textAlign: 'center' }}>
                {fullDateLabel(day)}
              </span>
              <ChevronDown size={14} color={ink.textMuted} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
              <span style={{ ...Typography.app.captionStrong, color: ink.text, textAlign: 'center' }}>
                Length
              </span>
              <button
                type="button"
                onClick={() => setLengthOpen((o) => !o)}
                style={{
                  height: 48,
                  borderRadius: Radius.input,
                  border: `1px solid ${ink.border}`,
                  backgroundColor: ink.pillBg,
                  color: ink.text,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '0 8px',
                  ...Typography.app.bodyStrong,
                }}
              >
                <span>{duration === null ? 'Custom' : durationLabel(duration)}</span>
                <ChevronDown size={12} color={ink.textMuted} />
              </button>
              {lengthOpen ? (
                <div
                  style={{
                    borderRadius: Radius.md,
                    border: `1px solid ${ink.border}`,
                    backgroundColor: ink.pillBg,
                    padding: 4,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {EVENT_LENGTHS.map((opt) => {
                    const isCustom = opt === 'custom';
                    return (
                      <button
                        key={String(opt)}
                        type="button"
                        onClick={() => {
                          setDuration(isCustom ? null : opt);
                          setCustomDuration(null);
                          setLengthOpen(false);
                        }}
                        style={{
                          height: 40,
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: ink.text,
                          textAlign: 'left',
                          padding: '0 10px',
                          borderRadius: Radius.sm,
                          cursor: 'pointer',
                          ...Typography.app.body,
                        }}
                      >
                        {isCustom ? 'Custom' : durationLabel(opt)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ ...Typography.app.captionStrong, color: ink.text, textAlign: 'center' }}>
                Start
              </span>
              <button
                type="button"
                onClick={() => setTimePickerOpen((o) => !o)}
                style={{
                  height: 48,
                  borderRadius: Radius.input,
                  border: `1px solid ${ink.border}`,
                  backgroundColor: ink.pillBg,
                  color: ink.text,
                  cursor: 'pointer',
                  ...Typography.app.bodyStrong,
                }}
              >
                {editorTimeLabel(minutes)}
              </button>
              {timePickerOpen ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: 6,
                    borderRadius: Radius.md,
                    backgroundColor: ink.pillBg,
                    border: `1px solid ${ink.border}`,
                  }}
                >
                  <select
                    aria-label="Start hour"
                    value={Math.floor(minutes / 60)}
                    onChange={(e) => setMinutes(Number(e.target.value) * 60 + (minutes % 60))}
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: Radius.sm,
                      border: `1px solid ${ink.border}`,
                      backgroundColor: theme.background,
                      color: ink.text,
                    }}
                  >
                    {hours.map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                  <span style={{ color: ink.textMuted }}>:</span>
                  <select
                    aria-label="Start minute"
                    value={minutes % 60}
                    onChange={(e) => setMinutes(Math.floor(minutes / 60) * 60 + Number(e.target.value))}
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: Radius.sm,
                      border: `1px solid ${ink.border}`,
                      backgroundColor: theme.background,
                      color: ink.text,
                    }}
                  >
                    {MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ ...Typography.app.captionStrong, color: ink.text, textAlign: 'center' }}>
                End
              </span>
              <div
                style={{
                  height: 48,
                  borderRadius: Radius.input,
                  border: `1px solid ${ink.border}`,
                  backgroundColor: ink.pillBg,
                  color: ink.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...Typography.app.bodyStrong,
                }}
              >
                {endTimeLabel}
              </div>
            </div>
          </div>

          {duration === null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...Typography.app.caption, color: ink.textMuted }}>Duration</span>
              <input
                type="number"
                min={5}
                max={1440}
                value={customDuration ?? ''}
                onChange={(e) => {
                  const p = parseInt(e.target.value, 10);
                  setCustomDuration(Number.isFinite(p) && p > 0 ? p : null);
                }}
                aria-label="Custom duration in minutes"
                style={{
                  width: 80,
                  height: 44,
                  borderRadius: Radius.input,
                  border: `1px solid ${ink.border}`,
                  backgroundColor: theme.background,
                  color: ink.text,
                  padding: '0 10px',
                }}
              />
              <span style={{ ...Typography.app.body, color: ink.textMuted }}>minutes</span>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ ...Typography.app.captionStrong, color: ink.text }}>Priority</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {EVENT_PRIORITIES.map((level) => {
                const selected = priority === level;
                const colour = ink.priority[level];
                return (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPriority(selected ? undefined : level)}
                    style={{
                      height: 48,
                      borderRadius: Radius.lg,
                      backgroundColor: ink.pillBg,
                      border: `1.5px solid ${selected ? '#f97316' : ink.border}`,
                      color: ink.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      ...Typography.app.captionStrong,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: Radius.full,
                        backgroundColor: colour,
                        flexShrink: 0,
                      }}
                    />
                    <span>{priorityText(level)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 48,
              padding: '0 12px',
              borderRadius: Radius.lg,
              border: 'none',
              backgroundColor: ink.pillBg,
              color: ink.text,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <Settings size={16} color={ink.textMuted} />
            <span style={{ ...Typography.app.bodyStrong }}>Advanced options</span>
            <span style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 8, paddingRight: 4 }}>
              <Bell size={14} color={ink.textMuted} />
              <Repeat size={14} color={ink.textMuted} />
              <FileText size={14} color={ink.textMuted} />
            </span>
            {advancedOpen ? <ChevronUp size={14} color={ink.textMuted} /> : <ChevronDown size={14} color={ink.textMuted} />}
          </button>

          {advancedOpen ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => setReminderOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 48,
                  padding: '0 14px',
                  borderRadius: Radius.input,
                  border: 'none',
                  backgroundColor: ink.pillBg,
                  color: ink.text,
                  cursor: 'pointer',
                }}
              >
                <Bell size={16} color={ink.textMuted} />
                <span style={{ flex: 1, textAlign: 'left', ...Typography.app.body }}>{reminder}</span>
                {reminderOpen ? <ChevronUp size={12} color={ink.textMuted} /> : <ChevronDown size={12} color={ink.textMuted} />}
              </button>
              {reminderOpen ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 12 }}>
                  {['None', 'At time of event', '5 min before', '15 min before', '30 min before', '1 hour before'].map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => {
                        setReminder(choice);
                        setReminderOpen(false);
                      }}
                      style={{
                        height: 34,
                        padding: '0 12px',
                        borderRadius: Radius.full,
                        border: 'none',
                        backgroundColor: reminder === choice ? ink.pillBg : 'transparent',
                        color: ink.text,
                        cursor: 'pointer',
                        ...Typography.app.caption,
                      }}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setRepeatOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 48,
                  padding: '0 14px',
                  borderRadius: Radius.input,
                  border: 'none',
                  backgroundColor: ink.pillBg,
                  color: ink.text,
                  cursor: 'pointer',
                }}
              >
                <Repeat size={16} color={ink.textMuted} />
                <span style={{ flex: 1, textAlign: 'left', ...Typography.app.body }}>{repeat}</span>
                {repeatOpen ? <ChevronUp size={12} color={ink.textMuted} /> : <ChevronDown size={12} color={ink.textMuted} />}
              </button>
              {repeatOpen ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 12 }}>
                  {['Does not repeat', 'Daily', 'Weekly', 'Monthly', 'Yearly'].map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => {
                        setRepeat(choice);
                        setRepeatOpen(false);
                      }}
                      style={{
                        height: 34,
                        padding: '0 12px',
                        borderRadius: Radius.full,
                        border: 'none',
                        backgroundColor: repeat === choice ? ink.pillBg : 'transparent',
                        color: ink.text,
                        cursor: 'pointer',
                        ...Typography.app.caption,
                      }}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              ) : null}

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes"
                aria-label="Event notes"
                rows={3}
                style={{
                  ...Typography.app.body,
                  padding: 12,
                  borderRadius: Radius.input,
                  border: `1px solid ${ink.border}`,
                  backgroundColor: theme.background,
                  color: ink.text,
                  resize: 'vertical',
                }}
              />
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              height: 48,
              padding: '0 12px',
              borderRadius: Radius.lg,
              border: 'none',
              backgroundColor: 'transparent',
              color: darkError,
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => (onSaveDraft ? onSaveDraft(buildDraft()) : onSave(buildDraft()))}
            style={{
              height: 48,
              padding: '0 14px',
              borderRadius: Radius.lg,
              border: `1px solid ${ink.border}`,
              backgroundColor: 'transparent',
              color: ink.text,
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            Save as draft
          </button>

          <button
            type="button"
            onClick={() => onSave(buildDraft())}
            style={{
              marginLeft: 'auto',
              height: 48,
              minWidth: 100,
              padding: '0 18px',
              borderRadius: Radius.lg,
              border: 'none',
              backgroundColor: theme.selectedFill,
              color: theme.selectedText,
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            Save
          </button>
        </div>

        <MonthPickerPopover
          theme={theme}
          anchor={dateAnchor}
          selected={day}
          events={events}
          onSelectDay={setDay}
          onDismiss={() => setDateAnchor(null)}
        />
      </div>
    </div>,
    document.body
  );
}
