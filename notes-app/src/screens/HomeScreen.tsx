import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { Layout, THEMES, type ThemeName } from '../theme';
import { useNoteStore } from '../store/useNoteStore';
import { ROOT_FOLDER_ID } from '../db/FolderRepository';
import type { CalendarEvent, FolderNode, Note, ScreenKey, Task } from '../types';

import Sidebar from '../components/Sidebar';
import { TopHeader } from '../components/TopHeader';
import { CapsuleSwitcher } from '../components/CapsuleSwitcher';
import { FloatingActionFab } from '../components/FloatingActionFab';
import { MoveToModal } from '../components/shared/MoveToModal';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { deriveTitle, greeting, todayLabel } from '../components/shared/utils';
import { buildFolderTree } from '../hooks/useFolderTree';
import { useDebouncedPersist } from '../hooks/useDebouncedPersist';
import { OverviewScreen } from './OverviewScreen';
import { NotesScreen } from './NotesScreen';
import { AgendaScreen } from './AgendaScreen';

const DAY_SLOTS = ['8 am', '9 am', '10 am', '11 am', 'Noon', '1 pm', '2 pm'];
const WEEK_SLOTS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_SLOTS = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];

/* ------------------------------------------------------------------ */
/* Main screen — orchestrator only                                    */
/* ------------------------------------------------------------------ */

