import {
  deriveTitle,
  previewLines,
  greeting,
  parseBlocks,
  blockIndexAt,
  editableBlock,
  decorationLayer,
  mergeWithPrevious,
  activeBlockStyle,
  getMarkdownStyles,
} from '../src/components/shared/utils';
import { THEMES } from '../src/theme';

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
    const lines = previewLines('# Head\n- one\n1. two\nthree\nfour\nfive', 3);
    expect(lines).toEqual(['one', 'two', 'three']);
  });

  it('returns an empty array for blank content', () => {
    expect(previewLines('   \n  ')).toEqual([]);
  });
});

describe('greeting', () => {
  it('returns a known greeting for the current hour', () => {
    expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(greeting());
  });
});

describe('parseBlocks', () => {
  it('groups consecutive prose lines into one paragraph', () => {
    const blocks = parseBlocks('first line\nsecond line\n\nnext para');
    expect(blocks.map((b) => b.text)).toEqual(['first line\nsecond line', 'next para']);
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph']);
  });

  it('never splits a paragraph per line — that is what shatters the caret', () => {
    // Regression: one input per line meant the caret jumped to a different
    // buffer on every newline.
    expect(parseBlocks('a\nb\nc')).toHaveLength(1);
  });

  it('reports offsets that slice back to the block text', () => {
    const content = 'alpha\nbeta\n\n\ngamma';
    for (const b of parseBlocks(content)) {
      expect(content.slice(b.start, b.end)).toBe(b.text);
    }
  });

  it('keeps offsets exact when lines contain regex-special characters', () => {
    const content = '(a+b)*\n$dollar\n\n[e]f(g)';
    const blocks = parseBlocks(content);
    expect(blocks[0].text).toBe('(a+b)*\n$dollar');
    expect(blocks[0].start).toBe(0);
    expect(blocks[0].end).toBe(14);
    expect(content.slice(blocks[1].start, blocks[1].end)).toBe('[e]f(g)');
  });

  it('treats a heading as its own single-line block with its depth', () => {
    const blocks = parseBlocks('# One\n## Two\n###### Six\nbody');
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'heading', 'heading', 'paragraph']);
    expect(blocks.map((b) => b.depth)).toEqual([1, 2, 6, 0]);
  });

  it('does not treat a hash without a space as a heading', () => {
    expect(parseBlocks('#nothash')[0].kind).toBe('paragraph');
  });

  it('keeps consecutive list items in one list block', () => {
    const blocks = parseBlocks('- one\n- two\n1. three\ntext');
    expect(blocks.map((b) => b.kind)).toEqual(['list', 'paragraph']);
    expect(blocks[0].text).toBe('- one\n- two\n1. three');
  });

  it('keeps a fenced code block whole, blank lines and all', () => {
    const content = 'intro\n```js\nconst a = 1;\n\nconst b = 2;\n```\noutro';
    const blocks = parseBlocks(content);
    expect(blocks.map((b) => b.text)).toEqual([
      'intro',
      '```js\nconst a = 1;\n\nconst b = 2;\n```',
      'outro',
    ]);
    expect(blocks[1].kind).toBe('code');
    expect(blocks[1].fence).toBe('```');
  });

  it('swallows the rest of the document when a fence is never closed', () => {
    const blocks = parseBlocks('a\n```\nb\nc');
    expect(blocks.map((b) => b.text)).toEqual(['a', '```\nb\nc']);
  });

  it('returns no blocks for empty content', () => {
    expect(parseBlocks('')).toEqual([]);
  });

  it('keeps whitespace-only content typeable as a single block', () => {
    const blocks = parseBlocks('\n \n\t\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('\n \n\t\n');
    expect(blocks[0].start).toBe(0);
  });
});

describe('blockIndexAt', () => {
  const blocks = parseBlocks('first block\n\nsecond block');

  it('resolves a caret inside a block to that block', () => {
    expect(blockIndexAt(blocks, 3)).toBe(0);
    expect(blockIndexAt(blocks, 16)).toBe(1);
  });

  it('resolves a caret inside the separator to the preceding block', () => {
    expect(blockIndexAt(blocks, 12)).toBe(0);
  });

  it('returns -1 for a caret before the first block', () => {
    const leading = parseBlocks('\n\nbody');
    expect(leading[0].start).toBe(2);
    expect(blockIndexAt(leading, 0)).toBe(-1);
    expect(blockIndexAt(blocks, -1)).toBe(-1);
    expect(blockIndexAt([], 0)).toBe(-1);
  });
});

describe('editableBlock', () => {
  const content = 'first block\n\nsecond block';
  const blocks = parseBlocks(content);

  it('returns null for an out-of-range index', () => {
    expect(editableBlock(blocks, -1, content)).toBeNull();
    expect(editableBlock(blocks, blocks.length, content)).toBeNull();
  });

  it('extends end to the next block start so the newline is editable', () => {
    // Regression: without the extension a trailing newline belongs to no block,
    // the input value round-trips unchanged and Enter no-ops.
    const editable = editableBlock(blocks, 0, content);
    expect(editable!.end).toBe(blocks[1].start);
    expect(editable!.text).toBe('first block\n\n');
  });

  it('keeps the blank lines BEFORE a block out of its buffer', () => {
    // That separation is what leaves Backspace at local offset 0 free to merge
    // instead of being swallowed by the input.
    expect(editableBlock(blocks, 1, content)!.text).toBe('second block');
    expect(editableBlock(blocks, 1, content)!.start).toBe(13);
  });

  it('preserves the block kind and depth', () => {
    const heading = parseBlocks('# Title');
    const editable = editableBlock(heading, 0, '# Title');
    expect(editable!.kind).toBe('heading');
    expect(editable!.depth).toBe(1);
  });

  it('always satisfies content.slice(start, end) === text', () => {
    for (const doc of ['a\nb', 'a\n\nb\n', '```\nx\n```\ntail', '# h\n\n- i\n- j']) {
      const list = parseBlocks(doc);
      for (let i = 0; i < list.length; i += 1) {
        const editable = editableBlock(list, i, doc);
        expect(editable).not.toBeNull();
        expect(doc.slice(editable!.start, editable!.end)).toBe(editable!.text);
      }
    }
  });

  it('gives a trailing newline a block to live in, so Enter grows the input', () => {
    expect(editableBlock(parseBlocks('hello\n'), 0, 'hello\n')!.text).toBe('hello\n');
  });
});

