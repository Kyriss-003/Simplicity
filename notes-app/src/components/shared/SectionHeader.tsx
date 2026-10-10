import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { Radius, Typography, type Theme } from '../../theme';
import { AnimatedPressable, useSlidingPill } from './motion';

/**
 * Section header with a title on the left and optional tab pills + trailing
 * content on the right. A single pill slides between the tabs rather than each
 * tab popping its own background on and off, which is what makes the switch
 * read as one control moving.
 *
 * `DashboardSection`'s `gap` supplies the space under this row; the header used
 * to carry its own `marginBottom` on top of that, so every section paid for the
 * gap twice.
 */
export function SectionHeader({
  theme,
  title,
  tabs,
  activeTab,
  onTab,
  trailing,
  hidden = false,
}: {
  theme: Theme;
  title: string;
  tabs?: readonly string[];
  activeTab?: string;
  onTab?: (t: string) => void;
  trailing?: React.ReactNode;
  /**
   * Hide the heading. A header that carries tabs keeps them — only the
   * title goes — and a header with neither collapses to nothing, so the
   * card below expands into the layout space the heading occupied.
   */
  hidden?: boolean;
}) {
  // `styles.tabs` has no padding, so an item's reported x is already relative
  // to the pill's own origin.
  const { style: pillStyle, measure } = useSlidingPill(activeTab ?? '');

  // No title and no tabs: there is nothing left to render, and the
  // section is the card on its own.
  if (hidden && !tabs) return null;

  return (
    <View style={styles.row}>
      {hidden ? null : (
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      )}
      <View style={styles.right}>
        {trailing}
        {tabs && onTab ? (
          <View style={styles.tabs}>
            {activeTab ? (
              <Animated.View
                style={[
                  styles.pill,
                  // RN 0.86 deprecated the `pointerEvents` prop; it lives in style.
                  styles.pillPassthrough,
                  { backgroundColor: theme.pillBg },
                  pillStyle,
                ]}
              />
            ) : null}
            {tabs.map((t) => {
              const active = t === activeTab;
              return (
                // The measured node is this plain `View`, not the pressable.
                // `AnimatedPressable` puts its own wrapper between the pressable
                // and this row, so a pressable-level `onLayout` reports `x: 0`
                // for every tab — the pill then tracks only the width and stays
                // parked on the first tab. A plain `View` is the row's real flex
                // child, so its `x` is measured from the shared row on every
                // platform (Reanimated's `Animated.View` does not deliver
                // `onLayout` on web, which is where this app is verified).
                <View key={t} style={styles.tabSlot} onLayout={(e) => measure(t, e)}>
                  <AnimatedPressable
                    onPress={() => onTab(t)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={styles.tab}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        { color: active ? theme.text : theme.textMuted },
                        // The weight has to be part of the active check. Applying
                        // `captionStrong` to every tab left the *inactive* label
                        // bold while the pill sat on the active one, so the two
                        // indicators disagreed and the control looked stuck on the
                        // wrong tab.
                        active ? Typography.app.captionStrong : Typography.app.caption,
                      ]}
                    >
                      {t}
                    </Text>
                  </AnimatedPressable>
                </View>
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
    gap: 12,
  },
  title: { ...Typography.app.cardHeader, flexShrink: 0 },
  /**
   * `flexShrink: 0` on both the group and the tab row. The title was allowed to
   * hold its size while this side shrank, and a squeezed tab row *wraps* its
   * labels ("Suggest ed", "W eek") rather than clipping them — which looks broken
   * and leaves a press target half the height it should be. The row can only
   * overflow at a genuinely narrow width, which is the correct place for it to.
   */
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  tabs: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  /**
   * Positioning-only slot for one tab. Carries no box of its own, so the
   * pressable inside still shrink-wraps to the label and the measured `x`
   * matches where the pill must land.
   */
  tabSlot: { flexShrink: 0 },
  /** Absolutely positioned so it can slide behind the tabs it highlights. */
  pill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: Radius.full,
  },
  /** The pill is decoration: taps belong to the tab sitting on top of it. */
  pillPassthrough: { pointerEvents: 'none' },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
