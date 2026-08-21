import { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { THEMES, type ThemeName } from '../theme';
import { useNoteStore } from '../store/useNoteStore';
import { ROOT_FOLDER_ID } from '../db/FolderRepository';
import type { Note } from '../db/NoteRepository';

import Sidebar from '../components/Sidebar';
import { TopHeader } from '../components/TopHeader';
import { CapsuleSwitcher, type ScreenKey } from '../components/CapsuleSwitcher';
import { FloatingActionFab } from '../components/FloatingActionFab';
import { SectionHeader } from '../components/shared/SectionHeader';
import { NotesCardRow } from '../components/cards/NotesCardRow';
import { CalendarTimeline, type CalendarEvent } from '../components/cards/CalendarTimeline';
import { TasksCard, type Task } from '../components/cards/TasksCard';
import { ScratchPadCard } from '../components/cards/ScratchPadCard';
import { NotesView } from '../components/notes/NotesView';
import { MoveToModal } from '../components/shared/MoveToModal';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { deriveTitle, greeting, todayLabel } from '../components/shared/utils';
import { buildFolderTree } from '../hooks/useFolderTree';
import type { FolderNode } from '../hooks/useFolderTree';

const CALENDAR_SLOTS = ['8 am', '9 am', '10 am', '11 am', 'Noon', '1 pm', '2 pm'];
const NOTES_TABS = ['Recents', 'Suggested'] as const;
const CALENDAR_TABS = ['Today', 'Week', 'Month'] as const;

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
  const isMobile = winWidth < 768;

  const [isSidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('Overview');
  const [themeName, setThemeName] = useState<ThemeName>('Dark');
  const theme = THEMES[themeName];

  const [notesTab, setNotesTab] = useState<string>('Recents');
  const [calendarTab, setCalendarTab] = useState<string>('Today');
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  /* ---- Calendar data driven by the active tab ---- */
  const calendarSlots = useMemo(() => {
    if (calendarTab === 'Today') return ['8 am', '9 am', '10 am', '11 am', 'Noon', '1 pm', '2 pm'];
    if (calendarTab === 'Week') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];
  }, [calendarTab]);

  const calendarEvents = useMemo(() => {
    if (calendarTab === 'Today') return events;
    if (calendarTab === 'Week') {
      return events.filter((ev) => {
        const d = new Date(ev.time);
        const day = d.getDay();
        return day >= 1 && day <= 5;
      });
    }
    // Month: spread events across 4 week slots by day-of-month
    return events.map((ev) => ({
      ...ev,
      slotIndex: Math.min(3, Math.floor(new Date(ev.time).getDate() / 7)),
    }));
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

  const handleContentChange = (text: string) => {
    if (!editingNote) return;
    const derived = deriveTitle(text);
    const nextTitle = derived || 'Untitled Note';
    const next: Note = { ...editingNote, content: text, title: nextTitle };
    setEditingNote(next);
    updateNote(editingNote.id, { content: text, title: nextTitle });
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
  const addTask = () => {
    const label = newTask.trim();
    if (!label) return;
    setTasks((t) => [...t, { id: Date.now(), label, sourceNote: 'General', done: false }]);
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
          style={
            isMobile ? [styles.mobileSidebarWrap, !isSidebarOpen && styles.mobileSidebarHidden] : undefined
          }
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
          <View style={{ flex: 1 }}>
            {activeScreen === 'Overview' ? (
              <ScrollView
                style={styles.canvas}
                contentContainerStyle={{
                  padding: isMobile ? 16 : 24,
                  paddingBottom: 120,
                  gap: isMobile ? 16 : 24,
                }}
              >
                {/* Section 1: Notes */}
                <View>
                  <SectionHeader
                    theme={theme}
                    title="Notes"
                    tabs={NOTES_TABS}
                    activeTab={notesTab}
                    onTab={setNotesTab}
                  />
                  <NotesCardRow notes={dashboardNotes} theme={theme} onOpenNote={handleOpenNote} />
                </View>

                {/* Section 2: Calendar */}
                <View>
                  <SectionHeader
                    theme={theme}
                    title="Calendar"
                    tabs={CALENDAR_TABS}
                    activeTab={calendarTab}
                    onTab={setCalendarTab}
                  />
                  <CalendarTimeline theme={theme} slots={calendarSlots} events={events} />
                </View>

                {/* Section 3: Bottom split — stacks on mobile */}
                <View style={[styles.bottomSplit, isMobile && styles.bottomSplitMobile]}>
                  <TasksCard
                    theme={theme}
                    tasks={tasks}
                    newTask={newTask}
                    onNewTaskChange={setNewTask}
                    onAddTask={addTask}
                    onToggleTask={toggleTask}
                  />
                  <ScratchPadCard theme={theme} value={scratch} onChangeText={setScratch} />
                </View>

                {isLoading ? (
                  <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 8 }}>
                    Loading…
                  </Text>
                ) : null}
              </ScrollView>
            ) : activeScreen === 'Notes' ? (
              <NotesView
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
              /* Agenda: Calendar at top, tasks at bottom */
              <ScrollView
                style={styles.canvas}
                contentContainerStyle={{ padding: isMobile ? 16 : 24, paddingBottom: 120, gap: 24 }}
              >
                <View>
                  <SectionHeader
                    theme={theme}
                    title="Calendar"
                    tabs={CALENDAR_TABS}
                    activeTab={calendarTab}
                    onTab={setCalendarTab}
                  />
                  <CalendarTimeline theme={theme} slots={calendarSlots} events={events} />
                </View>
                <TasksCard
                  theme={theme}
                  tasks={tasks}
                  newTask={newTask}
                  onNewTaskChange={setNewTask}
                  onAddTask={addTask}
                  onToggleTask={toggleTask}
                />
              </ScrollView>
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
                : 'This note will be permanently deleted.'
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
  mobileSidebarHidden: { left: -260, opacity: 0 },
  canvas: { flex: 1 },
  bottomSplit: { flexDirection: 'row', gap: 16 },
  bottomSplitMobile: { flexDirection: 'column' },
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
