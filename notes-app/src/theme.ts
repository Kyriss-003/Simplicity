/**
 * App theme — "Zen" warm-neutral palette built on the 60-30-10 system.
 *
 * 60% canvas → 30% structural surfaces/borders/pills → 10% brand accent.
 * The accent is reserved strictly for the FAB, active navigation indicators,
 * toggles, checkmark highlights, and focused states.
 *
 * The brand accent is coral `#f76f53`, and `accentText` is dark in every theme
 * on purpose: `#f76f53` is a light-mid orange, so dark glyphs clear WCAG AA
 * (~5.7:1) while white would only reach ~2.8:1.
 *
 * **A theme is a canvas, not a colour.** Dark / OLED / Light differ in canvas,
 * surface and text. The 10% accent is a separate axis — see `ACCENTS` — because
 * tinting the brand colour would be a different decision from inverting the
 * canvas, and mixing them is how a palette ends up with four "themes" that are
 * really two ideas.
 */

export type ThemeName = 'Dark' | 'OLED' | 'Light' | 'B&W';

// Type-only, so it is erased at compile time and `theme.ts` keeps zero runtime
// imports — which is what lets Jest load it directly. `EventPriority` lives in
// `types.ts` with the rest of the shared app types.
import type { EventPriority } from './types';

/** Every theme, in the order the segmented control shows them. */
export const THEME_NAMES: readonly ThemeName[] = ['Dark', 'OLED', 'Light', 'B&W'];

export interface Theme {
  name: ThemeName;
  /** Root viewport background (60%). */
  background: string;
  /** Card / raised surface background (30%). */
  surface: string;
  /**
   * Fill for chrome that floats *above* a card — context menus, modals, the
   * dock, the FAB menu.
   *
   * Every theme before `B&W` set this equal to `surface`, because their surface
   * already sat a visible step off the canvas. `B&W` is where that stopped being
   * enough: a menu, a card and a dock at the same `#000000` have no order
   * between them, so the app had a palette but no hierarchy. A card is the
   * ground layer of an overlay; the overlay takes one step off it.
   */
  surfaceRaised: string;
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
  /** Soft pill background (30%) — on the canvas. */
  pillBg: string;
  /**
   * Transient hover wash on the canvas.
   *
   * This used to be `surface`, which only worked because every theme so far had
   * a surface sitting one step off its canvas. `B&W` has a *pure black* surface,
   * so hovering a row there would flash a black block — the token had to become
   * explicit about being a wash rather than borrowing a fill meant for cards.
   */
  hoverBg: string;
  /**
   * The ink layer for content drawn **on top of** `surface`.
   *
   * Every theme before `B&W` is light-on-dark or dark-on-light *throughout*, so
   * one `text` token covered both the canvas and the cards. `B&W` inverts inside
   * the card — black on white outside, white on black within — and no single
   * token can express both, so the surface carries its own ink.
   *
   * In the first three themes these are identical to their canvas counterparts,
   * which is what lets `surfaceTheme()` hand back the *same object* and leave
   * every existing pixel untouched.
   */
  onSurface: string;
  /** Secondary text on `surface`. */
  onSurfaceMuted: string;
  /** Hairline drawn on `surface` (card dividers, in-card control outlines). */
  onSurfaceBorder: string;
  /** Soft pill fill drawn on `surface` (chips, pressed rows inside a card). */
  onSurfacePill: string;
  /** Destructive text on `surface`. */
  onSurfaceError: string;
  /**
   * The fill for a **selected** segment in a segmented control (the dock, the
   * section tabs).
   *
   * It exists rather than reusing `primaryTheme` because that helper is the
   * *identity* for any single-ink theme, so on `Dark` / `OLED` it would return
   * the dock's own fill and the selection would vanish entirely. The rule is
   * simply "the strongest contrast against this theme's surface": black on the
   * light canvases, where a black pill is the clear reading of "selected", and
   * white on the dark ones for the same reason.
   */
  selectedFill: string;
  /** Label colour on top of `selectedFill`. */
  selectedText: string;
  /**
   * Colour for elevation shadows and modal scrims.
   *
   * Lives here so components never reach for a literal `rgba(0,0,0,0.25)`:
   * the same scrim has to be much heavier on the dark canvases to read at all,
   * and a hard-coded one silently disappears on OLED. Border *widths* are still
   * exempt from the spacing scale, but shadow colour is not.
   */
  shadow: string;
  /** Backdrop behind a modal: a light dim so the page stays visible, not a solid fill. */
  scrim: string;
  /**
   * The soft lift under a card, as distinct from `shadow` (scrims, overlays).
   *
   * It is a separate token because a *card* and a *modal backdrop* want opposite
   * weights: a backdrop has to knock the page out, a card has to whisper. In
   * `B&W` the card is white on a near-white canvas, so this is the only thing
   * drawing its edge — the border alone sits at 1.11:1.
   */
  cardShadow: string;
  /**
   * Color of raw markdown syntax in the live editor (`**`, `#`, backticks).
   *
   * The library exposes `syntax` as a color only — no width, no font size, no
   * replace — so a marker can be dimmed but never collapsed. Hiding it outright
   * therefore leaves a gap the width of the marker, which reads worse than a
   * visible marker. This sits at `SYNTAX_DIM_MIX` of `textMuted` over the canvas:
   * present enough to read as text, quiet enough to ignore. A test pins that
   * ratio, so changing a theme's `textMuted` cannot silently desync it.
   */
  syntaxDim: string;
  /** Destructive / error accent. */
  error: string;
  /** Text rendered on top of `error`. */
  errorText: string;
  /**
   * The four event-priority colours, used on the canvas and on ordinary cards.
   *
   * A record rather than four loose fields so a test can iterate the whole set
   * and so a priority cannot be half-defined — which is exactly how this app's
   * accents went wrong once, when `withAccent` assumed every accent wanted dark
   * glyphs and the first light-mid accent proved it wrong.
   *
   * The contract a test pins: **every level clears 4.5:1 against both
   * `background` and `surface`**, so a single value works on the page *and* on a
   * card with no second lookup. `surfaceTheme` and `primaryTheme` both spread
   * the theme, so this rides along untouched by default.
   */
  priority: PriorityRamp;
  /**
   * The ink layer for the one **primary** card on a page.
   *
   * `B&W` is the reason this exists. With a white canvas and pure-black cards,
   * every card on the dashboard was the same black slab and the page had no
   * focal point at all. So `B&W` inverts the rule: ordinary cards are *light*,
   * and the black is reserved for the single main card — which makes it the
   * strongest contrast on the page and therefore the thing the eye lands on.
   *
   * The other three themes set this to their own `surface` and ink, so a
   * "primary" card is indistinguishable from a normal one and nothing moves.
   */
  inverse: InverseInk;
}

