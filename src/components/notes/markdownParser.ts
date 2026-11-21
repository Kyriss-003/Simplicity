import type { CSSProperties } from 'react';
import type { Theme } from '../../theme';

export type MarkdownRangeType =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'highlight'
  | 'h1'
  | 'blockquote'
  | 'code'
  | 'pre'
  | 'link'
  | 'checkbox'
  | 'hr'
  | 'syntax';

export interface MarkdownRange {
  type: MarkdownRangeType;
  start: number;
  length: number;
  depth?: number;
}

export const MARKDOWN_PARSE_BUDGET = 20_000;

export function parseMarkdownRanges(input: string): MarkdownRange[] {
  if (!input || input.length > MARKDOWN_PARSE_BUDGET) return [];

  const ranges: MarkdownRange[] = [];
  const taken: { from: number; to: number }[] = [];

  const overlaps = (from: number, to: number) => {
    for (let i = 0; i < taken.length; i += 1) {
      if (from < taken[i].to && to > taken[i].from) return true;
    }
    return false;
  };

  const claim = (from: number, to: number) => {
    taken.push({ from, to });
  };

  const add = (type: MarkdownRangeType, start: number, length: number, depth?: number) => {
    if (length <= 0 || start < 0) return;
    for (let i = 0; i < taken.length; i += 1) {
      if (start < taken[i].to && start + length > taken[i].from) return;
    }
    ranges.push(depth === undefined ? { type, start, length } : { type, start, length, depth });
  };

  let lineStart = 0;
  let fenceAt = -1;
  let bodyFrom = -1;

  const closeFence = (closeMarkerAt: number) => {
    if (bodyFrom !== -1) {
      add('pre', bodyFrom, closeMarkerAt - bodyFrom);
      claim(bodyFrom, closeMarkerAt);
    }
    add('syntax', closeMarkerAt, 3);
    claim(closeMarkerAt, closeMarkerAt + 3);
    fenceAt = -1;
    bodyFrom = -1;
  };

  while (lineStart < input.length) {
    let lineEnd = input.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = input.length;
    const line = input.slice(lineStart, lineEnd);
    const indent = line.length - line.trimStart().length;
    const contentAt = lineStart + indent;

    if (fenceAt >= 0) {
      if (line.trimStart().startsWith('```')) {
        closeFence(contentAt);
      } else if (bodyFrom === -1) {
        bodyFrom = lineStart;
      }
    } else if (line.trimStart().startsWith('```')) {
      add('syntax', contentAt, 3);
      claim(contentAt, contentAt + 3);
      fenceAt = contentAt;
      bodyFrom = -1;
    } else if (/^(\s*)([-*_])(?:\s*\2){2,}\s*$/.test(line)) {
      const trimmedLen = line.trim().length;
      add('hr', contentAt, trimmedLen);
      claim(contentAt, contentAt + trimmedLen);
    } else {
      const heading = /^#{1,6}(\s|$)/.exec(line);
      if (heading) {
        const markerLength = heading[0].length;
        add('syntax', lineStart, markerLength);
        const textAt = lineStart + markerLength;
        const textLength = lineEnd - textAt;
        if (textLength > 0) {
          add('h1', textAt, textLength, indent + markerLength);
        }
      } else {
        const quote = /^\s*>/.exec(line);
        if (quote) {
          let markerLength = quote[0].lastIndexOf('>') + 1;
          const rest = line.slice(markerLength);
          markerLength += rest.length - rest.trimStart().length;
          add('syntax', lineStart, markerLength);
          const textAt = lineStart + markerLength;
          const textLength = lineEnd - textAt;
          if (textLength > 0) add('blockquote', textAt, textLength);
        } else {
          const list = /^(\s*)([-*+]|\d{1,9}[.)])(\s+)/.exec(line);
          if (list) {
            const bulletStart = lineStart + list[1].length;
            add('syntax', bulletStart, list[2].length);
            const afterListIdx = list[0].length;
            const taskMatch = /^\[([ xX])\](?=\s|$)/.exec(line.slice(afterListIdx));
            if (taskMatch) {
              const boxStart = lineStart + afterListIdx;
              add('checkbox', boxStart, 3);
              claim(boxStart, boxStart + 3);
            }
          }
        }
      }
    }

    lineStart = lineEnd + 1;
  }

  if (fenceAt >= 0 && bodyFrom !== -1) {
    add('pre', bodyFrom, input.length - bodyFrom);
    claim(bodyFrom, input.length);
  }

  const codePattern = /`+[^`\n]*`+/g;
  let codeMatch = codePattern.exec(input);
  while (codeMatch !== null) {
    const start = codeMatch.index;
    const length = codeMatch[0].length;
    if (!overlaps(start, start + length)) {
      add('syntax', start, 1);
      if (length > 2) add('code', start + 1, length - 2);
      add('syntax', start + length - 1, 1);
      claim(start, start + length);
    }
    codeMatch = codePattern.exec(input);
  }

  const linkPattern = /!?\[([^\]\n]*)\]\(([^)\n]*)\)/g;
  let linkMatch = linkPattern.exec(input);
  while (linkMatch !== null) {
    const start = linkMatch.index;
    const full = linkMatch[0];
    const length = full.length;
    const isImage = full.startsWith('!');
    const openBracketOffset = isImage ? 1 : 0;
    const textLength = linkMatch[1].length;
    const urlStart = start + openBracketOffset + 1 + textLength + 2;
    const urlLength = linkMatch[2].length;
    if (!overlaps(start, start + length)) {
      add('syntax', start, openBracketOffset + 1);
      if (textLength > 0) add('link', start + openBracketOffset + 1, textLength);
      add('syntax', start + openBracketOffset + 1 + textLength, 2);
      if (urlLength > 0) add('syntax', urlStart, urlLength);
      add('syntax', start + length - 1, 1);
      claim(start, start + length);
    }
    linkMatch = linkPattern.exec(input);
  }

  const rules: { pattern: RegExp; type: MarkdownRangeType; open: number; close: number; marker: string }[] = [
    { pattern: /==([^\n]+?)==/g, type: 'highlight', open: 2, close: 2, marker: '=' },
    { pattern: /~~([^\n]+?)~~/g, type: 'strikethrough', open: 2, close: 2, marker: '~' },
    { pattern: /\*\*([^\n]+?)\*\*/g, type: 'bold', open: 2, close: 2, marker: '*' },
    { pattern: /__([^\n]+?)__/g, type: 'bold', open: 2, close: 2, marker: '_' },
    { pattern: /\*([^*\n]+)\*/g, type: 'italic', open: 1, close: 1, marker: '*' },
    { pattern: /_([^_\n]+)_/g, type: 'italic', open: 1, close: 1, marker: '_' },
  ];

  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    const pattern = rule.pattern;
    let match = pattern.exec(input);
    while (match !== null) {
      const start = match.index;
      const length = match[0].length;
      const before = start > 0 ? input[start - 1] : '';
      const after = start + length < input.length ? input[start + length] : '';
      const glued = before === rule.marker || after === rule.marker;
      const used = !glued && !overlaps(start, start + length);
      if (used) {
        add('syntax', start, rule.open);
        if (match[1].length > 0) add(rule.type, start + rule.open, match[1].length);
        add('syntax', start + length - rule.close, rule.close);
        claim(start, start + length);
        match = pattern.exec(input);
      } else {
        pattern.lastIndex = start + 1;
        match = pattern.exec(input);
      }
    }
  }

  return ranges;
}

export interface MarkdownSegment {
  text: string;
  style?: CSSProperties;
}

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

export function buildMarkdownSegments(
  value: string,
  theme: Theme,
  includeSyntax = false
): MarkdownSegment[] {
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
    if (range.type !== 'syntax' || includeSyntax) {
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

function styleForRange(type: MarkdownRangeType, theme: Theme): CSSProperties {
  switch (type) {
    case 'syntax':
    case 'hr':
      return { color: theme.syntaxDim };
    case 'checkbox':
      return { color: theme.accent };
    case 'bold':
      return { fontWeight: 600 };
    case 'italic':
      return { fontStyle: 'italic' };
    case 'h1':
      return { fontWeight: 600 };
    case 'strikethrough':
      return { textDecoration: 'line-through' };
    case 'highlight':
      return { backgroundColor: theme.pillBg, borderRadius: 4, color: theme.text };
    case 'link':
      return { textDecoration: 'underline', color: theme.accent };
    case 'blockquote':
      return { fontStyle: 'italic', color: theme.textMuted };
    case 'code':
      return {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        backgroundColor: theme.pillBg,
        borderRadius: 4,
        color: theme.accent,
      };
    case 'pre':
      return {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        color: theme.textMuted,
      };
    default:
      return {};
  }
}
