import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Typography, type Theme, type ThemeName } from '../theme';
import type { Folder, ScreenKey } from '../types';
import { buildFolderTree, flattenTree } from '../hooks/useFolderTree';
import { ContextMenu, type ContextMenuAction } from './shared/ContextMenu';

/** Nav entries mirrored from the CapsuleSwitcher screens. */
const NAV_ITEMS: {
  key: ScreenKey;
  label: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { key: 'Overview', label: 'Overview', iconName: 'view-dashboard-outline' },
  { key: 'Notes', label: 'Notes', iconName: 'note-outline' },
  { key: 'Agenda', label: 'Agenda', iconName: 'calendar-outline' },
];

const THEME_OPTIONS: ThemeName[] = ['Dark', 'OLED', 'Light'];

/** Inline-editing target: either a rename or a new sub-folder under a parent. */
interface InlineEdit {
  kind: 'rename' | 'create';
  folderId: string;
}

/** Shared shape for web context-menu / native long-press anchors. */
interface AnchorEvent {
  preventDefault?: () => void;
  nativeEvent: { pageX: number; pageY: number };
}

/**
 * Left rail: navigation, theme switcher, and the persisted folder tree.
 *
 * Presentational only — folder data and mutations arrive via props from the
 * orchestrator (which delegates to the note store). Context-menu and
 * inline-editing UI live here; move/delete confirmations are surfaced by the
 * orchestrator via the onMoveFolder / onDeleteFolder callbacks.
 */
