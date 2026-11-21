import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import {
  Calendar,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
  FilePlus2,
  FolderInput,
  FolderPlus,
  LayoutGrid,
  LayoutTemplate,
  Pencil,
  Pin,
  PinOff,
  Save,
  Tag,
  Trash2,
  Upload,
  SlidersHorizontal,
} from 'lucide-react';

export interface ContextMenuAction {
  label: string;
  iconName?: string;
  destructive?: boolean;
  onPress: () => void;
}

export function renderActionIcon(iconName: string | undefined, color: string, size = 16) {
  switch (iconName) {
    case 'pencil-outline':
      return <Pencil size={size} color={color} />;
    case 'pin-outline':
      return <Pin size={size} color={color} />;
    case 'pin-off-outline':
      return <PinOff size={size} color={color} />;
    case 'download':
      return <Download size={size} color={color} />;
    case 'upload':
      return <Upload size={size} color={color} />;
    case 'file-code':
      return <FileCode2 size={size} color={color} />;
    case 'folder-move-outline':
    case 'file-move-outline':
      return <FolderInput size={size} color={color} />;
    case 'content-duplicate':
    case 'content-copy':
      return <Copy size={size} color={color} />;
    case 'trash-can-outline':
      return <Trash2 size={size} color={color} />;
    case 'note-plus-outline':
      return <FilePlus2 size={size} color={color} />;
    case 'folder-plus-outline':
      return <FolderPlus size={size} color={color} />;
    case 'view-dashboard-edit-outline':
      return <SlidersHorizontal size={size} color={color} />;
    case 'calendar-outline':
      return <Calendar size={size} color={color} />;
    case 'tag-outline':
      return <Tag size={size} color={color} />;
    case 'template-outline':
      return <LayoutTemplate size={size} color={color} />;
    case 'template-save-outline':
      return <Save size={size} color={color} />;
    case 'check':
      return <Check size={size} color={color} />;
    case 'chevron-right':
      return <ChevronRight size={size} color={color} />;
    default:
      return <LayoutGrid size={size} color={color} />;
  }
}

export function ContextMenu({
  anchor,
  actions,
  onDismiss,
  theme,
  align = 'left',
}: {
  anchor: { x: number; y: number } | null;
  actions: ContextMenuAction[];
  onDismiss: () => void;
  theme: Theme;
  align?: 'left' | 'right';
}) {
  const ink = surfaceTheme(theme);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFocusedIndex(-1);
    setHoveredIndex(null);
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % Math.max(1, actions.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + Math.max(1, actions.length)) % Math.max(1, actions.length));
      } else if (e.key === 'Enter' && focusedIndex >= 0 && actions[focusedIndex]) {
        e.preventDefault();
        const act = actions[focusedIndex]!;
        onDismiss();
        act.onPress();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [anchor, actions, focusedIndex, onDismiss]);

  if (!anchor || actions.length === 0) return null;

  const menuWidth = 224;
  const menuHeight = actions.length * 48 + 12;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  let left = align === 'right' ? anchor.x - menuWidth + 16 : anchor.x;
  left = Math.max(8, Math.min(vw - menuWidth - 8, left));
  let top = anchor.y + 4;
  if (top + menuHeight > vh - 8) {
    top = Math.max(8, vh - menuHeight - 8);
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
      }}
      onClick={onDismiss}
      onContextMenu={(e) => {
        e.preventDefault();
        onDismiss();
      }}
    >
      <div
        ref={menuRef}
        role="menu"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top,
          left,
          width: menuWidth,
          backgroundColor: theme.surfaceRaised,
          borderRadius: Radius.lg,
          border: `1px solid ${ink.border}`,
          boxShadow: `0 10px 30px ${theme.shadow}`,
          padding: 4,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {actions.map((action, idx) => {
          const isHighlighted = focusedIndex === idx || hoveredIndex === idx;
          const color = action.destructive ? ink.error : ink.text;
          return (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex((cur) => (cur === idx ? null : cur))}
              onClick={() => {
                onDismiss();
                action.onPress();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                height: 44,
                padding: '0 12px',
                border: 'none',
                borderRadius: Radius.md,
                backgroundColor: isHighlighted ? ink.pillBg : 'transparent',
                color,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                ...Typography.app.body,
              }}
            >
              {action.iconName ? renderActionIcon(action.iconName, color, 16) : null}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
