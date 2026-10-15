import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '../shared/icons';
import { AnimatedPressable } from '../shared/motion';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import type { Event } from '../../types';
import { MonthGrid } from './MonthGrid';
import { addMonths, monthYearLabel } from './calendarUtils';

/** Gap between the anchor and the popover, and the screen margin. */
const MARGIN = 8;
/** Never narrower than this — six rows of day numbers need somewhere to go. */
const MIN_WIDTH = 280;
const WIDTH_SHARE = 0.95;
/** Card padding and border per side, so the grid is sized to the space inside them. */
const CARD_PAD_X = 8;
const CARD_BORDER = 1;
/** 44px box — the tap target, not the painted size. */
const NAV_BTN = 44;
/** Header row + six week rows, so the popover can be placed without measuring. */
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 64;
const GRID_HEIGHT = HEADER_HEIGHT + ROW_HEIGHT * 6;
/** …plus the popover's own header row and bottom padding. */
const CARD_HEIGHT = GRID_HEIGHT + 48 + 12;

/** Where the popover is on screen, or `null` when it is closed. */
export interface MonthPickerAnchor {
  x: number;
  y: number;
  width: number;
}

/**
 * A month grid that drops out of the heading it was opened from.
 *
 * **This is how the month view came back without bringing the mode back with
 * it.** The Agenda used to have a `Month / Day` tab pair, and the arrows on it
 * meant a month on one tab and a day on the other — the same button answering
 * two different questions. A month is now reachable through *one explicit
 * control* (the heading), so the day list stays the only thing permanently on
 * screen and ‹ › keep meaning exactly one thing.
 *
 * It lives in a transparent `Modal` for the same reason `ContextMenu` does: a
 * portal has no ancestor layout, so neither an ancestor's `overflow` nor a
 * stacked `zIndex` can clip it or bury it behind the sidebar.
 */
export function MonthPickerPopover({
  theme,
  anchor,
  selected,
  events,
  onSelectDay,
  onDismiss,
}: {
  theme: Theme;
  anchor: MonthPickerAnchor | null;
  selected: Date;
  events: readonly Event[];
  onSelectDay: (day: Date) => void;
  onDismiss: () => void;
}) {
  const ink = surfaceTheme(theme);
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  // The month being browsed, which is *not* the selected day — paging must not
  // move what is selected, or every page-turn would also change the list below.
  const [browsing, setBrowsing] = useState(selected);

  useEffect(() => {
    if (anchor) setBrowsing(selected);
  }, [anchor, selected]);

  const width = Math.max(MIN_WIDTH, Math.round(winWidth * WIDTH_SHARE));
  // The grid is a constant size, so the popover can be positioned without
  // measuring anything that has only just mounted.
  const height = CARD_HEIGHT;

  /**
   * Escape closes it. On `document` rather than the popover, for the reason
   * `ContextMenu` documents: focus may be on the trigger or on the body, and a
   * subtree listener would miss it entirely.
   */
  useEffect(() => {
    if (!anchor || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [anchor, onDismiss]);

  // Left-aligned under the anchor, flipped and clamped so it never hangs off a
  // narrow screen. `min()` in the style rather than a second measurement: the
  // popover knows its own width, so it does not need to know where it is first.
  const left = anchor
    ? Math.min(
        Math.max(anchor.x, MARGIN),
        Math.max(MARGIN, winWidth - width - MARGIN)
      )
    : 0;
  const top = anchor
    ? Math.min(Math.max(anchor.y, MARGIN), Math.max(MARGIN, winHeight - height - MARGIN))
    : 0;

  const pick = useCallback(
    (day: Date) => {
      onSelectDay(day);
      onDismiss();
    },
    [onSelectDay, onDismiss]
  );

  if (!anchor) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.root} pointerEvents="box-none">
        {/* Backdrop first, so it sits under the card and swallows every tap
            that is not on it. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityLabel="Close the month picker"
          accessibilityRole="button"
        />

        <View
          style={[
            styles.card,
            {
              left,
              top,
              width,
              backgroundColor: theme.surface,
              borderColor: ink.border,
              boxShadow: [
                { offsetX: 0, offsetY: 8, blurRadius: 24, color: theme.shadow },
              ],
            },
          ]}
        >
          <View style={styles.header}>
            <NavIcon
              theme={theme}
              icon="chevron-left"
              label="Previous month"
              onPress={() => setBrowsing((m) => addMonths(m, -1))}
            />
            <Text style={[styles.title, { color: ink.text }]} numberOfLines={1}>
              {monthYearLabel(browsing)}
            </Text>
            <NavIcon
              theme={theme}
              icon="chevron-right"
              label="Next month"
              onPress={() => setBrowsing((m) => addMonths(m, 1))}
            />
          </View>

          <MonthGrid
            theme={theme}
            anchor={browsing}
            events={events}
            selected={selected}
            onSelectDay={pick}
            width={width - (CARD_PAD_X + CARD_BORDER) * 2}
          />
        </View>
      </View>
    </Modal>
  );
}

/** A bare chevron — same rule as the header's icon buttons: no fill, no border. */
function NavIcon({
  theme,
  icon,
  label,
  onPress,
}: {
  theme: Theme;
  icon: 'chevron-left' | 'chevron-right';
  label: string;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      containerStyle={styles.navContainer}
      style={styles.navBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons name={icon} size={20} color={theme.text} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  // `box-none` so the backdrop still receives taps; the card opts back in.
  root: { flex: 1, zIndex: 9999 },
  card: {
    position: 'absolute',
    borderRadius: Radius.modal,
    borderWidth: CARD_BORDER,
    paddingHorizontal: CARD_PAD_X,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
  },
  title: { ...Typography.app.cardHeader, flex: 1, textAlign: 'center' },
  navContainer: { borderRadius: Radius.md },
  navBtn: {
    width: NAV_BTN,
    height: NAV_BTN,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
