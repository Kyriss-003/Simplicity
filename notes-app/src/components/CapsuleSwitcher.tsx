import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from './shared/icons';
import Animated from 'react-native-reanimated';
import { Radius, Typography, surfaceTheme, type Theme } from '../theme';
import { DOCK_SCREENS, type DockVariant, type ScreenKey } from '../types';
import { AnimatedPressable, useSlidingPill } from './shared/motion';

interface CapsuleItem {
  key: ScreenKey;
  label: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
}

const ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Overview: 'view-dashboard-outline',
  Notes: 'note-text-outline',
  Agenda: 'calendar-month-outline',
};

const ITEMS: CapsuleItem[] = DOCK_SCREENS.map((key) => ({
  key,
  label: key,
  iconName: ICONS[key],
}));

/** Glyph size for a dock icon — the 16px icon row used across the app. */
const ICON_SIZE = 14;

/**
 * Bottom dock: the screen switcher, shown on ALL screen sizes.
 *
 * A single pill slides between the selected segments rather than each segment
 * painting its own background, which is what makes the switch read as one
 * control moving instead of three buttons blinking.
 *
 * The segments live in a zero-padding `track` view. That is deliberate: the
 * sliding pill is absolutely positioned and its `onLayout` measurements come
 * from the segments, so if the track carried padding the two would be measured
 * against different origin boxes and the pill would land off by the padding.
 *
 * Markdown formatting deliberately does **not** live here. It already has a
 * home in the scratch-pad toolbar, and a second set of glyph buttons in the
 * dock read as broken letterforms (`B`, `I`, `H2`) rather than controls —
 * especially next to the tabs they were not related to.
 */
export function CapsuleSwitcher({
  theme,
  active,
  onSelect,
  variant = 'iconLabel',
}: {
  theme: Theme;
  active: ScreenKey;
  onSelect: (k: ScreenKey) => void;
  variant?: DockVariant;
}) {
  const { style: pillStyle, measure } = useSlidingPill(active);
  // The whole dock is one surface, so its labels and pill take the surface ink.
  const ink = surfaceTheme(theme);
  // The selected segment inverts: a black pill on the light themes, a white one
  // on the dark themes, so the selection is always the strongest thing on the
  // bar. `primaryTheme` cannot do this — it is the *identity* for a single-ink
  // theme, so on Dark / OLED it would hand back the dock's own fill and the
  // selection would vanish. Colour no longer signals selection either, because
  // the icons all carry the accent, so the label flips with the pill.
  const { selectedFill, selectedText } = theme;

  /**
   * The dock's icons are the theme's own ink, not the accent: they read
   * as part of the bar's typography and *invert* with the theme — black
   * glyphs on the light canvases, white on the dark ones — instead of
   * staying one fixed accent colour on every theme. The selected segment
   * sits on the pill, so its icon takes the pill's own paired text
   * colour (`selectedText`), which is the inverse of the dock's ink and
   * therefore always the strongest mark on the bar.
   *
   * Resolving against the ink rather than the accent also removes the
   * monochrome-accent collision the accent path had to work around: an
   * ink colour is, by construction, readable on its own surface, so
   * there is no vanished-glyph case left to fall back from.
   */
  const iconOnDock = ink.text;
  const iconOnPill = selectedText;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.surfaceRaised,
          borderColor: ink.border,
          boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 12, color: theme.shadow }],
        },
      ]}
    >
      <View style={styles.track}>
        <Animated.View
          style={[styles.pill, { backgroundColor: selectedFill }, pillStyle]}
        />
        {ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            // Measured on a plain `View` slot, not on the pressable — see the
            // identical wrapper in `SectionHeader`. `AnimatedPressable` inserts
            // its own wrapper between the pressable and this track, so a
            // pressable-level `onLayout` reports `x: 0` for every segment and
            // the pill never leaves the first slot.
            <View key={item.key} style={styles.slot} onLayout={(e) => measure(item.key, e)}>
              <AnimatedPressable
                onPress={() => onSelect(item.key)}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: isActive }}
                style={[styles.item, variant === 'icon' && styles.itemIconOnly]}
              >
                {variant !== 'label' ? (
                  <MaterialCommunityIcons
                    name={item.iconName}
                    size={ICON_SIZE}
                    color={isActive ? iconOnPill : iconOnDock}
                    style={styles.icon}
                  />
                ) : null}
                {variant !== 'icon' ? (
                  <Text
                    style={[
                      styles.label,
                      { color: isActive ? selectedText : ink.textMuted },
                    ]}
                  >
                    {item.label}
                  </Text>
                ) : null}
              </AnimatedPressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    padding: 4,
    gap: 2,
  },
  /** Zero padding, so segment `onLayout` x matches the pill's absolute origin. */
  track: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  /** Positioning-only slot for one segment; carries no box of its own. */
  slot: { flexShrink: 0 },
  pill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: Radius.full,
    pointerEvents: 'none',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    /** Horizontal padding 8 -> 3. The three labels are most of the bar's width,
        so this is the only lever that shortens it: the bar was stretched out
        and flat at 8. 3 still clears the sliding pill behind the label. */
    paddingHorizontal: 3,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  /** A compact but comfortably tappable segment when labels are hidden. */
  itemIconOnly: { minWidth: 40, minHeight: 36, paddingHorizontal: 8 },
  previewContainer: { alignSelf: 'flex-start', padding: 3, gap: 1 },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 24,
    paddingHorizontal: 6,
    borderRadius: Radius.full,
  },
  previewIconOnly: { minWidth: 28, paddingHorizontal: 6 },
  previewLabel: { ...Typography.app.captionStrong, lineHeight: 14 },
