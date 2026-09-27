import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Trailing-debounce wrapper for the note editor's autosave.
 *
 * `onChangeText` fires per keystroke; persisting that often issues one SQLite
 * UPDATE per character and flickers the loading indicator. This defers the
 * write until typing pauses, and flushes any pending value when the component
 * unmounts or the app leaves the foreground, so a note is never lost.
 */
export function useDebouncedPersist<TArgs extends unknown[]>(
  persist: (...args: TArgs) => unknown,
  delay = 400,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<TArgs | null>(null);
  const latest = useRef(persist);

  useEffect(() => {
    latest.current = persist;
  }, [persist]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      const args = pending.current;
      pending.current = null;
      void latest.current(...args);
    }
  }, []);

  // Unmount flush — return the callback as the cleanup.
  useEffect(() => flush, [flush]);

  // Background/interrupt flush. On native, backgrounding does NOT unmount the
  // component, so the unmount cleanup alone would let an OS kill discard the
  // last few keystrokes.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'background' || status === 'inactive') {
        flush();
      }
    });
    return () => subscription.remove();
  }, [flush]);

  const schedule = useCallback(
    (...args: TArgs) => {
      pending.current = args;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  return { schedule, flush };
}
