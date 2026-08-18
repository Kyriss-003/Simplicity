/**
 * App theme palettes — 60-30-10 rule.
 * The dashboard components consume these tokens instead of hard-coded colors
 * so the ThemeSwitcher can reskin the whole UI at once.
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
  /** Accent — lavender, reserved for active highlights, primary actions, toggles (10%). */
  accent: string;
  /** Accent text rendered on top of `accent`. */
  accentText: string;
  /** Soft pill background (30%). */
  pillBg: string;
}

export const THEMES: Record<ThemeName, Theme> = {
  /* ------------------------------------------------------------------ */
  /* Dark — Claude AI aesthetic: warm dark charcoal, NOT pitch black.    */
  /* 60% canvas → #212123 · 30% surface/sidebar/borders → #17-#36 ·    */
  /* 10% accent → #B497FF Lavender.                                     */
  /* ------------------------------------------------------------------ */
  Dark: {
    name: 'Dark',
    background: '#212123',
    surface: '#2A2A2D',
    sidebarBg: '#171719',
    border: '#36363B',
    text: '#ECECF1',
    textMuted: '#8E8E93',
    accent: '#B497FF',
    accentText: '#0D0D0E',
    pillBg: '#36363B',
  },

  /* ------------------------------------------------------------------ */
  /* OLED — pure black with barely-there surface differentiation.         */
  /* 60% canvas → #000000 · 30% surface/borders → #0A-#1F ·             */
  /* 10% accent → #B497FF Lavender.                                     */
  /* ------------------------------------------------------------------ */
  OLED: {
    name: 'OLED',
    background: '#000000',
    surface: '#121214',
    sidebarBg: '#0A0A0C',
    border: '#1F1F22',
    text: '#ECECF1',
    textMuted: '#8E8E93',
    accent: '#B497FF',
    accentText: '#000000',
    pillBg: '#1F1F22',
  },

  /* ------------------------------------------------------------------ */
  /* Light — clean white canvas with tinted sidebar.                       */
  /* 60% canvas → #FFFFFF · 30% surface/sidebar/borders → #F4-E4 ·       */
  /* 10% accent → #8B5CF6 (lighter lavender for light backgrounds).      */
  /* ------------------------------------------------------------------ */
  Light: {
    name: 'Light',
    background: '#FFFFFF',
    surface: '#F8F8FA',
    sidebarBg: '#F4F4F6',
    border: '#E4E4E7',
    text: '#18181B',
    textMuted: '#8E8E93',
    accent: '#8B5CF6',
    accentText: '#FFFFFF',
    pillBg: '#E4E4E7',
  },
};
