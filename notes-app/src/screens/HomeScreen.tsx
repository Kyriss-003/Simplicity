import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { THEMES, type ThemeName } from '../theme';
import { useNoteStore } from '../store/useNoteStore';
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
import { deriveTitle, greeting, todayLabel } from '../components/shared/utils';

const CALENDAR_SLOTS = ['8 am', '9 am', '10 am', '11 am', 'Noon', '1 pm', '2 pm'];
const NOTES_TABS = ['Recents', 'Suggested'] as const;
const CALENDAR_TABS = ['Today', 'Week', 'Month'] as const;

/* ------------------------------------------------------------------ */
/* Main screen — orchestrator only                                    */
/* ------------------------------------------------------------------ */

export default function HomeScreen() {
  const { notes, isLoading, getAllNotes, createNote, updateNote, softDeleteNote } = useNoteStore();
  const { width: winWidth } = useWindowDimensions();
  const isMobile = winWidth < 768;

  const [isSidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('Overview');
  const [themeName, setThemeName] = useState<ThemeName>('Dark');
  const theme = THEMES[themeName];

  const [notesTab, setNotesTab] = useState<string>('Recents');
  const [calendarTab, setCalendarTab] = useState<string>('Today');
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, label: 'Review pull requests', sourceNote: 'Engineering', done: false },
    { id: 2, label: 'Send weekly digest', sourceNote: 'Marketing', done: true },
  ]);
  const [newTask, setNewTask] = useState('');
  const [scratch, setScratch] = useState('');
  const [userName] = useState('User');
  const [events] = useState<CalendarEvent[]>([
    { title: 'Meeting with Jeremy', time: '10:00 AM', slotIndex: 2 },
  ]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isFabOpen, setFabOpen] = useState(false);

  // Auto-collapse sidebar on mobile breakpoint change
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
    else setSidebarOpen(true);
  }, [isMobile]);

  // Load notes on mount
  useEffect(() => {
    getAllNotes();
  }, [getAllNotes]);

  const dashboardNotes = useMemo(() => {
    if (notesTab === 'Suggested') return [...notes].sort(() => Math.random() - 0.5).slice(0, 8);
    return notes.slice(0, 8);
  }, [notes, notesTab]);

  /* ---- Note handlers ---- */
  const handleNewNote = async () => {
    const created = await createNote({ title: 'Untitled Note', content: '', tags: ['Notebook'] });
    if (created) {
      setEditingNote(created);
      setActiveScreen('Notes');
      setFabOpen(false);
    }
  };

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
    if (kind === 'note') handleNewNote();
    if (kind === 'task') {
      if (activeScreen !== 'Overview' && activeScreen !== 'Agenda') setActiveScreen('Overview');
      setFabOpen(false);
    }
    if (kind === 'event') {
      setActiveScreen('Agenda');
      setFabOpen(false);
    }
  };

  /* ---- Nav mapping ---- */
  let activeNav: 'Dashboard' | 'All Notes' | 'Calendar';
  if (activeScreen === 'Overview') activeNav = 'Dashboard';
  else if (activeScreen === 'Notes') activeNav = 'All Notes';
  else activeNav = 'Calendar';

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
            isSidebarOpen={isSidebarOpen || isMobile}
            activeNav={activeNav}
            themeName={themeName}
            onToggle={() => setSidebarOpen((v) => !v)}
            onSelectNav={(k) => {
              if (k === 'Dashboard') setActiveScreen('Overview');
              else if (k === 'All Notes') setActiveScreen('Notes');
              else if (k === 'Calendar') setActiveScreen('Agenda');
              else if (k === 'Tasks') setActiveScreen('Agenda');
              if (isMobile) setSidebarOpen(false);
            }}
            onSelectTheme={setThemeName}
          />
        </View>

        {/* Main */}
        <View style={styles.main}>
          {/* Top header */}
          <TopHeader
            theme={theme}
            isMobile={isMobile}
            userName={userName}
            greetingText={greeting()}
            dateText={todayLabel()}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            onNewNote={handleNewNote}
            onNewEvent={() => handleFabAction('event')}
            onNewTask={() => handleFabAction('task')}
          />

          {/* Screen content */}
          <View style={{ flex: 1 }}>
            {activeScreen === 'Overview' ? (
              <ScrollView
                style={styles.canvas}
                contentContainerStyle={{
                  padding: isMobile ? 14 : 20,
                  paddingBottom: 120,
                  gap: isMobile ? 14 : 20,
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
                  <CalendarTimeline theme={theme} slots={CALENDAR_SLOTS} events={events} />
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
                onNewNote={handleNewNote}
                onContentChange={handleContentChange}
                onDelete={handleDeleteNote}
              />
            ) : (
              /* Agenda: Calendar at top, tasks at bottom */
              <ScrollView
                style={styles.canvas}
                contentContainerStyle={{ padding: isMobile ? 14 : 20, paddingBottom: 120, gap: 20 }}
              >
                <View>
                  <SectionHeader
                    theme={theme}
                    title="Calendar"
                    tabs={CALENDAR_TABS}
                    activeTab={calendarTab}
                    onTab={setCalendarTab}
                  />
                  <CalendarTimeline theme={theme} slots={CALENDAR_SLOTS} events={events} />
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
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
    pointerEvents: 'box-none',
  },
});
