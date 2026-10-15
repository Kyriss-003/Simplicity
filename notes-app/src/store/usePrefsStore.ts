import { create } from 'zustand';
import { prefsRepository } from '../db/PrefsRepository';
import {
  DEFAULT_LAYOUT,
  DEFAULT_ORDER,
  DOCK_POSITIONS,
  DOCK_VARIANTS,
  FAB_VARIANTS,
  LAYOUT_SECTIONS,
  LIST_WIDTH_DEFAULT,
  LIST_WIDTH_MAX,
  LIST_WIDTH_MIN,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  type DockPosition,
  type DockVariant,
  type FabVariant,
  type LayoutOrder,
  type LayoutPrefs,
  type LayoutSectionKey,
} from '../types';
import { ACCENT_NAMES, THEME_NAMES, type AccentName, type ThemeName } from '../theme';

/** Preference keys as stored. Keep in sync with the write helpers below. */
const KEY_THEME = 'theme';
const KEY_ACCENT = 'accent';
const KEY_LAYOUT = 'layout';
const KEY_ORDER = 'order';
const KEY_GENERAL = 'general';
const KEY_SIDEBAR_WIDTH = 'sidebar_width';
const KEY_DOCK_POSITION = 'dock_position';
const KEY_DOCK_VARIANT = 'dock_variant';
const KEY_FAB_VARIANT = 'fab_variant';
const KEY_TITLES = 'section_titles';
const KEY_LIST_WIDTH = 'notes_list_width';
const KEY_DISPLAY_NAME = 'display_name';

/**
 * `ACCENT_NAMES` is imported from `theme`, never redeclared. A local copy was
 * the one thing that would have survived adding an accent: `parseAccentName`
 * falls back to `Coral` for anything it does not recognise, so a third accent
 * added to the picker would have been written to storage, read back, and
 * silently dropped to coral on the next launch.
 */

/**
 * Persisted user preferences: appearance and the Overview dashboard layout.
 *
 * Separate from `useNoteStore` because this state is *configuration*, not user
 * content. It never touches notes, it survives a folder switch, and it must load
 * before the first paint to avoid a theme flash on relaunch — which is why
 * `initialize()` gates on `ready` rather than resolving into a partial state.
 *
 * Writes are fire-and-forget: a preference toggle should feel instant, and the
 * next launch re-reads whatever landed. Failures are swallowed for the same
 * reason the repository swallows them — a failed preference write must never
 * take down the screen that triggered it.
 */
export interface PrefsState {
  /** False until the first read completes, so the shell can hold its first paint. */
  ready: boolean;
  themeName: ThemeName;
  accent: AccentName;
  layout: LayoutPrefs;
  /** Render order of the Overview sections. */
  order: LayoutOrder;
  /** Ask before deleting a note. */
  confirmDelete: boolean;
  /** Jump straight into a new note when it is created. */
  openNewNote: boolean;
  /** The sidebar's width in points, set by dragging its edge. */
  sidebarWidth: number;
  /** The Notes screen's list pane width in points, set by dragging its edge. */
  listWidth: number;
  /** Whether the screen switcher floats at the bottom or sits at the top. */
  dockPosition: DockPosition;
  /** What each tab of the screen switcher shows. */
  dockVariant: DockVariant;
  /** What each row of the create button's expanded menu shows. */
  fabVariant: FabVariant;
  /** Show the heading above each Overview dashboard card. */
  showSectionTitles: boolean;
  /** The name shown in the greeting; empty until the user sets one. */
  displayName: string;

