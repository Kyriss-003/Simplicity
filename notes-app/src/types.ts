/**
 * Shared app-level types.
 *
 * These live outside `src/db/` so presentational components never have to
 * import from the data layer. On-disk row shapes (`NoteRow`, `FolderRow`)
 * intentionally stay in `src/db/schema.ts`.
 */
import type { MaterialCommunityIcons } from '@expo/vector-icons';

/* ── Notes ──────────────────────────────────────────────────────────── */

export interface Note {
  id: number;
  uuid: string;
  title: string;
  content: string;
  tags: string[];
  folderId: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  isSynced: boolean;
}

export type NewNoteInput = Pick<Note, 'title' | 'content' | 'tags' | 'folderId'>;
export type NoteUpdateInput = Partial<Pick<Note, 'title' | 'content' | 'tags' | 'folderId'>>;

/* ── Events ─────────────────────────────────────────────────────────── */

/**
 * A scheduled event. Unlike `Note` this has no folder and no markdown body: it
 * is a title and a time, and the calendar is the only place it is edited.
 *
 * `startsAt` is a full ISO 8601 instant, stored UTC and rendered in local time.
 * Storing a bare date would make an event created at 11pm in one timezone land
 * on the previous day in another; the calendar renders whole local days, so the
 * conversion happens on the way in and on the way out rather than anywhere in
 * between.
 */
/**
 * How urgent an event is, most to least. The four levels are the whole set —
 * there is no "none", because *absent* is none (`priority` is optional), and an
 * event with no flag renders in the theme accent like every other accent-coloured
 * thing in the app.
 *
 * Priority is the event's colour. It replaced a free-text hex tint so that a
 * colour on a calendar means exactly one thing and can be read at a glance
 * without knowing which hue it is.
 */
export type EventPriority = 'urgent' | 'high' | 'medium' | 'low';

/** Render order of the priority swatches, most urgent first. */
export const EVENT_PRIORITIES: readonly EventPriority[] = ['urgent', 'high', 'medium', 'low'];

