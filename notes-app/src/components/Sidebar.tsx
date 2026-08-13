import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { Theme, ThemeName } from '../theme';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type FolderNode = {
  id: string;
  label: string;
  count?: number;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  children?: FolderNode[];
};

export type NavKey = 'Dashboard' | 'All Notes' | 'Calendar' | 'Tasks' | 'Trash';

interface SidebarProps {
  theme: Theme;
  isSidebarOpen: boolean;
  activeNav: NavKey;
  themeName: ThemeName;
  onToggle: () => void;
  onSelectNav: (key: NavKey) => void;
  onSelectTheme: (name: ThemeName) => void;
}

/* ------------------------------------------------------------------ */
/* Folder tree data — Apple Notes / Bear style hierarchy               */
/* ------------------------------------------------------------------ */

const FOLDER_TREE: FolderNode[] = [
  { id: 'shortcuts', label: 'Shortcuts', iconName: 'star-outline' },
  { id: 'recent', label: 'Recent files', iconName: 'clock-outline' },
  {
    id: 'obsidian-vault',
    label: 'Obsidian Vault',
    iconName: 'folder-outline',
    count: 26,
    children: [
      { id: 'ai-skills', label: 'AI Skills', iconName: 'robot-outline' },
      {
        id: 'ideaverse',
        label: 'Ideaverse',
        iconName: 'lightbulb-outline',
        children: [
          { id: 'atlas', label: 'Atlas', count: 2, iconName: 'map-outline' },
          { id: 'calendar', label: 'Calendar', iconName: 'calendar-month-outline' },
          {
            id: 'efforts',
            label: 'Efforts',
            count: 5,
            iconName: 'flag-outline',
            children: [
              { id: 'game', label: 'Game', count: 5, iconName: 'gamepad-variant-outline' },
              { id: 'knowledge', label: 'Knowledge', count: 5, iconName: 'book-open-variant' },
              {
                id: 'my-notes',
                label: 'My Notes',
                count: 10,
                iconName: 'note-text-outline',
                children: [
                  { id: 'building', label: 'Building', count: 7, iconName: 'domain' },
                  { id: 'prompting', label: 'Prompting', count: 5, iconName: 'comment-quote-outline' },
                ],
              },
              { id: 'program', label: 'Programs', count: 3, iconName: 'code-braces' },
            ],
          },
        ],
      },
    ],
  },
  { id: 'tags', label: 'Tags', iconName: 'tag-outline' },
];

const QUICK_NAV: Array<{ key: NavKey; label: string; iconName: keyof typeof MaterialCommunityIcons.glyphMap }> = [
  { key: 'Dashboard', label: 'Dashboard', iconName: 'view-dashboard-outline' },
  { key: 'All Notes', label: 'All Notes', iconName: 'note-multiple-outline' },
  { key: 'Calendar', label: 'Calendar', iconName: 'calendar-outline' },
  { key: 'Tasks', label: 'Tasks', iconName: 'checkbox-marked-outline' },
];

const THEME_OPTIONS: ThemeName[] = ['Dark', 'OLED', 'Light'];

/* ------------------------------------------------------------------ */
/* Folder row — strict flex row prevents icon/label collision          */
/* ------------------------------------------------------------------ */

