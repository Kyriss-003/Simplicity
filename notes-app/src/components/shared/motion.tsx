import React, { forwardRef, useCallback, useEffect, useRef, type ComponentRef } from 'react';
import {
  Pressable,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Motion } from '../../theme';

/**
 * Shared motion primitives.
 *
 * Every animation in the app is built from these so timing, easing and press
 * feedback cannot drift per component: one `Motion.duration.base`, one
 * `Motion.pressedScale`, one set of spring configs (in `theme.ts`).
 *
 * Reanimated 4 is already a dependency (`FloatingActionFab` uses it), so this
 * adds no new package and no new native module — which matters here, because
 * native builds need an Expo dev client and adding a dependency would mean
 * re-verifying the whole app against a fresh install.
 */

/** Decelerating curve: starts fast, settles gently. The app's default easing. */
export const EASE_OUT = Easing.out(Easing.cubic);
/** Accelerating curve for exits. */
export const EASE_IN = Easing.in(Easing.cubic);

/** Scale a pressable shrinks to when held down. */
const PRESSED_SCALE = 0.97;

type AnimatedPressableProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Layout for the animated wrapper — a `flex: 1` segment, not the card box. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Overrides the press scale for one-off cases only. */
  scaleTo?: number;
};

/**
 * A `Pressable` with uniform press-scale feedback.
 *
 * The animated transform lives on a wrapper rather than on the pressable itself:
 * a `Pressable` accepts a *function* for `style`, and merging an animated style
 * into that form is not something Reanimated does reliably. The wrapper carries
 * no layout of its own, so it shrink-wraps the pressable and the transform
 * always matches the visible box.
 *
 * **Put the card's own box in `style`, not `containerStyle`.** The wrapper only
 * scales; if the padding, background and `flexDirection` go there instead, the
 * pressable inside has no styles at all and its children stack as plain blocks.
 * `containerStyle` exists for the one case that needs it — making the wrapper
 * itself grow in a flex parent (a `flex: 1` segment), where the pressable then
 * fills the wrapper with `flex: 1` of its own.
 */
export const AnimatedPressable = forwardRef<ComponentRef<typeof Pressable>, AnimatedPressableProps>(
  function AnimatedPressable(
    {
      children,
      style,
      containerStyle,
      scaleTo = PRESSED_SCALE,
      onPressIn,
      onPressOut,
      ...rest
    },
    ref
  ) {
    const press = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: interpolate(press.value, [0, 1], [1, scaleTo]) }],
    }));

    return (
      <Animated.View style={[containerStyle, animatedStyle]}>
        <Pressable
          {...rest}
          ref={ref}
          onPressIn={(e) => {
            press.value = withSpring(1, Motion.spring.snappy);
            onPressIn?.(e);
          }}
          onPressOut={(e) => {
            press.value = withSpring(0, Motion.spring.snappy);
            onPressOut?.(e);
          }}
          style={style}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }
);

/**
 * Fade + lift for a screen swapping in behind the bottom dock.
 *
 * Mount this under a `key` that changes with the screen: the key forces a
 * remount, which is what re-runs the entrance. Doing it with a `useEffect` on a
 * prop instead would also replay when a parent re-renders for unrelated reasons,
 * which reads as a glitch mid-task.
 */
export function ScreenTransition({ children }: { children: React.ReactNode }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: Motion.duration.base, easing: EASE_OUT });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * Motion.screenEnterOffset }],
  }));

  return <Animated.View style={[animatedStyle, { flex: 1 }]}>{children}</Animated.View>;
}

/**
 * Fade + lift for a dashboard section appearing or being toggled off in Settings.
 *
 * Uses Reanimated's layout-animation props rather than the manual
 * `ScreenTransition` pattern because these sections are *not* remounted on
 * toggle — the exit has to hold the node in the tree until it finishes, which is
 * exactly what `exiting` is for.
 */
export function DashboardSection({ children }: { children: React.ReactNode }) {
  return (
    <Animated.View
      entering={FadeIn.duration(Motion.duration.base)}
      exiting={FadeOut.duration(Motion.duration.fast)}
      style={{ gap: 12 }}
    >
      {children}
    </Animated.View>
  );
}

interface PillTarget {
  x: number;
  width: number;
}

/**
 * Drives a sliding highlight pill across a row of items.
 *
 * The active item reports its own layout, so the pill stays correct when labels
 * resize, the theme changes, or the sidebar is mid-animation when you tap — all
 * cases where hard-coding segment widths go wrong.
 *
 * `offset` compensates for the container's own padding: `onLayout` reports an
 * item's position relative to the parent's *content* box, while an absolutely
 * positioned child is placed against the *padding* box.
 */
export function useSlidingPill(activeKey: string, offset = 0) {
  const targets = useRef(new Map<string, PillTarget>());
  const x = useSharedValue(0);
  const width = useSharedValue(0);

  const move = useCallback(
    (key: string) => {
      const target = targets.current.get(key);
      if (!target) return;
      if (width.value === 0) {
        // First measurement: place it outright rather than sliding in from 0.
        x.value = target.x + offset;
        width.value = target.width;
        return;
      }
      x.value = withSpring(target.x + offset, Motion.spring.snappy);
      width.value = withSpring(target.width, Motion.spring.snappy);
    },
    [offset, width, x]
  );

  useEffect(() => {
    move(activeKey);
  }, [activeKey, move]);

  const measure = useCallback(
    (key: string, e: LayoutChangeEvent) => {
      const { x: nextX, width: nextWidth } = e.nativeEvent.layout;
      targets.current.set(key, { x: nextX, width: nextWidth });
      if (key === activeKey) move(key);
    },
    [activeKey, move]
  );

  const style = useAnimatedStyle(() => ({ left: x.value, width: width.value }));

  return { style, measure };
}
