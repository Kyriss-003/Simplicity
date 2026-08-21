/**
 * App theme — Claude.ai Design System adapted to Notes App's 60-30-10 system.
 *
 * The dashboard components consume these tokens instead of hard-coded colors
 * so the ThemeSwitcher can reskin the whole UI at once.
 *
 * Adaptation notes (Claude → App):
 * - Claude's semantic palette (background / text / border / accent / status) is
 *   mapped onto the app's 60-30-10 distribution: background 60% (canvas),
 *   surface/sidebar/borders/pills 30% (structure), accent 10% (actions).
 * - Three app themes are preserved: Dark, OLED, Light. Dark maps to Claude's
 *   dark mode, Light to Claude's light mode, OLED is a pure-black variant
 *   of dark for AMOLED/battery saving.
 * - Original lavender accent (#B497FF / #8B5CF6) → Claude teal (#10A37F)
 *   with hover/active/light variants. Accent remains 10% only.
 * - Lavender → teal is the single intentional brand shift; all other tokens
 *   follow Claude's premium neutral scale (improved contrast vs old warm
 *   charcoal #141413 / muted grays).
 * - Strict app constraints are kept: StyleSheet.create + theme props,
 *   60-30-10, 8pt/4pt grid, typography hierarchy. New tokens are additive
 *   and do not break existing `theme.background` / `theme.surface` etc.
 * - Platform fonts: iOS SF Pro Display, Android Roboto (system fonts).
 */

export type ThemeName = 'Dark' | 'OLED' | 'Light';

export interface Theme {
  name: ThemeName;
  /** Root viewport background (60% of the 60-30-10 distribution). */
  background: string;
  /** Card / raised surface background (30%). */
  surface: string;
  /** Sidebar background (30% — may differ from surface in Dark/OLED). */
  sidebarBg: string;
  /** Subtle card / divider outline (30%). */
  border: string;
  /** Primary text (30%). */
  text: string;
  /** Secondary / muted text (30%). */
  textMuted: string;
  /** Accent — Claude teal, reserved for active highlights, primary actions, toggles (10%). */
  accent: string;
  /** Accent text rendered on top of `accent`. */
  accentText: string;
  /** Soft pill background (30%). */
  pillBg: string;

  // ── Claude semantic extensions (additive, non-breaking) ────────────────
  /** Secondary background (Claude background.secondary). */
  backgroundSecondary: string;
  /** Tertiary background (Claude background.tertiary). */
  backgroundTertiary: string;
  /** Secondary text — same value as textMuted alias for Claude text.secondary. */
  textSecondary: string;
  /** Tertiary text (Claude text.tertiary). */
  textTertiary: string;
  /** Disabled text (Claude text.disabled). */
  textDisabled: string;
  /** Inverse text (Claude text.inverse). */
  textInverse: string;
  /** Secondary border (Claude border.secondary). */
  borderSecondary: string;
  /** Tertiary border (Claude border.tertiary). */
  borderTertiary: string;
  /** Accent hover state. */
  accentHover: string;
  /** Accent active/pressed state. */
  accentActive: string;
  /** Accent light tint (for badges / subtle fills). */
  accentLight: string;
  /** Inverse background (for elevated cards on dark). */
  inverse: string;
  /** Status colors — semantic, not theme-dependent beyond light/dark. */
  error: string;
  warning: string;
  success: string;
  info: string;
}

