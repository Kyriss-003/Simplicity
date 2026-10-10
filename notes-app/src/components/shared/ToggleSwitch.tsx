import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Motion, Radius, surfaceTheme, type Theme } from '../../theme';

/** Track size — both dimensions are on the 4pt grid. */
const TRACK_WIDTH = 40;
const TRACK_HEIGHT = 24;
const KNOB_SIZE = 16;
const KNOB_INSET = 4;
/** Travel of the knob between the two end stops. */
const KNOB_TRAVEL = TRACK_WIDTH - KNOB_SIZE - KNOB_INSET * 2;

/**
 * On/off switch: the knob slides and the track cross-fades to the accent
 * together, driven by a single shared value — so the two can never disagree,
 * which is the failure mode of a switch whose track and knob are styled from
 * separate booleans.
 *
 * Deliberately plain. A labelled variant (`Enabled` / `Disabled` inside the
 * track) was tried and reverted: at 64px wide it eats the row's text on narrow
 * layouts and the label only ever restates the knob position.
 *
 * `onPress` is optional: pass it when the switch is the only tap target, omit it
 * when a surrounding row already handles the press. Nesting a pressable inside
 * another pressable makes the inner one win on web and the outer one win on
 * native, so the app should never need it.
 */
export function ToggleSwitch({
  theme,
  value,
  onPress,
  accessibilityLabel,
}: {
  theme: Theme;
  value: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, Motion.spring.snappy);
  }, [value, progress]);

  // The switch only ever appears inside a settings group, so its "off" states
  // are drawn against that card rather than the canvas. Using `theme.border` /
  // `theme.textMuted` here would put a light-grey track on a dark card — louder
  // than the row it sits in, which is the wrong way round for a control.
  const ink = surfaceTheme(theme);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [ink.border, theme.accent]),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [ink.textMuted, theme.accentText]
    ),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, KNOB_TRAVEL]) }],
  }));

  const track = (
    <Animated.View style={[styles.track, trackStyle]}>
      <Animated.View style={[styles.knob, knobStyle]} />
    </Animated.View>
  );

  if (!onPress) {
    return (
      <View
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: value }}
      >
        {track}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
    >
      {track}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: Radius.full,
    paddingHorizontal: KNOB_INSET,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: Radius.full,
  },
});