function FolderRow({
  node,
  depth,
  theme,
  isExpanded,
  onToggle,
  onSelect,
  isSelected,
}: {
  node: FolderNode;
  depth: number;
  theme: Theme;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const hasChildren = !!node.children?.length;
  return (
    <TouchableOpacity
      onPress={hasChildren ? onToggle : onSelect}
      activeOpacity={0.7}
      style={[
        styles.row,
        { paddingLeft: 12 + depth * 16 },
        isSelected && { backgroundColor: theme.pillBg },
      ]}
    >
      {/* fixed-size chevron container */}
      <View style={styles.chevronBox}>
        {hasChildren ? (
          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
            size={12}
            color={theme.textMuted}
          />
        ) : null}
      </View>
      {/* fixed-size icon container */}
      <View style={styles.iconBox}>
        <MaterialCommunityIcons
          name={node.iconName ?? 'folder-outline'}
          size={15}
          color={isSelected ? theme.text : theme.textMuted}
        />
      </View>
      {/* flex:1 label wrap prevents overflow */}
      <View style={styles.labelWrap}>
        <Text
          style={[
            styles.rowLabel,
            { color: isSelected ? theme.text : theme.textMuted },
            isSelected && { fontWeight: '600' },
          ]}
          numberOfLines={1}
        >
          {node.label}
        </Text>
      </View>
      {typeof node.count === 'number' ? (
        <View style={[styles.countPill, { backgroundColor: theme.background }]}>
          <Text style={[styles.countText, { color: theme.textMuted }]}>{node.count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function FolderTree({
  theme,
  selectedId,
  onSelect,
  searchQuery,
}: {
  theme: Theme;
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'obsidian-vault': true,
    ideaverse: true,
    efforts: true,
    'my-notes': true,
  });

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const matches = (node: FolderNode): boolean =>
    node.label.toLowerCase().includes(searchQuery.toLowerCase());

  const renderNodes = (nodes: FolderNode[], depth = 0): React.ReactNode =>
    nodes
      .filter((node) => {
        if (!searchQuery) return true;
        // show node if it or any descendant matches
        const hasMatch = (n: FolderNode): boolean =>
          matches(n) || (n.children?.some(hasMatch) ?? false);
        return hasMatch(node);
      })
      .map((node) => {
        const isExpanded = !!expanded[node.id] || (!!searchQuery && !!node.children?.length);
        const hasChildren = !!node.children?.length;
        return (
          <View key={node.id}>
            <FolderRow
              node={node}
              depth={depth}
              theme={theme}
              isExpanded={isExpanded}
              onToggle={() => toggle(node.id)}
              onSelect={() => onSelect(node.id)}
              isSelected={selectedId === node.id}
            />
            {hasChildren && isExpanded ? (
              <View>{renderNodes(node.children!, depth + 1)}</View>
            ) : null}
          </View>
        );
      });

  return <View style={{ paddingVertical: 4 }}>{renderNodes(FOLDER_TREE)}</View>;
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

export default function Sidebar({
  theme,
  isSidebarOpen,
  activeNav,
  themeName,
  onToggle,
  onSelectNav,
  onSelectTheme,
}: SidebarProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>('my-notes');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isSidebarOpen) {
    return <View style={[styles.collapsed, { borderRightColor: theme.border }]} />;
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.sidebarBg, borderRightColor: theme.border },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.logo, { color: theme.text }]}>Simplicity</Text>
        <TouchableOpacity
          onPress={onToggle}
          style={styles.iconBtn}
          accessibilityLabel="Close sidebar"
          hitSlop={8}
        >
          <Ionicons name="close" size={18} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBox, { backgroundColor: theme.pillBg }]}>
          <Ionicons name="search" size={14} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search folders"
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={15} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Scrollable content: folder tree + quick nav */}
      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>FOLDERS</Text>
        <FolderTree
          theme={theme}
          selectedId={selectedFolder}
          onSelect={setSelectedFolder}
          searchQuery={searchQuery}
        />

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>QUICK NAV</Text>
        <View style={{ gap: 2 }}>
          {QUICK_NAV.map((item) => {
            const active = item.key === activeNav;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => onSelectNav(item.key)}
                style={[styles.navItem, active && { backgroundColor: theme.pillBg }]}
                activeOpacity={0.7}
              >
                <View style={styles.navIconBox}>
                  <MaterialCommunityIcons
                    name={item.iconName}
                    size={16}
                    color={active ? theme.text : theme.textMuted}
                  />
                </View>
                <Text
                  style={{
                    color: active ? theme.text : theme.textMuted,
                    fontSize: 13,
                    fontWeight: active ? '600' : '400',
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer: theme switcher */}
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <View style={styles.footerTop}>
          <Text style={[styles.footerLabel, { color: theme.textMuted }]}>THEME</Text>
          <TouchableOpacity
            onPress={() => {
              const idx = THEME_OPTIONS.indexOf(themeName);
              onSelectTheme(THEME_OPTIONS[(idx + 1) % THEME_OPTIONS.length]);
            }}
            style={[
              styles.moonBtn,
              { backgroundColor: theme.pillBg, borderColor: theme.border },
            ]}
            accessibilityLabel="Toggle theme"
          >
            <MaterialCommunityIcons
              name={themeName === 'Light' ? 'weather-sunny' : 'moon-waning-crescent'}
              size={15}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>
        <View style={[styles.themeSwitcher, { backgroundColor: theme.pillBg }]}>
          {THEME_OPTIONS.map((opt) => {
            const active = opt === themeName;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => onSelectTheme(opt)}
                style={[styles.themeOption, active && { backgroundColor: theme.accent }]}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    color: active ? theme.accentText : theme.textMuted,
                    fontSize: 11,
                    fontWeight: '600',
                  }}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const SIDEBAR_WIDTH = 240;

const styles = StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    borderRightWidth: 1,
    overflow: 'hidden',
  },
  collapsed: { width: 0, borderRightWidth: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  logo: { fontSize: 17, fontWeight: '700' },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  searchWrap: { paddingHorizontal: 12, paddingTop: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  searchIcon: { flexShrink: 0 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0, minWidth: 0 },
  nav: { flex: 1, paddingTop: 8 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  // folder rows — strict flex row prevents overlap
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingRight: 10,
    borderRadius: 6,
    marginHorizontal: 6,
    gap: 6,
  },
  chevronBox: { width: 14, flexShrink: 0, alignItems: 'center' },
  iconBox: { width: 18, flexShrink: 0, alignItems: 'center' },
  labelWrap: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 13 },
  countPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    flexShrink: 0,
  },
  countText: { fontSize: 11, fontWeight: '600' },
  divider: { height: 1, marginVertical: 10, marginHorizontal: 12 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    marginHorizontal: 8,
    gap: 10,
  },
  navIconBox: { width: 20, flexShrink: 0, alignItems: 'center' },
  footer: { padding: 12, borderTopWidth: 1, gap: 10 },
  footerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  moonBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeSwitcher: { flexDirection: 'row', borderRadius: 8, padding: 2 },
  themeOption: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
});
