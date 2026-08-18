import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import type { Theme } from '../../theme';
import type { Note } from '../../db/NoteRepository';
import { relativeTime, getMarkdownStyles } from '../shared/utils';
import { ContextMenu, type ContextMenuAction } from '../shared/ContextMenu';

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
  const [isEditing, setIsEditing] = useState(true);
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
            <Text style={{ color: theme.accentText, fontSize: 12, fontWeight: '700' }}>New</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 8, gap: 6 }}>
          {notes.length === 0 ? (
            <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center', marginTop: 24 }}>
              No notes yet.
            </Text>
          ) : (
            notes.map((n) => {
              const active = display?.id === n.id;
              return (
                <TouchableOpacity
                  key={n.id}
                  onPress={() => onSelect(n)}
                  onLongPress={() => {
                    // On native, use the element's approximate center as anchor
                    setMenuAnchor({ x: 140, y: 80 });
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
            <Text style={{ color: theme.textMuted, fontSize: 14, marginTop: 12, textAlign: 'center' }}>
              Select a note or create a new one to start typing.
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.editorHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.editorTitle, { color: theme.text }]} numberOfLines={1}>
                {display.title}
              </Text>
              <View style={styles.editorActions}>
                <TouchableOpacity
                  onPress={() => setIsEditing((v) => !v)}
                  style={[styles.smallPill, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
                >
                  <MaterialCommunityIcons
                    name={isEditing ? 'eye-outline' : 'pencil-outline'}
                    size={13}
                    color={theme.text}
                  />
                  <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>
                    {isEditing ? 'Preview' : 'Edit'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onDelete}
                  style={[styles.smallPill, { backgroundColor: '#3f1115' }]}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={13} color="#f87171" />
                  <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '600' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              {isEditing ? (
                <TextInput
                  value={display.content}
                  onChangeText={onContentChange}
                  placeholder="Start typing in Markdown…"
                  placeholderTextColor={theme.textMuted}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                  style={[styles.editorInput, { color: theme.text }]}
                />
              ) : (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                  <Markdown style={getMarkdownStyles(theme, 15)}>
                    {display.content || '_Empty note_'}
                  </Markdown>
                </ScrollView>
              )}
            </View>
          </>
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
  title: { fontSize: 15, fontWeight: '700' },
  smallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  listItem: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 3 },
  listTitle: { fontSize: 13, fontWeight: '700' },
  listPreview: { fontSize: 11, lineHeight: 14 },
  listMeta: { fontSize: 10, marginTop: 2 },
  editorPane: { flex: 1, minWidth: 0 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  editorTitle: { fontSize: 15, fontWeight: '700', flex: 1, minWidth: 0 },
  editorActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  editorInput: { flex: 1, padding: 16, fontSize: 15, lineHeight: 22 },
});
