import { useRef, useState, type ComponentRef } from 'react';
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import type { ReactNode } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Spacing, Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import { AnimatedPressable } from '../shared/motion';
import { ContextMenu, type ContextMenuAction } from '../shared/ContextMenu';

/** Width of a dropdown control, and of the menu it opens. */
const SELECT_WIDTH = 200;
/** Gap between the control and the menu, and the margin it keeps from the edge. */
const MENU_MARGIN = 8;

/**
 * A labelled group of rows: a bare heading over a raised container.
 *
 * The container is the point. Rows used to sit directly on the canvas separated
 * by hairlines, which reads as a single undifferentiated list however many
 * groups there are — the eye has to parse the text to find where one group ends
 * and the next begins. Lifting the group gives the block an edge of its own, so
 * hierarchy comes from *placement* rather than from more dividers.
 *
 * Note this is a card per **group**, not per heading: a card holding one title
 * and one control is mostly padding, and that version was tried and rejected.
 */
export function SettingsGroup({
  theme,
  title,
  meta,
  children,
}: {
  theme: Theme;
  title: string;
  /** Right-aligned count or summary, e.g. "3/4 shown". */
  meta?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <Text style={[styles.groupLabel, { color: theme.textMuted }]}>{title}</Text>
        {meta ? <Text style={[styles.groupMeta, { color: theme.textMuted }]}>{meta}</Text> : null}
      </View>
      <View
        style={[
          styles.groupCard,
          { backgroundColor: theme.surface, borderColor: theme.onSurfaceBorder },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * One settings row: title, description, and a control on the right.
 *
 * 56px rather than the 48px single-line contract, because a settings row
 * carries a description line and the switch alone would be 48.
 */
export function SettingsRow({
  theme,
  title,
  description,
  control,
  onPress,
  tone = 'default',
  isLast = false,
  accessibilityLabel,
}: {
  theme: Theme;
  title: string;
  description?: string;
  /** Right-hand control. Omit for a plain informational row. */
  control?: ReactNode;
  /** Makes the whole row pressable — for action rows and dropdowns. */
  onPress?: () => void;
  /** `accent` for an action or a value; `muted` for a disabled-looking fact. */
  tone?: 'default' | 'accent' | 'muted';
  isLast?: boolean;
  accessibilityLabel?: string;
}) {
  // Rows are drawn on the group's card, so they take the surface ink.
  const ink = surfaceTheme(theme);

  const body = (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text
          style={[
            styles.rowLabel,
            // Always a colour, before the tone overrides. The two tone branches
            // below are *overrides*, not the base: with the default tone neither
            // fires, so the label fell through to the DOM's inherited colour —
            // which is black, and therefore invisible on the Dark and OLED
            // canvases while looking correct on Light. That is the whole reason
            // a theme cannot be assumed to have saved it.
            { color: ink.text },
            tone === 'accent' && { color: theme.accent },
            tone === 'muted' && { color: ink.textMuted },
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text style={[styles.rowDescription, { color: ink.textMuted }]}>{description}</Text>
        ) : null}
      </View>
      {control}
    </View>
  );

  const bordered = !isLast
    ? ({ borderBottomColor: ink.border, borderBottomWidth: 1 } as const)
    : undefined;

  if (!onPress) return <View style={bordered}>{body}</View>;

  return (
    <AnimatedPressable
      onPress={onPress}
      style={bordered}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {body}
    </AnimatedPressable>
  );
}

/**
 * A dropdown control, pinned to the right of a row.
 *
 * The menu is the shared `ContextMenu` rather than a bespoke popover — it
 * already clamps to the window and escapes ancestor `overflow`.
 *
 * Anchoring uses the press event's window coordinates, not `measureInWindow` on
 * the trigger: a measurement there returned nothing usable and the menu came back
 * pinned to the window's left margin, and a wrong anchor is worse than an
 * approximate one. Since the control is right-aligned in its row, the menu
 * hangs off the window's right edge — where a dropdown under it belongs.
 */
export function SelectRow({
  theme,
  title,
  description,
  value,
  options,
  onSelect,
  preview,
  isLast = false,
}: {
  theme: Theme;
  title: string;
  description: string;
  value: string;
  options: readonly string[];
  onSelect: (option: string) => void;
  /**
   * Rendered under the description, on the same surface.
   *
   * A dropdown that changes something *elsewhere* on another screen has no
   * visible consequence where it was tapped, which reads as a control that does
   * nothing. A preview puts the consequence under the finger.
   */
  preview?: ReactNode;
  isLast?: boolean;
}) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<ComponentRef<typeof Pressable>>(null);
  const { width: winWidth } = useWindowDimensions();

  /**
   * Drops the menu directly under the control, its right edge lined up with the
   * control's own.
   *
   * It used to anchor to the *window's* right margin, which parked the menu in
   * the far corner while the control sat in the middle of the column — the two
   * had no visible relationship, so the menu read as a stray panel that happened
   * to be open. `align="right"` already means "the menu's right edge is
   * `anchor.x`", so the only thing that was wrong was which x was passed.
   *
   * `measureInWindow` is the honest measurement of the control. The press
   * coordinates stay as a fallback because a measurement can come back empty on
   * a not-yet-laid-out node, and a roughly-placed menu beats a detached one.
   */
  const open = (e: GestureResponderEvent) => {
    const fallback = {
      x: winWidth - MENU_MARGIN,
      y: e.nativeEvent.pageY + MENU_MARGIN,
    };
    const node = triggerRef.current;
    if (!node) {
      setAnchor(fallback);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      if (typeof x === 'number' && typeof width === 'number' && width > 0) {
        setAnchor({ x: x + width, y: y + height + MENU_MARGIN });
      } else {
        setAnchor(fallback);
      }
    });
  };

  const actions: ContextMenuAction[] = options.map((option) => ({
    label: option,
    iconName: 'circle-outline',
    selected: option === value,
    onPress: () => onSelect(option),
  }));

  // This row is drawn inside the group's card, so its label and description take
  // the surface ink exactly as `SettingsRow` does. `SelectRow` carries its own
  // copy of the row markup rather than reusing `SettingsRow` — which is how its
  // label was missed the first time the group was lifted onto a surface.
  const ink = surfaceTheme(theme);

  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomColor: ink.border, borderBottomWidth: 1 },
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: ink.text }]}>{title}</Text>
        <Text style={[styles.rowDescription, { color: ink.textMuted }]} numberOfLines={1}>
          {description}
        </Text>
        {preview ? <View style={styles.preview}>{preview}</View> : null}
      </View>

      <AnimatedPressable
        ref={triggerRef}
        onPress={open}
        style={[styles.select, { borderColor: ink.border, backgroundColor: ink.pillBg }]}
        accessibilityLabel={`${title}: ${value}`}
        accessibilityRole="button"
        accessibilityHint={`Change ${title.toLowerCase()}`}
      >
        <Text style={[styles.selectValue, { color: ink.text }]} numberOfLines={1}>
          {value}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color={ink.textMuted} />
      </AnimatedPressable>

      <ContextMenu
        anchor={anchor}
        actions={actions}
        align="right"
        onDismiss={() => setAnchor(null)}
        theme={theme}
      />
    </View>
  );
}

