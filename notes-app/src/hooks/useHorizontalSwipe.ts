import { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';

/** How far a finger must travel before the gesture counts as a swipe. */
const SWIPE_DISTANCE = 60;
/** Movement needed before the gesture is claimed as horizontal rather than vertical. */
const CLAIM_DISTANCE = 12;

/**
 * Horizontal swipe detection for touch, without stealing vertical scrolling.
 *
 * A mouse cannot swipe, so on web the `onPanResponder*` handlers never fire and
 * the same controls stay clickable. That is deliberate: the web build is not a
 * desktop-only preview, so touch has to be a first-class path rather than
 * something only the native build has.
 *
 * **The axis is decided before the responder is claimed.** Claiming on the first
 * move and deciding afterwards steals a vertical drag out of the `ScrollView`
 * halfway through, and the page stops scrolling under the finger — worse than
 * having no swipe at all. `onMoveShouldSetPanResponder` only takes the gesture
 * once horizontal movement has genuinely beaten vertical.
 *
 * The threshold is checked against `dx` from the touch *start*, not
 * incrementally, because deltas accumulate: a slow drag that never moves fast
 * still crosses it, and a flick that reverses can fall back out of it.
 *
 * `enabled` and the callbacks are held in refs so the `PanResponder` is built
 * exactly once. Rebuilding it mid-gesture would swap the responder out from
 * under a finger that is still down, and the swipe would silently do nothing.
 */
export function useHorizontalSwipe({
  enabled,
  onSwipeLeft,
  onSwipeRight,
}: {
  enabled: boolean;
  /** A swipe to the left: content moves left, so this moves forward. */
  onSwipeLeft?: () => void;
  /** A swipe to the right. */
  onSwipeRight?: () => void;
}) {
  const latest = useRef({ enabled, onSwipeLeft, onSwipeRight });
  latest.current = { enabled, onSwipeLeft, onSwipeRight };
  const firedRef = useRef(false);

  return useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => {
          if (!latest.current.enabled) return false;
          firedRef.current = false;
          return Math.abs(g.dx) > CLAIM_DISTANCE && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
        },
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          firedRef.current = false;
        },
        onPanResponderMove: (_e, g) => {
          if (firedRef.current) return;
          if (Math.abs(g.dx) < SWIPE_DISTANCE) return;
          firedRef.current = true;
          if (g.dx < 0) latest.current.onSwipeLeft?.();
          else latest.current.onSwipeRight?.();
        },
      }),
    []
  );
}