export const THEMES: Record<ThemeName, Theme> = {
  /* ------------------------------------------------------------------ */
  /* Dark — Claude Dark adapted to 60-30-10.                            */
  /* 60% canvas → #0D0D0D (Claude bg primary)                            */
  /* 30% surface/sidebar/borders → #1A1A1B / #2D2D2D / #3F3F46           */
  /* 10% accent → #10A37F Claude teal (was #B497FF lavender).            */
  /* ------------------------------------------------------------------ */
  Dark: {
    name: 'Dark',
    background: '#0D0D0D',
    surface: '#1A1A1B',
    sidebarBg: '#1A1A1B',
    border: '#2D2D2D',
    text: '#FFFFFF',
    textMuted: '#C5C5D2',
    accent: '#10A37F',
    accentText: '#FFFFFF',
    pillBg: '#2D2D2D',
    // extensions
    backgroundSecondary: '#1A1A1B',
    backgroundTertiary: '#2D2D2D',
    textSecondary: '#C5C5D2',
    textTertiary: '#8B8BA8',
    textDisabled: '#565869',
    textInverse: '#0D0D0D',
    borderSecondary: '#2D2D2D',
    borderTertiary: '#1F1F23',
    accentHover: '#13B896',
    accentActive: '#0E8A6F',
    accentLight: '#1C4D39',
    inverse: '#FFFFFF',
    error: '#F44336',
    warning: '#FF9800',
    success: '#4CAF50',
    info: '#2196F3',
  },

  /* ------------------------------------------------------------------ */
  /* OLED — pure black variant of Dark for AMOLED.                       */
  /* 60% canvas → #000000 · 30% surface/borders → #0A-#1F ·             */
  /* 10% accent → #10A37F Claude teal.                                   */
  /* Preserves OLED's extra-deep differentiation vs Dark's #0D0D0D.      */
  /* ------------------------------------------------------------------ */
  OLED: {
    name: 'OLED',
    background: '#000000',
    surface: '#121214',
    sidebarBg: '#0A0A0C',
    border: '#1F1F22',
    text: '#ECECF1',
    textMuted: '#8B8BA8',
    accent: '#10A37F',
    accentText: '#FFFFFF',
    pillBg: '#1F1F22',
    // extensions
    backgroundSecondary: '#121214',
    backgroundTertiary: '#1F1F23',
    textSecondary: '#C5C5D2',
    textTertiary: '#8B8BA8',
    textDisabled: '#565869',
    textInverse: '#0D0D0D',
    borderSecondary: '#1F1F23',
    borderTertiary: '#121214',
    accentHover: '#13B896',
    accentActive: '#0E8A6F',
    accentLight: '#1C4D39',
    inverse: '#FFFFFF',
    error: '#F44336',
    warning: '#FF9800',
    success: '#4CAF50',
    info: '#2196F3',
  },

  /* ------------------------------------------------------------------ */
  /* Light — Claude Light adapted to 60-30-10.                           */
  /* 60% canvas → #FFFFFF · 30% surface/sidebar/borders → #F7-#E5 ·      */
  /* 10% accent → #10A37F Claude teal (was #8B5CF6 lavender).            */
  /* ------------------------------------------------------------------ */
  Light: {
    name: 'Light',
    background: '#FFFFFF',
    surface: '#F7F7F8',
    sidebarBg: '#F7F7F8',
    border: '#E5E5E8',
    text: '#0D0D0D',
    textMuted: '#565869',
    accent: '#10A37F',
    accentText: '#FFFFFF',
    pillBg: '#ECECF1',
    // extensions
    backgroundSecondary: '#F7F7F8',
    backgroundTertiary: '#ECECF1',
    textSecondary: '#565869',
    textTertiary: '#8B8BA8',
    textDisabled: '#CACACD',
    textInverse: '#FFFFFF',
    borderSecondary: '#F0F0F2',
    borderTertiary: '#E5E5E8',
    accentHover: '#0E8A6F',
    accentActive: '#0C6D57',
    accentLight: '#D1F4E5',
    inverse: '#0D0D0D',
    error: '#D32F2F',
    warning: '#F57C00',
    success: '#388E3C',
    info: '#1976D2',
  },
};

/* ────────────────────────────────────────────────────────────────────── */
/* Design tokens — Claude.ai Design System adapted to RN + 8pt grid       */
/* These are framework-agnostic constants; components import what they need.*/
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Spacing — 4pt base unit.
 * Approved app scale (strict 8pt/4pt grid): 4, 8, 12, 16, 24, 32, 48, 64.
 * Full Claude scale includes intermediate steps for finer control;
 * prefer approved values in layout, use intermediates only for tight
 * internal padding (e.g., input 10/12, badge 4/8).
 */
export const Spacing = {
  unit: 4,
  /** Full scale (Claude + app) in px. */
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
  /** Approved 8pt/4pt grid values for app layout (AGENTS.md). */
  approved: [4, 8, 12, 16, 24, 32, 48, 64] as const,
  /** Semantic spacing aliases. */
  semantic: {
    gutter: 16,
    sectionGap: 24,
    cardPadding: 16,
    buttonPadding: { vertical: 10, horizontal: 16 },
    inputPadding: { vertical: 10, horizontal: 12 },
    listItemHeight: 48,
    listItemPadding: 12,
  } as const,
  /** Helper: spacing(n) → n * 4. e.g., spacing(4) === 16. */
  fn: (n: number) => n * 4,
} as const;

/**
 * Typography — Claude type scale adapted to React Native.
 * - Font families: iOS SF Pro Display, Android Roboto, fallback sans-serif.
 * - Strict app hierarchy (AGENTS.md) uses 4 sizes: 24, 18, 14, 12
 *   with weights 400/600. Those map to headline1 / headline2 / body1 /
 *   caption1 below.
 * - Full Claude scale (display1..caption2) is exposed for editorial
 *   screens and markdown rendering; prefer app hierarchy in dashboard.
 */
