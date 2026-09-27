/**
 * Shared utilities used across dashboard card components.
 */
import type { TextStyle } from 'react-native';
import { Radius, Typography, type Theme } from '../../theme';

/** Extracts a title from the first markdown heading in content. */
export function deriveTitle(content: string): string {
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*#{1,6}\s+(.+?)\s*#*\s*$/);
    if (m) return m[1].trim();
  }
  return '';
}

/** Extracts up to `max` non-heading content lines for note previews. */
export function previewLines(content: string, max = 3): string[] {
  if (!content || !content.trim()) return [];
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\s*#{1,6}\s+/.test(l))
    .map((l) => l.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, ''))
    .filter((l) => l.length > 0)
    .slice(0, max);
}

/**
 * One block of the live-preview document.
 *
 * A block is a paragraph (blank-line separated run of prose), a single heading
 * line, a run of consecutive list items, or a fenced code block. It is the unit
 * that swaps between rendered markdown and one `TextInput` — never smaller. A
 * block is the *only* buffer the caret lives in while it is active, which is
 * what keeps native arrow keys, selection and word-wrap intact.
 */
export interface MdBlock {
  text: string;
  /** Inclusive character offset of the first character in the full content. */
  start: number;
  /** Exclusive character offset just past the last character in the full content. */
  end: number;
  kind: MdBlockKind;
  /** 1–6 for headings, 0 for everything else. */
  depth: number;
  /** Fence delimiter for `code` blocks, else null. */
  fence: string | null;
}

export type MdBlockKind = 'heading' | 'paragraph' | 'list' | 'code';

