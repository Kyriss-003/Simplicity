import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { Radius, Typography, type Theme } from '../../theme';
import { copyToClipboard } from '../../utils';

function sanitizeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  try {
    const parsed = new URL(trimmed, 'https://placeholder.invalid');
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:') {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}

function sanitizeImageSrc(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image/')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return trimmed;
  } catch {
    return null;
  }
  return null;
}

function renderInlineFormatted(text: string, theme: Theme, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenRe =
    /(`[^`\n]+`|!\[[^\]\n]*\]\([^)\n]*\)|\[[^\]\n]+\]\([^)\n]+\)|==[^=\n]+==|~~[^~\n]+~~|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let seq = 0;

  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${seq++}`;

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={key}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.9em',
            backgroundColor: theme.pillBg,
            color: theme.accent,
            padding: '1px 5px',
            borderRadius: 4,
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('![')) {
      const imgMatch = /^!\[([^\]\n]*)\]\(([^)\n]*)\)$/.exec(token);
      const alt = imgMatch?.[1] ?? '';
      const src = sanitizeImageSrc(imgMatch?.[2] ?? '');
      if (src) {
        nodes.push(
          <img
            key={key}
            src={src}
            alt={alt}
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: 360,
              borderRadius: Radius.md,
              border: `1px solid ${theme.border}`,
              margin: '8px 0',
            }}
          />
        );
      } else {
        nodes.push(<span key={key} style={{ color: theme.textMuted }}>{alt || token}</span>);
      }
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]\n]+)\]\(([^)\n]+)\)$/.exec(token);
      const label = linkMatch?.[1] ?? token;
      const href = sanitizeHref(linkMatch?.[2] ?? '');
      if (href) {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: theme.accent,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            {label}
          </a>
        );
      } else {
        nodes.push(<span key={key}>{label}</span>);
      }
    } else if (token.startsWith('==') && token.endsWith('==')) {
      nodes.push(
        <mark
          key={key}
          style={{
            backgroundColor: theme.pillBg,
            color: theme.text,
            padding: '1px 4px',
            borderRadius: 4,
            borderBottom: `2px solid ${theme.accent}`,
          }}
        >
          {renderInlineFormatted(token.slice(2, -2), theme, key)}
        </mark>
      );
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      nodes.push(
        <del key={key} style={{ color: theme.textMuted }}>
          {renderInlineFormatted(token.slice(2, -2), theme, key)}
        </del>
      );
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      nodes.push(
        <strong key={key} style={{ fontWeight: 600 }}>
          {renderInlineFormatted(token.slice(2, -2), theme, key)}
        </strong>
      );
    } else if (
      (token.startsWith('*') && token.endsWith('*')) ||
      (token.startsWith('_') && token.endsWith('_'))
    ) {
      nodes.push(
        <em key={key} style={{ fontStyle: 'italic' }}>
          {renderInlineFormatted(token.slice(1, -1), theme, key)}
        </em>
      );
    } else {
      nodes.push(token);
    }

    lastIndex = tokenRe.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function CodeBlock({
  code,
  lang,
  theme,
}: {
  code: string;
  lang: string;
  theme: Theme;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div
      style={{
        backgroundColor: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: Radius.md,
        margin: '10px 0',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          borderBottom: `1px solid ${theme.border}`,
          backgroundColor: theme.pillBg,
        }}
      >
        <span
          style={{
            ...Typography.app.captionStrong,
            color: theme.textMuted,
            textTransform: 'lowercase',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        >
          {lang || 'code'}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label="Copy code block"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            border: 'none',
            backgroundColor: 'transparent',
            color: copied ? theme.accent : theme.textMuted,
            cursor: 'pointer',
            padding: '2px 4px',
            ...Typography.app.caption,
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: 13,
          lineHeight: '20px',
          color: theme.text,
          overflowX: 'auto',
        }}
      >
        {code}
      </pre>
    </div>
  );
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  const stripped = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return stripped.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): ('left' | 'center' | 'right')[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|') || !trimmed.includes('-')) return null;
  const cells = splitTableRow(trimmed);
  if (cells.length === 0) return null;
  const alignments: ('left' | 'center' | 'right')[] = [];
  for (const cell of cells) {
    if (!/^:?-{3,}:?$/.test(cell)) return null;
    if (cell.startsWith(':') && cell.endsWith(':')) alignments.push('center');
    else if (cell.endsWith(':')) alignments.push('right');
    else alignments.push('left');
  }
  return alignments;
}

