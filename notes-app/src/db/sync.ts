import { getSupabase } from '../lib/supabase';
import { noteRepository } from './NoteRepository';
import { eventRepository } from './EventRepository';

/** Note ids created or updated locally but not yet pushed to Supabase. */
let pendingNotes: Set<number> = new Set();
/** Event ids created or updated locally but not yet pushed to Supabase. */
let pendingEvents: Set<number> = new Set();
/** Whether a background sync pass is currently in flight. Guards overlapping calls. */
let syncInProgress = false;

async function syncNotes() {
  const supabase = getSupabase();
  const pending = [...pendingNotes];
  if (pending.length === 0) return;
  for (const localId of pending) {
    try {
      const all = await noteRepository.getAllNotes();
      const note = (all as any[]).find((n) => n.id === localId);
      if (note && !note.isDeleted) {
        const { error } = await supabase.from('notes').upsert({
          uuid: note.uuid,
          title: note.title,
          content: note.content,
          tags: JSON.stringify(note.tags),
          folder_id: note.folderId,
          created_at: note.createdAt,
          updated_at: note.updatedAt,
          is_deleted: 0,
          is_synced: 1,
        }, { onConflict: 'uuid' });
        if (!error) pendingNotes.delete(localId);
      }
    } catch {
      // Leave in pending - retry on next pass.
    }
  }
}

async function syncEvents() {
  const supabase = getSupabase();
  const pending = [...pendingEvents];
  if (pending.length === 0) return;
  for (const localId of pending) {
    try {
      const all = await eventRepository.getAllEvents();
      const event = (all as any[]).find((e) => e.id === localId);
      if (event && !event.isDeleted) {
        const { error } = await supabase.from('events').upsert({
          uuid: event.uuid,
          title: event.title,
          notes: event.notes,
          starts_at: event.startsAt,
          duration_minutes: event.durationMinutes,
          priority: event.priority ?? null,
          is_pinned: event.isPinned ? 1 : 0,
          is_deleted: 0,
          created_at: event.createdAt,
          updated_at: event.updatedAt,
        }, { onConflict: 'uuid' });
        if (!error) pendingEvents.delete(localId);
      }
    } catch {
      // Leave in pending - retry on next pass.
    }
  }
}

export interface SyncStatus {
  notesSynced: boolean;
  eventsSynced: boolean;
  pendingNoteCount: number;
  pendingEventCount: number;
}

export function markNotePendingSync(localId: number): void {
  pendingNotes.add(localId);
  void triggerSync();
}

export function markEventPendingSync(localId: number): void {
  pendingEvents.add(localId);
  void triggerSync();
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const supabase = getSupabase();
  try {
    const { count: notesCount } = await supabase.from('notes').select('*', { count: 'exact', head: true });
    const { count: eventsCount } = await supabase.from('events').select('*', { count: 'exact', head: true });
    return {
      notesSynced: (notesCount ?? 0) > 0,
      eventsSynced: (eventsCount ?? 0) > 0,
      pendingNoteCount: pendingNotes.size,
      pendingEventCount: pendingEvents.size,
    };
  } catch {
    return {
      notesSynced: false,
      eventsSynced: false,
      pendingNoteCount: pendingNotes.size,
      pendingEventCount: pendingEvents.size,
    };
  }
}

export async function triggerSync(): Promise<void> {
  if (syncInProgress) return;
  syncInProgress = true;
  try {
    await syncNotes();
    await syncEvents();
  } finally {
    syncInProgress = false;
  }
}

export async function isSyncAvailable(): Promise<boolean> {
  try {
    const supabase = getSupabase();
    await supabase.from('notes').select('id').limit(1).maybeSingle();
    return true;
  } catch {
    return false;
  }
}
