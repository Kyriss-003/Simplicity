import { useMemo, useRef, useState } from 'react';
import { FilePlus2, FileText, Pin, Tag } from 'lucide-react';
import { Radius, Typography, primaryTheme, surfaceTheme, type Theme } from '../../theme';
import type { Folder, Note } from '../../types';
import { previewLines, relativeTime } from '../../utils';
import { Card } from '../shared/Card';
import { ContextMenu, type ContextMenuAction } from '../shared/ContextMenu';

export interface NoteCardActions {
  onRename: (id: number, title: string) => void;
  onMove: (id: number) => void;
  onDuplicate: (id: number) => void;
  onDelete: (id: number) => void;
  onCopyContent: (id: number) => void;
  onEditTags?: (id: number) => void;
  onTogglePin?: (id: number) => void;
}

export function NotesCardRow({
  notes,
  folders,
  theme,
  onOpenNote,
  actions,
  primary = false,
  expanded = false,
  selectedTag = null,
  onSelectTag,
}: {
  primary?: boolean;
  expanded?: boolean;
  notes: Note[];
  folders: Folder[];
  theme: Theme;
  onOpenNote: (n: Note) => void;
  actions: NoteCardActions;
  selectedTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const ink = primary ? primaryTheme(theme) : surfaceTheme(theme);

  const folderLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of folders) m.set(f.id, f.label);
    return m;
  }, [folders]);

  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuNoteId, setMenuNoteId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuNoteId(null);
  };

  const startRename = (note: Note) => {
    closeMenu();
    setRenamingId(note.id);
    setDraftTitle(note.title);
  };

  const commitRename = (id: number) => {
    const trimmed = draftTitle.trim();
    if (trimmed) actions.onRename(id, trimmed);
    setRenamingId(null);
  };

  const noteById = (id: number) => notes.find((n) => n.id === id) ?? null;

  const menuActions: ContextMenuAction[] =
    menuNoteId === null
      ? []
      : (() => {
          const target = noteById(menuNoteId);
          const isPinned = Boolean(target?.isPinned);
          return [
            ...(actions.onTogglePin
              ? [
                  {
                    label: isPinned ? 'Unpin note' : 'Pin note',
                    iconName: isPinned ? 'pin-off-outline' : 'pin-outline',
                    onPress: () => actions.onTogglePin?.(menuNoteId),
                  },
                ]
              : []),
            ...(actions.onEditTags
              ? [
                  {
                    label: 'Manage tags',
                    iconName: 'tag-outline',
                    onPress: () => actions.onEditTags?.(menuNoteId),
                  },
                ]
              : []),
            {
              label: 'Rename',
              iconName: 'pencil-outline',
              onPress: () => {
                if (target) startRename(target);
              },
            },
            { label: 'Move to folder', iconName: 'folder-move-outline', onPress: () => actions.onMove(menuNoteId) },
            { label: 'Duplicate', iconName: 'content-duplicate', onPress: () => actions.onDuplicate(menuNoteId) },
            { label: 'Copy content', iconName: 'content-copy', onPress: () => actions.onCopyContent(menuNoteId) },
            {
              label: 'Delete',
              iconName: 'trash-can-outline',
              destructive: true,
              onPress: () => actions.onDelete(menuNoteId),
            },
          ];
        })();

  if (notes.length === 0) {
    return (
      <Card theme={ink} style={{ padding: 16, minHeight: 150 }}>
        <div
          style={{
            border: `1px solid ${ink.border}`,
            backgroundColor: ink.pillBg,
            borderRadius: Radius.card,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 110,
            gap: 8,
          }}
        >
          <FilePlus2 size={22} color={ink.textMuted} />
          <div style={{ ...Typography.app.body, color: ink.textMuted, textAlign: 'center' }}>
            {selectedTag
              ? `No notes labeled “${selectedTag}”.`
              : 'No notes yet. Tap "+" to create one.'}
          </div>
          {selectedTag && onSelectTag ? (
            <button
              type="button"
              onClick={() => onSelectTag(null)}
              style={{
                height: 30,
                padding: '0 12px',
                borderRadius: Radius.full,
                border: `1px solid ${ink.border}`,
                backgroundColor: 'transparent',
                color: theme.accent,
                cursor: 'pointer',
                ...Typography.app.captionStrong,
              }}
            >
              Clear label filter
            </button>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div
        ref={scrollRef}
        onWheel={(e) => {
          const el = scrollRef.current;
          if (!el || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          if (el.scrollWidth > el.clientWidth) {
            el.scrollLeft += e.deltaY;
          }
        }}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 12,
          overflowX: 'auto',
          paddingTop: 6,
          paddingBottom: 10,
        }}
      >
        {notes.map((item) => {
          const folderLabel = folderLabels.get(item.folderId) ?? 'Unfiled';
          const previews = item.content?.trim() ? previewLines(item.content) : [];
          const isRenaming = renamingId === item.id;
          const isHovered = hoveredId === item.id;
          const visibleTags = (item.tags ?? []).slice(0, 2);
          const extraTags = Math.max(0, (item.tags?.length ?? 0) - 2);

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!isRenaming) onOpenNote(item);
              }}
              onKeyDown={(e) => {
                if (!isRenaming && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onOpenNote(item);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenuNoteId(item.id);
                setMenuAnchor({ x: e.pageX, y: e.pageY });
              }}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId((cur) => (cur === item.id ? null : cur))}
              style={{
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
              }}
            >
              <Card
                theme={ink}
                style={{
                  width: 208,
                  minHeight: expanded ? 184 : 156,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: `1px solid ${isHovered ? theme.accent : 'transparent'}`,
                  transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                  boxShadow: isHovered
                    ? `0 12px 24px ${theme.shadow}`
                    : `0 2px 12px ${theme.cardShadow}`,
                  transition:
                    'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms ease, border-color 180ms ease, background-color 150ms ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: Radius.sm,
                        backgroundColor: ink.pillBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={11} color={ink.textMuted} />
                    </span>
                    <span
                      style={{
                        ...Typography.app.captionStrong,
                        color: ink.textMuted,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {folderLabel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {item.isPinned ? (
                      <Pin
                        size={12}
                        color={theme.accent}
                        aria-label="Pinned note"
                        style={{ flexShrink: 0 }}
                      />
                    ) : null}
                    <span style={{ ...Typography.app.caption, color: ink.textMuted, flexShrink: 0 }}>
                      {relativeTime(item.updatedAt)}
                    </span>
                  </div>
                </div>

                {isRenaming ? (
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(item.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onBlur={() => commitRename(item.id)}
                    autoFocus
                    aria-label="Note title"
                    style={{
                      ...Typography.app.cardHeader,
                      color: ink.text,
                      backgroundColor: 'transparent',
                      border: `1px solid ${theme.accent}`,
                      borderRadius: Radius.sm,
                      padding: '2px 4px',
                      marginBottom: 4,
                      width: '100%',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      ...Typography.app.cardHeader,
                      color: ink.text,
                      marginBottom: 4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {item.title}
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  {previews.length > 0 ? (
                    previews.map((p, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, margin: '2px 0', alignItems: 'flex-start' }}>
                        <span style={{ ...Typography.app.caption, color: ink.textMuted }}>•</span>
                        <span
                          style={{
                            ...Typography.app.caption,
                            color: ink.textMuted,
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span style={{ ...Typography.app.caption, color: ink.textMuted }}>Empty note</span>
                  )}
                </div>

                {visibleTags.length > 0 || actions.onEditTags ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 4,
                      marginTop: 10,
                      paddingTop: 8,
                      borderTop: `1px solid ${ink.border}`,
                    }}
                  >
                    {visibleTags.map((tag) => {
                      const activeTag = selectedTag?.toLowerCase() === tag.toLowerCase();
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTag?.(activeTag ? null : tag);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            height: 22,
                            padding: '0 7px',
                            borderRadius: Radius.sm,
                            border: `1px solid ${activeTag ? theme.accent : ink.border}`,
                            backgroundColor: activeTag ? theme.accent : ink.pillBg,
                            color: activeTag ? theme.accentText : ink.textMuted,
                            cursor: 'pointer',
                            maxWidth: 110,
                            ...Typography.app.caption,
                          }}
                        >
                          <Tag size={10} style={{ flexShrink: 0 }} />
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tag}
                          </span>
                        </button>
                      );
                    })}
                    {extraTags > 0 ? (
                      <span style={{ ...Typography.app.caption, color: ink.textMuted }}>
                        +{extraTags}
                      </span>
                    ) : null}
                    {visibleTags.length === 0 && actions.onEditTags ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          actions.onEditTags?.(item.id);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          height: 22,
                          padding: '0 7px',
                          borderRadius: Radius.sm,
                          border: `1px dashed ${ink.border}`,
                          backgroundColor: 'transparent',
                          color: ink.textMuted,
                          cursor: 'pointer',
                          ...Typography.app.caption,
                        }}
                      >
                        <Tag size={10} />
                        <span>Add tag</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            </div>
          );
        })}
      </div>

      <ContextMenu
        anchor={menuAnchor}
        actions={menuActions}
        onDismiss={closeMenu}
        theme={theme}
      />
    </div>
  );
}
