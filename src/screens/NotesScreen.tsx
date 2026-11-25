import type { Theme } from '../theme';
import type { Note, NoteTemplate, NotesLayout } from '../types';
import type { AutoSaveStatus } from '../hooks/useNoteAutoSave';
import { NotesView } from '../components/notes/NotesView';
import type { NoteTab } from '../components/notes/NoteTabs';

export function NotesScreen(props: {
  theme: Theme;
  notes: Note[];
  selected: Note | null;
  tabs: NoteTab[];
  folderLabel: string;
  listWidth: number;
  notesLayout: NotesLayout;
  onResizeList: (width: number) => void;
  onResizeListCommit: (width: number) => void;
  isMobile: boolean;
  isEditorOpen: boolean;
  isListCollapsed: boolean;
  onSelect: (n: Note) => void;
  onSelectTab: (id: number) => void;
  onCloseTab: (id: number) => void;
  onNewTab: () => void;
  onStepTab: (direction: -1 | 1) => void;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
  onContentChange: (text: string) => void;
  onDelete: () => void;
  saveStatus?: AutoSaveStatus;
  onSaveNow?: () => void;
  onMoveNote?: (noteId: number) => void;
  onDuplicateNote?: (noteId: number) => void;
  onDeleteNote?: (noteId: number) => void;
  onRenameNote?: (noteId: number, title: string) => void;
  onTogglePinNote?: (noteId: number) => void;
  onOpenPortability?: (tab: 'export' | 'import') => void;
  onToggleSidebar?: () => void;
  templates?: NoteTemplate[];
  onOpenTemplates?: (opts?: {
    initialView?: 'browse' | 'create' | 'saveNote';
    initialTemplateId?: string;
    liveTitle?: string;
    liveContent?: string;
  }) => void;
  onCreateNoteFromTemplate?: (
    title: string,
    content: string,
    template: NoteTemplate
  ) => Promise<void> | void;
  insertRequest?: { seq: number; text: string } | null;
}) {
  return <NotesView {...props} />;
}
