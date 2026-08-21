import { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, useWindowDimensions, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Theme } from '../../theme';

/** Destructive actions render in red instead of the lavender accent. */
const DESTRUCTIVE_COLOR = '#EF4444';

/** Estimated menu width for viewport clamping. */
const MENU_WIDTH = 224;

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
 * Right-click / long-press popup menu. Rendered above all content at the
 * anchor coordinates; dismisses on outside tap or action press. Rows are
 * strictly 48px tall (8pt grid rule).
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

  if (!visible) return null;

  // Approximate menu height for viewport clamping (48px rows + padding).
  const MENU_HEIGHT = actions.length * 48 + 8;
  const left = Math.min(anchor.x, winWidth - MENU_WIDTH - 8);
  const top = Math.min(anchor.y, winHeight - MENU_HEIGHT - 8);

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Backdrop — dismiss on outside tap */}
      <Pressable style={styles.backdrop} onPress={onDismiss} />

      <Animated.View
        style={[
          styles.menu,
          {
            left: Math.max(8, left),
            top: Math.max(8, top),
            backgroundColor: theme.surface,
            borderColor: theme.border,
            transform: [{ scale }],
            opacity: scale.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
          },
        ]}
      >
        {actions.map((action) => {
          const color = action.destructive ? DESTRUCTIVE_COLOR : theme.text;
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
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menu: {
    position: 'absolute',
    borderRadius: 12,
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
    borderRadius: 8,
  },
  actionLabel: { fontSize: 14, fontWeight: '400', flex: 1, minWidth: 0 },
});
