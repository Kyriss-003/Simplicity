/**
 * App theme — "Zen" warm-neutral palette built on the 60-30-10 system.
 *
 * 60% canvas → 30% structural surfaces/borders/pills → 10% brand accent.
 * The accent is reserved strictly for the FAB, active navigation indicators,
 * toggles, checkmark highlights, and focused states.
 *
 * `accentText` is dark (#1f1f1f) in every theme on purpose: #f76f53 is a
 * light-mid orange, so dark glyphs clear WCAG AA (~5.7:1) while white would
 * only reach ~2.8:1.
 */

export type ThemeName = 'Dark' | 'OLED' | 'Light';

export interface Theme {
  name: ThemeName;
  /** Root viewport background (60%). */
  background: string;
  /** Card / raised surface background (30%). */
  surface: string;
  /** Sidebar background (30% — matches canvas so cards read as the 30% layer). */
  sidebarBg: string;
  /** Subtle card / divider outline (30%). */
  border: string;
  /** Primary text (30%). */
  text: string;
  /** Secondary / muted text (30%). */
  textMuted: string;
  /** Brand accent (10%). */
  accent: string;
  /** Glyph color rendered on top of `accent`. */
  accentText: string;
  /** Soft pill background (30%). */
  pillBg: string;

  /** Secondary background. */
  backgroundSecondary: string;
  /** Tertiary background. */
  backgroundTertiary: string;
  /** Secondary text. */
  textSecondary: string;
  /** Tertiary text. */
  textTertiary: string;
  /** Disabled text. */
  textDisabled: string;
  /** Text rendered on top of `error`. */
  errorText: string;
  /** Secondary border. */
  borderSecondary: string;
  /** Accent hover state. */
  accentHover: string;
  /** Accent active/pressed state. */
  accentActive: string;

  /** Status colors. */
  error: string;
  warning: string;
  success: string;
  info: string;
}

export const THEMES: Record<ThemeName, Theme> = {
  /* Dark — "Zen Charcoal". */
  Dark: {
    name: 'Dark',
    background: '#1f1f1f',
    surface: '#2a2a2a',
    sidebarBg: '#1f1f1f',
    border: '#383838',
    text: '#f2f0e3',
    textMuted: '#a09e96',
    accent: '#f76f53',
    accentText: '#1f1f1f',
    pillBg: '#383838',
    backgroundSecondary: '#2a2a2a',
    backgroundTertiary: '#383838',
    textSecondary: '#a09e96',
    textTertiary: '#7c7a73',
    textDisabled: '#5a5852',
    errorText: '#1f1f1f',
    borderSecondary: '#313131',
    accentHover: '#ff8567',
    accentActive: '#e6603f',
    error: '#e06c5a',
    warning: '#d9a441',
    success: '#6fa07d',
    info: '#6b9bc4',
  },

  /* OLED — pure black for AMOLED. */
  OLED: {
    name: 'OLED',
    background: '#000000',
    surface: '#121212',
    sidebarBg: '#0a0a0a',
    border: '#222222',
    text: '#ffffff',
    textMuted: '#888888',
    accent: '#f76f53',
    accentText: '#1f1f1f',
    pillBg: '#222222',
    backgroundSecondary: '#121212',
    backgroundTertiary: '#1c1c1c',
    textSecondary: '#888888',
    textTertiary: '#666666',
    textDisabled: '#4a4a4a',
    errorText: '#1f1f1f',
    borderSecondary: '#1a1a1a',
    accentHover: '#ff8567',
    accentActive: '#e6603f',
    error: '#e06c5a',
    warning: '#d9a441',
    success: '#6fa07d',
    info: '#6b9bc4',
  },

  /* Light — "Zen Cream". */
  Light: {
    name: 'Light',
    background: '#f2f0e3',
    surface: '#e8e5d8',
    sidebarBg: '#f2f0e3',
    border: '#dcd8c8',
    text: '#1f1f1f',
    textMuted: '#66645d',
    accent: '#f76f53',
    accentText: '#1f1f1f',
    pillBg: '#dfdbc9',
    backgroundSecondary: '#e8e5d8',
    backgroundTertiary: '#dcd8c8',
    textSecondary: '#66645d',
    textTertiary: '#8a877e',
    textDisabled: '#b3b0a5',
    errorText: '#ffffff',
    borderSecondary: '#e2ded0',
    accentHover: '#e6603f',
    accentActive: '#cf5738',
    error: '#c0392b',
    warning: '#c88a17',
    success: '#4a7c59',
    info: '#3a6ea5',
  },
};

/* ────────────────────────────────────────────────────────────────────── */
/* Design tokens — framework-agnostic constants                          */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Spacing — 4pt base unit. Every layout value in `src/` must come from the
 * approved scale below (or be a multiple of 4).
 */
export const Spacing = {
  unit: 4,
  /** Full scale in px. */
  scale: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    24: 96,
  } as const,
  /** The only approved values for app layout. */
  approved: [4, 8, 12, 16, 24, 32, 48, 64] as const,
  /** Semantic spacing aliases. */
  semantic: {
    gutter: 16,
    sectionGap: 24,
    cardPadding: 16,
    listItemHeight: 48,
    listItemPadding: 12,
  } as const,
  /** Helper: spacing(4) === 16. */
  fn: (n: number) => n * 4,
} as const;

/**
 * Typography — strict 4-size / 2-weight hierarchy.
 * Sizes: 24 (page header) · 18 (card title) · 14 (body) · 12 (caption).
 * Weights: 400 (Regular) · 600 (Semibold). Nothing else is permitted.
 */
export const Typography = {
  app: {
    pageHeader: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32, letterSpacing: 0 },
    pageHeaderRegular: { fontSize: 24, fontWeight: '400' as const, lineHeight: 32, letterSpacing: 0 },
    cardHeader: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24, letterSpacing: 0 },
    cardHeaderRegular: { fontSize: 18, fontWeight: '400' as const, lineHeight: 24, letterSpacing: 0 },
    body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, letterSpacing: 0 },
    bodyStrong: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20, letterSpacing: 0 },
    caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, letterSpacing: 0 },
    captionStrong: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0 },
  } as const,
} as const;

/** Border radius. */
export const Radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
  /** Semantic aliases */
  card: 16,
  button: 8,
  input: 8,
  badge: 16,
  modal: 16,
} as const;

/** Layout — responsive breakpoints. */
export const Layout = {
  screenPadding: 16,
  maxContentWidth: 600,
  breakpoints: {
    mobile: 375,
    tablet: 768,
    desktop: 1024,
  } as const,
} as const;
