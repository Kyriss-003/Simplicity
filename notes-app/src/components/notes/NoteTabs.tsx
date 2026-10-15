import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '../shared/icons';
import { AnimatedPressable } from '../shared/motion';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';

/** One open note. Ids, not notes — the note itself is read from the store. */
export interface NoteTab {
  id: number;
  title: string;
}

/** Height of the strip and of every tab in it. They match on purpose — see below. */
const STRIP_HEIGHT = 40;

/** Fixed tab width keeps the close control in the same place in every tab. */
const TAB_WIDTH = 180;

/**
 * The tab header above the editor, shaped after Obsidian's tab bar.
 *
 * **The active tab is painted in the canvas colour and sits flush with the
 * strip's lower edge, so it continues into the pane it selects.** That is the
 * whole idea of the shape: the bar is one step off the content, the selected tab
 * is a notch cut back out to the content colour, and because it reaches the
 * bottom there is nothing to draw between it and the editor. It reads as one
 * surface rather than as a control floating above a different one — which is
 * also why this strip carries **no bottom rule**. A rule would put a line
 * straight across the tab it is meant to merge with.
 *
 * The two heights are therefore one value: a tab 2px shorter than its strip
 * leaves a 2px ledge of bar colour under the selected tab, and that ledge is
 * exactly the gap the merge is trying to remove.
 *
 * Tabs have a fixed width rather than sizing themselves to their titles. The
 * close control therefore has one predictable position in every tab, and long
 * titles truncate into the same reserved space instead of pushing the close
 * affordance around.
 *
 * The `+` rides immediately after the last tab, inside the scroller, for the
 * same reason: it is the next tab, so it belongs beside the tabs rather than
 * parked at the far edge of the window.
 */