/** A read-only value, right-aligned — for facts to show, not to edit. */
export function ValueRow({
  theme,
  title,
  description,
  value,
  isLast = false,
}: {
  theme: Theme;
  title: string;
  description?: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <SettingsRow
      theme={theme}
      title={title}
      description={description}
      isLast={isLast}
      control={
        <Text style={[styles.value, { color: surfaceTheme(theme).textMuted }]}>{value}</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  groupLabel: { ...Typography.app.captionStrong, textTransform: 'uppercase' },
  groupMeta: { ...Typography.app.caption },
  /**
   * The raised container. Its padding is what lets the row dividers read as
   * *inside* the card rather than as rules cutting across the canvas.
   *
   * `Radius.card` rather than `Radius.lg`: this is a full-width list block, and
   * at 12px the corners read as almost square next to the 44px controls inside
   * it. 16 is the top of the scale short of a pill, so it is as round as the
   * radius can go without leaving the token system.
   */
  groupCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { ...Typography.app.body },
  rowDescription: { ...Typography.app.caption, marginTop: 2 },
  /** Sits under the description, aligned to the same 8px rhythm. */
  preview: { marginTop: 8, alignItems: 'flex-start' },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: SELECT_WIDTH,
    maxWidth: '55%',
    height: Spacing.semantic.listItemHeight,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  selectValue: { ...Typography.app.body, flex: 1 },
  value: { ...Typography.app.body, flexShrink: 0, textAlign: 'right' },
});
