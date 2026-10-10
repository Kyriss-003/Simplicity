import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Radius, Typography, type Theme } from '../../theme';

/**
 * One row of the wheel. It has to be a round number of points rather than a
 * token height, because the *scroll offset* is the arithmetic: the selected row
 * sits at the wheel's centre, so row N is at `N * ITEM_HEIGHT`. An arbitrary
 * height would mean multiplying by something the eye cannot check.
 */
const ITEM_HEIGHT = 40;
/** Rows visible above and below the selection — three is the classic dial. */
const VISIBLE_ROWS = 3;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;

/** A tap anywhere on the wheel selects the row that was tapped. */
export interface WheelItem {
  value: number;
  label: string;
}

/**
 * A scrolling dial for one component of a time — hours, or minutes.
 *
 * It replaces a chip grid of hours and a two-chip row of minutes. Those were
 * chosen because a dropdown of 26 half-hour slots is 1300px tall and
 * `ContextMenu` clamps it, so the afternoon was unreachable; the chips fixed the
 * reachability and left the cost: fourteen hour chips and two minute chips is a
 * wall of small targets, and *choosing a time* is a matter of sliding along a
 * dimension, which is what a wheel is for.
 *
 * The value is committed on scroll-end, not on every frame — a dial that fires
 * on each tick would re-render the dialog ~60 times a second, and the parent
 * only needs the answer when the finger has stopped.
 *
 * **The scroll position is derived from the value, not the other way round.**
 * Changing the value (editing an event that starts at 3:15 pm) scrolls the wheel;
 * scrolling the wheel changes the value. Driving the offset from the value makes
 * the first case work and lets the second fall out of it, where the reverse
 * would fight the user's finger every frame.
 */
export function TimeWheel({
  theme,
  items,
  value,
  onChange,
  accessibilityLabel,
  width,
}: {
  theme: Theme;
  items: readonly WheelItem[];
  value: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  width?: number;
}) {
  const scrollRef = useRef<ScrollView>(null);
  /** Set while we are scrolling the wheel ourselves, so it is not read back. */
  const programmatic = useRef(false);
  const selectedIndex = useMemo(
    () => Math.max(0, items.findIndex((item) => item.value === value)),
    [items, value]
  );

  /**
   * Scroll to the value whenever it changes from outside — opening the dialog on
   * a 7:30 pm event, or an hour wheel being re-seeded when the minute wheel
   * pushes past an hour boundary.
   */
  useEffect(() => {
    programmatic.current = true;
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: true });
  }, [selectedIndex]);

  const commitFromOffset = (offsetY: number) => {
    // Rounded, and clamped: a flick with momentum can end between two rows, and
    // a rubber-band overscroll reports a negative or past-the-end offset. Both
    // would otherwise select a row that is not there.
    const index = Math.min(items.length - 1, Math.max(0, Math.round(offsetY / ITEM_HEIGHT)));
    const item = items[index];
    if (item && item.value !== value) onChange(item.value);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (programmatic.current) {
      programmatic.current = false;
      return;
    }
    commitFromOffset(e.nativeEvent.contentOffset.y);
  };

  return (
    <View
      style={[
        styles.wheel,
        { width, height: WHEEL_HEIGHT, backgroundColor: theme.background, borderColor: theme.border },
      ]}
    >
      {/*
        The selection band sits *behind* the rows and is drawn first, so the
        labels paint on top of it. It is a fill rather than an outline because it
        is the one element saying "this is where you are" and an outline would
        add a second edge to every row it crosses.
      */}
      <View
        pointerEvents="none"
        style={[
          styles.selection,
          {
            top: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2,
            backgroundColor: theme.pillBg,
            borderColor: theme.border,
          },
        ]}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{
          // Half a wheel of padding above and below, so the first and last rows
          // can reach the centre — which is the only place a row is selected.
          paddingVertical: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2,
        }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        nestedScrollEnabled
        onMomentumScrollEnd={onScrollEnd}
        // A drag that stops without momentum still has to commit, or a slow,
        // deliberate scroll to the row below would do nothing.
        onScrollEndDrag={onScrollEnd}
        // Accessibility: the wheel is one adjustable control, not 26 rows to
        // arrow through. The value and the range are announced, and the
        // increment/decrement actions step one row.
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{
          min: items[0]?.value ?? 0,
          max: items[items.length - 1]?.value ?? 0,
          now: value,
          text: items[selectedIndex]?.label,
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const next = Math.min(items.length - 1, Math.max(0, selectedIndex + (e.nativeEvent.actionName === 'increment' ? 1 : -1)));
          const item = items[next];
          if (item) onChange(item.value);
        }}
      >
        {items.map((item, index) => {
          const selected = index === selectedIndex;
          return (
            <Text
              key={item.value}
              // A tap on a row is the direct route to that value, which is what
              // makes the wheel usable with a mouse on the web build.
              onPress={() => {
                programmatic.current = true;
                scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
                onChange(item.value);
              }}
              style={[
                styles.item,
                selected ? Typography.app.bodyStrong : Typography.app.body,
                { color: selected ? theme.text : theme.textMuted },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Re-exported so the dialog can size a row without importing the constant. */
export { ITEM_HEIGHT as WHEEL_ITEM_HEIGHT };

const styles = StyleSheet.create({
  wheel: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  selection: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  item: {
    // The type token first so its own `lineHeight` is the one that applies, then
    // the row height on top: a row whose line box is shorter than its height
    // sits high in the band, and the selected row then looks off-centre.
    ...Typography.app.body,
    height: ITEM_HEIGHT,
    lineHeight: ITEM_HEIGHT,
    textAlign: 'center',
  },
});