  /** Load persisted preferences. Safe to call more than once. */
  initialize: () => Promise<void>;
  /** Switch theme and persist the choice. */
  setThemeName: (name: ThemeName) => void;
  /** Switch the 10% accent layer and persist the choice. */
  setAccent: (name: AccentName) => void;
  /** Set the greeting name and persist it. Empty resets to the account default. */
  setDisplayName: (name: string) => void;
  /** Drag the sidebar's edge. Called continuously; the caller commits on release. */
  setSidebarWidth: (width: number) => void;
  /** Persist the sidebar width once, at the end of a drag. */
  commitSidebarWidth: (width: number) => void;
  /** Drag the note list's edge. Called continuously; the caller commits on release. */
  setListWidth: (width: number) => void;
  /** Persist the note list width once, at the end of a drag. */
  commitListWidth: (width: number) => void;
  setDockPosition: (position: DockPosition) => void;
  setDockVariant: (variant: DockVariant) => void;
  setFabVariant: (variant: FabVariant) => void;
  /** Show or hide the Overview section titles, and persist it. */
  setShowSectionTitles: (value: boolean) => void;
  /** Flip one Overview section on/off and persist the layout. */
  toggleSection: (section: LayoutSectionKey) => void;
  /**
   * Move a section from one index to another and persist the order.
   *
   * The drag-to-reorder path. Indices rather than keys because a drag produces
   * a from/to pair by construction, and re-deriving the key from an index would
   * be a second way to say the same thing.
   */
  reorderSections: (from: number, to: number) => void;
  /** Set one General-section behaviour flag. */
  setBehaviour: (key: BehaviourKey, value: boolean) => void;
  /** Restore the default visibility and order. */
  resetLayout: () => void;
}

/** The two behaviour flags the General settings section controls. */
export type BehaviourKey = 'confirmDelete' | 'openNewNote';

const DEFAULT_BEHAVIOUR: Record<BehaviourKey, boolean> = {
  confirmDelete: true,
  openNewNote: true,
};

