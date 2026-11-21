import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  Code,
  Code2,
  Columns2,
  FilePlus2,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  LayoutTemplate,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  MoreVertical,
  Pencil,
  Pin,
  Quote,
  Save,
  Strikethrough,
  Table2,
} from 'lucide-react';
import {
  downloadTextFile,
  noteToMarkdown,
  notesToJson,
  slugifyFilename,
} from '../../db/portability';
import { matchSlashTemplateTrigger } from '../../db/templates';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import type { Note, NoteTemplate } from '../../types';
import type { AutoSaveStatus } from '../../hooks/useNoteAutoSave';
import { copyToClipboard, deriveTitle } from '../../utils';
import { ContextMenu, type ContextMenuAction } from '../shared/ContextMenu';
import { applyAutoPair, stepOverCaret } from './autoPairs';
import { LiveMarkdownTextarea } from './LiveMarkdownTextarea';
import { MarkdownReadView } from './MarkdownReadView';
import { TemplatePreviewModal, type PreviewDefaultAction } from './TemplatePreviewModal';

type EditorMode = 'write' | 'split' | 'read';

type FormatAction =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'highlight'
  | 'code'
  | 'codeblock'
  | 'quote'
  | 'bullet'
  | 'numbered'
  | 'checklist'
  | 'link'
  | 'table'
  | 'hr';

const TOOLBAR_GROUPS: { key: FormatAction; label: string; shortcut?: string }[][] = [
  [
    { key: 'h1', label: 'Heading 1' },
    { key: 'h2', label: 'Heading 2' },
    { key: 'h3', label: 'Heading 3' },
  ],
  [
    { key: 'bold', label: 'Bold', shortcut: '⌘B' },
    { key: 'italic', label: 'Italic', shortcut: '⌘I' },
    { key: 'strike', label: 'Strikethrough' },
    { key: 'highlight', label: 'Highlight' },
    { key: 'code', label: 'Inline code', shortcut: '⌘E' },
  ],
  [
    { key: 'bullet', label: 'Bullet list' },
    { key: 'numbered', label: 'Numbered list' },
    { key: 'checklist', label: 'Checklist' },
    { key: 'quote', label: 'Blockquote' },
  ],
  [
    { key: 'link', label: 'Link', shortcut: '⌘K' },
    { key: 'codeblock', label: 'Code block' },
    { key: 'table', label: 'Insert table' },
    { key: 'hr', label: 'Divider' },
  ],
];

function renderFormatIcon(key: FormatAction, color: string) {
  switch (key) {
    case 'h1':
      return <Heading1 size={15} color={color} />;
    case 'h2':
      return <Heading2 size={15} color={color} />;
    case 'h3':
      return <Heading3 size={15} color={color} />;
    case 'bold':
      return <Bold size={15} color={color} />;
    case 'italic':
      return <Italic size={15} color={color} />;
    case 'strike':
      return <Strikethrough size={15} color={color} />;
    case 'highlight':
      return <Highlighter size={15} color={color} />;
    case 'code':
      return <Code size={15} color={color} />;
    case 'codeblock':
      return <Code2 size={15} color={color} />;
    case 'quote':
      return <Quote size={15} color={color} />;
    case 'bullet':
      return <List size={15} color={color} />;
    case 'numbered':
      return <ListOrdered size={15} color={color} />;
    case 'checklist':
      return <ListChecks size={15} color={color} />;
    case 'link':
      return <Link2 size={15} color={color} />;
    case 'table':
      return <Table2 size={15} color={color} />;
    case 'hr':
      return <Minus size={15} color={color} />;
  }
}

