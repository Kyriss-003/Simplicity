import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { ComponentRef } from 'react';
import { useCallback, useRef, useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AnimatedPressable } from './shared/motion';
import { ContextMenu, type ContextMenuAction } from './shared/ContextMenu';
import { Layout, Radius, Typography, surfaceTheme, type Theme } from '../theme';

/**
 * The main column's single top bar.
 *
 * It is the alignment partner for the sidebar's brand row: both are
 * `Layout.headerHeight` and both carry a bottom border, so the rule runs
 * unbroken across the column boundary.
 *
 * Every screen's title and controls live here rather than in the screen below.
 * The Notes screen used to draw its *own* "Notes / New" header underneath this
 * one — two headers, two heights, and a strip of dead space on any screen that
 * had nothing to put in it.
 */
export function TopHeader({
  theme,
  isMobile,
  userName,
  greetingText,
  showGreeting,
  showSidebarToggle,
  onBack,
  onToggleSidebar,
  title,
  onToggleList,
  isListCollapsed,
  menuActions,
}: {
  theme: Theme;
  isMobile: boolean;
  userName: string;
  greetingText: string;
  showGreeting: boolean;
  showSidebarToggle: boolean;
  /** When set, renders a back chevron instead of the sidebar toggle. */
  onBack?: () => void;
  onToggleSidebar: () => void;
  /** Screen title for every screen that is not the Overview dashboard. */
  title?: string;
  onToggleList?: () => void;
  isListCollapsed?: boolean;
  /**
   * The three-dot menu's rows. Supplied by the orchestrator and **different per
   * screen** — the same button in the same slot, offering what the page you are
   * on is for. It replaces a search button that rendered here and had no
   * `onPress` at all, which is worse than having neither.
   */
  menuActions?: ContextMenuAction[];
}) {
  // The icon buttons are surfaces; the bar's own text sits on the canvas.
  const ink = surfaceTheme(theme);

  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const menuBtnRef = useRef<ComponentRef<typeof Pressable>>(null);

  /**
   * Anchor the menu under its own button, measured rather than taken from the
   * press event. The event is not a reliable source: `react-native-web`'s
   * synthetic press event has no `locationX`, which is the same gap that made
   * the Agenda's tap-to-create fail — and a menu pinned to the wrong place is
   * worse than a slow one. `AnimatedPressable` forwards its ref to the pressable,
   * so `measureInWindow` works on every platform.
   */
  const openMenu = useCallback(() => {
    menuBtnRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
      setMenuAnchor({ x: x + width / 2, y: y + height });
    });
  }, []);

  const closeMenu = useCallback(() => setMenuAnchor(null), []);

  // The greeting steps down a token on narrow screens rather than taking an
  // arbitrary computed size: the type scale is four sizes and a test pins it.
  // "Good evening, <name>" is the longest string this bar ever holds, and at
  // 24px it truncates on a phone-width column well before it runs out of room.
  const greetingType = isMobile ? Typography.app.cardHeader : Typography.app.pageHeader;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.left}>
        {onBack ? (
          <AnimatedPressable
            onPress={onBack}
            containerStyle={styles.iconBtnContainer}
            style={styles.iconBtn}
            accessibilityLabel="Back"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={ink.text} />
          </AnimatedPressable>
        ) : showSidebarToggle ? (
          <AnimatedPressable
            onPress={onToggleSidebar}
            containerStyle={styles.iconBtnContainer}
            style={styles.iconBtn}
            accessibilityLabel="Open sidebar"
            hitSlop={8}
          >
            <Ionicons name="menu" size={20} color={ink.text} />
          </AnimatedPressable>
        ) : null}

        {/* On the Overview the bar greets you instead of naming the app: this is
            the one screen that is about the person rather than a destination,
            and the wordmark above the dashboard was saying nothing the greeting
            does not. Greeting and date sit left, as they did before the
            wordmark arrived. */}
        {showGreeting ? (
          <View style={styles.textWrap}>
            {/* Two lines, not one. At 360px the greeting is the widest thing the
                bar holds, and `numberOfLines={1}` did not shorten it — it cut
                it, so a longer name lost half of itself with nothing on screen
                to say anything was missing. Two 24px lines fit the 64px bar on
                their own now that the date line is gone, so the greeting wraps
                instead of disappearing. */}
            <Text style={[styles.greeting, greetingType, { color: theme.text }]} numberOfLines={2}>
              {greetingText}, {userName}
            </Text>
          </View>
        ) : null}
      </View>

      {/* The bar is a three-column row — nav, title, actions — with the outer
          columns each taking half the leftover width. That is what makes the
          title *actually* centred: centring it inside whatever space is left
          over looks centred only while the two sides happen to be the same
          width, and they differ the moment a back button appears. */}
      {showGreeting ? null : (
        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.brand, { color: theme.text }]} numberOfLines={1}>
            SIMPLICITY
          </Text>
        </View>
      )}

      {/* Equal flex on both sides is what centres the wordmark — but only when
          the wordmark is there. With the greeting showing, the actions column
          was still claiming half the bar, squeezing the greeting into a third
          of it and clipping the name. */}
      <View style={showGreeting ? styles.rightContent : styles.right}>
        {onToggleList ? (
          <AnimatedPressable
            onPress={onToggleList}
            containerStyle={styles.iconBtnContainer}
            style={styles.iconBtn}
            accessibilityLabel={isListCollapsed ? 'Show note list' : 'Hide note list'}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name={isListCollapsed ? 'chevron-double-right' : 'chevron-double-left'}
              size={20}
              color={ink.text}
            />
          </AnimatedPressable>
        ) : null}

        {menuActions && menuActions.length > 0 ? (
          <AnimatedPressable
            ref={menuBtnRef}
            onPress={openMenu}
            containerStyle={styles.iconBtnContainer}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Page menu"
            hitSlop={8}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={ink.text} />
          </AnimatedPressable>
        ) : null}
      </View>

      <ContextMenu
        anchor={menuAnchor}
        actions={menuActions ?? []}
        onDismiss={closeMenu}
        align="right"
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: Layout.headerHeight,
    // No bottom rule. The header sat on the canvas and the canvas carries the
    // layout; a hairline here was a divider drawn between two things that are
    // already separated by the sidebar's own vertical edge, and the depth rules
    // in AGENTS.md put shadow — not outlines — between layers.
    borderBottomWidth: 0,
    gap: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  /** Sits between two equal-flex columns so the title is truly centred. */
  center: { flexShrink: 0, alignItems: 'center', maxWidth: '60%' },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flex: 1,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    // Centre the greeting in its own box rather than relying on the
    // parent row alone, so the text stays optically centred against the
    // 44px icon buttons beside it whatever the bar throws at it. The 4px
    // vertical padding keeps a wrapped two-line greeting off the bar's
    // edges without pushing a single line off-centre.
    justifyContent: 'center',
    paddingVertical: 4,
  },
  greeting: { flexShrink: 1 },
  brand: { ...Typography.app.wordmark, textAlign: 'center' },
  iconBtnContainer: { borderRadius: Radius.md },
  /**
   * A bare glyph, not a chip.
   *
   * These were filled with `theme.surface` and outlined with `theme.border`,
   * which put a raised grey square behind each one. Against the header that
   * reads as weight the bar has no business carrying: the square is louder than
   * the wordmark beside it, and on the Settings screen a lone chip on the left
   * unbalanced a centred title against an empty right-hand side.
   *
   * The 44px box stays — that is the tap target, and it is what makes the
   * button comfortable to hit on a phone. Only the paint is gone.
   */
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: 'transparent',
    borderWidth: 0,
    flexShrink: 0,
  },
});
