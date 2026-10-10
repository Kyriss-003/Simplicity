import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { Motion, Radius, type Theme } from '../../theme';
import { resolveDropIndex, shiftForRow } from './dragReorder';

/** Touch target for the drag handle. */
const HANDLE = 32;

/** How far the row lifts and scales while held, so it reads as picked up. */
const GHOST_SCALE = 1.02;

interface DraggableListProps<T> {
  items: readonly T[];
  theme: Theme;
  /** Stable key per item; also used in the handle's accessibility label. */
  keyOf: (item: T, index: number) => string;
  /** Persists the new order. Called once, on release, with the final indices. */
  onReorder: (from: number, to: number) => void;
  renderItem: (item: T, index: number, handle: React.ReactNode) => React.ReactNode;
  /** Per-row box, e.g. the hairline separating one row from the next. */
  rowStyle?: (index: number) => StyleProp<ViewStyle>;
}

/**
 * A vertical list whose rows reorder by dragging a handle.
 *
 * The row being dragged is the *ghost*: it follows the pointer, lifted and
 * slightly scaled. Every other row springs aside by exactly one slot, leaving a
 * visible hole — the placeholder that tells the user where the row will land.
 * Nothing is committed until the pointer is released.
 *
 * The gesture state is deliberately plain React (`activeIndex`, `toIndex`)
 * rather than shared values, because the destination is a *discrete* fact and
 * the row styling needs to re-render on it. Only the two continuous
 * quantities — the ghost's travel and the other rows' springs — live on the UI
 * thread. A gesture that never re-renders cannot redraw the hole.
 */
