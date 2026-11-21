import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Folder as FolderIcon, X } from 'lucide-react';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import type { Folder } from '../../types';
import { buildFolderTree, collectSubtreeIds, flattenTree } from '../../utils';

export function MoveToModal({
  visible,
  theme,
  title,
  folders,
  currentFolderId,
  excludeFolderId,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  theme: Theme;
  title: string;
  folders: Folder[];
  currentFolderId?: string | null;
  excludeFolderId?: string | null;
  onSelect: (folderId: string) => void;
  onCancel: () => void;
}) {
  const ink = surfaceTheme(theme);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onCancel]);

  const rows = useMemo(() => {
    const excluded = excludeFolderId ? new Set(collectSubtreeIds(folders, excludeFolderId)) : new Set<string>();
    const tree = buildFolderTree(folders);
    return flattenTree(tree).filter((row) => !excluded.has(row.node.id));
  }, [folders, excludeFolderId]);

  if (!visible) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: theme.scrim,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 400,
          backgroundColor: theme.surfaceRaised,
          border: `1px solid ${ink.border}`,
          borderRadius: Radius.modal,
          padding: 16,
          boxShadow: `0 16px 40px ${theme.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxHeight: '75vh',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ ...Typography.app.cardHeader, color: ink.text }}>{title}</div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            style={{
              width: 36,
              height: 36,
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

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map(({ node, depth }) => {
            const isCurrent = node.id === currentFolderId;
            return (
              <button
                key={node.id}
                type="button"
                disabled={isCurrent}
                onClick={() => onSelect(node.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 44,
                  paddingLeft: 12 + depth * 16,
                  paddingRight: 12,
                  borderRadius: Radius.md,
                  border: 'none',
                  backgroundColor: isCurrent ? ink.pillBg : 'transparent',
                  color: isCurrent ? ink.textMuted : ink.text,
                  cursor: isCurrent ? 'default' : 'pointer',
                  textAlign: 'left',
                  opacity: isCurrent ? 0.6 : 1,
                  ...Typography.app.body,
                }}
              >
                <FolderIcon size={16} color={isCurrent ? ink.textMuted : theme.accent} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {node.label}
                </span>
                {isCurrent ? (
                  <span style={{ ...Typography.app.caption, color: ink.textMuted }}>Current</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
