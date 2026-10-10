import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable, Platform } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Layout, Motion, THEMES, withAccent } from '../theme';
import { useNoteStore } from '../store/useNoteStore';
import { useEventStore } from '../store/useEventStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { ROOT_FOLDER_ID } from '../db/FolderRepository';
import type { Event, FolderNode, Note, ScreenKey, Task } from '../types';

import Sidebar from '../components/Sidebar';
import { TopHeader } from '../components/TopHeader';
import { CapsuleSwitcher } from '../components/CapsuleSwitcher';
import { FloatingActionFab } from '../components/FloatingActionFab';
import { MoveToModal } from '../components/shared/MoveToModal';
import { SaveScratchDialog } from '../components/cards/SaveScratchDialog';
import {
  EventEditorDialog,
  type EventDraft,
} from '../components/calendar/EventEditorDialog';
import type { ContextMenuAction } from '../components/shared/ContextMenu';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import { ScreenTransition } from '../components/shared/motion';
import {
  SEARCH_RESULT_LIMIT,
  type SearchResult,
} from '../components/shared/SidebarSearch';
import {
  copyToClipboard,
  deriveTitle,
  greeting,
  previewLines,
} from '../components/shared/utils';
import { buildFolderTree } from '../hooks/useFolderTree';
import { nextFreeSlot, toCalendarEvent } from '../components/calendar/calendarUtils';
import { useDebouncedPersist } from '../hooks/useDebouncedPersist';
import { OverviewScreen } from './OverviewScreen';
import { CustomizeOverview } from '../components/overview/CustomizeOverview';
import { NotesScreen } from './NotesScreen';
import type { NoteTab } from '../components/notes/NoteTabs';
import { AgendaScreen } from './AgendaScreen';
import { SettingsScreen, type SettingsScreenHandle } from './SettingsScreen';

/** Must match `styles.sidebar.width` in the Sidebar — the slide animates to it. */
const SIDEBAR_WIDTH = 240;

/* ------------------------------------------------------------------ */
/* Main screen — orchestrator only                                    */
/* ------------------------------------------------------------------ */

