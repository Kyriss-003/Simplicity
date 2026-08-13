import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Theme } from '../../theme';

/**
 * Section header with a title on the left and optional tab pills + trailing
 * content on the right. The tab row uses strict flex layout to prevent
 * overlap on narrow viewports.
 */
export function SectionHeader({
  theme,
  title,
  tabs,
  activeTab,
  onTab,
  trailing,
}: {
  theme: Theme;
  title: string;
  tabs?: readonly string[];
  activeTab?: string;
  onTab?: (t: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <View style={styles.right}>
        {trailing}
        {tabs && onTab ? (
          <View style={styles.tabs}>
            {tabs.map((t) => {
              const active = t === activeTab;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => onTab(t)}
                  activeOpacity={0.7}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: active ? theme.pillBg : 'transparent',
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? theme.text : theme.textMuted,
                      fontSize: 11,
                      fontWeight: '600',
                    }}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  title: { fontSize: 15, fontWeight: '700', flexShrink: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
});
