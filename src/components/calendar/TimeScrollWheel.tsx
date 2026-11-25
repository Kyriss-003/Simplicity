import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';

const ITEM_HEIGHT = 36;
const VISIBLE_COUNT = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT; // 180px
const PADDING_Y = ITEM_HEIGHT * 2; // 72px so index 0 and last index align with center
const LOOP_REPEAT_COUNT = 11;
const LOOP_MIDDLE_CYCLE = Math.floor(LOOP_REPEAT_COUNT / 2); // 5

interface WheelOption<T extends string | number> {
  value: T;
  label: string;
}

interface WheelColumnProps<T extends string | number> {
  options: readonly WheelOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  ink: ReturnType<typeof surfaceTheme>;
  theme: Theme;
  loop?: boolean;
  flex?: number;
}

function formatTimeLabel(minutes: number): string {
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(total / 60);
  const hour12 = hours24 % 12 || 12;
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  return `${String(hour12).padStart(2, '0')}:${String(total % 60).padStart(2, '0')} ${suffix}`;
}

function WheelColumn<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  ink,
  theme,
  loop = false,
  flex = 1,
}: WheelColumnProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastUserScrollAtRef = useRef(0);
  const lastCommittedRef = useRef<T>(value);
  const recenterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecenteringRef = useRef(false);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startY: number;
    startScrollTop: number;
    moved: boolean;
  } | null>(null);

  const baseLen = options.length;
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  const renderedOptions = useMemo(() => {
    const cycles = loop ? LOOP_REPEAT_COUNT : 1;
    const items: Array<{ option: WheelOption<T>; virtualIndex: number; baseIndex: number }> = [];
    for (let c = 0; c < cycles; c += 1) {
      for (let i = 0; i < baseLen; i += 1) {
        items.push({
          option: options[i]!,
          virtualIndex: c * baseLen + i,
          baseIndex: i,
        });
      }
    }
    return items;
  }, [options, baseLen, loop]);

  const initialVirtualIndex = (loop ? LOOP_MIDDLE_CYCLE * baseLen : 0) + selectedIndex;
  const [scrollTop, setScrollTop] = useState(() => initialVirtualIndex * ITEM_HEIGHT);
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = ((loop ? LOOP_MIDDLE_CYCLE * baseLen : 0) + selectedIndex) * ITEM_HEIGHT;
    el.scrollTop = target;
    setScrollTop(target);
    lastCommittedRef.current = value;
  }, []);

  useEffect(() => {
    return () => {
      if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (value === lastCommittedRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;

    let targetVirtual = selectedIndex;
    if (loop) {
      const currentVirtual = Math.round(el.scrollTop / ITEM_HEIGHT);
      const currentBase = ((currentVirtual % baseLen) + baseLen) % baseLen;
      let diff = selectedIndex - currentBase;
      if (diff > baseLen / 2) diff -= baseLen;
      if (diff < -baseLen / 2) diff += baseLen;
      targetVirtual = currentVirtual + diff;
    }

    const target = targetVirtual * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) > 2) {
      el.scrollTo({ top: target, behavior: 'smooth' });
      setScrollTop(target);
    }
    lastCommittedRef.current = value;
  }, [selectedIndex, value, loop, baseLen]);

  const scheduleRecenter = () => {
    if (!loop) return;
    if (recenterTimerRef.current) clearTimeout(recenterTimerRef.current);
    recenterTimerRef.current = setTimeout(() => {
      const el = scrollerRef.current;
      if (!el || dragStateRef.current?.active) return;
      const currentVirtual = Math.round(el.scrollTop / ITEM_HEIGHT);
      const currentCycle = Math.floor(currentVirtual / baseLen);
      if (currentCycle <= 2 || currentCycle >= LOOP_REPEAT_COUNT - 3) {
        const shift = (LOOP_MIDDLE_CYCLE - currentCycle) * baseLen * ITEM_HEIGHT;
        isRecenteringRef.current = true;
        el.scrollTop = el.scrollTop + shift;
        setScrollTop(el.scrollTop);
        requestAnimationFrame(() => {
          isRecenteringRef.current = false;
        });
      }
    }, 150);
  };

  const commitFromVirtualIndex = (virtualIdx: number) => {
    const baseIdx = ((virtualIdx % baseLen) + baseLen) % baseLen;
    const next = options[baseIdx];
    if (next && next.value !== lastCommittedRef.current) {
      lastCommittedRef.current = next.value;
      onChange(next.value);
    }
  };

  const handleScroll = () => {
    if (isRecenteringRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    const top = el.scrollTop;
    lastUserScrollAtRef.current = Date.now();
    setScrollTop(top);
    commitFromVirtualIndex(Math.round(top / ITEM_HEIGHT));
    scheduleRecenter();
  };

  const scrollToVirtualIndex = (virtualIdx: number) => {
    const el = scrollerRef.current;
    const maxIdx = renderedOptions.length - 1;
    const clamped = Math.max(0, Math.min(maxIdx, virtualIdx));
    const target = clamped * ITEM_HEIGHT;
    lastUserScrollAtRef.current = Date.now();
    if (el) {
      el.scrollTo({ top: target, behavior: 'smooth' });
    }
    commitFromVirtualIndex(clamped);
    scheduleRecenter();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startY: e.clientY,
      startScrollTop: el.scrollTop,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    const el = scrollerRef.current;
    if (!drag || !drag.active || !el) return;
    const deltaY = e.clientY - drag.startY;
    if (!drag.moved && Math.abs(deltaY) > 4) {
      drag.moved = true;
      setDragging(true);
      el.setPointerCapture(drag.pointerId);
    }
    if (drag.moved) {
      lastUserScrollAtRef.current = Date.now();
      el.scrollTop = drag.startScrollTop - deltaY;
    }
  };

  const finishDrag = () => {
    const drag = dragStateRef.current;
    const el = scrollerRef.current;
    if (!drag) return;
    const wasDragged = drag.moved;
    if (wasDragged && el && el.hasPointerCapture(drag.pointerId)) {
      el.releasePointerCapture(drag.pointerId);
    }
    dragStateRef.current = null;
    setDragging(false);
    if (wasDragged && el) {
      const idx = Math.max(0, Math.min(renderedOptions.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)));
      el.scrollTo({ top: idx * ITEM_HEIGHT, behavior: 'smooth' });
      scheduleRecenter();
    }
  };

  return (
    <div
      ref={scrollerRef}
      role="listbox"
      tabIndex={0}
      aria-label={ariaLabel}
      className="scroll-wheel-col"
      onScroll={handleScroll}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onKeyDown={(e) => {
        const el = scrollerRef.current;
        const currentVirtual = el ? Math.round(el.scrollTop / ITEM_HEIGHT) : initialVirtualIndex;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          scrollToVirtualIndex(currentVirtual + 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          scrollToVirtualIndex(currentVirtual - 1);
        }
      }}
      style={{
        flex,
        height: WHEEL_HEIGHT,
        overflowY: 'auto',
        scrollSnapType: dragging ? 'none' : 'y mandatory',
        WebkitOverflowScrolling: 'touch',
        paddingTop: PADDING_Y,
        paddingBottom: PADDING_Y,
        position: 'relative',
        cursor: dragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        maskImage:
          'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.65) 22%, black 38%, black 62%, rgba(0,0,0,0.65) 78%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.65) 22%, black 38%, black 62%, rgba(0,0,0,0.65) 78%, transparent 100%)',
      }}
    >
      {renderedOptions.map(({ option, virtualIndex }) => {
        const dist = (virtualIndex * ITEM_HEIGHT - scrollTop) / ITEM_HEIGHT;
        const absDist = Math.min(2.5, Math.abs(dist));
        const isCenter = absDist < 0.45;
        const scale = Math.max(0.8, 1 - absDist * 0.085);
        const opacity = Math.max(0.28, 1 - absDist * 0.3);
        const rotateX = Math.max(-42, Math.min(42, dist * -18));

        return (
          <button
            key={virtualIndex}
            type="button"
            role="option"
            aria-selected={isCenter && option.value === value}
            onClick={() => scrollToVirtualIndex(virtualIndex)}
            style={{
              width: '100%',
              height: ITEM_HEIGHT,
              scrollSnapAlign: 'center',
              border: 'none',
              backgroundColor: 'transparent',
              padding: 0,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isCenter ? theme.accent : ink.text,
              opacity,
              transform: `perspective(240px) rotateX(${rotateX.toFixed(1)}deg) scale(${scale.toFixed(3)})`,
              transition: dragging ? 'none' : 'color 120ms ease',
              fontVariantNumeric: 'tabular-nums',
              ...(isCenter ? Typography.app.bodyStrong : Typography.app.body),
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const HOUR_OPTIONS: readonly WheelOption<number>[] = Array.from({ length: 12 }, (_, i) => {
  const h = i + 1;
  return { value: h, label: String(h).padStart(2, '0') };
});

const PERIOD_OPTIONS: readonly WheelOption<'AM' | 'PM'>[] = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

export function TimeScrollWheel({
  theme,
  minutes,
  onChange,
}: {
  theme: Theme;
  minutes: number;
  onChange: (nextMinutes: number) => void;
}) {
  const ink = surfaceTheme(theme);
  const total = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(total / 60);
  const period: 'AM' | 'PM' = hours24 < 12 ? 'AM' : 'PM';
  const hour12 = hours24 % 12 || 12;
  const minute = total % 60;

  const [extraMinute] = useState<number | null>(() => (minute % 5 !== 0 ? minute : null));

  const minuteOptions = useMemo<WheelOption<number>[]>(() => {
    const base = new Set<number>();
    for (let m = 0; m < 60; m += 5) base.add(m);
    if (extraMinute !== null) base.add(extraMinute);
    return Array.from(base)
      .sort((a, b) => a - b)
      .map((m) => ({ value: m, label: String(m).padStart(2, '0') }));
  }, [extraMinute]);

  const updateTime = (nextHour12: number, nextMinute: number, nextPeriod: 'AM' | 'PM') => {
    const h24 =
      nextPeriod === 'AM'
        ? nextHour12 === 12
          ? 0
          : nextHour12
        : nextHour12 === 12
          ? 12
          : nextHour12 + 12;
    onChange(h24 * 60 + nextMinute);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: Radius.lg,
        backgroundColor: theme.background,
        border: `1px solid ${ink.border}`,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          height: ITEM_HEIGHT,
          borderRadius: Radius.md,
          backgroundColor: ink.pillBg,
          border: `1px solid ${ink.border}`,
          pointerEvents: 'none',
        }}
      />

      <WheelColumn
        options={HOUR_OPTIONS}
        value={hour12}
        onChange={(h) => updateTime(h, minute, period)}
        ariaLabel="Start hour"
        ink={ink}
        theme={theme}
        loop
        flex={1}
      />

      <span
        aria-hidden="true"
        style={{
          ...Typography.app.bodyStrong,
          color: ink.textMuted,
          position: 'relative',
          zIndex: 1,
          paddingBottom: 1,
          pointerEvents: 'none',
        }}
      >
        :
      </span>

      <WheelColumn
        options={minuteOptions}
        value={minute}
        onChange={(m) => updateTime(hour12, m, period)}
        ariaLabel="Start minute"
        ink={ink}
        theme={theme}
        loop
        flex={1}
      />

      <div
        aria-hidden="true"
        style={{
          width: 1,
          height: ITEM_HEIGHT - 12,
          backgroundColor: ink.border,
          margin: '0 2px',
          position: 'relative',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      <WheelColumn
        options={PERIOD_OPTIONS}
        value={period}
        onChange={(p) => updateTime(hour12, minute, p)}
        ariaLabel="AM or PM"
        ink={ink}
        theme={theme}
        loop={false}
        flex={1}
      />
    </div>
  );
}

export function TimePickerPopup({
  theme,
  visible,
  title = 'Start time',
  minutes,
  onConfirm,
  onDismiss,
}: {
  theme: Theme;
  visible: boolean;
  title?: string;
  minutes: number;
  onConfirm: (nextMinutes: number) => void;
  onDismiss: () => void;
}) {
  const ink = surfaceTheme(theme);
  const [draftMinutes, setDraftMinutes] = useState(minutes);

  useEffect(() => {
    if (visible) setDraftMinutes(minutes);
  }, [visible, minutes]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return createPortal(
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
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
        aria-label={`Choose ${title.toLowerCase()}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 312,
          backgroundColor: theme.surface,
          border: `1px solid ${ink.border}`,
          borderRadius: Radius.modal,
          padding: 16,
          boxShadow: `0 16px 40px ${theme.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...Typography.app.cardHeader, color: ink.text }}>{title}</span>
            <span
              style={{
                ...Typography.app.captionStrong,
                color: theme.accent,
                backgroundColor: ink.pillBg,
                border: `1px solid ${ink.border}`,
                borderRadius: Radius.md,
                padding: '2px 8px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatTimeLabel(draftMinutes)}
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close time picker"
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

        <TimeScrollWheel
          theme={theme}
          minutes={draftMinutes}
          onChange={setDraftMinutes}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              height: 40,
              padding: '0 14px',
              borderRadius: Radius.lg,
              border: `1px solid ${ink.border}`,
              backgroundColor: 'transparent',
              color: ink.textMuted,
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(draftMinutes);
              onDismiss();
            }}
            style={{
              height: 40,
              minWidth: 84,
              padding: '0 18px',
              borderRadius: Radius.lg,
              border: 'none',
              backgroundColor: theme.selectedFill,
              color: theme.selectedText,
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const LENGTH_PRESETS: readonly number[] = [15, 30, 45, 60, 90, 120, 1440];

export function LengthPickerPopup({
  theme,
  visible,
  duration,
  formatDuration,
  onSelect,
  onCustomEndTime,
  onDismiss,
}: {
  theme: Theme;
  visible: boolean;
  duration: number;
  formatDuration: (minutes: number) => string;
  onSelect: (minutes: number) => void;
  onCustomEndTime: () => void;
  onDismiss: () => void;
}) {
  const ink = surfaceTheme(theme);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return createPortal(
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
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
        aria-label="Choose event length"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 300,
          backgroundColor: theme.surface,
          border: `1px solid ${ink.border}`,
          borderRadius: Radius.modal,
          padding: 16,
          boxShadow: `0 16px 40px ${theme.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...Typography.app.cardHeader, color: ink.text }}>Length</span>
            <span
              style={{
                ...Typography.app.captionStrong,
                color: theme.accent,
                backgroundColor: ink.pillBg,
                border: `1px solid ${ink.border}`,
                borderRadius: Radius.md,
                padding: '2px 8px',
              }}
            >
              {formatDuration(duration)}
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close length picker"
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {LENGTH_PRESETS.map((opt) => {
            const active = duration === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onSelect(opt);
                  onDismiss();
                }}
                style={{
                  height: 42,
                  padding: '0 12px',
                  borderRadius: Radius.lg,
                  border: `1px solid ${active ? theme.accent : 'transparent'}`,
                  backgroundColor: active ? ink.pillBg : 'transparent',
                  color: active ? theme.accent : ink.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  ...(active ? Typography.app.bodyStrong : Typography.app.body),
                }}
              >
                <span>{opt === 1440 ? 'All day (24 hr)' : formatDuration(opt)}</span>
                {active ? (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: Radius.full,
                      backgroundColor: theme.accent,
                    }}
                  />
                ) : null}
              </button>
            );
          })}

          <div style={{ height: 1, backgroundColor: ink.border, margin: '4px 0' }} />

          <button
            type="button"
            onClick={() => {
              onDismiss();
              onCustomEndTime();
            }}
            style={{
              height: 42,
              padding: '0 12px',
              borderRadius: Radius.lg,
              border: 'none',
              backgroundColor: ink.pillBg,
              color: ink.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            <span>Pick end time…</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
