import { create } from 'zustand';
import { eventRepository } from '../db/storage';
import type { Event, EventUpdateInput, NewEventInput } from '../types';

export interface EventStoreState {
  events: Event[];
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  createEvent: (input: NewEventInput) => Promise<Event | null>;
  updateEvent: (id: number, input: EventUpdateInput) => Promise<Event | null>;
  softDeleteEvent: (id: number) => Promise<void>;
}

function orderByStart(a: Event, b: Event): number {
  return a.startsAt.localeCompare(b.startsAt);
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
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
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
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
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
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
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
      set({ error: err instanceof Error ? err.message : 'Unknown error', isLoading: false });
    }
  },
}));
