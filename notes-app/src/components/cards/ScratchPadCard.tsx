import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { Card } from '../shared/Card';
import { getMarkdownStyles } from '../shared/utils';
import type { Theme } from '../../theme';

type MarkdownTool =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'bullet'
  | 'numbered'
  | 'code'
  | 'link'
  | 'preview';

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
  { key: 'preview', icon: 'eye-outline', label: 'Preview' },
];

/**
 * Scratch pad card with a rich markdown formatting toolbar.
 * Tools insert markdown syntax at the cursor position. The preview tool
 * toggles live markdown rendering via react-native-markdown-display.
 */
export function ScratchPadCard({
  theme,
  value,
  onChangeText,
  style,
}: {
  theme: Theme;
  value: string;
  onChangeText: (t: string) => void;
  style?: ViewStyle | undefined;
}) {
  const [isPreview, setIsPreview] = useState(false);
  const inputRef = useRef<TextInput>(null);

  /**
   * Inserts markdown syntax at the current cursor position. We track cursor
   * via onFocus/onSelectionChange since RN doesn't expose a synchronous
   * selection getter on TextInput.
   */
  const cursorRef = useRef<number>(value.length);
  const handleSelectionChange: TextInputProps['onSelectionChange'] = (e) => {
    cursorRef.current = e.nativeEvent.selection.start;
  };

  const insertMarkdown = (tool: Exclude<MarkdownTool, 'preview'>) => {
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

    const next = before + insertion + after;
    onChangeText(next);

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

  const handleTool = (tool: MarkdownTool) => {
    if (tool === 'preview') {
      setIsPreview((v) => !v);
      return;
    }
    insertMarkdown(tool);
  };

  return (
    <Card theme={theme} style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Scratch Pad</Text>
        {isPreview ? (
          <View style={[styles.previewBadge, { backgroundColor: theme.pillBg }]}>
            <MaterialCommunityIcons name="eye" size={11} color={theme.textMuted} />
            <Text style={[styles.previewBadgeText, { color: theme.textMuted }]}>Preview</Text>
          </View>
        ) : null}
      </View>

      {/* Content area */}
      {isPreview && value.trim() ? (
        <ScrollView style={{ flex: 1, minHeight: 120 }}>
          <Markdown style={getMarkdownStyles(theme)}>{value}</Markdown>
        </ScrollView>
      ) : (
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onSelectionChange={handleSelectionChange}
          placeholder="Jot down quick thoughts…"
          placeholderTextColor={theme.textMuted}
          multiline
          textAlignVertical="top"
          style={[styles.scratchInput, { color: theme.text }]}
        />
      )}

      {/* Formatting toolbar */}
      <View style={[styles.toolbar, { borderTopColor: theme.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarScroll}
        >
          {TOOLS.map((tool) => {
            const active = tool.key === 'preview' && isPreview;
            return (
              <TouchableOpacity
                key={tool.key}
                onPress={() => handleTool(tool.key)}
                activeOpacity={0.7}
                accessibilityLabel={tool.label}
                style={[
                  styles.toolBtn,
                  {
                    backgroundColor: active ? theme.accent : 'transparent',
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={tool.icon}
                  size={16}
                  color={active ? theme.accentText : theme.textMuted}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={{ color: theme.textMuted, fontSize: 10, flexShrink: 0 }}>
          {value.length > 0 ? `${value.length}` : ''}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  previewBadgeText: { fontSize: 10, fontWeight: '600' },
  scratchInput: {
    flex: 1,
    minHeight: 120,
    fontSize: 13,
    lineHeight: 18,
    textAlignVertical: 'top',
    paddingTop: 4,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  toolbarScroll: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  toolBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