describe('decorationLayer', () => {
  const blocks = parseBlocks('one\n\ntwo\n\nthree');

  it('marks every block but the caret\'s as decorated', () => {
    const layer = decorationLayer(blocks, 6, true);
    expect(layer.activeIndex).toBe(1);
    expect(layer.decorated).toEqual([true, false, true]);
  });

  it('decorates the whole document when the editor is not active', () => {
    const layer = decorationLayer(blocks, 6, false);
    expect(layer.activeIndex).toBe(-1);
    expect(layer.decorated).toEqual([true, true, true]);
  });

  it('always leaves exactly one raw block when active', () => {
    for (const caret of [0, 1, 3, 4, 9, 13, 14, -1, 999]) {
      expect(decorationLayer(blocks, caret, true).decorated.filter((d) => !d)).toHaveLength(1);
    }
  });

  it('falls back to the first block for a caret that resolves to none', () => {
    // Without the fallback the layer would have no raw slot and the editor would
    // be focused with nothing to type into.
    const leading = parseBlocks('\n\nbody');
    expect(decorationLayer(leading, 0, true).decorated).toEqual([false]);
  });

  it('handles a document with no blocks', () => {
    expect(decorationLayer([], 0, true)).toEqual({ activeIndex: -1, decorated: [] });
  });
});

describe('mergeWithPrevious', () => {
  it('joins two paragraphs and lands the caret at the join', () => {
    const content = 'alpha\n\nbeta';
    const blocks = parseBlocks(content);
    const merge = mergeWithPrevious(blocks, 1, content);
    expect(merge).not.toBeNull();
    expect(merge!.content).toBe('alpha\nbeta');
    expect(merge!.blockIndex).toBe(0);
    expect(merge!.offset).toBe(5);
  });

  it('re-parses as exactly one block at the merged index', () => {
    // The invariant that makes the caret placement correct after the swap.
    for (const content of ['alpha\n\nbeta', '- a\n\n- b', 'a\n\nb\n\nc']) {
      const blocks = parseBlocks(content);
      for (let i = 1; i < blocks.length; i += 1) {
        const merge = mergeWithPrevious(blocks, i, content);
        if (!merge) continue;
        const reparsed = parseBlocks(merge.content);
        expect(reparsed[merge.blockIndex].start).toBe(blocks[merge.blockIndex].start);
        expect(merge.offset).toBeLessThanOrEqual(reparsed[merge.blockIndex].text.length);
      }
    }
  });

  it('merges same-kind list blocks', () => {
    const content = '- a\n\n- b';
    const merge = mergeWithPrevious(parseBlocks(content), 1, content);
    expect(merge!.content).toBe('- a\n- b');
    expect(parseBlocks(merge!.content)).toHaveLength(1);
  });

  it('refuses the first block', () => {
    const content = 'alpha';
    expect(mergeWithPrevious(parseBlocks(content), 0, content)).toBeNull();
  });

  it('refuses mismatched kinds so the join cannot re-parse as two blocks', () => {
    const content = '# Title\n\npara';
    expect(mergeWithPrevious(parseBlocks(content), 1, content)).toBeNull();
  });

  it('refuses to merge into or out of a code fence', () => {
    const code = '```\ncode\n```';
    expect(mergeWithPrevious(parseBlocks(code), 0, code)).toBeNull();
    const content = 'para\n\n```\ncode\n```';
    expect(mergeWithPrevious(parseBlocks(content), 1, content)).toBeNull();
  });
});

describe('activeBlockStyle', () => {
  // `tight` is what the editor uses: the space between two blocks lives on the
  // top margin only, so it is not counted twice at a block boundary.
  const md = getMarkdownStyles(THEMES.Dark, { tight: true });

  it('locks a level-1 heading input to the page-header metrics', () => {
    const heading = parseBlocks('# Title')[0];
    expect(activeBlockStyle(md, heading)).toBe(md.heading1);
    expect(md.heading1.fontSize).toBe(24);
    expect(md.heading1.lineHeight).toBe(32);
  });

  it('locks deeper headings to their own rendered style', () => {
    expect(activeBlockStyle(md, parseBlocks('## Two')[0])).toBe(md.heading2);
    expect(activeBlockStyle(md, parseBlocks('#### Four')[0])).toBe(md.heading3);
  });

  it('gives a code fence its own surface, padding and radius', () => {
    const code = parseBlocks('```\ncode\n```')[0];
    const style = activeBlockStyle(md, code);
    expect(style).toBe(md.code_block);
    expect(style.padding).toBe(12);
  });

  it('composes body metrics with the list margin for a list', () => {
    const list = parseBlocks('- one')[0];
    const style = activeBlockStyle(md, list);
    expect(style.fontSize).toBe(14);
    expect(style.marginTop).toBe(4);
  });

  it('gives a paragraph the body style', () => {
    expect(activeBlockStyle(md, parseBlocks('plain')[0])).toBe(md.body);
  });
});
