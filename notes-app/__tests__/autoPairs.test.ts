import { applyAutoPair, pairFor, stepOverCaret } from '../src/components/notes/autoPairs';

/** Types `char` at `caret` in `previous`, and returns what the editor would do. */
function type(previous: string, char: string, caret = previous.length) {
  const next = previous.slice(0, caret) + char + previous.slice(caret);
  return applyAutoPair(previous, next, caret + 1);
}

describe('applyAutoPair', () => {
  it('closes every bracket type with the caret between the halves', () => {
    const cases: [string, string, string][] = [
      ['(', '(', ')'],
      ['[', '[', ']'],
      ['{', '{', '}'],
      ['"', '"', '"'],
      ['`', '`', '`'],
    ];
    for (const [char, open, close] of cases) {
      // Caret is an offset into the rewritten text: 1, i.e. past the opener and
      // before the closer.
      expect(type('', char)).toEqual({ text: `${open}${close}`, caret: 1 });
    }
  });

  it('closes a pair typed mid-text, leaving the caret between the halves', () => {
    // Caret indexes the rewritten text: `hello ()` at 7 is between the halves.
    expect(type('hello ', '(')).toEqual({ text: 'hello ()', caret: 7 });
    expect(type('a', '[', 1)).toEqual({ text: 'a[]', caret: 2 });
    // An ordinary letter is not touched.
    expect(type('a[b', 'c')).toBeNull();
  });

  it('leaves an opener that is already followed by its closer alone', () => {
    // The user is walking back into `(x)` and types `(` before the `)`.
    expect(type('()', '(', 1)).toBeNull();
  });

  it('only auto-closes a quote where one can open', () => {
    expect(type('', '"')).not.toBeNull();
    expect(type('(', '"')).not.toBeNull();
    // Mid-word is an apostrophe, not a string delimiter.
    expect(type('don', "'")).toBeNull();
    expect(type('its', "'")).toBeNull();
  });

  it('closes a quote after a space or an opening bracket', () => {
    // The rule is positional — start of text, whitespace, or an opening
    // bracket — because there is no way to know whether a straight quote is a
    // delimiter or an apostrophe. Both of these are the delimiter case.
    expect(type('he said ', '"')).toEqual({ text: 'he said ""', caret: 9 });
    // One typed quote plus one inserted closer — an empty quoted string.
    expect(type('(', '"')).toEqual({ text: '(""', caret: 2 });
  });

  it('ignores anything that is not a single inserted character', () => {
    expect(type('a', 'bc')).toBeNull(); // two characters
    expect(type('', '**')).toBeNull(); // markdown, not a bracket
    expect(type('a', 'b', 0)).toBeNull(); // an ordinary letter
  });

  it('ignores a paste and a deletion', () => {
    const pasted = applyAutoPair('ab', 'ab(cd)', 6);
    expect(pasted).toBeNull();
    const deleted = applyAutoPair('abc', 'ab', 2);
    expect(deleted).toBeNull();
  });

  it('ignores an autocorrect that rewrote a word', () => {
    // `teh` → `the` is +1 in length but not a single inserted character.
    expect(applyAutoPair('teh', 'the', 3)).toBeNull();
  });

  it('does not close angle brackets', () => {
    // `a < b` must not become `a <> b`.
    expect(type('a ', '<')).toBeNull();
    expect(pairFor('<')).toBeNull();
  });
});

describe('stepOverCaret', () => {
  it('steps over an existing closer instead of doubling it', () => {
    // Caret sits between the `(` and the `)`, and `)` is typed.
    expect(stepOverCaret('())', '()', 2)).toBe(3);
    expect(stepOverCaret('[]]', '[]', 2)).toBe(3);
    expect(stepOverCaret('{}}', '{}', 2)).toBe(3);
  });

  it('types a closer normally when there is nothing to step over', () => {
    expect(stepOverCaret('()x', '(', 1)).toBeNull();
    expect(stepOverCaret('(a)', '(', 0)).toBeNull();
  });

  it('does not step over a straight quote', () => {
    // Two identical quotes in a row is a legitimate (if odd) thing to type, and
    // an apostrophe at the end of a word must never be swallowed.
    expect(stepOverCaret('""', '"', 1)).toBeNull();
  });

  it('only applies to a single inserted character', () => {
    expect(stepOverCaret('a]', 'a', 1)).toBeNull();
    expect(stepOverCaret('', '', 0)).toBeNull();
  });
});
