import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Typography, type Theme } from '../../theme';
import type { Note } from '../../types';
import { relativeTime } from '../shared/utils';
import { ContextMenu, type ContextMenuAction } from '../shared/ContextMenu';
import { Editor } from './Editor';

/** Shared shape for web context-menu / native long-press anchors. */
interface AnchorEvent {
  preventDefault?: () => void;
  nativeEvent: { pageX: number; pageY: number };
}

/**
 * Apple Notes-style split pane: scrollable note list on the left, gapless
 * markdown editor / preview on the right.
 */
export function NotesView({
  theme,
  notes,
  selected,
  onSelect,
  onNewNote,
  onContentChange,
  onDelete,
  onMoveNote,
  onDuplicateNote,
  onDeleteNote,
}: {
  theme: Theme;
  notes: Note[];
  selected: Note | null;
  onSelect: (n: Note) => void;
  onNewNote: () => void;
  onContentChange: (text: string) => void;
  onDelete: () => void;
  /** Move the note with this ID to a folder (opens MoveToModal in orchestrator). */
  onMoveNote?: (noteId: number) => void;
  /** Duplicate the note with this ID. */
  onDuplicateNote?: (noteId: number) => void;
  /** Soft-delete the note with this ID. */
  onDeleteNote?: (noteId: number) => void;
}) {
  const display = selected;

  /* ---- Context menu state ---- */
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuNoteId, setMenuNoteId] = useState<number | null>(null);

  const dismissMenu = () => {
    setMenuAnchor(null);
    setMenuNoteId(null);
  };

  const noteMenuActions: ContextMenuAction[] = [
    { label: 'Move to folder', iconName: 'folder-move-outline', onPress: () => menuNoteId != null && onMoveNote?.(menuNoteId) },
    { label: 'Duplicate', iconName: 'content-duplicate', onPress: () => menuNoteId != null && onDuplicateNote?.(menuNoteId) },
    { label: 'Delete', iconName: 'trash-can-outline', onPress: () => menuNoteId != null && onDeleteNote?.(menuNoteId), destructive: true },
  ];

  return (
    <View style={styles.view}>
      {/* List pane */}
      <View style={[styles.listPane, { backgroundColor: theme.surface, borderRightColor: theme.border }]}>
        <View style={[styles.listHeader, { borderBottomColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Notes</Text>
          <TouchableOpacity
            onPress={onNewNote}
            style={[styles.smallPill, { backgroundColor: theme.accent }]}
          >
            <MaterialCommunityIcons name="plus" size={14} color={theme.accentText} />
            <Text style={{ color: theme.accentText, ...Typography.app.captionStrong }}>New</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: 8, gap: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
        >
          {notes.length === 0 ? (
            <Text style={{ color: theme.textMuted, ...Typography.app.body, textAlign: 'center', marginTop: 24 }}>
              No notes yet.
            </Text>
          ) : (
            notes.map((n) => {
              const active = display?.id === n.id;
              return (
                <TouchableOpacity
                  key={n.id}
                  onPress={() => onSelect(n)}
                  onLongPress={(e) => {
                    // Use the real touch position so the menu anchors to the
                    // pressed row — mirrors the web path in Sidebar.
                    const { pageX, pageY } = e.nativeEvent;
                    setMenuAnchor({ x: pageX, y: pageY });
                    setMenuNoteId(n.id);
                  }}
                  {...({
                    onContextMenu: (e: AnchorEvent) => {
                      e.preventDefault?.();
                      setMenuAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
                      setMenuNoteId(n.id);
                    },
                  } as Record<string, unknown>)}
                  style={[
                    styles.listItem,
                    { backgroundColor: active ? theme.pillBg : 'transparent', borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.listTitle, { color: theme.text }]} numberOfLines={1}>
                    {n.title}
                  </Text>
                  <Text style={[styles.listPreview, { color: theme.textMuted }]} numberOfLines={2}>
                    {n.content?.slice(0, 120) || 'Empty note'}
                  </Text>
                  <Text style={[styles.listMeta, { color: theme.textMuted }]}>
                    {relativeTime(n.updatedAt)}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Context menu overlay */}
      <ContextMenu
        anchor={menuAnchor}
        actions={noteMenuActions}
        onDismiss={dismissMenu}
        theme={theme}
      />

      {/* Editor pane — Apple Note gapless typing */}
      <View style={[styles.editorPane, { backgroundColor: theme.background }]}>
        {!display ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="note-edit-outline" size={40} color={theme.textMuted} />
            <Text style={{ color: theme.textMuted, ...Typography.app.body, marginTop: 12, textAlign: 'center' }}>
              Select a note or create a new one to start typing.
            </Text>
          </View>
        ) : (
          <Editor
            note={display}
            theme={theme}
            onContentChange={onContentChange}
            onDelete={onDelete}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  view: { flex: 1, flexDirection: 'row', minHeight: 0 },
  listPane: { width: 280, borderRightWidth: 1 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { ...Typography.app.cardHeader },
  smallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  listItem: { borderRadius: Radius.lg, borderWidth: 1, padding: 12, gap: 4 },
  listTitle: { ...Typography.app.bodyStrong },
  listPreview: { ...Typography.app.caption },
  listMeta: { ...Typography.app.caption, marginTop: 4 },
  editorPane: { flex: 1, minWidth: 0 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
