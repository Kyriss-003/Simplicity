import { ActivityIndicator, ScrollView, Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import { useState } from 'react';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '../components/shared/icons';
import { AnimatedPressable } from '../components/shared/motion';
import { Layout, type Theme } from '../theme';
import type { ViewStyle } from 'react-native';
import type {
  CalendarEvent,
  Folder,
  LayoutOrder,
  LayoutPrefs,
  Note,
  Task,
} from '../types';
import { SectionHeader } from '../components/shared/SectionHeader';
import { DashboardSection } from '../components/shared/motion';
import { NotesCardRow, type NoteCardActions } from '../components/cards/NotesCardRow';
import { UpcomingEventsCard } from '../components/cards/UpcomingEventsCard';
import { TasksCard } from '../components/cards/TasksCard';
import { ScratchPadCard } from '../components/cards/ScratchPadCard';

const NOTES_TABS = ['Recents', 'Suggested'] as const;

/**
 * Dashboard: recent notes, calendar strip, and the tasks/scratch split.
 *
 * Every block is gated on `layout` and placed by `order`, both persisted
 * settings. Gating happens here rather than in the orchestrator so the dashboard
 * owns its own composition, and so a hidden block unmounts (and stops rendering
 * its calendar and tasks entirely) instead of being hidden with a zero-size style.
 */
export function OverviewScreen({
  theme,
  isMobile,
  isLoading,
  layout,
  order,
  notesTab,
  onNotesTab,
  onRefresh,
  dashboardNotes,
  folders,
  onOpenNote,
  actions,
  upcomingEvents,
  tasks,
  newTask,
  onNewTaskChange,
  onAddTask,
  onToggleTask,
  scratch,
  onScratchChange,
  onSaveScratch,
  showSectionTitles,
}: {
  theme: Theme;
  isMobile: boolean;
  isLoading: boolean;
  layout: LayoutPrefs;
  order: LayoutOrder;
  notesTab: string;
  onNotesTab: (t: string) => void;
  onRefresh: () => void;
  dashboardNotes: Note[];
  /** Labels each note card with the folder it is filed under. */
  folders: Folder[];
  onOpenNote: (n: Note) => void;
  /** Note-card context-menu actions, owned by the orchestrator. */
  actions: NoteCardActions;
  /** Every event, unfiltered — the card picks the next few and pins them first. */
  upcomingEvents: CalendarEvent[];
  tasks: Task[];
  newTask: string;
  onNewTaskChange: (t: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: number) => void;
  scratch: string;
  onScratchChange: (t: string) => void;
  /** Open the folder picker for turning the pad into a note. */
  onSaveScratch: () => void;
  /** Show the heading above each section. Off: the cards expand. */
  showSectionTitles: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const isStacked = isMobile || windowWidth < 1200;
  /**
   * Tasks and Scratch Pad share a row, but only when they are *adjacent* in the
   * user's order and both are visible. Separating them with another block is a
   * deliberate act, and silently re-pairing them across it would undo the
   * reorder. When only one of them survives, it takes the full width — a lone
   * card stretched to half reads as a layout bug rather than a deliberate column.
   */
  const isPaired =
    order.indexOf('tasks') === order.indexOf('scratchPad') - 1 &&
    layout.tasks &&
    layout.scratchPad;

  /**
   * Flex on the two bottom cards is applied *by the split row*, never by the
   * cards themselves.
   *
   * A card carrying `flex: 1` collapses to zero height the moment the split
   * becomes a column — which is what happens at iPad-mini width. `flexBasis`
   * applies to the *main* axis, and a content-sized column has no free space to
   * distribute, so both cards got 0px of height and their contents overflowed
   * straight through each other. In the row, `flexBasis` divides width, which is
   * exactly what is wanted, and `alignItems: 'stretch'` covers the height.
   *
   * Unpaired, the card is a plain block child and needs no flex at all.
   */
  const pairStyle: ViewStyle | undefined = isPaired
    ? isStacked
      ? { alignSelf: 'stretch' }
      : { flex: 1, minWidth: 0 }
    : undefined;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshRotation = useSharedValue(0);
  const refreshIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${refreshRotation.value}deg` }],
  }));
  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    refreshRotation.value = 0;
    refreshRotation.value = withRepeat(
      withTiming(360, { duration: 800, easing: Easing.linear }),
      -1,
      false,
    );
    try {
      await Promise.all([
        onRefresh(),
        new Promise<void>((resolve) => setTimeout(resolve, 700)),
      ]);
    } finally {
      cancelAnimation(refreshRotation);
      refreshRotation.value = 0;
      setIsRefreshing(false);
    }
  };

  const renderBlock = (section: LayoutOrder[number], isPrimary: boolean) => {
    if (section === 'tasks' && isPaired) {
      return (
        <View style={[styles.split, isStacked && styles.splitMobile]}>
          {/* Two cards, so two titles — one above the pair would leave the
              second card unlabelled. Each column carries its own heading, so
              every section on the page is titled the same way. */}
          <View style={[styles.pairCol, isStacked && styles.pairColMobile]}>
            <SectionHeader theme={theme} title="Tasks" hidden={!showSectionTitles} />
            <TasksCard
              theme={theme}
              primary={isPrimary}
              tasks={tasks}
              newTask={newTask}
              onNewTaskChange={onNewTaskChange}
              onAddTask={onAddTask}
              onToggleTask={onToggleTask}
              expanded={!showSectionTitles}
              style={pairStyle}
            />
          </View>
          <View style={[styles.pairCol, isStacked && styles.pairColMobile]}>
            <SectionHeader theme={theme} title="Scratch Pad" hidden={!showSectionTitles} />
            <ScratchPadCard
              theme={theme}
              value={scratch}
              onChangeText={onScratchChange}
              onCreateNote={onSaveScratch}
              expanded={!showSectionTitles}
              style={pairStyle}
            />
          </View>
        </View>
      );
    }
    // Emitted together with tasks above; a second row would duplicate both cards.
    if (section === 'scratchPad' && isPaired) return null;

    if (section === 'tasks') {
      return (
        <DashboardSection>
          {/* Title above the card, like every other section. It used to sit
              *within* the card, so the page carried two different title
              positions and a reader had to learn which was which. The '+' stays
              on the card: its open/closed state belongs to the list, not to the
              heading. */}
          <SectionHeader theme={theme} title="Tasks" hidden={!showSectionTitles} />
          <TasksCard
          theme={theme}
          primary={isPrimary}
          tasks={tasks}
          newTask={newTask}
          onNewTaskChange={onNewTaskChange}
          onAddTask={onAddTask}
          onToggleTask={onToggleTask}
          expanded={!showSectionTitles}
        />
        </DashboardSection>
      );
    }
    if (section === 'scratchPad') {
      return (
        <DashboardSection>
          {/* Same reasoning as Tasks above: the title moves out so every
              section on the page is titled the same way. The character count
              stays on the card, right-aligned. */}
          <SectionHeader theme={theme} title="Scratch Pad" hidden={!showSectionTitles} />
          <ScratchPadCard
          theme={theme}
          primary={isPrimary}
          value={scratch}
          onChangeText={onScratchChange}
          onCreateNote={onSaveScratch}
          expanded={!showSectionTitles}
        />
        </DashboardSection>
      );
    }
    if (section === 'notes') {
      return (
        <DashboardSection>
          {/* marginTop pushes the tab row clear of the section above it —
              the row was overlapping the scratch pad card. */}
          <View style={{ marginTop: 8 }}>
            <SectionHeader
              theme={theme}
              title="Notes"
              tabs={NOTES_TABS}
              activeTab={notesTab}
              onTab={onNotesTab}
              hidden={!showSectionTitles}
            />
          </View>
          <NotesCardRow
            notes={dashboardNotes}
            folders={folders}
            theme={theme}
            primary={isPrimary}
            onOpenNote={onOpenNote}
            actions={actions}
            expanded={!showSectionTitles}
          />
        </DashboardSection>
      );
    }
    return (
      <DashboardSection>
        {/*
          No tabs. `Today / Week / Month` only ever switched the *timeline's*
          slot geometry, and there is no timeline here — leaving them would have
          been three controls that all render the same list.
        */}
        <SectionHeader theme={theme} title="Upcoming" hidden={!showSectionTitles} />
        <UpcomingEventsCard theme={theme} primary={isPrimary} events={upcomingEvents} expanded={!showSectionTitles} />
      </DashboardSection>
    );
  };

  /**
   * The first card on the page is the primary one — the single card that carries
   * `B&W`'s black, and therefore the page's focal point.
   *
   * Computed from the *visible* order, not a hardcoded section, so it follows
   * the user's drag-reorder and respects anything they have hidden. Note that
   * `scratchPad` folds into the row above it when paired, so the first block can
   * be a two-card row: only `tasks` is eligible then, and a paired row's black
   * would be two cards rather than one.
   */
  const visible = order.filter((section) => layout[section]);
  const primarySection = visible.find(
    (section) => !(section === 'scratchPad' && isPaired)
  );

  // Filtered rather than mapped-and-wrapped: a section that folds into a paired
  // row returns null, and a null block still occupied a slot in the gap layout.
  const blocks = visible
    .map((section) => ({
      section,
      node: renderBlock(section, section === primarySection),
    }))
    .filter((block) => block.node !== null);

  return (
    <ScrollView
      style={styles.canvas}
      contentContainerStyle={styles.inner}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      <View style={styles.refreshRow}>
        <AnimatedPressable
          onPress={() => void refresh()}
          disabled={isRefreshing}
          accessibilityRole="button"
          accessibilityLabel={isRefreshing ? 'Refreshing overview' : 'Refresh overview'}
          accessibilityState={{ busy: isRefreshing, disabled: isRefreshing }}
          style={[styles.refreshButton, { borderColor: theme.border, backgroundColor: theme.pillBg }]}
        >
          <View style={styles.refreshContent}>
            <Animated.View style={refreshIconStyle}>
              <MaterialCommunityIcons name="refresh" size={16} color={theme.text} />
            </Animated.View>
            <Text style={{ color: theme.text }}>{isRefreshing ? 'Refreshing…' : 'Refresh'}</Text>
          </View>
        </AnimatedPressable>
      </View>
      {isRefreshing ? (
        <View
          style={[styles.refreshStatus, { backgroundColor: theme.surface, borderColor: theme.border }]}
          accessibilityRole="progressbar"
          accessibilityLabel="Refreshing overview"
        >
          <ActivityIndicator color={theme.accent} />
          <Text style={{ color: theme.text }}>Refreshing your overview…</Text>
        </View>
      ) : null}
      {blocks.map(({ section, node }) => (
        <View key={section}>{node}</View>
      ))}

      {isLoading ? (
        <Text style={[styles.loading, { color: theme.textMuted }]}>Loading…</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  /**
   * 16px rather than 24: the dashboard reads as a wall of half-empty cards at
   * 24, and the density target is "everything legible in one screen".
   *
   * `maxWidth` + `alignSelf: 'center'` is what makes a wide window compose
   * rather than stretch. `width: '100%'` is required alongside it — a cap alone
   * leaves the width undefined, and the `flex: 1` split row below would collapse
   * to its minimum content size.
   */
  inner: {
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    alignSelf: 'center',
    padding: 16,
    paddingBottom: 120,
    gap: 16,
  },
  // `alignItems: 'stretch'` is explicit: the two cards must share a top and
  // bottom edge, and a basis difference between them shows as a seam.
  split: { flexDirection: 'row', gap: 16, alignItems: 'stretch', width: '100%' },
  /** One card in the pair: its heading plus the card itself. */
  pairCol: { flex: 1, minWidth: 0, gap: 12 },
  pairColMobile: { flexGrow: 0, flexBasis: 'auto' },
  splitMobile: { flexDirection: 'column' },
  loading: { textAlign: 'center', marginTop: 8 },
  refreshRow: { alignItems: 'flex-end' },
  refreshStatus: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  refreshContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshButton: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
});
