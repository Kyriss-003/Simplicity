import { ScrollView, View, StyleSheet } from 'react-native';
import { type Theme } from '../theme';
import type { CalendarEvent, Task } from '../types';
import { SectionHeader } from '../components/shared/SectionHeader';
import { CalendarTimeline } from '../components/cards/CalendarTimeline';
import { TasksCard } from '../components/cards/TasksCard';

const CALENDAR_TABS = ['Today', 'Week', 'Month'] as const;

/** Agenda: full calendar strip with the task list beneath it. */
export function AgendaScreen({
  theme,
  isMobile,
  calendarTab,
  onCalendarTab,
  calendarSlots,
  calendarEvents,
  tasks,
  newTask,
  onNewTaskChange,
  onAddTask,
  onToggleTask,
}: {
  theme: Theme;
  isMobile: boolean;
  calendarTab: string;
  onCalendarTab: (t: string) => void;
  calendarSlots: string[];
  calendarEvents: CalendarEvent[];
  tasks: Task[];
  newTask: string;
  onNewTaskChange: (t: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: number) => void;
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
          title="Calendar"
          tabs={CALENDAR_TABS}
          activeTab={calendarTab}
          onTab={onCalendarTab}
        />
        <CalendarTimeline theme={theme} slots={calendarSlots} events={calendarEvents} />
      </View>
      <TasksCard
        theme={theme}
        tasks={tasks}
        newTask={newTask}
        onNewTaskChange={onNewTaskChange}
        onAddTask={onAddTask}
        onToggleTask={onToggleTask}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  inner: { padding: 24, paddingBottom: 120, gap: 24 },
  innerMobile: { padding: 16, paddingBottom: 120, gap: 16 },
});
