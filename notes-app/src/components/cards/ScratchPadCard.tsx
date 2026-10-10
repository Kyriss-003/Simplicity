import React, { useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MarkdownTextInput } from '@expensify/react-native-live-markdown';
import { Card } from '../shared/Card';
import { AnimatedPressable } from '../shared/motion';
import { parseMarkdownRanges } from '../notes/markdownParser';
import { liveMarkdownStyle } from '../shared/utils';
import { Radius, Typography, primaryTheme, surfaceTheme, type Theme } from '../../theme';

type MarkdownTool = 'bold' | 'italic' | 'heading' | 'bullet' | 'numbered' | 'code' | 'link';

interface ToolDef {
  key: MarkdownTool;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
}

const TOOLS: ToolDef[] = [
  { key: 'bold', icon: 'format-bold', label: 'Bold' },
  { key: 'italic', icon: 'format-italic', label: 'Italic' },
  { key: 'heading', icon: 'format-header-2', label: 'Heading' },
  { key: 'bullet', icon: 'format-list-bulleted', label: 'Bullet list' },
  { key: 'numbered', icon: 'format-list-numbered', label: 'Numbered list' },
  { key: 'code', icon: 'code-tags', label: 'Code' },
  { key: 'link', icon: 'link-variant', label: 'Link' },
];

/**
 * Web-only: `multiline` renders a real <textarea> with the UA focus ring, a 2px
 * inset border and a resize grip. Mirrors `Editor.tsx`, which resets the same
 * three properties for the same reason.
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
 * Scratch pad: a quick note that renders markdown as you type.
 *
 * It uses the same `MarkdownTextInput` engine as the note editor rather than a
 * stock `TextInput` plus a preview toggle. A stock input carries one text style,
 * so `**bold**` could only ever show its raw markers — the alternative was a
 * second, whole markdown renderer behind an eye button, and a scratch pad whose
 * formatting is invisible until you go looking for it. One engine, two call
 * sites, no preview mode.
 */
