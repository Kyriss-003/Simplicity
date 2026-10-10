import { useMemo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import type { MarkdownRange } from '@expensify/react-native-live-markdown';
import { Typography, type Theme } from '../../theme';
import { parseMarkdownRanges } from '../notes/markdownParser';

/** How a range type renders in a static label. */
const RANGE_STYLES: Record<string, Partial<TextStyle>> = {
  bold: { fontWeight: '600' },
  italic: { fontStyle: 'italic' },
  h1: { fontWeight: '600' },
  strikethrough: { textDecorationLine: 'line-through' },
  link: { textDecorationLine: 'underline' },
  blockquote: { fontStyle: 'italic' },
};

/**
 * Renders a markdown string as styled inline text.
 *
 * Built on the app's own `parseMarkdownRanges` rather than
 * `react-native-markdown-display`, which is a block renderer and far too heavy
 * for a single task row. Reusing the parser also means the static render and the
 * live editor agree about what is bold — a task that shows **hey** as *hey* while
 * the note editor shows it as **hey** is one bug, not two.
 *
 * `syntax` ranges are dropped rather than dimmed: a *rendered* label shows the
 * text, not its markers. (The live editor keeps them, because there the caret
 * has to stay 1:1 with the source — see `markdownParser.ts`.)
 */
export function MarkdownLabel({
  theme,
  value,
  style,
  numberOfLines = 1,
}: {
  theme: Theme;
  value: string;
  /** Base style — normally the caller's body or caption token. */
  style: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const segments = useMemo(() => buildMarkdownSegments(value, theme), [value, theme]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((segment, index) => (
        <Text key={index} style={segment.style}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

export interface MarkdownSegment {
  text: string;
  /** `undefined` for plain text between constructs. */
  style?: Partial<TextStyle>;
}

/**
 * Splits `value` into plain and styled runs.
 *
 * Exported for tests: the segment walk is the part of this component that is not
 * the parser, and it is where an offset mistake would show up as markers leaking
 * into the text or a construct swallowing its neighbour.
 *
 * Every range is walked in offset order, including `syntax`. Skipping syntax
 * outright is the obvious implementation and it is wrong: the plain run between
 * two styled runs is sliced from the *cursor*, so dropping a marker range without
 * advancing the cursor to its end leaves the marker characters in the text.
 * `**bold**` came out as `**` + `bold` + `**`.
 *
 * A range that starts before the cursor has already been consumed is skipped
 * rather than applied twice.
 */
export function buildMarkdownSegments(value: string, theme: Theme): MarkdownSegment[] {
  if (!value) return [{ text: '' }];

  const ranges = dropContainers(parseMarkdownRanges(value).filter((r) => r.length > 0)).sort(
    (a, b) => a.start - b.start
  );

  const segments: MarkdownSegment[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start < cursor) continue;
    if (range.start > cursor) {
      segments.push({ text: value.slice(cursor, range.start) });
    }
    // Markers are consumed but never emitted: a rendered label shows the text,
    // not its source. (The live editor keeps them — there the caret has to stay
    // 1:1 with the text. See `markdownParser.ts`.)
    if (range.type !== 'syntax') {
      segments.push({
        text: value.slice(range.start, range.start + range.length),
        style: styleForRange(range.type, theme),
      });
    }
    cursor = range.start + range.length;
  }

  if (cursor < value.length) segments.push({ text: value.slice(cursor) });
  return segments;
}

/**
 * Drops a range that strictly contains a shorter one.
 *
 * The parser is built for the live editor, where overlapping ranges are fine
 * and desirable — `# **head**` emits a heading range over the whole line *and* a
 * bold range inside it, and the editor composes both. A flat static render
 * cannot: walking them in offset order takes the container first and swallows
 * the inner construct, so the bold markers inside a heading were rendered
 * literally.
 *
 * The innermost range wins, which for a single-line label is the one the reader
 * is looking at. A bare heading has nothing inside it and is unaffected.
 */
function dropContainers(ranges: readonly MarkdownRange[]): MarkdownRange[] {
  return ranges.filter((range) => {
    const end = range.start + range.length;
    return !ranges.some(
      (other) =>
        other !== range &&
        other.start >= range.start &&
        other.start + other.length <= end &&
        other.length < range.length
    );
  });
}

function styleForRange(type: string, theme: Theme): Partial<TextStyle> {
  if (type === 'code') {
    return { ...Typography.app.caption, color: theme.accent };
  }
  if (type === 'pre') {
    return { ...Typography.app.caption, color: theme.textMuted };
  }
  const base = RANGE_STYLES[type];
  if (!base) return {};
  // A link's colour is the one thing worth pulling from the theme; the rest are
  // weight/decoration, which are not theme-dependent.
  return type === 'link' ? { ...base, color: theme.accent } : base;
}
