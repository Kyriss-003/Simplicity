import { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Theme, ThemeName } from '../theme';
import type { ScreenKey } from './CapsuleSwitcher';
import type { Folder } from '../db/FolderRepository';
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

  const menuActions: ContextMenuAction[] = !menuFolder
    ? []
    : [
        { label: 'New Note', iconName: 'note-plus-outline', onPress: () => onCreateNote(menuFolder.id) },
        {
          label: 'New Sub-folder',
          iconName: 'folder-plus-outline',
          onPress: () => startInline('create', menuFolder.id),
        },
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
      ];

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
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: pressed ? theme.pillBg : 'transparent' },
          ]}
        >
          <MaterialCommunityIcons name="chevron-left" size={16} color={theme.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ gap: 2, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {/* Navigation */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Workspace</Text>
          {NAV_ITEMS.map((item) => {
            const active = activeNav === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => onSelectNav(item.key)}
                style={({ pressed }) => [
                  styles.row,
                  { paddingHorizontal: 8 },
                  { backgroundColor: active || pressed ? theme.pillBg : 'transparent' },
                ]}
                accessibilityLabel={item.label}
              >
                <MaterialCommunityIcons
                  name={item.iconName}
                  size={16}
                  color={active ? theme.accent : theme.textMuted}
                />
                <Text
                  style={{
                    color: active ? theme.text : theme.textMuted,
                    fontSize: 14,
                    fontWeight: active ? '600' : '400',
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
            return (
              <View key={node.id}>
                <Pressable
                  onPress={() => onSelectFolder(node.id)}
                  onLongPress={(e) => openMenu(node.id, e as unknown as AnchorEvent)}
                  {...({ onContextMenu: (e: AnchorEvent) => openMenu(node.id, e) } as Record<string, unknown>)}
                  style={({ pressed }) => [
                    styles.row,
                    { paddingLeft: 12 + depth * 16, paddingRight: 8 },
                    { backgroundColor: selected || pressed ? theme.pillBg : 'transparent' },
                  ]}
                  accessibilityLabel={node.label}
                >
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
                          fontSize: 14,
                          fontWeight: selected ? '600' : '400',
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {node.label}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 12, marginLeft: 4 }}>
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
              style={[
                styles.themeBtn,
                { backgroundColor: active ? theme.accent : 'transparent', borderColor: theme.border },
              ]}
            >
              <Text
                style={{
                  color: active ? theme.accentText : theme.textMuted,
                  fontSize: 12,
                  fontWeight: active ? '600' : '400',
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
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  brand: { fontSize: 18, fontWeight: '600' },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1, minHeight: 0 },
  section: { gap: 2, paddingHorizontal: 8, paddingTop: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    borderRadius: 8,
  },
  inlineInput: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 14,
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
    borderRadius: 999,
    borderWidth: 1,
  },
});
