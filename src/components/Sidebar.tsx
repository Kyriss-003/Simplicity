import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  Circle,
  Contrast,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  LayoutDashboard,
  Moon,
  Settings,
  Sun,
} from 'lucide-react';
import { Layout, Radius, THEME_NAMES, Typography, type Theme, type ThemeName } from '../theme';
import {
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  type Folder,
  type ScreenKey,
} from '../types';
import { buildFolderTree, flattenTree } from '../utils';
import { ContextMenu, type ContextMenuAction } from './shared/ContextMenu';
import { SidebarSearch, type SearchResult } from './shared/SidebarSearch';

const NAV_ITEMS: { key: ScreenKey; label: string }[] = [
  { key: 'Overview', label: 'Overview' },
  { key: 'Notes', label: 'Notes' },
  { key: 'Agenda', label: 'Agenda' },
];

function renderNavIcon(key: ScreenKey, color: string) {
  switch (key) {
    case 'Overview':
      return <LayoutDashboard size={16} color={color} />;
    case 'Notes':
      return <FileText size={16} color={color} />;
    case 'Agenda':
      return <CalendarDays size={16} color={color} />;
    default:
      return null;
  }
}

function renderThemeIcon(themeName: ThemeName, color: string) {
  switch (themeName) {
    case 'Dark':
      return <Moon size={16} color={color} />;
    case 'OLED':
      return <Circle size={16} color={color} />;
    case 'Light':
      return <Sun size={16} color={color} />;
    case 'B&W':
      return <Contrast size={16} color={color} />;
  }
}

interface InlineEdit {
  kind: 'rename' | 'create';
  folderId: string;
}