/**
   * The glyph is a text node in an icon font, and its ink does not sit in the
   * middle of its line box the way a word's does — the font is drawn with its
   * artwork on the cap-height band, so a 16px line box centred on the label's
   * still paints the icon visibly above it.
   *
   * The nudge below was measured off the rendered pixels, not the boxes: with no
   * offset at all, the two elements' `getBoundingClientRect()` centres are
   * *identical*, which is what made this look like a bug that could not be
   * found by reading the layout. 2px is where all three icons read as level with
   * their labels at this size; the icons are 14px against 12px labels, so the
   * offset is specific to that pair and would need re-measuring if either
   * changed.
   */
  icon: { lineHeight: 16, transform: [{ translateY: 2 }] },
  /** lineHeight matches the segment's content height so the label sits on the
      icon's optical centre rather than riding above it. */
  label: { ...Typography.app.captionStrong, lineHeight: 16, textAlign: 'center' },
});

/** Small live sample for the screen-switcher preference. */
export function DockVariantPreview({
  theme,
  variant,
}: {
  theme: Theme;
  variant: DockVariant;
}) {
  const ink = surfaceTheme(theme);
  const { selectedFill, selectedText } = theme;
  // The icons take the theme's own ink (see `CapsuleSwitcher`): they
  // invert black/white with the theme rather than carrying the accent.
  const iconOnDock = ink.text;
  const iconOnPill = selectedText;

  return (
    <View
      style={[
        styles.container,
        styles.previewContainer,
        { backgroundColor: theme.surfaceRaised, borderColor: ink.border },
      ]}
    >
      {ITEMS.map((item, index) => {
        const isActive = index === 0;
        return (
          <View
            key={item.key}
            style={[
              styles.previewItem,
              isActive && { backgroundColor: selectedFill },
              variant === 'icon' && styles.previewIconOnly,
            ]}
          >
            {variant !== 'label' ? (
              <MaterialCommunityIcons
                name={item.iconName}
                size={12}
                color={isActive ? iconOnPill : iconOnDock}
              />
            ) : null}
            {variant !== 'icon' ? (
              <Text
                style={[
                  styles.previewLabel,
                  { color: isActive ? selectedText : ink.textMuted },
                ]}
              >
                {item.label}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
