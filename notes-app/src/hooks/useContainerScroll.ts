import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** The DOM node behind an RNW `ScrollView`. */
interface Scrollable {
  getScrollableNode?: () => HTMLElement | null;
}

function scrollableNode(instance: unknown): HTMLElement | null {
  const node = (instance as Scrollable | null)?.getScrollableNode?.() ?? null;
  return node && typeof node.addEventListener === 'function' ? node : null;
}

/**
 * How much further a gesture must favour one axis before the native scroller
 * keeps it. A bias rather than a strict comparison, so trackpad noise on a
 * "straight" vertical swipe does not hand the gesture away.
 */
const AXIS_BIAS = 1.5;

/**
 * The scroll delta a gesture contributes, per axis.
 *
 * A horizontal container has exactly one meaningful direction, so **both**
 * components of a trackpad gesture feed it: a straight vertical swipe and a
 * sideways swipe both advance along the row. Summing them also makes a diagonal
 * gesture do one predictable thing rather than two contradictory ones.
 *
 * The version this replaced compared `deltaX` against `deltaY` to decide whether
 * the gesture was "really" horizontal, and the row then responded only to
 * sideways swipes — because a genuine vertical swipe carries a little `deltaX`
 * and that comparison kept losing the gesture to the native scroller.
 */
export function wheelDeltaFor(
  axis: 'horizontal' | 'vertical',
  deltaX: number,
  deltaY: number
): number {
  return axis === 'horizontal' ? deltaX + deltaY : deltaY;
}

/**
 * The scroll offset a gesture should move to, or `null` to hand the gesture back
 * to the page.
 *
 * Two rules, and the second one is the one that was wrong:
 *
 * 1. **Nothing to scroll (`max <= 0`)** — release. A short list has no overflow
 *    and must never trap the page.
 * 2. **Already at the boundary** in the direction of travel — release, so the
 *    page picks the gesture up.
 *
 * The bug this replaced tested the *whole* delta against the range: one wheel
 * notch of 300px from an offset of 420 with a max of 556 was rejected outright,
 * because 420 + 300 overshoots. The row therefore **could never reach its end** —
 * it stopped 136px short, permanently, and the last note card was unreachable no
 * matter how long you scrolled. The correct test is "am I *at* the end?", and the
 * move itself is clamped so a large notch lands exactly on the boundary.
 */
export function nextScrollOffset(
  current: number,
  delta: number,
  max: number
): number | null {
  if (max <= 0) return null;
  if (delta < 0 && current <= 0) return null;
  if (delta > 0 && current >= max) return null;
  return Math.min(max, Math.max(0, current + delta));
}

/** In-flight touch gesture for this container. */
interface Gesture {
  tracking: boolean;
  startX: number;
  startY: number;
  startScroll: number;
}

/**
 * Scopes wheel and touch input to a scroll container while the pointer is over
 * it, and returns a **callback ref** for the `ScrollView`.
 *
 * **Why a callback ref.** A plain ref plus an effect has two failure modes this
 * had already hit, both silent:
 * 1. An effect does not re-run when the element it measured *mounts later*, and
 *    both `NotesCardRow` and `TasksCard` render their `ScrollView` conditionally,
 *    so the listeners could simply never attach.
 * 2. Resolving the node inside the effect means a null in that instant is a
 *    permanent no-op.
 * A ref callback runs on mount *and* on unmount, so it is the only place the
 * listener lifetime can be managed correctly.
 *
 * **Why there is no `mouseenter` gate.** A wheel event is only delivered to the
 * element under the pointer anyway, so attaching to the node *is* the hover
 * scope. `mouseenter` only fires on a *transition into* the element, so a
 * pointer already resting inside when the listener attached never armed the
 * feature at all.
 *
 * **Why the touch half is horizontal-only.** A vertical list scrolls itself,
 * and intercepting its touch would double-scroll. The only thing the platform
 * cannot express is a *vertical* swipe driving a *horizontal* container, which
 * is what the note row needs.
 *
 * Web only. Native has momentum scrolling and no wheel events, and native touch
 * momentum is never replaced — this adds a mapping, not a scroller.
 */
