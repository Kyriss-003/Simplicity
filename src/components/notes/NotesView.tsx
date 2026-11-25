import { useState } from 'react';
import { Download, FileEdit, LayoutTemplate, MoreVertical, Pin, Upload } from 'lucide-react';
import {
  downloadTextFile,
  noteToMarkdown,
  notesToJson,
  slugifyFilename,
} from '../../db/portability';
import { Layout, Radius, Typography, type Theme } from '../../theme';
import { LIST_WIDTH_MAX, LIST_WIDTH_MIN, type Note, type NoteTemplate, type NotesLayout } from '../../types';
import type { AutoSaveStatus } from '../../hooks/useNoteAutoSave';
import { relativeTime } from '../../utils';
import { ContextMenu, type ContextMenuAction } from '../shared/ContextMenu';
import { Editor } from './Editor';
import { NoteTabs, type NoteTab } from './NoteTabs';

const RAIL_WIDTH = 48;

export function NotesView({
  theme,
  notes,
  selected,
  tabs,
  folderLabel,
  listWidth,
  onResizeList,
  onResizeListCommit,
  isMobile,
  isEditorOpen,
  isListCollapsed,
  onSelect,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onStepTab,
  onOpenEditor,
  onContentChange,
  onDelete,
  saveStatus,
  onSaveNow,
  onMoveNote,
  onDuplicateNote,
  onDeleteNote,
  onRenameNote,
  onTogglePinNote,
  onOpenPortability,
  onToggleSidebar,
  templates,
  onOpenTemplates,
  onCreateNoteFromTemplate,
  insertRequest,
  notesLayout,
}: {
  theme: Theme;
  notes: Note[];
  selected: Note | null;
  tabs: NoteTab[];
  folderLabel: string;
  listWidth: number;
  onResizeList: (width: number) => void;
  onResizeListCommit: (width: number) => void;
  isMobile: boolean;
  isEditorOpen: boolean;
  isListCollapsed: boolean;
  onSelect: (n: Note) => void;
  onSelectTab: (id: number) => void;
  onCloseTab: (id: number) => void;
  onNewTab: () => void;
  onStepTab: (direction: -1 | 1) => void;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
  onContentChange: (text: string) => void;
  onDelete: () => void;
  saveStatus?: AutoSaveStatus;
  onSaveNow?: () => void;
  onMoveNote?: (noteId: number) => void;
  onDuplicateNote?: (noteId: number) => void;
  onDeleteNote?: (noteId: number) => void;
  onRenameNote?: (noteId: number, title: string) => void;
  onTogglePinNote?: (noteId: number) => void;
  onOpenPortability?: (tab: 'export' | 'import') => void;
  onToggleSidebar?: () => void;
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
  notesLayout: NotesLayout;
}) {
  const display = selected;
  const [resizing, setResizing] = useState(false);
  const [handleHovered, setHandleHovered] = useState(false);

  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuNoteId, setMenuNoteId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const activeIndex = tabs.findIndex((t) => t.id === display?.id);
  const canStepBack = activeIndex > 0;
  const canStepForward = activeIndex > -1 && activeIndex < tabs.length - 1;

  const dismissMenu = () => {
    setMenuAnchor(null);
    setMenuNoteId(null);
  };

  const commitRename = (id: number) => {
    const trimmed = draftTitle.trim();
    if (trimmed) onRenameNote?.(id, trimmed);
    setRenamingId(null);
  };

  const noteMenuActions: ContextMenuAction[] =
    menuNoteId === null
      ? []
      : (() => {
          const target = notes.find((n) => n.id === menuNoteId);
          const isPinned = Boolean(target?.isPinned);
          return [
            ...(onTogglePinNote
              ? [
                  {
                    label: isPinned ? 'Unpin note' : 'Pin note',
                    iconName: isPinned ? 'pin-off-outline' : 'pin-outline',
                    onPress: () => onTogglePinNote(menuNoteId),
                  },
                ]
              : []),
            {
              label: 'Rename',
              iconName: 'pencil-outline',
              onPress: () => {
                if (target) {
                  setRenamingId(target.id);
                  setDraftTitle(target.title);
                }
              },
            },
            { label: 'Move to folder', iconName: 'folder-move-outline', onPress: () => onMoveNote?.(menuNoteId) },
            { label: 'Duplicate', iconName: 'content-duplicate', onPress: () => onDuplicateNote?.(menuNoteId) },
            ...(target
              ? [
                  {
                    label: 'Export Markdown (.md)',
                    iconName: 'download',
                    onPress: () => {
                      onSaveNow?.();
                      downloadTextFile(
                        `${slugifyFilename(target.title, 'note')}.md`,
                        noteToMarkdown(target, folderLabel),
                        'text/markdown;charset=utf-8'
                      );
                    },
                  },
                  {
                    label: 'Export JSON (.json)',
                    iconName: 'file-code',
                    onPress: () => {
                      onSaveNow?.();
                      downloadTextFile(
                        `${slugifyFilename(target.title, 'note')}.json`,
                        notesToJson([target], []),
                        'application/json'
                      );
                    },
                  },
                ]
              : []),
            { label: 'Delete', iconName: 'trash-can-outline', onPress: () => onDeleteNote?.(menuNoteId), destructive: true },
          ];
        })();

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const initial = listWidth;
    let current = listWidth;
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      current = Math.min(LIST_WIDTH_MAX, Math.max(LIST_WIDTH_MIN, initial + (ev.clientX - startX)));
      onResizeList(current);
    };

    const onUp = () => {
      setResizing(false);
      onResizeListCommit(current);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const showListPane = !isMobile || !isEditorOpen;
  const showEditorPane = !isMobile || isEditorOpen;

  const isRight = !isMobile && notesLayout === 'right';
  const isRibbon = !isMobile && notesLayout === 'ribbon';

  const listPaneContent = showListPane ? (
    <div
      style={{
        position: 'relative',
        width: isMobile ? '100%' : isListCollapsed ? RAIL_WIDTH : listWidth,
        borderRight: isMobile || isRight ? 'none' : `1px solid ${theme.border}`,
        borderLeft: !isMobile && isRight ? `1px solid ${theme.border}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flexShrink: 0,
        transition: resizing ? 'none' : 'width 180ms ease',
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          opacity: !isMobile && isListCollapsed ? 0 : 1,
          pointerEvents: !isMobile && isListCollapsed ? 'none' : 'auto',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: Layout.headerHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '0 12px 0 16px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              ...Typography.app.cardHeader,
              color: theme.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {folderLabel}
          </span>

          {onOpenPortability ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => onOpenPortability('import')}
                aria-label="Import notes"
                title="Import JSON or Markdown notes"
                style={{
                  width: 30,
                  height: 30,
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
                <Upload size={15} />
              </button>
              <button
                type="button"
                onClick={() => onOpenPortability('export')}
                aria-label="Export notes"
                title="Export notes as JSON or Markdown"
                style={{
                  width: 30,
                  height: 30,
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
                <Download size={15} />
              </button>
            </div>
          ) : null}
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {notes.length === 0 ? (
            <div style={{ ...Typography.app.body, color: theme.textMuted, textAlign: 'center', marginTop: 24 }}>
              No notes yet.
            </div>
          ) : (
            notes.map((n) => {
              const active = display?.id === n.id;
              const isRenaming = renamingId === n.id;
              return (
                <div
                  key={n.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: Radius.lg,
                    border: `1px solid ${theme.border}`,
                    backgroundColor: active ? theme.pillBg : 'transparent',
                  }}
                >
                  {isRenaming ? (
                    <div style={{ flex: 1, minWidth: 0, padding: 10 }}>
                      <input
                        type="text"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(n.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onBlur={() => commitRename(n.id)}
                        autoFocus
                        aria-label="Note title"
                        style={{
                          ...Typography.app.bodyStrong,
                          color: theme.text,
                          border: `1px solid ${theme.accent}`,
                          borderRadius: Radius.sm,
                          backgroundColor: theme.background,
                          padding: '2px 6px',
                          width: '100%',
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(n);
                        onOpenEditor();
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMenuAnchor({ x: e.pageX, y: e.pageY });
                        setMenuNoteId(n.id);
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: 12,
                        border: 'none',
                        backgroundColor: 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        {n.isPinned ? (
                          <Pin
                            size={12}
                            color={theme.accent}
                            aria-label="Pinned"
                            style={{ flexShrink: 0 }}
                          />
                        ) : null}
                        <span
                          style={{
                            ...Typography.app.bodyStrong,
                            color: theme.text,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {n.title}
                        </span>
                      </div>
                      <span style={{ ...Typography.app.caption, color: theme.textMuted }}>
                        {relativeTime(n.updatedAt)}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      setMenuAnchor({ x: e.clientX, y: e.clientY });
                      setMenuNoteId(n.id);
                    }}
                    aria-label={`Options for ${n.title}`}
                    style={{
                      width: 32,
                      height: 32,
                      marginRight: 6,
                      borderRadius: Radius.md,
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: theme.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {!isMobile ? (
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Resize note list"
          aria-valuenow={Math.round(listWidth)}
          aria-valuemin={LIST_WIDTH_MIN}
          aria-valuemax={LIST_WIDTH_MAX}
          onPointerDown={handleResizePointerDown}
          onMouseEnter={() => setHandleHovered(true)}
          onMouseLeave={() => setHandleHovered(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') onResizeListCommit(Math.max(LIST_WIDTH_MIN, listWidth - 16));
            if (e.key === 'ArrowRight') onResizeListCommit(Math.min(LIST_WIDTH_MAX, listWidth + 16));
          }}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            [isRight ? 'left' : 'right']: -7,
            width: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'col-resize',
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: 2,
              height: '100%',
              borderRadius: Radius.full,
              backgroundColor: resizing || handleHovered ? theme.accent : 'transparent',
            }}
          />
        </div>
      ) : null}
    </div>
  ) : null;

  const ribbonContent = (
    <div
      style={{
        width: 56,
        borderRight: `1px solid ${theme.border}`,
        backgroundColor: theme.surface,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onNewTab}
        title="New note"
        style={{
          width: 40,
          height: 40,
          borderRadius: Radius.lg,
          backgroundColor: theme.accent,
          color: theme.accentText,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <FileEdit size={18} />
      </button>
      <div style={{ width: 32, height: 1, backgroundColor: theme.border, margin: '4px 0' }} />
      <div
        style={{
          flex: 1,
          width: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          padding: '0 4px',
        }}
      >
        {notes.map((n) => {
          const active = display?.id === n.id;
          return (
            <button
              key={n.id}
              type="button"
              title={n.title}
              onClick={() => {
                onSelect(n);
                onOpenEditor();
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: Radius.md,
                backgroundColor: active ? theme.pillBg : 'transparent',
                border: `1px solid ${active ? theme.accent : 'transparent'}`,
                color: active ? theme.text : theme.textMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                ...Typography.app.bodyStrong,
                fontSize: 14,
              }}
            >
              {n.isPinned ? <Pin size={14} color={theme.accent} /> : (n.title.slice(0, 1).toUpperCase() || 'N')}
            </button>
          );
        })}
      </div>
      {onOpenTemplates ? (
        <button
          type="button"
          onClick={() => onOpenTemplates({ initialView: 'browse' })}
          title="Templates"
          style={{
            width: 40,
            height: 40,
            borderRadius: Radius.md,
            backgroundColor: 'transparent',
            border: 'none',
            color: theme.textMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <LayoutTemplate size={18} />
        </button>
      ) : null}
    </div>
  );

  const editorContent = showEditorPane ? (
    <div style={{ flex: 1, minWidth: 0, backgroundColor: theme.background, display: 'flex', flexDirection: 'column' }}>
      {!display ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            gap: 12,
          }}
        >
          <FileEdit size={40} color={theme.textMuted} />
          <div style={{ ...Typography.app.body, color: theme.textMuted, textAlign: 'center' }}>
            Select a note or create a new one to start typing.
          </div>
          {onOpenTemplates ? (
            <button
              type="button"
              onClick={() => onOpenTemplates({ initialView: 'browse' })}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: Radius.button,
                border: `1px solid ${theme.border}`,
                backgroundColor: theme.surface,
                color: theme.text,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                cursor: 'pointer',
                ...Typography.app.captionStrong,
              }}
            >
              <LayoutTemplate size={14} color={theme.accent} />
              <span>New from template…</span>
            </button>
          ) : null}
        </div>
      ) : (
        <Editor
          note={display}
          theme={theme}
          onContentChange={onContentChange}
          onDelete={onDelete}
          onTogglePin={onTogglePinNote ? () => onTogglePinNote(display.id) : undefined}
          saveStatus={saveStatus}
          onSaveNow={onSaveNow}
          templates={templates}
          onOpenTemplates={onOpenTemplates}
          onCreateNoteFromTemplate={onCreateNoteFromTemplate}
          insertRequest={insertRequest}
        />
      )}
    </div>
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <NoteTabs
        theme={theme}
        tabs={tabs}
        activeId={display?.id ?? null}
        onSelect={onSelectTab}
        onClose={onCloseTab}
        onNewTab={onNewTab}
        onStepBack={canStepBack ? () => onStepTab(-1) : undefined}
        onStepForward={canStepForward ? () => onStepTab(1) : undefined}
        onToggleSidebar={onToggleSidebar}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', minWidth: 0, minHeight: 0 }}>
        {isRibbon ? (
          <>
            {ribbonContent}
            {editorContent}
          </>
        ) : isRight ? (
          <>
            {editorContent}
            {listPaneContent}
          </>
        ) : (
          <>
            {listPaneContent}
            {editorContent}
          </>
        )}
      </div>

      <ContextMenu
        anchor={menuAnchor}
        actions={noteMenuActions}
        onDismiss={dismissMenu}
        theme={theme}
      />
    </div>
  );
}
