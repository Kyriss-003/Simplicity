import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '../shared/Card';
import { AnimatedPressable } from '../shared/motion';
import { ContextMenu, type ContextMenuAction } from '../shared/ContextMenu';
import { useScrollRedirection } from '../../hooks/useContainerScroll';
import { useInlineRename } from '../../hooks/useInlineRename';
import { Radius, Typography, primaryTheme, surfaceTheme, type Theme } from '../../theme';
import type { Folder, Note } from '../../types';
import { previewLines, relativeTime } from '../shared/utils';

/** Shared shape for the web context-menu / native long-press anchor. */
interface AnchorEvent {
  preventDefault?: () => void;
  nativeEvent: { pageX: number; pageY: number };
}

export interface NoteCardActions {
  onRename: (id: number, title: string) => void;
  onMove: (id: number) => void;
  onDuplicate: (id: number) => void;
  onDelete: (id: number) => void;
  onCopyContent: (id: number) => void;
}

/**
 * Horizontal scrolling row of note cards for the Overview dashboard.
 * Each card binds to a real `Note` from the store and calls `onOpenNote`.
 *
 * Hovering the row maps the vertical wheel onto horizontal scroll (see
 * `useHoverWheel`), and right-clicking a card opens the note's context menu —
 * rename in place, move, duplicate, copy, delete.
 */
