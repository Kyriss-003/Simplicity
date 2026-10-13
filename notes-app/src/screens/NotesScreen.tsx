import { type Theme } from '../theme';
import type { Note } from '../types';
import { NotesView } from '../components/notes/NotesView';
import type { NoteTab } from '../components/notes/NoteTabs';

/** Notes screen: the split-pane list + markdown editor, or one at a time on a phone. */
export function NotesScreen({
  theme,
  notes,
  selected,
  tabs,
  folderLabel,
  listWidth,
  onResizeList,
  onResizeListCommit,
  isMobile,
  isEditorOpen,
  isListCollapsed,
  onSelect,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onStepTab,
  onOpenEditor,
  onCloseEditor,
  onContentChange,
  onDelete,
  onMoveNote,
  onDuplicateNote,
  onDeleteNote,
  onRenameNote,
  onToggleSidebar,
}: {
  theme: Theme;
  notes: Note[];
  selected: Note | null;
  /** The notes held open, in the order they were opened. */
  tabs: NoteTab[];
  /** The active folder's name, shown as the list pane's heading. */
  folderLabel: string;
  /** The list pane's expanded width, in points. */
  listWidth: number;
  onResizeList: (width: number) => void;
  onResizeListCommit: (width: number) => void;
  /** Below the tablet breakpoint the list and the editor each take the screen. */
  isMobile: boolean;
  /** Mobile only: is the typing space the pane on screen? */
  isEditorOpen: boolean;
  isListCollapsed: boolean;
  onSelect: (n: Note) => void;
  /** Focus an already-open note from the tab strip. */
  onSelectTab: (id: number) => void;
  /** Close a tab; the orchestrator decides what to focus next. */
  onCloseTab: (id: number) => void;
  /** The strip's `+`: open a new note in a new tab. */
  onNewTab: () => void;
  /** Move one tab along the strip. */
  onStepTab: (direction: -1 | 1) => void;
  onOpenEditor: () => void;
  onCloseEditor: () => void;
  onContentChange: (text: string) => void;
  onDelete: () => void;
  onMoveNote?: (noteId: number) => void;
  onDuplicateNote?: (noteId: number) => void;
  onDeleteNote?: (noteId: number) => void;
  onRenameNote?: (noteId: number, title: string) => void;
  onToggleSidebar?: () => void;
}) {
  return (
    <NotesView
      theme={theme}
      notes={notes}
      selected={selected}
      tabs={tabs}
      folderLabel={folderLabel}
      listWidth={listWidth}
      onResizeList={onResizeList}
      onResizeListCommit={onResizeListCommit}
      isMobile={isMobile}
      isEditorOpen={isEditorOpen}
      isListCollapsed={isListCollapsed}
      onSelect={onSelect}
      onSelectTab={onSelectTab}
      onCloseTab={onCloseTab}
      onNewTab={onNewTab}
      onStepTab={onStepTab}
      onOpenEditor={onOpenEditor}
      onCloseEditor={onCloseEditor}
      onContentChange={onContentChange}
      onDelete={onDelete}
      onMoveNote={onMoveNote}
      onDuplicateNote={onDuplicateNote}
      onDeleteNote={onDeleteNote}
      onRenameNote={onRenameNote}
      onToggleSidebar={onToggleSidebar}
    />
  );
}