/** The four priority levels, as a colour for each. */
export type PriorityRamp = Record<EventPriority, string>;

/** A card's own fill and the ink drawn on it. */
export interface InverseInk {
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  pillBg: string;
  error: string;
  /**
   * Priority colours **on the primary card**.
   *
   * This split is not stylistic, it is arithmetic. In `B&W` a single value
   * cannot serve both grounds: a dark red clears 4.8–6.1:1 on the light canvas
   * and card but only 3.07:1 on the `#111111` black card, and a light red is the
   * exact mirror — 8.13:1 on black, 2.29:1 on white. So `B&W` needs its own set,
   * and the other three themes repeat theirs, which is why the field exists on
   * `InverseInk` rather than only where it is needed.
   */
  priority: PriorityRamp;
}

/**
 * Fraction of `textMuted` over the canvas that raw markdown syntax is dimmed to.
 *
 * 25% was too faint to recognise as text; 50% reads as a quiet marker. 0% is not an
 * option — hidden markers still occupy width, so they leave a gap.
 */
export const SYNTAX_DIM_MIX = 0.5;

/** Blends `top` over `bottom` by `amount`. Used to re-blend the syntax dim. */
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

/** Relative luminance of a `#rrggbb`, per WCAG 2.1. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const raw = parseInt(hex.slice(i, i + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The accent, or a fallback for when the accent cannot be seen on this fill.
 *
 * **This catches an *absent* mark, not a dim one**, and that is why the
 * threshold is far below WCAG's 3:1 for non-text content. The failure being
 * guarded is a mark sitting on its own background — `#ffffff` icon on a `#f5f5f5`
 * pill, `#000000` icon on a `#000000` pill — where contrast is ~1.0 and the glyph
 * is simply **not there**. An absent icon is worse than a low-contrast one,
 * because the gap it leaves in the control reads as a layout fault rather than a
 * taste, and the monochrome accents (`White`, `Black`) are what produce it.
 *
 * **An earlier version of this used 3:1, and that was wrong.** It rejected coral
 * on the white pill (2.86:1) — the app's own default selected tab — and silently
 * recoloured it to the label's ink. That combination is *visible*, and it is a
 * design the palette intends. WCAG's 3:1 answers "can this graphic be
 * identified?"; this answers "is this mark present at all?", and only the second
 * question justifies overriding the user's accent.
 *
 * It exists because `theme.accent` cannot be required to clear any given fill.
 * Each monochrome accent collides with one of these two surfaces per theme, and
 * those collisions are otherwise documented as acceptable *at the canvas* — the
 * dock's icons are where the trade stops being a look and becomes a fault.
 *
 * @param on the fill the mark is painted on
 * @param fallback the colour to use instead, when the accent is not visible
 */
