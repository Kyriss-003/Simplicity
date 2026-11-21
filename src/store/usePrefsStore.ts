import { create } from 'zustand';
import { prefsRepository } from '../db/storage';
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

export type BehaviourKey = 'confirmDelete' | 'openNewNote';

const DEFAULT_BEHAVIOUR: Record<BehaviourKey, boolean> = {
  confirmDelete: true,
  openNewNote: true,
};

export interface PrefsState {
  ready: boolean;
  themeName: ThemeName;
  accent: AccentName;
  layout: LayoutPrefs;
  order: LayoutOrder;
  confirmDelete: boolean;
  openNewNote: boolean;
  sidebarWidth: number;
  listWidth: number;
  dockPosition: DockPosition;
  dockVariant: DockVariant;
  fabVariant: FabVariant;
  showSectionTitles: boolean;
  displayName: string;

  initialize: () => Promise<void>;
  setThemeName: (name: ThemeName) => void;
  setAccent: (name: AccentName) => void;
  setDisplayName: (name: string) => void;
  setSidebarWidth: (width: number) => void;
  commitSidebarWidth: (width: number) => void;
  setListWidth: (width: number) => void;
  commitListWidth: (width: number) => void;
  setDockPosition: (position: DockPosition) => void;
  setDockVariant: (variant: DockVariant) => void;
  setFabVariant: (variant: FabVariant) => void;
  setShowSectionTitles: (value: boolean) => void;
  toggleSection: (section: LayoutSectionKey) => void;
  reorderSections: (from: number, to: number) => void;
  setBehaviour: (key: BehaviourKey, value: boolean) => void;
  resetLayout: () => void;
}

function write(entries: Record<string, string>): Promise<void> {
  return prefsRepository.setMany(entries).catch(() => undefined);
}

function parseThemeName(raw: string | undefined): ThemeName {
  return THEME_NAMES.find((name) => name === raw) ?? 'Dark';
}

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
    for (const section of LAYOUT_SECTIONS) {
      if (typeof parsed[section] === 'boolean') layout[section] = parsed[section];
    }
    return layout;
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

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

function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(width)));
}

function parseSidebarWidth(raw: string | undefined): number {
  if (!raw) return SIDEBAR_WIDTH_DEFAULT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clampSidebarWidth(parsed) : SIDEBAR_WIDTH_DEFAULT;
}

function clampListWidth(width: number): number {
  return Math.min(LIST_WIDTH_MAX, Math.max(LIST_WIDTH_MIN, Math.round(width)));
}

function parseListWidth(raw: string | undefined): number {
  if (!raw) return LIST_WIDTH_DEFAULT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clampListWidth(parsed) : LIST_WIDTH_DEFAULT;
}

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
        dockPosition: DOCK_POSITIONS.find((p) => p === stored[KEY_DOCK_POSITION]) ?? 'bottom',
        dockVariant: DOCK_VARIANTS.find((v) => v === stored[KEY_DOCK_VARIANT]) ?? 'iconLabel',
        fabVariant: FAB_VARIANTS.find((v) => v === stored[KEY_FAB_VARIANT]) ?? 'iconLabel',
        showSectionTitles: stored[KEY_TITLES] !== 'false',
        displayName: stored[KEY_DISPLAY_NAME] ?? '',
        ...parseBehaviour(stored[KEY_GENERAL]),
        ready: true,
      });
    } catch {
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

  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  commitSidebarWidth: (width) => {
    const next = clampSidebarWidth(width);
    set({ sidebarWidth: next });
    void write({ [KEY_SIDEBAR_WIDTH]: String(next) });
  },

  setListWidth: (width) => set({ listWidth: width }),
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
    if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return;
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved as LayoutSectionKey);
    set({ order });
    void write({ [KEY_ORDER]: JSON.stringify(order) });
  },

  setBehaviour: (key, value) => {
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