export default function Sidebar({
  theme,
  activeNav,
  themeName,
  width,
  resizable,
  folders,
  onResize,
  onResizeCommit,
  selectedFolderId,
  noteCounts,
  onToggle,
  onSelectNav,
  onSelectTheme,
  onSelectFolder,
  onCreateNote,
  onCreateFolder,
  onRenameFolder,
  onMoveFolder,
  onDuplicateFolder,
  onDeleteFolder,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSelectSearchResult,
  onCloseSearch,
}: {
  theme: Theme;
  activeNav: ScreenKey;
  themeName: ThemeName;
  width: number;
  resizable: boolean;
  folders: Folder[];
  onResize: (width: number) => void;
  onResizeCommit: (width: number) => void;
  selectedFolderId: string | null;
  noteCounts: Record<string, number>;
  onToggle: () => void;
  onSelectNav: (key: ScreenKey) => void;
  onSelectTheme: (name: ThemeName) => void;
  onSelectFolder: (folderId: string) => void;
  onCreateNote: (folderId: string) => void;
  onCreateFolder: (parentId: string, label: string) => void;
  onRenameFolder: (folderId: string, label: string) => void;
  onMoveFolder: (folderId: string) => void;
  onDuplicateFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: SearchResult[];
  onSelectSearchResult: (result: SearchResult) => void;
  onCloseSearch: () => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null);
  const [inline, setInline] = useState<InlineEdit | null>(null);
  const [inlineValue, setInlineValue] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);

  const tree = buildFolderTree(folders);
  const rows = flattenTree(tree);
  const menuFolder = folders.find((f) => f.id === menuFolderId) ?? null;
  const isSearching = searchQuery.trim().length > 0;

  const cycleTheme = () => {
    const next = THEME_NAMES[(THEME_NAMES.indexOf(themeName) + 1) % THEME_NAMES.length];
    if (next) onSelectTheme(next);
  };

  const startInline = (kind: 'rename' | 'create', folderId: string, initial = '') => {
    setInline({ kind, folderId });
    setInlineValue(initial);
  };

  const submitInline = () => {
    if (!inline) return;
    const label = inlineValue.trim();
    if (label) {
      if (inline.kind === 'rename') onRenameFolder(inline.folderId, label);
      else onCreateFolder(inline.folderId, label);
    }
    setInline(null);
    setInlineValue('');
  };

  const alwaysActions: ContextMenuAction[] = !menuFolder
    ? []
    : [
        { label: 'New Note', iconName: 'note-plus-outline', onPress: () => onCreateNote(menuFolder.id) },
        {
          label: 'New Sub-folder',
          iconName: 'folder-plus-outline',
          onPress: () => startInline('create', menuFolder.id),
        },
      ];

  const rootGuardActions: ContextMenuAction[] =
    menuFolder && menuFolder.parentId !== null
      ? [
          {
            label: 'Rename',
            iconName: 'pencil-outline',
            onPress: () => startInline('rename', menuFolder.id, menuFolder.label),
          },
          { label: 'Move to…', iconName: 'file-move-outline', onPress: () => onMoveFolder(menuFolder.id) },
          { label: 'Duplicate', iconName: 'content-copy', onPress: () => onDuplicateFolder(menuFolder.id) },
          {
            label: 'Delete Folder',
            iconName: 'trash-can-outline',
            destructive: true,
            onPress: () => onDeleteFolder(menuFolder.id),
          },
        ]
      : [];

  const menuActions: ContextMenuAction[] = [...alwaysActions, ...rootGuardActions];

  const subfolderCount = (folderId: string) =>
    folders.filter((f) => f.parentId === folderId).length;

  const rowBackground = (key: string, active: boolean) => {
    if (active) return theme.pillBg;
    if (hovered === key) return theme.hoverBg;
    return 'transparent';
  };

  const handlePointerDownResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const initialWidth = width;
    let currentWidth = width;
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      currentWidth = Math.min(
        SIDEBAR_WIDTH_MAX,
        Math.max(SIDEBAR_WIDTH_MIN, initialWidth + (ev.clientX - startX))
      );
      onResize(currentWidth);
    };

    const onUp = () => {
      setResizing(false);
      onResizeCommit(currentWidth);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <aside
      style={{
        width,
        height: '100%',
        backgroundColor: theme.sidebarBg,
        borderRight: `1px solid ${theme.border}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          height: Layout.headerHeight,
          flexShrink: 0,
        }}
      >
        <span style={{ ...Typography.app.cardHeader, color: theme.text }}>Simplicity</span>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Toggle sidebar"
          onMouseEnter={() => setHovered('toggle')}
          onMouseLeave={() => setHovered((k) => (k === 'toggle' ? null : k))}
          style={{
            width: 40,
            height: 40,
            borderRadius: Radius.md,
            border: 'none',
            backgroundColor: hovered === 'toggle' ? theme.pillBg : 'transparent',
            color: theme.textMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      <SidebarSearch
        theme={theme}
        query={searchQuery}
        onQueryChange={onSearchQueryChange}
        results={searchResults}
        onSelectResult={onSelectSearchResult}
        onClose={onCloseSearch}
      />

      {isSearching ? (
        <div style={{ flex: 1 }} />
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
          <div style={{ padding: '16px 8px 0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                ...Typography.app.captionStrong,
                color: theme.textMuted,
                padding: '0 8px 4px 8px',
                textTransform: 'uppercase',
              }}
            >
              Workspace
            </div>
            {NAV_ITEMS.map((item) => {
              const active = activeNav === item.key;
              const key = `nav:${item.key}`;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectNav(item.key)}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered((k) => (k === key ? null : k))}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    height: 48,
                    padding: '0 12px',
                    borderRadius: Radius.md,
                    border: 'none',
                    backgroundColor: rowBackground(key, active),
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  {active ? (
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 12,
                        bottom: 12,
                        width: 3,
                        borderRadius: Radius.full,
                        backgroundColor: theme.accent,
                      }}
                    />
                  ) : null}
                  {renderNavIcon(item.key, active ? theme.accent : theme.textMuted)}
                  <span
                    style={{
                      ...(active ? Typography.app.bodyStrong : Typography.app.body),
                      color: active ? theme.text : theme.textMuted,
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ padding: '16px 8px 0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                ...Typography.app.captionStrong,
                color: theme.textMuted,
                padding: '0 8px 4px 8px',
                textTransform: 'uppercase',
              }}
            >
              Folders
            </div>
            {rows.map(({ node, depth }) => {
              const selected = selectedFolderId === node.id;
              const renaming = inline?.kind === 'rename' && inline.folderId === node.id;
              const creatingChild = inline?.kind === 'create' && inline.folderId === node.id;
              const key = `folder:${node.id}`;
              return (
                <div key={node.id}>
                  <button
                    type="button"
                    onClick={() => onSelectFolder(node.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenuFolderId(node.id);
                      setMenuAnchor({ x: e.pageX, y: e.pageY });
                    }}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered((k) => (k === key ? null : k))}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      height: 48,
                      paddingLeft: 12 + depth * 16,
                      paddingRight: 12,
                      borderRadius: Radius.md,
                      border: 'none',
                      backgroundColor: rowBackground(key, selected),
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    {selected ? (
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 12,
                          bottom: 12,
                          width: 3,
                          borderRadius: Radius.full,
                          backgroundColor: theme.accent,
                        }}
                      />
                    ) : null}
                    <FolderIcon
                      size={16}
                      color={selected ? theme.accent : theme.textMuted}
                      style={{ flexShrink: 0 }}
                    />
                    {renaming ? (
                      <input
                        type="text"
                        value={inlineValue}
                        onChange={(e) => setInlineValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitInline();
                          if (e.key === 'Escape') setInline(null);
                        }}
                        onBlur={submitInline}
                        autoFocus
                        placeholder="Folder name"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: 32,
                          border: `1px solid ${theme.accent}`,
                          borderRadius: Radius.input,
                          backgroundColor: theme.background,
                          color: theme.text,
                          padding: '0 8px',
                          ...Typography.app.body,
                        }}
                      />
                    ) : (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                        <span
                          style={{
                            flex: 1,
                            color: selected ? theme.text : theme.textMuted,
                            ...(selected ? Typography.app.bodyStrong : Typography.app.body),
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {node.label}
                        </span>
                        <span style={{ ...Typography.app.caption, color: theme.textMuted, marginLeft: 4 }}>
                          {subfolderCount(node.id)}+{noteCounts[node.id] ?? 0}
                        </span>
                      </div>
                    )}
                  </button>

                  {creatingChild ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        height: 48,
                        paddingLeft: 12 + (depth + 1) * 16,
                        paddingRight: 8,
                      }}
                    >
                      <FolderPlus size={16} color={theme.accent} style={{ flexShrink: 0 }} />
                      <input
                        type="text"
                        value={inlineValue}
                        onChange={(e) => setInlineValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitInline();
                          if (e.key === 'Escape') setInline(null);
                        }}
                        onBlur={submitInline}
                        autoFocus
                        placeholder="New folder name"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: 32,
                          border: `1px solid ${theme.accent}`,
                          borderRadius: Radius.input,
                          backgroundColor: theme.background,
                          color: theme.text,
                          padding: '0 8px',
                          ...Typography.app.body,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 64,
          padding: '0 8px',
          borderTop: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => onSelectNav('Settings')}
          aria-label="Settings"
          style={{
            width: 40,
            height: 40,
            borderRadius: Radius.md,
            border: 'none',
            backgroundColor: activeNav === 'Settings' ? theme.pillBg : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Settings size={16} color={activeNav === 'Settings' ? theme.accent : theme.textMuted} />
        </button>

        <button
          type="button"
          onClick={cycleTheme}
          aria-label={`Theme: ${themeName}. Click to change.`}
          title={`Theme: ${themeName}`}
          style={{
            width: 40,
            height: 40,
            borderRadius: Radius.md,
            border: 'none',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {renderThemeIcon(themeName, theme.textMuted)}
        </button>
      </div>

      {resizable ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label="Resize sidebar"
          aria-valuemin={SIDEBAR_WIDTH_MIN}
          aria-valuemax={SIDEBAR_WIDTH_MAX}
          aria-valuenow={Math.round(width)}
          onPointerDown={handlePointerDownResize}
          onMouseEnter={() => setHovered('resize')}
          onMouseLeave={() => setHovered((k) => (k === 'resize' ? null : k))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              onResizeCommit(Math.max(SIDEBAR_WIDTH_MIN, width - 16));
            } else if (e.key === 'ArrowRight') {
              onResizeCommit(Math.min(SIDEBAR_WIDTH_MAX, width + 16));
            }
          }}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: -7,
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
              backgroundColor: resizing || hovered === 'resize' ? theme.accent : 'transparent',
              transition: 'background-color 120ms ease',
            }}
          />
        </div>
      ) : null}

      <ContextMenu
        anchor={menuAnchor}
        actions={menuActions}
        onDismiss={() => setMenuAnchor(null)}
        theme={theme}
      />
    </aside>
  );
}
