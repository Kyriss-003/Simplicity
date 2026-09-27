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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Typography, type Theme } from '../../theme';

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
): { left: number; top: number } {
  // Approximate menu height (48px rows + padding).
  const menuHeight = actionCount * ROW_HEIGHT + 8;

  let left = anchor.x;
  if (left + MENU_WIDTH > winWidth) {
    // Flip leftward of the cursor.
    left = anchor.x - MENU_WIDTH;
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
}: {
  anchor: ContextMenuState | null;
  actions: ContextMenuAction[];
  onDismiss: () => void;
  theme: Theme;
}) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const scale = useRef(new Animated.Value(0)).current;
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

  // `anchor` is null whenever the menu is closed; the Modal's `visible` prop
  // keeps that state off screen, so the position falls back to the margin.
  const position = anchor
    ? resolveMenuPosition(anchor, actions.length, winWidth, winHeight)
    : { left: MIN_MARGIN, top: MIN_MARGIN };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <View style={styles.root} pointerEvents="box-none">
        {/* Backdrop — dismiss on outside tap */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <Animated.View
          style={[
            styles.menu,
            {
              left: position.left,
              top: position.top,
              backgroundColor: theme.surface,
              borderColor: theme.border,
              transform: [{ scale }],
              opacity: scale.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
            },
          ]}
        >
          {actions.map((action) => {
            const color = action.destructive ? theme.error : theme.text;
            return (
              <Pressable
                key={action.label}
                onPress={() => {
                  onDismiss();
                  action.onPress();
                }}
                style={({ pressed }) => [
                  styles.actionRow,
                  { backgroundColor: pressed ? theme.pillBg : 'transparent' },
                ]}
                accessibilityLabel={action.label}
              >
                <MaterialCommunityIcons name={action.iconName} size={16} color={color} />
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
});
