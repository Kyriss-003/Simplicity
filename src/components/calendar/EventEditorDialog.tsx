import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Calendar, ChevronDown, ChevronUp, FileText, Repeat, Settings, X } from 'lucide-react';
import { Radius, Typography, contrastRatio, surfaceTheme, type Theme } from '../../theme';
import { EVENT_PRIORITIES, PRIORITY_LABELS, type Event, type EventPriority } from '../../types';
import {
  DAY_START_HOUR,
  DEFAULT_DURATION_MINUTES,
  durationLabel,
  minutesFromMidnight,
  startOfDay,
  withTime,
} from './calendarUtils';
import { MonthPickerPopover, type MonthPickerAnchor } from './MonthPickerPopover';
import { LengthPickerPopup, TimePickerPopup } from './TimeScrollWheel';

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

function fullDateLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION_MINUTES);
  const [priority, setPriority] = useState<EventPriority | undefined>(undefined);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [lengthOpen, setLengthOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [reminder, setReminder] = useState('30 min before');
  const [repeat, setRepeat] = useState('Does not repeat');
  const [reminderOpen, setReminderOpen] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [dateAnchor, setDateAnchor] = useState<MonthPickerAnchor | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const advancedBtnRef = useRef<HTMLButtonElement>(null);
  const scrollAnimRef = useRef<number | null>(null);
  const shouldScrollAdvancedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    if (event) {
      const start = new Date(event.startsAt);
      setTitle(event.title);
      setNotes(event.notes ?? '');
      setDay(startOfDay(start));
      setMinutes(minutesFromMidnight(start) ?? DAY_START_HOUR * 60);
      setDuration(event.durationMinutes || DEFAULT_DURATION_MINUTES);
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
    setEndPickerOpen(false);
    setLengthOpen(false);
    setAdvancedOpen(false);
    shouldScrollAdvancedRef.current = false;
    requestAnimationFrame(() => titleRef.current?.focus());
  }, [visible, event, anchorDate]);

  useEffect(() => {
    if (!visible || !advancedOpen || !shouldScrollAdvancedRef.current) return;
    shouldScrollAdvancedRef.current = false;

    const rafId = requestAnimationFrame(() => {
      const container = scrollBodyRef.current;
      const btn = advancedBtnRef.current;
      if (!container || !btn) return;
      const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const targetTop = Math.min(maxTop, Math.max(0, btn.offsetTop - 12));
      const startTop = container.scrollTop;
      const delta = targetTop - startTop;
      if (Math.abs(delta) < 2) return;

      if (scrollAnimRef.current !== null) cancelAnimationFrame(scrollAnimRef.current);
      const durationMs = 240;
      const startTime = performance.now();
      const step = (now: number) => {
        const elapsed = Math.min(1, (now - startTime) / durationMs);
        const eased = 1 - Math.pow(1 - elapsed, 3);
        container.scrollTop = startTop + delta * eased;
        if (elapsed < 1) {
          scrollAnimRef.current = requestAnimationFrame(step);
        } else {
          scrollAnimRef.current = null;
        }
      };
      scrollAnimRef.current = requestAnimationFrame(step);
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [visible, advancedOpen]);

  useEffect(() => {
    return () => {
      if (scrollAnimRef.current !== null) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !timePickerOpen && !endPickerOpen && !lengthOpen && !dateAnchor) {
        onDismiss();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onDismiss, timePickerOpen, endPickerOpen, lengthOpen, dateAnchor]);

  if (!visible) return null;

  const durationMinutes = duration;
  const endMinutes = ((minutes + durationMinutes) % 1440 + 1440) % 1440;
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

        <div
          ref={scrollBodyRef}
          onWheel={() => {
            if (scrollAnimRef.current !== null) {
              cancelAnimationFrame(scrollAnimRef.current);
              scrollAnimRef.current = null;
            }
          }}
          style={{
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            paddingRight: 2,
            position: 'relative',
          }}
        >
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
              aria-expanded={Boolean(dateAnchor)}
              onClick={openDatePicker}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                height: 48,
                borderRadius: Radius.input,
                border: `1px solid ${dateAnchor ? theme.accent : ink.border}`,
                backgroundColor: ink.pillBg,
                color: ink.text,
                padding: '0 12px',
                cursor: 'pointer',
                transition: 'border-color 140ms ease',
              }}
            >
              <Calendar size={16} color={ink.textMuted} style={{ flexShrink: 0 }} />
              <span
                style={{
                  ...Typography.app.bodyStrong,
                  flex: 1,
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {fullDateLabel(day)}
              </span>
              <ChevronDown size={14} color={ink.textMuted} style={{ flexShrink: 0 }} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <span style={{ ...Typography.app.captionStrong, color: ink.text, textAlign: 'center' }}>
                Length
              </span>
              <button
                type="button"
                aria-expanded={lengthOpen}
                onClick={() => {
                  setTimePickerOpen(false);
                  setEndPickerOpen(false);
                  setLengthOpen(true);
                }}
                style={{
                  height: 48,
                  borderRadius: Radius.input,
                  border: `1px solid ${lengthOpen ? theme.accent : ink.border}`,
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
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {durationLabel(durationMinutes)}
                </span>
                <ChevronDown size={12} color={ink.textMuted} style={{ flexShrink: 0 }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <span style={{ ...Typography.app.captionStrong, color: ink.text, textAlign: 'center' }}>
                Start
              </span>
              <button
                type="button"
                aria-expanded={timePickerOpen}
                onClick={() => {
                  setLengthOpen(false);
                  setEndPickerOpen(false);
                  setTimePickerOpen(true);
                }}
                style={{
                  height: 48,
                  borderRadius: Radius.input,
                  border: `1px solid ${timePickerOpen ? theme.accent : ink.border}`,
                  backgroundColor: ink.pillBg,
                  color: ink.text,
                  cursor: 'pointer',
                  ...Typography.app.bodyStrong,
                }}
              >
                {editorTimeLabel(minutes)}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <span style={{ ...Typography.app.captionStrong, color: ink.text, textAlign: 'center' }}>
                End
              </span>
              <button
                type="button"
                aria-expanded={endPickerOpen}
                onClick={() => {
                  setLengthOpen(false);
                  setTimePickerOpen(false);
                  setEndPickerOpen(true);
                }}
                style={{
                  height: 48,
                  borderRadius: Radius.input,
                  border: `1px solid ${endPickerOpen ? theme.accent : ink.border}`,
                  backgroundColor: ink.pillBg,
                  color: ink.text,
                  cursor: 'pointer',
                  ...Typography.app.bodyStrong,
                }}
              >
                {endTimeLabel}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ ...Typography.app.captionStrong, color: ink.text }}>Priority</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
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
                      backgroundColor: selected ? `${colour}20` : ink.pillBg,
                      border: `1.5px solid ${selected ? colour : ink.border}`,
                      color: selected ? colour : ink.text,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      transition: 'border-color 140ms ease, background-color 140ms ease, color 140ms ease',
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
            ref={advancedBtnRef}
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => {
              setAdvancedOpen((o) => {
                const next = !o;
                if (next) shouldScrollAdvancedRef.current = true;
                return next;
              });
            }}
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
              flexShrink: 0,
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
          centered
          onSelectDay={setDay}
          onDismiss={() => setDateAnchor(null)}
        />

        <TimePickerPopup
          theme={theme}
          visible={timePickerOpen}
          title="Start time"
          minutes={minutes}
          onConfirm={setMinutes}
          onDismiss={() => setTimePickerOpen(false)}
        />

        <TimePickerPopup
          theme={theme}
          visible={endPickerOpen}
          title="End time"
          minutes={endMinutes}
          onConfirm={(pickedEnd) => {
            const startMod = ((Math.round(minutes) % 1440) + 1440) % 1440;
            const endMod = ((Math.round(pickedEnd) % 1440) + 1440) % 1440;
            let nextDuration = endMod - startMod;
            if (nextDuration <= 0) nextDuration += 1440;
            setDuration(nextDuration);
          }}
          onDismiss={() => setEndPickerOpen(false)}
        />

        <LengthPickerPopup
          theme={theme}
          visible={lengthOpen}
          duration={durationMinutes}
          formatDuration={durationLabel}
          onSelect={setDuration}
          onCustomEndTime={() => setEndPickerOpen(true)}
          onDismiss={() => setLengthOpen(false)}
        />
      </div>
    </div>,
    document.body
  );
}
