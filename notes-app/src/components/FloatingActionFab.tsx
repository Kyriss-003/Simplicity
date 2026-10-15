import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from './shared/icons';
import { BlurView } from 'expo-blur';
import { Radius, Typography, surfaceTheme, type Theme } from '../theme';
import type { FabVariant } from '../types';
import { AnimatedPressable } from './shared/motion';

interface FabAction {
  label: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
}

const SPRING_CONFIG = { damping: 18, stiffness: 200, mass: 0.8 };

/** Perceived-luminance check to pick a dark or light backdrop tint. */
function isLightBackground(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

/**
 * Floating Action Button with Reanimated spring animations.
 * Expands on hover (desktop) and tap (mobile), auto-closes when the
 * pointer leaves the FAB area on web. Visible on all screen sizes.
 */
export function FloatingActionFab({
  theme,
  isOpen,
  onToggle,
  actions,
  variant = 'iconLabel',
}: {
  theme: Theme;
  isOpen: boolean;
  onToggle: () => void;
  actions: FabAction[];
  /**
   * What each row of the expanded menu carries.
   *
   * `iconLabel` is the default because it is the only mode that states what each
   * row does. The other two trade that for width, which is a trade the user
   * makes rather than one the app makes for them.
   */
  variant?: FabVariant;
}) {
  // The menu heading is the only thing the *parent* draws on a surface; each
  // row resolves its own ink inside `FabMenuItem`, where it is one decision.
  const ink = surfaceTheme(theme);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(isOpen ? 1 : 0, SPRING_CONFIG);
  }, [isOpen, progress]);

  const fabIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` }],
  }));

  const wrapRef = useRef<View>(null);
  const lightBg = isLightBackground(theme.background);

  // Web: wrap View is a hover boundary that keeps the menu state stable
  // while the pointer is inside and cancels any pending auto-close.
  // Opening is driven solely by the trigger button's onHoverIn below
  // (the layout box alone must not open the menu).
  useEffect(() => {
    if (Platform.OS !== 'web' || !wrapRef.current) return;
    // @ts-ignore — RNW exposes the underlying DOM node on the ref.
    const el = wrapRef.current as unknown as HTMLElement;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const onEnter = () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = undefined;
      }
      // No toggle here — hovering the layout box alone must not open.
    };
    const onLeave = () => {
      if (closeTimer) return; // already armed
      closeTimer = setTimeout(() => {
        closeTimer = undefined;
        if (isOpen) onToggle();
      }, 150);
    };
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      if (closeTimer) clearTimeout(closeTimer);
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [isOpen, onToggle]);

  return (
    <>
      {/* Blurred backdrop — closes menu when tapping outside (mobile/desktop) */}
      {isOpen ? (
        <Pressable
          style={[
            styles.backdrop,
            Platform.OS === 'web' && {
              // @ts-ignore — RNW maps this to the CSS backdrop-filter property.
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              backgroundColor: theme.shadow,
            },
          ]}
          onPress={onToggle}
        >
          {Platform.OS !== 'web' ? (
            <BlurView
              intensity={48}
              tint={lightBg ? 'light' : 'dark'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </Pressable>
      ) : null}

      <View ref={wrapRef} style={styles.wrap}>
        {/* Pointer-events disabled while closed so invisible items don't
            intercept outside taps. */}
        <View style={[styles.menuColumn, { pointerEvents: isOpen ? 'auto' : 'none' }]}>
          {/*
            The heading is only rendered in `icon`, the one mode whose rows cannot
            name themselves. It restores the "one idea per screen" contract at the
            only place it is broken, by naming the group the glyphs belong to.
          */}
          {isOpen && variant === 'icon' && actions.length > 1 ? (
            <Text style={[styles.menuHeading, { color: ink.textMuted }]}>Create</Text>
          ) : null}
          {actions.map((action, index) => (
            <FabMenuItem
              key={action.label}
              action={action}
              theme={theme}
              progress={progress}
              index={index}
              total={actions.length}
              variant={variant}
            />
          ))}
        </View>

        <AnimatedPressable
          onPress={onToggle}
          onHoverIn={() => {
            if (!isOpen) onToggle();
          }}
          containerStyle={[
            styles.fab,
            {
              backgroundColor: theme.accent,
              boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 8, color: theme.shadow }],
            },
          ]}
          style={styles.fabPress}
          accessibilityLabel="Create new"
        >
          <Animated.View style={fabIconStyle}>
            <MaterialCommunityIcons name="plus" size={26} color={theme.accentText} />
          </Animated.View>
        </AnimatedPressable>
      </View>
    </>
  );
}

function FabMenuItem({
  action,
  theme,
  progress,
  index,
  total,
  variant,
}: {
  action: FabAction;
  theme: Theme;
  progress: SharedValue<number>;
  index: number;
  total: number;
  variant: FabVariant;
}) {
  /**
   * Stagger, counted from the *bottom* of the column.
   *
   * `actions[0]` renders at the top and the FAB sits under the last item, so
   * index `total - 1` is the one nearest the button. Giving that one an offset
   * of 0 makes the reveal travel upward out of the FAB — the flow the menu
   * should have, rather than dropping from the top.
   */
  const staggerOffset = (total - 1 - index) / total;

  // The menu item is a surface; the FAB button below it is an accent fill.
  const ink = surfaceTheme(theme);

  const animStyle = useAnimatedStyle(() => {
    const flow = interpolate(
      progress.value,
      [staggerOffset, Math.min(staggerOffset + 0.5, 1)],
      [0, 1],
      'clamp'
    );
    // The parent `progress` is a spring, so these interpolated values inherit
    // its timing. An earlier version also wrapped them in `withTiming` *inside*
    // the style hook, which started a fresh animation every frame and could
    // strand an item mid-flight on a fast tap.
    return {
      opacity: flow,
      transform: [{ translateY: interpolate(flow, [0, 1], [12, 0]) }],
    };
  });

  return (
    <Animated.View style={animStyle}>
      {/*
        `label` drops the glyph and `icon` drops the text, but neither drops the
        accessible name: `accessibilityLabel` stays on the row in all three modes,
        because the icon-only row is otherwise an unlabelled control.

        The 48px square in `icon` is the app's row contract — it is a menu of
        targets, so it gets the same thumb-sized box as every other row rather
        than the 28px chip that sits *inside* a labelled row.
      */}
      <AnimatedPressable
        onPress={action.onPress}
        style={[
          styles.menuItem,
          variant === 'icon' && styles.menuItemIconOnly,
          {
            backgroundColor: theme.surfaceRaised,
            borderColor: ink.border,
            boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 8, color: theme.shadow }],
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={action.label}
        // The visible text is the label in two modes; without this a screen
        // reader would announce the row twice.
        accessibilityHint={variant === 'iconLabel' ? undefined : `Create a ${action.label}`}
      >
        {variant !== 'label' ? (
          <View
            style={[
              styles.menuIconBox,
              variant === 'icon' ? styles.menuIconBoxSolo : { backgroundColor: ink.pillBg },
            ]}
          >
            <MaterialCommunityIcons name={action.iconName} size={16} color={ink.text} />
          </View>
        ) : null}
        {variant !== 'icon' ? (
          <Text style={[styles.menuLabel, { color: ink.text }]}>{action.label}</Text>
        ) : null}
      </AnimatedPressable>
    </Animated.View>
  );
}

/**
 * A single sample row, in whichever mode is selected, for the preference to show.
 *
 * **Why the setting needs one at all.** The create button is not on the screen
 * while you are changing this setting — Settings hides it on purpose — and its
 * *closed* state is a 56px "+" circle in all three modes. So the only thing that
 * differs is a menu that is closed by default, on a different screen. Changing
 * the setting therefore changed nothing visible anywhere near the tap, which
 * reads as a control that does not work.
 *
 * It reuses `styles.menuItem` and the same tokens as the real menu at a reduced
 * scale, so the preview cannot drift from what the button actually renders. One
 * row, not three: the rows are all the same shape, so two more would be
 * repetition inside a 200px control slot.
 */
export function FabMenuPreview({ theme, variant }: { theme: Theme; variant: FabVariant }) {
  const ink = surfaceTheme(theme);
  return (
    <View
      style={[
        styles.menuItem,
        styles.menuItemPreview,
        variant === 'icon' && styles.menuItemIconOnly,
        { backgroundColor: theme.surfaceRaised, borderColor: ink.border },
      ]}
    >
      {variant !== 'label' ? (
        <View
          style={[
            styles.menuIconBox,
            variant === 'icon' ? styles.menuIconBoxSolo : { backgroundColor: ink.pillBg },
          ]}
        >
          <MaterialCommunityIcons
            name="note-plus-outline"
            size={variant === 'icon' ? 14 : 12}
            color={ink.text}
          />
        </View>
      ) : null}
      {variant !== 'icon' ? (
        <Text style={[styles.menuLabel, { color: ink.text }]}>New Note</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 19,
    pointerEvents: 'auto',
  },
  wrap: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    alignItems: 'flex-end',
    gap: 0,
    zIndex: 20,
    pointerEvents: 'box-none',
  },
  menuColumn: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
    paddingBottom: 8,
  },
  /** Names the group of glyphs, so an icon-only menu is not a shelf of marks. */
  menuHeading: {
    ...Typography.app.caption,
    paddingRight: 8,
    paddingBottom: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.lg,
    borderWidth: 1,
    elevation: 6,
  },
  /**
   * The icon-only row: a square at the app's 48px row contract, so the three
   * glyphs are thumb targets rather than 32px tokens in a wide pill.
   */
  menuItemIconOnly: {
    width: 48,
    height: 48,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  /**
   * The preview is the real row at `transform: scale`, not a second set of
   * dimensions — so it cannot drift from the menu it is previewing.
   */
  menuItemPreview: {
    transform: [{ scale: 0.82 }],
    transformOrigin: 'left center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  menuLabel: { ...Typography.app.bodyStrong },
  menuIconBox: {
    width: 28,
    height: 28,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  /** No inner chip in icon-only mode: the row is already the target. */
  menuIconBoxSolo: { backgroundColor: 'transparent', width: 24, height: 24 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  /** Fills the FAB so the whole 56px circle stays tappable, not just the glyph. */
  fabPress: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
});
