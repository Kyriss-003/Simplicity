import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

// Barrel re-export — every component imports from here instead of directly
// from @expo/vector-icons, so Metro resolves the package once instead of 30+ times.
export { MaterialCommunityIcons, Ionicons };