import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputSelectionChangeEventData,
  type TextStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { Radius, Typography, type Theme } from '../../theme';
import type { Note } from '../../types';
import {
  activeBlockStyle,
  blockIndexAt,
  decorationLayer,
  editableBlock,
  getMarkdownStyles,
  mergeWithPrevious,
  parseBlocks,
  type MdBlock,
} from '../shared/utils';

/**
 * react-native-web maps `multiline` to a real <textarea>, which ships the UA
 * focus ring, a 2px inset border and a drag-to-resize grip. None of that
 * belongs in a gapless typing canvas, and none of it can be removed from the
 * shared StyleSheet because the same object is used on native.
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
 * Grace period before a blur converts the document.
 *
 * Tapping a different block blurs the input on press-*down*, before the press
 * completes. Collapsing immediately would decorate the whole document and tear
 * the input down mid-gesture, so the caret visibly jumps. The press re-targets
 * within this window and cancels the collapse; a real blur still converts the
 * document, imperceptibly later.
 */
const BLUR_GRACE_MS = 200;

/** The document parsed as a single paragraph — used when there is nothing else. */
function emptyBlock(content: string): MdBlock {
  return { text: content, start: 0, end: content.length, kind: 'paragraph', depth: 0, fence: null };
}

/**
 * Obsidian-style live markdown editor for a single note — no preview toggle.
 *
 * The note is parsed into AST blocks (paragraph, heading, list, fenced code).
 * A pure decoration layer compares each block's range against the caret: the
 * block holding the caret becomes one `multiline` TextInput, every other block
 * renders as formatted markdown, so a block converts the instant the caret
 * leaves it or the input blurs.
 *
 * Block is the *only* unit that is ever a text input. One input per line was
 * tried and reverted: separate inputs cannot share arrow-key focus, word-wrap
 * or line merging, so the caret appeared to teleport. Keeping the whole block in
 * one buffer leaves the intra-block keys entirely to the platform and frees the
 * buffer edges for cross-block navigation.
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
  /** Caret range, held in full-document coordinates (not block-local). */
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [focused, setFocused] = useState(false);
  /** A tapped rendered block has no live input yet — ask it to focus on mount. */
  const [pendingFocus, setPendingFocus] = useState(false);
  /**
   * Caret position to impose on the input, set only by cross-block navigation.
   *
   * The object is held in state and never rebuilt during render: react-native-web
   * applies `selection` in a layout effect keyed on the prop's identity, so a
   * fresh literal every render would re-pin the caret on every keystroke. Once
   * applied the platform owns the selection again.
   */
  const [forcedSelection, setForcedSelection] = useState<{ start: number; end: number } | null>(null);
  const inputRef = useRef<TextInput>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelBlur = () => {
    if (blurTimer.current !== null) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  };
  useEffect(() => cancelBlur, []);

  // Opening a different note must not inherit the previous note's caret,
  // imposed selection or focus — they address offsets in the old document.
  // Adjusting during render (rather than in an effect) avoids committing a
  // frame that would aim the new note's input at the old note's offsets.
  const [noteId, setNoteId] = useState(note.id);
  if (noteId !== note.id) {
    setNoteId(note.id);
    setSelection({ start: 0, end: 0 });
    setForcedSelection(null);
    setFocused(false);
    setPendingFocus(false);
  }

  const content = note.content;
  const blocks = useMemo(() => parseBlocks(content), [content]);
  // Decorated blocks are top-margined only, so a document split into several
  // blocks keeps the rhythm a single rendered block would have had.
  const md = useMemo(() => getMarkdownStyles(theme, { tight: true }), [theme]);

  // Keyed off the block count, not content.length: a whitespace-only document
  // also yields one whole-content block, and must still be typeable.
  const isEmptyDoc = blocks.length === 0;

  // Only a one-block document can hand the whole pane to the input. Once another
  // block is on screen the flow has to scroll, because an input that grew to the
  // full height would push the decorated blocks off the canvas.
  const fillsCanvas = blocks.length <= 1;

  // The virtual decoration layer. -1 whenever the editor is unfocused, which
  // decorates the whole document — the "converts on blur" behaviour.
  const layer = useMemo(
    () => decorationLayer(blocks, selection.start, focused || pendingFocus),
    [blocks, selection.start, focused, pendingFocus],
  );
  const activeIndex = isEmptyDoc ? 0 : layer.activeIndex;
  const activeBlock: MdBlock | null = isEmptyDoc
    ? emptyBlock(content)
    : editableBlock(blocks, activeIndex, content);

  /** Move the caret into another block and take focus with it. */
  const focusBlock = (index: number, offset: number) => {
    const block = blocks[index];
    if (!block) return;
    // A tap that blurred the input on press-down is re-targeting, not leaving.
    cancelBlur();
    const local = Math.min(Math.max(offset, 0), block.text.length);
    setSelection({ start: block.start + local, end: block.start + local });
    setForcedSelection({ start: local, end: local });
    setPendingFocus(true);
  };

  // Tapping a rendered block makes it the active one. Granularity is the block:
  // the caret lands at the end of that block, not at the tapped character.
  const activateBlock = (index: number) => focusBlock(index, blocks[index]?.text.length ?? 0);

  useEffect(() => {
    if (pendingFocus) inputRef.current?.focus();
  }, [pendingFocus, activeIndex]);

  const handleSelectionChange = (
    e: NativeSyntheticEvent<TextInputSelectionChangeEventData>,
  ) => {
    const block = activeBlock;
    if (!block) return;
    // The input only holds this block's text, so shift back into document space.
    const { start, end } = e.nativeEvent.selection;
    setSelection({ start: block.start + start, end: block.start + end });
  };

  const handleBlockChange = (next: string) => {
    const block = activeBlock;
    if (!block) return;
    const { start, end } = block;
    if (!(start >= 0 && start <= end && end <= content.length)) return;
    onContentChange(content.slice(0, start) + next + content.slice(end));
  };

  /**
   * Cross-block keyboard navigation.
   *
   * A block's input holds only that block's text, so at the buffer edges the
   * platform has nothing to do: Backspace at offset 0 has no character to
   * delete and the arrows have no line to move to. Those keys are therefore
   * free to cross blocks, while every key *inside* the block is left entirely
   * to the native input — no interception, no re-implementation of caret logic.
   */
  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const block = activeBlock;
    if (!block || isEmptyDoc) return;
    const key = e.nativeEvent.key;
    const at = selection.start - block.start;
    // Measured against the block's own text, not the editable range, which also
    // swallows the blank lines that follow the block.
    const atStart = at <= 0;
    const atEnd = at >= block.text.length;

    if (key === 'Backspace' && atStart) {
      const merge = mergeWithPrevious(blocks, activeIndex, content);
      // No mergeable predecessor (heading, fence, or the first block): the
      // separator is outside the buffer, so the platform already no-ops.
      if (!merge) return;
      onContentChange(merge.content);
      focusBlock(merge.blockIndex, merge.offset);
      return;
    }
    if (key === 'ArrowUp' && atStart && activeIndex > 0) {
      focusBlock(activeIndex - 1, blocks[activeIndex - 1].text.length);
      return;
    }
    if (key === 'ArrowDown' && atEnd && activeIndex < blocks.length - 1) {
      focusBlock(activeIndex + 1, 0);
    }
  };

  const renderBlock = (block: MdBlock, index: number) => (
    <Pressable key={block.start} onPress={() => activateBlock(index)}>
      <View style={styles.block}>
        <Markdown style={md}>{block.text}</Markdown>
      </View>
    </Pressable>
  );

  // The raw slot. Keyed so React *moves* the input when the caret changes block
  // instead of unmounting and remounting it — a remount drops focus mid-typing.
  // The wrapper carries the gutter and the input carries the kind's own style,
  // which is the same composition the decorated branch uses, so the two boxes
  // are metrically identical.
  const rawSlot = activeBlock ? (
    <View key="raw" style={[styles.block, fillsCanvas && styles.fill]}>
      <TextInput
        ref={inputRef}
        value={activeBlock.text}
        selection={forcedSelection ?? undefined}
        onChangeText={handleBlockChange}
        onSelectionChange={handleSelectionChange}
        onKeyPress={handleKeyPress}
        onFocus={() => {
          cancelBlur();
          setFocused(true);
          setPendingFocus(false);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => {
            blurTimer.current = null;
            setFocused(false);
            setPendingFocus(false);
          }, BLUR_GRACE_MS);
        }}
        autoFocus={pendingFocus || isEmptyDoc}
        multiline
        placeholder="Start typing in Markdown…"
        placeholderTextColor={theme.textMuted}
        style={[
          styles.editorInput,
          webInputReset,
          activeBlockStyle(md, activeBlock),
          fillsCanvas && styles.fill,
        ]}
      />
    </View>
  ) : null;

  // One slot per block, in document order: the decoration layer decides which
  // slot holds the caret and the rest render as rich markdown. Blurring flips
  // every slot to decorated, which is the whole "live preview" effect.
  const documentBody = isEmptyDoc ? (
    rawSlot
  ) : (
    <>{blocks.map((block, i) => (layer.decorated[i] ? renderBlock(block, i) : rawSlot))}</>
  );

  return (
    <>
      <View style={[styles.editorHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.editorTitle, { color: theme.text }]} numberOfLines={1}>
          {note.title}
        </Text>
        <View style={styles.editorActions}>
          <TouchableOpacity
            onPress={onDelete}
            style={[styles.smallPill, { backgroundColor: theme.backgroundSecondary }]}
            accessibilityLabel="Delete note"
          >
            <MaterialCommunityIcons name="trash-can-outline" size={16} color={theme.error} />
            <Text style={{ color: theme.error, ...Typography.app.captionStrong }}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.body}>
        {fillsCanvas ? (
          /* Nothing to scroll past, so the input *is* the canvas: a plain flex
             parent gives it the definite height it needs to fill the pane, and
             the textarea scrolls its own overflow. */
          documentBody
        ) : (
          <ScrollView
            style={styles.preview}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            {documentBody}
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  editorTitle: { ...Typography.app.cardHeader, flex: 1, minWidth: 0 },
  editorActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  smallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  body: { flex: 1 },
  editorInput: {
    margin: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderWidth: 0,
    includeFontPadding: false,
    textAlignVertical: 'top',
  },
  fill: { flex: 1 },
  preview: { flex: 1 },
  /** Shared gutter: identical for raw and rendered blocks so nothing shifts. */
  block: { padding: 24 },
});
