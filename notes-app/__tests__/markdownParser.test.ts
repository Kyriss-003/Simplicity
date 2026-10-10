import { parseMarkdownRanges, MARKDOWN_PARSE_BUDGET } from '../src/components/notes/markdownParser';

type Range = { type: string; start: number; length: number; depth?: number };

/** Every range the parser emits for `text`, as [type, substring]. */
const styled = (text: string): Range[] => parseMarkdownRanges(text) as Range[];

/** The raw characters a range covers — the invariant that keeps offsets exact. */
const covered = (text: string, range: Range) => text.slice(range.start, range.start + range.length);

const typesAt = (text: string, index: number) =>
  styled(text)
    .filter((r) => r.start <= index && index < r.start + r.length)
    .map((r) => r.type);

describe('parseMarkdownRanges — offsets', () => {
  it('never emits an out-of-bounds range', () => {
    const samples = [
      '# Heading',
      'a **b** c',
      '- item\n- item',
      '> quote',
      '`code` and ```js\nconst a = 1;\n```',
      '[link](https://example.com)',
      '~~gone~~ and *em* and _em_',
      '```\nunterminated',
      '```',
      '',
    ];
    for (const text of samples) {
      for (const range of styled(text)) {
        expect(range.start).toBeGreaterThanOrEqual(0);
        expect(range.start + range.length).toBeLessThanOrEqual(text.length);
        expect(range.length).toBeGreaterThan(0);
      }
    }
  });

  it('covers the exact source characters, so no marker is ever removed', () => {
    const text = 'a **b** `c` [d](https://e.f)';
    expect(styled(text).map((r) => covered(text, r))).toEqual(
      expect.arrayContaining(['**', 'b', '`', 'c', '`', '[', 'd', ']', '(', 'https://e.f', ')']),
    );
  });
});

describe('parseMarkdownRanges — syntax dimming', () => {
  it('dims ** markers and styles the content between them', () => {
    const text = 'a **b** c';
    expect(styled(text).filter((r) => r.type === 'syntax').map((r) => covered(text, r))).toEqual([
      '**',
      '**',
    ]);
    const bold = styled(text).filter((r) => r.type === 'bold');
    expect(bold).toHaveLength(1);
    expect(covered(text, bold[0])).toBe('b');
  });

  it('dims heading hashes and styles the heading text', () => {
    const text = '## Title';
    expect(typesAt(text, 0)).toContain('syntax');
    expect(typesAt(text, 1)).toContain('syntax');
    expect(covered(text, styled(text).find((r) => r.type === 'h1')!)).toBe('Title');
  });

  it('dims list markers', () => {
    const text = '- one\n- two';
    const marks = styled(text).filter((r) => r.type === 'syntax').map((r) => covered(text, r));
    expect(marks).toEqual(['-', '-']);
  });

  it('dims ordered-list markers including the number', () => {
    expect(covered('1. one', styled('1. one').find((r) => r.type === 'syntax')!)).toBe('1.');
  });

  it('dims code-span backticks and styles the code', () => {
    const text = 'call `foo()` now';
    const code = styled(text).filter((r) => r.type === 'code');
    expect(code).toHaveLength(1);
    expect(covered(text, code[0])).toBe('foo()');
    expect(styled(text).filter((r) => r.type === 'syntax').map((r) => covered(text, r))).toEqual([
      '`',
      '`',
    ]);
  });
});

describe('parseMarkdownRanges — blocks', () => {
  it('styles a fenced block as pre and dims both fences', () => {
    const text = '```js\nconst a = 1;\n```';
    const pre = styled(text).filter((r) => r.type === 'pre');
    expect(pre).toHaveLength(1);
    expect(covered(text, pre[0])).toBe('const a = 1;\n');
    expect(styled(text).filter((r) => r.type === 'syntax').map((r) => covered(text, r))).toEqual([
      '```',
      '```',
    ]);
  });

  it('does not style inline code inside a fence', () => {
    // Regression: the fence body must be claimed, or a fenced `foo` line also
    // emits a code-span range and the body renders twice-styled.
    const ranges = styled('```\nconst a = `x`;\n```');
    expect(ranges.filter((r) => r.type === 'code')).toHaveLength(0);
  });

  it('handles a blank line inside a fence', () => {
    const text = '```\na\n\nb\n```';
    expect(covered(text, styled(text).find((r) => r.type === 'pre')!)).toBe('a\n\nb\n');
  });

  it('styles the rest of the note for an unterminated fence', () => {
    const text = '```\nconst a = 1;';
    expect(covered(text, styled(text).find((r) => r.type === 'pre')!)).toBe('const a = 1;');
  });

  it('marks an empty fence exactly once', () => {
    expect(styled('```').filter((r) => r.type === 'syntax')).toHaveLength(1);
  });

  it('styles blockquote text and dims the marker with its indent', () => {
    const text = '> quoted';
    expect(covered(text, styled(text).find((r) => r.type === 'blockquote')!)).toBe('quoted');
    expect(covered(text, styled(text).find((r) => r.type === 'syntax')!)).toBe('> ');
  });
});

describe('parseMarkdownRanges — inline constructs', () => {
  it('styles links and dims their delimiters', () => {
    const text = 'see [docs](https://x.dev)';
    expect(covered(text, styled(text).find((r) => r.type === 'link')!)).toBe('docs');
  });

  it('distinguishes bold from italic', () => {
    expect(styled('**b**').some((r) => r.type === 'bold')).toBe(true);
    expect(styled('**b**').some((r) => r.type === 'italic')).toBe(false);
    expect(styled('*i*').some((r) => r.type === 'italic')).toBe(true);
  });

  it('styles strikethrough', () => {
    expect(covered('~~x~~', styled('~~x~~').find((r) => r.type === 'strikethrough')!)).toBe('x');
  });

  it('does not style emphasis inside a code span', () => {
    expect(styled('`**not bold**`').some((r) => r.type === 'bold')).toBe(false);
  });

  it('handles several constructs on one line', () => {
    const text = '**bold** and `code` and [a](b)';
    const found = new Set(styled(text).map((r) => r.type));
    expect(found).toEqual(new Set(['syntax', 'bold', 'code', 'link']));
  });
});

describe('parseMarkdownRanges — budget', () => {
  it('returns nothing for an over-budget note, so the UI thread cannot stall', () => {
    const huge = 'a'.repeat(MARKDOWN_PARSE_BUDGET + 1);
    expect(parseMarkdownRanges(huge)).toEqual([]);
  });

  it('still parses a note exactly at the budget', () => {
    const head = 'a **b**';
    const at = head + 'c'.repeat(MARKDOWN_PARSE_BUDGET - head.length);
    expect(at).toHaveLength(MARKDOWN_PARSE_BUDGET);
    expect(parseMarkdownRanges(at).some((r) => r.type === 'bold')).toBe(true);
  });

  it('returns nothing for empty input', () => {
    expect(parseMarkdownRanges('')).toEqual([]);
  });
});