export function NoteTabs({
  theme,
  tabs,
  activeId,
  onSelect,
  onClose,
  onNewTab,
  onStepBack,
  onStepForward,
  onToggleSidebar,
}: {
  theme: Theme;
  tabs: NoteTab[];
  /** The note the editor is showing, or null when none is. */
  activeId: number | null;
  onSelect: (id: number) => void;
  onClose: (id: number) => void;
  /** Open a new note in a new tab. */
  onNewTab: () => void;
  /** Step one tab back. Omitted at the start of the strip — see below. */
  onStepBack?: () => void;
  /** Step one tab forward. Omitted at the end of the strip. */
  onStepForward?: () => void;
  onToggleSidebar?: () => void;
}) {
  // The strip is a surface, so everything drawn on it takes the surface ink.
  const ink = surfaceTheme(theme);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <View style={[styles.strip, { backgroundColor: theme.surface }]}>
      {onToggleSidebar ? (
        <AnimatedPressable
          onPress={onToggleSidebar}
          style={styles.sidebarToggle}
          accessibilityRole="button"
          accessibilityLabel="Open sidebar"
          hitSlop={8}
        >
          <Ionicons name="menu" size={20} color={ink.text} />
        </AnimatedPressable>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          const hoveredTab = hovered === tab.id && !active;
          return (
            <AnimatedPressable
              key={tab.id}
              onPress={() => onSelect(tab.id)}
              onHoverIn={() => setHovered(tab.id)}
              onHoverOut={() => setHovered(null)}
              style={[
                styles.tab,
                // The merge: the selected tab is cut back to the canvas, and the
                // top corners are the only rounding left on it.
                active && styles.tabActive,
                {
                  backgroundColor: active
                    ? theme.background
                    : hoveredTab
                      ? ink.pillBg
                      : 'transparent',
                },
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.title}
            >
              <Text
                style={[
                  styles.title,
                  { color: active ? ink.text : ink.textMuted },
                  active && Typography.app.bodyStrong,
                ]}
                numberOfLines={1}
              >
                {tab.title}
              </Text>

              {/* A separate press target so closing never selects: one tap,
                  one meaning. `onPress` on the tab body and a nested ✕ would
                  fire both. Always visible, because a close affordance that
                  only appears on hover is undiscoverable with a thumb. */}
              <AnimatedPressable
                onPress={() => onClose(tab.id)}
                containerStyle={styles.closePosition}
                style={styles.close}
                accessibilityRole="button"
                accessibilityLabel={`Close ${tab.title}`}
                hitSlop={6}
              >
                <Ionicons name="close" size={14} color={ink.textMuted} />
              </AnimatedPressable>
            </AnimatedPressable>
          );
        })}
        {/* The next tab. Rides at the end of the strip, after the last tab,
            inside the scroller so it scrolls with the tabs. */}
        <AnimatedPressable
          onPress={onNewTab}
          style={styles.addTab}
          accessibilityRole="button"
          accessibilityLabel="New note in a new tab"
          hitSlop={6}
        >
          <MaterialCommunityIcons name="plus" size={18} color={ink.textMuted} />
        </AnimatedPressable>
      </ScrollView>
      {/* The two step buttons, pinned to the strip's right edge, outside the
          scroller so they never scroll away with the tabs. Disabled at the
          ends rather than wrapping — see `NotesView`'s `canStepBack`. */}
      <View style={styles.stepGroup}>
        <AnimatedPressable
          onPress={onStepBack}
          disabled={!onStepBack}
          style={styles.stepBtn}
          accessibilityRole="button"
          accessibilityLabel="Previous note"
          accessibilityState={{ disabled: !onStepBack }}
          hitSlop={6}
        >
          <Ionicons name="chevron-back" size={16} color={ink.textMuted} />
        </AnimatedPressable>
        <AnimatedPressable
          onPress={onStepForward}
          disabled={!onStepForward}
          style={styles.stepBtn}
          accessibilityRole="button"
          accessibilityLabel="Next note"
          accessibilityState={{ disabled: !onStepForward }}
          hitSlop={6}
        >
          <Ionicons name="chevron-forward" size={16} color={ink.textMuted} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    // `flex-end` so the tabs sit on the strip's lower edge, which is the edge
    // they merge across.
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: STRIP_HEIGHT,
    // No bottom rule: it would cut straight across the selected tab.
  },
  scroller: { flex: 1 },
  sidebarToggle: {
    width: 48,
    height: STRIP_HEIGHT,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
    /**
     * The two step buttons, pinned to the strip's right edge.
     *
     * `flexShrink: 0` so they cannot be squeezed by a long tab, and outside the
     * scroller so they never scroll away with the tabs.
     */
    stepGroup: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: STRIP_HEIGHT,
      flexShrink: 0,
      gap: 4,
      paddingRight: 8,
    },
    stepBtn: {
      width: 28,
      height: STRIP_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopRightRadius: Radius.md,
    },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingHorizontal: 8 },
  /**
   * Content-sized with a floor, capped rather than stretched. `flexShrink: 0`
   * keeps a long title from squeezing its neighbours before the cap is reached.
   */
  tab: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    height: STRIP_HEIGHT,
    width: TAB_WIDTH,
    flexShrink: 0,
    paddingLeft: 14,
    paddingRight: 40,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
  },
  /** The cut-back notch: canvas fill, top corners only, no lower border. */
  tabActive: {
    borderBottomWidth: 0,
  },
  title: { ...Typography.app.body, flexShrink: 1, width: '100%' },
  /** Position on the wrapper: AnimatedPressable's inner pressable has no layout. */
  closePosition: { position: 'absolute', right: 8, top: 8 },
  close: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  /**
   * The next tab. A narrow glyph beside the tabs rather than a full-width
   * sibling: Obsidian puts it immediately after the last tab and it reads as
   * "and one more", not as another note that is already open. `flexShrink: 0`
   * keeps it from being squeezed off the end of the strip.
   */
  addTab: {
    width: 40,
    height: STRIP_HEIGHT,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
  },
});
