import { forwardRef, useMemo, useRef, type CSSProperties, type TextareaHTMLAttributes } from 'react';
import type { Theme } from '../../theme';
import { buildMarkdownSegments } from './markdownParser';

export interface LiveMarkdownTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string;
  onChangeText: (value: string) => void;
  theme: Theme;
  style?: CSSProperties;
}

/**
 * Live markdown textarea using a transparent `<textarea>` over a synchronized
 * highlight layer. Width-neutral properties (color, underline, backgroundColor,
 * line-through) ensure 1:1 caret alignment with proportional fonts.
 */
export const LiveMarkdownTextarea = forwardRef<HTMLTextAreaElement, LiveMarkdownTextareaProps>(
  function LiveMarkdownTextarea({ value, onChangeText, theme, style, onScroll, ...rest }, ref) {
    const mirrorRef = useRef<HTMLDivElement>(null);

    const segments = useMemo(() => buildMarkdownSegments(value, theme, true), [value, theme]);

    const sharedMetrics: CSSProperties = {
      fontFamily: 'inherit',
      fontSize: style?.fontSize ?? 14,
      fontWeight: style?.fontWeight ?? 400,
      lineHeight: style?.lineHeight ?? '22px',
      letterSpacing: style?.letterSpacing ?? 0,
      padding: style?.padding ?? 0,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
      margin: 0,
      border: 'none',
    };

    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: style?.height ?? '100%',
          minHeight: style?.minHeight,
          flex: style?.flex,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          ref={mirrorRef}
          aria-hidden="true"
          style={{
            ...sharedMetrics,
            position: 'absolute',
            inset: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            pointerEvents: 'none',
            color: style?.color ?? theme.text,
          }}
        >
          {segments.map((seg, idx) => {
            const safeStyle: CSSProperties | undefined = seg.style
              ? {
                  color: seg.style.color,
                  backgroundColor: seg.style.backgroundColor,
                  textDecoration: seg.style.textDecoration,
                  borderRadius: seg.style.borderRadius,
                }
              : undefined;
            return (
              <span key={idx} style={safeStyle}>
                {seg.text}
              </span>
            );
          })}
          {value.endsWith('\n') ? '\u200b' : null}
        </div>

        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChangeText(e.target.value)}
          onScroll={(e) => {
            if (mirrorRef.current) {
              mirrorRef.current.scrollTop = e.currentTarget.scrollTop;
              mirrorRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
            onScroll?.(e);
          }}
          style={{
            ...sharedMetrics,
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            minHeight: style?.minHeight,
            flex: 1,
            backgroundColor: 'transparent',
            color: 'transparent',
            caretColor: (style?.color as string | undefined) ?? theme.text,
            resize: 'none',
            outline: 'none',
          }}
          {...rest}
        />
      </div>
    );
  }
);
