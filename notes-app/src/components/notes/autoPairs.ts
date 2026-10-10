/**
 * Bracket and quote auto-closing.
 *
 * Typing `(` should give `()` with the caret between them, because the closing
 * bracket is something you have to remember to type and something you cannot
 * forget to *delete* if you did not. Every pair is inserted as one edit, so
 * there is no state in which the caret sits after a lone opening bracket.
 *
 * **Pure, and this is the whole reason it is a separate file.** The editor
 * rewrites the text on the way through this function, and the rule for *when* to
 * rewrite has to be testable without a keyboard: `insertsPair` decides, and
 * `applyAutoPair` performs.
 */

/** An opening character and the closer it completes. */
export interface Pair {
  open: string;
  close: string;
}

/**
 * The pairs that auto-close, longest-first where they overlap.
 *
 * Backtick is here because a fenced code block is typed with it, and a lone
 * backtick mid-sentence is either one or the other — the pair rule is the same
 * either way. Angle brackets are **not** included: `->` and `a < b` are far more
 * common in a note than `<tag>`, and auto-closing a comparison turns `a < b`
 * into `a <> b`. That is the one bracket whose payoff did not beat its cost.
 */
export const PAIRS: readonly Pair[] = [
  { open: '(', close: ')' },
  { open: '[', close: ']' },
  { open: '{', close: '}' },
  { open: '"', close: '"' },
  { open: "'", close: "'" },
  { open: '`', close: '`' },
];

/** The pair for a character, or `null`. */
export function pairFor(char: string): Pair | null {
  return PAIRS.find((pair) => pair.open === char) ?? null;
}

/**
 * Whether a quote typed at `index` in `text` should auto-close.
 *
 * A straight quote is ambiguous — it opens a string *or* is an apostrophe in
 * `don't` — so it only pairs when it is at the start of the text or preceded by
 * whitespace or an opening bracket. Anywhere else it is typed bare, which is
 * what makes `don't` come out right instead of `don''t`.
 *
 * The character *before* the quote is read from `text`, so the caller passes the
 * quote's own index rather than a caret.
 */
function quoteShouldClose(text: string, index: number): boolean {
  const before = text[index - 1];
  if (before === undefined) return true;
  return /[\s([{]/.test(before);
}

export interface AutoPairResult {
  text: string;
  /** Where the caret goes afterwards — between the two halves. */
  caret: number;
}

/**
 * Applies auto-closing to a change, or reports that nothing should change.
 *
 * Returns `null` when the edit is not a bare insertion of one opening character,
 * which covers every other case: a paste, a deletion, a selection replaced, or
 * an opening bracket typed *inside* an existing pair — where the user wants
 * step-over, not a second pair. See `isStepOver`.
 *
 * @param previous text before the change
 * @param next    text after the change
 * @param caret   caret position in `next`, as reported by the change event
 */
export function applyAutoPair(
  previous: string,
  next: string,
  caret: number
): AutoPairResult | null {
  // Exactly one character was added at the caret and *nothing else changed*.
  // Checking the whole text rather than only the length is what rejects a paste
  // of the same length, an autocorrect that rewrote a word, and a selection that
  // was replaced with a single character — all three are `length + 1` too.
  if (
    next.length !== previous.length + 1 ||
    next.slice(0, caret - 1) + next.slice(caret) !== previous
  ) {
    return null;
  }

  const pair = pairFor(next[caret - 1] ?? '');
  if (!pair) return null;
  // `caret - 1` is the quote just inserted; the one before it decides.
  if ((pair.open === '"' || pair.open === "'") && !quoteShouldClose(next, caret - 1)) {
    return null;
  }
  // Typing an opener just before an existing closer is *step-over*: the user is
  // walking back through a pair they made, and inserting a second one would leave
  // `(]` on screen.
  if (next[caret] === pair.close) return null;

  // The closer goes in *at* the caret, so the caret stays where it was — and
  // where it was is one past the opener, which is between the two halves.
  return {
    text: `${next.slice(0, caret)}${pair.close}${next.slice(caret)}`,
    caret,
  };
}

/**
 * Typing a closing bracket that is already the next character steps over it.
 *
 * This is the other half of auto-closing and it is what makes the feature
 * usable: with auto-insert alone, typing `)` at the end of `(caret)` gives
 * `(caret))`. Returns the caret's new position, or `null` if this is not that
 * case.
 */
export function stepOverCaret(text: string, previous: string, caret: number): number | null {
  if (text.length !== previous.length + 1) return null;
  const typed = text[caret - 1];
  if (!typed) return null;
  if (!PAIRS.some((pair) => pair.close === typed && typed !== '"' && typed !== "'")) return null;
  // Only when that character is already sitting immediately after the caret.
  return text[caret] === typed ? caret + 1 : null;
}
