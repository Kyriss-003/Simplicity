import {
  ACCENTS,
  ACCENT_NAMES,
  ACCENT_VISIBILITY_FLOOR,
  Motion,
  Radius,
  Spacing,
  THEMES,
  THEME_NAMES,
  Typography,
  accentOn,
  primaryTheme,
  surfaceTheme,
  withAccent,
} from '../src/theme';
import { DOCK_SCREENS, DEFAULT_LAYOUT, EVENT_PRIORITIES as PRIORITIES } from '../src/types';

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2.1 contrast ratio, rounded to two decimals. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

const themes = Object.values(THEMES);

describe('palette contrast', () => {
  it.each(themes.map((t) => [t.name, t] as const))(
    '%s keeps body and muted text readable on the canvas',
    (_name, theme) => {
      expect(contrast(theme.text, theme.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.textMuted, theme.background)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it.each(themes.map((t) => [t.name, t] as const))(
    '%s keeps the accent legible as a fill behind its own glyph colour',
    (_name, theme) => {
      // The accent's contract is a *fill*: `accentText` sits on it for the
      // active nav label, the theme pill, the preview toolbar and the FAB.
      // That pairing is the one that has to clear AA.
      expect(contrast(theme.accentText, theme.accent)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it.each(themes.map((t) => [t.name, t] as const))(
    '%s keeps primary text readable on card surfaces',
    (_name, theme) => {
      // `onSurface`, not `text`: a card carries its own ink. `B&W` inverts
      // inside the surface, so `text` there is the *canvas* ink and is black on
      // a black card — the exact failure this token layer exists to prevent.
      // Checked against the raised fill too, since one ink layer has to serve
      // both card and overlay.
      expect(contrast(theme.onSurface, theme.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.onSurfaceMuted, theme.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.onSurface, theme.surfaceRaised)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.onSurfaceMuted, theme.surfaceRaised)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it.each(themes.map((t) => [t.name, t] as const))(
    '%s keeps its destructive ink readable on a card',
    (_name, theme) => {
      expect(contrast(theme.onSurfaceError, theme.surface)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it.each(themes.map((t) => [t.name, t] as const))(
    '%s defines a shadow colour',
    (_name, theme) => {
      expect(theme.shadow).toMatch(/^rgba\(/);
    }
  );

  /**
   * The priority ramp's contract. A priority colour is drawn as a dot, a bar and
   * a swatch on the canvas **and** inside cards, so one value has to clear AA on
   * both grounds — otherwise the flag is legible on the page and invisible on the
   * card, which is worse than having no colours at all.
   */
  it.each(themes.map((t) => [t.name, t] as const))(
    '%s keeps every priority readable on its canvas and on a card',
    (_name, theme) => {
      for (const level of PRIORITIES) {
        expect(contrast(theme.priority[level], theme.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(theme.priority[level], theme.surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  );

  /**
   * The same ramp on the **primary** card. This is the assertion that forces the
   * split into `inverse.priority`: in `B&W` a single value cannot clear both the
   * white card and the `#111111` black one, and this says so as an assertion
   * rather than leaving it as a comment somebody can talk themselves past.
   */
  it.each(themes.map((t) => [t.name, t] as const))(
    '%s keeps every priority readable on its primary card',
    (_name, theme) => {
      for (const level of PRIORITIES) {
        const colour = theme.inverse.priority[level];
        expect(contrast(colour, theme.inverse.surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  );

  it('defines every priority level in every theme', () => {
    for (const theme of themes) {
      expect(Object.keys(theme.priority).sort()).toEqual([...PRIORITIES].sort());
      expect(Object.keys(theme.inverse.priority).sort()).toEqual([...PRIORITIES].sort());
    }
  });
});

describe('theme set', () => {
  it('exposes every theme name to the picker', () => {
    expect(THEME_NAMES).toEqual(Object.keys(THEMES));
  });

  it('keeps the brand accent as the default and exposes accents as a separate axis', () => {
    for (const name of THEME_NAMES) {
      expect(THEMES[name].accent).toBe('#f76f53');
    }
    // The accent is not a theme: it is applied on top of one.
    expect(THEME_NAMES).toEqual(['Dark', 'OLED', 'Light', 'B&W']);
    expect(ACCENT_NAMES).toEqual(['Claude', 'Lavender', 'Black', 'White']);
    expect(withAccent(THEMES.Dark, 'Claude')).toBe(THEMES.Dark);
    expect(withAccent(THEMES.Dark, 'Lavender').accent).toBe('#b497ff');
  });

  it('pairs the white accent with black glyphs, the mirror of Black', () => {
    const white = withAccent(THEMES['B&W'], 'White');
    expect(white.accent).toBe('#ffffff');
    expect(white.accentText).toBe('#000000');
    expect(contrast(white.accentText, white.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('pairs every accent with a glyph colour that clears AA on it', () => {
    // The accent used to be a bare hex, which worked only because both accents
    // were light-mid and both wanted dark glyphs. `Black` is the first that does
    // not, so the pairing is now data — and this is the test that keeps it
    // honest: an accent with unreadable text on it fails here rather than in
    // the app.
    for (const name of ACCENT_NAMES) {
      const accent = ACCENTS[name];
      expect(contrast(accent.text, accent.value)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('flips the glyph colour for the black accent, in every theme', () => {
    for (const name of THEME_NAMES) {
      const black = withAccent(THEMES[name], 'Black');
      expect(black.accent).toBe('#000000');
      expect(black.accentText).toBe('#ffffff');
      expect(contrast(black.accentText, black.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('does not re-wrap a theme that already carries the accent', () => {
    // Re-applying is the case that matters: a consumer re-derives the theme on
    // every render, and a fresh object each time would defeat any memo downstream.
    // Only meaningful now that the guard checks the glyph colour too.
    const black = withAccent(THEMES.Dark, 'Black');
    expect(withAccent(black, 'Black')).toBe(black);
    expect(withAccent(withAccent(THEMES.Dark, 'Claude'), 'Claude')).toBe(THEMES.Dark);
  });

  it('carries the accent override into every theme it is applied to', () => {
    for (const name of THEME_NAMES) {
      const lavender = withAccent(THEMES[name], 'Lavender');
      expect(lavender.accent).toBe('#b497ff');
      // Everything else must be untouched — the accent is a 10% layer, not a
      // repaint of the whole palette.
      expect(lavender.background).toBe(THEMES[name].background);
      expect(lavender.surface).toBe(THEMES[name].surface);
      expect(lavender.text).toBe(THEMES[name].text);
    }
  });
});

describe('primary card', () => {
  it('gives B&W a soft base, white cards, and exactly one black', () => {
    const theme = THEMES['B&W'];
    // Three levels and no more: a soft off-white canvas, white cards, one black.
    // Pure white was rejected as the canvas — it glares under a bright light and
    // leaves the cards nothing to be lighter than.
    expect(theme.background).toBe('#f4f4f5');
    expect(theme.surface).toBe('#ffffff');
    expect(theme.inverse.surface).toBe('#111111');
    // The canvas must be a real step below white, or the card has nothing to sit on.
    expect(contrast(theme.surface, theme.background)).toBeGreaterThan(1.05);
  });

  it('makes the black card the highest contrast on the page, by a wide margin', () => {
    // The whole point of reserving the black: one card is the focal point, and
    // the other three are quiet. If the black ever stops outcontrasting the
    // ordinary card there is no focal point and the page is four slabs again.
    const theme = THEMES['B&W'];
    const black = contrast(theme.inverse.surface, theme.background);
    const white = contrast(theme.surface, theme.background);
    expect(black).toBeGreaterThan(8);
    expect(black).toBeGreaterThan(white * 5);
  });

  it('gives every theme a soft card shadow, distinct from the overlay scrim', () => {
    // A card and a modal backdrop want opposite weights: a backdrop knocks the
    // page out, a card whispers. Sharing one token is how a card ends up with a
    // heavy drop shadow.
    for (const theme of themes) {
      expect(theme.cardShadow).toMatch(/^rgba\(/);
      expect(theme.cardShadow).not.toBe(theme.shadow);
    }
  });

  it('keeps a primary card identical in the other three themes', () => {
    for (const name of THEME_NAMES) {
      if (name === 'B&W') continue;
      const theme = THEMES[name];
      expect(theme.inverse.surface).toBe(theme.surface);
      expect(theme.inverse.text).toBe(theme.text);
      // And the resolver hands it straight back, so nothing moves.
      expect(primaryTheme(theme)).toBe(theme);
    }
  });

  it('resolves the B&W primary into a dark, memoised theme', () => {
    const primary = primaryTheme(THEMES['B&W']);
    expect(primary.surface).toBe('#111111');
    expect(primary.text).toBe('#ffffff');
    // A code block on the black card cannot be the card's own fill.
    expect(primary.surfaceRaised).not.toBe(primary.surface);
    // Stable identity, and the accent is an independent axis.
    expect(primaryTheme(THEMES['B&W'])).toBe(primary);
    expect(primary.accent).toBe(THEMES['B&W'].accent);
  });

  it('keeps the primary card legible in both themes that have one', () => {
    for (const name of THEME_NAMES) {
      const theme = THEMES[name];
      const primary = primaryTheme(theme);
      expect(contrast(primary.text, primary.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(primary.textMuted, primary.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('selected segment', () => {
  it('reads as the strongest thing on the bar, on every theme', () => {
    for (const theme of themes) {
      // The dock sits on `surfaceRaised`; a selected pill that matches it is
      // an invisible selection. `primaryTheme` is exactly that on Dark and OLED,
      // which is why this is its own token.
      expect([theme.name, theme.selectedFill]).not.toEqual([theme.name, theme.surfaceRaised]);
      expect(contrast(theme.selectedText, theme.selectedFill)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('is black on the light canvases, where black is the clear reading', () => {
    expect(THEMES['B&W'].selectedFill).toBe('#000000');
    expect(THEMES.Light.selectedFill).toBe('#000000');
  });
});

describe('accent on a filled surface', () => {
  /**
   * A mark painted *in* the accent can vanish, and that is a different failure
   * from a dim one. The monochrome accents are the reason: `White` is invisible
   * on `selectedFill` for the dark themes and on `surfaceRaised` for the light
   * ones, `Black` has the mirror problem, and the gap an absent icon leaves in
   * the dock reads as a layout fault rather than a preference.
   *
   * This asserts the **resolved** colour — what `accentOn` hands back — against
   * both fills, for every theme × accent pair. Asserting on the accent alone
   * cannot catch this, because the accent's invisibility *is* the bug.
   */
  it.each(ACCENT_NAMES.flatMap((accent) => themes.map((t) => [t.name, accent, t] as const)))(
    '%s / %s keeps a dock icon visible on both the pill and the dock',
    (_name, accent, base) => {
      const theme = withAccent(base, accent);
      const onPill = accentOn(theme.accent, theme.selectedFill, theme.selectedText);
      const onDock = accentOn(theme.accent, theme.surfaceRaised, theme.textMuted);
      expect(contrast(onPill, theme.selectedFill)).toBeGreaterThanOrEqual(
        ACCENT_VISIBILITY_FLOOR
      );
      expect(contrast(onDock, theme.surfaceRaised)).toBeGreaterThanOrEqual(
        ACCENT_VISIBILITY_FLOOR
      );
    },
    10000
  );

  it('keeps the accent wherever the accent is already visible', () => {
    // The fallback must fire only on a genuine collision. Coral on the white
    // pill is the app's default selected tab at 2.86:1 — visible, and a design
    // the palette intends, so a stricter threshold here would recolour it.
    const dark = withAccent(THEMES.Dark, 'Claude');
    expect(accentOn(dark.accent, dark.surfaceRaised, dark.textMuted)).toBe(dark.accent);
    expect(accentOn(dark.accent, dark.selectedFill, dark.selectedText)).toBe(dark.accent);
    for (const base of themes) {
      for (const accent of ['Claude', 'Lavender'] as const) {
        const theme = withAccent(base, accent);
        expect([theme.name, accent, accentOn(theme.accent, theme.selectedFill, theme.selectedText)])
          .toEqual([theme.name, accent, theme.accent]);
        expect([theme.name, accent, accentOn(theme.accent, theme.surfaceRaised, theme.textMuted)])
          .toEqual([theme.name, accent, theme.accent]);
      }
    }
  });

  it('falls back to the ink already proven against that fill', () => {
    // White on the white pill: the accent is gone, and the fallback has to be
    // the pill's own readable ink rather than an invented third colour.
    const dark = withAccent(THEMES.Dark, 'White');
    expect(accentOn(dark.accent, dark.selectedFill, dark.selectedText)).toBe(dark.selectedText);
    // Black on the black pill: the mirror of the same collision.
    const light = withAccent(THEMES.Light, 'Black');
    expect(accentOn(light.accent, light.selectedFill, light.selectedText)).toBe(
      light.selectedText
    );
    // White on B&W's white dock: a collision on the *unselected* tabs, which is
    // the one that made two of three icons disappear rather than one.
    const bw = withAccent(THEMES['B&W'], 'White');
    expect(accentOn(bw.accent, bw.surfaceRaised, bw.textMuted)).toBe(bw.textMuted);
    // The mirror of that one is *not* a collision: black on a white dock is the
    // most visible pairing in the whole palette, and the fallback must not fire.
    const bwBlack = withAccent(THEMES['B&W'], 'Black');
    expect(accentOn(bwBlack.accent, bwBlack.surfaceRaised, bwBlack.textMuted)).toBe(
      bwBlack.accent
    );
  });

  it('separates "absent" from every intentional pairing', () => {
    // The floor's whole job: it must reject only marks that are effectively the
    // same colour as their ground. Coral on the white pill is the tightest
    // deliberate pairing at 2.86:1 and has to survive it.
    expect(contrast('#ffffff', '#f5f5f5')).toBeLessThan(ACCENT_VISIBILITY_FLOOR);
    expect(contrast('#000000', '#000000')).toBeLessThan(ACCENT_VISIBILITY_FLOOR);
    expect(contrast('#f76f53', '#f5f5f5')).toBeGreaterThanOrEqual(ACCENT_VISIBILITY_FLOOR);
    expect(contrast('#b497ff', '#f5f5f5')).toBeGreaterThanOrEqual(ACCENT_VISIBILITY_FLOOR);
  });
});

describe('surface ink', () => {
  it('shares one ink across canvas and surface, because B&W cards are light', () => {
    // B&W used to invert *inside* a black card. It no longer does: the black is
    // reserved for the primary card, so an ordinary card and the canvas agree
    // and `surfaceTheme` is the identity for every theme including B&W.
    for (const theme of themes) {
      expect(theme.onSurface).toBe(theme.text);
      expect(theme.onSurfaceMuted).toBe(theme.textMuted);
      expect(surfaceTheme(theme)).toBe(theme);
    }
  });
});

describe('elevation', () => {
  it('floats B&W chrome on the same white as a card, carried by shadow', () => {
    // A white panel on a near-white canvas cannot be separated by fill value;
    // its border and `cardShadow` are what lift it. Keeping `surfaceRaised`
    // equal to `surface` says that explicitly instead of by accident.
    const theme = THEMES['B&W'];
    expect(theme.surfaceRaised).toBe(theme.surface);
    expect(theme.surface).not.toBe(theme.background);
  });

  it('leaves the other three themes with one fill, so the migration was a no-op', () => {
    for (const name of THEME_NAMES) {
      if (name === 'B&W') continue;
      expect(THEMES[name].surfaceRaised).toBe(THEMES[name].surface);
    }
  });

  it('draws every hairline in a colour distinct from what it sits on', () => {
    // A border equal to its background is a border that is not there. The old
    // B&W hairlines were 1.4:1 — present in the file, absent to the eye.
    for (const theme of themes) {
      expect(theme.border).not.toBe(theme.background);
      expect(theme.onSurfaceBorder).not.toBe(theme.surface);
    }
  });
});

describe('design tokens', () => {
  it('keeps the approved spacing scale on the 4pt grid', () => {
    for (const value of Spacing.approved) expect(value % 4).toBe(0);
  });

  it('restricts typography to four sizes and two weights', () => {
    const sizes = new Set<number>();
    const weights = new Set<string>();
    for (const token of Object.values(Typography.app)) {
      sizes.add(token.fontSize);
      weights.add(String(token.fontWeight));
    }
    expect([...sizes].sort((a, b) => a - b)).toEqual([12, 14, 18, 24]);
    expect([...weights].sort()).toEqual(['400', '600']);
  });

  it('uses one press scale for every interactive element', () => {
    expect(Motion.pressedScale).toBe(0.97);
  });

  it('animates the sidebar and screen swaps over ~250ms', () => {
    expect(Motion.duration.base).toBe(250);
    expect(Motion.spring.gentle.mass).toBeGreaterThan(0);
  });

  it('keeps border radii off bare literals', () => {
    expect(Radius.card).toBe(Radius.xl);
  });
});

describe('navigation', () => {
  it('keeps Settings out of the bottom dock', () => {
    expect(DOCK_SCREENS).toEqual(['Overview', 'Notes', 'Agenda']);
    expect(DOCK_SCREENS).not.toContain('Settings');
  });

  it('shows every Overview section by default', () => {
    expect(Object.values(DEFAULT_LAYOUT).every(Boolean)).toBe(true);
  });
});
