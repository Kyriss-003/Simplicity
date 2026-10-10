import { create } from 'zustand';
import { eventRepository } from '../db/EventRepository';
import type { Event, EventUpdateInput, NewEventInput } from '../types';

/**
 * Zustand store for calendar events.
 *
 * Deliberately a **separate store** from `useNoteStore`, which owns user
 * content. An event is neither a note nor a note's property: it has no folder,
 * no markdown body and no sync story, and folding it into the note store would
 * put event writes behind the note store's `isLoading` — the same global
 * boolean every note action already races on (`AGENTS.md` → Known Gaps).
 *
 * `events` is the full set, soonest first. The calendar needs every day it can
 * paint, so nothing is scoped by a selected folder or a date range here; the
 * date arithmetic belongs to the calendar's own helpers.
 */
export interface EventStoreState {
  /** Live events, soonest first. */
  events: Event[];
  isLoading: boolean;
  error: string | null;

  /** Load every live event. */
  initialize: () => Promise<void>;
  /** Create an event and splice it into `events` in start order. */
  createEvent: (input: NewEventInput) => Promise<Event | null>;
  /** Update an event by id and re-sort. */
  updateEvent: (id: number, input: EventUpdateInput) => Promise<Event | null>;
  /** Soft-delete an event by id and drop it from `events`. */
  softDeleteEvent: (id: number) => Promise<void>;
}

export const useEventStore = create<EventStoreState>((set) => ({
  events: [],
  isLoading: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const events = await eventRepository.getAllEvents();
      set({ events, isLoading: false });
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
    }
  },

  createEvent: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const created = await eventRepository.createEvent(input);
      set((state) => ({
        events: [...state.events, created].sort(orderByStart),
        isLoading: false,
      }));
      return created;
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
      return null;
    }
  },

  updateEvent: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await eventRepository.updateEvent(id, input);
      set((state) => ({
        events: updated
          ? state.events.map((ev) => (ev.id === id ? updated : ev)).sort(orderByStart)
          : state.events,
        isLoading: false,
      }));
      return updated;
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
      return null;
    }
  },

  softDeleteEvent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const removed = await eventRepository.softDeleteEvent(id);
      if (removed) {
        set((state) => ({ events: state.events.filter((ev) => ev.id !== id), isLoading: false }));
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      set({ error: toMessage(err), isLoading: false });
    }
  },
}));

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unknown error';
}

/**
 * ISO 8601 strings sort lexicographically, which is chronological for the UTC
 * form every write goes through — so this needs no `Date` and no timezone.
 */
function orderByStart(a: Event, b: Event): number {
  return a.startsAt.localeCompare(b.startsAt);
}
