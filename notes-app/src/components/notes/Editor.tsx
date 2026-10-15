import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform, type TextStyle } from 'react-native';
import { MaterialCommunityIcons } from '../shared/icons';
import Markdown from 'react-native-markdown-display';
import { MarkdownTextInput } from '@expensify/react-native-live-markdown';
import { Radius, Typography, type Theme } from '../../theme';
import type { Note } from '../../types';
import { parseMarkdownRanges } from './markdownParser';
import { applyAutoPair, stepOverCaret } from './autoPairs';
import { getMarkdownStyles, liveMarkdownStyle } from '../shared/utils';
import { ContextMenu, type ContextMenuAction } from '../shared/ContextMenu';

/**
 * react-native-web maps `multiline` to a real <textarea>, which ships the UA
 * focus ring, a 2px inset border and a drag-to-resize grip. None of that belongs
 * in a gapless typing canvas, and none of it can be removed from the shared
 * StyleSheet because the same object is used on native.
 */
const webInputReset: TextStyle | null =
  Platform.OS === 'web'
    ? ({
        borderWidth: 0,
        outlineStyle: 'none',
        outlineWidth: 0,
        boxShadow: 'none',
        resize: 'none',
      } as unknown as TextStyle)
    : null;

/**
 * The note editor: one input for the whole document, styled per token as you
 * type.
 *
 * `MarkdownTextInput` is a drop-in `TextInput` replacement that owns the text
 * rendering, which is what makes true live preview possible here: a stock
 * `TextInput` carries a single text style, so a paragraph could never show one
 * line rendered and the next raw. Because it is *one* buffer, the caret, word
 * wrap, selection and line-merge are entirely the platform's — there is no
 * per-line input to trap the caret, and no key handling to intercept.
 *
 * Syntax markers are never removed from the text; the parser only dims them in
 * place, so character offsets stay exact and clicks land where they look.
 */