export function DraggableList<T>({
  items,
  theme,
  keyOf,
  onReorder,
  renderItem,
  rowStyle,
}: DraggableListProps<T>) {
  const count = items.length;

  /**
   * Measured row heights. The drop maths needs real heights rather than a
   * constant, because a row's description can wrap to two lines.
   */
  const heights = useRef<number[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [toIndex, setToIndex] = useState<number | null>(null);

  // Refs mirror the state so the PanResponder callbacks — which are created
  // per row and can outlive a render — never close over a stale value.
  const activeRef = useRef<number | null>(null);
  const toRef = useRef<number | null>(null);

  /** The ghost's travel from the drag origin, in the list's own coordinates. */
  const dragY = useSharedValue(0);

  const startDrag = useCallback(
    (index: number) => {
      activeRef.current = index;
      toRef.current = index;
      dragY.value = 0;
      setActiveIndex(index);
      setToIndex(index);
    },
    [dragY]
  );

  const moveDrag = useCallback(
    (index: number, dy: number) => {
      dragY.value = dy;
      const next = resolveDropIndex(index, dy, heights.current);
      if (next !== toRef.current) {
        toRef.current = next;
        setToIndex(next);
      }
    },
    [dragY]
  );

  const endDrag = useCallback(() => {
    const from = activeRef.current;
    const to = toRef.current;
    activeRef.current = null;
    toRef.current = null;
    setActiveIndex(null);
    setToIndex(null);
    if (from !== null && to !== null && from !== to) onReorder(from, to);
  }, [onReorder]);

  const measure = useCallback((index: number, e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (heights.current[index] !== h) heights.current[index] = h;
  }, []);

  const nudge = useCallback(
    (index: number, direction: -1 | 1) => {
      const to = Math.max(0, Math.min(count - 1, index + direction));
      if (to !== index) onReorder(index, to);
    },
    [count, onReorder]
  );

  return (
    <View>
      {items.map((item, index) => (
        <DraggableRow
          key={keyOf(item, index)}
          item={item}
          index={index}
          label={keyOf(item, index)}
          isActive={activeIndex === index}
          target={toIndex ?? index}
          activeIndex={activeIndex}
          heights={heights.current}
          theme={theme}
          dragY={dragY}
          onLayout={measure}
          style={rowStyle?.(index)}
          onStart={startDrag}
          onMove={moveDrag}
          onEnd={endDrag}
          onNudge={nudge}
          renderItem={renderItem}
        />
      ))}
    </View>
  );
}

/**
 * One row, and the drag gesture that belongs to it.
 *
 * Split out so each row owns its own `PanResponder` and spring. Calling hooks
 * inside the parent's `.map()` would make the hook count depend on the number
 * of sections, which silently reorders the hooks the moment a section is
 * added — and the parent holding a `Map` of shared values instead would need
 * that map kept in sync with the item count, which is the same bug wearing a
 * different hat.
 */
function DraggableRow<T>({
  item,
  index,
  label,
  isActive,
  target,
  activeIndex,
  heights,
  theme,
  dragY,
  onLayout,
  style,
  onStart,
  onMove,
  onEnd,
  onNudge,
  renderItem,
}: {
  item: T;
  index: number;
  label: string;
  isActive: boolean;
  target: number;
  activeIndex: number | null;
  heights: number[];
  theme: Theme;
  dragY: SharedValue<number>;
  onLayout: (index: number, e: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  onStart: (index: number) => void;
  onMove: (index: number, dy: number) => void;
  onEnd: () => void;
  onNudge: (index: number, direction: -1 | 1) => void;
  renderItem: (item: T, index: number, handle: React.ReactNode) => React.ReactNode;
}) {
  const shift = useSharedValue(0);
  const scale = useSharedValue(1);

  /**
   * Hover is tracked as plain state, the same way the sidebar's rows do it.
   *
   * This is a *shadow*, not a lift. A hover transform was tried once and made a
   * segmented control's selected segment visibly grow under the cursor, which
   * read as a glitch; a shadow adds no transform, so the handle can still say
   * "this is grabbable" without anything moving. `onHoverIn` / `onHoverOut`
   * never fire on touch, so this is web-only by construction.
   */
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (activeIndex === null) {
      shift.value = withSpring(0, Motion.spring.gentle);
      return;
    }
    const next = shiftForRow(activeIndex, target, index, heights);
    shift.value = withSpring(next, Motion.spring.gentle);
  }, [activeIndex, target, index, heights, shift]);

  useEffect(() => {
    scale.value = withSpring(isActive ? GHOST_SCALE : 1, Motion.spring.snappy);
  }, [isActive, scale]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim the gesture immediately. Without this the enclosing ScrollView
        // steals the vertical drag and the page scrolls under the row instead
        // of reordering it.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => onStart(index),
        onPanResponderMove: (_e, g) => onMove(index, g.dy),
        onPanResponderRelease: onEnd,
        onPanResponderTerminate: onEnd,
      }),
    [index, onStart, onMove, onEnd]
  );

  const animated = useAnimatedStyle(
    () => ({
      transform: [{ translateY: isActive ? dragY.value : shift.value }, { scale: scale.value }],
    }),
    [isActive, dragY, shift, scale]
  );

  const handle = (
    <View
      {...panResponder.panHandlers}
      // `onKeyDown` and `tabIndex` are not in React Native's `ViewProps`, but
      // `react-native-web` forwards both to the DOM node — which is where this
      // app is verified. They are spread through a cast for the same reason the
      // context menu's `onContextMenu` is: the prop exists, RN's types just
      // predate the platform that accepts it.
      {...({
        // Reordering must not require a pointer, and the drag is a pointer-only
        // affordance. Arrow keys move the focused row one slot.
        onKeyDown: (e: { key: string; preventDefault: () => void }) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            onNudge(index, -1);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onNudge(index, 1);
          }
        },
        // `tabIndex`, not `focusable`: RN Web deprecated `focusable` and warns
        // on every use.
        // Hover tracking, in the same cast block because these are DOM events
        // React Native's `ViewProps` does not declare. `onMouseEnter` /
        // `onMouseLeave` are forwarded by `react-native-web` on any element;
        // RN's own `onHoverIn` / `onHoverOut` are **not** — they are implemented
        // only on `Pressable`, so on a plain `View` they are silently inert.
        // Web-only by construction, which is the same scope as this affordance.
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        tabIndex: 0,
      } as Record<string, unknown>)}
      style={[
        styles.handle,
        hovered && {
          // Elevation comes from `theme.shadow` — a literal `rgba()` vanishes on
          // OLED, and a shadow on a dark canvas needs to be heavier there.
          boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 6, color: theme.shadow }],
        },
      ]}
      // `button`, not `adjustable`: RN Web maps `adjustable` to ARIA `slider`,
      // which announces a *value* and a min/max that this handle does not have.
      // The handle moves a row; it does not set a quantity.
      accessibilityRole="button"
      accessibilityLabel={`Reorder ${label}`}
      accessibilityHint="Press and hold to drag, or use the up and down arrow keys"
      // Native only. `react-native-web` has no `onAccessibilityAction` at all —
      // it is absent from its dist — so on web this never fires and `onKeyDown`
      // above is the only working path. Kept because it is correct on the
      // platforms that do implement it.
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const action = e.nativeEvent.actionName;
        if (action === 'increment') onNudge(index, -1);
        if (action === 'decrement') onNudge(index, 1);
      }}
    >
      <MaterialCommunityIcons name="drag-horizontal-variant" size={18} color={theme.textMuted} />
    </View>
  );

  return (
    <Animated.View
      onLayout={(e) => onLayout(index, e)}
      style={[
        animated,
        style,
        isActive && {
          // The ghost: lifted off the page so it reads as held rather than
          // painted flat on top of its neighbours.
          zIndex: 10,
          shadowColor: theme.shadow,
          shadowOpacity: 0.9,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        },
      ]}
    >
      {renderItem(item, index, handle)}
    </Animated.View>
  );
}

const styles = {
  handle: {
    width: HANDLE,
    height: HANDLE,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: Radius.sm,
  },
};
