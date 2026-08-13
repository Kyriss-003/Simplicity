/**
 * App theme palettes. The dashboard components consume these tokens instead of
 * hard-coded colors so the {@link ThemeSwitcher} can reskin the whole UI at once.
 */
export type ThemeName = 'Dark' | 'OLED' | 'Light';

export interface Theme {
  name: ThemeName;
  /** Root viewport background. */
  background: string;
  /** Card / raised surface background. */
  surface: string;
  /** Subtle card / divider outline. */
  border: string;
  /** Sidebar background. */
  sidebarBg: string;
  /** Primary text. */
  text: string;
  /** Secondary / muted text. */
  textMuted: string;
  /** Accent (highlights, active nav, action pill). */
  accent: string;
  /** Accent text on top of `accent`. */
  accentText: string;
  /** Soft pill background. */
  pillBg: string;
}

export const THEMES: Record<ThemeName, Theme> = {
  Dark: {
    name: 'Dark',
    background: '#0D0D0E',
    surface: '#161618',
    border: '#232326',
    sidebarBg: '#161618',
    text: '#f4f4f5',
    textMuted: '#a1a1aa',
    accent: '#B497FF',
    accentText: '#0D0D0E',
    pillBg: '#232326',
  },
  OLED: {
    name: 'OLED',
    background: '#000000',
    surface: '#0a0a0a',
    border: '#1c1c1e',
    sidebarBg: '#000000',
    text: '#f4f4f5',
    textMuted: '#71717a',
    accent: '#B497FF',
    accentText: '#000000',
    pillBg: '#18181b',
  },
  Light: {
    name: 'Light',
    background: '#f4f4f5',
    surface: '#ffffff',
    border: '#e4e4e7',
    sidebarBg: '#fafafa',
    text: '#18181b',
    textMuted: '#71717a',
    accent: '#A855F7',
    accentText: '#ffffff',
    pillBg: '#e4e4e7',
  },
};
