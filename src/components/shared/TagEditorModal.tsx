import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, Tag, X } from 'lucide-react';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';

export function normalizeTagLabel(raw: string): string {
  return raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, 32);
}

export function TagEditorModal({
  visible,
  theme,
  noteTitle,
  tags,
  availableTags,
  onSave,
  onCancel,
}: {
  visible: boolean;
  theme: Theme;
  noteTitle: string;
  tags: string[];
  availableTags: string[];
  onSave: (nextTags: string[]) => void;
  onCancel: () => void;
}) {
  const ink = surfaceTheme(theme);
  const [draftTags, setDraftTags] = useState<string[]>(tags);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!visible) return;
    setDraftTags(tags);
    setInputValue('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [visible, tags]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onCancel]);

  if (!visible) return null;

  const addTag = (raw: string) => {
    const clean = normalizeTagLabel(raw);
    if (!clean) return;
    const exists = draftTags.some((t) => t.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      setDraftTags((prev) => [...prev, clean]);
    }
    setInputValue('');
  };

  const toggleTag = (tag: string) => {
    const exists = draftTags.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (exists) {
      setDraftTags((prev) => prev.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
    } else {
      setDraftTags((prev) => [...prev, tag]);
    }
  };

  const allSuggestions = Array.from(
    new Set([...availableTags, ...draftTags].map((t) => t.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: theme.scrim,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Tags for ${noteTitle}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: theme.surfaceRaised,
          border: `1px solid ${ink.border}`,
          borderRadius: Radius.modal,
          padding: 18,
          boxShadow: `0 16px 40px ${theme.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...Typography.app.cardHeader, color: ink.text }}>Manage tags</div>
            <div
              style={{
                ...Typography.app.caption,
                color: ink.textMuted,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {noteTitle || 'Untitled'}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
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

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag(inputValue);
              }
            }}
            placeholder="Create custom label…"
            aria-label="Create custom label"
            style={{
              flex: 1,
              minWidth: 0,
              height: 40,
              padding: '0 12px',
              borderRadius: Radius.input,
              border: `1px solid ${ink.border}`,
              backgroundColor: theme.background,
              color: ink.text,
              ...Typography.app.body,
            }}
          />
          <button
            type="button"
            disabled={!normalizeTagLabel(inputValue)}
            onClick={() => addTag(inputValue)}
            style={{
              height: 40,
              padding: '0 14px',
              borderRadius: Radius.button,
              border: `1px solid ${ink.border}`,
              backgroundColor: ink.pillBg,
              color: ink.text,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: normalizeTagLabel(inputValue) ? 'pointer' : 'default',
              opacity: normalizeTagLabel(inputValue) ? 1 : 0.45,
              ...Typography.app.bodyStrong,
            }}
          >
            <Plus size={15} />
            <span>Add</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...Typography.app.captionStrong, color: ink.textMuted }}>
            Selected labels ({draftTags.length})
          </div>
          {draftTags.length === 0 ? (
            <div style={{ ...Typography.app.caption, color: ink.textMuted }}>
              No labels yet. Add one above or pick an existing label below.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {draftTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 28,
                    padding: '0 8px 0 10px',
                    borderRadius: Radius.md,
                    backgroundColor: theme.selectedFill,
                    color: theme.selectedText,
                    ...Typography.app.captionStrong,
                  }}
                >
                  <Tag size={12} />
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: Radius.full,
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: theme.selectedText,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {allSuggestions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...Typography.app.captionStrong, color: ink.textMuted }}>
              Workspace labels
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
              {allSuggestions.map((tag) => {
                const active = draftTags.some((t) => t.toLowerCase() === tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTag(tag)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      height: 28,
                      padding: '0 10px',
                      borderRadius: Radius.md,
                      border: `1px solid ${active ? theme.accent : ink.border}`,
                      backgroundColor: active ? ink.pillBg : 'transparent',
                      color: active ? ink.text : ink.textMuted,
                      cursor: 'pointer',
                      ...Typography.app.caption,
                    }}
                  >
                    {active ? <Check size={12} color={theme.accent} /> : <Tag size={11} />}
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: 40,
              padding: '0 16px',
              borderRadius: Radius.button,
              border: `1px solid ${ink.border}`,
              backgroundColor: 'transparent',
              color: ink.text,
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const pending = normalizeTagLabel(inputValue);
              const finalTags =
                pending && !draftTags.some((t) => t.toLowerCase() === pending.toLowerCase())
                  ? [...draftTags, pending]
                  : draftTags;
              onSave(finalTags);
            }}
            style={{
              height: 40,
              padding: '0 18px',
              borderRadius: Radius.button,
              border: 'none',
              backgroundColor: theme.accent,
              color: theme.accentText,
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            Save tags
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