export function ScratchPadCard({
  theme,
  value,
  onChangeText,
  onCreateNote,
  primary = false,
  expanded = false,
  style,
}: {
  /** The page's primary card — in `B&W`, the one black slab. */
  primary?: boolean;
  /** Grow the card to fill the space a hidden section title left. */
  expanded?: boolean;
  theme: Theme;
  value: string;
  onChangeText: (t: string) => void;
  /**
   * Turn the pad into a real note.
   *
   * Optional so the card still renders where there is nowhere to file the
   * result — a note needs a folder, and the picker is the orchestrator's.
   */
  onCreateNote?: (() => void) | undefined;
  style?: ViewStyle | undefined;
}) {
  // The whole pad renders *inside* a card, markdown engine included, so it takes
  // the surface ink — its `syntaxDim` and code-block fill are both defined
  // against the card, not the canvas behind it.
  const ink = primary ? primaryTheme(theme) : surfaceTheme(theme);
  const markdownStyle = useMemo(() => liveMarkdownStyle(ink), [ink]);
  const inputRef = useRef<React.ComponentRef<typeof MarkdownTextInput>>(null);

  /**
   * Inserts markdown syntax at the current cursor position. We track cursor
   * via onSelectionChange since RN doesn't expose a synchronous selection
   * getter.
   */
  const cursorRef = useRef<number>(value.length);
  const handleSelectionChange: TextInputProps['onSelectionChange'] = (e) => {
    cursorRef.current = e.nativeEvent.selection.start;
  };

  const insertMarkdown = (tool: MarkdownTool) => {
    const cursor = cursorRef.current;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);

    let insertion = '';
    let cursorOffset = 0;

    switch (tool) {
      case 'bold':
        insertion = '****';
        cursorOffset = 2; // place cursor between **
        break;
      case 'italic':
        insertion = '**';
        cursorOffset = 1;
        break;
      case 'heading':
        insertion = '## ';
        cursorOffset = insertion.length;
        break;
      case 'bullet':
        insertion = '- ';
        cursorOffset = insertion.length;
        break;
      case 'numbered':
        insertion = '1. ';
        cursorOffset = insertion.length;
        break;
      case 'code':
        insertion = '``';
        cursorOffset = 1;
        break;
      case 'link':
        insertion = '[text](url)';
        cursorOffset = insertion.length;
        break;
    }

    onChangeText(before + insertion + after);

    // update cursor ref so subsequent inserts chain correctly
    cursorRef.current = cursor + cursorOffset;

    // refocus and set selection (best-effort on native)
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setNativeProps({
        selection: { start: cursor + cursorOffset, end: cursor + cursorOffset },
      });
    });
  };

  return (
    <Card theme={ink} style={[styles.container, expanded && styles.expanded, style]}>
      <View style={styles.header}>
        {/* The pad's only durable action, so it sits in the header next to the
            count rather than in the toolbar: the toolbar is a horizontal
            scroller of *formatting*, and "make this a note" is not formatting.
            Mixed in, it would be one more glyph in a row of glyphs and the only
            one that changes where the text lives.

            It is disabled rather than hidden when the pad is empty, because a
            control that appears and disappears is a control you have to notice
            arriving. Dimmed says "nothing to save yet" without moving. */}
        {onCreateNote ? (
          <AnimatedPressable
            onPress={onCreateNote}
            disabled={value.trim().length === 0}
            containerStyle={styles.saveContainer}
            accessibilityLabel="Turn the scratch pad into a note"
            accessibilityHint="Choose which folder it is filed under"
            style={[
              styles.save,
              { borderColor: ink.border, backgroundColor: ink.pillBg },
              value.trim().length === 0 && { opacity: 0.4 },
            ]}
          >
            <MaterialCommunityIcons name="note-plus-outline" size={16} color={ink.text} />
            <Text style={[styles.saveLabel, { color: ink.text }]}>Save as note</Text>
          </AnimatedPressable>
        ) : null}
        {/* Character count sits in the header rather than the toolbar: the
            toolbar is a horizontal scroller, and a fixed element beside it was
            the one thing that could be squeezed off the card's right edge. */}
        <Text style={[styles.charCount, { color: ink.textMuted }]}>
          {value.length > 0 ? `${value.length}` : ''}
        </Text>
      </View>

      <MarkdownTextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={handleSelectionChange}
        parser={parseMarkdownRanges}
        markdownStyle={markdownStyle}
        multiline
        placeholder="Jot down quick thoughts…"
        placeholderTextColor={ink.textMuted}
        textAlignVertical="top"
        accessibilityLabel="Scratch pad"
        // No default colour: unset falls back to black, which is invisible on
        // the Dark and OLED canvases. See `Editor.tsx`.
        style={[styles.scratchInput, { color: ink.text }, webInputReset]}
      />

      <View style={[styles.toolbar, { borderTopColor: ink.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarScroll}
        >
          {TOOLS.map((tool) => (
            <AnimatedPressable
              key={tool.key}
              onPress={() => insertMarkdown(tool.key)}
              containerStyle={styles.toolBtnContainer}
              accessibilityLabel={tool.label}
              style={[styles.toolBtn, { borderColor: ink.border }]}
            >
              <MaterialCommunityIcons
                name={tool.icon}
                size={16}
                color={ink.textMuted}
              />
            </AnimatedPressable>
          ))}
        </ScrollView>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // No `flex` here: see `TasksCard`. A `flex: 1` in the mobile column layout is
  // a zero-height box, and the card's contents then overflow their own border.
  container: { minWidth: 0 },
  /**
   * Extra vertical padding when the section title is hidden — see
   * `TasksCard.expanded`. Overrides the `Card`'s default vertical padding.
   */
  expanded: { paddingVertical: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    // Title now lives in the section header above the card, so this row
    // holds only the trailing control and it sits right.
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  charCount: { ...Typography.app.caption, flexShrink: 0 },
  saveContainer: { borderRadius: Radius.full },
  /** 32px like the toolbar buttons, and beside the count it sits against. */
  save: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginRight: 8,
  },
  saveLabel: { ...Typography.app.captionStrong },
  scratchInput: {
    flex: 1,
    minHeight: 120,
    ...Typography.app.body,
    textAlignVertical: 'top',
    paddingTop: 4,
  } as TextStyle,
  toolbar: {
    marginTop: 12,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  toolbarScroll: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  toolBtnContainer: { borderRadius: Radius.md, flexShrink: 0 },
  toolBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
