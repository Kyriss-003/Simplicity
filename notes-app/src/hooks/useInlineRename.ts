import { useCallback, useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import type { Note } from '../types';

/**
 * How long after opening, an untouched blur is treated as a focus hand-back
 * rather than the user leaving. Long enough to cover a Modal's unmount, short
 * enough that a deliberate click away is never mistaken for the race.
 */
const FOCUS_HANDOFF_MS = 300;

/**
 * The inline-rename state machine shared by every surface that renames a record
 * in place — the Overview cards, the Notes list, and a calendar event block.
 *
 * This exists because those surfaces need the same three pieces of tricky state,
 * and the tricky part is not the text field. `onSubmitEditing` and `onBlur` both
 * fire when the user presses Enter (submitting blurs the input on the way out),
 * so an unguarded commit writes the title twice — and the second write lands
 * after the row has already left rename mode, re-triggering the handler against
 * a stale draft. The `committingRef` latch is what makes the second call a
 * no-op, and it is cleared on the next frame so the same record can be renamed
 * again immediately.
 *
 * Kept in `hooks/` rather than in any component so the latch has exactly one
 * implementation. Two copies of a commit guard is two places for the guard to
 * rot.
 *
 * Generic over `{ id, title }` rather than over `Note` so the calendar's event
 * blocks get the same guard instead of a second, subtly different one. It
 * defaults to `Note` so the existing call sites infer without an annotation.
 */
export function useInlineRename<T extends { id: number; title: string } = Note>(
  onRename: (id: number, title: string) => void
) {
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const committingRef = useRef<number | null>(null);
  /** When this rename opened, and what it opened with — see `commitRename`. */
  const openedAtRef = useRef(0);
  const originalRef = useRef('');

  /**
   * Attach to the rename field. Focus is taken here rather than by `autoFocus`,
   * because `autoFocus` fires on mount and the menu's Modal then hands focus
   * *back* — on web that hand-back lands after the field exists, so the field
   * opened unfocused and every keystroke went to the row underneath it.
   *
   * Two frames, not one: the first is the hand-back arriving, the second is us.
   * A single frame loses the race roughly as often as it wins it.
   */
  const inputRef = useRef<TextInput>(null);
  useEffect(() => {
    if (renamingId === null) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => inputRef.current?.focus());
    });
    return () => cancelAnimationFrame(raf);
  }, [renamingId]);

  const startRename = useCallback((item: T) => {
    // Rename is always started from a context menu, and a context menu is a
    // `Modal`, which hands focus back as it unmounts. Mounting the field in the
    // same tick races that hand-back: the field focuses and is immediately
    // blurred, `onBlur` commits the untouched draft, and rename mode ends
    // before a character is typed. Entering rename mode on the next task lets
    // the Modal finish closing first, so the field's own `autoFocus` is the
    // last focus event of the interaction.
    setTimeout(() => {
      openedAtRef.current = Date.now();
      originalRef.current = item.title;
      setRenamingId(item.id);
      setDraftTitle(item.title);
    }, 0);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setDraftTitle('');
  }, []);

  const commitRename = useCallback(
    (id: number) => {
      if (committingRef.current === id) return;

      const title = draftTitle.trim();

      /**
       * A blur that arrives immediately after the field opened, with the draft
       * untouched, is the context menu stealing focus back — not the user
       * leaving. Committing on it ends rename mode before a character can be
       * typed, which on web made the field open and vanish in the same frame.
       *
       * Both halves of the condition matter. If the draft *has* changed, the
       * blur is the real one and the user's typing must be saved even if it was
       * fast; if the draft is unchanged, staying open costs nothing and there is
       * no edit to lose. Checked before the commit latch is set, so the blur
       * that eventually ends the rename still commits normally.
       */
      if (Date.now() - openedAtRef.current < FOCUS_HANDOFF_MS) {
        if (title === originalRef.current.trim()) return;
      }

      committingRef.current = id;

      // An empty title is a cancellation, not a record called "".
      if (title) onRename(id, title);

      setRenamingId(null);
      setDraftTitle('');

      // Cleared on the next frame so the same record can be renamed again.
      requestAnimationFrame(() => {
        committingRef.current = null;
      });
    },
    [draftTitle, onRename]
  );

  return {
    renamingId,
    draftTitle,
    setDraftTitle,
    /** Attach to the rename field so it takes focus after the menu hand-back. */
    inputRef,
    startRename,
    cancelRename,
    commitRename,
  };
}