export function accentOn(accent: string, on: string, fallback: string): string {
  return contrastRatio(accent, on) >= ACCENT_VISIBILITY_FLOOR ? accent : fallback;
}

/**
 * The contrast at which a mark is treated as absent.
 *
 * 1.5 sits between "identical" (~1.0, invisible) and every intentional
 * pairing — the tightest of which is coral on the white pill at 2.86. Below
 * this, two colours are closer than a reader can reliably tell apart.
 */
export const ACCENT_VISIBILITY_FLOOR = 1.5;

export const THEMES: Record<ThemeName, Theme> = {
  /* Dark — the reference neutral palette: #121212 canvas, #1E1E1E cards. */
  Dark: {
    name: 'Dark',
    // The reference's two surface values and nothing between them. The warm
    // "Zen" cast this theme used to carry is gone: a neutral grey is what makes
    // a coral accent read as an accent rather than as part of the background.
    background: '#121212',
    surface: '#1e1e1e',
    // The reference has no third level, so floating chrome sits on the same
    // fill as a card. See `surfaceRaised`.
    surfaceRaised: '#1e1e1e',
    sidebarBg: '#121212',
    border: '#2f2f2f',
    text: '#f5f5f5',
    // The reference's secondary is #757575, which is 4.07:1 on #121212 — under
    // AA. Lifted to #8E8E8E (5.7:1 on the canvas, 5.1:1 on a card) to hold the
    // bar the rest of the palette is held to.
    textMuted: '#8e8e8e',
    accent: '#f76f53',
    accentText: '#1f1f1f',
    pillBg: '#2f2f2f',
    selectedFill: '#f5f5f5',
    selectedText: '#121212',
    hoverBg: '#1e1e1e',
    // One ink across canvas and surface: the card and the canvas are close
    // enough in value that a single set of ink works on both, so `surfaceTheme`
    // hands this theme straight back and nothing extra renders.
    onSurface: '#f5f5f5',
    onSurfaceMuted: '#8e8e8e',
    onSurfaceBorder: '#2f2f2f',
    onSurfacePill: '#2f2f2f',
    onSurfaceError: '#e5786a',
    shadow: 'rgba(0, 0, 0, 0.5)',
    scrim: 'rgba(0, 0, 0, 0.15)',
    cardShadow: 'rgba(0, 0, 0, 0.35)',
    // 50% of textMuted over the canvas — see SYNTAX_DIM_MIX.
    syntaxDim: '#505050',
    error: '#e5786a',
    errorText: '#1f1f1f',
    priority: { urgent: '#f2554d', high: '#f97316', medium: '#facc15', low: '#8ad39a' },
    // Its own surface and ink: a primary card is identical to a normal one.
    inverse: {
      surface: '#1e1e1e',
      text: '#f5f5f5',
      textMuted: '#8e8e8e',
      border: '#2f2f2f',
      pillBg: '#2f2f2f',
      error: '#e5786a',
      // Same ramp — a primary card here is the same colour as a normal one.
      priority: { urgent: '#f2554d', high: '#f97316', medium: '#facc15', low: '#8ad39a' },
    },
  },

  /* OLED — pure black for AMOLED. */
  OLED: {
    name: 'OLED',
    background: '#000000',
    surface: '#0a0a0a',
    surfaceRaised: '#0a0a0a',
    sidebarBg: '#0a0a0a',
    border: '#222222',
    text: '#ffffff',
    // Brighter than the other themes' muted text on purpose: #888888 passed AA
    // on black but still read as washed out next to white body text, and OLED
    // canvases have no surface tint to lift it. 8.0:1 on #000000, 7.2:1 on the
    // list surface — comfortably readable, still clearly secondary.
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
    // Heavier than Dark's: on pure black a lighter scrim reads as no scrim.
    shadow: 'rgba(0, 0, 0, 0.6)',
    scrim: 'rgba(0, 0, 0, 0.15)',
    cardShadow: 'rgba(0, 0, 0, 0.4)',
    // 50% of the new textMuted over the canvas — see SYNTAX_DIM_MIX.
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

  /* Light — "Zen Cream". */
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
    // Much lighter than the dark themes: the same scrim smears the cream canvas.
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

  /* B&W — "Ink". A soft base, white cards, and one black. */
  'B&W': {
    name: 'B&W',
    /**
     * A soft base, white cards, and exactly one black.
     *
     * Three levels, and no more: a soft off-white canvas, white cards lifted by
     * a *shadow* rather than an outline, and a single black primary card that
     * is the strongest contrast on the page and therefore where the eye lands.
     *
     * The canvas is deliberately not `#ffffff`. Pure white is a full-glare
     * surface under a bright light and it leaves the cards nothing to be lighter
     * than — a soft grey base gives the white cards somewhere to sit.
     */
    background: '#f4f4f5',
    /** White, reserved for the card layer — the only thing brighter than the canvas. */
    surface: '#ffffff',
    /** Floating panels share the card fill; their border and shadow do the lifting. */
    surfaceRaised: '#ffffff',
    sidebarBg: '#f4f4f5',
    // Barely there on purpose. The card is white on a near-white canvas, so the
    // outline is a whisper and `cardShadow` is what actually draws the edge.
    border: '#e8e8e9',
    text: '#0a0a0a',
    textMuted: '#5a5a5a',
    // One ink across canvas and card — both are light — so `surfaceTheme` hands
    // this theme straight back and the two levels share everything.
    onSurface: '#0a0a0a',
    onSurfaceMuted: '#5a5a5a',
    onSurfaceBorder: '#e8e8e9',
    onSurfacePill: '#ededee',
    onSurfaceError: '#c0392b',
    accent: '#f76f53',
    accentText: '#1f1f1f',
    /**
     * Four state indicators, four gentle steps, no heavy effects.
     *
     * `hoverBg` is a transient wash, `pillBg` a step darker for a *selected*
     * segment, `border` a whisper, and focus is the accent ring in `App.tsx`.
     * A disabled control is `textMuted`; the steps are deliberately close
     * together so the page reads as airy rather than as a stack of chips.
     */
    pillBg: '#ededee',
    selectedFill: '#000000',
    selectedText: '#ffffff',
    hoverBg: '#f0f0f1',
    shadow: 'rgba(0, 0, 0, 0.2)',
    scrim: 'rgba(0, 0, 0, 0.15)',
    // Soft and shallow: 1px down, 3px blur. Enough to lift a white card off a
    // near-white canvas, not enough to read as a drop shadow.
    cardShadow: 'rgba(0, 0, 0, 0.08)',
    syntaxDim: '#a7a7a8',
    error: '#c0392b',
    errorText: '#ffffff',
    priority: { urgent: '#b3352a', high: '#96500f', medium: '#6f5e0c', low: '#276a3a' },
    // The one black. Every value here is a light-card value turned over, so the
    // primary card is the same design inverted — and at 17:1 against the canvas
    // it is by far the highest contrast on the page.
    inverse: {
      surface: '#111111',
      text: '#ffffff',
      textMuted: '#a6a6a6',
      border: '#2a2a2a',
      pillBg: '#1c1c1c',
      error: '#ff8a7a',
      // The only theme whose priority ramp genuinely differs: these have to read
      // on '#111111', where the dark ramp above reaches only 2.3-3.1:1.
      priority: { urgent: '#ef4444', high: '#f97316', medium: '#facc15', low: '#8ad39a' },
    },
  },
};

/* ────────────────────────────────────────────────────────────────────── */
/* Accent — the 10% layer, independent of the canvas                     */
/* ────────────────────────────────────────────────────────────────────── */

export type AccentName = 'Claude' | 'Lavender' | 'Black' | 'White';

/**
 * Every accent, in the order the Settings picker shows them.
 *
 * `Coral` was renamed to `Claude`. `usePrefsStore` maps the old stored value
 * across, so a rename costs existing users nothing — see `LEGACY_ACCENTS`
 * there, and never resolve an unknown accent by fallback alone, because the
 * fallback moves every time a name changes.
 */
export const ACCENT_NAMES: readonly AccentName[] = ['Claude', 'Lavender', 'Black', 'White'];

/**
 * An accent is a **pair**: the fill, and the glyph colour that has to sit on it.
 *
 * It was a bare hex for a long time, which worked only because both accents were
 * light-mid and so both wanted dark glyphs. `Black` is the first that does not,
 * and assuming the answer here is how an accent ends up with unreadable text on
 * it. `value` and `text` travel together for that reason.
 */
export interface Accent {
  value: string;
  /** Glyph / label colour rendered on top of `value`. */
  text: string;
}

export const ACCENTS: Record<AccentName, Accent> = {
  // Still `#f76f53` — the name changed, the colour did not.
  Claude: { value: '#f76f53', text: '#1f1f1f' },
  Lavender: { value: '#b497ff', text: '#1f1f1f' },
  /**
   * The monochrome dark accent, for the `B&W` canvas. The FAB, the checkboxes
   * and the active nav read as ink rather than as colour, which is the point: it
   * introduces no hue at all.
   *
   * The trade-off is honest and worth stating — on `Dark` / `OLED` a black accent
   * sits on a near-black canvas and is low-contrast by nature. That is the user
   * choosing a monochrome accent on a dark theme, not a rendering fault.
   */
  Black: { value: '#000000', text: '#ffffff' },
  /**
   * The monochrome light accent — the mirror of `Black`, and the one that reads
   * as "raised" rather than "printed".
   *
   * It has the same blind spot mirrored: on the `Light` and `B&W` canvases a
   * white FAB is carried by its shadow rather than by contrast, and the sidebar's
   * 2px active stripe disappears against a white sidebar. `Black` on a dark canvas
   * and `White` on a light one are the same trade, in opposite directions.
   */
  White: { value: '#ffffff', text: '#000000' },
};

/**
 * Applies the user's accent choice to a theme.
 *
 * Returns the *same object* when the accent already matches — both value *and*
 * glyph colour — so a consumer that memoises on the resolved theme does not
 * re-render on every settings read. `Black` is exactly why that guard checks
 * both: a theme whose accent is already black still needs its `accentText`
 * flipped to white.
 */
export function withAccent(theme: Theme, accent: AccentName): Theme {
  const { value, text } = ACCENTS[accent];
  if (value === theme.accent && text === theme.accentText) return theme;
  return { ...theme, accent: value, accentText: text };
}

/**
 * The same theme, re-pointed at the ink that belongs **on a surface**.
 *
 * Components render their card contents with this rather than reaching for six
 * `onSurface*` tokens one by one, so "I am drawing on a card" stays a single
 * decision at the top of the component instead of a per-colour judgement that
 * can be half-migrated.
 *
 * It returns the *identical object* for every theme that shares one ink across
 * the canvas and the surface (all but `B&W`), which is what makes this safe to
 * drop into a `useMemo` and guarantees the existing themes render unchanged.
 * Memoised on the theme object for the same reason — `withAccent` hands out a
 * fresh object per accent, and a new identity each render would defeat that.
 */
const surfaceThemeCache = new WeakMap<Theme, Theme>();

/**
 * The theme for the **one primary card** on a page — `B&W`'s black slab.
 *
 * Consumes exactly like `surfaceTheme`: a component that draws on a primary
 * card calls this instead, and everything downstream (`ink.text`, `ink.pillBg`,
 * `liveMarkdownStyle`) keeps working unchanged. In the other three themes it
 * returns the theme untouched, because their `inverse` *is* their own surface.
 */
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
    // A code block on the black card cannot be the card's own fill.
    surfaceRaised: inverse.pillBg,
    // Re-blended against the primary fill, not the canvas.
    syntaxDim: blendHex(inverse.textMuted, inverse.surface, SYNTAX_DIM_MIX),
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
    // `liveMarkdownStyle` paints code blocks with `surface`; inside a card that
    // is the card's own fill, so the block would be invisible. The pill step is
    // the one offset on a black fill that still reads as a distinct block.
    surface: theme.onSurfacePill,
    // Re-blended rather than reused: `syntaxDim` is defined against the canvas,
    // and a canvas-blended dim is far too loud on a black card.
    syntaxDim: blendHex(theme.onSurfaceMuted, theme.surface, SYNTAX_DIM_MIX),
  };
  surfaceThemeCache.set(theme, next);
  return next;
}

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
    /**
     * The app's wordmark in the header.
     *
     * The only token with non-zero `letterSpacing`. Set in caps and tracked out,
     * a short all-caps word reads as a logotype; at `letterSpacing: 0` the same
     * word reads as a heading that lost its casing, which is what it looked like
     * before. Size and weight stay inside the 4-size / 2-weight scale.
     */
    wordmark: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20, letterSpacing: 2 },
  } as const,
} as const;