export default function Sidebar({
  theme,
  activeNav,
  themeName,
  folders,
  selectedFolderId,
  noteCounts,
  onToggle,
  onSelectNav,
  onSelectTheme,
  onSelectFolder,
  onCreateNote,
  onCreateFolder,
  onRenameFolder,
  onMoveFolder,
  onDuplicateFolder,
  onDeleteFolder,
}: {
  theme: Theme;
  activeNav: ScreenKey;
  themeName: ThemeName;
  folders: Folder[];
  selectedFolderId: string | null;
  noteCounts: Record<string, number>;
  onToggle: () => void;
  onSelectNav: (key: ScreenKey) => void;
  onSelectTheme: (name: ThemeName) => void;
  onSelectFolder: (folderId: string) => void;
  onCreateNote: (folderId: string) => void;
  onCreateFolder: (parentId: string, label: string) => void;
  onRenameFolder: (folderId: string, label: string) => void;
  onMoveFolder: (folderId: string) => void;
  onDuplicateFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
}) {
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null);
  const [inline, setInline] = useState<InlineEdit | null>(null);
  const [inlineValue, setInlineValue] = useState('');
  /**
   * Key of the row under the pointer. `onHoverIn` / `onHoverOut` are web-only
   * (they never fire on touch), so this stays null on native.
   */
  const [hovered, setHovered] = useState<string | null>(null);

  const hoverProps = (key: string) => ({
    onHoverIn: () => setHovered(key),
    onHoverOut: () => setHovered((k) => (k === key ? null : k)),
  });

  /**
   * Background for a nav/folder row. Selected wins over pressed, pressed wins
   * over hover, and every level is a theme token — no raw colours.
   */
  const rowBackground = (key: string, active: boolean, pressed: boolean) => {
    if (active) return theme.pillBg;
    if (pressed) return theme.pillBg;
    if (hovered === key) return theme.surface;
    return 'transparent';
  };

  const tree = buildFolderTree(folders);
  const rows = flattenTree(tree);
  const menuFolder = folders.find((f) => f.id === menuFolderId) ?? null;

  const openMenu = (folderId: string, e: AnchorEvent) => {
    e.preventDefault?.();
    setMenuFolderId(folderId);
    setMenuAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
  };

  const startInline = (kind: 'rename' | 'create', folderId: string, initial = '') => {
    setInline({ kind, folderId });
    setInlineValue(initial);
  };

  const submitInline = () => {
    if (!inline) return;
    const label = inlineValue.trim();
    if (label) {
      if (inline.kind === 'rename') onRenameFolder(inline.folderId, label);
      else onCreateFolder(inline.folderId, label);
    }
    setInline(null);
    setInlineValue('');
  };

  const alwaysActions: ContextMenuAction[] = !menuFolder
    ? []
    : [
        { label: 'New Note', iconName: 'note-plus-outline', onPress: () => onCreateNote(menuFolder.id) },
        {
          label: 'New Sub-folder',
          iconName: 'folder-plus-outline',
          onPress: () => startInline('create', menuFolder.id),
        },
      ];

  // FolderRepository refuses to rename, move, duplicate, or delete the root
  // folder. Hide those actions instead of letting them no-op silently.
  const rootGuardActions: ContextMenuAction[] =
    menuFolder && menuFolder.parentId !== null
      ? [
          {
            label: 'Rename',
            iconName: 'pencil-outline',
            onPress: () => startInline('rename', menuFolder.id, menuFolder.label),
          },
          { label: 'Move to…', iconName: 'file-move-outline', onPress: () => onMoveFolder(menuFolder.id) },
          { label: 'Duplicate', iconName: 'content-copy', onPress: () => onDuplicateFolder(menuFolder.id) },
          {
            label: 'Delete Folder',
            iconName: 'trash-can-outline',
            destructive: true,
            onPress: () => onDeleteFolder(menuFolder.id),
          },
        ]
      : [];

  const menuActions: ContextMenuAction[] = [...alwaysActions, ...rootGuardActions];

  const subfolderCount = (folderId: string) =>
    folders.filter((f) => f.parentId === folderId).length;

  return (
    <View style={[styles.sidebar, { backgroundColor: theme.sidebarBg, borderRightColor: theme.border }]}>
      {/* Brand + collapse toggle */}
      <View style={styles.header}>
        <Text style={[styles.brand, { color: theme.text }]}>Simplicity</Text>
        <Pressable
          onPress={onToggle}
          accessibilityLabel="Toggle sidebar"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          {...hoverProps('toggle')}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: pressed || hovered === 'toggle' ? theme.pillBg : 'transparent' },
          ]}
        >
          <MaterialCommunityIcons name="chevron-left" size={16} color={theme.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ gap: 4, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Navigation */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Workspace</Text>
          {NAV_ITEMS.map((item) => {
            const active = activeNav === item.key;
            const key = `nav:${item.key}`;
            return (
              <Pressable
                key={item.key}
                onPress={() => onSelectNav(item.key)}
                {...hoverProps(key)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: rowBackground(key, active, pressed) },
                ]}
                accessibilityLabel={item.label}
              >
                {active ? <View style={[styles.activeBar, { backgroundColor: theme.accent }]} /> : null}
                <MaterialCommunityIcons
                  name={item.iconName}
                  size={16}
                  color={active ? theme.accent : theme.textMuted}
                />
                <Text
                  style={{
                    color: active ? theme.text : theme.textMuted,
                    ...(active ? Typography.app.bodyStrong : Typography.app.body),
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Folder tree */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Folders</Text>
          {rows.map(({ node, depth }) => {
            const selected = selectedFolderId === node.id;
            const renaming = inline?.kind === 'rename' && inline.folderId === node.id;
            const creatingChild = inline?.kind === 'create' && inline.folderId === node.id;
            const key = `folder:${node.id}`;
            return (
              <View key={node.id}>
                <Pressable
                  onPress={() => onSelectFolder(node.id)}
                  onLongPress={(e) => openMenu(node.id, e as unknown as AnchorEvent)}
                  {...({ onContextMenu: (e: AnchorEvent) => openMenu(node.id, e) } as Record<string, unknown>)}
                  {...hoverProps(key)}
                  style={({ pressed }) => [
                    styles.row,
                    // 16px step per depth level, from a 12px base gutter.
                    { paddingLeft: 12 + depth * 16, paddingRight: 12 },
                    { backgroundColor: rowBackground(key, selected, pressed) },
                  ]}
                  accessibilityLabel={node.label}
                >
                  {selected ? <View style={[styles.activeBar, { backgroundColor: theme.accent }]} /> : null}
                  <MaterialCommunityIcons
                    name={node.iconName ?? 'folder-outline'}
                    size={16}
                    color={selected ? theme.accent : theme.textMuted}
                  />
                  {renaming ? (
                    <TextInput
                      value={inlineValue}
                      onChangeText={setInlineValue}
                      autoFocus
                      onSubmitEditing={submitInline}
                      onEndEditing={() => setInline(null)}
                      style={[styles.inlineInput, { color: theme.text, borderColor: theme.accent }]}
                      placeholder="Folder name"
                      placeholderTextColor={theme.textMuted}
                    />
                  ) : (
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                      <Text
                        style={{
                          color: selected ? theme.text : theme.textMuted,
                          ...(selected ? Typography.app.bodyStrong : Typography.app.body),
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {node.label}
                      </Text>
                      <Text style={{ color: theme.textMuted, ...Typography.app.caption, marginLeft: 4 }}>
                        {subfolderCount(node.id)}+{noteCounts[node.id] ?? 0}
                      </Text>
                    </View>
                  )}
                </Pressable>

                {/* Inline "New Sub-folder" input directly under the target parent */}
                {creatingChild ? (
                  <View style={[styles.row, { paddingLeft: 12 + (depth + 1) * 16, paddingRight: 8 }]}>
                    <MaterialCommunityIcons name="folder-plus-outline" size={16} color={theme.accent} />
                    <TextInput
                      value={inlineValue}
                      onChangeText={setInlineValue}
                      autoFocus
                      onSubmitEditing={submitInline}
                      onEndEditing={() => setInline(null)}
                      style={[styles.inlineInput, { color: theme.text, borderColor: theme.accent }]}
                      placeholder="New folder name"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Theme switcher */}
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        {THEME_OPTIONS.map((name) => {
          const active = themeName === name;
          return (
            <Pressable
              key={name}
              onPress={() => onSelectTheme(name)}
              accessibilityLabel={`${name} theme`}
              {...hoverProps(`theme:${name}`)}
              style={[
                styles.themeBtn,
                {
                  backgroundColor: active
                    ? theme.accent
                    : hovered === `theme:${name}`
                      ? theme.surface
                      : 'transparent',
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: active ? theme.accentText : theme.textMuted,
                  ...(active ? Typography.app.captionStrong : Typography.app.caption),
                }}
              >
                {name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ContextMenu
        anchor={menuAnchor}
        actions={menuActions}
        onDismiss={() => setMenuAnchor(null)}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    borderRightWidth: 1,
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  brand: { ...Typography.app.cardHeader },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1, minHeight: 0 },
  section: { gap: 4, paddingHorizontal: 8, paddingTop: 16 },
  sectionLabel: {
    ...Typography.app.captionStrong,
    paddingHorizontal: 8,
    paddingBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  /** 3px accent rail pinned to the leading edge of the active row. */
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: Radius.full,
  },
  inlineInput: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: 8,
    ...Typography.app.body,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  themeBtn: {
    flex: 1,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
  },
});
