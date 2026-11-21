import { useRef, type CSSProperties } from 'react';
import {
  Bold,
  Code,
  FilePlus2,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
} from 'lucide-react';
import { Radius, Typography, primaryTheme, surfaceTheme, type Theme } from '../../theme';
import { LiveMarkdownTextarea } from '../notes/LiveMarkdownTextarea';
import { Card } from '../shared/Card';

type MarkdownTool = 'bold' | 'italic' | 'heading' | 'bullet' | 'numbered' | 'code' | 'link';

const TOOLS: { key: MarkdownTool; label: string }[] = [
  { key: 'bold', label: 'Bold' },
  { key: 'italic', label: 'Italic' },
  { key: 'heading', label: 'Heading' },
  { key: 'bullet', label: 'Bullet list' },
  { key: 'numbered', label: 'Numbered list' },
  { key: 'code', label: 'Code' },
  { key: 'link', label: 'Link' },
];

function renderToolIcon(key: MarkdownTool, color: string) {
  switch (key) {
    case 'bold':
      return <Bold size={15} color={color} />;
    case 'italic':
      return <Italic size={15} color={color} />;
    case 'heading':
      return <Heading2 size={15} color={color} />;
    case 'bullet':
      return <List size={15} color={color} />;
    case 'numbered':
      return <ListOrdered size={15} color={color} />;
    case 'code':
      return <Code size={15} color={color} />;
    case 'link':
      return <Link2 size={15} color={color} />;
  }
}

export function ScratchPadCard({
  theme,
  value,
  onChangeText,
  onCreateNote,
  primary = false,
  expanded = false,
  style,
}: {
  primary?: boolean;
  expanded?: boolean;
  theme: Theme;
  value: string;
  onChangeText: (t: string) => void;
  onCreateNote?: () => void;
  style?: CSSProperties;
}) {
  const ink = primary ? primaryTheme(theme) : surfaceTheme(theme);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = (tool: MarkdownTool) => {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);

    let insertion = '';
    let cursorOffset = 0;

    switch (tool) {
      case 'bold':
        insertion = '****';
        cursorOffset = 2;
        break;
      case 'italic':
        insertion = '**';
        cursorOffset = 1;
        break;
      case 'heading':
        insertion = '## ';
        cursorOffset = insertion.length;
        break;
      case 'bullet':
        insertion = '- ';
        cursorOffset = insertion.length;
        break;
      case 'numbered':
        insertion = '1. ';
        cursorOffset = insertion.length;
        break;
      case 'code':
        insertion = '``';
        cursorOffset = 1;
        break;
      case 'link':
        insertion = '[text](url)';
        cursorOffset = insertion.length;
        break;
    }

    onChangeText(before + insertion + after);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(cursor + cursorOffset, cursor + cursorOffset);
      }
    });
  };

  return (
    <Card
      theme={ink}
      style={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        ...(expanded ? { paddingTop: 28, paddingBottom: 28 } : {}),
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginBottom: 8,
          gap: 8,
        }}
      >
        {onCreateNote ? (
          <button
            type="button"
            onClick={onCreateNote}
            disabled={value.trim().length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 10px',
              borderRadius: Radius.full,
              border: `1px solid ${ink.border}`,
              backgroundColor: ink.pillBg,
              color: ink.text,
              cursor: value.trim().length === 0 ? 'default' : 'pointer',
              opacity: value.trim().length === 0 ? 0.4 : 1,
              ...Typography.app.captionStrong,
            }}
          >
            <FilePlus2 size={15} color={ink.text} />
            <span>Save as note</span>
          </button>
        ) : null}

        <span style={{ ...Typography.app.caption, color: ink.textMuted, minWidth: 12, textAlign: 'right' }}>
          {value.length > 0 ? value.length : ''}
        </span>
      </div>

      <LiveMarkdownTextarea
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        theme={ink}
        placeholder="Jot down quick thoughts…"
        aria-label="Scratch pad"
        style={{
          minHeight: 120,
          flex: 1,
          color: ink.text,
          ...Typography.app.body,
          padding: '4px 0 0 0',
        }}
      />

      <div
        style={{
          marginTop: 12,
          borderTop: `1px solid ${ink.border}`,
          paddingTop: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          overflowX: 'auto',
        }}
      >
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            type="button"
            onClick={() => insertMarkdown(tool.key)}
            aria-label={tool.label}
            title={tool.label}
            style={{
              width: 32,
              height: 32,
              borderRadius: Radius.md,
              border: `1px solid ${ink.border}`,
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {renderToolIcon(tool.key, ink.textMuted)}
          </button>
        ))}
      </div>
    </Card>
  );
}
