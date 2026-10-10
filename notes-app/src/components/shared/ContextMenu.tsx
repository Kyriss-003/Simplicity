import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Modal,
  useWindowDimensions,
  Platform,
  type AccessibilityRole,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';

/** Estimated menu width for viewport clamping. */
const MENU_WIDTH = 224;

/** Row height of a single action — 8pt grid rule. */
const ROW_HEIGHT = 48;

/** Smallest gap allowed between the menu and the window edge. */
const MIN_MARGIN = 8;

export interface ContextMenuAction {
  label: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
  /** Renders a dimmed, non-activatable row — used for section separators. */
  disabled?: boolean;
  /**
   * Single-choice menus: renders a radio dot that fills when selected and tints
   * the label. Leave `undefined` for command menus, which have no selection.
   */
  selected?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
}

/**
 * Keeps the menu fully on screen. Opens rightward/downward from the cursor
 * when there is room, otherwise flips leftward or shifts upward, and is
 * finally clamped to a minimum margin on both axes.
 */
function resolveMenuPosition(
  anchor: ContextMenuState,
  actionCount: number,
  winWidth: number,
  winHeight: number,
  align: 'left' | 'right',
): { left: number; top: number } {
  // Approximate menu height (48px rows + padding).
  const menuHeight = actionCount * ROW_HEIGHT + 8;

  // `right` lines the menu's right edge up with the anchor; `left` starts there.
  let left = align === 'right' ? anchor.x - MENU_WIDTH : anchor.x;
  if (left < MIN_MARGIN) {
    // The anchor is nearer the left edge than the menu is wide — put it back on
    // screen rather than letting the clamp above push it to the far margin.
    left = align === 'right' ? anchor.x : MIN_MARGIN;
  }
  if (left + MENU_WIDTH > winWidth) {
    // Flip leftward of the anchor.
    left = Math.max(MIN_MARGIN, anchor.x - MENU_WIDTH);
  }
  left = Math.max(MIN_MARGIN, Math.min(left, winWidth - MENU_WIDTH - MIN_MARGIN));

  let top = anchor.y;
  if (top + menuHeight > winHeight) {
    // Shift upward so the menu never runs off the bottom edge.
    top = anchor.y - menuHeight;
  }
  top = Math.max(MIN_MARGIN, Math.min(top, winHeight - menuHeight - MIN_MARGIN));

  return { left, top };
}

/**
 * Right-click / long-press popup menu. Teleported into a transparent `Modal`
 * so it lives in a true root layer: inside a modal there is no ancestor
 * layout, so absolute coordinates are window-relative and neither ancestor
 * `overflow` nor ancestor `zIndex` can clip or bury it. Dismisses on outside
 * tap, hardware back, or action press. Rows are strictly 48px tall.
 */