const HEADING = /^(#{1,6})(\s|$)/;
const LIST_ITEM = /^\s{0,3}([-*+]|\d{1,9}[.)])(\s|$)/;
const FENCE_OPEN = /^\s{0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^\s{0,3}(?:`{3,}|~{3,})\s*$/;

/**
 * Parses markdown into AST blocks.
 *
 * Blank lines separate blocks. Consecutive prose lines and consecutive list
 * items each stay in one block, because splitting them would put the caret in a
 * different input mid-sentence. A fenced code block is one block whatever its
 * length — rendering it line by line would leak the delimiters as literal text.
 *
 * Offsets come from walking the string line by line with a running cursor
 * rather than by searching for line text, so they stay exact when a line
 * contains regex-special characters: `content.slice(start, end)` is always
 * `text`. A document with no block at all (nothing but newlines) yields a single
 * paragraph spanning the whole content, so whitespace stays visible.
 */
export function parseBlocks(content: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  if (!content) return blocks;

  let cursor = 0;
  let start = -1;
  let end = -1;
  let kind: MdBlockKind = 'paragraph';
  let depth = 0;
  let fence: string | null = null;

  const close = () => {
    if (start < 0) return;
    blocks.push({ text: content.slice(start, end), start, end, kind, depth, fence });
    start = -1;
    depth = 0;
    fence = null;
  };

  for (const line of content.split('\n')) {
    const lineStart = cursor;
    const lineEnd = cursor + line.length; // exclusive — the '\n' is not part of the line
    cursor = lineEnd + 1;

    if (fence) {
      if (start < 0) start = lineStart;
      end = lineEnd;
      // Every line inside a fence is content, blank ones included.
      if (FENCE_CLOSE.test(line)) close();
      continue;
    }

    if (line.trim().length === 0) {
      close();
      continue;
    }

    if (FENCE_OPEN.test(line)) {
      close();
      start = lineStart;
      end = lineEnd;
      kind = 'code';
      fence = line.trim().slice(0, 3);
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      close();
      start = lineStart;
      end = lineEnd;
      kind = 'heading';
      depth = heading[1].length;
      continue;
    }

    const isItem = LIST_ITEM.test(line);
    if (start >= 0 && kind === (isItem ? 'list' : 'paragraph')) {
      end = lineEnd;
      continue;
    }

    close();
    start = lineStart;
    end = lineEnd;
    kind = isItem ? 'list' : 'paragraph';
  }
  close();

  if (blocks.length === 0) {
    return [{ text: content, start: 0, end: content.length, kind: 'paragraph', depth: 0, fence: null }];
  }
  return blocks;
}

/**
 * Index of the block that owns `caret`.
 *
 * Block `i` owns everything from its own `start` up to the next block's
 * `start`, so a caret sitting in the blank-line separator between two blocks
 * resolves to the *preceding* block rather than to nothing. Returns -1 only
 * when the caret precedes the first block (leading blank lines, or a negative
 * offset).
 */
export function blockIndexAt(blocks: MdBlock[], caret: number): number {
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    if (blocks[i].start <= caret) return i;
  }
  return -1;
}

/**
 * The range the editor actually edits for a block.
 *
 * `end` is extended from the block's own end to the start of the following
 * block (or the end of the document), so the newline and blank lines after a
 * block belong to its editable region. Without this a keystroke at the end of a
 * block would write into no block, the input value would round-trip unchanged,
 * and Enter would appear to do nothing.
 *
 * The blank lines *before* a block are deliberately not included: they are the
 * separator, and keeping them out of the buffer is what leaves Backspace at
 * local offset 0 free to merge instead of no-op.
 *
 * Returns `null` when `index` is out of range.
 */
export function editableBlock(
  blocks: MdBlock[],
  index: number,
  content: string,
): MdBlock | null {
  const block = blocks[index];
  if (!block) return null;
  const next = blocks[index + 1];
  const end = next ? next.start : content.length;
  return { ...block, end, text: content.slice(block.start, end) };
}

/** Result of a cross-block merge. */
export interface BlockMerge {
  content: string;
  /** Index of the merged block in the re-parsed document. */
  blockIndex: number;
  /** Caret offset *within* the merged block. */
  offset: number;
}

/**
 * Merges the block at `index` into the one before it, for Backspace at the
 * start of a block.
 *
 * The blank-line separator is replaced by a single newline, which is what joins
 * two blocks into one and leaves the caret exactly where the user pressed.
 * Only same-kind prose blocks merge: joining a paragraph onto a heading or
 * onto a fence would re-parse as two blocks again and strand the caret, so
 * those cases return `null` and Backspace falls through to the input (which
 * does nothing, since the separator is not in its buffer).
 */
export function mergeWithPrevious(
  blocks: MdBlock[],
  index: number,
  content: string,
): BlockMerge | null {
  const block = blocks[index];
  const prev = blocks[index - 1];
  if (!block || !prev) return null;
  if (block.kind !== prev.kind) return null;
  if (block.kind !== 'paragraph' && block.kind !== 'list') return null;

  return {
    content: content.slice(0, prev.end) + '\n' + content.slice(block.start),
    blockIndex: index - 1,
    offset: prev.text.length,
  };
}

/** Which blocks render as rich markdown and which one stays raw for the caret. */
export interface DecorationLayer {
  /** Index of the block that owns the caret, or -1 when nothing is raw. */
  activeIndex: number;
  /** Per block: true when it renders decorated instead of raw source. */
  decorated: boolean[];
}

/**
 * The virtual decoration layer.
 *
 * Pure: the same blocks and caret always produce the same layer. `active`
 * false (the editor is blurred) decorates the entire document, which is how
 * the raw block "converts" the moment focus leaves.
 *
 * Total by construction: when active there is always exactly one raw slot, so
 * the editor can never end up focused with nothing to type into. A caret that
 * resolves to no block — before the first block, on leading blank lines —
 * falls back to block 0.
 */
export function decorationLayer(
  blocks: MdBlock[],
  caret: number,
  active: boolean,
): DecorationLayer {
  if (!active) {
    return { activeIndex: -1, decorated: blocks.map(() => true) };
  }
  if (blocks.length === 0) {
    return { activeIndex: -1, decorated: [] };
  }
  const resolved = blockIndexAt(blocks, caret);
  const activeIndex = resolved < 0 ? 0 : resolved;
  return {
    activeIndex,
    decorated: blocks.map((_, i) => i !== activeIndex),
  };
}

/** Human-readable relative time label. */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Time-of-day greeting. */
export function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Today's long date label (e.g. "Monday, January 15"). */
export function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Shared markdown stylesheet factory — used by ScratchPadCard and the editor.
 *
 * `tight` collapses each style's bottom margin. The editor renders one chunk
 * per unit, so with a shared `marginVertical` every gap would be counted twice
 * — once by the chunk above and once by the chunk below. Keeping the space on
 * the top margin only means the rhythm between two adjacent units is the same
 * number whether they were one block or two.
 */
export function getMarkdownStyles(theme: Theme, { tight = false }: { tight?: boolean } = {}) {
  const gap = (margin: number) =>
    tight ? { marginTop: margin, marginBottom: 0 } : { marginVertical: margin };
  return {
    body: { color: theme.text, ...Typography.app.body },
    heading1: { color: theme.text, ...Typography.app.pageHeader, ...gap(8) },
    heading2: { color: theme.text, ...Typography.app.cardHeader, ...gap(8) },
    heading3: { color: theme.text, ...Typography.app.bodyStrong, ...gap(4) },
    strong: { ...Typography.app.bodyStrong },
    em: { fontStyle: 'italic' as const },
    code_inline: {
      backgroundColor: theme.pillBg,
      color: theme.text,
      borderRadius: Radius.sm,
      paddingHorizontal: 4,
    },
    code_block: {
      backgroundColor: theme.background,
      color: theme.text,
      padding: 12,
      borderRadius: Radius.md,
      ...gap(8),
    },
    bullet_list: gap(4),
    ordered_list: gap(4),
  };
}

/** The style map `getMarkdownStyles` produces. */
export type MarkdownStyles = ReturnType<typeof getMarkdownStyles>;

/**
 * Metric locking: the style a block of this kind is *rendered* with.
 *
 * The active `TextInput` spreads exactly this, which is why an H1 being edited
 * is 24/32/600 and a code fence keeps its surface and padding — the swap
 * between rendered and raw has no measurable difference to jump.
 */
export function activeBlockStyle(md: MarkdownStyles, block: MdBlock): TextStyle {
  if (block.kind === 'heading') {
    return md[`heading${Math.min(block.depth, 3)}` as 'heading1' | 'heading2' | 'heading3'];
  }
  if (block.kind === 'code') return md.code_block;
  // A list block renders as a list container around body text, so the raw input
  // takes the same two pieces.
  if (block.kind === 'list') return { ...md.body, ...md.bullet_list };
  return md.body;
}