export function useScrollRedirection(axis: 'horizontal' | 'vertical') {
  const nodeRef = useRef<HTMLElement | null>(null);
  const gestureRef = useRef<Gesture>({ tracking: false, startX: 0, startY: 0, startScroll: 0 });
  const wantsTouch = axis === 'horizontal';

  const onWheel = useCallback(
    (e: WheelEvent) => {
      const node = nodeRef.current;
      if (!node) return;
      const delta = wheelDeltaFor(axis, e.deltaX, e.deltaY);
      if (delta === 0) return;

      const max =
        axis === 'horizontal'
          ? node.scrollWidth - node.clientWidth
          : node.scrollHeight - node.clientHeight;
      const current = axis === 'horizontal' ? node.scrollLeft : node.scrollTop;

      const next = nextScrollOffset(current, delta, max);
      // At either end the gesture is handed to the page rather than swallowed.
      if (next === null) return;
      e.preventDefault();
      if (axis === 'horizontal') node.scrollLeft = next;
      else node.scrollTop = next;
    },
    [axis]
  );

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      const node = nodeRef.current;
      // A second finger is a pinch, not a scroll.
      if (!node || e.touches.length !== 1) {
        gestureRef.current.tracking = false;
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      const gesture = gestureRef.current;
      gesture.startX = touch.clientX;
      gesture.startY = touch.clientY;
      gesture.startScroll = node.scrollLeft;
      gesture.tracking = true;
    },
    []
  );

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      const node = nodeRef.current;
      const gesture = gestureRef.current;
      if (!node || !gesture.tracking) return;
      if (e.touches.length !== 1) {
        gesture.tracking = false;
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;

      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;

      // A clearly horizontal drag belongs to the native scroller; taking it too
      // would double-scroll.
      if (Math.abs(dx) > Math.abs(dy) * AXIS_BIAS) {
        gesture.tracking = false;
        return;
      }

      const max = node.scrollWidth - node.clientWidth;
      const next = nextScrollOffset(gesture.startScroll, -dy, max);
      if (next === null) {
        // At an end, stop tracking: the rest of this gesture is the page's.
        gesture.tracking = false;
        return;
      }
      e.preventDefault();
      node.scrollLeft = next;
    },
    []
  );

  const onTouchEnd = useCallback(() => {
    gestureRef.current.tracking = false;
  }, []);

  const attach = useCallback(
    (instance: unknown) => {
      const previous = nodeRef.current;
      if (previous) {
        previous.removeEventListener('wheel', onWheel);
        if (wantsTouch) {
          previous.removeEventListener('touchstart', onTouchStart);
          previous.removeEventListener('touchmove', onTouchMove);
          previous.removeEventListener('touchend', onTouchEnd);
          previous.removeEventListener('touchcancel', onTouchEnd);
        }
      }

      const node = scrollableNode(instance);
      nodeRef.current = node;
      if (!node) return;

      // `passive: false` is required for `preventDefault` to be legal at all.
      node.addEventListener('wheel', onWheel, { passive: false });

      if (wantsTouch) {
        node.addEventListener('touchstart', onTouchStart, { passive: true });
        node.addEventListener('touchmove', onTouchMove, { passive: false });
        node.addEventListener('touchend', onTouchEnd, { passive: true });
        node.addEventListener('touchcancel', onTouchEnd, { passive: true });
      }
    },
    [onWheel, onTouchStart, onTouchMove, onTouchEnd, wantsTouch]
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // React always calls a ref callback with `null` on unmount; this guarantees
    // it even if the ref is dropped for any other reason, so a listener can
    // never outlive its component.
    return () => {
      attach(null);
    };
  }, [attach]);

  return attach;
}
