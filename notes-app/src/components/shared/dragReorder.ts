/**
 * Pure geometry for drag-to-reorder.
 *
 * Split out from `DraggableList` deliberately: the list is a gesture component
 * that no pure-logic suite can reach, and *where a row lands* is exactly the
 * part that is easy to get subtly wrong — an off-by-one that only shows up as
 * "the row sometimes drops in the wrong place", which is a gesture-timing bug
 * by the time anyone reports it. These functions take numbers and return
 * numbers, so they can be tested directly.
 */

/**
 * Which slot the dragged row would drop into.
 *
 * Measured by nearest slot centre rather than by "has the row's top passed
 * the midpoint of slot N". Nearest-centre is symmetric: dragging one row's
 * height upward and downward crosses a boundary at the same distance, so a row
 * cannot feel sticky near one end and eager near the other. Rows of differing
 * heights fall out correctly, because each slot is measured on its own centre.
 *
 * `offsetY` is the pointer's travel since the drag began; the row is dragged
 * by the same amount, so the drop target cannot disagree with what the user
 * sees under their finger.
 */
export function resolveDropIndex(
  activeIndex: number,
  offsetY: number,
  heights: readonly number[]
): number {
  if (heights.length === 0) return activeIndex;
  if (activeIndex < 0 || activeIndex >= heights.length) return activeIndex;

  // Top of the dragged row in the list's own coordinate space.
  let top = 0;
  for (let i = 0; i < activeIndex; i++) top += heights[i] ?? 0;
  const centre = top + (heights[activeIndex] ?? 0) / 2 + offsetY;

  let best = activeIndex;
  let bestDistance = Infinity;
  let slotTop = 0;
  for (let i = 0; i < heights.length; i++) {
    const h = heights[i] ?? 0;
    // An unmeasured row (height 0) must never become the drop target, or the
    // first frame of a drag would collapse the list into whichever row
    // happened to be measured first.
    if (h > 0) {
      const distance = Math.abs(slotTop + h / 2 - centre);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    slotTop += h;
  }
  return best;
}

/**
 * How far a *non-dragged* row must shift to open the gap the ghost left behind.
 *
 * This is the "placeholder shows drop target" half of the interaction: the rows
 * between the origin and the destination each move exactly one slot, so there
 * is always a visible hole where the row will land. Without it the list looks
 * frozen while the row floats over it, and the user is guessing.
 */
export function shiftForRow(
  activeIndex: number,
  toIndex: number,
  index: number,
  heights: readonly number[]
): number {
  if (index === activeIndex) return 0;
  if (toIndex > activeIndex && index > activeIndex && index <= toIndex) {
    return -(heights[index] ?? 0);
  }
  if (toIndex < activeIndex && index >= toIndex && index < activeIndex) {
    return heights[index] ?? 0;
  }
  return 0;
}

/** Moves one item, returning a new array. Out-of-range indices are a no-op. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from === to) return next;
  if (from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}
