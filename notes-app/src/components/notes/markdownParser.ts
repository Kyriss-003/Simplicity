import type { MarkdownRange } from '@expensify/react-native-live-markdown';

/**
 * Markdown → formatting-ranges parser for `MarkdownTextInput`.
 *
 * It is a `'worklet'`: the input runs it on the UI thread on every keystroke.
 * That imposes two constraints the tests cannot catch:
 *
 * 1. **Self-contained.** A worklet may not call ordinary module functions — only
 *    other worklets. Every regular expression and helper therefore lives *inside*
 *    the function body. Hoisting one to module scope compiles, passes tests, and
 *    then throws on device.
 * 2. **No module-scope constants.** The parse budget is inlined for the same
 *    reason; the exported copy below is for tests and callers to reason about.
 *
 * The text is never rewritten: markers keep their exact characters and offsets
 * and are only dimmed, which is what keeps click targets and the caret 1:1.
 */

/** Above this length the parser returns no ranges and the note renders as plain text. */
export const MARKDOWN_PARSE_BUDGET = 20_000;

/**
 * Worklet-compatible markdown parser. See the file header before editing.
 */
export function parseMarkdownRanges(input: string): MarkdownRange[] {
  'worklet';

  // Inlined on purpose: a worklet cannot read module scope. Beyond this length
  // we hand back nothing, so a very long note degrades to unstyled-but-editable
  // instead of stalling the UI thread on every keystroke.
  if (!input || input.length > 20000) return [];

  const ranges: MarkdownRange[] = [];
  /** Spans owned by a stronger construct; nothing else may style inside them. */
  const taken: { from: number; to: number }[] = [];

  const overlaps = (from: number, to: number) => {
    for (let i = 0; i < taken.length; i += 1) {
      if (from < taken[i].to && to > taken[i].from) return true;
    }
    return false;
  };

  /** Reserve a span; nothing emitted afterwards may style inside it. */
  const claim = (from: number, to: number) => {
    taken.push({ from, to });
  };

  /**
   * Emit a range unless it collides with a claim from a stronger construct.
   *
   * Callers emit every part of a construct *before* claiming its span, so a
   * construct never collides with itself and never needs an "own span"
   * exemption — which is what made the first version drop its own ranges.
   */
  const add = (type: MarkdownRange['type'], start: number, length: number, depth?: number) => {
    if (length <= 0 || start < 0) return;
    for (let i = 0; i < taken.length; i += 1) {
      if (start < taken[i].to && start + length > taken[i].from) return;
    }
    ranges.push(depth === undefined ? { type, start, length } : { type, start, length, depth });
  };

  // ── Line pass: fences, headings, quotes, list markers ─────────────────────
  let lineStart = 0;
  let fenceAt = -1;
  let bodyFrom = -1;

  /** Closes a fence: style the body, dim both delimiters, free the span. */
  const closeFence = (closeMarkerAt: number) => {
    if (bodyFrom !== -1) {
      add('pre', bodyFrom, closeMarkerAt - bodyFrom);
      claim(bodyFrom, closeMarkerAt);
    }
    add('syntax', closeMarkerAt, 3);
    claim(closeMarkerAt, closeMarkerAt + 3);
    fenceAt = -1;
    bodyFrom = -1;
  };

  while (lineStart < input.length) {
    let lineEnd = input.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = input.length;
    const line = input.slice(lineStart, lineEnd);
    const indent = line.length - line.trimStart().length;
    const contentAt = lineStart + indent;

    if (fenceAt >= 0) {
      if (line.trimStart().startsWith('```')) {
        // The delimiter closes the fence, so it is not part of the body.
        closeFence(contentAt);
      } else {
        if (bodyFrom === -1) bodyFrom = lineStart;
      }
    } else if (line.trimStart().startsWith('```')) {
      add('syntax', contentAt, 3);
      claim(contentAt, contentAt + 3);
      // Always enter fence state. A bare ``` is an *opener*, not a complete
      // empty fence — markdown needs a closing delimiter, and a note that ends
      // mid-fence is handled by the unterminated branch below.
      fenceAt = contentAt;
      bodyFrom = -1;
    } else {
      // ATX heading: dim the hashes *and* the space, style the text.
      const heading = /^#{1,6}(\s|$)/.exec(line);
      if (heading) {
        const markerLength = heading[0].length;
        add('syntax', lineStart, markerLength);
        const textAt = lineStart + markerLength;
        const textLength = lineEnd - textAt;
        if (textLength > 0) {
          // `depth` carries the level so the renderer can scale H1..H6.
          add('h1', textAt, textLength, indent + markerLength);
        }
      } else {
        // Block quote: dim the `>` runs, style the quoted text.
        const quote = /^\s*>/.exec(line);
        if (quote) {
          let markerLength = quote[0].lastIndexOf('>') + 1;
          // The space after the marker is quote indentation, not quote text.
          const rest = line.slice(markerLength);
          markerLength += rest.length - rest.trimStart().length;
          add('syntax', lineStart, markerLength);
          const textAt = lineStart + markerLength;
          const textLength = lineEnd - textAt;
          if (textLength > 0) add('blockquote', textAt, textLength);
        } else {
          // List marker: dim the bullet or number so the line reads as a list.
          // The marker must be followed by whitespace — without that, a line
          // opening with `*emphasis*` or `**bold**` matched the bullet branch and
          // emitted a stray marker range at offset 0.
          const list = /^(\s*)([-*+]|\d{1,9}[.)])(\s)/.exec(line);
          if (list) {
            add('syntax', lineStart + list[1].length, list[2].length);
          }
        }
      }
    }

    lineStart = lineEnd + 1;
  }

  // Unterminated fence: style the rest of the note rather than nothing.
  if (fenceAt >= 0 && bodyFrom !== -1) {
    add('pre', bodyFrom, input.length - bodyFrom);
    claim(bodyFrom, input.length);
  }

  // ── Inline pass ──────────────────────────────────────────────────────────
  // Each construct emits its parts and then claims its whole span, so a weaker
  // construct can never restyle the inside of a stronger one.

  const codePattern = /`+[^`\n]*`+/g;
  let codeMatch = codePattern.exec(input);
  while (codeMatch !== null) {
    const start = codeMatch.index;
    const length = codeMatch[0].length;
    if (!overlaps(start, start + length)) {
      add('syntax', start, 1);
      if (length > 2) add('code', start + 1, length - 2);
      add('syntax', start + length - 1, 1);
      claim(start, start + length);
    }
    codeMatch = codePattern.exec(input);
  }

  const linkPattern = /\[([^\]\n]*)\]\(([^)\n]*)\)/g;
  let linkMatch = linkPattern.exec(input);
  while (linkMatch !== null) {
    const start = linkMatch.index;
    const length = linkMatch[0].length;
    const textLength = linkMatch[1].length;
    const urlStart = start + 1 + textLength + 2;
    const urlLength = linkMatch[2].length;
    if (!overlaps(start, start + length)) {
      add('syntax', start, 1);
      if (textLength > 0) add('link', start + 1, textLength);
      add('syntax', start + 1 + textLength, 1);
      add('syntax', start + 1 + textLength + 1, 1);
      if (urlLength > 0) add('syntax', urlStart, urlLength);
      add('syntax', start + length - 1, 1);
      claim(start, start + length);
    }
    linkMatch = linkPattern.exec(input);
  }

  const rules: { pattern: RegExp; type: MarkdownRange['type']; open: number; close: number; marker: string }[] = [
    { pattern: /~~([^\n]+?)~~/g, type: 'strikethrough', open: 2, close: 2, marker: '~' },
    { pattern: /\*\*([^\n]+?)\*\*/g, type: 'bold', open: 2, close: 2, marker: '*' },
    { pattern: /__([^\n]+?)__/g, type: 'bold', open: 2, close: 2, marker: '_' },
    { pattern: /\*([^*\n]+)\*/g, type: 'italic', open: 1, close: 1, marker: '*' },
    { pattern: /_([^_\n]+)_/g, type: 'italic', open: 1, close: 1, marker: '_' },
  ];

  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    const pattern = rule.pattern;
    let match = pattern.exec(input);
    while (match !== null) {
      const start = match.index;
      const length = match[0].length;
      const before = start > 0 ? input[start - 1] : '';
      const after = start + length < input.length ? input[start + length] : '';
      // A `*` that is really part of a `**` run belongs to the bold rule, which
      // has already run; skip rather than style the same characters twice.
      const glued = before === rule.marker || after === rule.marker;
      const used = !glued && !overlaps(start, start + length);
      if (used) {
        add('syntax', start, rule.open);
        if (match[1].length > 0) add(rule.type, start + rule.open, match[1].length);
        add('syntax', start + length - rule.close, rule.close);
        claim(start, start + length);
        match = pattern.exec(input);
      } else {
        // Re-scan from just after this candidate's opening marker.
        //
        // A rejected match is usually the engine pairing the *closing* marker
        // of an already-claimed construct with the *opening* marker of the next
        // one — `**bold** *em*` made the italic pass match the `*` `space` `*`
        // spanning the gap, and the characters it consumed meant the real `*em*`
        // was never offered at all. Resuming after the rejected marker lets the
        // scan reach the construct the user actually typed.
        //
        // Safe from a livelock: the next exec starts at `start + 1`, so a match
        // beginning at `start` cannot be produced again.
        pattern.lastIndex = start + 1;
        match = pattern.exec(input);
      }
    }
  }

  return ranges;
}