export function ContextMenu({
  anchor,
  actions,
  onDismiss,
  theme,
  align = 'left',
}: {
  anchor: ContextMenuState | null;
  actions: ContextMenuAction[];
  onDismiss: () => void;
  theme: Theme;
  /**
   * Which edge of the anchor the menu lines up with. `right` is for a control
   * pinned to the right of a row, where the menu should hang off the control's
   * right edge rather than starting at it.
   */
  align?: 'left' | 'right';
}) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const scale = useRef(new Animated.Value(0)).current;
  const itemRefs = useRef<Array<View | null>>([]);
  const visible = anchor !== null;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: visible ? 1 : 0,
      // Web has no native animated module — the flag must be false there.
      useNativeDriver: Platform.OS !== 'web',
      damping: 20,
      stiffness: 250,
      mass: 0.6,
    }).start();
  }, [visible, scale]);

  /**
   * Web-only keyboard handling, and the reason the listener lives on `document`
   * rather than on the menu: while the menu is open it sits in a `Modal`, so
   * focus may be on the trigger or on the body, and a keydown that only reached
   * the menu's own subtree would miss Escape entirely.
   *
   * Arrow keys move focus between rows and Enter activates the focused one, which
   * is the ARIA menu pattern. Every listener is torn down on unmount and on
   * close, so nothing survives the menu.
   */
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;

    const focusRow = (index: number) => {
      const node = itemRefs.current[index] as unknown as { focus?: () => void } | null;
      // Guarded: if the platform has not made the row focusable, this is a
      // no-op rather than a crash.
      node?.focus?.();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
        return;
      }
      const current = document.activeElement;
      const index = itemRefs.current.findIndex(
        (ref) => ref !== null && (ref as unknown as Node) === current
      );
      if (index === -1) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          focusRow(0);
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusRow((index + 1) % actions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusRow((index - 1 + actions.length) % actions.length);
      } else if (e.key === 'Home') {
        e.preventDefault();
        focusRow(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        focusRow(actions.length - 1);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onDismiss, actions.length]);

  // `anchor` is null whenever the menu is closed; the Modal's `visible` prop
  // keeps that state off screen, so the position falls back to the margin.
  const position = anchor
    ? resolveMenuPosition(anchor, actions.length, winWidth, winHeight, align)
    : { left: MIN_MARGIN, top: MIN_MARGIN };

  // The menu panel is a surface, so its rows take the surface ink.
  const ink = surfaceTheme(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <View style={styles.root}>
        {/* Backdrop — dismiss on outside tap */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <Animated.View
          accessibilityRole="menu"
          style={[
            styles.menu,
            {
              left: position.left,
              top: position.top,
              backgroundColor: theme.surfaceRaised,
              borderColor: ink.border,
              transform: [{ scale }],
              opacity: scale.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
            },
          ]}
        >
          {actions.map((action, actionIndex) => {
            const isChoice = action.selected !== undefined;
            const color = action.destructive
              ? ink.error
              : isChoice && action.selected
                ? theme.accent
                : ink.text;
            return (
              <Pressable
                key={action.label}
                ref={(node) => {
                  itemRefs.current[actionIndex] = node;
                }}
                // Makes the row a tab stop on web so ArrowUp/Down can move
                // between them; ignored on native.
                focusable
                onPress={() => {
                  onDismiss();
                  action.onPress();
                }}
                style={({ pressed }) => [
                  styles.actionRow,
                  { backgroundColor: pressed ? ink.pillBg : 'transparent' },
                ]}
                accessibilityLabel={action.label}
                // RN's `AccessibilityRole` union predates the ARIA menu roles, so
                // they are cast rather than silently downgraded to "none".
                accessibilityRole={
                  (isChoice ? 'menuitemradio' : 'menuitem') as AccessibilityRole
                }
                accessibilityState={
                  isChoice
                    ? { selected: action.selected }
                    : { disabled: action.disabled }
                }
              >
                {isChoice ? (
                  // A dropdown's options read as a radio group. Leading every
                  // option with its own icon *and* a trailing check was two
                  // indicators for one bit of state, and the hollow ring plus
                  // tick read as "not selected but checked".
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor: action.selected ? theme.accent : ink.border,
                        backgroundColor: action.selected ? theme.accent : 'transparent',
                      },
                    ]}
                  />
                ) : (
                  <MaterialCommunityIcons name={action.iconName} size={16} color={color} />
                )}
                <Text style={[styles.actionLabel, { color }]} numberOfLines={1}>
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    // RN 0.86 deprecates the `pointerEvents` prop in favour of the style key.
    pointerEvents: 'box-none',
  },
  menu: {
    position: 'absolute',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 4,
    minWidth: MENU_WIDTH,
    boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 24, color: 'rgba(0,0,0,0.35)' }],
    elevation: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  actionLabel: { ...Typography.app.body, flex: 1, minWidth: 0 },
  /** 12px radio dot, matching the size of the icons it replaces. */
  radio: {
    width: 12,
    height: 12,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignSelf: 'center',
  },
});
