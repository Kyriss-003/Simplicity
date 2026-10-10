import { nextScrollOffset, wheelDeltaFor } from '../src/hooks/useContainerScroll';

describe('wheelDeltaFor', () => {
  it('maps a plain vertical wheel onto a horizontal container', () => {
    // The reported bug: a normal vertical swipe carried a little deltaX, the
    // old "is it horizontal?" comparison handed the gesture to the native
    // scroller, and the row only ever moved for sideways swipes.
    expect(wheelDeltaFor('horizontal', 0, 100)).toBe(100);
    expect(wheelDeltaFor('horizontal', 4, 100)).toBe(104);
  });

  it('still maps a sideways wheel onto a horizontal container', () => {
    expect(wheelDeltaFor('horizontal', 60, 0)).toBe(60);
  });

  it('gives a horizontal container one predictable direction for a diagonal', () => {
    expect(wheelDeltaFor('horizontal', 30, 30)).toBe(60);
  });

  it('ignores deltaX entirely for a vertical container', () => {
    // A sideways trackpad gesture must not walk a vertical list horizontally.
    expect(wheelDeltaFor('vertical', 80, 20)).toBe(20);
  });

  it('reports no movement for a zero gesture', () => {
    expect(wheelDeltaFor('horizontal', 0, 0)).toBe(0);
  });
});

describe('nextScrollOffset', () => {
  const MAX = 500;

  it('moves by the delta when it stays inside the range', () => {
    expect(nextScrollOffset(100, 50, MAX)).toBe(150);
    expect(nextScrollOffset(100, -50, MAX)).toBe(50);
  });

  it('clamps a delta that overshoots, so the end is actually reachable', () => {
    // The bug the browser test caught: a 300px notch from 420 with a max of 556
    // was rejected outright because 420+300 overshoots, so the row stopped 136px
    // short *forever* and the last card could never be reached.
    expect(nextScrollOffset(420, 300, 556)).toBe(556);
    expect(nextScrollOffset(20, -300, MAX)).toBe(0);
  });

  it('releases the gesture once the boundary is reached', () => {
    expect(nextScrollOffset(MAX, 50, MAX)).toBeNull();
    expect(nextScrollOffset(0, -50, MAX)).toBeNull();
  });

  it('releases at a boundary only in the direction of travel', () => {
    // At the end, a *backwards* gesture is still ours.
    expect(nextScrollOffset(MAX, -50, MAX)).toBe(MAX - 50);
    expect(nextScrollOffset(0, 50, MAX)).toBe(50);
  });

  it('never intercepts a container with nothing to scroll', () => {
    // A short list has no overflow; intercepting would freeze the page.
    expect(nextScrollOffset(0, 100, 0)).toBeNull();
    expect(nextScrollOffset(0, 100, -50)).toBeNull();
  });

  it('lets a gesture walk all the way to the end in ordinary notches', () => {
    let offset = 0;
    for (let i = 0; i < 20; i += 1) {
      const next = nextScrollOffset(offset, 300, 556);
      if (next === null) break;
      offset = next;
    }
    expect(offset).toBe(556);
  });
});
