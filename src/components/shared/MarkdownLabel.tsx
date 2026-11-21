import type { CSSProperties } from 'react';
import type { Theme } from '../../theme';
import { buildMarkdownSegments } from '../notes/markdownParser';

export function MarkdownLabel({
  value,
  theme,
  style,
}: {
  value: string;
  theme: Theme;
  style?: CSSProperties;
}) {
  const segments = buildMarkdownSegments(value, theme, false);

  return (
    <span
      style={{
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {segments.map((seg, i) => (
        <span key={i} style={seg.style}>
          {seg.text}
        </span>
      ))}
    </span>
  );
}
