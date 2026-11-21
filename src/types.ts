export interface Note {
  id: number;
  uuid: string;
  title: string;
  content: string;
  tags: string[];
  folderId: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  isSynced: boolean;
}

export type NewNoteInput = Pick<Note, 'title' | 'content' | 'tags' | 'folderId'> &
  Partial<Pick<Note, 'isPinned'>>;
export type NoteUpdateInput = Partial<
  Pick<Note, 'title' | 'content' | 'tags' | 'folderId' | 'isPinned'>
>;

export type TemplateCategory = 'Planning' | 'Work' | 'Personal' | 'Custom';
export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = [
  'Planning',
  'Work',
  'Personal',
  'Custom',
];

export interface NoteTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  content: string;
  tags: string[];
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NewTemplateInput = Pick<NoteTemplate, 'name' | 'category' | 'content'> &
  Partial<Pick<NoteTemplate, 'description' | 'tags'>>;
export type TemplateUpdateInput = Partial<
  Pick<NoteTemplate, 'name' | 'category' | 'description' | 'content' | 'tags'>
>;

export type EventPriority = 'urgent' | 'high' | 'medium' | 'low';
export const EVENT_PRIORITIES: readonly EventPriority[] = ['urgent', 'high', 'medium', 'low'];

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
  notes: string;
  startsAt: string;
  durationMinutes: number;
  priority?: EventPriority;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export type NewEventInput = Pick<Event, 'title' | 'startsAt'> &
  Partial<Pick<Event, 'notes' | 'durationMinutes' | 'priority' | 'isPinned'>>;

export type EventUpdateInput = Partial<
  Pick<Event, 'title' | 'notes' | 'startsAt' | 'durationMinutes' | 'isPinned'>
> & { priority?: EventPriority | null };

export interface Folder {
  id: string;
  uuid: string;
  label: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface FolderNode {
  id: string;
  label: string;
  children?: FolderNode[];
}

export interface FlatFolderRow {
  node: FolderNode;
  depth: number;
}

export interface Task {
  id: number;
  label: string;
  sourceNote: string;
  done: boolean;
}

export interface CalendarEvent {
  title: string;
  time: string;
  slotIndex: number;
  priority?: EventPriority;
  startsAt?: string;
  pinned?: boolean;
}

export type ScreenKey = 'Overview' | 'Notes' | 'Agenda' | 'Settings';
export const DOCK_SCREENS: readonly ScreenKey[] = ['Overview', 'Notes', 'Agenda'];

export type SettingsSection = 'accounts' | 'general' | 'preference' | 'shortcuts' | 'help';
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  'accounts',
  'general',
  'preference',
  'shortcuts',
  'help',
];

export type LayoutSectionKey = 'notes' | 'calendar' | 'tasks' | 'scratchPad';
export const LAYOUT_SECTIONS: readonly LayoutSectionKey[] = [
  'notes',
  'calendar',
  'tasks',
  'scratchPad',
];

export type LayoutPrefs = Record<LayoutSectionKey, boolean>;
export type LayoutOrder = LayoutSectionKey[];

export const DEFAULT_LAYOUT: LayoutPrefs = {
  notes: true,
  calendar: true,
  tasks: true,
  scratchPad: true,
};

export const DEFAULT_ORDER: LayoutOrder = [...LAYOUT_SECTIONS];

export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 520;
export const SIDEBAR_WIDTH_DEFAULT = 240;

export const LIST_WIDTH_MIN = 200;
export const LIST_WIDTH_MAX = 520;
export const LIST_WIDTH_DEFAULT = 280;

export type DockPosition = 'top' | 'bottom';
export const DOCK_POSITIONS: readonly DockPosition[] = ['top', 'bottom'];
export const DOCK_POSITION_LABELS: Record<DockPosition, string> = {
  top: 'Top',
  bottom: 'Bottom',
};

export type DockVariant = 'iconLabel' | 'label' | 'icon';
export const DOCK_VARIANTS: readonly DockVariant[] = ['iconLabel', 'label', 'icon'];
export const DOCK_VARIANT_LABELS: Record<DockVariant, string> = {
  iconLabel: 'Icon and text',
  label: 'Text only',
  icon: 'Icon only',
};

export type FabVariant = 'iconLabel' | 'label' | 'icon';
export const FAB_VARIANTS: readonly FabVariant[] = ['iconLabel', 'label', 'icon'];
export const FAB_VARIANT_LABELS: Record<FabVariant, string> = {
  iconLabel: 'Icon and text',
  label: 'Text only',
  icon: 'Icon only',
};
