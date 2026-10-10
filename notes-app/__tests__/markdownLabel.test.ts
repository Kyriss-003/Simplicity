import { buildMarkdownSegments } from '../src/components/shared/MarkdownLabel';
import { THEMES } from '../src/theme';

const theme = THEMES.Dark;
const plain = (value: string) => buildMarkdownSegments(value, theme);

/** Concatenating every segment must reproduce the source minus its markers. */
const rendered = (value: string) =>
  plain(value)
    .map((s) => s.text)
    .join('');

describe('buildMarkdownSegments', () => {
  it('returns a single plain run for text with no markdown', () => {
    expect(plain('Review pull requests')).toEqual([{ text: 'Review pull requests' }]);
  });

  it('styles a bold run and drops its markers', () => {
    const segments = plain('Send **the** digest');
    expect(rendered('Send **the** digest')).toBe('Send the digest');
    const bold = segments.find((s) => s.style?.fontWeight === '600');
    expect(bold?.text).toBe('the');
  });

  it('drops every marker, so a rendered label never shows ** or #', () => {
    for (const source of ['**bold**', '## heading', '`code`', '~~gone~~', '*em*']) {
      expect(rendered(source)).not.toMatch(/[*#`~]/);
    }
    // A link drops its brackets, parens and URL — only the label survives.
    expect(rendered('[docs](https://example.com)')).toBe('docs');
  });

  it('handles several constructs in one string without losing text', () => {
    expect(rendered('a **b** c *d* e')).toBe('a b c d e');
  });

  it('emits plain text before, between and after constructs', () => {
    const segments = plain('one **two** three');
    expect(segments.map((s) => s.text)).toEqual(['one ', 'two', ' three']);
  });

  it('colours a link with the theme accent', () => {
    const link = plain('[docs](https://x)').find((s) => s.style?.color);
    expect(link?.text).toBe('docs');
    expect(link?.style?.color).toBe(theme.accent);
  });

  it('never emits the same characters twice', () => {
    // A range that starts before the cursor has already been consumed must be
    // dropped, not applied again, and an outer construct must not swallow an
    // inner one.
    expect(rendered('# **head**')).toBe('head');
    expect(rendered('**bold** and *ital*')).toBe('bold and ital');
  });

  it('renders a bare heading, and an emphasis that follows a bold run', () => {
    // Both were parser bugs: a line opening with `*` matched the list-bullet
    // branch, and the italic pass paired the closing `**` with the opening `*`
    // of the next construct, so the second one was never matched at all.
    expect(rendered('# heading')).toBe('heading');
    expect(rendered('a **b** c *d* e')).toBe('a b c d e');
  });

  it('leaves a construct it cannot resolve as literal text', () => {
    // Two documented limitations, shown honestly rather than rendered as the
    // wrong thing. `***bold italic***` is rejected by every rule (each one's
    // marker-run guard catches the others'), and a construct that *wraps* a
    // code span cannot be styled because the code pass claims its span first —
    // the live editor leaves those markers visible too.
    expect(rendered('***x***')).toBe('***x***');
    expect(rendered('**a `b` c**')).toBe('**a b c**');
  });

  it('handles an empty string without throwing', () => {
    expect(plain('')).toEqual([{ text: '' }]);
  });
});
