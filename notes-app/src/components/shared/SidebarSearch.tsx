import { useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Typography, type Theme } from '../../theme';
import { AnimatedPressable } from './motion';

export interface SearchResult {
  key: string;
  kind: 'note' | 'folder';
  label: string;
  sublabel: string;
}

/** Results shown before a query is typed. */
const MAX_RESULTS = 6;

function shortcutHint(): string {
  if (Platform.OS === 'ios' || Platform.OS === 'macos') return '⌘K';
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)) {
    return '⌘K';
  }
  return 'Ctrl K';
}

/**
 * Sidebar search: one field, `Ctrl/⌘ K` to focus, results replace the nav
 * content while a query is active.
 *
 * Presentational — the query lives in the orchestrator along with the notes and
 * folders it searches, so this component never imports the store. `onSelectResult`
 * hands the choice back for the shell to act on.
 */
export function SidebarSearch({
  theme,
  query,
  onQueryChange,
  results,
  onSelectResult,
  onClose,
}: {
  theme: Theme;
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const isSearching = query.trim().length > 0;

  // Focus from anywhere in the app. The listener lives on `document` rather than
  // on the sidebar, because the shortcut is meant to work while you are typing
  // in the editor, not only when the field is already visible.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={[styles.field, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <MaterialCommunityIcons name="magnify" size={16} color={theme.textMuted} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text }]}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Escape') onClose();
          }}
          accessibilityLabel="Search notes and folders"
        />
        {isSearching ? (
          <AnimatedPressable
            onPress={onClose}
            containerStyle={styles.badgeContainer}
            style={styles.clearBtn}
            accessibilityLabel="Clear search"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="close" size={14} color={theme.textMuted} />
          </AnimatedPressable>
        ) : (
          <View style={[styles.badge, { borderColor: theme.border }]}>
            <Text style={[styles.badgeText, { color: theme.textMuted }]}>{shortcutHint()}</Text>
          </View>
        )}
      </View>

      {isSearching ? (
        <ScrollView
          style={styles.results}
          contentContainerStyle={{ paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {results.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              No matches for “{query.trim()}”
            </Text>
          ) : (
            results.map((result) => (
              <AnimatedPressable
                key={result.key}
                onPress={() => onSelectResult(result)}
                style={styles.resultRow}
                accessibilityLabel={result.label}
              >
                <MaterialCommunityIcons
                  name={result.kind === 'note' ? 'note-text-outline' : 'folder-outline'}
                  size={16}
                  color={theme.textMuted}
                />
                <View style={styles.resultText}>
                  <Text style={[styles.resultLabel, { color: theme.text }]} numberOfLines={1}>
                    {result.label}
                  </Text>
                  <Text style={[styles.resultSublabel, { color: theme.textMuted }]} numberOfLines={1}>
                    {result.sublabel}
                  </Text>
                </View>
              </AnimatedPressable>
            ))
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

/** Shared so the orchestrator can cap its own result list the same way. */
export const SEARCH_RESULT_LIMIT = MAX_RESULTS;
export const SEARCH_ROW_HEIGHT = 48;

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingTop: 8 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  input: { flex: 1, minWidth: 0, ...Typography.app.caption, paddingVertical: 0 },
  badge: {
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  badgeText: { ...Typography.app.caption },
  badgeContainer: { borderRadius: Radius.full },
  clearBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  results: { maxHeight: SEARCH_ROW_HEIGHT * MAX_RESULTS },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: SEARCH_ROW_HEIGHT,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
  },
  resultText: { flex: 1, minWidth: 0 },
  resultLabel: { ...Typography.app.body },
  resultSublabel: { ...Typography.app.caption },
  empty: { ...Typography.app.caption, paddingHorizontal: 8, paddingVertical: 12 },
});
