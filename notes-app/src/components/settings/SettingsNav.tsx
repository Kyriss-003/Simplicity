import { useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import { SETTINGS_SECTIONS, type SettingsSection } from '../../types';
import { AnimatedPressable } from '../shared/motion';
import { SettingsGroup, SettingsRow } from './SettingsRow';

/** Metadata for each Settings section, in rail order. */
export const SETTINGS_NAV: Record<
  SettingsSection,
  { label: string; title: string; subtitle: string; iconName: keyof typeof MaterialCommunityIcons.glyphMap }
> = {
  accounts: {
    label: 'Accounts',
    title: 'Accounts',
    subtitle: 'Where your notes live, and how to take them with you',
    iconName: 'account-circle-outline',
  },
  general: {
    label: 'General',
    title: 'General',
    subtitle: 'How the app behaves day to day',
    iconName: 'tune-variant',
  },
  preference: {
    label: 'Preference',
    title: 'Preference',
    subtitle: 'Choose how Simplicity looks and what the dashboard shows',
    iconName: 'palette-outline',
  },
  shortcuts: {
    label: 'Shortcuts',
    title: 'Shortcuts',
    subtitle: 'Everything you can do from the keyboard',
    iconName: 'keyboard-outline',
  },
  help: {
    label: 'Get help',
    title: 'Get help',
    subtitle: 'Known limits, and details to include in a bug report',
    iconName: 'lifebuoy',
  },
};

/**
 * The Settings navigation, in the two shapes it has.
 *
 * Wide: a vertical rail beside the content, where the section and its content
 * are visible at the same time — switching is a glance, not a navigation.
 *
 * Narrow: a **vertical list that navigates**. A horizontal chip row was tried
 * and is wrong on a phone for two reasons: five chips at 12px are a strip of
 * unreadable labels that the thumb has to cross to reach the last one, and a
 * chip row *swaps* content in place, so a tap has no destination and back has
 * nowhere to go. A list gives each section a real target, a description saying
 * what is in it, and somewhere to go back *to* — which is what makes the screen
 * navigable by touch at all.
 */
export function SettingsNav({
  theme,
  active,
  onSelect,
  isNarrow,
}: {
  theme: Theme;
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
  isNarrow: boolean;
}) {
  const [query, setQuery] = useState('');
  const items = SETTINGS_SECTIONS.map((section) => ({ section, ...SETTINGS_NAV[section] }));

  /**
   * Matches the subtitle as well as the label, even though the rows no longer
   * *show* it: "keyboard" has to find Shortcuts and "bug" has to find Get help,
   * or the search silently misses the words the copy is actually written in.
   */
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(needle) ||
          item.subtitle.toLowerCase().includes(needle)
      )
    : items;

  const search = (
    <SettingsSearch theme={theme} value={query} onChange={setQuery} />
  );
  const empty = (
    <Text style={[styles.empty, { color: theme.textMuted }]}>
      {needle ? `Nothing matches “${query.trim()}”.` : ''}
    </Text>
  );
  if (isNarrow) {
    return (
      <View style={styles.list}>
        {search}
        {/* The group is not rendered at all when nothing matches: an empty
            raised card is a hairline box with no content, which reads as a
            broken layout rather than as "no results". */}
        {visible.length > 0 ? (
          <SettingsGroup theme={theme} title="Sections">
            {visible.map((item, index) => (
            <View
              key={item.section}
              style={[
                styles.listRow,
                index < items.length - 1 && {
                  borderBottomColor: surfaceTheme(theme).border,
                  borderBottomWidth: 1,
                },
              ]}
            >
              {/* The icon sits left of the row rather than in its `control` slot:
                  `control` is right-aligned and reserved for the value or the
                  chevron, and a leading glyph has to lead. */}
              <MaterialCommunityIcons
                name={item.iconName}
                size={20}
                color={surfaceTheme(theme).textMuted}
              />
              <View style={styles.listRowText}>
                <SettingsRow
                  theme={theme}
                  title={item.label}
                  // No description. Five of them stacked read as a paragraph the
                  // user has to parse before they can choose, and the section
                  // they open says what it is anyway — the subtitle is the pane
                  // heading. The row is title, icon and chevron, and nothing else.
                  // The subtitle stays in the accessibility label, so the detail
                  // is still announced to a screen reader.
                  isLast
                  onPress={() => onSelect(item.section)}
                  accessibilityLabel={`${item.label}. ${item.subtitle}`}
                  control={
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={surfaceTheme(theme).textMuted}
                    />
                  }
                />
              </View>
            </View>
            ))}
          </SettingsGroup>
        ) : null}
        {visible.length === 0 ? empty : null}
      </View>
    );
  }

  return (
    <View style={[styles.rail, { borderRightColor: theme.border }]}>
      {search}
      <Text style={[styles.railLabel, { color: theme.textMuted }]}>Settings</Text>
      {visible.map((item) => {
        const isActive = item.section === active;
        return (
          <AnimatedPressable
            key={item.section}
            onPress={() => onSelect(item.section)}
            containerStyle={styles.railItemContainer}
            style={[
              styles.railItem,
              isActive && { backgroundColor: theme.pillBg },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <MaterialCommunityIcons
              name={item.iconName}
              size={16}
              color={isActive ? theme.accent : theme.textMuted}
            />
            <Text
              style={[
                isActive ? Typography.app.bodyStrong : Typography.app.body,
                { color: isActive ? theme.text : theme.textMuted },
              ]}
            >
              {item.label}
            </Text>
          </AnimatedPressable>
        );
      })}
      {visible.length === 0 ? empty : null}
    </View>
  );
}

/**
 * The settings search field. Presentational — the query and the handler belong to
 * `SettingsNav`, which owns the filtered list.
 *
 * Sits on the canvas in both layouts, so it takes the canvas ink, and the clear
 * button only appears once there is something to clear: a permanent × on an
 * empty field is a control that does nothing.
 */
function SettingsSearch({
  theme,
  value,
  onChange,
}: {
  theme: Theme;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <MaterialCommunityIcons name="magnify" size={18} color={theme.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search settings"
        placeholderTextColor={theme.textMuted}
        style={[styles.searchInput, { color: theme.text }]}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel="Search settings"
        clearButtonMode="never"
      />
      {value.length > 0 ? (
        <AnimatedPressable
          onPress={() => onChange('')}
          containerStyle={styles.searchClear}
          style={styles.searchClear}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
        >
          <MaterialCommunityIcons name="close-circle" size={16} color={theme.textMuted} />
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Rounded field, drawn on the canvas so it reads as an input in both layouts. */
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    // `Radius.card`, not `Radius.md`: at 8 on a 40px-tall field the corners read
    // as almost square — it looks like a bordered rectangle rather than a field.
    // `Radius.full` is one step further, if it should be a pill.
    borderRadius: Radius.card,
    borderWidth: 1,
    // Its own bottom margin rather than a gap on the parent: the rail stacks
    // label and rows with `gap: 4` and would otherwise inherit that spacing.
    marginBottom: 16,
  },
  searchInput: { ...Typography.app.body, flex: 1, minWidth: 0, paddingVertical: 0 },
  searchClear: { borderRadius: Radius.full },
  empty: { ...Typography.app.caption, paddingHorizontal: 4, paddingTop: 8 },
  /** Vertical list: the narrow layout's whole navigation, full-bleed scrollable. */
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  /** Icon leads the row; `alignSelf` centres it against the title *and* description. */
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listRowText: { flex: 1, minWidth: 0 },
  rail: {
    width: 200,
    paddingHorizontal: 8,
    paddingTop: 16,
    gap: 4,
    borderRightWidth: 1,
  },
  railLabel: {
    ...Typography.app.captionStrong,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  railItemContainer: { borderRadius: Radius.md },
  /** The exit sits above the section list, separated by the rail's own label. */
  railExit: { marginBottom: 12 },
  railItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
  },
});
