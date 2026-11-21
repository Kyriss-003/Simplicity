import { useRef, useState } from 'react';
import { ChevronLeft, ChevronsLeft, ChevronsRight, Menu, MoreVertical, RefreshCw, Search } from 'lucide-react';
import { Layout, Radius, Typography, surfaceTheme, type Theme } from '../theme';
import { ContextMenu, type ContextMenuAction } from './shared/ContextMenu';

export function TopHeader({
  theme,
  isMobile,
  userName,
  greetingText,
  showGreeting,
  showSidebarToggle,
  onBack,
  onToggleSidebar,
  onOpenSearch,
  onRefresh,
  onToggleList,
  isListCollapsed,
  menuActions,
  onUpdateUserName,
}: {
  theme: Theme;
  isMobile: boolean;
  userName: string;
  greetingText: string;
  showGreeting: boolean;
  showSidebarToggle: boolean;
  onBack?: () => void;
  onToggleSidebar: () => void;
  onOpenSearch?: () => void;
  onRefresh?: () => Promise<void> | void;
  onToggleList?: () => void;
  isListCollapsed?: boolean;
  menuActions?: ContextMenuAction[];
  onUpdateUserName?: (name: string) => void;
}) {
  const ink = surfaceTheme(theme);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuAnchor({ x: rect.left + rect.width / 2, y: rect.bottom });
  };

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        onRefresh(),
        new Promise<void>((resolve) => setTimeout(resolve, 450)),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const trimmedName = userName.trim();
  const fullGreeting = trimmedName ? `${greetingText}, ${trimmedName}` : greetingText;
  const greetingType = isMobile ? Typography.app.cardHeader : Typography.app.pageHeader;

  const startEditingName = () => {
    if (!onUpdateUserName) return;
    setNameDraft(trimmedName);
    setEditingName(true);
  };

  const commitNameEdit = () => {
    setEditingName(false);
    onUpdateUserName?.(nameDraft.trim());
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        minHeight: Layout.headerHeight,
        backgroundColor: theme.background,
        gap: 12,
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={{
              width: 44,
              height: 44,
              borderRadius: Radius.md,
              border: 'none',
              backgroundColor: 'transparent',
              color: ink.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={20} />
          </button>
        ) : showSidebarToggle ? (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
            style={{
              width: 44,
              height: 44,
              borderRadius: Radius.md,
              border: 'none',
              backgroundColor: 'transparent',
              color: ink.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Menu size={20} />
          </button>
        ) : null}

        {showGreeting ? (
          <div style={{ flex: 1, minWidth: 0, padding: '4px 0' }}>
            {editingName ? (
              <div
                style={{
                  ...greetingType,
                  color: theme.text,
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                <span>{greetingText},</span>
                <input
                  type="text"
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitNameEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitNameEdit();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setEditingName(false);
                    }
                  }}
                  placeholder="your name"
                  aria-label="Your name for greeting"
                  style={{
                    ...greetingType,
                    color: theme.text,
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: `1.5px solid ${theme.accent}`,
                    outline: 'none',
                    padding: '0 2px',
                    minWidth: 110,
                    maxWidth: 260,
                    width: `${Math.max(9, nameDraft.length + 1)}ch`,
                  }}
                />
              </div>
            ) : (
              <div
                onClick={onUpdateUserName ? startEditingName : undefined}
                onKeyDown={
                  onUpdateUserName
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          startEditingName();
                        }
                      }
                    : undefined
                }
                role={onUpdateUserName ? 'button' : undefined}
                tabIndex={onUpdateUserName ? 0 : undefined}
                title={
                  onUpdateUserName
                    ? trimmedName
                      ? 'Click to update your name'
                      : 'Click to personalize with your name'
                    : undefined
                }
                style={{
                  ...greetingType,
                  color: theme.text,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  cursor: onUpdateUserName ? 'pointer' : 'default',
                }}
              >
                {fullGreeting}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {showGreeting ? null : (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            maxWidth: '60%',
            pointerEvents: 'none',
          }}
        >
          <span style={{ ...Typography.app.wordmark, color: theme.text, textAlign: 'center' }}>
            SIMPLICITY
          </span>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
          ...(showGreeting ? { flexShrink: 0 } : { flex: 1 }),
        }}
      >
        {onOpenSearch ? (
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search notes"
            title="Search notes (Ctrl/⌘ + K)"
            style={{
              width: 44,
              height: 44,
              borderRadius: Radius.md,
              border: 'none',
              backgroundColor: 'transparent',
              color: ink.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Search size={20} />
          </button>
        ) : null}

        {onRefresh ? (
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            aria-label={isRefreshing ? 'Refreshing overview' : 'Refresh overview'}
            title="Refresh overview"
            style={{
              width: 44,
              height: 44,
              borderRadius: Radius.md,
              border: 'none',
              backgroundColor: 'transparent',
              color: ink.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isRefreshing ? 'default' : 'pointer',
            }}
          >
            <RefreshCw size={20} className={isRefreshing ? 'spin-slow' : undefined} />
          </button>
        ) : null}

        {onToggleList ? (
          <button
            type="button"
            onClick={onToggleList}
            aria-label={isListCollapsed ? 'Show note list' : 'Hide note list'}
            style={{
              width: 44,
              height: 44,
              borderRadius: Radius.md,
              border: 'none',
              backgroundColor: 'transparent',
              color: ink.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {isListCollapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
          </button>
        ) : null}

        {menuActions && menuActions.length > 0 ? (
          <button
            ref={menuBtnRef}
            type="button"
            onClick={openMenu}
            aria-label="Page menu"
            style={{
              width: 44,
              height: 44,
              borderRadius: Radius.md,
              border: 'none',
              backgroundColor: 'transparent',
              color: ink.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <MoreVertical size={20} />
          </button>
        ) : null}
      </div>

      <ContextMenu
        anchor={menuAnchor}
        actions={menuActions ?? []}
        onDismiss={() => setMenuAnchor(null)}
        align="right"
        theme={theme}
      />
    </header>
  );
}
