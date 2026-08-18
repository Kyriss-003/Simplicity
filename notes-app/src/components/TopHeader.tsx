import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '../theme';

/**
 * Top header bar: hamburger toggle (shown only while the sidebar is closed —
 * when open, the hamburger lives inside the sidebar header) plus the dynamic
 * greeting/date (rendered only on the Overview screen). Creation actions
 * live in the floating action button.
 */
export function TopHeader({
  theme,
  isMobile,
  userName,
  greetingText,
  dateText,
  showGreeting,
  showSidebarToggle,
  onToggleSidebar,
}: {
  theme: Theme;
  isMobile: boolean;
  userName: string;
  greetingText: string;
  dateText: string;
  showGreeting: boolean;
  showSidebarToggle: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <View
      style={[
        styles.container,
        { borderBottomColor: theme.border, backgroundColor: theme.background },
      ]}
    >
      {/* Left: hamburger (sidebar closed) + greeting */}
      <View style={styles.left}>
        {showSidebarToggle ? (
          <TouchableOpacity
            onPress={onToggleSidebar}
            style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            accessibilityLabel="Open sidebar"
            hitSlop={8}
          >
            <Ionicons name="menu" size={20} color={theme.text} />
          </TouchableOpacity>
        ) : null}
        {showGreeting ? (
          <View style={styles.greetingWrap}>
            <Text style={[styles.greeting, { color: theme.text }]} numberOfLines={1}>
              {greetingText}, {userName}
            </Text>
            <Text style={[styles.dateLine, { color: theme.textMuted }]} numberOfLines={1}>
              {dateText}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Right: search icon (mobile) */}
      {isMobile ? (
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: 'transparent', borderColor: 'transparent' }]}
          accessibilityLabel="Search"
        >
          <Ionicons name="search" size={20} color={theme.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexShrink: 0,
  },
  greetingWrap: { flex: 1, minWidth: 0 },
  greeting: { fontSize: 24, fontWeight: '600' },
  dateLine: { fontSize: 12, marginTop: 4 },
});
