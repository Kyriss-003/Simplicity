import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { type Theme } from '../theme';
import type { CalendarEvent, Note, Task } from '../types';
import { SectionHeader } from '../components/shared/SectionHeader';
import { NotesCardRow } from '../components/cards/NotesCardRow';
import { CalendarTimeline } from '../components/cards/CalendarTimeline';
import { TasksCard } from '../components/cards/TasksCard';
import { ScratchPadCard } from '../components/cards/ScratchPadCard';

const NOTES_TABS = ['Recents', 'Suggested'] as const;
const CALENDAR_TABS = ['Today', 'Week', 'Month'] as const;

/** Dashboard: recent notes, calendar strip, and the tasks/scratch split. */
export function OverviewScreen({
  theme,
  isMobile,
  isLoading,
  notesTab,
  onNotesTab,
  dashboardNotes,
  onOpenNote,
  calendarTab,
  onCalendarTab,
  calendarSlots,
  calendarEvents,
  tasks,
  newTask,
  onNewTaskChange,
  onAddTask,
  onToggleTask,
  scratch,
  onScratchChange,
}: {
  theme: Theme;
  isMobile: boolean;
  isLoading: boolean;
  notesTab: string;
  onNotesTab: (t: string) => void;
  dashboardNotes: Note[];
  onOpenNote: (n: Note) => void;
  calendarTab: string;
  onCalendarTab: (t: string) => void;
  calendarSlots: string[];
  calendarEvents: CalendarEvent[];
  tasks: Task[];
  newTask: string;
  onNewTaskChange: (t: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: number) => void;
  scratch: string;
  onScratchChange: (t: string) => void;
}) {
  return (
    <ScrollView
      style={styles.canvas}
      contentContainerStyle={[styles.inner, isMobile && styles.innerMobile]}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      <View>
        <SectionHeader
          theme={theme}
          title="Notes"
          tabs={NOTES_TABS}
          activeTab={notesTab}
          onTab={onNotesTab}
        />
        <NotesCardRow notes={dashboardNotes} theme={theme} onOpenNote={onOpenNote} />
      </View>

      <View>
        <SectionHeader
          theme={theme}
          title="Calendar"
          tabs={CALENDAR_TABS}
          activeTab={calendarTab}
          onTab={onCalendarTab}
        />
        <CalendarTimeline theme={theme} slots={calendarSlots} events={calendarEvents} />
      </View>

      <View style={[styles.bottomSplit, isMobile && styles.bottomSplitMobile]}>
        <TasksCard
          theme={theme}
          tasks={tasks}
          newTask={newTask}
          onNewTaskChange={onNewTaskChange}
          onAddTask={onAddTask}
          onToggleTask={onToggleTask}
        />
        <ScratchPadCard theme={theme} value={scratch} onChangeText={onScratchChange} />
      </View>

      {isLoading ? (
        <Text style={[styles.loading, { color: theme.textMuted }]}>Loading…</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  inner: { padding: 24, paddingBottom: 120, gap: 24 },
  innerMobile: { padding: 16, paddingBottom: 120, gap: 16 },
  bottomSplit: { flexDirection: 'row', gap: 16 },
  bottomSplitMobile: { flexDirection: 'column' },
  loading: { textAlign: 'center', marginTop: 8 },
});
