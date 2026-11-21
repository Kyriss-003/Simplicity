import { useCallback, useEffect, useRef, useState } from 'react';
import { noteRepository } from '../db/storage';
import type { Note, NoteUpdateInput } from '../types';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved';

interface PendingNoteDraft {
  id: number;
  title: string;
  content: string;
  updatedAt: string;
}

const DRAFT_STORAGE_KEY = 'simplicity_note_drafts_v1';
const AUTOSAVE_INTERVAL_MS = 5000;
const AUTOSAVE_DEBOUNCE_MS = 600;

function readDrafts(): Record<string, PendingNoteDraft> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PendingNoteDraft>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeDrafts(drafts: Record<string, PendingNoteDraft>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (Object.keys(drafts).length === 0) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } else {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    }
  } catch {
    // ignore storage quota errors
  }
}

function saveDraftEntry(draft: PendingNoteDraft): void {
  const drafts = readDrafts();
  drafts[String(draft.id)] = draft;
  writeDrafts(drafts);
}

function clearDraftEntry(id: number): void {
  const drafts = readDrafts();
  if (String(id) in drafts) {
    delete drafts[String(id)];
    writeDrafts(drafts);
  }
}

export function recoverPendingDrafts(): PendingNoteDraft[] {
  const drafts = readDrafts();
  const entries = Object.values(drafts);
  const recovered: PendingNoteDraft[] = [];

  for (const draft of entries) {
    if (typeof draft?.id !== 'number' || typeof draft.content !== 'string') continue;
    const saved = noteRepository.updateNoteSync(draft.id, {
      title: draft.title,
      content: draft.content,
    });
    if (saved) {
      recovered.push(draft);
    }
  }

  writeDrafts({});
  return recovered;
}

export function useNoteAutoSave({
  updateNote,
  onSyncPersisted,
  intervalMs = AUTOSAVE_INTERVAL_MS,
  debounceMs = AUTOSAVE_DEBOUNCE_MS,
}: {
  updateNote: (id: number, input: NoteUpdateInput) => Promise<Note | null>;
  onSyncPersisted?: (note: Note) => void;
  intervalMs?: number;
  debounceMs?: number;
}) {
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const pendingRef = useRef<PendingNoteDraft | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const markSaved = useCallback(() => {
    if (!mountedRef.current) return;
    setSaveStatus('saved');
    setLastSavedAt(Date.now());
    if (savedBadgeTimerRef.current) clearTimeout(savedBadgeTimerRef.current);
    savedBadgeTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setSaveStatus((cur) => (cur === 'saved' ? 'idle' : cur));
      }
    }, 2500);
  }, []);

  const flushSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    const saved = noteRepository.updateNoteSync(pending.id, {
      content: pending.content,
      title: pending.title,
    });
    clearDraftEntry(pending.id);
    if (saved) {
      onSyncPersisted?.(saved);
    }
    markSaved();
  }, [onSyncPersisted, markSaved]);

  const flush = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
    if (!pendingRef.current || flushingRef.current) return;

    flushingRef.current = true;
    try {
      while (pendingRef.current) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (mountedRef.current) setSaveStatus('saving');

        await updateNote(pending.id, {
          content: pending.content,
          title: pending.title,
        });

        // Only remove the backup draft if no newer edit for this note arrived mid-flush.
        if (pendingRef.current === null || (pendingRef.current as PendingNoteDraft).id !== pending.id) {
          clearDraftEntry(pending.id);
        }
      }
      markSaved();
    } finally {
      flushingRef.current = false;
    }
  }, [updateNote, markSaved]);

  const scheduleSave = useCallback(
    (id: number, title: string, content: string) => {
      const draft: PendingNoteDraft = {
        id,
        title,
        content,
        updatedAt: new Date().toISOString(),
      };
      pendingRef.current = draft;
      saveDraftEntry(draft);
      if (mountedRef.current) setSaveStatus('saving');

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        void flush();
      }, debounceMs);
    },
    [debounceMs, flush]
  );

  const discardPendingForNote = useCallback((id: number) => {
    if (pendingRef.current?.id === id) {
      pendingRef.current = null;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = undefined;
      }
      if (mountedRef.current) setSaveStatus('idle');
    }
    clearDraftEntry(id);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (pendingRef.current) {
        void flush();
      }
    }, intervalMs);
    return () => clearInterval(intervalId);
  }, [intervalMs, flush]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSync();
      }
    };
    const onPageUnload = () => {
      flushSync();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageUnload);
    window.addEventListener('beforeunload', onPageUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageUnload);
      window.removeEventListener('beforeunload', onPageUnload);
      if (savedBadgeTimerRef.current) clearTimeout(savedBadgeTimerRef.current);
      mountedRef.current = false;
      flushSync();
    };
  }, [flushSync]);

  return {
    saveStatus,
    lastSavedAt,
    scheduleSave,
    flush,
    flushSync,
    discardPendingForNote,
  };
}