/**
 * Border radius.
 *
 * Two tiers, and the split is by **container size**, not by component type.
 * Controls sit at `md`–`xl` (8–16): a 32px button with a 20px radius is a lozenge,
 * and the radius starts describing the shape rather than the corner. A large
 * container — a panel of rows, a modal, a floating menu — takes `xxl` (20),
 * because a big box needs a proportionally bigger corner or it reads as almost
 * square next to the controls inside it. The settings section list is the case
 * that motivated the step: at 12px its corners looked square against 44px rows.
 *
 * `full` is for genuinely round things — an avatar, a switch knob — and nothing
 * that has a corner to speak of.
 */
export const Radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
  /** Semantic aliases */
  card: 16,
  /** Large grouped containers — a panel of rows, a modal, a floating menu. */
  panel: 20,
  button: 8,
  input: 8,
  badge: 16,
  modal: 20,
} as const;

/**
 * Motion tokens — the app's animation vocabulary.
 *
 * Durations and spring configs are plain numbers so `theme.ts` stays free of any
 * animation-library import (Jest loads this module; a Reanimated import here
 * would drag the whole native runtime into a pure-logic test). The easing curves
 * that need `Easing` live in `components/shared/motion.tsx`.
 *
 * Every interactive element shares `pressedScale` so press feedback is uniform:
 * if one card shrinks to 0.94 and another to 0.97, the inconsistency reads as a
 * rendering bug rather than a style choice.
 */
