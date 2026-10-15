import { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet, PanResponder } from 'react-native';
import { MaterialCommunityIcons } from './shared/icons';
import { Layout, Radius, Typography, THEME_NAMES, type Theme, type ThemeName } from '../theme';
import {
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  type Folder,
  type ScreenKey,
} from '../types';
import { buildFolderTree, flattenTree } from '../hooks/useFolderTree';
import { ContextMenu, type ContextMenuAction } from './shared/ContextMenu';
import { AnimatedPressable } from './shared/motion';
import { SidebarSearch, type SearchResult } from './shared/SidebarSearch';

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


/**
 * One icon that stands for every theme, and cycles them on press.
 *
 * A segmented control in a 240px rail is a lot of chrome for a preference most
 * people change twice a year, and it squeezed its labels. A single button whose
 * glyph *is* the current theme says the same thing in 40px. The full picker
 * still exists in Settings.
 */
const THEME_ICON: Record<ThemeName, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Dark: 'weather-night',
  OLED: 'contrast-circle',
  Light: 'white-balance-sunny',
  'B&W': 'contrast-box',
};

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

/** How far one arrow-key press moves the edge. */
const KEYBOARD_STEP = 16;

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
  width,
  resizable,
  folders,
  onResize,
  onResizeCommit,
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
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSelectSearchResult,
  onCloseSearch,
}: {
  theme: Theme;
  activeNav: ScreenKey;
  themeName: ThemeName;
  /** The dragged width, in points. The rail is this wide. */
  width: number;
  /**
   * Whether the edge can be dragged. False on mobile, where the sidebar is an
   * overlay at a fixed width — there is nothing beside it to make room for.
   */
  resizable: boolean;
  folders: Folder[];
  /** Live drag updates — one call per frame, not persisted. */
  onResize: (width: number) => void;
  /** Called once when the drag ends, to persist. */
  onResizeCommit: (width: number) => void;
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
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: SearchResult[];
  onSelectSearchResult: (result: SearchResult) => void;
  onCloseSearch: () => void;
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
  const [resizing, setResizing] = useState(false);

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
    if (hovered === key) return theme.hoverBg;
    return 'transparent';
  };

  const tree = buildFolderTree(folders);
  const rows = flattenTree(tree);
  const menuFolder = folders.find((f) => f.id === menuFolderId) ?? null;
  const isSearching = searchQuery.trim().length > 0;

  const cycleTheme = () => {
    const next = THEME_NAMES[(THEME_NAMES.indexOf(themeName) + 1) % THEME_NAMES.length];
    if (next) onSelectTheme(next);
  };

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

  /* ---- The resizable edge ---- */

  /**
   * The gesture holds the width at grant time and adds the travel, rather than
   * tracking `dx` against zero: the pointer usually grabs the edge *away* from
   * its exact x, and starting from the live width is what makes the rail follow
   * the finger from wherever it was picked up.
   *
   * The callbacks live in a ref for the reason `useHorizontalSwipe` documents —
   * the responder is built once, so a rebuilt one would swap itself out from
   * under a finger that is still down.
   */
  const latest = useRef({ width, onResize, onResizeCommit });
  latest.current = { width, onResize, onResizeCommit };
  const startWidth = useRef(width);

  const resizePan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 1,
        // Claimed on capture: the rail's own ScrollViews answer to a vertical
        // drag, and without capture the first few pixels are lost to whichever
        // child the pointer happened to land on.
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => {
          startWidth.current = latest.current.width;
          setResizing(true);
        },
        onPanResponderMove: (_e, g) => {
          latest.current.onResize(
            Math.min(
              SIDEBAR_WIDTH_MAX,
              Math.max(SIDEBAR_WIDTH_MIN, startWidth.current + g.dx)
            )
          );
        },
        onPanResponderRelease: () => {
          setResizing(false);
          latest.current.onResizeCommit(latest.current.width);
        },
        onPanResponderTerminate: () => {
          setResizing(false);
          latest.current.onResizeCommit(latest.current.width);
        },
      }),
    []
  );

  /**
   * Arrow keys, because a drag handle with no keyboard route is a control only
   * some people can reach. RNW does not implement `onAccessibilityAction` — the
   * documented gap the reorder handle has — so `onKeyDown` is the web path and
   * the accessibility actions below are the native one.
   */
  const nudge = (delta: number) =>
    latest.current.onResizeCommit(
      Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, latest.current.width + delta))
    );

  const resizeKeyDown = (e: { nativeEvent: { key: string } }) => {
    if (e.nativeEvent.key === 'ArrowLeft') nudge(-KEYBOARD_STEP);
    else if (e.nativeEvent.key === 'ArrowRight') nudge(KEYBOARD_STEP);
  };

  /* ---- Panel sections ---- */

  const navSection = (
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
  );

  const folderSection = (
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
  );

  const scrollProps = {
    keyboardShouldPersistTaps: 'handled' as const,
    showsVerticalScrollIndicator: false,
    showsHorizontalScrollIndicator: false,
    nestedScrollEnabled: true,
  };

  return (
    <View
      style={[styles.sidebar, { width, backgroundColor: theme.sidebarBg, borderRightColor: theme.border }]}
    >
      {/* Brand + collapse toggle. Shares `Layout.headerHeight` with `TopHeader`,
          and used to carry the same bottom border so the two rules met as one
          line. `TopHeader` no longer draws one, and a rule that stops at the
          column edge reads as a broken divider rather than a shorter one — so
          both halves went together. The sidebar's own vertical edge still
          separates the columns. */}
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

      <SidebarSearch
        theme={theme}
        query={searchQuery}
        onQueryChange={onSearchQueryChange}
        results={searchResults}
        onSelectResult={onSelectSearchResult}
        onClose={onCloseSearch}
      />

      {/* While a search is active the nav, the tree and the notes are replaced
          by the results — the field is the navigation until the query is
          cleared. */}
      {isSearching ? (
        <View style={styles.column} />
      ) : (
        <ScrollView style={styles.column} contentContainerStyle={styles.columnContent} {...scrollProps}>
          {navSection}
          {folderSection}
        </ScrollView>
      )}
      {/* One footer row: the Settings entry and a single icon that cycles the
          three themes. Two stacked blocks read as two competing menus in a
          240px rail, and a three-way picker is a lot of chrome for a
          preference that changes twice a year. */}
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <AnimatedPressable
          onPress={() => onSelectNav('Settings')}
          accessibilityLabel="Settings"
          accessibilityRole="button"
          containerStyle={styles.footerBtnContainer}
          style={[
            styles.footerBtn,
            activeNav === 'Settings' && { backgroundColor: theme.pillBg },
          ]}
        >
          <MaterialCommunityIcons
            name="cog-outline"
            size={16}
            color={activeNav === 'Settings' ? theme.accent : theme.textMuted}
          />
        </AnimatedPressable>
        <AnimatedPressable
          onPress={cycleTheme}
          accessibilityLabel={`Theme: ${themeName}. Tap to change.`}
          accessibilityRole="button"
          containerStyle={styles.footerBtnContainer}
          style={styles.footerBtn}
        >
          <MaterialCommunityIcons name={THEME_ICON[themeName]} size={16} color={theme.textMuted} />
        </AnimatedPressable>
      </View>

      {/*
        The edge. `resizable` is false on mobile, where the rail is an overlay
        at a fixed width: there is no column beside it to give space to, so a
        drag handle there would be a control that does nothing visible.

        The line itself is 2px and only takes colour on hover or drag — the
        depth rules put shadow, not outline, between layers, and this is the
        one edge that genuinely is a boundary the user can grab.
      */}
      {resizable ? (
        <View
          {...resizePan.panHandlers}
          {...hoverProps('resize')}
          {...({
            // `onKeyDown` and `tabIndex` are not in React Native's `ViewProps`,
            // but `react-native-web` forwards both to the DOM node — which is
            // where this app is verified. Spread through a cast for the same
            // reason the reorder handle's is: the prop exists, RN's types just
            // predate the platform that accepts it.
            onKeyDown: resizeKeyDown,
            tabIndex: 0,
          } as Record<string, unknown>)}
          accessibilityRole="adjustable"
          accessibilityLabel="Resize sidebar"
          accessibilityValue={{ min: SIDEBAR_WIDTH_MIN, max: SIDEBAR_WIDTH_MAX, now: Math.round(width) }}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') nudge(KEYBOARD_STEP);
            if (e.nativeEvent.actionName === 'decrement') nudge(-KEYBOARD_STEP);
          }}
          style={styles.resizeHandleHit}
        >
          <View
            style={[
              styles.resizeHandleLine,
              {
                backgroundColor:
                  resizing || hovered === 'resize' ? theme.accent : theme.border,
              },
            ]}
          />
        </View>
      ) : null}

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
    height: Layout.headerHeight,
    borderBottomWidth: 0,
  },
  brand: { ...Typography.app.cardHeader },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * Folders and notes as two slots.
   *
   * `flex: 1` on each with `minWidth: 0` is what makes them split the rail at
   * all: a column's width is content-sized by default, and the notes list is
   * longer than the tree, so without the explicit basis one of them would take
   * everything and push the other off the rail.
   */
  column: { flex: 1, minWidth: 0 },
  columnContent: { paddingBottom: 16 },
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
  /** Single 48px row holding the settings entry and the theme picker. */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 64,
    paddingHorizontal: 8,
    borderTopWidth: 1,
  },
  footerBtnContainer: { borderRadius: Radius.md },
  footerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  /**
   * The handle's hit area is 14px but its line is 2px. A 14px grab strip is
   * roughly a fingertip wide; a 2px line is all you can see. Painting the whole
   * 14px would put a slab down the rail's edge on every screen.
   */
  resizeHandleHit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: -7,
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resizeHandleLine: { width: 2, height: '100%', borderRadius: Radius.full },
});