export function Editor({
  note,
  theme,
  onContentChange,
  onDelete,
}: {
  note: Note;
  theme: Theme;
  onContentChange: (text: string) => void;
  onDelete: () => void;
}) {
  /**
   * Auto-closing brackets and quotes.
   *
   * Three pieces of state, and each one exists for a specific reason:
   *
   * - `previous` is the text as it was *before* this keystroke, because the rule
   *   is about the *difference* between two texts: "one character was inserted at
   *   the caret and nothing else changed". A paste is not a keystroke and must
   *   not be rewritten.
   * - `caretRef` is where the caret was, which is where the character landed. It
   *   cannot be read synchronously from the input, so `onSelectionChange` is the
   *   only source — the same approach `ScratchPadCard` takes.
   * - `pendingSelection` is the caret position to impose after the rewrite. It
   *   is *state* on purpose: `react-native-web` applies the `selection` prop in a
   *   `useLayoutEffect` keyed on **object identity**, so a fresh literal in
   *   render would re-pin the caret on every keystroke and the user could not
   *   type at all. Holding it in state means the prop only changes when there is
   *   genuinely a new position to impose.
   */
  const [previous, setPrevious] = useState(note.content);
  const caretRef = useRef(note.content.length);
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | null>(
    null
  );

  /**
   * Reset on a note *switch* only — keyed on `note.id`, not on `note.content`.
   *
   * This is the load-bearing detail: the content effect would fire after every
   * keystroke (the parent stores the text back into the note), and clearing
   * `pendingSelection` there would discard the very caret position the
   * auto-close had just imposed. A stale `previous` across a note switch would
   * make the first keystroke in the new note look like a rewrite of the old
   * one's tail, which is why the switch has to reset it at all.
   */
  useEffect(() => {
    setPrevious(note.content);
    caretRef.current = note.content.length;
    setPendingSelection(null);
    // `note.content` is deliberately not a dependency — see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const handleChange = (text: string) => {
    const caret = caretRef.current;
    const paired = applyAutoPair(previous, text, caret);
    const stepped = paired ? null : stepOverCaret(text, previous, caret);

    if (paired) {
      setPrevious(paired.text);
      onContentChange(paired.text);
      setPendingSelection({ start: paired.caret, end: paired.caret });
      return;
    }
    if (stepped !== null) {
      // The closer was already there: keep the text and move past it.
      setPrevious(text);
      onContentChange(text);
      setPendingSelection({ start: stepped, end: stepped });
      return;
    }

    setPrevious(text);
    onContentChange(text);
  };
  const markdownStyle = useMemo(() => liveMarkdownStyle(theme), [theme]);
  const renderedStyle = useMemo(() => getMarkdownStyles(theme), [theme]);
  /**
   * Pen (write) vs book (read). Local state on purpose: `Editor` is not
   * remounted when the note changes, so the mode survives a note switch, while
   * the input below is keyed on `note.id` to reset its caret.
   */
  const [mode, setMode] = useState<'write' | 'read'>('write');

  /**
   * The header's overflow menu.
   *
   * Delete was a red pill in the header, which put the app's most destructive
   * action in the place the eye lands first and made it a one-tap loss of work.
   * It now sits behind a three-dot, matching the note list rows, which is the
   * shape the user has already learned for "what else can I do with this note".
   * One shape for one thing is the rule; two shapes for one thing is two things
   * to learn.
   */
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const isRead = mode === 'read';

  /**
   * `ContextMenu` dismisses *before* running the action, so the id is captured
   * in the closure rather than read from state at press time — the same trap
   * `NotesView` documents.
   *
   * Labelled "Delete", not "Delete note": every other delete in the app says
   * "Delete" (the list rows, the dashboard cards, the event rows), and this menu
   * is the one the note list rows taught the user to open. It is also the only
   * item in it, so it needs no object to be unambiguous.
   */
  const noteActions: ContextMenuAction[] = [
    {
      label: 'Delete',
      iconName: 'trash-can-outline',
      destructive: true,
      onPress: () => {
        onDelete();
        setMenuAnchor(null);
      },
    },
  ];

  return (
    <>
      {/* No rule under this header. It sits on the canvas, directly under the
          tab strip, and a hairline here would draw a line straight across the
          tab the strip merges into — see `NoteTabs`. */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {note.title}
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => setMode(isRead ? 'write' : 'read')}
            style={({ pressed }) => [
              styles.iconPill,
              { backgroundColor: pressed ? theme.pillBg : 'transparent' },
            ]}
            accessibilityLabel={isRead ? 'Switch to editing' : 'Switch to reading'}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name={isRead ? 'pencil-outline' : 'book-open-variant'}
              size={16}
              color={theme.textMuted}
            />
          </Pressable>

          {/*
            A bare three-dot, and Delete lives *behind* it.

            The glyph alone is the whole point: a red "Delete" sitting next to it
            in the header put the app's most destructive action where the eye
            lands first and made it a one-tap loss of work. It is now one tap to
            open, one tap to choose — and the same shape the note list rows
            already use for "what else can I do with this note".
          */}
          <Pressable
            onPress={(e) => {
              // Anchored from the press point, not a measured rect — the same
              // reasoning as `SelectRow`, and the same reason the list rows do it.
              const { pageX, pageY } = e.nativeEvent;
              setMenuAnchor({ x: pageX, y: pageY });
            }}
            style={({ pressed }) => [
              styles.iconPill,
              { backgroundColor: pressed ? theme.pillBg : 'transparent' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Note actions for ${note.title}`}
            accessibilityHint="More actions, including delete"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="dots-vertical" size={16} color={theme.textMuted} />
          </Pressable>
        </View>
      </View>
      {isRead ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.readBody}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          {note.content.trim() ? (
            <Markdown style={renderedStyle}>{note.content}</Markdown>
          ) : (
            <Text style={{ color: theme.textMuted, ...Typography.app.body }}>This note is empty.</Text>
          )}
        </ScrollView>
      ) : (
        <View style={styles.body}>
          {/* Keyed by note so opening another note starts from a clean selection
              instead of inheriting the previous note's caret offset. */}
          <MarkdownTextInput
            key={note.id}
            value={note.content}
            onChangeText={handleChange}
            // The caret, tracked so auto-close knows where the typed character
            // landed. `onChangeText` carries only the text, and the pair rule is
            // about a position within it.
            onSelectionChange={(e) => {
              caretRef.current = e.nativeEvent.selection.start;
            }}
            // Imposed only when auto-close or step-over moved it, and held in
            // state so the identity is stable between keystrokes — see the note
            // on `pendingSelection` above.
            selection={pendingSelection ?? undefined}
            parser={parseMarkdownRanges}
            markdownStyle={markdownStyle}
            multiline
            placeholder="Start typing in Markdown…"
            placeholderTextColor={theme.textMuted}
            textAlignVertical="top"
            accessibilityLabel="Note content"
            // The colour has to be set explicitly: the input has no default, and
            // an unset colour falls back to black, which is invisible on the
            // Dark and OLED canvases.
            style={[styles.input, { color: theme.text }, webInputReset]}
          />
        </View>
      )}

      {/*
        Teleported into a root `Modal`, so this overflows the editor pane and the
        tab strip rather than being clipped by them.
      */}
      <ContextMenu
        anchor={menuAnchor}
        actions={noteActions}
        align="right"
        theme={theme}
        onDismiss={() => setMenuAnchor(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  title: { ...Typography.app.cardHeader, flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  iconPill: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  body: { flex: 1 },
  readBody: { padding: 24, paddingBottom: 64 },
  input: {
    flex: 1,
    padding: 24,
    margin: 0,
    // The text metrics live in the style, not in per-token ranges, so the
    // parser can only override size — everything else stays on the token.
    ...Typography.app.body,
    includeFontPadding: false,
    textAlignVertical: 'top',
  } as TextStyle,
});
