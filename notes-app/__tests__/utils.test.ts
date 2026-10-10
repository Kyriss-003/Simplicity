import {
  deriveTitle,
  previewLines,
  greeting,
  getMarkdownStyles,
  liveMarkdownStyle,
} from '../src/components/shared/utils';
import { THEMES, SYNTAX_DIM_MIX } from '../src/theme';

/** Blends `top` over `bottom` by `amount`, the way the editor's syntax dim does. */
const blend = (top: string, bottom: string, amount: number): string => {
  const channel = (i: number) => {
    const t = parseInt(top.slice(i, i + 2), 16);
    const b = parseInt(bottom.slice(i, i + 2), 16);
    return Math.round(b + (t - b) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
};

describe('deriveTitle', () => {
  it('takes the first markdown heading', () => {
    expect(deriveTitle('intro text\n# Real Title\n## Other')).toBe('Real Title');
  });

  it('strips trailing hash characters', () => {
    expect(deriveTitle('## Closed ##')).toBe('Closed');
  });

  it('returns empty string when there is no heading', () => {
    expect(deriveTitle('just body text')).toBe('');
  });
});

describe('previewLines', () => {
  it('strips list markers and headings, capped at max', () => {
    expect(previewLines('# Head\n- one\n1. two\nthree\nfour\nfive', 3)).toEqual(['one', 'two', 'three']);
  });

  it('returns an empty array for blank content', () => {
    expect(previewLines('   \n  ')).toEqual([]);
  });
});

describe('greeting', () => {
  it('greets the small hours as morning, not evening', () => {
    // The bug this pins: morning started at 5, so 00:00–04:59 fell through to
    // "Good evening" — the same label a night hour and the evening share, which
    // is the whole confusion. A 3am user was told it was evening.
    expect(greeting(0)).toBe('Good morning');
    expect(greeting(3)).toBe('Good morning');
    expect(greeting(4)).toBe('Good morning');
  });

  it('splits the day at midnight, noon and five', () => {
    expect(greeting(0)).toBe('Good morning');
    expect(greeting(11)).toBe('Good morning');
    expect(greeting(12)).toBe('Good afternoon');
    expect(greeting(16)).toBe('Good afternoon');
    expect(greeting(17)).toBe('Good evening');
    expect(greeting(23)).toBe('Good evening');
  });

  it('covers every hour of the day without a gap', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(greeting(hour));
    }
  });

  it('defaults to the current hour', () => {
    expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(greeting());
  });
});

describe('getMarkdownStyles', () => {
  it('uses only approved type sizes', () => {
    const md = getMarkdownStyles(THEMES.Dark);
    const sizes = new Set<number>();
    for (const style of Object.values(md)) {
      const size = (style as { fontSize?: number }).fontSize;
      if (size !== undefined) sizes.add(size);
    }
    for (const size of sizes) {
      expect([24, 18, 14, 12]).toContain(size);
    }
  });
});

describe('liveMarkdownStyle', () => {
  const theme = THEMES.Dark;
  const style = liveMarkdownStyle(theme);

  it('dims raw markers to a faint but readable share of the muted text', () => {
    // Markers cannot be collapsed (the library exposes colour only), so they are
    // dimmed rather than hidden: invisible markers leave a gap that reads worse
    // than a visible marker.
    expect(style.syntax.color).toBe(theme.syntaxDim);
  });

  it('keeps markers and body text visibly distinct', () => {
    // Regression guard: if syntax and text ever resolve to the same colour the
    // whole live-preview effect becomes invisible.
    expect(style.syntax.color).not.toBe(theme.text);
  });

  it('takes every colour from a theme token', () => {
    const allowed = new Set([
      theme.text,
      theme.textMuted,
      theme.accent,
      theme.border,
      theme.pillBg,
      theme.surface,
      theme.syntaxDim,
    ]);
    const colours = [
      style.syntax.color,
      style.link.color,
      style.blockquote.borderColor,
      style.code.color,
      style.code.backgroundColor,
      style.pre.color,
      style.pre.backgroundColor,
    ];
    for (const colour of colours) expect(allowed.has(colour)).toBe(true);
  });

  it('uses approved type sizes for headings and code', () => {
    expect([24, 18, 14, 12]).toContain(style.h1.fontSize);
    expect([24, 18, 14, 12]).toContain(style.code.fontSize);
    expect([24, 18, 14, 12]).toContain(style.pre.fontSize);
  });

  it('keeps blockquote spacing on the 4pt grid', () => {
    // Border *widths* are not spacing and are exempt from the grid, as they are
    // everywhere else in the app; margins and padding are.
    expect(style.blockquote.marginLeft % 4).toBe(0);
    expect(style.blockquote.paddingLeft % 4).toBe(0);
  });

  it('re-themes when the theme changes', () => {
    expect(liveMarkdownStyle(THEMES.Light).syntax.color).toBe(THEMES.Light.syntaxDim);
    expect(liveMarkdownStyle(THEMES.OLED).syntax.color).toBe(THEMES.OLED.syntaxDim);
  });

  it('defines syntaxDim for every theme, since the editor needs it', () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.syntaxDim).toBe(blend(theme.textMuted, theme.background, SYNTAX_DIM_MIX));
    }
  });

  it('keeps syntaxDim strictly between the canvas and the muted text', () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.syntaxDim).not.toBe(theme.background);
      expect(theme.syntaxDim).not.toBe(theme.textMuted);
    }
  });
});