export const Motion = {
  /** Shared press/hover scale — the app's one micro-interaction constant. */
  pressedScale: 0.97,
  /** Durations in ms. `base` is the 250ms the sidebar/dock/screen swaps use. */
  duration: {
    instant: 120,
    fast: 180,
    base: 250,
    slow: 400,
  } as const,
  /** Spring configs for anything that should feel physical rather than timed. */
  spring: {
    /** Sidebar slide, screen swap — a little weight, no overshoot. */
    gentle: { damping: 20, stiffness: 180, mass: 0.9 },
    /** Indicator pills and press release — quick and tight. */
    snappy: { damping: 18, stiffness: 260, mass: 0.7 },
  } as const,
  /** Horizontal parallax of the sidebar's content as the rail slides. */
  sidebarContentShift: 24,
  /** Vertical offset a screen travels as it fades in. */
  screenEnterOffset: 12,
  /** Vertical offset a dashboard section travels as it is revealed. */
  sectionEnterOffset: 8,
} as const;

/** Layout — responsive breakpoints. */
export const Layout = {
  screenPadding: 16,
  maxContentWidth: 600,
  /**
   * Widest the dashboard content is allowed to get, centred.
   *
   * Without a cap, a 1920px window stretched five note cards and two bottom
   * panels across the full width: the type stayed 14px while the boxes grew to
   * 900px, so the page read as sparse rather than wide. A max width makes a large
   * window look composed and a small one unchanged.
   */
  contentMaxWidth: 1280,
  /**
   * Height of the two column headers (the sidebar's brand row and the main
   * `TopHeader`). They are pinned to the same value so their bottom borders form
   * one continuous rule across the sidebar/main boundary — they were previously
   * sized independently and the rules met at different heights, which read as a
   * gap rather than a divider.
   */
  headerHeight: 64,
  breakpoints: {
    mobile: 375,
    tablet: 768,
    desktop: 1024,
  } as const,
} as const;
