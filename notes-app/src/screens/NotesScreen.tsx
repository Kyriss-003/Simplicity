import { type Theme } from '../theme';
import type { Note } from '../types';
import { NotesView } from '../components/notes/NotesView';

/** Notes screen: the split-pane list + markdown editor. */
export function NotesScreen({
  theme,
  notes,
  selected,
  onSelect,
  onNewNote,
  onContentChange,
  onDelete,
  onMoveNote,
  onDuplicateNote,
  onDeleteNote,
}: {
  theme: Theme;
  notes: Note[];
  selected: Note | null;
  onSelect: (n: Note) => void;
  onNewNote: () => void;
  onContentChange: (text: string) => void;
  onDelete: () => void;
  onMoveNote?: (noteId: number) => void;
  onDuplicateNote?: (noteId: number) => void;
  onDeleteNote?: (noteId: number) => void;
}) {
  return (
    <NotesView
      theme={theme}
      notes={notes}
      selected={selected}
      onSelect={onSelect}
      onNewNote={onNewNote}
      onContentChange={onContentChange}
      onDelete={onDelete}
      onMoveNote={onMoveNote}
      onDuplicateNote={onDuplicateNote}
      onDeleteNote={onDeleteNote}
    />
  );
}
