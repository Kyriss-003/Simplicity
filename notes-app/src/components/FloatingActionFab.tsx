import React, { useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Theme } from '../theme';

interface FabAction {
  label: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
}

const SPRING_CONFIG = { damping: 18, stiffness: 200, mass: 0.8 };

/**
 * Floating Action Button with smooth Reanimated spring transitions.
 * Expands on hover (desktop) and tap (mobile). Auto-closes when the
 * pointer leaves the FAB area on web. Shown on ALL screen sizes.
 */
export function FloatingActionFab({
  theme,
  isOpen,
  onToggle,
  actions,
}: {
  theme: Theme;
  isOpen: boolean;
  onToggle: () => void;
  actions: FabAction[];
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(isOpen ? 1 : 0, SPRING_CONFIG);
  }, [isOpen, progress]);

  // Close on outside tap when open
  const handleBackdropPress = useCallback(() => {
    if (isOpen) onToggle();
  }, [isOpen, onToggle]);

  const fabIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` }],
  }));

  return (
    <>
      {/* Backdrop — closes menu when tapping outside (mobile/desktop) */}
      {isOpen ? (
        <Pressable style={backdropStyles.backdrop} onPress={handleBackdropPress} />
      ) : null}

      <View style={styles.wrap}>
        {/* Expanded action menu */}
        <View style={styles.menuColumn}>
          {actions.map((action, index) => (
            <FabMenuItem
              key={action.label}
              action={action}
              theme={theme}
              progress={progress}
              index={index}
              total={actions.length}
            />
          ))}
        </View>

        {/* Main FAB button */}
        {/* @ts-ignore — onHoverIn is a web-only prop */}
        <Pressable
          onPress={onToggle}
          onHoverIn={() => {
            if (Platform.OS === 'web' && !isOpen) onToggle();
          }}
          style={[styles.fab, { backgroundColor: theme.surface, borderColor: theme.border }]}
          accessibilityLabel="Create new"
        >
          <Animated.View style={fabIconStyle}>
            <MaterialCommunityIcons name="plus" size={26} color={theme.text} />
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Individual menu item — slides in with staggered spring              */
/* ------------------------------------------------------------------ */

function FabMenuItem({
  action,
  theme,
  progress,
  index,
  total,
}: {
  action: FabAction;
  theme: Theme;
  progress: SharedValue<number>;
  index: number;
  total: number;
}) {
  // Stagger: each item starts slightly later
  const staggerOffset = total > 1 ? index / total : 0;

  const animStyle = useAnimatedStyle(() => {
    const itemProgress = interpolate(
      progress.value,
      [staggerOffset, Math.min(staggerOffset + 0.5, 1)],
      [0, 1],
      'clamp'
    );
    return {
      opacity: withTiming(itemProgress, { duration: 200, easing: Easing.out(Easing.ease) }),
      transform: [
        { translateY: withSpring(interpolate(itemProgress, [0, 1], [10, 0]), SPRING_CONFIG) },
        { scale: withSpring(itemProgress, SPRING_CONFIG) },
      ],
    };
  });

  const handlePress = () => {
    action.onPress();
  };

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[styles.menuItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.menuLabelWrap}>
          <Text style={[styles.menuLabel, { color: theme.text }]}>{action.label}</Text>
        </View>
        <View style={[styles.menuIconBox, { backgroundColor: theme.pillBg }]}>
          <MaterialCommunityIcons name={action.iconName} size={16} color={theme.text} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const backdropStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    zIndex: 19,
    pointerEvents: 'auto',
  },
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 78,
    right: 18,
    alignItems: 'flex-end',
    gap: 10,
    zIndex: 20,
    pointerEvents: 'box-none',
  },
  menuColumn: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    boxShadow: [
      { offsetX: 0, offsetY: 4, blurRadius: 10, color: 'rgba(0,0,0,0.2)' },
    ],
    elevation: 6,
  },
  menuLabelWrap: { flexShrink: 1 },
  menuLabel: { fontSize: 13, fontWeight: '600' },
  menuIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: [
      { offsetX: 0, offsetY: 4, blurRadius: 10, color: 'rgba(0,0,0,0.25)' },
    ],
    elevation: 8,
  },
});