export const usePrefsStore = create<PrefsState>((set, get) => ({
  ready: false,
  themeName: 'Dark',
  accent: 'Claude',
  layout: { ...DEFAULT_LAYOUT },
  order: [...DEFAULT_ORDER],
  sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
    listWidth: LIST_WIDTH_DEFAULT,
  dockPosition: 'bottom',
  dockVariant: 'iconLabel',
  fabVariant: 'iconLabel',
  showSectionTitles: true,
  displayName: '',
  ...DEFAULT_BEHAVIOUR,

  initialize: async () => {
    if (get().ready) return;
    try {
      const stored = await prefsRepository.getAll();
      set({
        themeName: parseThemeName(stored[KEY_THEME]),
        accent: parseAccentName(stored[KEY_ACCENT]),
        layout: parseLayout(stored[KEY_LAYOUT]),
        order: parseOrder(stored[KEY_ORDER]),
        sidebarWidth: parseSidebarWidth(stored[KEY_SIDEBAR_WIDTH]),
                listWidth: parseListWidth(stored[KEY_LIST_WIDTH]),
        dockPosition: parseDockPosition(stored[KEY_DOCK_POSITION]),
        dockVariant: parseDockVariant(stored[KEY_DOCK_VARIANT]),
        fabVariant: parseFabVariant(stored[KEY_FAB_VARIANT]),
        showSectionTitles: parseShowSectionTitles(stored[KEY_TITLES]),
        displayName: stored[KEY_DISPLAY_NAME] ?? '',
        ...parseBehaviour(stored[KEY_GENERAL]),
        ready: true,
      });
    } catch {
      // A corrupt or unavailable store must not block the app from opening.
      set({ ready: true });
    }
  },

  setThemeName: (name) => {
    set({ themeName: name });
    void write({ [KEY_THEME]: name });
  },

  setAccent: (name) => {
    set({ accent: name });
    void write({ [KEY_ACCENT]: name });
  },

  setDisplayName: (name) => {
    const trimmed = name.trim().slice(0, 40);
    set({ displayName: trimmed });
    void write({ [KEY_DISPLAY_NAME]: trimmed });
  },

  /**
   * The live width, written to the store but **not** to storage.
   *
   * A drag fires this on every frame of the pointer's travel, and a preference
   * write per frame would hammer the repository for something the user cannot
   * perceive until they let go. `commitSidebarWidth` is the one that persists.
   */
  setSidebarWidth: (width) => {
    set({ sidebarWidth: width });
  },

  commitSidebarWidth: (width) => {
    const next = clampSidebarWidth(width);
    set({ sidebarWidth: next });
    void write({ [KEY_SIDEBAR_WIDTH]: String(next) });
  },

  /**
   * Same two-phase shape as the sidebar: live during the drag, persisted once at
   * the end. A preference write per frame is what the sidebar's split exists to
   * avoid, and a second pane edge would hit the same repository just as hard.
   */
  setListWidth: (width) => {
    set({ listWidth: width });
  },

  commitListWidth: (width) => {
    const next = clampListWidth(width);
    set({ listWidth: next });
    void write({ [KEY_LIST_WIDTH]: String(next) });
  },

  setDockPosition: (position) => {
    set({ dockPosition: position });
    void write({ [KEY_DOCK_POSITION]: position });
  },

  setDockVariant: (variant) => {
    set({ dockVariant: variant });
    void write({ [KEY_DOCK_VARIANT]: variant });
  },

  setFabVariant: (variant) => {
    set({ fabVariant: variant });
    void write({ [KEY_FAB_VARIANT]: variant });
  },

  setShowSectionTitles: (value) => {
    set({ showSectionTitles: value });
    void write({ [KEY_TITLES]: String(value) });
  },

  toggleSection: (section) => {
    const layout = { ...get().layout, [section]: !get().layout[section] };
    set({ layout });
    void write({ [KEY_LAYOUT]: JSON.stringify(layout) });
  },

  reorderSections: (from, to) => {
    const order = [...get().order];
    if (from === to) return;
    // A drag can finish anywhere, including off either end if the pointer is
    // released past the list. Clamping to a no-op is right: wrapping a
    // dashboard onto itself is not a reorder the user asked for.
    if (from < 0 || to < 0 || from >= order.length || to >= order.length) return;
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved as LayoutSectionKey);
    set({ order });
    void write({ [KEY_ORDER]: JSON.stringify(order) });
  },

  setBehaviour: (key, value) => {
    // Only known keys are written. Persisting an unrecognised one would create
    // an asymmetry: it would sit in storage and then be silently dropped on the
    // next read, which looks like a setting that half-worked.
    const current = get();
    const next: Record<BehaviourKey, boolean> = {
      confirmDelete: key === 'confirmDelete' ? value : current.confirmDelete,
      openNewNote: key === 'openNewNote' ? value : current.openNewNote,
    };
    set(next);
    void write({ [KEY_GENERAL]: JSON.stringify(next) });
  },

  resetLayout: () => {
    const layout = { ...DEFAULT_LAYOUT };
    const order = [...DEFAULT_ORDER];
    set({ layout, order });
    void write({ [KEY_LAYOUT]: JSON.stringify(layout), [KEY_ORDER]: JSON.stringify(order) });
  },
}));

/** Best-effort write. A rejected preference write is not a user-facing error. */
function write(entries: Record<string, string>): Promise<void> {
  return prefsRepository.setMany(entries).catch(() => undefined);
}

/** Unknown, missing, or malformed values fall back rather than throwing. */
function parseThemeName(raw: string | undefined): ThemeName {
  return THEME_NAMES.find((name) => name === raw) ?? 'Dark';
}

/**
 * Accent names that have been renamed, mapped to the name that replaced them.
 *
 * `Coral` became `Claude`; the colour did not change. Without this, a stored
 * `accent=Coral` misses the lookup and lands on whatever the fallback happens to
 * be — which silently repaints a returning user's accent every time a name is
 * changed. An explicit map makes the rename a no-op for them, and makes the next
 * one deliberate.
 */
const LEGACY_ACCENTS: Record<string, AccentName> = { Coral: 'Claude' };

function parseAccentName(raw: string | undefined): AccentName {
  if (!raw) return 'Claude';
  return ACCENT_NAMES.find((name) => name === raw) ?? LEGACY_ACCENTS[raw] ?? 'Claude';
}