export function MarkdownReadView({
  content,
  theme,
  onToggleCheckbox,
}: {
  content: string;
  theme: Theme;
  onToggleCheckbox?: (lineIndex: number) => void;
}) {
  if (!content.trim()) {
    return <div style={{ ...Typography.app.body, color: theme.textMuted }}>This note is empty.</div>;
  }

  const lines = content.split('\n');
  const blocks: ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    // Fenced code blocks
    const fenceMatch = /^\s*```(.*)$/.exec(line);
    if (fenceMatch) {
      const lang = fenceMatch[1]?.trim() ?? '';
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.trimStart().startsWith('```')) {
        codeLines.push(lines[i]!);
        i += 1;
      }
      blocks.push(<CodeBlock key={`code-${i}`} code={codeLines.join('\n')} lang={lang} theme={theme} />);
      i += 1;
      continue;
    }

    // Markdown tables
    if (line.includes('|') && i + 1 < lines.length) {
      const alignments = isTableSeparator(lines[i + 1]!);
      if (alignments) {
        const headers = splitTableRow(line);
        const bodyRows: string[][] = [];
        let rowIdx = i + 2;
        while (rowIdx < lines.length && lines[rowIdx]!.includes('|') && lines[rowIdx]!.trim() !== '') {
          bodyRows.push(splitTableRow(lines[rowIdx]!));
          rowIdx += 1;
        }
        blocks.push(
          <div
            key={`table-${i}`}
            style={{
              overflowX: 'auto',
              margin: '10px 0',
              borderRadius: Radius.md,
              border: `1px solid ${theme.border}`,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', ...Typography.app.body }}>
              <thead>
                <tr style={{ backgroundColor: theme.surface }}>
                  {headers.map((cell, ci) => (
                    <th
                      key={ci}
                      style={{
                        textAlign: alignments[ci] ?? 'left',
                        padding: '8px 12px',
                        borderBottom: `1px solid ${theme.border}`,
                        borderRight: ci < headers.length - 1 ? `1px solid ${theme.border}` : 'none',
                        color: theme.text,
                        fontWeight: 600,
                      }}
                    >
                      {renderInlineFormatted(cell, theme, `th-${i}-${ci}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri}>
                    {headers.map((_, ci) => (
                      <td
                        key={ci}
                        style={{
                          textAlign: alignments[ci] ?? 'left',
                          padding: '8px 12px',
                          borderBottom: ri < bodyRows.length - 1 ? `1px solid ${theme.border}` : 'none',
                          borderRight: ci < headers.length - 1 ? `1px solid ${theme.border}` : 'none',
                          color: theme.text,
                        }}
                      >
                        {renderInlineFormatted(row[ci] ?? '', theme, `td-${i}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        i = rowIdx;
        continue;
      }
    }

    // Horizontal rule
    if (/^(\s*)([-*_])(?:\s*\2){2,}\s*$/.test(line)) {
      blocks.push(
        <hr
          key={`hr-${i}`}
          style={{
            border: 'none',
            borderTop: `1px solid ${theme.border}`,
            margin: '14px 0',
          }}
        />
      );
      i += 1;
      continue;
    }

    // Headings
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      const fontSize = level === 1 ? 24 : level === 2 ? 20 : level === 3 ? 17 : 15;
      blocks.push(
        <div
          key={`h-${i}`}
          style={{
            fontSize,
            fontWeight: 600,
            lineHeight: `${fontSize + 8}px`,
            color: theme.text,
            marginTop: i === 0 ? 0 : 14,
            marginBottom: 6,
          }}
        >
          {renderInlineFormatted(heading[2]!, theme, `h-${i}`)}
        </div>
      );
      i += 1;
      continue;
    }

    // Blockquotes (grouping contiguous quote lines)
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      const quoteLines: string[] = [quote[1]!];
      let qi = i + 1;
      while (qi < lines.length) {
        const nextQuote = /^\s*>\s?(.*)$/.exec(lines[qi]!);
        if (!nextQuote) break;
        quoteLines.push(nextQuote[1]!);
        qi += 1;
      }
      blocks.push(
        <blockquote
          key={`q-${i}`}
          style={{
            margin: '8px 0',
            padding: '6px 14px',
            borderLeft: `3px solid ${theme.accent}`,
            backgroundColor: theme.surface,
            borderTopRightRadius: Radius.sm,
            borderBottomRightRadius: Radius.sm,
            color: theme.textMuted,
            fontStyle: 'italic',
            ...Typography.app.body,
          }}
        >
          {quoteLines.map((ql, idx) => (
            <div key={idx} style={{ lineHeight: '22px' }}>
              {renderInlineFormatted(ql, theme, `q-${i}-${idx}`)}
            </div>
          ))}
        </blockquote>
      );
      i = qi;
      continue;
    }

    // Task checklist items
    const task = /^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$/.exec(line);
    if (task) {
      const lineIndex = i;
      const indent = Math.floor(task[1]!.length / 2) * 18;
      const checked = task[2]!.toLowerCase() === 'x';
      const label = task[3]!;
      blocks.push(
        <div
          key={`task-${lineIndex}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            paddingLeft: indent,
            margin: '4px 0',
            ...Typography.app.body,
            lineHeight: '22px',
          }}
        >
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={label || 'Checklist item'}
            onClick={() => onToggleCheckbox?.(lineIndex)}
            style={{
              width: 18,
              height: 18,
              marginTop: 2,
              borderRadius: Radius.sm,
              border: `1.5px solid ${checked ? theme.accent : theme.border}`,
              backgroundColor: checked ? theme.accent : 'transparent',
              color: theme.accentText,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: onToggleCheckbox ? 'pointer' : 'default',
              flexShrink: 0,
              padding: 0,
            }}
          >
            {checked ? <Check size={12} strokeWidth={3} /> : null}
          </button>
          <span
            style={{
              flex: 1,
              color: checked ? theme.textMuted : theme.text,
              textDecoration: checked ? 'line-through' : 'none',
            }}
          >
            {renderInlineFormatted(label, theme, `task-${lineIndex}`)}
          </span>
        </div>
      );
      i += 1;
      continue;
    }

    // Bullet / Numbered lists
    const bullet = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      const indent = Math.floor(bullet[1]!.length / 2) * 18;
      const marker = /^\d/.test(bullet[2]!) ? bullet[2]! : '•';
      blocks.push(
        <div
          key={`li-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            paddingLeft: indent,
            margin: '3px 0',
            ...Typography.app.body,
            lineHeight: '22px',
            color: theme.text,
          }}
        >
          <span style={{ color: theme.accent, fontWeight: 600, minWidth: 12 }}>{marker}</span>
          <span style={{ flex: 1 }}>{renderInlineFormatted(bullet[3]!, theme, `li-${i}`)}</span>
        </div>
      );
      i += 1;
      continue;
    }

    if (!line.trim()) {
      blocks.push(<div key={`sp-${i}`} style={{ height: 10 }} />);
      i += 1;
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} style={{ margin: '4px 0', ...Typography.app.body, lineHeight: '22px', color: theme.text }}>
        {renderInlineFormatted(line, theme, `p-${i}`)}
      </p>
    );
    i += 1;
  }

  return <div>{blocks}</div>;
}