export function NotesCardRow({
  notes,
  folders,
  theme,
  onOpenNote,
  actions,
  primary = false,
  expanded = false,
}: {
  /** The page's primary card — in `B&W`, the one black slab. */
  primary?: boolean;
  /** Grow the note cards to fill the space a hidden title left. */
  expanded?: boolean;
  notes: Note[];
  /** Used to label each card with the folder the note actually lives in. */
  folders: Folder[];
  theme: Theme;
  onOpenNote: (n: Note) => void;
  actions: NoteCardActions;
}) {
  const scrollRef = useScrollRedirection('horizontal');
  // The note cards are surfaces; the empty-state box inside the card paints
  // `theme.background` and so keeps the canvas ink below.
  const ink = primary ? primaryTheme(theme) : surfaceTheme(theme);

  // One lookup rather than a `find` per card per render: this row re-renders on
  // every keystroke in the editor behind it.
  const folderLabels = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const f of folders) m.set(f.id, f.label);
    return m;
  }, [folders]);

  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuNoteId, setMenuNoteId] = useState<number | null>(null);

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuNoteId(null);
  };

  const {
    renamingId,
    draftTitle,
    setDraftTitle,
    inputRef: renameInputRef,
    startRename: startRenameRaw,
    cancelRename,
    commitRename,
  } = useInlineRename(actions.onRename);

  // Rename draws a text field over the card, so the menu has to go first or it
  // stays anchored to a note the user has already left.
  const startRename = (note: Note) => {
    closeMenu();
    startRenameRaw(note);
  };

  const noteById = (id: number) => notes.find((n) => n.id === id) ?? notes[0]!;

  const menuActions: ContextMenuAction[] =
    menuNoteId === null
      ? []
      : [
          {
            label: 'Rename',
            iconName: 'pencil-outline',
            onPress: () => startRename(noteById(menuNoteId)),
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

  const openMenu = (noteId: number, e: AnchorEvent) => {
    // Suppress the browser's own menu — this card provides a real one.
    e.preventDefault?.();
    setMenuNoteId(noteId);
    setMenuAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
  };

  if (notes.length === 0) {
    return (
      <Card theme={ink} style={{ padding: 16, minHeight: 150 }}>
        <View
          style={[
            styles.emptyNoteCard,
            // `ink.pillBg`, not `theme.background`: this box is a step off the
            // *card*, not off the canvas. Painting it the canvas colour made the
            // black primary card a thick black frame around a white well — the
            // heaviest thing on the page — and a white-on-white well on a light
            // card needed its border just to be visible at all.
            { backgroundColor: ink.pillBg, borderColor: ink.border },
          ]}
        >
          <MaterialCommunityIcons
            name="note-plus-outline"
            size={22}
            color={ink.textMuted}
          />
          <Text
            style={{ color: ink.textMuted, ...Typography.app.body, textAlign: 'center', marginTop: 8 }}
          >
            No notes yet. Tap &quot;+ New Note&quot;.
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        // A horizontal scroller inside a vertical page: without this, Android's
        // nested scroll lets the row swallow vertical drags and the page cannot
        // be scrolled past it.
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowScroll}
      >
        {notes.map((item) => {
          // The badge names the folder the note is filed under, not a tag. It
          // used to show `item.tags[0]`, which fell back to a hardcoded
          // "Notebook" for the common case of an untagged note — so every card
          // in the root folder claimed to be a notebook. A note whose folder
          // has been soft-deleted falls back to "Unfiled" rather than
          // inventing a label.
          const folderLabel = folderLabels.get(item.folderId) ?? 'Unfiled';
          const previews = item.content?.trim() ? previewLines(item.content) : [];
          const isRenaming = renamingId === item.id;

          return (
            <View key={item.id}>
              {/* The press handlers sit on a wrapper that *is* the card's box, so
                  right-click and long-press land on the whole card. A
                  `Pressable` cannot hold both a card-sized style and a
                  press-scaling transform without the two fighting over the same
                  box, so this uses `AnimatedPressable` and the `Card` below it. */}
              <AnimatedPressable
                onPress={() => onOpenNote(item)}
                {...({
                  onContextMenu: (e: AnchorEvent) => openMenu(item.id, e),
                  onLongPress: (e: unknown) =>
                    openMenu(item.id, e as unknown as AnchorEvent),
                } as Record<string, unknown>)}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                accessibilityHint="Opens the note. Right-click for more actions."
              >
                <Card theme={ink} style={[styles.noteCard, expanded && styles.noteCardExpanded]}>
                  {/* tag row — fixed flex row prevents overlap */}
                  <View style={styles.noteTagRow}>
                    <View style={styles.noteTagLeft}>
                      <View style={[styles.noteIconBox, { backgroundColor: ink.pillBg }]}>
                        <MaterialCommunityIcons
                          name="file-document-outline"
                          size={11}
                          color={ink.textMuted}
                        />
                      </View>
                      <Text
                        style={[styles.tagLabel, { color: ink.textMuted }]}
                        numberOfLines={1}
                      >
                        {folderLabel}
                      </Text>
                    </View>
                    <Text
                      style={[styles.tagTime, { color: ink.textMuted }]}
                      accessibilityLabel={`Last edited ${relativeTime(item.updatedAt)}`}
                    >
                      {relativeTime(item.updatedAt)}
                    </Text>
                  </View>

                  {isRenaming ? (
                    <TextInput
                      ref={renameInputRef}
                      value={draftTitle}
                      onChangeText={setDraftTitle}
                      onSubmitEditing={() => commitRename(item.id)}
                      onKeyPress={(e) => {
                        if (e.nativeEvent.key === 'Escape') cancelRename();
                      }}
                      onBlur={() => commitRename(item.id)}
                      autoFocus
                      selectTextOnFocus
                      returnKeyType="done"
                      style={[styles.renameInput, { color: ink.text, borderColor: theme.accent }]}
                      accessibilityLabel="Note title"
                    />
                  ) : (
                    <Text style={[styles.noteTitle, { color: ink.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                  )}

                  {previews.length > 0 ? (
                    previews.map((p, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Text style={[styles.bullet, { color: ink.textMuted }]}>•</Text>
                        <Text
                          style={[styles.bulletText, { color: ink.textMuted }]}
                          numberOfLines={1}
                        >
                          {p}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.bulletText, { color: ink.textMuted }]}>
                      Empty note
                    </Text>
                  )}
                </Card>
              </AnimatedPressable>
            </View>
          );
        })}
      </ScrollView>

      <ContextMenu
        anchor={menuAnchor}
        actions={menuActions}
        onDismiss={closeMenu}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rowScroll: { gap: 12, paddingBottom: 4 },
  // Narrower and shorter than the previous 224x160: at 100% zoom five cards ate
  // the entire row width, and the preview only ever showed a title and two lines.
  noteCard: { width: 200, minHeight: 144 },
  /** Taller note cards when the section title is hidden — the row
      fills the space the heading occupied rather than collapsing. */
  noteCardExpanded: { minHeight: 176 },
  emptyNoteCard: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    gap: 4,
  },
  noteTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  noteTagLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  noteIconBox: {
    width: 16,
    height: 16,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tagLabel: { ...Typography.app.captionStrong },
  tagTime: { ...Typography.app.caption, flexShrink: 0 },
  noteTitle: { ...Typography.app.cardHeader, marginBottom: 4 },
  renameInput: {
    ...Typography.app.cardHeader,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 2,
    alignItems: 'flex-start',
  },
  bullet: { ...Typography.app.caption, marginTop: 0, flexShrink: 0 },
  bulletText: { ...Typography.app.caption, flex: 1, minWidth: 0 },
});
