import { reorder, resolveDropIndex, shiftForRow } from '../src/components/shared/dragReorder';

/**
 * The drop geometry is the part of a drag that no gesture test can reach, and
 * the part that is easy to get subtly wrong: an off-by-one here surfaces as
 * "the row sometimes lands one place off", which reads as a gesture-timing bug
 * by the time anyone reports it.
 */

/** Four equal 56px rows — the Settings row height. */
const EVEN = [56, 56, 56, 56];

describe('resolveDropIndex', () => {
  it('keeps the row where it started when it has not moved', () => {
    for (let i = 0; i < EVEN.length; i++) {
      expect(resolveDropIndex(i, 0, EVEN)).toBe(i);
    }
  });

  it('moves down only once the row passes the midpoint of the next slot', () => {
    // Row 0 spans 0..56, centre 28. Row 1's centre is 84.
    expect(resolveDropIndex(0, 20, EVEN)).toBe(0);
    expect(resolveDropIndex(0, 40, EVEN)).toBe(1);
    expect(resolveDropIndex(0, 120, EVEN)).toBe(2);
    expect(resolveDropIndex(0, 400, EVEN)).toBe(3);
  });

  it('moves up symmetrically, so a row is not sticky at one end', () => {
    expect(resolveDropIndex(3, -20, EVEN)).toBe(3);
    expect(resolveDropIndex(3, -40, EVEN)).toBe(2);
    expect(resolveDropIndex(3, -400, EVEN)).toBe(0);
  });

  it('round-trips: dragging to a slot and back returns to the origin', () => {
    for (let i = 0; i < EVEN.length; i++) {
      for (let j = 0; j < EVEN.length; j++) {
        const dy = (j - i) * 56;
        expect(resolveDropIndex(i, dy, EVEN)).toBe(j);
      }
    }
  });

  it('clamps rather than running off the list', () => {
    expect(resolveDropIndex(0, -9999, EVEN)).toBe(0);
    expect(resolveDropIndex(3, 9999, EVEN)).toBe(3);
  });

  it('handles rows of differing heights', () => {
    // A wrapped description makes one row twice as tall as its neighbours, so
    // the boundary between slots 0 and 1 sits at the midpoint of their centres
    // (28 and 112) rather than at one row height.
    const heights = [56, 112, 56];
    expect(resolveDropIndex(0, 41, heights)).toBe(0);
    expect(resolveDropIndex(0, 43, heights)).toBe(1);
    expect(resolveDropIndex(2, -70, heights)).toBe(1);
    expect(resolveDropIndex(2, 0, heights)).toBe(2);
  });

  it('never picks an unmeasured row as the drop target', () => {
    // The first frame of a drag measures one row at a time. A zero-height row
    // must not become the target, or the list collapses to whichever row
    // happened to report layout first.
    const heights = [0, 0, 56];
    expect(resolveDropIndex(2, 0, heights)).toBe(2);
    expect(resolveDropIndex(2, -30, heights)).toBe(2);
  });

  it('is a no-op for an empty list or an out-of-range row', () => {
    expect(resolveDropIndex(0, 10, [])).toBe(0);
    expect(resolveDropIndex(9, 10, EVEN)).toBe(9);
    expect(resolveDropIndex(-1, 10, EVEN)).toBe(-1);
  });
});

describe('shiftForRow', () => {
  it('never moves the row being dragged', () => {
    expect(shiftForRow(1, 3, 1, EVEN)).toBe(0);
  });

  it('opens a one-slot hole below when dragging down', () => {
    // Rows 1..3 slide up; nothing else moves.
    expect(shiftForRow(0, 3, 0, EVEN)).toBe(0);
    expect(shiftForRow(0, 3, 1, EVEN)).toBe(-56);
    expect(shiftForRow(0, 3, 2, EVEN)).toBe(-56);
    expect(shiftForRow(0, 3, 3, EVEN)).toBe(-56);
  });

  it('opens a one-slot hole above when dragging up', () => {
    expect(shiftForRow(3, 0, 0, EVEN)).toBe(56);
    expect(shiftForRow(3, 0, 1, EVEN)).toBe(56);
    expect(shiftForRow(3, 0, 2, EVEN)).toBe(56);
    expect(shiftForRow(3, 0, 3, EVEN)).toBe(0);
  });

  it('leaves everything still when the row is dropped back where it started', () => {
    for (let i = 0; i < EVEN.length; i++) {
      for (let j = 0; j < EVEN.length; j++) {
        expect(shiftForRow(i, i, j, EVEN)).toBe(0);
      }
    }
  });

  it('shifts by each row’s own height, so uneven rows still align', () => {
    const heights = [56, 112, 56];
    // Dragging row 0 down past row 1 moves row 1 up by row 1's height.
    expect(shiftForRow(0, 1, 1, heights)).toBe(-112);
  });
});

describe('reorder', () => {
  it('moves an item to a new index', () => {
    expect(reorder(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(reorder(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('is a no-op for the same index and for anything out of range', () => {
    const list = ['a', 'b', 'c'];
    expect(reorder(list, 1, 1)).toEqual(list);
    expect(reorder(list, 0, -1)).toEqual(list);
    expect(reorder(list, 0, 9)).toEqual(list);
    expect(reorder(list, 9, 0)).toEqual(list);
  });

  it('does not mutate its input', () => {
    const list = ['a', 'b', 'c'];
    reorder(list, 0, 2);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});