export default function HomeScreen() {
  const {
    notes,
    folders,
    isLoading,
    selectedFolderId,
    initialize,
    getAllNotes,
    createNote,
    updateNote,
    softDeleteNote,
    duplicateNote,
    moveNote,
    setSelectedFolder,
    createFolder,
    renameFolder,
    moveFolder,
    duplicateFolder,
    deleteFolder,
    refreshNoteCounts,
    noteCounts,
  } = useNoteStore();

  const { width: winWidth } = useWindowDimensions();
  const isMobile = winWidth < Layout.breakpoints.tablet;

  const [isSidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('Overview');
  const [themeName, setThemeName] = useState<ThemeName>('Dark');
  const theme = THEMES[themeName];

  const [notesTab, setNotesTab] = useState<string>('Recents');
  const [calendarTab, setCalendarTab] = useState<string>('Today');
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  /* ---- Calendar data driven by the active tab ---- */
  const calendarSlots = useMemo(() => {
    if (calendarTab === 'Today') return DAY_SLOTS;
    if (calendarTab === 'Week') return WEEK_SLOTS;
    return MONTH_SLOTS;
  }, [calendarTab]);

  const calendarEvents = useMemo(() => {
    if (calendarTab === 'Today') return events;
    // Week columns are Mon–Sun, so daily slot indices 0–4 are weekdays.
    if (calendarTab === 'Week') {
      return events.filter((ev) => ev.slotIndex >= 0 && ev.slotIndex < 5);
    }
    // Month spreads the 7 daily slots across 4 week buckets.
    return events.map((ev) => ({ ...ev, slotIndex: Math.min(3, Math.floor(ev.slotIndex / 2)) }));
  }, [calendarTab, events]);

  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, label: 'Review pull requests', sourceNote: 'Engineering', done: false },
    { id: 2, label: 'Send weekly digest', sourceNote: 'Marketing', done: true },
  ]);
  const [newTask, setNewTask] = useState('');
  const [scratch, setScratch] = useState('');
  const [userName] = useState('User');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isFabOpen, setFabOpen] = useState(false);

  /* ---- Move-to modal state (shared for folder & note moves) ---- */
  const [moveTarget, setMoveTarget] = useState<{
    kind: 'folder' | 'note';
    id: string | number;
    label: string;
  } | null>(null);

  /* ---- Delete confirmation state (shared) ---- */
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'folder' | 'note';
    id: string | number;
    label: string;
  } | null>(null);

  // Auto-collapse sidebar on mobile breakpoint change
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
    else setSidebarOpen(true);
  }, [isMobile]);

  // Initialize (folders + notes) on mount
  useEffect(() => {
    initialize();
    refreshNoteCounts();
  }, [initialize, refreshNoteCounts]);

  const folderTree: FolderNode[] = useMemo(() => buildFolderTree(folders), [folders]);

  const dashboardNotes = useMemo(() => {
    if (notesTab === 'Suggested') return [...notes].sort(() => Math.random() - 0.5).slice(0, 8);
    return notes.slice(0, 8);
  }, [notes, notesTab]);

  /* ---- Note handlers ---- */
  const handleNewNote = useCallback(
    async (folderId?: string) => {
      const created = await createNote({
        title: 'Untitled Note',
        content: '',
        tags: ['Notebook'],
        folderId: folderId ?? selectedFolderId ?? ROOT_FOLDER_ID,
      });
      if (created) {
        setEditingNote(created);
        setActiveScreen('Notes');
        setFabOpen(false);
      }
    },
    [createNote, selectedFolderId],
  );

  const handleOpenNote = (note: Note) => {
    setEditingNote(note);
    setActiveScreen('Notes');
  };

  const { schedule: scheduleNoteSave, flush: flushNoteSave } = useDebouncedPersist(updateNote, 400);

  // The debounce holds a single pending payload, so a keystroke in the next
  // note would overwrite the previous note's unsaved tail. Flush whenever the
  // selected note changes — this covers every path that calls setEditingNote
  // (handleOpenNote, handleNewNote, and NotesView's onSelect).
  const previousNoteId = useRef<number | null>(null);
  useEffect(() => {
    const nextId = editingNote?.id ?? null;
    if (previousNoteId.current !== null && previousNoteId.current !== nextId) {
      flushNoteSave();
    }
    previousNoteId.current = nextId;
  }, [editingNote?.id, flushNoteSave]);

  const handleContentChange = (text: string) => {
    if (!editingNote) return;
    const nextTitle = deriveTitle(text) || 'Untitled Note';
    setEditingNote({ ...editingNote, content: text, title: nextTitle });
    scheduleNoteSave(editingNote.id, { content: text, title: nextTitle });
  };

  const handleDeleteNote = async () => {
    if (!editingNote) return;
    await softDeleteNote(editingNote.id);
    setEditingNote(null);
  };

  /* ---- Note context-menu callbacks ---- */
  const handleMoveNote = useCallback(
    (noteId: number) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      setMoveTarget({ kind: 'note', id: noteId, label: note.title });
    },
    [notes],
  );

  const handleDuplicateNote = useCallback(
    async (noteId: number) => {
      await duplicateNote(noteId);
      await getAllNotes();
    },
    [duplicateNote, getAllNotes],
  );

  const handleDeleteNoteById = useCallback(
    (noteId: number) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      setDeleteTarget({ kind: 'note', id: noteId, label: note.title });
    },
    [notes],
  );

  /* ---- Folder context-menu callbacks ---- */
  const handleSelectFolder = useCallback(
    (folderId: string) => {
      setSelectedFolder(folderId);
    },
    [setSelectedFolder],
  );

  const handleCreateFolder = useCallback(
    async (parentId: string, label: string) => {
      await createFolder(label, parentId);
    },
    [createFolder],
  );

  const handleRenameFolder = useCallback(
    async (folderId: string, label: string) => {
      await renameFolder(folderId, label);
    },
    [renameFolder],
  );

  const handleMoveFolder = useCallback((folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    setMoveTarget({ kind: 'folder', id: folderId, label: folder.label });
  }, [folders]);

  const handleDuplicateFolderAction = useCallback(
    async (folderId: string) => {
      await duplicateFolder(folderId);
    },
    [duplicateFolder],
  );

  const handleDeleteFolderAction = useCallback((folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    setDeleteTarget({ kind: 'folder', id: folderId, label: folder.label });
  }, [folders]);

  /* ---- Move-to modal confirm ---- */
  const handleMoveConfirm = useCallback(
    async (targetParentId: string) => {
      if (!moveTarget) return;
      if (moveTarget.kind === 'folder') {
        await moveFolder(moveTarget.id as string, targetParentId);
      } else {
        await moveNote(moveTarget.id as number, targetParentId);
      }
      setMoveTarget(null);
    },
    [moveTarget, moveFolder, moveNote],
  );

  /* ---- Delete confirmation confirm ---- */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'folder') {
      await deleteFolder(deleteTarget.id as string);
    } else {
      await softDeleteNote(deleteTarget.id as number);
      if (editingNote?.id === deleteTarget.id) setEditingNote(null);
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteFolder, softDeleteNote, editingNote]);

  /* ---- Task handlers ---- */
  // Ids must stay unique even when two tasks are added in the same millisecond:
  // a collision would duplicate list keys and toggle both rows at once.
  const nextTaskId = useRef(1);
  const addTask = () => {
    const label = newTask.trim();
    if (!label) return;
    setTasks((t) => [
      ...t,
      { id: nextTaskId.current++, label, sourceNote: 'General', done: false },
    ]);
    setNewTask('');
    setFabOpen(false);
  };

  const toggleTask = (id: number) =>
    setTasks((t) => t.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));

  /* ---- FAB handlers ---- */
  const handleFabAction = (kind: 'note' | 'task' | 'event') => {
    setFabOpen(false);
    if (kind === 'note') return handleNewNote();
    if (kind === 'task' && activeScreen !== 'Overview' && activeScreen !== 'Agenda') {
      setActiveScreen('Overview');
    }
    if (kind === 'event') setActiveScreen('Agenda');
  };

  return (
    <View style={[styles.app, { backgroundColor: theme.background }]}>
      <View style={styles.layout}>
        {/* Sidebar — overlay on mobile */}
        {isMobile && isSidebarOpen ? (
          <Pressable style={styles.mobileOverlay} onPress={() => setSidebarOpen(false)} />
        ) : null}
        <View
          style={[
            isMobile ? styles.mobileSidebarWrap : undefined,
            !isSidebarOpen && styles.sidebarCollapsed,
          ]}
          pointerEvents={isSidebarOpen ? 'auto' : 'none'}
        >
          <Sidebar
            theme={theme}
            activeNav={activeScreen}
            themeName={themeName}
            folders={folders}
            selectedFolderId={selectedFolderId}
            noteCounts={noteCounts}
            onToggle={() => setSidebarOpen((v) => !v)}
            onSelectNav={(k) => {
              setActiveScreen(k);
              if (isMobile) setSidebarOpen(false);
            }}
            onSelectTheme={setThemeName}
            onSelectFolder={handleSelectFolder}
            onCreateNote={(folderId) => {
              handleNewNote(folderId);
              if (isMobile) setSidebarOpen(false);
            }}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onMoveFolder={handleMoveFolder}
            onDuplicateFolder={handleDuplicateFolderAction}
            onDeleteFolder={handleDeleteFolderAction}
          />
        </View>

        {/* Main */}
        <View style={styles.main}>
          {/* Top header — hamburger only while the sidebar is closed;
              creation actions live in the floating action button */}
          <TopHeader
            theme={theme}
            isMobile={isMobile}
            userName={userName}
            greetingText={greeting()}
            dateText={todayLabel()}
            showGreeting={activeScreen === 'Overview'}
            showSidebarToggle={!isSidebarOpen}
            onToggleSidebar={() => setSidebarOpen(true)}
          />

          {/* Screen content */}
          <View style={styles.fill}>
            {activeScreen === 'Overview' ? (
              <OverviewScreen
                theme={theme}
                isMobile={isMobile}
                isLoading={isLoading}
                notesTab={notesTab}
                onNotesTab={setNotesTab}
                dashboardNotes={dashboardNotes}
                onOpenNote={handleOpenNote}
                calendarTab={calendarTab}
                onCalendarTab={setCalendarTab}
                calendarSlots={calendarSlots}
                calendarEvents={calendarEvents}
                tasks={tasks}
                newTask={newTask}
                onNewTaskChange={setNewTask}
                onAddTask={addTask}
                onToggleTask={toggleTask}
                scratch={scratch}
                onScratchChange={setScratch}
              />
            ) : activeScreen === 'Notes' ? (
              <NotesScreen
                theme={theme}
                notes={notes}
                selected={editingNote}
                onSelect={setEditingNote}
                onNewNote={() => handleNewNote()}
                onContentChange={handleContentChange}
                onDelete={handleDeleteNote}
                onMoveNote={handleMoveNote}
                onDuplicateNote={handleDuplicateNote}
                onDeleteNote={handleDeleteNoteById}
              />
            ) : (
              <AgendaScreen
                theme={theme}
                isMobile={isMobile}
                calendarTab={calendarTab}
                onCalendarTab={setCalendarTab}
                calendarSlots={calendarSlots}
                calendarEvents={calendarEvents}
                tasks={tasks}
                newTask={newTask}
                onNewTaskChange={setNewTask}
                onAddTask={addTask}
                onToggleTask={toggleTask}
              />
            )}
          </View>

          {/* Capsule switcher — all screen sizes */}
          <View style={styles.capsuleWrap}>
            <CapsuleSwitcher theme={theme} active={activeScreen} onSelect={setActiveScreen} />
          </View>

          {/* FAB — all screen sizes */}
          <FloatingActionFab
            theme={theme}
            isOpen={isFabOpen}
            onToggle={() => setFabOpen((v) => !v)}
            actions={[
              { label: 'New Note', iconName: 'note-plus-outline', onPress: () => handleFabAction('note') },
              { label: 'New Task', iconName: 'checkbox-marked-circle-plus-outline', onPress: () => handleFabAction('task') },
              { label: 'New Event', iconName: 'calendar-plus', onPress: () => handleFabAction('event') },
            ]}
          />

          {/* Shared Move-To Modal */}
          <MoveToModal
            visible={moveTarget !== null}
            folders={folderTree}
            excludeId={moveTarget?.kind === 'folder' ? (moveTarget.id as string) : null}
            folderLabel={moveTarget?.label ?? null}
            onConfirm={handleMoveConfirm}
            onClose={() => setMoveTarget(null)}
            theme={theme}
          />

          {/* Shared Delete Confirmation */}
          <ConfirmDialog
            visible={deleteTarget !== null}
            title={`Delete "${deleteTarget?.label ?? 'item'}"?`}
            message={
              deleteTarget?.kind === 'folder'
                ? 'This folder and all its sub-folders will be deleted. Notes inside will also be removed.'
                : 'This note will be moved to your recently deleted list.'
            }
            confirmLabel="Delete"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
            theme={theme}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  layout: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  fill: { flex: 1 },
  mobileOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 5,
  },
  mobileSidebarWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 10,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 12, color: 'rgba(0,0,0,0.3)' }],
    elevation: 12,
  },
  // Collapse at every width. On mobile the wrapper is absolutely positioned,
  // so this also clips the floating rail. On wide screens the wrapper is a
  // flex child of the row: a negative offset would still reserve its 240px, so
  // width 0 is what actually hands the space back to the main column.
  sidebarCollapsed: { width: 0, overflow: 'hidden', borderRightWidth: 0 },
  capsuleWrap: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
    pointerEvents: 'box-none',
  },
});