function parseBehaviour(raw: string | undefined): Record<BehaviourKey, boolean> {
  if (!raw) return { ...DEFAULT_BEHAVIOUR };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<BehaviourKey, unknown>>;
    const next = { ...DEFAULT_BEHAVIOUR };
    // Only a real boolean counts, so a hand-edited blob cannot disable a guard.
    for (const key of Object.keys(DEFAULT_BEHAVIOUR) as BehaviourKey[]) {
      if (typeof parsed[key] === 'boolean') next[key] = parsed[key];
    }
    return next;
  } catch {
    return { ...DEFAULT_BEHAVIOUR };
  }
}

function parseLayout(raw: string | undefined): LayoutPrefs {
  if (!raw) return { ...DEFAULT_LAYOUT };
  try {
    const parsed = JSON.parse(raw) as Partial<Record<LayoutSectionKey, unknown>>;
    const layout: LayoutPrefs = { ...DEFAULT_LAYOUT };
    // Only known keys with a real boolean count — a hand-edited or older blob
    // should reveal new sections rather than silently hide them.
    for (const section of LAYOUT_SECTIONS) {
      if (typeof parsed[section] === 'boolean') layout[section] = parsed[section];
    }
    return layout;
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

/**
 * Reconciles a stored order against the sections that actually exist.
 *
 * A saved order that is missing a section, or that names one twice, would
 * silently drop a block from the dashboard. Unknown ids are discarded and
 * missing ones are appended, so a section added in a later release shows up
 * (at the end) instead of vanishing.
 */
function parseOrder(raw: string | undefined): LayoutOrder {
  if (!raw) return [...DEFAULT_ORDER];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_ORDER];

    const order: LayoutOrder = [];
    for (const entry of parsed) {
      if (
        typeof entry === 'string' &&
        LAYOUT_SECTIONS.includes(entry as LayoutSectionKey) &&
        !order.includes(entry as LayoutSectionKey)
      ) {
        order.push(entry as LayoutSectionKey);
      }
    }
    for (const section of LAYOUT_SECTIONS) {
      if (!order.includes(section)) order.push(section);
    }
    return order;
  } catch {
    return [...DEFAULT_ORDER];
  }
}

/**
 * The sidebar width is clamped on read as well as on write.
 *
 * A stored number is the one value here that can come from a device that no
 * longer exists: an old build's 900px sidebar, or a hand-edited entry. Both
 * would render — 900 takes the whole window and 40 leaves the labels unreadable
 * — so the range is enforced before it ever reaches a layout.
 */
function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(width)));
}

function parseSidebarWidth(raw: string | undefined): number {
  if (!raw) return SIDEBAR_WIDTH_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return SIDEBAR_WIDTH_DEFAULT;
  return clampSidebarWidth(parsed);
}

/**
 * The list pane's width, clamped on read as well as write, for the same reason.
 *
 * A shared helper rather than a second copy of the clamp: the range differs, the
 * rule does not, and two copies is how the next constant drifts out of step with
 * the one it was copied from.
 */
function clampListWidth(width: number): number {
  return Math.min(LIST_WIDTH_MAX, Math.max(LIST_WIDTH_MIN, Math.round(width)));
}

function parseListWidth(raw: string | undefined): number {
  if (!raw) return LIST_WIDTH_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return LIST_WIDTH_DEFAULT;
  return clampListWidth(parsed);
}

function parseDockPosition(raw: string | undefined): DockPosition {
  return DOCK_POSITIONS.find((name) => name === raw) ?? 'bottom';
}

/** Unknown values fall back to the default, which is the only mode that names
 * every tab — the safe answer for a control that must not be ambiguous. */
function parseDockVariant(raw: string | undefined): DockVariant {
  return DOCK_VARIANTS.find((name) => name === raw) ?? 'iconLabel';
}

/** Unknown values fall back to the default, which is the only mode that names
 * every action — the safe answer for a control that must not be ambiguous. */
function parseFabVariant(raw: string | undefined): FabVariant {
  return FAB_VARIANTS.find((variant) => variant === raw) ?? 'iconLabel';
}

/**
 * Only an explicit "false" hides the titles. Anything else — including
 * a missing or malformed entry — keeps them, so a corrupt preference
 * cannot silently strip the dashboard of its section labels.
 */
function parseShowSectionTitles(raw: string | undefined): boolean {
  return raw !== 'false';
}