export function Editor({
  note,
  theme,
  onContentChange,
  onDelete,
  onTogglePin,
  saveStatus = 'idle',
  onSaveNow,
  templates = [],
  onOpenTemplates,
  onCreateNoteFromTemplate,
  insertRequest,
}: {
  note: Note;
  theme: Theme;
  onContentChange: (text: string) => void;
  onDelete: () => void;
  onTogglePin?: () => void;
  saveStatus?: AutoSaveStatus;
  onSaveNow?: () => void;
  templates?: NoteTemplate[];
  onOpenTemplates?: (opts?: {
    initialView?: 'browse' | 'create' | 'saveNote';
    initialTemplateId?: string;
    liveTitle?: string;
    liveContent?: string;
  }) => void;
  onCreateNoteFromTemplate?: (
    title: string,
    content: string,
    template: NoteTemplate
  ) => Promise<void> | void;
  insertRequest?: { seq: number; text: string } | null;
}) {
  const ink = surfaceTheme(theme);
  const [content, setContent] = useState(note.content);
  const lastNoteIdRef = useRef(note.id);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const templateBtnRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<EditorMode>('write');
  const [stackSplit, setStackSplit] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [hoveredTool, setHoveredTool] = useState<FormatAction | null>(null);

  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [caretPos, setCaretPos] = useState(0);
  const [dismissedSlashAt, setDismissedSlashAt] = useState<number | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [previewState, setPreviewState] = useState<{
    template: NoteTemplate;
    range: { from: number; to: number } | null;
    defaultAction: PreviewDefaultAction;
  } | null>(null);
  const pendingRangeRef = useRef<{ from: number; to: number } | null>(null);
  const lastInsertSeqRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 800;
      setStackSplit(width < 640);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (lastNoteIdRef.current !== note.id) {
      lastNoteIdRef.current = note.id;
      setContent(note.content);
      setDismissedSlashAt(null);
      setPreviewState(null);
      pendingRangeRef.current = null;
      setTemplateMenuAnchor(null);
    }
  }, [note.id, note.content]);

  const commitContent = useCallback(
    (next: string, selStart?: number, selEnd?: number) => {
      setContent(next);
      onContentChange(next);
      if (selStart !== undefined) {
        const end = selEnd ?? selStart;
        setCaretPos(end);
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(selStart, end);
        });
      }
    },
    [onContentChange]
  );

  const insertResolvedTemplate = useCallback(
    (snippet: string, explicitRange?: { from: number; to: number } | null) => {
      const el = textareaRef.current;
      const start = explicitRange?.from ?? el?.selectionStart ?? content.length;
      const end = explicitRange?.to ?? el?.selectionEnd ?? start;
      const before = content.slice(0, start);
      const after = content.slice(end);
      const remainingTrimmed = (before + after).trim();
      const isDefaultBlank = remainingTrimmed === '' || remainingTrimmed === '# Untitled';

      let next: string;
      let nextCaret: number;
      if (isDefaultBlank) {
        next = snippet;
        nextCaret = snippet.length;
      } else {
        const needsLeading =
          start > 0 && content[start - 1] !== '\n' && !snippet.startsWith('\n') ? '\n\n' : '';
        const needsTrailing =
          after.length > 0 && !snippet.endsWith('\n') && !after.startsWith('\n') ? '\n' : '';
        next = `${before}${needsLeading}${snippet}${needsTrailing}${after}`;
        nextCaret = before.length + needsLeading.length + snippet.length;
      }
      pendingRangeRef.current = null;
      setDismissedSlashAt(null);
      setTemplateMenuAnchor(null);
      commitContent(next, nextCaret);
    },
    [content, commitContent]
  );

  useEffect(() => {
    if (!insertRequest || insertRequest.seq === lastInsertSeqRef.current) return;
    lastInsertSeqRef.current = insertRequest.seq;
    insertResolvedTemplate(insertRequest.text, pendingRangeRef.current);
  }, [insertRequest, insertResolvedTemplate]);

  const slashMatch = useMemo(() => {
    if (mode === 'read') return null;
    return matchSlashTemplateTrigger(content, caretPos);
  }, [mode, content, caretPos]);

  const activeSlashMatch =
    slashMatch && dismissedSlashAt !== slashMatch.from ? slashMatch : null;

  const slashFilteredTemplates = useMemo(() => {
    if (!activeSlashMatch) return [];
    const q = activeSlashMatch.query.toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [activeSlashMatch, templates]);

  useEffect(() => {
    setSlashIndex(0);
  }, [activeSlashMatch?.from, activeSlashMatch?.query]);

  useEffect(() => {
    if (dismissedSlashAt !== null && (!slashMatch || slashMatch.from !== dismissedSlashAt)) {
      setDismissedSlashAt(null);
    }
  }, [slashMatch, dismissedSlashAt]);

  const applyTemplateFromQuickTrigger = useCallback(
    (tpl: NoteTemplate, range?: { from: number; to: number } | null, forceNewNote = false) => {
      const resolvedRange =
        range ?? {
          from: textareaRef.current?.selectionStart ?? content.length,
          to:
            textareaRef.current?.selectionEnd ??
            textareaRef.current?.selectionStart ??
            content.length,
        };
      setTemplateMenuAnchor(null);
      setPreviewState({
        template: tpl,
        range: resolvedRange,
        defaultAction: forceNewNote ? 'newNote' : 'insert',
      });
    },
    [content.length]
  );

  const handleChange = (text: string) => {
    const caret = textareaRef.current?.selectionStart ?? text.length;
    setCaretPos(caret);
    const paired = applyAutoPair(content, text, caret);
    const stepped = paired ? null : stepOverCaret(text, content, caret);

    if (paired) {
      commitContent(paired.text, paired.caret, paired.caret);
      return;
    }
    if (stepped !== null) {
      commitContent(text, stepped, stepped);
      return;
    }

    commitContent(text);
  };

  const applyFormat = useCallback(
    (action: FormatAction) => {
      const el = textareaRef.current;
      const start = el?.selectionStart ?? content.length;
      const end = el?.selectionEnd ?? start;
      const selected = content.slice(start, end);

      const wrapInline = (open: string, close: string, placeholder = '') => {
        if (selected) {
          if (selected.startsWith(open) && selected.endsWith(close) && selected.length >= open.length + close.length) {
            const unwrapped = selected.slice(open.length, selected.length - close.length);
            const next = content.slice(0, start) + unwrapped + content.slice(end);
            commitContent(next, start, start + unwrapped.length);
            return;
          }
          const wrapped = `${open}${selected}${close}`;
          const next = content.slice(0, start) + wrapped + content.slice(end);
          commitContent(next, start + open.length, start + open.length + selected.length);
          return;
        }
        const insertion = `${open}${placeholder}${close}`;
        const next = content.slice(0, start) + insertion + content.slice(end);
        const caretStart = start + open.length;
        commitContent(next, caretStart, caretStart + placeholder.length);
      };

      const prefixLines = (prefix: string) => {
        const lineStart = content.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const lineEndRaw = content.indexOf('\n', end);
        const lineEnd = lineEndRaw === -1 ? content.length : lineEndRaw;
        const block = content.slice(lineStart, lineEnd);
        const lines = block.split('\n');
        const headingStrip = /^#{1,6}\s+/;
        const isHeading = /^#{1,6}\s+$/.test(prefix);

        const allHave = lines.every((l) => l.startsWith(prefix));
        const transformed = lines.map((l, idx) => {
          if (allHave) return l.slice(prefix.length);
          if (isHeading && headingStrip.test(l)) return prefix + l.replace(headingStrip, '');
          if (prefix === '1. ') return `${idx + 1}. ${l.replace(/^\d+[.)]\s+/, '')}`;
          return `${prefix}${l}`;
        });

        const replaced = transformed.join('\n');
        const next = content.slice(0, lineStart) + replaced + content.slice(lineEnd);
        commitContent(next, lineStart, lineStart + replaced.length);
      };

      switch (action) {
        case 'h1':
          prefixLines('# ');
          break;
        case 'h2':
          prefixLines('## ');
          break;
        case 'h3':
          prefixLines('### ');
          break;
        case 'bold':
          wrapInline('**', '**');
          break;
        case 'italic':
          wrapInline('*', '*');
          break;
        case 'strike':
          wrapInline('~~', '~~');
          break;
        case 'highlight':
          wrapInline('==', '==');
          break;
        case 'code':
          wrapInline('`', '`');
          break;
        case 'quote':
          prefixLines('> ');
          break;
        case 'bullet':
          prefixLines('- ');
          break;
        case 'numbered':
          prefixLines('1. ');
          break;
        case 'checklist':
          prefixLines('- [ ] ');
          break;
        case 'link': {
          const label = selected || 'link text';
          const insertion = `[${label}](https://)`;
          const next = content.slice(0, start) + insertion + content.slice(end);
          const urlStart = start + label.length + 3;
          commitContent(next, urlStart, urlStart + 'https://'.length);
          break;
        }
        case 'codeblock': {
          const body = selected || 'code';
          const needsLeadingNewline = start > 0 && content[start - 1] !== '\n' ? '\n' : '';
          const insertion = `${needsLeadingNewline}\`\`\`\n${body}\n\`\`\`\n`;
          const next = content.slice(0, start) + insertion + content.slice(end);
          const bodyStart = start + needsLeadingNewline.length + 4;
          commitContent(next, bodyStart, bodyStart + body.length);
          break;
        }
        case 'table': {
          const needsLeading = start > 0 && content[start - 1] !== '\n' ? '\n' : '';
          const tableSnippet = `${needsLeading}| Column 1 | Column 2 |\n| --- | --- |\n| Item 1 | Item 2 |\n`;
          const next = content.slice(0, start) + tableSnippet + content.slice(end);
          commitContent(next, start + needsLeading.length + 2, start + needsLeading.length + 10);
          break;
        }
        case 'hr': {
          const needsLeading = start > 0 && content[start - 1] !== '\n' ? '\n' : '';
          const divider = `${needsLeading}---\n`;
          const next = content.slice(0, start) + divider + content.slice(end);
          commitContent(next, start + divider.length);
          break;
        }
      }
    },
    [content, commitContent]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (activeSlashMatch) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setDismissedSlashAt(activeSlashMatch.from);
        return;
      }
      if (slashFilteredTemplates.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlashIndex((i) => (i + 1) % slashFilteredTemplates.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlashIndex(
            (i) => (i - 1 + slashFilteredTemplates.length) % slashFilteredTemplates.length
          );
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          const chosen = slashFilteredTemplates[slashIndex] ?? slashFilteredTemplates[0];
          if (chosen) {
            e.preventDefault();
            e.stopPropagation();
            applyTemplateFromQuickTrigger(
              chosen,
              { from: activeSlashMatch.from, to: activeSlashMatch.to },
              e.shiftKey
            );
            return;
          }
        }
      }
    }

    const mod = e.metaKey || e.ctrlKey;
    if (mod) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        e.stopPropagation();
        applyFormat('bold');
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        e.stopPropagation();
        applyFormat('italic');
        return;
      }
      if (key === 'e') {
        e.preventDefault();
        e.stopPropagation();
        applyFormat('code');
        return;
      }
      if (key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        applyFormat('link');
        return;
      }
      if (key === 's') {
        e.preventDefault();
        e.stopPropagation();
        onSaveNow?.();
        return;
      }
    }

    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (start !== end || e.shiftKey) {
        const lineStart = content.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const lineEndRaw = content.indexOf('\n', end);
        const lineEnd = lineEndRaw === -1 ? content.length : lineEndRaw;
        const block = content.slice(lineStart, lineEnd);
        const updated = block
          .split('\n')
          .map((line) => (e.shiftKey ? line.replace(/^ {1,2}/, '') : `  ${line}`))
          .join('\n');
        const next = content.slice(0, lineStart) + updated + content.slice(lineEnd);
        commitContent(next, lineStart, lineStart + updated.length);
      } else {
        const next = `${content.slice(0, start)}  ${content.slice(end)}`;
        commitContent(next, start + 2);
      }
      return;
    }

    if (e.key === 'Enter' && start === end && !e.shiftKey && !e.altKey && !mod) {
      const lineStart = content.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const lineUpToCursor = content.slice(lineStart, start);

      const taskMatch = /^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/.exec(lineUpToCursor);
      if (taskMatch) {
        e.preventDefault();
        if (!taskMatch[2]!.trim()) {
          const next = content.slice(0, lineStart) + content.slice(start);
          commitContent(next, lineStart);
        } else {
          const indent = /^(\s*)/.exec(taskMatch[1]!)?.[1] ?? '';
          const continuation = `\n${indent}- [ ] `;
          const next = content.slice(0, start) + continuation + content.slice(end);
          commitContent(next, start + continuation.length);
        }
        return;
      }

      const bulletMatch = /^(\s*[-*+]\s+)(.*)$/.exec(lineUpToCursor);
      if (bulletMatch) {
        e.preventDefault();
        if (!bulletMatch[2]!.trim()) {
          const next = content.slice(0, lineStart) + content.slice(start);
          commitContent(next, lineStart);
        } else {
          const continuation = `\n${bulletMatch[1]!}`;
          const next = content.slice(0, start) + continuation + content.slice(end);
          commitContent(next, start + continuation.length);
        }
        return;
      }

      const numberedMatch = /^(\s*)(\d+)([.)]\s+)(.*)$/.exec(lineUpToCursor);
      if (numberedMatch) {
        e.preventDefault();
        if (!numberedMatch[4]!.trim()) {
          const next = content.slice(0, lineStart) + content.slice(start);
          commitContent(next, lineStart);
        } else {
          const nextNum = Number(numberedMatch[2]) + 1;
          const continuation = `\n${numberedMatch[1]!}${nextNum}${numberedMatch[3]!}`;
          const next = content.slice(0, start) + continuation + content.slice(end);
          commitContent(next, start + continuation.length);
        }
        return;
      }

      const quoteMatch = /^(\s*>\s?)(.*)$/.exec(lineUpToCursor);
      if (quoteMatch) {
        e.preventDefault();
        if (!quoteMatch[2]!.trim()) {
          const next = content.slice(0, lineStart) + content.slice(start);
          commitContent(next, lineStart);
        } else {
          const continuation = `\n${quoteMatch[1]!}`;
          const next = content.slice(0, start) + continuation + content.slice(end);
          commitContent(next, start + continuation.length);
        }
      }
    }
  };

  const handleToggleCheckbox = useCallback(
    (lineIndex: number) => {
      const lines = content.split('\n');
      const line = lines[lineIndex];
      if (!line) return;
      lines[lineIndex] = line.replace(
        /^(\s*[-*+]\s+\[)([ xX])(\])/,
        (_full, prefix: string, state: string, suffix: string) =>
          `${prefix}${state.toLowerCase() === 'x' ? ' ' : 'x'}${suffix}`
      );
      commitContent(lines.join('\n'));
    },
    [content, commitContent]
  );

  const stats = useMemo(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = content.length;
    const charsNoSpaces = content.replace(/\s+/g, '').length;
    const readMinutes = words > 0 ? Math.max(1, Math.ceil(words / 200)) : 0;
    return { words, chars, charsNoSpaces, readMinutes };
  }, [content]);

  const liveNoteSnapshot: Note = {
    ...note,
    title: deriveTitle(content) || note.title,
    content,
  };

  const noteActions: ContextMenuAction[] = [
    ...(onOpenTemplates
      ? [
          {
            label: 'Browse templates…',
            iconName: 'template-outline',
            onPress: () => {
              pendingRangeRef.current = {
                from: textareaRef.current?.selectionStart ?? content.length,
                to:
                  textareaRef.current?.selectionEnd ??
                  textareaRef.current?.selectionStart ??
                  content.length,
              };
              onOpenTemplates({
                initialView: 'browse',
                liveTitle: liveNoteSnapshot.title,
                liveContent: content,
              });
              setMenuAnchor(null);
            },
          },
          {
            label: 'Save as template…',
            iconName: 'template-save-outline',
            onPress: () => {
              onOpenTemplates({
                initialView: 'saveNote',
                liveTitle: liveNoteSnapshot.title,
                liveContent: content,
              });
              setMenuAnchor(null);
            },
          },
        ]
      : []),
    ...(onTogglePin
      ? [
          {
            label: note.isPinned ? 'Unpin note' : 'Pin note',
            iconName: note.isPinned ? 'pin-off-outline' : 'pin-outline',
            onPress: () => {
              onTogglePin();
              setMenuAnchor(null);
            },
          },
        ]
      : []),
    {
      label: copiedNote ? 'Copied Markdown' : 'Copy Markdown',
      iconName: 'content-copy',
      onPress: () => {
        void copyToClipboard(content).then((ok) => {
          if (ok) {
            setCopiedNote(true);
            if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
            copyTimerRef.current = setTimeout(() => setCopiedNote(false), 1600);
          }
        });
        setMenuAnchor(null);
      },
    },
    {
      label: 'Export Markdown (.md)',
      iconName: 'download',
      onPress: () => {
        onSaveNow?.();
        const filename = `${slugifyFilename(liveNoteSnapshot.title, 'note')}.md`;
        downloadTextFile(filename, noteToMarkdown(liveNoteSnapshot), 'text/markdown;charset=utf-8');
        setMenuAnchor(null);
      },
    },
    {
      label: 'Export JSON (.json)',
      iconName: 'file-code',
      onPress: () => {
        onSaveNow?.();
        const filename = `${slugifyFilename(liveNoteSnapshot.title, 'note')}.json`;
        downloadTextFile(filename, notesToJson([liveNoteSnapshot], []), 'application/json');
        setMenuAnchor(null);
      },
    },
    {
      label: 'Delete',
      iconName: 'trash-can-outline',
      destructive: true,
      onPress: () => {
        onDelete();
        setMenuAnchor(null);
      },
    },
  ];

  const showEditor = mode === 'write' || mode === 'split';
  const showPreview = mode === 'read' || mode === 'split';

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            ...Typography.app.cardHeader,
            color: theme.text,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {deriveTitle(content) || note.title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {onTogglePin ? (
            <button
              type="button"
              onClick={onTogglePin}
              aria-pressed={Boolean(note.isPinned)}
              aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
              title={note.isPinned ? 'Unpin note' : 'Pin note'}
              style={{
                width: 32,
                height: 32,
                borderRadius: Radius.md,
                border: note.isPinned ? `1px solid ${theme.accent}` : `1px solid ${theme.border}`,
                backgroundColor: note.isPinned ? theme.pillBg : 'transparent',
                color: note.isPinned ? theme.accent : theme.textMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Pin size={15} />
            </button>
          ) : null}

          <div
            role="tablist"
            aria-label="Editor view mode"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: 3,
              borderRadius: Radius.full,
              backgroundColor: theme.surface,
              border: `1px solid ${theme.border}`,
              gap: 2,
            }}
          >
            {(
              [
                { key: 'write', label: 'Write', Icon: Pencil },
                { key: 'split', label: 'Split', Icon: Columns2 },
                { key: 'read', label: 'Read', Icon: BookOpen },
              ] as const
            ).map(({ key, label, Icon }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(key)}
                  title={`${label} view`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    height: 26,
                    padding: '0 10px',
                    borderRadius: Radius.full,
                    border: 'none',
                    backgroundColor: active ? theme.pillBg : 'transparent',
                    color: active ? theme.text : theme.textMuted,
                    cursor: 'pointer',
                    ...Typography.app.captionStrong,
                  }}
                >
                  <Icon size={13} color={active ? theme.accent : theme.textMuted} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={(e) => setMenuAnchor({ x: e.clientX, y: e.clientY })}
            aria-label={`Note actions for ${note.title}`}
            style={{
              width: 32,
              height: 32,
              borderRadius: Radius.md,
              border: 'none',
              backgroundColor: 'transparent',
              color: theme.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {showEditor ? (
        <div
          role="toolbar"
          aria-label="Markdown formatting toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 16px',
            borderTop: `1px solid ${theme.border}`,
            borderBottom: `1px solid ${theme.border}`,
            backgroundColor: theme.surface,
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          {TOOLBAR_GROUPS.map((group, groupIdx) => (
            <div
              key={groupIdx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                paddingRight: groupIdx < TOOLBAR_GROUPS.length - 1 ? 6 : 0,
                marginRight: groupIdx < TOOLBAR_GROUPS.length - 1 ? 4 : 0,
                borderRight: groupIdx < TOOLBAR_GROUPS.length - 1 ? `1px solid ${theme.border}` : 'none',
              }}
            >
              {group.map((tool) => {
                const isHovered = hoveredTool === tool.key;
                const titleText = tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label;
                return (
                  <button
                    key={tool.key}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyFormat(tool.key)}
                    onMouseEnter={() => setHoveredTool(tool.key)}
                    onMouseLeave={() => setHoveredTool((curr) => (curr === tool.key ? null : curr))}
                    aria-label={tool.label}
                    title={titleText}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: Radius.sm,
                      border: 'none',
                      backgroundColor: isHovered ? theme.pillBg : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {renderFormatIcon(tool.key, isHovered ? theme.text : theme.textMuted)}
                  </button>
                );
              })}
            </div>
          ))}

          {onOpenTemplates ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                paddingLeft: 6,
                marginLeft: 4,
                borderLeft: `1px solid ${theme.border}`,
                flexShrink: 0,
              }}
            >
              <button
                ref={templateBtnRef}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (templateMenuAnchor) {
                    setTemplateMenuAnchor(null);
                    return;
                  }
                  pendingRangeRef.current = {
                    from: textareaRef.current?.selectionStart ?? content.length,
                    to:
                      textareaRef.current?.selectionEnd ??
                      textareaRef.current?.selectionStart ??
                      content.length,
                  };
                  const rect = templateBtnRef.current?.getBoundingClientRect();
                  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
                  setTemplateMenuAnchor({
                    left: rect ? Math.max(12, Math.min(vw - 292, rect.left)) : 16,
                    top: rect ? rect.bottom + 6 : 100,
                  });
                }}
                aria-expanded={Boolean(templateMenuAnchor)}
                aria-haspopup="menu"
                aria-label="Templates"
                title="Insert or manage note templates (/template)"
                style={{
                  height: 28,
                  padding: '0 8px',
                  borderRadius: Radius.sm,
                  border: templateMenuAnchor ? `1px solid ${theme.accent}` : '1px solid transparent',
                  backgroundColor: templateMenuAnchor ? theme.pillBg : 'transparent',
                  color: templateMenuAnchor ? theme.text : theme.textMuted,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  ...Typography.app.captionStrong,
                }}
              >
                <LayoutTemplate size={14} color={templateMenuAnchor ? theme.accent : theme.textMuted} />
                <span>Templates</span>
                <ChevronDown size={12} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: mode === 'split' && stackSplit ? 'column' : 'row',
          position: 'relative',
        }}
      >
        {showEditor ? (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              position: 'relative',
              borderRight: mode === 'split' && !stackSplit ? `1px solid ${theme.border}` : 'none',
              borderBottom: mode === 'split' && stackSplit ? `1px solid ${theme.border}` : 'none',
            }}
          >
            <LiveMarkdownTextarea
              key={note.id}
              ref={textareaRef}
              value={content}
              onChangeText={handleChange}
              onKeyDown={handleKeyDown}
              onClick={(e) => setCaretPos(e.currentTarget.selectionStart ?? 0)}
              onKeyUp={(e) => setCaretPos(e.currentTarget.selectionStart ?? 0)}
              onSelect={(e) => setCaretPos(e.currentTarget.selectionStart ?? 0)}
              theme={theme}
              placeholder="Start typing in Markdown or type /template…"
              aria-label="Note content"
              style={{
                padding: 24,
                color: theme.text,
                ...Typography.app.body,
                lineHeight: '22px',
              }}
            />

            {activeSlashMatch ? (
              <div
                role="listbox"
                aria-label="Template slash suggestions"
                style={{
                  position: 'absolute',
                  left: 20,
                  right: 20,
                  maxWidth: 360,
                  top: Math.max(
                    16,
                    Math.min(
                      240,
                      (content.slice(0, activeSlashMatch.from).split('\n').length) * 22 + 28
                    )
                  ),
                  zIndex: 25,
                  backgroundColor: theme.surfaceRaised,
                  border: `1px solid ${ink.border}`,
                  borderRadius: Radius.lg,
                  boxShadow: `0 12px 32px ${theme.shadow}`,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    borderBottom: `1px solid ${ink.border}`,
                    backgroundColor: theme.surface,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    ...Typography.app.captionStrong,
                    color: ink.textMuted,
                  }}
                >
                  <span>Templates {activeSlashMatch.query ? `· "${activeSlashMatch.query}"` : ''}</span>
                  <span style={{ ...Typography.app.caption }}>↵ preview · ⇧↵ new note</span>
                </div>

                {slashFilteredTemplates.length === 0 ? (
                  <div
                    style={{
                      padding: '12px 14px',
                      ...Typography.app.caption,
                      color: ink.textMuted,
                    }}
                  >
                    No matching templates. Press Esc to keep typing.
                  </div>
                ) : (
                  <div style={{ maxHeight: 240, overflowY: 'auto', padding: 4 }}>
                    {slashFilteredTemplates.map((tpl, idx) => {
                      const highlighted = idx === slashIndex;
                      return (
                        <div
                          key={tpl.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: Radius.md,
                            backgroundColor: highlighted ? ink.pillBg : 'transparent',
                            padding: '2px 4px',
                          }}
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={highlighted}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setSlashIndex(idx)}
                            onClick={() =>
                              applyTemplateFromQuickTrigger(tpl, {
                                from: activeSlashMatch.from,
                                to: activeSlashMatch.to,
                              })
                            }
                            style={{
                              flex: 1,
                              minWidth: 0,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: 1,
                              padding: '6px 8px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: ink.text,
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            <span
                              style={{
                                ...Typography.app.bodyStrong,
                                color: highlighted ? theme.text : ink.text,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                width: '100%',
                              }}
                            >
                              {tpl.name}
                            </span>
                            <span
                              style={{
                                ...Typography.app.caption,
                                color: ink.textMuted,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                width: '100%',
                              }}
                            >
                              {tpl.category}
                              {tpl.description ? ` · ${tpl.description}` : ''}
                            </span>
                          </button>
                          {onCreateNoteFromTemplate ? (
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() =>
                                applyTemplateFromQuickTrigger(
                                  tpl,
                                  {
                                    from: activeSlashMatch.from,
                                    to: activeSlashMatch.to,
                                  },
                                  true
                                )
                              }
                              title="Create new note from template"
                              aria-label={`New note from ${tpl.name}`}
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: Radius.sm,
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: ink.textMuted,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0,
                              }}
                            >
                              <FilePlus2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {showPreview ? (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: 'auto',
              padding: '20px 24px 64px 24px',
            }}
          >
            <MarkdownReadView
              content={content}
              theme={theme}
              onToggleCheckbox={handleToggleCheckbox}
            />
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '6px 16px',
          borderTop: `1px solid ${theme.border}`,
          backgroundColor: theme.surface,
          color: theme.textMuted,
          ...Typography.app.caption,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        <span
          aria-label={`${stats.words} ${stats.words === 1 ? 'word' : 'words'}, ${stats.chars} ${stats.chars === 1 ? 'character' : 'characters'}`}
          title={`${stats.charsNoSpaces.toLocaleString()} characters excluding spaces`}
          style={{
            opacity: 0.78,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {stats.words.toLocaleString()} {stats.words === 1 ? 'word' : 'words'} ·{' '}
          {stats.chars.toLocaleString()} {stats.chars === 1 ? 'character' : 'characters'}
          {stats.words > 0 ? ` · ${stats.readMinutes} min read` : ''}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.82, flexShrink: 0 }}>
          {copiedNote ? (
            <span style={{ color: theme.accent, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={12} /> Copied
            </span>
          ) : saveStatus === 'saving' ? (
            <span>Saving…</span>
          ) : saveStatus === 'saved' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={12} color={theme.accent} /> Saved
            </span>
          ) : (
            <span>Markdown</span>
          )}
        </span>
      </div>

      <ContextMenu
        anchor={menuAnchor}
        actions={noteActions}
        align="right"
        theme={theme}
        onDismiss={() => setMenuAnchor(null)}
      />

      {templateMenuAnchor && onOpenTemplates ? (
        <div
          onClick={() => setTemplateMenuAnchor(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 990,
          }}
        >
          <div
            role="menu"
            aria-label="Templates menu"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: templateMenuAnchor.top,
              left: templateMenuAnchor.left,
              width: 280,
              backgroundColor: theme.surfaceRaised,
              borderRadius: Radius.lg,
              border: `1px solid ${ink.border}`,
              boxShadow: `0 12px 32px ${theme.shadow}`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                borderBottom: `1px solid ${ink.border}`,
                backgroundColor: theme.surface,
                ...Typography.app.captionStrong,
                color: ink.textMuted,
              }}
            >
              Select to preview · + for new note
            </div>

            <div style={{ maxHeight: 248, overflowY: 'auto', padding: 4 }}>
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 2px',
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyTemplateFromQuickTrigger(tpl, pendingRangeRef.current)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 1,
                      padding: '7px 10px',
                      borderRadius: Radius.md,
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: ink.text,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        ...Typography.app.bodyStrong,
                        color: ink.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%',
                      }}
                    >
                      {tpl.name}
                    </span>
                    <span style={{ ...Typography.app.caption, color: ink.textMuted }}>
                      {tpl.category}
                    </span>
                  </button>

                  {onCreateNoteFromTemplate ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyTemplateFromQuickTrigger(tpl, null, true)}
                      title={`New note from ${tpl.name}`}
                      aria-label={`New note from ${tpl.name}`}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: Radius.sm,
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: ink.textMuted,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <FilePlus2 size={14} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div
              style={{
                borderTop: `1px solid ${ink.border}`,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                backgroundColor: theme.surface,
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setTemplateMenuAnchor(null);
                  onOpenTemplates({
                    initialView: 'saveNote',
                    liveTitle: liveNoteSnapshot.title,
                    liveContent: content,
                  });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 34,
                  padding: '0 10px',
                  borderRadius: Radius.md,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: ink.text,
                  cursor: 'pointer',
                  textAlign: 'left',
                  ...Typography.app.captionStrong,
                }}
              >
                <Save size={14} color={theme.accent} />
                <span>Save current note as template…</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setTemplateMenuAnchor(null);
                  onOpenTemplates({
                    initialView: 'browse',
                    liveTitle: liveNoteSnapshot.title,
                    liveContent: content,
                  });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 34,
                  padding: '0 10px',
                  borderRadius: Radius.md,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: ink.text,
                  cursor: 'pointer',
                  textAlign: 'left',
                  ...Typography.app.captionStrong,
                }}
              >
                <LayoutTemplate size={14} color={ink.textMuted} />
                <span>Open Templates Studio…</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <TemplatePreviewModal
        visible={previewState !== null}
        theme={theme}
        template={previewState?.template ?? null}
        activeNoteTitle={liveNoteSnapshot.title}
        hasActiveNote
        isReplacingBlankNote={(() => {
          const r = previewState?.range;
          const remaining = r
            ? (content.slice(0, r.from) + content.slice(r.to)).trim()
            : content.trim();
          return remaining === '' || remaining === '# Untitled';
        })()}
        defaultAction={previewState?.defaultAction ?? 'insert'}
        onConfirmInsert={(resolvedContent) => {
          insertResolvedTemplate(resolvedContent, previewState?.range);
          setPreviewState(null);
        }}
        onConfirmNewNote={async (resolvedTitle, resolvedContent, tpl) => {
          const r = previewState?.range;
          if (r && r.to > r.from) {
            const stripped = content.slice(0, r.from) + content.slice(r.to);
            commitContent(stripped, r.from);
          }
          setDismissedSlashAt(null);
          setPreviewState(null);
          await onCreateNoteFromTemplate?.(resolvedTitle, resolvedContent, tpl);
        }}
        onOpenInStudio={
          onOpenTemplates
            ? (templateId) => {
                pendingRangeRef.current = previewState?.range ?? null;
                setPreviewState(null);
                onOpenTemplates({
                  initialView: 'browse',
                  initialTemplateId: templateId,
                  liveTitle: liveNoteSnapshot.title,
                  liveContent: content,
                });
              }
            : undefined
        }
        onClose={() => setPreviewState(null)}
      />
    </div>
  );
}
