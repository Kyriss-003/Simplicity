import type { EventPriority } from './types';

export type ThemeName = 'Dark' | 'OLED' | 'Light' | 'B&W';
export const THEME_NAMES: readonly ThemeName[] = ['Dark', 'OLED', 'Light', 'B&W'];

export type PriorityRamp = Record<EventPriority, string>;

export interface InverseInk {
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  pillBg: string;
  error: string;
  priority: PriorityRamp;
}

export interface Theme {
  name: ThemeName;
  background: string;
  surface: string;
  surfaceRaised: string;
  sidebarBg: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  pillBg: string;
  hoverBg: string;
  onSurface: string;
  onSurfaceMuted: string;
  onSurfaceBorder: string;
  onSurfacePill: string;
  onSurfaceError: string;
  selectedFill: string;
  selectedText: string;
  shadow: string;
  scrim: string;
  cardShadow: string;
  syntaxDim: string;
  error: string;
  errorText: string;
  priority: PriorityRamp;
  inverse: InverseInk;
}

export const SYNTAX_DIM_MIX = 0.5;
export const ACCENT_VISIBILITY_FLOOR = 1.5;

function blendHex(top: string, bottom: string, amount: number): string {
  const channel = (i: number) =>
    Math.round(
      parseInt(bottom.slice(i, i + 2), 16) +
        (parseInt(top.slice(i, i + 2), 16) - parseInt(bottom.slice(i, i + 2), 16)) * amount
    )
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const raw = parseInt(hex.slice(i, i + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export function accentOn(accent: string, on: string, fallback: string): string {
  return contrastRatio(accent, on) >= ACCENT_VISIBILITY_FLOOR ? accent : fallback;
}

export const THEMES: Record<ThemeName, Theme> = {
  Dark: {
    name: 'Dark',
    background: '#121212',
    surface: '#1e1e1e',
    surfaceRaised: '#1e1e1e',
    sidebarBg: '#121212',
    border: '#2f2f2f',
    text: '#f5f5f5',
    textMuted: '#8e8e8e',
    accent: '#f76f53',
    accentText: '#1f1f1f',
    pillBg: '#2f2f2f',
    selectedFill: '#f5f5f5',
    selectedText: '#121212',
    hoverBg: '#1e1e1e',
    onSurface: '#f5f5f5',
    onSurfaceMuted: '#8e8e8e',
    onSurfaceBorder: '#2f2f2f',
    onSurfacePill: '#2f2f2f',
    onSurfaceError: '#e5786a',
    shadow: 'rgba(0, 0, 0, 0.5)',
    scrim: 'rgba(0, 0, 0, 0.25)',
    cardShadow: 'rgba(0, 0, 0, 0.35)',
    syntaxDim: '#505050',
    error: '#e5786a',
    errorText: '#1f1f1f',
    priority: { urgent: '#f2554d', high: '#f97316', medium: '#facc15', low: '#8ad39a' },
    inverse: {
      surface: '#1e1e1e',
      text: '#f5f5f5',
      textMuted: '#8e8e8e',
      border: '#2f2f2f',
      pillBg: '#2f2f2f',
      error: '#e5786a',
      priority: { urgent: '#f2554d', high: '#f97316', medium: '#facc15', low: '#8ad39a' },
    },
  },
  OLED: {
    name: 'OLED',
    background: '#000000',
    surface: '#0a0a0a',
    surfaceRaised: '#0a0a0a',
    sidebarBg: '#0a0a0a',
    border: '#222222',
    text: '#ffffff',
    textMuted: '#a0a0a0',
    accent: '#f76f53',
    accentText: '#1f1f1f',
    pillBg: '#141414',
    selectedFill: '#ffffff',
    selectedText: '#000000',
    hoverBg: '#0a0a0a',
    onSurface: '#ffffff',
    onSurfaceMuted: '#a0a0a0',
    onSurfaceBorder: '#222222',
    onSurfacePill: '#222222',
    onSurfaceError: '#e5786a',
    shadow: 'rgba(0, 0, 0, 0.6)',
    scrim: 'rgba(0, 0, 0, 0.3)',
    cardShadow: 'rgba(0, 0, 0, 0.4)',
    syntaxDim: '#505050',
    error: '#e5786a',
    errorText: '#1f1f1f',
    priority: { urgent: '#ef4444', high: '#f97316', medium: '#facc15', low: '#8ad39a' },
    inverse: {
      surface: '#0a0a0a',
      text: '#ffffff',
      textMuted: '#a0a0a0',
      border: '#222222',
      pillBg: '#141414',
      error: '#e5786a',
      priority: { urgent: '#ef4444', high: '#f97316', medium: '#facc15', low: '#8ad39a' },
    },
  },
  Light: {
    name: 'Light',
    background: '#f2f0e3',
    surface: '#e8e5d8',
    surfaceRaised: '#e8e5d8',
    sidebarBg: '#f2f0e3',
    border: '#dcd8c8',
    text: '#1f1f1f',
    textMuted: '#66645d',
    accent: '#f76f53',
    accentText: '#1f1f1f',
    pillBg: '#dfdbc9',
    selectedFill: '#000000',
    selectedText: '#ffffff',
    hoverBg: '#e8e5d8',
    onSurface: '#1f1f1f',
    onSurfaceMuted: '#66645d',
    onSurfaceBorder: '#dcd8c8',
    onSurfacePill: '#dfdbc9',
    onSurfaceError: '#b3352a',
    shadow: 'rgba(0, 0, 0, 0.16)',
    scrim: 'rgba(0, 0, 0, 0.15)',
    cardShadow: 'rgba(0, 0, 0, 0.07)',
    syntaxDim: '#acaaa0',
    error: '#b3352a',
    errorText: '#ffffff',
    priority: { urgent: '#b3352a', high: '#96500f', medium: '#6f5e0c', low: '#276a3a' },
    inverse: {
      surface: '#e8e5d8',
      text: '#1f1f1f',
      textMuted: '#66645d',
      border: '#dcd8c8',
      pillBg: '#dfdbc9',
      error: '#b3352a',
      priority: { urgent: '#b3352a', high: '#96500f', medium: '#6f5e0c', low: '#276a3a' },
    },
  },
  'B&W': {
    name: 'B&W',
    background: '#f4f4f5',
    surface: '#ffffff',
    surfaceRaised: '#ffffff',
    sidebarBg: '#f4f4f5',
    border: '#e8e8e9',
    text: '#0a0a0a',
    textMuted: '#5a5a5a',
    onSurface: '#0a0a0a',
    onSurfaceMuted: '#5a5a5a',
    onSurfaceBorder: '#e8e8e9',
    onSurfacePill: '#ededee',
    onSurfaceError: '#c0392b',
    accent: '#f76f53',
    accentText: '#1f1f1f',
    pillBg: '#ededee',
    selectedFill: '#000000',
    selectedText: '#ffffff',
    hoverBg: '#f0f0f1',
    shadow: 'rgba(0, 0, 0, 0.2)',
    scrim: 'rgba(0, 0, 0, 0.15)',
    cardShadow: 'rgba(0, 0, 0, 0.08)',
    syntaxDim: '#a7a7a8',
    error: '#c0392b',
    errorText: '#ffffff',
    priority: { urgent: '#b3352a', high: '#96500f', medium: '#6f5e0c', low: '#276a3a' },
    inverse: {
      surface: '#111111',
      text: '#ffffff',
      textMuted: '#a6a6a6',
      border: '#2a2a2a',
      pillBg: '#1c1c1c',
      error: '#ff8a7a',
      priority: { urgent: '#ef4444', high: '#f97316', medium: '#facc15', low: '#8ad39a' },
    },
  },
};

export type AccentName = 'Claude' | 'Lavender' | 'Black' | 'White';
export const ACCENT_NAMES: readonly AccentName[] = ['Claude', 'Lavender', 'Black', 'White'];

export interface Accent {
  value: string;
  text: string;
}

export const ACCENTS: Record<AccentName, Accent> = {
  Claude: { value: '#f76f53', text: '#1f1f1f' },
  Lavender: { value: '#b497ff', text: '#1f1f1f' },
  Black: { value: '#000000', text: '#ffffff' },
  White: { value: '#ffffff', text: '#000000' },
};

export function withAccent(theme: Theme, accent: AccentName): Theme {
  const { value, text } = ACCENTS[accent];
  if (value === theme.accent && text === theme.accentText) return theme;
  return { ...theme, accent: value, accentText: text };
}

const surfaceThemeCache = new WeakMap<Theme, Theme>();
const primaryThemeCache = new WeakMap<Theme, Theme>();

export function primaryTheme(theme: Theme): Theme {
  const { inverse } = theme;
  if (
    inverse.surface === theme.surface &&
    inverse.text === theme.text &&
    inverse.textMuted === theme.textMuted
  ) {
    return theme;
  }
  const cached = primaryThemeCache.get(theme);
  if (cached) return cached;
  const next: Theme = {
    ...theme,
    surface: inverse.surface,
    text: inverse.text,
    textMuted: inverse.textMuted,
    border: inverse.border,
    pillBg: inverse.pillBg,
    error: inverse.error,
    onSurface: inverse.text,
    onSurfaceMuted: inverse.textMuted,
    onSurfaceBorder: inverse.border,
    onSurfacePill: inverse.pillBg,
    onSurfaceError: inverse.error,
    surfaceRaised: inverse.pillBg,
    syntaxDim: blendHex(inverse.textMuted, inverse.surface, SYNTAX_DIM_MIX),
    priority: inverse.priority,
  };
  primaryThemeCache.set(theme, next);
  return next;
}

export function surfaceTheme(theme: Theme): Theme {
  if (theme.onSurface === theme.text && theme.onSurfaceMuted === theme.textMuted) return theme;
  const cached = surfaceThemeCache.get(theme);
  if (cached) return cached;
  const next: Theme = {
    ...theme,
    text: theme.onSurface,
    textMuted: theme.onSurfaceMuted,
    border: theme.onSurfaceBorder,
    pillBg: theme.onSurfacePill,
    error: theme.onSurfaceError,
    surface: theme.onSurfacePill,
    syntaxDim: blendHex(theme.onSurfaceMuted, theme.surface, SYNTAX_DIM_MIX),
  };
  surfaceThemeCache.set(theme, next);
  return next;
}

export const Typography = {
  app: {
    pageHeader: { fontSize: 24, fontWeight: 600, lineHeight: '32px', letterSpacing: 0 },
    pageHeaderRegular: { fontSize: 24, fontWeight: 400, lineHeight: '32px', letterSpacing: 0 },
    cardHeader: { fontSize: 18, fontWeight: 600, lineHeight: '24px', letterSpacing: 0 },
    cardHeaderRegular: { fontSize: 18, fontWeight: 400, lineHeight: '24px', letterSpacing: 0 },
    body: { fontSize: 14, fontWeight: 400, lineHeight: '20px', letterSpacing: 0 },
    bodyStrong: { fontSize: 14, fontWeight: 600, lineHeight: '20px', letterSpacing: 0 },
    caption: { fontSize: 12, fontWeight: 400, lineHeight: '16px', letterSpacing: 0 },
    captionStrong: { fontSize: 12, fontWeight: 600, lineHeight: '16px', letterSpacing: 0 },
    wordmark: { fontSize: 14, fontWeight: 600, lineHeight: '20px', letterSpacing: '2px' },
  },
} as const;

export const Radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
  card: 16,
  panel: 20,
  button: 8,
  input: 8,
  badge: 16,
  modal: 20,
} as const;

export const Layout = {
  screenPadding: 16,
  maxContentWidth: 600,
  contentMaxWidth: 1280,
  headerHeight: 64,
  breakpoints: {
    mobile: 375,
    tablet: 768,
    desktop: 1024,
  },
} as const;
