import { useEffect, useState } from 'react';
import { Tag, X } from 'lucide-react';
import { Layout, Radius, Typography, type Theme } from '../theme';
import type {
  CalendarEvent,
  Folder,
  LayoutOrder,
  LayoutPrefs,
  Note,
  Task,
} from '../types';
import { SectionHeader } from '../components/shared/SectionHeader';
import { NotesCardRow, type NoteCardActions } from '../components/cards/NotesCardRow';
import { UpcomingEventsCard } from '../components/cards/UpcomingEventsCard';
import { TasksCard } from '../components/cards/TasksCard';
import { ScratchPadCard } from '../components/cards/ScratchPadCard';

const NOTES_TABS = ['Recents', 'Suggested'];

export interface TagCount {
  tag: string;
  count: number;
}

export function OverviewScreen({
  theme,
  isMobile,
  isLoading,
  layout,
  order,
  notesTab,
  onNotesTab,
  dashboardNotes,
  folders,
  onOpenNote,
  actions,
  availableTags = [],
  selectedTag = null,
  onSelectTag,
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
  dashboardNotes: Note[];
  folders: Folder[];
  onOpenNote: (n: Note) => void;
  actions: NoteCardActions;
  availableTags?: TagCount[];
  selectedTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
  upcomingEvents: CalendarEvent[];
  tasks: Task[];
  newTask: string;
  onNewTaskChange: (t: string) => void;
  onAddTask: () => void;
  onToggleTask: (id: number) => void;
  scratch: string;
  onScratchChange: (t: string) => void;
  onSaveScratch: () => void;
  showSectionTitles: boolean;
}) {
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isStacked = isMobile || windowWidth < 1200;
  const isPaired =
    order.indexOf('tasks') === order.indexOf('scratchPad') - 1 &&
    layout.tasks &&
    layout.scratchPad;

  const renderBlock = (section: LayoutOrder[number], isPrimary: boolean) => {
    if (section === 'tasks' && isPaired) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: isStacked ? 'column' : 'row',
            gap: 16,
            alignItems: 'stretch',
            width: '100%',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {showSectionTitles ? <SectionHeader theme={theme} title="Tasks" /> : null}
            <TasksCard
              theme={theme}
              primary={isPrimary}
              tasks={tasks}
              newTask={newTask}
              onNewTaskChange={onNewTaskChange}
              onAddTask={onAddTask}
              onToggleTask={onToggleTask}
              expanded={!showSectionTitles}
              style={{ flex: 1 }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {showSectionTitles ? <SectionHeader theme={theme} title="Scratch Pad" /> : null}
            <ScratchPadCard
              theme={theme}
              value={scratch}
              onChangeText={onScratchChange}
              onCreateNote={onSaveScratch}
              expanded={!showSectionTitles}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      );
    }

    if (section === 'scratchPad' && isPaired) return null;

    if (section === 'tasks') {
      return (
        <div>
          {showSectionTitles ? <SectionHeader theme={theme} title="Tasks" /> : null}
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
        </div>
      );
    }

    if (section === 'scratchPad') {
      return (
        <div>
          {showSectionTitles ? <SectionHeader theme={theme} title="Scratch Pad" /> : null}
          <ScratchPadCard
            theme={theme}
            primary={isPrimary}
            value={scratch}
            onChangeText={onScratchChange}
            onCreateNote={onSaveScratch}
            expanded={!showSectionTitles}
          />
        </div>
      );
    }

    if (section === 'notes') {
      return (
        <div>
          <div style={{ marginTop: 4 }}>
            <SectionHeader
              theme={theme}
              title={showSectionTitles ? 'Notes' : undefined}
              tabs={NOTES_TABS}
              activeTab={notesTab}
              onSelectTab={onNotesTab}
            />
            {availableTags.length > 0 ? (
              <div
                role="group"
                aria-label="Filter notes by label"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  overflowX: 'auto',
                  paddingBottom: 6,
                }}
              >
                <button
                  type="button"
                  aria-pressed={selectedTag === null}
                  onClick={() => onSelectTag?.(null)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: 28,
                    padding: '0 10px',
                    borderRadius: Radius.full,
                    border: `1px solid ${selectedTag === null ? theme.selectedFill : theme.border}`,
                    backgroundColor: selectedTag === null ? theme.selectedFill : theme.surface,
                    color: selectedTag === null ? theme.selectedText : theme.textMuted,
                    cursor: 'pointer',
                    flexShrink: 0,
                    ...Typography.app.captionStrong,
                  }}
                >
                  All
                </button>
                {availableTags.map(({ tag, count }) => {
                  const active = selectedTag?.toLowerCase() === tag.toLowerCase();
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelectTag?.(active ? null : tag)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        height: 28,
                        padding: '0 10px',
                        borderRadius: Radius.full,
                        border: `1px solid ${active ? theme.accent : theme.border}`,
                        backgroundColor: active ? theme.accent : theme.surface,
                        color: active ? theme.accentText : theme.text,
                        cursor: 'pointer',
                        flexShrink: 0,
                        ...Typography.app.captionStrong,
                      }}
                    >
                      <Tag size={11} color={active ? theme.accentText : theme.accent} />
                      <span>{tag}</span>
                      <span
                        style={{
                          opacity: 0.75,
                          ...Typography.app.caption,
                        }}
                      >
                        {count}
                      </span>
                      {active ? <X size={11} /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <NotesCardRow
            notes={dashboardNotes}
            folders={folders}
            theme={theme}
            primary={isPrimary}
            onOpenNote={onOpenNote}
            actions={actions}
            expanded={!showSectionTitles}
            selectedTag={selectedTag}
            onSelectTag={onSelectTag}
          />
        </div>
      );
    }

    return (
      <div>
        {showSectionTitles ? <SectionHeader theme={theme} title="Upcoming" /> : null}
        <UpcomingEventsCard
          theme={theme}
          primary={isPrimary}
          events={upcomingEvents}
          expanded={!showSectionTitles}
        />
      </div>
    );
  };

  const visible = order.filter((section) => layout[section]);
  const primarySection = visible.find((section) => !(section === 'scratchPad' && isPaired));

  const blocks = visible
    .map((section) => ({
      section,
      node: renderBlock(section, section === primarySection),
    }))
    .filter((block) => block.node !== null);

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div
        style={{
          width: '100%',
          maxWidth: Layout.contentMaxWidth,
          margin: '0 auto',
          padding: '16px 16px 120px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {blocks.map(({ section, node }) => (
          <div key={section}>{node}</div>
        ))}

        {isLoading ? (
          <div style={{ textAlign: 'center', color: theme.textMuted, marginTop: 8 }}>Loading…</div>
        ) : null}
      </div>
    </div>
  );
}
