import { Platform, Text, View, StyleSheet } from 'react-native';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import { SettingsGroup } from './SettingsRow';

interface Shortcut {
  keys: string;
  description: string;
}

/**
 * Only shortcuts the app actually implements.
 *
 * A shortcut list is the easiest place in a settings page to ship fiction — a
 * row that looks real and does nothing is worse than an empty section. Every
 * entry here was checked against the code, and anything that is a plain browser
 * or platform behaviour rather than an app feature is labelled as such.
 */
const SHORTCUTS: Shortcut[] = [
  { keys: 'Ctrl / ⌘ K', description: 'Focus the sidebar search field.' },
  { keys: 'Esc', description: 'Clear the search, or close an open menu.' },
  { keys: 'Right-click', description: 'Open a note’s actions from its card.' },
  { keys: 'Long-press', description: 'The same note actions, on a touch screen.' },
  { keys: '↑ ↓', description: 'Move through the items of an open menu.' },
  { keys: 'Enter', description: 'Choose the focused menu item, or commit a rename.' },
];

/** A keyboard key cap, for the shortcut list. */
function Key({ theme, children }: { theme: Theme; children: string }) {
  return (
    <View style={[styles.key, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <Text style={[styles.keyText, { color: theme.text }]}>{children}</Text>
    </View>
  );
}

export function ShortcutsSection({ theme }: { theme: Theme }) {
  // Rows and the footnote sit on the group's card; `Key` below is the exception,
  // because it paints `theme.background` and is therefore a canvas inset.
  const ink = surfaceTheme(theme);

  return (
    <SettingsGroup theme={theme} title="Keyboard">
      {SHORTCUTS.map((shortcut, index) => (
        <View
          key={shortcut.keys}
          style={[
            styles.row,
            index < SHORTCUTS.length - 1 && {
              borderBottomColor: ink.border,
              borderBottomWidth: 1,
            },
          ]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.label, { color: ink.text }]}>{shortcut.description}</Text>
          </View>
          <View style={styles.keys}>
            {shortcut.keys.split(' / ').map((key) => (
              <Key key={key} theme={theme}>
                {key}
              </Key>
            ))}
          </View>
        </View>
      ))}

      <View style={styles.note}>
        <Text style={[styles.noteText, { color: ink.textMuted }]}>
          {`Tab, Shift+Tab and Space are handled by ${
            Platform.OS === 'web' ? 'the browser' : 'the platform'
          } and work on every control, including these rows.`}
        </Text>
      </View>
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  rowText: { flex: 1, minWidth: 0 },
  label: { ...Typography.app.body },
  keys: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  key: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  keyText: { ...Typography.app.captionStrong },
  note: { paddingHorizontal: 4, paddingTop: 8 },
  noteText: { ...Typography.app.caption },
});
