export interface Pair {
  open: string;
  close: string;
}

export const PAIRS: readonly Pair[] = [
  { open: '(', close: ')' },
  { open: '[', close: ']' },
  { open: '{', close: '}' },
  { open: '"', close: '"' },
  { open: "'", close: "'" },
  { open: '`', close: '`' },
];

export function pairFor(char: string): Pair | null {
  return PAIRS.find((pair) => pair.open === char) ?? null;
}

function quoteShouldClose(text: string, index: number): boolean {
  const before = text[index - 1];
  if (before === undefined) return true;
  return /[\s([{]/.test(before);
}

export interface AutoPairResult {
  text: string;
  caret: number;
}

export function applyAutoPair(
  previous: string,
  next: string,
  caret: number
): AutoPairResult | null {
  if (
    next.length !== previous.length + 1 ||
    next.slice(0, caret - 1) + next.slice(caret) !== previous
  ) {
    return null;
  }

  const pair = pairFor(next[caret - 1] ?? '');
  if (!pair) return null;
  if ((pair.open === '"' || pair.open === "'") && !quoteShouldClose(next, caret - 1)) {
    return null;
  }
  if (next[caret] === pair.close) return null;

  return {
    text: `${next.slice(0, caret)}${pair.close}${next.slice(caret)}`,
    caret,
  };
}

export function stepOverCaret(text: string, previous: string, caret: number): number | null {
  if (text.length !== previous.length + 1) return null;
  const typed = text[caret - 1];
  if (!typed) return null;
  if (!PAIRS.some((pair) => pair.close === typed && typed !== '"' && typed !== "'")) return null;
  return text[caret] === typed ? caret + 1 : null;
}