export const Typography = {
  fontFamilies: {
    primary: {
      ios: 'SF Pro Display',
      android: 'Roboto',
      fallback: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    mono: {
      ios: 'Menlo',
      android: 'Roboto Mono',
      fallback: 'monospace',
    },
  } as const,
  fontWeights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  } as const,
  /** App-strict 4-size hierarchy (AGENTS.md). */
  app: {
    pageHeader: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32, letterSpacing: 0 },
    cardHeader: { fontSize: 18, fontWeight: '600' as const, lineHeight: 28, letterSpacing: 0 },
    body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, letterSpacing: 0 },
    caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, letterSpacing: 0 },
  } as const,
  /** Full Claude type scale for richer screens. */
  scale: {
    display1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40, letterSpacing: -0.5 },
    display2: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36, letterSpacing: -0.3 },
    headline1: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32, letterSpacing: 0 },
    headline2: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28, letterSpacing: 0 },
    body1: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24, letterSpacing: 0 },
    body2: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22, letterSpacing: 0 },
    label1: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20, letterSpacing: 0 },
    label2: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18, letterSpacing: 0 },
    caption1: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, letterSpacing: 0 },
    caption2: { fontSize: 11, fontWeight: '400' as const, lineHeight: 14, letterSpacing: 0 },
  } as const,
} as const;

/**
 * Border radius — matches Claude spec and app's 16px card radius.
 */
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

/**
 * Elevation / shadows — RN-adapted (iOS CALayer + Android elevation).
 */
export const Elevation = {
  shadow1: {
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  shadow2: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  shadow3: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  shadow4: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  /** Semantic */
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  cardElevated: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

/**
 * Animation timing & curves — Claude spec (150/300/500 + cubic-bezier).
 */
export const Animation = {
  timing: {
    fast: 150,
    normal: 300,
    slow: 500,
  } as const,
  curves: {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    standard: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  } as const,
} as const;

/**
 * Layout — safe area, breakpoints, max content width (Claude spec).
 */
export const Layout = {
  safeArea: {
    ios: { notch: 'variable' as const, home: 34 },
    android: { statusBar: 24 },
  },
  screenPadding: 16,
  maxContentWidth: 600,
  breakpoints: {
    mobile: 375,
    tablet: 768,
    desktop: 1024,
  } as const,
} as const;

/**
 * Grayscale & brand constants (Claude palette reference — not theme-switched).
 * Useful for one-off illustrations or when a fixed neutral is needed
 * regardless of theme.
 */
export const Grayscale = {
  white: '#FFFFFF',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#ECECF1',
  gray300: '#D1D1D6',
  gray400: '#B4B4BC',
  gray500: '#8B8BA8',
  gray600: '#565869',
  gray700: '#343541',
  gray800: '#1A1A1B',
  gray900: '#0D0D0D',
  black: '#000000',
} as const;

export const Brand = {
  claude: '#10A37F',
  claudeLight: '#D1F4E5',
  claudeDark: '#0C6D57',
  claudeHover: '#0E8A6F',
  claudeActive: '#0C6D57',
} as const;

/**
 * Component token helpers — derive StyleSheet values from a Theme.
 * Keeps presentational components free of hard-coded colors while
 * exposing Claude's button / input / card / badge / divider specs.
 */
export const getButtonTokens = (theme: Theme) =>
  ({
    primary: {
      background: theme.accent,
      text: theme.accentText,
      borderRadius: Radius.button,
      minHeight: 40,
      states: {
        default: { background: theme.accent, opacity: 1 },
        hover: { background: theme.accentHover, opacity: 1 },
        active: { background: theme.accentActive, opacity: 1 },
        disabled: { background: theme.borderTertiary, text: theme.textTertiary, opacity: 0.5 },
      },
    },
    secondary: {
      background: theme.backgroundSecondary,
      text: theme.text,
      border: theme.border,
      borderWidth: 1,
      borderRadius: Radius.button,
      minHeight: 40,
    },
    tertiary: {
      background: 'transparent',
      text: theme.text,
      minHeight: 36,
    },
  }) as const;

export const getInputTokens = (theme: Theme) =>
  ({
    default: {
      background: theme.backgroundSecondary,
      text: theme.text,
      placeholder: theme.textTertiary,
      border: theme.borderSecondary,
      borderWidth: 1,
      borderRadius: Radius.input,
      minHeight: 40,
    },
    focused: {
      borderColor: theme.accent,
      borderWidth: 2,
    },
    error: {
      borderColor: theme.error,
      borderWidth: 1,
    },
  }) as const;

export const getCardTokens = (theme: Theme) =>
  ({
    default: {
      background: theme.backgroundSecondary,
      border: theme.borderSecondary,
      borderWidth: 1,
      borderRadius: Radius.card,
      padding: Spacing.semantic.cardPadding,
      ...Elevation.card,
    },
    elevated: {
      background: theme.background,
      border: theme.borderSecondary,
      borderWidth: 1,
      borderRadius: Radius.card,
      padding: Spacing.semantic.cardPadding,
      ...Elevation.cardElevated,
    },
  }) as const;
