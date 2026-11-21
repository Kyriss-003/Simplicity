import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Folder as FolderIcon } from 'lucide-react';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import type { Folder, FolderNode } from '../../types';
import { flattenTree } from '../../utils';

export function SaveScratchDialog({
  theme,
  visible,
  folders,
  tree,
  defaultFolderId,
  preview,
  onConfirm,
  onDismiss,
}: {
  theme: Theme;
  visible: boolean;
  folders: Folder[];
  tree: FolderNode[];
  defaultFolderId: string | null;
  preview: string;
  onConfirm: (folderId: string) => void;
  onDismiss: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = useMemo(() => flattenTree(tree), [tree]);

  useEffect(() => {
    if (!visible) return;
    setSelectedId(defaultFolderId ?? tree[0]?.id ?? null);
  }, [visible, defaultFolderId, tree]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onDismiss]);

  if (!visible) return null;

  const selectedLabel = folders.find((f) => f.id === selectedId)?.label ?? 'this folder';
  const ink = surfaceTheme(theme);

  return createPortal(
    <div
      onClick={onDismiss}
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
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save as a note"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: theme.surface,
          border: `1px solid ${ink.border}`,
          borderRadius: Radius.modal,
          padding: 16,
          boxShadow: `0 16px 40px ${theme.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ ...Typography.app.cardHeader, color: ink.text }}>Save as a note</div>
        <div
          style={{
            ...Typography.app.caption,
            color: ink.textMuted,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {preview}
        </div>

        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map(({ node, depth }) => {
            const selected = selectedId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedId(node.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  height: 48,
                  paddingLeft: 12 + depth * 16,
                  paddingRight: 12,
                  borderRadius: Radius.md,
                  border: 'none',
                  backgroundColor: selected ? theme.pillBg : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <FolderIcon size={16} color={selected ? theme.accent : ink.textMuted} />
                <span
                  style={{
                    ...(selected ? Typography.app.bodyStrong : Typography.app.body),
                    color: selected ? ink.text : ink.textMuted,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {node.label}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              flex: 1,
              height: 48,
              borderRadius: Radius.lg,
              border: `1px solid ${ink.border}`,
              backgroundColor: 'transparent',
              color: ink.textMuted,
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedId}
            onClick={() => selectedId && onConfirm(selectedId)}
            style={{
              flex: 1,
              height: 48,
              borderRadius: Radius.lg,
              border: 'none',
              backgroundColor: theme.accent,
              color: theme.accentText,
              opacity: selectedId ? 1 : 0.4,
              cursor: selectedId ? 'pointer' : 'default',
              ...Typography.app.bodyStrong,
            }}
          >
            {`Save to ${selectedLabel}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
