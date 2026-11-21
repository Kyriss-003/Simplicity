import { useEffect, useRef, useState } from 'react';
import { FileText, Folder as FolderIcon, Search, X } from 'lucide-react';
import { Radius, Typography, type Theme } from '../../theme';
import {
  SIDEBAR_SEARCH_LIMIT,
  splitHighlightParts,
  type SearchResult,
} from './searchUtils';

export type { SearchResult };
export const SEARCH_RESULT_LIMIT = SIDEBAR_SEARCH_LIMIT;

function shortcutHint(): string {
  if (typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)) {
    return '⌘K';
  }
  return 'Ctrl K';
}

export function SidebarSearch({
  theme,
  query,
  onQueryChange,
  results,
  onSelectResult,
  onClose,
}: {
  theme: Theme;
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isSearching = query.trim().length > 0;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  return (
    <div style={{ padding: '8px 8px 0 8px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 36,
          padding: '0 8px',
          borderRadius: Radius.md,
          backgroundColor: theme.background,
          border: `1px solid ${theme.border}`,
        }}
      >
        <Search size={15} color={theme.textMuted} style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onClose();
            } else if (e.key === 'ArrowDown' && results.length > 0) {
              e.preventDefault();
              setActiveIndex((idx) => (idx + 1) % results.length);
            } else if (e.key === 'ArrowUp' && results.length > 0) {
              e.preventDefault();
              setActiveIndex((idx) => (idx - 1 + results.length) % results.length);
            } else if (e.key === 'Enter' && results[activeIndex]) {
              e.preventDefault();
              onSelectResult(results[activeIndex]);
            }
          }}
          placeholder="Search notes…"
          aria-label="Search notes and folders"
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            backgroundColor: 'transparent',
            color: theme.text,
            outline: 'none',
            ...Typography.app.caption,
          }}
        />
        {isSearching ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Clear search"
            style={{
              width: 20,
              height: 20,
              borderRadius: Radius.full,
              border: 'none',
              backgroundColor: 'transparent',
              color: theme.textMuted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <X size={14} />
          </button>
        ) : (
          <span
            style={{
              padding: '1px 5px',
              borderRadius: Radius.sm,
              border: `1px solid ${theme.border}`,
              color: theme.textMuted,
              ...Typography.app.caption,
              flexShrink: 0,
            }}
          >
            {shortcutHint()}
          </span>
        )}
      </div>

      {isSearching ? (
        <div
          style={{
            marginTop: 8,
            maxHeight: 56 * SEARCH_RESULT_LIMIT,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {results.length === 0 ? (
            <div style={{ ...Typography.app.caption, color: theme.textMuted, padding: '12px 8px' }}>
              No matches for “{query.trim()}”
            </div>
          ) : (
            results.map((result, idx) => {
              const highlighted = idx === activeIndex;
              const titleParts = splitHighlightParts(result.label, query);
              return (
                <button
                  key={result.key}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => onSelectResult(result)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 50,
                    padding: '6px 8px',
                    borderRadius: Radius.md,
                    border: 'none',
                    backgroundColor: highlighted ? theme.pillBg : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  {result.kind === 'note' ? (
                    <FileText
                      size={16}
                      color={highlighted ? theme.accent : theme.textMuted}
                      style={{ flexShrink: 0 }}
                    />
                  ) : (
                    <FolderIcon
                      size={16}
                      color={highlighted ? theme.accent : theme.textMuted}
                      style={{ flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        ...Typography.app.body,
                        color: theme.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {titleParts.map((part, pIdx) => (
                        <span
                          key={pIdx}
                          style={part.matched ? { color: theme.accent, fontWeight: 600 } : undefined}
                        >
                          {part.text}
                        </span>
                      ))}
                    </div>
                    <div
                      style={{
                        ...Typography.app.caption,
                        color: theme.textMuted,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {result.snippet ? `${result.sublabel} · ${result.snippet}` : result.sublabel}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
