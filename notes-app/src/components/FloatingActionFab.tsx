import { useEffect, useRef } from 'react';
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
import { BlurView } from 'expo-blur';
import type { Theme } from '../theme';

interface FabAction {
  label: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
}

const SPRING_CONFIG = { damping: 18, stiffness: 200, mass: 0.8 };

/** Perceived-luminance check to pick a dark or light backdrop tint. */
function isLightBackground(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

/**
 * Floating Action Button with Reanimated spring animations.
 * Expands on hover (desktop) and tap (mobile), auto-closes when the
 * pointer leaves the FAB area on web. Visible on all screen sizes.
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

  const fabIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` }],
  }));

  const wrapRef = useRef<View>(null);
  const lightBg = isLightBackground(theme.background);

  // Web: wrap View is a hover boundary that keeps the menu state stable
  // while the pointer is inside and cancels any pending auto-close.
  // Opening is driven solely by the trigger button's onHoverIn below
  // (the layout box alone must not open the menu).
  useEffect(() => {
    if (Platform.OS !== 'web' || !wrapRef.current) return;
    // @ts-ignore — RNW exposes the underlying DOM node on the ref.
    const el = wrapRef.current as unknown as HTMLElement;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const onEnter = () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = undefined;
      }
      // No toggle here — hovering the layout box alone must not open.
    };
    const onLeave = () => {
      if (closeTimer) return; // already armed
      closeTimer = setTimeout(() => {
        closeTimer = undefined;
        if (isOpen) onToggle();
      }, 150);
    };
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      if (closeTimer) clearTimeout(closeTimer);
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [isOpen, onToggle]);

  return (
    <>
      {/* Blurred backdrop — closes menu when tapping outside (mobile/desktop) */}
      {isOpen ? (
        <Pressable
          style={[
            styles.backdrop,
            Platform.OS === 'web' && {
              // @ts-ignore — RNW maps this to the CSS backdrop-filter property.
              backdropFilter: 'blur(1px)',
              WebkitBackdropFilter: 'blur(1px)',
              backgroundColor: lightBg ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
            },
          ]}
          onPress={onToggle}
        >
          {Platform.OS !== 'web' ? (
            <BlurView
              intensity={5}
              tint={lightBg ? 'light' : 'dark'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </Pressable>
      ) : null}

      <View ref={wrapRef} style={styles.wrap}>
        {/* Pointer-events disabled while closed so invisible items don't
            intercept outside taps. */}
        <View style={[styles.menuColumn, { pointerEvents: isOpen ? 'auto' : 'none' }]}>
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

        <Pressable
          onPress={onToggle}
          onHoverIn={() => {
            if (!isOpen) onToggle();
          }}
          style={[styles.fab, { backgroundColor: theme.accent }]}
          accessibilityLabel="Create new"
        >
          <Animated.View style={fabIconStyle}>
            <MaterialCommunityIcons name="plus" size={26} color={theme.accentText} />
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

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
  // Stagger offset delays each item's animation start.
  const staggerOffset = index / total;

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

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={action.onPress}
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

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 19,
    pointerEvents: 'auto',
  },
  wrap: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    alignItems: 'flex-end',
    gap: 0,
    zIndex: 20,
    pointerEvents: 'box-none',
  },
  menuColumn: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    boxShadow: [
      { offsetX: 0, offsetY: 4, blurRadius: 10, color: 'rgba(0,0,0,0.2)' },
    ],
    elevation: 6,
  },
  menuLabelWrap: { flexShrink: 1 },
  menuLabel: { fontSize: 14, fontWeight: '600' },
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
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: [
      { offsetX: 0, offsetY: 4, blurRadius: 10, color: 'rgba(0,0,0,0.25)' },
    ],
    elevation: 8,
  },
});