export default function HomeScreen() {
  /**
   * Note data is subscribed to field by field, and the actions are read off the
   * store directly.
   *
   * `useNoteStore()` with no selector subscribes to the whole state object, so
   * *any* store write — every `isLoading` flip included, twice per operation —
   * re-renders the entire app tree. Per-field selectors mean a write only
   * re-renders the shell when the field it actually changed is one the shell
   * reads. Actions are defined once and never replaced, so `getState()` gives
   * stable references and keeps the `useCallback` dependency lists honest.
   */
  const notes = useNoteStore((s) => s.notes);
  const folders = useNoteStore((s) => s.folders);
  const isLoading = useNoteStore((s) => s.isLoading);
  const selectedFolderId = useNoteStore((s) => s.selectedFolderId);
  const noteCounts = useNoteStore((s) => s.noteCounts);
  // Events are their own store — see `useEventStore` for why they are not
  // folded into the note store. Subscribed field by field like everything else.
  const events = useEventStore((s) => s.events);

  const {
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
  } = useNoteStore.getState();

  const { initialize: initializeEvents, createEvent, updateEvent, softDeleteEvent } =
    useEventStore.getState();

  const { width: winWidth } = useWindowDimensions();
  const isMobile = winWidth < Layout.breakpoints.tablet;

  const [isSidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [activeScreen, setActiveScreen] = useState<ScreenKey>('Overview');
  /** The Overview's own layout panel — see the page menu's one job. */
  const [customizeOpen, setCustomizeOpen] = useState(false);
  /** Settings brings its own section rail, so the main sidebar stands down. */
  const isSettings = activeScreen === 'Settings';
  /**
   * Lets the header's back chevron pop Settings' own drill-down level before it
   * leaves the screen. The section state stays inside `SettingsScreen`; the
   * shell only asks whether there was anywhere to go back to.
   */
  const settingsRef = useRef<SettingsScreenHandle>(null);

  // Theme, accent and dashboard layout are persisted preferences, not view state.
  const themeName = usePrefsStore((s) => s.themeName);
  const setThemeName = usePrefsStore((s) => s.setThemeName);
  const accentName = usePrefsStore((s) => s.accent);
  const setAccentName = usePrefsStore((s) => s.setAccent);
  const layout = usePrefsStore((s) => s.layout);
  const sectionOrder = usePrefsStore((s) => s.order);
  const sidebarWidth = usePrefsStore((s) => s.sidebarWidth);
  const dockPosition = usePrefsStore((s) => s.dockPosition);
  const dockVariant = usePrefsStore((s) => s.dockVariant);
  const setSidebarWidth = usePrefsStore((s) => s.setSidebarWidth);
  const commitSidebarWidth = usePrefsStore((s) => s.commitSidebarWidth);
  // The Notes screen's list pane is the second draggable edge in the shell, so
  // it is the same preference shape as the sidebar's width rather than local
  // state — a pane that snapped back on every screen change would read as the
  // drag not having worked.
  const listWidth = usePrefsStore((s) => s.listWidth);
  const setListWidth = usePrefsStore((s) => s.setListWidth);
  const commitListWidth = usePrefsStore((s) => s.commitListWidth);
  const setDockPosition = usePrefsStore((s) => s.setDockPosition);
  const setDockVariant = usePrefsStore((s) => s.setDockVariant);
  const fabVariant = usePrefsStore((s) => s.fabVariant);
  const setFabVariant = usePrefsStore((s) => s.setFabVariant);
  const toggleSection = usePrefsStore((s) => s.toggleSection);
  const reorderSections = usePrefsStore((s) => s.reorderSections);
  const resetLayout = usePrefsStore((s) => s.resetLayout);
  const showSectionTitles = usePrefsStore((s) => s.showSectionTitles);
  const setShowSectionTitles = usePrefsStore((s) => s.setShowSectionTitles);
  const confirmDelete = usePrefsStore((s) => s.confirmDelete);
  const openNewNote = usePrefsStore((s) => s.openNewNote);
  const setBehaviour = usePrefsStore((s) => s.setBehaviour);
  const initializePrefs = usePrefsStore((s) => s.initialize);
  // The accent is a separate axis from the canvas, so it is applied on top of
  // the resolved theme rather than baked into one of them.
  const theme = withAccent(THEMES[themeName], accentName);

  // Keep the web focus ring in the current accent. The CSS in `App.tsx` reads
  // `--app-accent`; a CSS custom property is the one piece of theme that has to
  // reach outside the React tree, because the rule lives in an injected
  // <style>, not a component.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--app-accent', theme.accent);
  }, [theme.accent]);

  /**
   * One shared value drives the whole rail: the wrapper's width (desktop) or
   * offset (mobile), the content's parallax, and the scrim's opacity. Animating
   * width is what makes the main column genuinely re-flow instead of jumping,
   * and sharing the value is what keeps those three in lockstep.
   */
  const sidebarProgress = useSharedValue(isSidebarOpen ? 1 : 0);
  useEffect(() => {
    sidebarProgress.value = withSpring(isSidebarOpen ? 1 : 0, Motion.spring.gentle);
  }, [isSidebarOpen, sidebarProgress]);

  const sidebarStyle = useAnimatedStyle(
    () => ({
      width: isMobile ? SIDEBAR_WIDTH : interpolate(sidebarProgress.value, [0, 1], [0, sidebarWidth]),
      opacity: sidebarProgress.value,
      transform: [
        {
          translateX: isMobile
            ? interpolate(sidebarProgress.value, [0, 1], [-SIDEBAR_WIDTH, 0])
            : interpolate(
                sidebarProgress.value,
                [0, 1],
                [-Motion.sidebarContentShift, 0]
              ),
        },
      ],
    }),
    [isMobile, sidebarProgress, sidebarWidth]
  );

  const scrimStyle = useAnimatedStyle(() => ({ opacity: sidebarProgress.value }), []);

  const [notesTab, setNotesTab] = useState<string>('Recents');
  const [searchQuery, setSearchQuery] = useState('');
  /**
   * Owned here, not in `NotesView`: the collapse control lives in `TopHeader`,
   * which is this screen's only top bar. `NotesView` only renders the pane.
   */
  const [notesListCollapsed, setNotesListCollapsed] = useState(false);
  /**
   * Which Notes pane a phone is showing — the notebook, or one note's typing
   * space.
   *
   * It lives in the shell for the same reason as the collapse flag above: the
   * back chevron that returns to the notebook is a header control, so the header
   * has to know whether there is anywhere to go back to. Desktop ignores it
   * entirely and keeps both panes up.
   */
  const [notesEditorOpen, setNotesEditorOpen] = useState(false);

  /**
   * Which day the Agenda is showing — and, by extension, which month.
   *
   * This lives here rather than inside `AgendaScreen` because the FAB's
   * "New Event" has to drive it: creating an event from the Overview and
   * landing on a month you were already browsing would hide the thing you just
   * made. Lift-and-pass is the price of that, and it is the same trade the
   * Notes list collapse makes for its header control.
   */
  const [agendaAnchor, setAgendaAnchor] = useState<Date>(() => new Date());

  /**
   * The scratch pad turned into a real note.
   *
   * A note needs a folder and the pad has none, so the destination is a choice
   * the user makes rather than a default this screen picks for them — a note
   * filed in Main because nobody asked is a note in the wrong place that they
   * then have to find and move.
   */
  const [saveScratchOpen, setSaveScratchOpen] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, label: 'Review pull requests', sourceNote: 'Engineering', done: false },
    { id: 2, label: 'Send weekly digest', sourceNote: 'Marketing', done: true },
  ]);
  const [newTask, setNewTask] = useState('');
  const [scratch, setScratch] = useState('');
  const [userName] = useState('User');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  /**
   * The notes held open in the editor, in the order they were opened.
   *
   * Ids rather than notes: the note bodies live in the store and are edited on
   * every keystroke, so copying a note into a tab would hold a second, staler
   * copy of the same thing. What the tab needs to show is the *title*, and that
   * is read back from the store each render — so a note renamed by typing its
   * first line updates its tab without this list knowing.
   *
   * Session state, not persisted: open tabs are a working arrangement, and
   * restoring yesterday's five tabs would put back the two the user closed.
   */
  const [openNoteIds, setOpenNoteIds] = useState<number[]>([]);

  /**
   * Opening a note holds it open *in addition to* what is already open.
   *
   * Selecting from the list used to replace the editor's contents outright, so
   * there was no way to have two notes open at once and no way back to the first
   * except re-finding it in the list.
   */
  const focusNote = useCallback((note: Note) => {
    setEditingNote(note);
    setOpenNoteIds((ids) => (ids.includes(note.id) ? ids : [...ids, note.id]));
  }, []);

  /**
   * Closing a tab focuses its neighbour, never nothing.
   *
   * Obsidian's behaviour: the tab you just closed is not where your attention
   * should land, but an empty editor *is* — and there were five other notes
   * open. The neighbour is the one before it, because a close is usually read
   * left-to-right; when the closed tab was first, the next one takes over.
   */
  const closeNoteTab = useCallback((id: number) => {
    setOpenNoteIds((ids) => {
      const index = ids.indexOf(id);
      if (index === -1) return ids;
      const next = ids.filter((n) => n !== id);
      // Only retarget if the closed tab was the one on screen. A background
      // tab's close must not steal the editor.
      setEditingNote((current) =>
        current?.id === id ? notesStoreTarget(next, index) : current
      );
      return next;
    });
  }, []);

  /**
   * The note to show after closing tab `index`, from what is left.
   *
   * Read off the store inside the state updater, so it sees the list *without*
   * the closed id rather than closing over stale ids.
   */
  function notesStoreTarget(remaining: number[], closedIndex: number): Note | null {
    if (remaining.length === 0) return null;
    const neighbour = remaining[Math.max(0, Math.min(closedIndex - 1, remaining.length - 1))];
    const note = notes.find((n) => n.id === neighbour);
    return note ?? null;
  }

  /**
   * The tab strip, resolved against the store so a renamed note's tab follows it.
   *
   * `notes` is the currently loaded folder, so a tab can be for a note that is
   * not in it any more (the folder was switched after the tab was opened). Those
   * keep the title they were opened with rather than vanishing — a tab that
   * disappears because you changed folders would be losing your place.
   */
  const noteTabs = useMemo<NoteTab[]>(
    () =>
      openNoteIds.map((id) => ({
        id,
        title: notes.find((n) => n.id === id)?.title ?? editingNote?.title ?? 'Untitled Note',
      })),
    [openNoteIds, notes, editingNote?.title]
  );

  /**
     * The active folder's name, for the list pane's heading.
     *
     * Resolved from the folder list rather than stored: the folder can be renamed
     * from the sidebar, and a heading holding its own copy would keep printing
     * yesterday's name.
     */
    const folderLabel = useMemo(
      () => folders.find((f) => f.id === selectedFolderId)?.label ?? 'Notes',
      [folders, selectedFolderId]
    );

    /**
     * Step one tab along the strip.
     *
     * Wraps at neither end — `NotesView` disables the button there — so this only
     * ever moves to a tab that exists. A no-op would leave a *looking* enabled
     * button that did nothing, which is worse than one that is plainly off.
     */
    const stepNoteTab = useCallback(
      (direction: -1 | 1) => {
        if (!editingNote) return;
        const index = openNoteIds.indexOf(editingNote.id);
        if (index === -1) return;
        const next = openNoteIds[index + direction];
        if (next === undefined) return;
        const note = notes.find((n) => n.id === next);
        if (note) setEditingNote(note);
      },
      [editingNote, openNoteIds, notes]
    );

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

  // Initialize (folders + notes + preferences + events) on mount
  useEffect(() => {
    initialize();
    refreshNoteCounts();
    initializePrefs();
    initializeEvents();
  }, [initialize, refreshNoteCounts, initializePrefs, initializeEvents]);

  const refreshOverview = useCallback(async () => {
    await Promise.all([
      initialize(),
      refreshNoteCounts(),
      initializePrefs(),
      initializeEvents(),
    ]);
  }, [initialize, refreshNoteCounts, initializePrefs, initializeEvents]);

  const folderTree: FolderNode[] = useMemo(() => buildFolderTree(folders), [folders]);

  /**
   * Sidebar search results, folders first then notes.
   *
   * Folders lead because they are fewer, and because a folder is the broader
   * target — a user typing "wor" is more likely heading for the Work folder
   * than for a note whose title happens to contain it.
   *
   * Searches the notes currently loaded, which are scoped to the active folder
   * (`NoteRepository.getAllNotes(selectedFolderId)`). A cross-folder search
   * needs its own query in `useNoteStore`; see `AGENTS.md` → Known Gaps.
   */
  const searchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    const matchedFolders: SearchResult[] = folders
      .filter((folder) => folder.label.toLowerCase().includes(query))
      .map((folder) => ({
        key: `folder:${folder.id}`,
        kind: 'folder' as const,
        label: folder.label,
        sublabel: `${noteCounts[folder.id] ?? 0} notes`,
      }));

    const matchedNotes: SearchResult[] = notes
      .filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query)
      )
      .map((note) => ({
        key: `note:${note.id}`,
        kind: 'note' as const,
        label: note.title || 'Untitled Note',
        sublabel: previewLines(note.content, 1)[0] ?? 'Empty note',
      }));

    return [...matchedFolders, ...matchedNotes].slice(0, SEARCH_RESULT_LIMIT);
  }, [searchQuery, folders, notes, noteCounts]);

  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      setSearchQuery('');
      if (isMobile) setSidebarOpen(false);
      if (result.kind === 'folder') {
        handleSelectFolder(result.key.replace('folder:', ''));
        return;
      }
      const note = notes.find((n) => n.id === Number(result.key.replace('note:', '')));
      if (note) handleOpenNote(note);
    },
    // `handleOpenNote` is a plain function defined below and re-created each
    // render; depending on `notes` is enough to keep this correct.
    [isMobile, notes]
  );

  const dashboardNotes = useMemo(() => {
    if (notesTab === 'Suggested') return [...notes].sort(() => Math.random() - 0.5).slice(0, 8);
    return notes.slice(0, 8);
  }, [notes, notesTab]);

  /* ---- Note handlers ---- */
  const handleNewNote = useCallback(
    async (folderId?: string, seedContent = '') => {
      const created = await createNote({
        title: 'Untitled Note',
        content: seedContent,
        tags: ['Notebook'],
        folderId: folderId ?? selectedFolderId ?? ROOT_FOLDER_ID,
      });
      if (created) {
        // With "open new notes straight away" off, the note is still created —
        // it just does not steal the view.
        if (openNewNote) {
          focusNote(created);
          setActiveScreen('Notes');
          setNotesEditorOpen(true);
        }
        setFabOpen(false);
      }
    },
    [createNote, selectedFolderId, openNewNote, focusNote]
  );

  /**
   * The tab strip's `+`.
   *
   * Always opens the note, unlike `handleNewNote`, which honours the
   * "open new notes straight away" preference. That preference exists because
   * creating from the FAB or the dashboard is a *side* action — the user asked
   * for a new note, not to be moved. Pressing the `+` **is** asking to be moved
   * into a new tab, so honouring a preference that says "stay where you are"
   * would leave the tap with no visible consequence: a note created, and no tab,
   * and no editor. That is the "a tap always has a visible, local consequence"
   * rule failing in the one control where the user's intent is unambiguous.
   */
  const handleNewNoteTab = useCallback(async () => {
    const created = await createNote({
      title: 'Untitled Note',
      content: '',
      tags: ['Notebook'],
      folderId: selectedFolderId ?? ROOT_FOLDER_ID,
    });
    if (!created) return;
    focusNote(created);
    setActiveScreen('Notes');
    setNotesEditorOpen(true);
  }, [createNote, selectedFolderId, focusNote]);

  const handleOpenNote = (note: Note) => {
    focusNote(note);
    setActiveScreen('Notes');
    // Arriving from a dashboard card on a phone should land on the note, not on
    // the list it was tapped from — the card was the destination.
    setNotesEditorOpen(true);
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
    // The note the phone was showing is gone; there is nothing left to type in,
    // so it returns to the notebook rather than sitting on an empty editor.
    setNotesEditorOpen(false);
  };

  /**
   * Rename from a note card's context menu.
   *
   * Goes through the same debounced persist the editor uses rather than
   * `updateNote` directly — the card is mid-interaction with the note, and a
   * direct write would race the editor's pending tail if the note happens to be
   * the open one.
   */
  const handleRenameNote = useCallback(
    (id: number, title: string) => {
      if (id === editingNote?.id) {
        setEditingNote({ ...editingNote, title });
        scheduleNoteSave(id, { title });
        return;
      }
      void updateNote(id, { title });
    },
    [editingNote, scheduleNoteSave, updateNote]
  );

  /**
   * "Copy content" rather than "Copy link": the app has no router, so a note has
   * no URL to copy, and inventing one would hand the user a dead string.
   */
  const handleCopyNoteContent = useCallback(
    (id: number) => {
      const note = notes.find((n) => n.id === id);
      if (note) void copyToClipboard(note.content);
    },
    [notes]
  );

  /**
   * Accounts → "Export everything". JSON rather than Markdown because the point
   * is a faithful copy: a re-import would need a parser, and a lossy one is worse
   * than an obviously machine-readable dump.
   */
  const handleExportData = useCallback(() => {
    void copyToClipboard(
      JSON.stringify({ notes, folders, exportedAt: new Date().toISOString() }, null, 2)
    );
  }, [notes, folders]);

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
      // With "confirm before deleting" off, the context menu deletes straight
      // away — the dialog is the only thing the preference controls.
      if (!confirmDelete) {
        void softDeleteNote(noteId);
        if (editingNote?.id === noteId) {
          setEditingNote(null);
          setNotesEditorOpen(false);
        }
        return;
      }
      setDeleteTarget({ kind: 'note', id: noteId, label: note.title });
    },
    [notes, confirmDelete, editingNote]
  );

  /**
   * Folder selection navigates as well as filters.
   *
   * A folder row is a destination, not a filter: clicking "Main" while on
   * Overview and being left staring at the same dashboard looks like a dead
   * click, because nothing on screen visibly changes even though the store
   * quietly rescoped. Going to Notes also puts the user where the folder's
   * notes are, which is the only place a folder selection is observable.
   */
  const handleSelectFolder = useCallback(
    (folderId: string) => {
      setSelectedFolder(folderId);
      setActiveScreen('Notes');
      // A folder is a notebook, not a note, so it opens the notebook pane.
      setNotesEditorOpen(false);
    },
    [setSelectedFolder]
  );

  /* ---- Folder context-menu callbacks ---- */
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
      if (editingNote?.id === deleteTarget.id) {
        setEditingNote(null);
        setNotesEditorOpen(false);
      }
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteFolder, softDeleteNote, editingNote]);

  /**
   * Files the scratch pad as a note and clears it.
   *
   * The pad is emptied on success, not on open: a failed create that wiped the
   * text would be the worst version of this — the note does not exist and the
   * thing you had written is gone too. Clearing after the write means a throw
   * leaves the pad exactly as it was.
   */
  const handleSaveScratch = useCallback(
    async (folderId: string) => {
      const content = scratch;
      if (!content.trim()) return;
      const created = await createNote({
        title: deriveTitle(content) || 'Untitled Note',
        content,
        tags: ['Notebook'],
        folderId,
      });
      if (!created) return;
      setSaveScratchOpen(false);
      setScratch('');
      // Open it, so the thing just made is the thing on screen.
      focusNote(created);
      setActiveScreen('Notes');
    },
    [scratch, createNote, focusNote]
  );

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

  /* ---- Event handlers ---- */

  /**
   * Which event the editor is open on. `null` closed, `undefined` new — the
   * three states have to be distinguishable, and folding "new" into `null`
   * would mean every handler had to ask which one it was.
   */
  const [editorEvent, setEditorEvent] = useState<Event | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  /** The start time a *new* event gets; null while editing an existing one. */
  const [editorStart, setEditorStart] = useState<Date | null>(null);

  /**
   * Opens the editor for a new event at `start`, and jumps the Agenda to that
   * day so the thing you are about to create is the thing on screen.
   *
   * **Nothing is created until you press Save.** It used to create an event
   * called "New Event" immediately and leave you to retype it, which is why
   * adding an event felt like it only ever made a blank card.
   */
  const handleCreateEvent = useCallback((start: Date) => {
    setActiveScreen('Agenda');
    setAgendaAnchor(start);
    setEditorEvent(null);
    setEditorStart(start);
    setEditorOpen(true);
    setFabOpen(false);
  }, []);

  const handleOpenEvent = useCallback((event: Event) => {
    setEditorEvent(event);
    setEditorStart(null);
    setEditorOpen(true);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setEditorOpen(false);
    setEditorEvent(null);
    setEditorStart(null);
  }, []);

  /**
   * One write for both create and edit.
   *
   * An existing event is **updated**, never replaced: `createEvent` would mint a
   * new uuid and orphan the old row, and a "Save" that silently duplicated an
   * event would be a nasty surprise.
   */
  const handleSaveEvent = useCallback(
    (draft: EventDraft) => {
      if (editorEvent) {
        void updateEvent(editorEvent.id, {
          title: draft.title,
          notes: draft.notes,
          startsAt: draft.startsAt,
          durationMinutes: draft.durationMinutes,
          priority: draft.priority ?? null,
        });
      } else {
        const start = editorStart ?? nextFreeSlot(agendaAnchor, events);
        void createEvent({
          title: draft.title,
          notes: draft.notes,
          startsAt: draft.startsAt || start.toISOString(),
          durationMinutes: draft.durationMinutes,
          priority: draft.priority,
        });
        // Move the Agenda to the day that was just filled in, so the event is
        // visible the moment the dialog closes.
        setAgendaAnchor(new Date(draft.startsAt));
      }
      handleCloseEditor();
    },
    [createEvent, editorEvent, editorStart, events, agendaAnchor, updateEvent, handleCloseEditor]
  );

  const handleDeleteEvent = useCallback(
    (id: number) => {
      void softDeleteEvent(id);
    },
    [softDeleteEvent]
  );

  /**
   * The Overview's upcoming list. A memo because the conversion builds a new
   * array, and without it the list re-sorts on every render of this shell —
   * which is every keystroke in the note editor behind it.
   */
  const upcomingEvents = useMemo(() => events.map(toCalendarEvent), [events]);

  /**
   * The three-dot page menu: **the same button in the same slot, different rows
   * per screen**, because the menu is the one place that can say what *this*
   * page is for.
   *
   * One rule, not four bespoke lists: **the menu offers what you can create on
   * the page you are on.** Overview is the dashboard and takes both; Notes is
   * about notes, so only a note; Agenda is a calendar, so only an event.
   *
   * Settings is the reason this matters most — it **hides the FAB**, because a
   * create button floating over a preferences surface can only take you off the
   * thing you just opened. That left Settings with no way to create anything at
   * all, and the menu puts one back.
   *
   * Only rows that genuinely work are listed. "New task" is deliberately absent:
   * the FAB's version only *navigates*, so a menu row that said "New task" and
   * then created nothing would be the exact failure this menu replaced.
   */
  /**
   * The page menu no longer creates anything.
   *
   * It used to offer "New note" and "New event", which are the FAB's own
   * two actions — so the menu was a second, plainer way to reach the same two
   * buttons, sitting in the opposite corner of the screen. Two controls for one
   * effect is two things to choose between, which is exactly the kind of
   * decision this app is trying not to ask its user to make.
   *
   * It now has the one job the FAB cannot do: changing how this page is laid
   * out. On Overview that is the customize panel; every other screen has
   * nothing to offer, and the button hides itself rather than opening an empty
   * menu.
   */
  const pageMenuActions = useMemo<ContextMenuAction[]>(
    () =>
      activeScreen === 'Overview'
        ? [
            {
              label: 'Customize overview',
              iconName: 'tune-variant',
              onPress: () => setCustomizeOpen(true),
            },
          ]
        : [],
    [activeScreen]
  );

  /* ---- FAB handlers ---- */
  const handleFabAction = (kind: 'note' | 'task' | 'event') => {
    setFabOpen(false);
    if (kind === 'note') return handleNewNote();
    if (kind === 'task' && activeScreen !== 'Overview' && activeScreen !== 'Agenda') {
      setActiveScreen('Overview');
    }
    if (kind === 'event') void handleCreateEvent(nextFreeSlot(agendaAnchor, events));
  };

  return (
    <View style={[styles.app, { backgroundColor: theme.background }]}>
      <View style={styles.layout}>
        {/* Scrim behind the rail on mobile; fades with the same shared value. */}
        {isMobile && isSidebarOpen && !isSettings ? (
          <Pressable style={styles.mobileOverlay} onPress={() => setSidebarOpen(false)}>
            <Animated.View
              style={[styles.scrimFill, { backgroundColor: theme.shadow }, scrimStyle]}
            />
          </Pressable>
        ) : null}
        {/*
          The main sidebar gives way to the Settings rail.

          Settings has its own section navigation, so leaving the main sidebar
          up put two sidebars side by side — the workspace tree and the settings
          tree, one navigation offering a place to go and the other a place to
          configure. Only one of those is useful while configuring, and the
          settings rail takes the first column either way. The scrim above is
          gated on the same flag, or mobile would show a dimmed overlay with no
          sidebar behind it.
        */}
        {isSettings ? null : (
        <Animated.View
          style={[
            isMobile ? styles.mobileSidebarWrap : styles.desktopSidebarWrap,
            isMobile
              ? { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 12, color: theme.shadow }] }
              : null,
            // The rail must clip its own content while collapsed, otherwise a
            // zero-width box would still paint the sidebar's children.
            styles.sidebarClip,
            // RN 0.86 deprecates the `pointerEvents` prop in favour of this.
            { pointerEvents: isSidebarOpen ? 'auto' : 'none' },
            sidebarStyle,
          ]}
        >
          <Sidebar
            theme={theme}
            activeNav={activeScreen}
            themeName={themeName}
            width={sidebarWidth}
            resizable={!isMobile}
            folders={folders}
            onResize={setSidebarWidth}
            onResizeCommit={commitSidebarWidth}
            selectedFolderId={selectedFolderId}
            noteCounts={noteCounts}
            onToggle={() => setSidebarOpen((v) => !v)}
            onSelectNav={(k) => {
              setActiveScreen(k);
              // Switching to Notes from the dock shows the notebook, not
              // whichever note happened to be open last.
              if (k === 'Notes') setNotesEditorOpen(false);
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
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchResults={searchResults}
            onSelectSearchResult={handleSelectSearchResult}
            onCloseSearch={() => setSearchQuery('')}
          />
        </Animated.View>
        )}

        {/* Main */}
        <View style={styles.main}>
          {/* Top header — hamburger only while the sidebar is closed;
              creation actions live in the floating action button. It is the
              Overview's greeting bar and Settings' drill-down bar; the Notes
              and Agenda screens carry no header — Notes puts its tab strip in
              that top slot instead. */}
          {activeScreen !== 'Notes' && activeScreen !== 'Agenda' ? (
          <TopHeader
            theme={theme}
            isMobile={isMobile}
            userName={userName}
            greetingText={greeting()}
            showGreeting={activeScreen === 'Overview'}
            showSidebarToggle={!isSidebarOpen}
            onBack={
              activeScreen === 'Settings'
                ? () => {
                    // On a phone Settings is a drill-down, so back pops one
                    // level (section → section list) and only leaves the screen
                    // from the list. `goBack` returns false at the root.
                    if (!settingsRef.current?.goBack()) setActiveScreen('Overview');
                  }
                : undefined
            }
            onToggleSidebar={() => setSidebarOpen(true)}
            title={activeScreen === 'Overview' ? undefined : activeScreen}
            menuActions={pageMenuActions}
          />
          ) : null}

          {/*
            The screen switcher. At the bottom it floats *over* the content —
            the classic dock, and the reason the content's last row needs bottom
            padding. At the top it becomes a normal row between the header and
            the content, because a floating pill pinned to `top: 0` would sit on
            top of the header and cover the back chevron and the hamburger.

            That difference is the whole reason it is a layout and not a toggle
            of one absolute offset: the two positions are two different boxes,
            not one box moved.
          */}
          {activeScreen === 'Settings' ? null : dockPosition === 'top' ? (
            <View style={styles.capsuleDockTop}>
              <CapsuleSwitcher
                theme={theme}
                active={activeScreen}
                onSelect={setActiveScreen}
                variant={dockVariant}
              />
            </View>
          ) : null}

          {/* Screen content — the `key` remounts the transition on every
              screen change, which is what replays the entrance. */}
          <View style={styles.fill}>
            <ScreenTransition key={activeScreen}>
              {activeScreen === 'Overview' ? (
                <OverviewScreen
                  theme={theme}
                  isMobile={isMobile}
                  isLoading={isLoading}
                  layout={layout}
                  order={sectionOrder}
                  notesTab={notesTab}
                  onNotesTab={setNotesTab}
                  onRefresh={refreshOverview}
                  dashboardNotes={dashboardNotes}
                  folders={folders}
                  onOpenNote={handleOpenNote}
                  actions={{
                    onRename: handleRenameNote,
                    onMove: handleMoveNote,
                    onDuplicate: handleDuplicateNote,
                    onDelete: handleDeleteNoteById,
                    onCopyContent: handleCopyNoteContent,
                  }}
                  upcomingEvents={upcomingEvents}
                  tasks={tasks}
                  newTask={newTask}
                  onNewTaskChange={setNewTask}
                  onAddTask={addTask}
                  onToggleTask={toggleTask}
                  scratch={scratch}
                  onScratchChange={setScratch}
                  onSaveScratch={() => setSaveScratchOpen(true)}
                  showSectionTitles={showSectionTitles}
                />
              ) : activeScreen === 'Notes' ? (
                <NotesScreen
                  theme={theme}
                  notes={notes}
                  selected={editingNote}
                  tabs={noteTabs}
                  folderLabel={folderLabel}
                  listWidth={listWidth}
                  onResizeList={setListWidth}
                  onResizeListCommit={commitListWidth}
                  isMobile={isMobile}
                  isEditorOpen={notesEditorOpen}
                  isListCollapsed={notesListCollapsed}
                  onSelect={(note) => {
                    // Tapping a list row focuses the note and holds it open.
                    focusNote(note);
                    setNotesEditorOpen(true);
                  }}
                  onSelectTab={(id) => {
                    const note = notes.find((n) => n.id === id);
                    if (note) setEditingNote(note);
                  }}
                  onCloseTab={closeNoteTab}
                  onNewTab={handleNewNoteTab}
                  onStepTab={stepNoteTab}
                  onOpenEditor={() => setNotesEditorOpen(true)}
                  onCloseEditor={() => setNotesEditorOpen(false)}
                  onContentChange={handleContentChange}
                  onDelete={handleDeleteNote}
                  onMoveNote={handleMoveNote}
                  onDuplicateNote={handleDuplicateNote}
                  onDeleteNote={handleDeleteNoteById}
                  onRenameNote={handleRenameNote}
                />
              ) : activeScreen === 'Settings' ? (
                <SettingsScreen
                  ref={settingsRef}
                  theme={theme}
                  themeName={themeName}
                  onSelectTheme={setThemeName}
                  accent={accentName}
                  onSelectAccent={setAccentName}
                  dockPosition={dockPosition}
                  onSelectDockPosition={setDockPosition}
                  dockVariant={dockVariant}
                  onSelectDockVariant={setDockVariant}
                  fabVariant={fabVariant}
                  onSelectFabVariant={setFabVariant}
                  layout={layout}
                  order={sectionOrder}
                  onToggleSection={toggleSection}
                  onReorderSection={reorderSections}
                  onResetLayout={resetLayout}
                  showSectionTitles={showSectionTitles}
                  onSetShowSectionTitles={setShowSectionTitles}
                  behaviour={{ confirmDelete, openNewNote }}
                  onSetBehaviour={setBehaviour}
                  notes={notes}
                  folders={folders}
                  onExportData={handleExportData}
                />
              ) : (
                <AgendaScreen
                  theme={theme}
                  isMobile={isMobile}
                  anchor={agendaAnchor}
                  onAnchorChange={setAgendaAnchor}
                  events={events}
                  onCreateEvent={handleCreateEvent}
                  onOpenEvent={handleOpenEvent}
                  onDeleteEvent={handleDeleteEvent}
                  tasks={tasks}
                  newTask={newTask}
                  onNewTaskChange={setNewTask}
                  onAddTask={addTask}
                  onToggleTask={toggleTask}
                />
              )}
            </ScreenTransition>
          </View>

          {/* Capsule switcher — all screen sizes. Hidden on Settings, which is
              a preference surface rather than a place you work. */}
          {activeScreen === 'Settings' || dockPosition === 'top' ? null : (
            <View style={styles.capsuleWrap}>
              <CapsuleSwitcher
                theme={theme}
                active={activeScreen}
                onSelect={setActiveScreen}
                variant={dockVariant}
              />
            </View>
          )}

          {/* The Overview's layout panel, opened from the page menu. It edits
              the same persisted order and visibility that Settings owns — this
              is a shortcut to one control, not a second source of truth. */}
          {customizeOpen ? (
            <CustomizeOverview
              theme={theme}
              visible={(section) => layout[section]}
              order={sectionOrder}
              onToggle={toggleSection}
              onReorder={reorderSections}
              onClose={() => setCustomizeOpen(false)}
            />
          ) : null}

          {/* FAB — every screen except Settings, for the same reason as the dock
              above. Its three actions all leave Settings to go *create* something
              elsewhere, so on a preference surface it is a button that can only
              take you away from the thing you opened. */}
          {isSettings ? null : (
            <FloatingActionFab
              theme={theme}
              isOpen={isFabOpen}
              onToggle={() => setFabOpen((v) => !v)}
              variant={fabVariant}
              actions={[
                { label: 'New Note', iconName: 'note-plus-outline', onPress: () => handleFabAction('note') },
                { label: 'New Task', iconName: 'checkbox-marked-circle-plus-outline', onPress: () => handleFabAction('task') },
                { label: 'New Event', iconName: 'calendar-plus', onPress: () => handleFabAction('event') },
              ]}
            />
          )}

          {/*
            The event editor. Rendered at the shell rather than inside the Agenda
            so the FAB, the page menu and the Agenda's "Add event" row can all
            open the same dialog for the same event — one place that owns what an
            event *is*, which is the point of having moved editing out of the row.
          */}
          <EventEditorDialog
            theme={theme}
            visible={editorOpen}
            event={editorEvent}
            events={events}
            anchorDate={editorStart}
            onSave={handleSaveEvent}
            onSaveDraft={handleSaveEvent}
            onDismiss={handleCloseEditor}
          />

          {/* The scratch pad's folder picker. At the shell for the same reason
              as the event editor — it is one dialog about creating a note, and
              the dashboard card is only its entry point. */}
          <SaveScratchDialog
            theme={theme}
            visible={saveScratchOpen}
            folders={folders}
            tree={folderTree}
            defaultFolderId={selectedFolderId}
            preview={previewLines(scratch, 2).join(' ') || 'Empty'}
            onConfirm={(folderId) => void handleSaveScratch(folderId)}
            onDismiss={() => setSaveScratchOpen(false)}
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
    zIndex: 5,
  },
  scrimFill: { flex: 1 },
  mobileSidebarWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 10,
    elevation: 12,
  },
  // On wide screens the rail is a flex child of the row, so a negative offset
  // would still reserve its 240px; animating `width` is what actually hands the
  // space back to the main column.
  desktopSidebarWrap: { zIndex: 0 },
  /** Clip the rail's children while it is collapsed. */
  sidebarClip: { overflow: 'hidden' },
  capsuleWrap: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
    pointerEvents: 'box-none',
  },
  /**
   * The top dock is a flex row, not an absolute one: it takes its own space so
   * the content below starts underneath it. An absolute pill at `top: 0` would
   * overlay the header and sit on top of the back chevron.
   */
  capsuleDockTop: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
});
