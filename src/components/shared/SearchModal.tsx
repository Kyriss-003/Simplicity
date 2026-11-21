import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Folder as FolderIcon, Search, X } from 'lucide-react';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import type { Folder, Note } from '../../types';
import {
  MODAL_SEARCH_LIMIT,
  searchLocalNotesAndFolders,
  splitHighlightParts,
  type SearchResult,
} from './searchUtils';

function HighlightedText({
  text,
  query,
  accentColor,
}: {
  text: string;
  query: string;
  accentColor: string;
}) {
  const parts = useMemo(() => splitHighlightParts(text, query), [text, query]);
  return (
    <>
      {parts.map((part, idx) =>
        part.matched ? (
          <span
            key={idx}
            style={{
              color: accentColor,
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: 2,
            }}
          >
            {part.text}
          </span>
        ) : (
          <span key={idx}>{part.text}</span>
        )
      )}
    </>
  );
}

export function SearchModal({
  visible,
  theme,
  notes,
  folders,
  query,
  onQueryChange,
  onSelectResult,
  onClose,
}: {
  visible: boolean;
  theme: Theme;
  notes: readonly Note[];
  folders: readonly Folder[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelectResult: (result: SearchResult) => void;
  onClose: () => void;
}) {
  const ink = surfaceTheme(theme);
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    if (!query.trim()) {
      const recent = notes.slice(0, 6).map<SearchResult>((n) => ({
        key: `note:${n.id}`,
        kind: 'note',
        label: n.title || 'Untitled',
        sublabel: folders.find((f) => f.id === n.folderId)?.label ?? 'Main',
        snippet: n.content.split('\n').find((l) => l.trim() && !l.trim().startsWith('#'))?.trim(),
      }));
      return recent;
    }
    return searchLocalNotesAndFolders(query, notes, folders, {
      includeFolders: true,
      limit: MODAL_SEARCH_LIMIT,
    });
  }, [query, notes, folders]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, visible]);

  useEffect(() => {
    if (!visible) return;
    requestAnimationFrame(() => inputRef.current?.focus());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onClose]);

  if (!visible) return null;

  const trimmed = query.trim();

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1150,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '72px 16px 24px 16px',
        backgroundColor: theme.scrim,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search notes"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 580,
          backgroundColor: theme.surfaceRaised,
          border: `1px solid ${ink.border}`,
          borderRadius: Radius.modal,
          boxShadow: `0 20px 48px ${theme.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: '75vh',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderBottom: `1px solid ${ink.border}`,
          }}
        >
          <Search size={18} color={theme.accent} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((idx) => (results.length === 0 ? 0 : (idx + 1) % results.length));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((idx) =>
                  results.length === 0 ? 0 : (idx - 1 + results.length) % results.length
                );
              } else if (e.key === 'Enter' && results[activeIndex]) {
                e.preventDefault();
                onSelectResult(results[activeIndex]);
              }
            }}
            placeholder="Search notes by title or content…"
            aria-label="Search notes by title or content"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              backgroundColor: 'transparent',
              color: ink.text,
              outline: 'none',
              ...Typography.app.body,
              fontSize: 15,
            }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Clear search query"
              style={{
                width: 28,
                height: 28,
                borderRadius: Radius.full,
                border: 'none',
                backgroundColor: 'transparent',
                color: ink.textMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '3px 8px',
              borderRadius: Radius.sm,
              border: `1px solid ${ink.border}`,
              backgroundColor: ink.pillBg,
              color: ink.textMuted,
              cursor: 'pointer',
              ...Typography.app.caption,
            }}
          >
            Esc
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {!trimmed && results.length > 0 ? (
            <div
              style={{
                ...Typography.app.captionStrong,
                color: ink.textMuted,
                padding: '4px 10px',
                textTransform: 'uppercase',
              }}
            >
              Recent notes
            </div>
          ) : null}

          {results.length === 0 ? (
            <div
              style={{
                ...Typography.app.body,
                color: ink.textMuted,
                textAlign: 'center',
                padding: '28px 16px',
              }}
            >
              {trimmed
                ? `No notes or folders matching “${trimmed}”.`
                : 'No notes in your workspace yet.'}
            </div>
          ) : (
            results.map((result, idx) => {
              const selected = idx === activeIndex;
              return (
                <button
                  key={result.key}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => onSelectResult(result)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: Radius.md,
                    border: 'none',
                    backgroundColor: selected ? ink.pillBg : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <span style={{ marginTop: 2, flexShrink: 0 }}>
                    {result.kind === 'note' ? (
                      <FileText size={16} color={selected ? theme.accent : ink.textMuted} />
                    ) : (
                      <FolderIcon size={16} color={selected ? theme.accent : ink.textMuted} />
                    )}
                  </span>

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span
                        style={{
                          ...Typography.app.bodyStrong,
                          color: ink.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <HighlightedText text={result.label} query={trimmed} accentColor={theme.accent} />
                      </span>
                      <span
                        style={{
                          ...Typography.app.caption,
                          color: ink.textMuted,
                          flexShrink: 0,
                        }}
                      >
                        {result.sublabel}
                        {result.updatedLabel ? ` · ${result.updatedLabel}` : ''}
                      </span>
                    </div>

                    {result.snippet ? (
                      <div
                        style={{
                          ...Typography.app.caption,
                          color: ink.textMuted,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <HighlightedText text={result.snippet} query={trimmed} accentColor={theme.accent} />
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            borderTop: `1px solid ${ink.border}`,
            ...Typography.app.caption,
            color: ink.textMuted,
          }}
        >
          <span>↑↓ Navigate · Enter Open · Esc Close</span>
          <span>
            {trimmed
              ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}`
              : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} indexed`}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
