import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Code2,
  FilePlus2,
  LayoutTemplate,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  extractTemplatePlaceholders,
  getDefaultTokenValues,
  resolveTemplateContent,
} from '../../db/templates';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import type { NoteTemplate } from '../../types';
import { deriveTitle } from '../../utils';
import { MarkdownReadView } from './MarkdownReadView';

export type PreviewDefaultAction = 'insert' | 'newNote';

export function TemplatePreviewModal({
  visible,
  theme,
  template,
  activeNoteTitle,
  hasActiveNote,
  isReplacingBlankNote,
  defaultAction = 'insert',
  onConfirmInsert,
  onConfirmNewNote,
  onOpenInStudio,
  onClose,
}: {
  visible: boolean;
  theme: Theme;
  template: NoteTemplate | null;
  activeNoteTitle?: string;
  hasActiveNote: boolean;
  isReplacingBlankNote?: boolean;
  defaultAction?: PreviewDefaultAction;
  onConfirmInsert: (resolvedContent: string, template: NoteTemplate) => void;
  onConfirmNewNote: (
    resolvedTitle: string,
    resolvedContent: string,
    template: NoteTemplate
  ) => Promise<void> | void;
  onOpenInStudio?: (templateId: string) => void;
  onClose: () => void;
}) {
  const ink = surfaceTheme(theme);
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showAutoTokens, setShowAutoTokens] = useState(false);
  const [applying, setApplying] = useState(false);

  const placeholders = useMemo(() => {
    if (!template) return [];
    return extractTemplatePlaceholders(template.content, activeNoteTitle);
  }, [template, activeNoteTitle]);

  const customPlaceholders = useMemo(
    () => placeholders.filter((p) => !p.isAuto),
    [placeholders]
  );
  const autoPlaceholders = useMemo(
    () => placeholders.filter((p) => p.isAuto),
    [placeholders]
  );

  useEffect(() => {
    if (!visible || !template) return;
    const defaults = getDefaultTokenValues(activeNoteTitle);
    const next: Record<string, string> = {};
    for (const ph of extractTemplatePlaceholders(template.content, activeNoteTitle)) {
      next[ph.key] = ph.isAuto ? (defaults[ph.key] ?? '') : '';
    }
    setFieldValues(next);
    setShowAutoTokens(false);
    setViewMode('rendered');
    setApplying(false);
  }, [visible, template?.id, template?.content, activeNoteTitle]);

  const resolvedContent = useMemo(() => {
    if (!template) return '';
    return resolveTemplateContent(template.content, fieldValues, activeNoteTitle);
  }, [template, fieldValues, activeNoteTitle]);

  const contentStats = useMemo(() => {
    const trimmed = resolvedContent.trim();
    const lines = resolvedContent ? resolvedContent.split('\n').length : 0;
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = resolvedContent.length;
    return { lines, words, chars };
  }, [resolvedContent]);

  useEffect(() => {
    if (!visible || !template) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (defaultAction === 'newNote' || !hasActiveNote) {
          const derived = deriveTitle(resolvedContent);
          const fallback = resolveTemplateContent(template.name, fieldValues, activeNoteTitle);
          void onConfirmNewNote(derived || fallback, resolvedContent, template);
          onClose();
        } else {
          onConfirmInsert(resolvedContent, template);
          onClose();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [
    visible,
    template,
    defaultAction,
    hasActiveNote,
    resolvedContent,
    fieldValues,
    activeNoteTitle,
    onConfirmInsert,
    onConfirmNewNote,
    onClose,
  ]);

  if (!visible || !template) return null;

  const visibleFields = showAutoTokens
    ? [...customPlaceholders, ...autoPlaceholders]
    : customPlaceholders;

  const handleInsert = () => {
    onConfirmInsert(resolvedContent, template);
    onClose();
  };

  const handleNewNote = async () => {
    if (applying) return;
    setApplying(true);
    try {
      const derived = deriveTitle(resolvedContent);
      const fallback = resolveTemplateContent(template.name, fieldValues, activeNoteTitle);
      await onConfirmNewNote(derived || fallback, resolvedContent, template);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const insertIsPrimary = hasActiveNote && defaultAction !== 'newNote';

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1160,
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
        aria-label={`Preview template: ${template.name}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '86vh',
          backgroundColor: theme.surfaceRaised,
          border: `1px solid ${ink.border}`,
          borderRadius: Radius.modal,
          boxShadow: `0 20px 54px ${theme.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 18px 12px 18px',
            borderBottom: `1px solid ${ink.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LayoutTemplate size={17} color={theme.accent} />
              <span style={{ ...Typography.app.cardHeader, color: ink.text }}>
                {template.name}
              </span>
            </div>
            <div style={{ ...Typography.app.caption, color: ink.textMuted, marginTop: 3 }}>
              Preview before applying · {template.category}
              {template.tags.length > 0 ? ` · Tags: ${template.tags.join(', ')}` : ''}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {onOpenInStudio ? (
              <button
                type="button"
                onClick={() => {
                  const id = template.id;
                  onClose();
                  onOpenInStudio(id);
                }}
                style={{
                  height: 30,
                  padding: '0 10px',
                  borderRadius: Radius.button,
                  border: `1px solid ${ink.border}`,
                  backgroundColor: 'transparent',
                  color: ink.textMuted,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  ...Typography.app.captionStrong,
                }}
              >
                Edit in Studio
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              style={{
                width: 32,
                height: 32,
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
        </div>

        {placeholders.length > 0 ? (
          <div
            style={{
              padding: '10px 18px',
              borderBottom: `1px solid ${ink.border}`,
              backgroundColor: theme.surface,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span style={{ ...Typography.app.captionStrong, color: ink.textMuted }}>
                {customPlaceholders.length > 0
                  ? 'Fill template fields'
                  : 'Dynamic date & title tokens'}
              </span>
              {autoPlaceholders.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAutoTokens((s) => !s)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: theme.accent,
                    cursor: 'pointer',
                    padding: 0,
                    ...Typography.app.captionStrong,
                  }}
                >
                  <SlidersHorizontal size={12} />
                  <span>
                    {showAutoTokens ? 'Hide auto tokens' : 'Customize date & title'}
                  </span>
                </button>
              ) : null}
            </div>

            {visibleFields.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                  gap: 8,
                }}
              >
                {visibleFields.map((ph, idx) => (
                  <div key={ph.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label
                      htmlFor={`preview-var-${ph.key}`}
                      style={{ ...Typography.app.caption, color: ink.textMuted }}
                    >
                      {ph.label}
                    </label>
                    <input
                      id={`preview-var-${ph.key}`}
                      type="text"
                      autoFocus={idx === 0 && customPlaceholders.length > 0}
                      value={fieldValues[ph.key] ?? ''}
                      onChange={(e) =>
                        setFieldValues((prev) => ({ ...prev, [ph.key]: e.target.value }))
                      }
                      placeholder={ph.defaultValue || `Enter ${ph.label.toLowerCase()}`}
                      style={{
                        height: 32,
                        padding: '0 9px',
                        borderRadius: Radius.sm,
                        border: `1px solid ${ink.border}`,
                        backgroundColor: theme.background,
                        color: ink.text,
                        ...Typography.app.caption,
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '8px 18px',
            borderBottom: `1px solid ${ink.border}`,
            backgroundColor: theme.background,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              ...Typography.app.caption,
              color: ink.textMuted,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {contentStats.lines} {contentStats.lines === 1 ? 'line' : 'lines'} ·{' '}
            {contentStats.words} {contentStats.words === 1 ? 'word' : 'words'} ·{' '}
            {contentStats.chars} chars
          </span>

          <div
            role="tablist"
            aria-label="Template preview format"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              padding: 2,
              borderRadius: Radius.md,
              backgroundColor: theme.surface,
              border: `1px solid ${ink.border}`,
            }}
          >
            {(
              [
                { key: 'rendered', label: 'Rendered', Icon: BookOpen },
                { key: 'source', label: 'Markdown source', Icon: Code2 },
              ] as const
            ).map(({ key, label, Icon }) => {
              const active = viewMode === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setViewMode(key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    height: 26,
                    padding: '0 9px',
                    borderRadius: Radius.sm,
                    border: 'none',
                    backgroundColor: active ? ink.pillBg : 'transparent',
                    color: active ? ink.text : ink.textMuted,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    ...Typography.app.captionStrong,
                  }}
                >
                  <Icon size={12} color={active ? theme.accent : ink.textMuted} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 160,
            overflowY: 'auto',
            padding: '16px 20px',
            backgroundColor: theme.background,
          }}
        >
          {viewMode === 'rendered' ? (
            <MarkdownReadView content={resolvedContent} theme={theme} />
          ) : (
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 13,
                lineHeight: '20px',
                color: ink.text,
              }}
            >
              {resolvedContent}
            </pre>
          )}
        </div>

        <div
          style={{
            padding: '12px 18px',
            borderTop: `1px solid ${ink.border}`,
            backgroundColor: theme.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <span style={{ ...Typography.app.caption, color: ink.textMuted }}>
            {hasActiveNote
              ? isReplacingBlankNote
                ? 'Blank note will be populated with this structure.'
                : 'Inserts cleanly at your current cursor position.'
              : 'Creates a new note in your current folder.'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 36,
                padding: '0 12px',
                borderRadius: Radius.button,
                border: `1px solid ${ink.border}`,
                backgroundColor: 'transparent',
                color: ink.text,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                ...Typography.app.bodyStrong,
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={applying}
              onClick={() => void handleNewNote()}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: Radius.button,
                border: insertIsPrimary ? `1px solid ${ink.border}` : 'none',
                backgroundColor: insertIsPrimary ? 'transparent' : theme.accent,
                color: insertIsPrimary ? ink.text : theme.accentText,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: applying ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
                ...Typography.app.bodyStrong,
              }}
            >
              <FilePlus2 size={14} />
              <span>New note</span>
            </button>

            {hasActiveNote ? (
              <button
                type="button"
                onClick={handleInsert}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: Radius.button,
                  border: insertIsPrimary ? 'none' : `1px solid ${ink.border}`,
                  backgroundColor: insertIsPrimary ? theme.accent : 'transparent',
                  color: insertIsPrimary ? theme.accentText : ink.text,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  ...Typography.app.bodyStrong,
                }}
              >
                <LayoutTemplate size={14} />
                <span>Insert into note</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