/** Human name for a level. Every control that shows a colour also shows this. */
export const PRIORITY_LABELS: Record<EventPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export interface Event {
  id: number;
  uuid: string;
  title: string;
  /** Optional event notes/description. */
  notes: string;
  startsAt: string;
  durationMinutes: number;
  /**
   * The event's colour and urgency flag in one. Absent means "no priority" —
   * the key is omitted rather than set to `undefined`, matching how the store
   * treats every other optional field.
   */
  priority?: EventPriority;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export type NewEventInput = Pick<Event, 'title' | 'startsAt'> &
  Partial<Pick<Event, 'notes' | 'durationMinutes' | 'priority' | 'isPinned'>>;

/**
 * `priority` accepts `null` **on purpose**. `undefined` means "leave this field
 * alone", so without `null` there would be no way to take a priority *off* an
 * event once it had one — the same dead end `color` is documented as having.
 * Clearing a flag has to be expressible.
 */
export type EventUpdateInput = Partial<
  Pick<Event, 'title' | 'notes' | 'startsAt' | 'durationMinutes' | 'isPinned'>
> & { priority?: EventPriority | null };

/* ── Folders ────────────────────────────────────────────────────────── */

export interface Folder {
  id: string;
  uuid: string;
  label: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

/** In-memory tree node the UI renders; built from the flat folder list. */
export interface FolderNode {
  id: string;
  label: string;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  children?: FolderNode[];
}

/** A flattened tree row with its indentation depth. */
export interface FlatFolderRow {
  node: FolderNode;
  depth: number;
}

/* ── Tasks & calendar ───────────────────────────────────────────────── */

export interface Task {
  id: number;
  label: string;
  sourceNote: string;
  done: boolean;
}

/**
 * `time` is a human-readable display label (e.g. "9 am"), NOT a parsable
 * date string — do not pass it to `new Date()`. `slotIndex` is vestigial and
 * always 0: it belonged to the hour timeline that was removed, and is kept only
 * because the Overview's card reads this shape.
 *
 * `startsAt` is the *sortable* half of an event — an ISO 8601 string, never
 * displayed directly.
 *
 * `pinned` lifts an event above the rest regardless of when it happens.
 * `priority` does **not** re-sort anything: the list stays chronological and
 * priority is a colour you read, not an ordering you have to learn.
 */
export interface CalendarEvent {
  title: string;
  time: string;
  slotIndex: number;
  /** The event's colour, carried through so the Overview's bar can match it. */
  priority?: EventPriority;
  /** ISO 8601 start. Absent means undated — see the note above. */
  startsAt?: string;
  pinned?: boolean;
}

/* ── Navigation ─────────────────────────────────────────────────────── */

/**
 * `Settings` is a full screen in the shell rather than a modal: it is reachable
 * from the sidebar, owns persisted preferences, and is deep enough that a modal
 * the size of the iPad-mini form factor would have to scroll internally anyway.
 * It is deliberately absent from the bottom dock — the dock switches *where you
 * work*, settings changes *how the app works*.
 */
export type ScreenKey = 'Overview' | 'Notes' | 'Agenda' | 'Settings';

/** Bottom-dock destinations, in render order. */
export const DOCK_SCREENS: readonly ScreenKey[] = ['Overview', 'Notes', 'Agenda'];

/* ── Preferences ────────────────────────────────────────────────────── */

/** Sections in the Settings sidebar, in render order. */
export type SettingsSection = 'accounts' | 'general' | 'preference' | 'shortcuts' | 'help';

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  'accounts',
  'general',
  'preference',
  'shortcuts',
  'help',
];

/** Individually toggleable blocks of the Overview dashboard. */
export type LayoutSectionKey = 'notes' | 'calendar' | 'tasks' | 'scratchPad';

/** Every Overview section, in default render order. */
export const LAYOUT_SECTIONS: readonly LayoutSectionKey[] = [
  'notes',
  'calendar',
  'tasks',
  'scratchPad',
];

/** Which Overview sections render. Persisted, so it survives relaunch. */
export type LayoutPrefs = Record<LayoutSectionKey, boolean>;

/** The render order of the Overview sections. Persisted alongside `layout`. */
export type LayoutOrder = LayoutSectionKey[];

/** Everything on by default — the dashboard a first run should show. */
export const DEFAULT_LAYOUT: LayoutPrefs = {
  notes: true,
  calendar: true,
  tasks: true,
  scratchPad: true,
};

/** Default render order, matching `LAYOUT_SECTIONS`. */
export const DEFAULT_ORDER: LayoutOrder = [...LAYOUT_SECTIONS];

/* ── Sidebar ─────────────────────────────────────────────────────────── */

/** The range the sidebar's edge can be dragged within. */
export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 520;
export const SIDEBAR_WIDTH_DEFAULT = 240;

/* ── Notes list pane ───────────────────────────────────────────────────── */

/**
 * The range the note list pane's edge can be dragged within.
 *
 * The floor is the width the rows need for a title beside its timestamp, and the
 * ceiling leaves the editor enough room to type in — a list dragged to 800px is
 * not a list, it is the editor with a column of titles down its left side.
 *
 * Desktop only. Below the tablet breakpoint the two panes are shown one at a
 * time, so there is no edge to drag.
 */
export const LIST_WIDTH_MIN = 200;
export const LIST_WIDTH_MAX = 520;
export const LIST_WIDTH_DEFAULT = 280;

/* ── Dock ────────────────────────────────────────────────────────────── */

/** Where the screen switcher sits. */
export type DockPosition = 'top' | 'bottom';

export const DOCK_POSITIONS: readonly DockPosition[] = ['top', 'bottom'];

export const DOCK_POSITION_LABELS: Record<DockPosition, string> = {
  top: 'Top',
  bottom: 'Bottom',
};

/**
 * What each tab of the screen switcher shows.
 *
 * The same three modes as the create button's menu, but a separate setting:
 * the two controls live on different screens, and a user who wants words on
 * the tabs may still want glyphs on the menu (or vice versa). Sharing one
 * value between them would make one preference quietly repaint the other.
 */
export type DockVariant = 'iconLabel' | 'label' | 'icon';

export const DOCK_VARIANTS: readonly DockVariant[] = ['iconLabel', 'label', 'icon'];

export const DOCK_VARIANT_LABELS: Record<DockVariant, string> = {
  iconLabel: 'Icon and text',
  label: 'Text only',
  icon: 'Icon only',
};

/* ── Create bar (FAB) ─────────────────────────────────────────────────── */

/**
 * What the create button's expanded menu shows on each row.
 *
 * - `iconLabel`: the default, and the only one that names its action.
 * - `label`: text only. The row is wider than it is tall and reads as a list of
 *   things rather than a shelf of glyphs.
 * - `icon`: a compact square of glyphs, for someone who already knows the three
 *   actions by heart and wants them to take the least room.
 *
 * `icon` is the one that gives something up: it is the only mode where a row
 * cannot say what it does, so every glyph keeps its accessibility label and the
 * menu carries a heading naming the group. An unlabelled icon set is the exact
 * "looks real and does nothing" failure the rest of this file keeps warning
 * about — a *silent* one, since a sighted user who does not know the glyphs
 * cannot tell.
 */
export type FabVariant = 'iconLabel' | 'label' | 'icon';

export const FAB_VARIANTS: readonly FabVariant[] = ['iconLabel', 'label', 'icon'];

export const FAB_VARIANT_LABELS: Record<FabVariant, string> = {
  iconLabel: 'Icon and text',
  label: 'Text only',
  icon: 'Icon only',
};
