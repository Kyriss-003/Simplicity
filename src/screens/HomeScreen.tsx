import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CapsuleSwitcher } from '../components/CapsuleSwitcher';
import { FloatingActionFab, type FabAction } from '../components/FloatingActionFab';
import Sidebar from '../components/Sidebar';
import { TopHeader } from '../components/TopHeader';
import { EventEditorDialog, type EventDraft } from '../components/calendar/EventEditorDialog';
import { nextFreeSlot, toCalendarEvent } from '../components/calendar/calendarUtils';
import type { NoteCardActions } from '../components/cards/NotesCardRow';
import { SaveScratchDialog } from '../components/cards/SaveScratchDialog';
import type { NoteTab } from '../components/notes/NoteTabs';
import { TemplatesModal, type TemplatesModalInitialView } from '../components/notes/TemplatesModal';
import { CustomizeOverview } from '../components/overview/CustomizeOverview';
import { ConfirmDialog } from '../components/shared/ConfirmDialog';
import type { ContextMenuAction } from '../components/shared/ContextMenu';
import { ImportExportModal, type PortabilityTab } from '../components/shared/ImportExportModal';
import { MoveToModal } from '../components/shared/MoveToModal';
import { SearchModal } from '../components/shared/SearchModal';
import { SEARCH_RESULT_LIMIT, type SearchResult } from '../components/shared/SidebarSearch';
import { TagEditorModal } from '../components/shared/TagEditorModal';
import { searchLocalNotesAndFolders } from '../components/shared/searchUtils';
import type { ImportedFolderItem, ImportedNoteItem } from '../db/portability';
import { ROOT_FOLDER_ID } from '../db/storage';
import { recoverPendingDrafts, useNoteAutoSave } from '../hooks/useNoteAutoSave';
import { AgendaScreen } from './AgendaScreen';
import { NotesScreen } from './NotesScreen';
import { OverviewScreen, type TagCount } from './OverviewScreen';
import { SettingsScreen, type SettingsHandle } from './SettingsScreen';
import { useAuthStore } from '../store/useAuthStore';
import { useEventStore } from '../store/useEventStore';
import { useNoteStore } from '../store/useNoteStore';
import { usePrefsStore } from '../store/usePrefsStore';
import { useTemplateStore } from '../store/useTemplateStore';
import { Layout, THEMES, withAccent } from '../theme';
import type { Event, Folder, Note, NoteTemplate, ScreenKey, Task } from '../types';
import { buildFolderTree, collectSubtreeIds, copyToClipboard, deriveTitle, greeting } from '../utils';

const TASKS_STORAGE_KEY = 'simplicity_tasks_v1';
const SCRATCH_STORAGE_KEY = 'simplicity_scratch_v1';
const EDITOR_SESSION_KEY = 'simplicity_editor_session_v1';

interface EditorSession {
  openNoteIds: number[];
  activeNoteId: number | null;
}

function loadEditorSession(): EditorSession {
  try {
    const raw = localStorage.getItem(EDITOR_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<EditorSession>;
      const openNoteIds = Array.isArray(parsed.openNoteIds)
        ? parsed.openNoteIds.filter((id): id is number => typeof id === 'number')
        : [];
      const activeNoteId = typeof parsed.activeNoteId === 'number' ? parsed.activeNoteId : null;
      return { openNoteIds, activeNoteId };
    }
  } catch {
    // ignore corrupted session
  }
  return { openNoteIds: [], activeNoteId: null };
}

const DEFAULT_TASKS: Task[] = [
  { id: 1, label: 'Outline weekly priorities', sourceNote: 'Overview', done: false },
  { id: 2, label: 'Draft **Q4 roadmap** milestones', sourceNote: 'Product Roadmap', done: false },
  { id: 3, label: 'Review meeting notes', sourceNote: 'Daily Inbox', done: true },
];

function loadInitialTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Task[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback to defaults
  }
  return DEFAULT_TASKS;
}

function loadInitialScratch(): string {
  try {
    return localStorage.getItem(SCRATCH_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);

  const notes = useNoteStore((s) => s.notes);
  const allNotes = useNoteStore((s) => s.allNotes);
  const folders = useNoteStore((s) => s.folders);
  const isLoadingNotes = useNoteStore((s) => s.isLoading);
  const selectedFolderId = useNoteStore((s) => s.selectedFolderId);
  const noteCounts = useNoteStore((s) => s.noteCounts);
  const initializeNotes = useNoteStore((s) => s.initialize);
  const refreshNoteCounts = useNoteStore((s) => s.refreshNoteCounts);
  const getAllNotes = useNoteStore((s) => s.getAllNotes);
  const createNote = useNoteStore((s) => s.createNote);
  const updateNote = useNoteStore((s) => s.updateNote);
  const togglePinNote = useNoteStore((s) => s.togglePinNote);
  const importNotes = useNoteStore((s) => s.importNotes);
  const syncNoteInState = useNoteStore((s) => s.syncNoteInState);
  const softDeleteNote = useNoteStore((s) => s.softDeleteNote);
  const duplicateNote = useNoteStore((s) => s.duplicateNote);
  const moveNote = useNoteStore((s) => s.moveNote);
  const setSelectedFolder = useNoteStore((s) => s.setSelectedFolder);
  const createFolder = useNoteStore((s) => s.createFolder);
  const renameFolder = useNoteStore((s) => s.renameFolder);
  const moveFolder = useNoteStore((s) => s.moveFolder);
  const duplicateFolder = useNoteStore((s) => s.duplicateFolder);
  const deleteFolder = useNoteStore((s) => s.deleteFolder);

  const events = useEventStore((s) => s.events);
  const initializeEvents = useEventStore((s) => s.initialize);
  const createEvent = useEventStore((s) => s.createEvent);
  const updateEvent = useEventStore((s) => s.updateEvent);
  const softDeleteEvent = useEventStore((s) => s.softDeleteEvent);

  const templates = useTemplateStore((s) => s.templates);
  const initializeTemplates = useTemplateStore((s) => s.initialize);
  const createTemplate = useTemplateStore((s) => s.createTemplate);
  const updateTemplate = useTemplateStore((s) => s.updateTemplate);
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate);
  const resetBuiltInTemplates = useTemplateStore((s) => s.resetBuiltIns);

  const themeName = usePrefsStore((s) => s.themeName);
  const accent = usePrefsStore((s) => s.accent);
  const layout = usePrefsStore((s) => s.layout);
  const order = usePrefsStore((s) => s.order);
  const confirmDelete = usePrefsStore((s) => s.confirmDelete);
  const openNewNote = usePrefsStore((s) => s.openNewNote);
  const sidebarWidth = usePrefsStore((s) => s.sidebarWidth);
  const listWidth = usePrefsStore((s) => s.listWidth);
  const dockPosition = usePrefsStore((s) => s.dockPosition);
  const dockVariant = usePrefsStore((s) => s.dockVariant);
  const fabVariant = usePrefsStore((s) => s.fabVariant);
  const showSectionTitles = usePrefsStore((s) => s.showSectionTitles);
  const displayName = usePrefsStore((s) => s.displayName);

  const initializePrefs = usePrefsStore((s) => s.initialize);
  const setThemeName = usePrefsStore((s) => s.setThemeName);
  const setDisplayName = usePrefsStore((s) => s.setDisplayName);
  const setSidebarWidth = usePrefsStore((s) => s.setSidebarWidth);
  const commitSidebarWidth = usePrefsStore((s) => s.commitSidebarWidth);
  const setListWidth = usePrefsStore((s) => s.setListWidth);
  const commitListWidth = usePrefsStore((s) => s.commitListWidth);
  const toggleSection = usePrefsStore((s) => s.toggleSection);
  const reorderSections = usePrefsStore((s) => s.reorderSections);

  const theme = useMemo(() => withAccent(THEMES[themeName], accent), [themeName, accent]);

  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const isMobile = windowWidth < Layout.breakpoints.tablet;

  const [activeNav, setActiveNav] = useState<ScreenKey>('Overview');
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile);
  const [notesTab, setNotesTab] = useState('Recents');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [editingTagsNoteId, setEditingTagsNoteId] = useState<number | null>(null);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  const initialSession = useMemo(loadEditorSession, []);
  const [openNoteIds, setOpenNoteIds] = useState<number[]>(initialSession.openNoteIds);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(initialSession.activeNoteId);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(initialSession.activeNoteId !== null);

  const [tasks, setTasks] = useState<Task[]>(loadInitialTasks);
  const [newTask, setNewTask] = useState('');
  const [scratch, setScratch] = useState<string>(loadInitialScratch);

  const [agendaAnchor, setAgendaAnchor] = useState<Date>(() => new Date());
  const [fabOpen, setFabOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [saveScratchOpen, setSaveScratchOpen] = useState(false);

  const [moveTarget, setMoveTarget] = useState<
    | { kind: 'note'; id: number; currentFolderId: string }
    | { kind: 'folder'; id: string; parentId: string | null }
    | null
  >(null);

  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const [eventModal, setEventModal] = useState<{
    visible: boolean;
    event: Event | null;
    anchorDate: Date | null;
  }>({ visible: false, event: null, anchorDate: null });

  const [portabilityModal, setPortabilityModal] = useState<{
    visible: boolean;
    tab: PortabilityTab;
  }>({ visible: false, tab: 'export' });

  const [templatesModal, setTemplatesModal] = useState<{
    visible: boolean;
    initialView: TemplatesModalInitialView;
    initialTemplateId?: string;
    liveTitle?: string;
    liveContent?: string;
  }>({ visible: false, initialView: 'browse' });

  const [templateInsertRequest, setTemplateInsertRequest] = useState<{
    seq: number;
    text: string;
  } | null>(null);
  const templateInsertSeqRef = useRef(0);

  const settingsRef = useRef<SettingsHandle>(null);

  const {
    saveStatus,
    scheduleSave,
    flush: flushPendingSave,
    flushSync: flushPendingSync,
    discardPendingForNote,
  } = useNoteAutoSave({ updateNote, onSyncPersisted: syncNoteInState });

  useEffect(() => {
    recoverPendingDrafts();
    void initializePrefs();
    void initializeNotes().then(() => setNotesLoaded(true));
    void initializeEvents();
    void initializeTemplates();
  }, [initializePrefs, initializeNotes, initializeEvents, initializeTemplates]);

  const [greetingHour, setGreetingHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const syncHour = () => setGreetingHour(new Date().getHours());
    const id = window.setInterval(syncHour, 60_000);
    window.addEventListener('focus', syncHour);
    document.addEventListener('visibilitychange', syncHour);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', syncHour);
      document.removeEventListener('visibilitychange', syncHour);
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-accent', theme.accent);
    document.body.style.backgroundColor = theme.background;
    document.body.style.color = theme.text;
  }, [theme.accent, theme.background, theme.text]);

  useEffect(() => {
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // ignore
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(SCRATCH_STORAGE_KEY, scratch);
    } catch {
      // ignore
    }
  }, [scratch]);

  useEffect(() => {
    try {
      localStorage.setItem(
        EDITOR_SESSION_KEY,
        JSON.stringify({ openNoteIds, activeNoteId })
      );
    } catch {
      // ignore
    }
  }, [openNoteIds, activeNoteId]);

  useEffect(() => {
    if (!notesLoaded) return;
    const liveIds = new Set(allNotes.map((n) => n.id));
    setOpenNoteIds((prev) => {
      const next = prev.filter((id) => liveIds.has(id));
      return next.length === prev.length ? prev : next;
    });
    setActiveNoteId((prev) => {
      if (prev !== null && liveIds.has(prev)) return prev;
      return null;
    });
  }, [notesLoaded, allNotes]);

  useEffect(() => {
    if (activeNoteId === null) {
      setIsEditorOpen(false);
    }
  }, [activeNoteId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchModalOpen((open) => !open);
        return;
      }
      if (e.key.toLowerCase() === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void flushPendingSave();
        return;
      }
      if (e.key === 'Escape') {
        if (fabOpen) setFabOpen(false);
        if (isMobile && sidebarOpen) setSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fabOpen, isMobile, sidebarOpen, flushPendingSave]);

  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);

  const activeNote = useMemo(
    () =>
      allNotes.find((n) => n.id === activeNoteId) ??
      notes.find((n) => n.id === activeNoteId) ??
      null,
    [allNotes, notes, activeNoteId]
  );

  const noteTabs: NoteTab[] = useMemo(() => {
    const byId = new Map((allNotes.length > 0 ? allNotes : notes).map((n) => [n.id, n]));
    return openNoteIds
      .map((id) => byId.get(id))
      .filter((n): n is Note => Boolean(n))
      .map((n) => ({ id: n.id, title: n.title || 'Untitled' }));
  }, [allNotes, notes, openNoteIds]);

  const focusNote = useCallback(
    (note: Note, switchToNotes = true) => {
      flushPendingSync();
      if (note.folderId && note.folderId !== selectedFolderId) {
        void setSelectedFolder(note.folderId);
      }
      setOpenNoteIds((prev) => (prev.includes(note.id) ? prev : [...prev, note.id]));
      setActiveNoteId(note.id);
      setIsEditorOpen(true);
      if (switchToNotes) {
        setActiveNav('Notes');
      }
      if (isMobile) setSidebarOpen(false);
    },
    [flushPendingSync, isMobile, selectedFolderId, setSelectedFolder]
  );

  const handleCreateNote = useCallback(
    async (folderId?: string) => {
      const targetFolder = folderId ?? selectedFolderId ?? ROOT_FOLDER_ID;
      const created = await createNote({
        title: 'Untitled',
        content: '# Untitled\n\n',
        tags: [],
        folderId: targetFolder,
      });
      if (!created) return;
      if (created.folderId !== selectedFolderId) {
        await setSelectedFolder(created.folderId);
      }
      if (openNewNote) {
        focusNote(created, true);
      }
    },
    [createNote, selectedFolderId, setSelectedFolder, openNewNote, focusNote]
  );

  const handleNoteContentChange = useCallback(
    (text: string) => {
      if (!activeNote) return;
      const derived = deriveTitle(text);
      const nextTitle = derived || activeNote.title || 'Untitled';
      scheduleSave(activeNote.id, nextTitle, text);
    },
    [activeNote, scheduleSave]
  );

  const handleCloseTab = useCallback(
    (id: number) => {
      if (activeNoteId === id) {
        flushPendingSync();
      }
      setOpenNoteIds((prev) => {
        const idx = prev.indexOf(id);
        const next = prev.filter((item) => item !== id);
        if (activeNoteId === id) {
          const replacement = next[Math.min(idx, next.length - 1)] ?? null;
          setActiveNoteId(replacement);
          if (replacement === null) setIsEditorOpen(false);
        }
        return next;
      });
    },
    [activeNoteId, flushPendingSync]
  );

  const handleStepTab = useCallback(
    (direction: -1 | 1) => {
      if (openNoteIds.length === 0 || activeNoteId === null) return;
      const idx = openNoteIds.indexOf(activeNoteId);
      if (idx === -1) return;
      const targetId = openNoteIds[idx + direction];
      if (targetId === undefined) return;
      const targetNote =
        allNotes.find((n) => n.id === targetId) ?? notes.find((n) => n.id === targetId);
      if (targetNote) {
        focusNote(targetNote, false);
      } else {
        flushPendingSync();
        setActiveNoteId(targetId);
      }
    },
    [openNoteIds, activeNoteId, allNotes, notes, focusNote, flushPendingSync]
  );

  const performDeleteNote = useCallback(
    async (noteId: number) => {
      discardPendingForNote(noteId);
      await softDeleteNote(noteId);
      setOpenNoteIds((prev) => {
        const idx = prev.indexOf(noteId);
        const next = prev.filter((id) => id !== noteId);
        if (activeNoteId === noteId) {
          const replacement = next[Math.min(idx, next.length - 1)] ?? null;
          setActiveNoteId(replacement);
          if (replacement === null) setIsEditorOpen(false);
        }
        return next;
      });
    },
    [discardPendingForNote, softDeleteNote, activeNoteId]
  );

  const requestDeleteNote = useCallback(
    (noteId: number) => {
      const target = allNotes.find((n) => n.id === noteId) ?? notes.find((n) => n.id === noteId);
      if (!confirmDelete) {
        void performDeleteNote(noteId);
        return;
      }
      setConfirmState({
        title: 'Delete note?',
        message: `Remove "${target?.title || 'Untitled'}" from your workspace?`,
        confirmLabel: 'Delete',
        onConfirm: () => {
          setConfirmState(null);
          void performDeleteNote(noteId);
        },
      });
    },
    [allNotes, notes, confirmDelete, performDeleteNote]
  );

  const performDeleteFolder = useCallback(
    async (folderId: string) => {
      const doomedFolders = new Set(collectSubtreeIds(folders, folderId));
      const doomedNoteIds = allNotes
        .filter((n) => doomedFolders.has(n.folderId))
        .map((n) => n.id);
      for (const noteId of doomedNoteIds) {
        discardPendingForNote(noteId);
      }
      await deleteFolder(folderId);
      if (doomedNoteIds.length > 0) {
        const doomedSet = new Set(doomedNoteIds);
        setOpenNoteIds((prev) => {
          const next = prev.filter((id) => !doomedSet.has(id));
          if (activeNoteId !== null && doomedSet.has(activeNoteId)) {
            const replacement = next[0] ?? null;
            setActiveNoteId(replacement);
            if (replacement === null) setIsEditorOpen(false);
          }
          return next;
        });
      }
    },
    [folders, allNotes, discardPendingForNote, deleteFolder, activeNoteId]
  );

  const requestDeleteFolder = useCallback(
    (folderId: string) => {
      const target = folders.find((f) => f.id === folderId);
      if (!confirmDelete) {
        void performDeleteFolder(folderId);
        return;
      }
      setConfirmState({
        title: 'Delete folder?',
        message: `Remove "${target?.label || 'Folder'}" and all notes inside it?`,
        confirmLabel: 'Delete',
        onConfirm: () => {
          setConfirmState(null);
          void performDeleteFolder(folderId);
        },
      });
    },
    [folders, confirmDelete, performDeleteFolder]
  );

  const noteCardActions: NoteCardActions = useMemo(
    () => ({
      onRename: (id, title) => {
        if (activeNoteId === id) flushPendingSync();
        void updateNote(id, { title });
      },
      onTogglePin: (id) => {
        void togglePinNote(id);
      },
      onMove: (id) => {
        const note = allNotes.find((n) => n.id === id) ?? notes.find((n) => n.id === id);
        if (note) setMoveTarget({ kind: 'note', id: note.id, currentFolderId: note.folderId });
      },
      onDuplicate: (id) => {
        void duplicateNote(id);
      },
      onDelete: (id) => requestDeleteNote(id),
      onCopyContent: (id) => {
        const note = allNotes.find((n) => n.id === id) ?? notes.find((n) => n.id === id);
        if (note) void copyToClipboard(note.content);
      },
      onEditTags: (id) => setEditingTagsNoteId(id),
    }),
    [
      activeNoteId,
      flushPendingSync,
      allNotes,
      notes,
      updateNote,
      togglePinNote,
      duplicateNote,
      requestDeleteNote,
    ]
  );

  const availableTags: TagCount[] = useMemo(() => {
    const pool = allNotes.length > 0 ? allNotes : notes;
    const counts = new Map<string, { tag: string; count: number }>();
    for (const note of pool) {
      for (const raw of note.tags ?? []) {
        const clean = raw.trim();
        if (!clean) continue;
        const key = clean.toLowerCase();
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, { tag: clean, count: 1 });
        }
      }
    }
    return Array.from(counts.values()).sort((a, b) =>
      b.count !== a.count ? b.count - a.count : a.tag.localeCompare(b.tag)
    );
  }, [allNotes, notes]);

  useEffect(() => {
    if (
      selectedTag &&
      !availableTags.some((t) => t.tag.toLowerCase() === selectedTag.toLowerCase())
    ) {
      setSelectedTag(null);
    }
  }, [availableTags, selectedTag]);

  const dashboardNotes = useMemo(() => {
    const pool = allNotes.length > 0 ? allNotes : notes;
    const filtered = selectedTag
      ? pool.filter((n) =>
          (n.tags ?? []).some((t) => t.toLowerCase() === selectedTag.toLowerCase())
        )
      : pool;
    const sorted = [...filtered];
    if (notesTab === 'Suggested') {
      sorted.sort((a, b) => b.content.length - a.content.length);
    }
    return sorted.slice(0, 12);
  }, [allNotes, notes, notesTab, selectedTag]);

  const upcomingEvents = useMemo(
    () => events.map((ev) => toCalendarEvent(ev)),
    [events]
  );

  const searchableNotes = allNotes.length > 0 ? allNotes : notes;

  const searchResults: SearchResult[] = useMemo(
    () =>
      searchLocalNotesAndFolders(searchQuery, searchableNotes, folders, {
        includeFolders: true,
        limit: SEARCH_RESULT_LIMIT,
      }),
    [searchQuery, searchableNotes, folders]
  );

  const handleSelectSearchResult = async (result: SearchResult) => {
    setSearchQuery('');
    setSearchModalOpen(false);
    setModalSearchQuery('');
    if (result.kind === 'folder') {
      const folderId = result.key.replace(/^folder:/, '');
      await setSelectedFolder(folderId);
      setActiveNav('Notes');
      if (isMobile) setSidebarOpen(false);
    } else {
      const noteId = Number(result.key.replace(/^note:/, ''));
      const found =
        searchableNotes.find((n) => n.id === noteId) ??
        notes.find((n) => n.id === noteId);
      if (found) {
        if (found.folderId !== selectedFolderId) {
          await setSelectedFolder(found.folderId);
        }
        focusNote(found, true);
      }
    }
  };

  const handleAddTask = () => {
    const trimmed = newTask.trim();
    if (!trimmed) return;
    setTasks((prev) => [
      { id: Date.now(), label: trimmed, sourceNote: 'Quick task', done: false },
      ...prev,
    ]);
    setNewTask('');
  };

  const handleToggleTask = (id: number) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const handleSaveScratchToFolder = async (folderId: string) => {
    const trimmed = scratch.trim();
    if (!trimmed) return;
    const derived = deriveTitle(trimmed);
    const firstLine = trimmed.split('\n')[0]?.replace(/^#+\s*/, '').trim() || 'Scratch note';
    const created = await createNote({
      title: derived || firstLine.slice(0, 48),
      content: trimmed,
      tags: [],
      folderId,
    });
    setSaveScratchOpen(false);
    setScratch('');
    if (created) {
      await setSelectedFolder(folderId);
      if (openNewNote) focusNote(created, true);
    }
  };

  const handleSaveEventDraft = async (draft: EventDraft) => {
    if (eventModal.event) {
      await updateEvent(eventModal.event.id, draft);
    } else {
      await createEvent(draft);
    }
    setEventModal({ visible: false, event: null, anchorDate: null });
  };

  const handleExportData = async (): Promise<boolean> => {
    flushPendingSync();
    const exportNotes = allNotes.length > 0 ? allNotes : notes;
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        folders,
        notes: exportNotes,
        events,
        tasks,
        scratch,
      },
      null,
      2
    );
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simplicity-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore download block if any
    }
    await copyToClipboard(payload);
    return true;
  };

  const handleImportNotes = async ({
    notes: importedNotes,
    folders: importedFolders,
    targetFolderId,
    matchOriginalFolders,
  }: {
    notes: ImportedNoteItem[];
    folders: ImportedFolderItem[];
    targetFolderId: string;
    matchOriginalFolders: boolean;
  }): Promise<number> => {
    flushPendingSync();
    const fallbackFolderId = targetFolderId || ROOT_FOLDER_ID;
    const existingById = new Map(folders.map((f) => [f.id, f]));
    const existingByLabel = new Map(folders.map((f) => [f.label.trim().toLowerCase(), f]));
    const importedFolderLabels = new Map(importedFolders.map((f) => [f.id, f.label]));
    const createdByLabel = new Map<string, string>();

    const prepared: Array<{
      title: string;
      content: string;
      tags: string[];
      folderId: string;
      isPinned?: boolean;
      createdAt?: string;
      updatedAt?: string;
    }> = [];

    for (const item of importedNotes) {
      let resolvedFolderId = fallbackFolderId;
      if (matchOriginalFolders) {
        if (item.folderId && existingById.has(item.folderId)) {
          resolvedFolderId = item.folderId;
        } else {
          const desiredLabel = (
            item.folderLabel?.trim() ||
            (item.folderId ? importedFolderLabels.get(item.folderId)?.trim() : '') ||
            ''
          ).trim();
          if (desiredLabel) {
            const key = desiredLabel.toLowerCase();
            const existing = existingByLabel.get(key);
            const alreadyCreated = createdByLabel.get(key);
            if (existing) {
              resolvedFolderId = existing.id;
            } else if (alreadyCreated) {
              resolvedFolderId = alreadyCreated;
            } else {
              const createdFolder = await createFolder(desiredLabel, ROOT_FOLDER_ID);
              if (createdFolder) {
                createdByLabel.set(key, createdFolder.id);
                resolvedFolderId = createdFolder.id;
              }
            }
          }
        }
      }

      prepared.push({
        title: item.title,
        content: item.content,
        tags: item.tags,
        folderId: resolvedFolderId,
        isPinned: item.isPinned,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }

    const created = await importNotes(prepared);
    if (created.length > 0 && activeNav === 'Notes' && fallbackFolderId !== selectedFolderId) {
      await setSelectedFolder(fallbackFolderId);
    }
    return created.length;
  };

  const handleCreateNoteFromTemplate = useCallback(
    async (resolvedTitle: string, resolvedContent: string, template: NoteTemplate) => {
      flushPendingSync();
      const targetFolder = selectedFolderId ?? ROOT_FOLDER_ID;
      const created = await createNote({
        title: resolvedTitle || template.name || 'Untitled',
        content: resolvedContent,
        tags: [...template.tags],
        folderId: targetFolder,
      });
      if (!created) return;
      focusNote(created, true);
    },
    [flushPendingSync, selectedFolderId, createNote, focusNote]
  );

  const handleInsertTemplateAtCursor = useCallback((resolvedContent: string) => {
    templateInsertSeqRef.current += 1;
    setTemplateInsertRequest({
      seq: templateInsertSeqRef.current,
      text: resolvedContent,
    });
  }, []);

  const fabActions: FabAction[] = [
    {
      label: 'New Note',
      iconName: 'note',
      onPress: () => {
        setFabOpen(false);
        void handleCreateNote();
      },
    },
    {
      label: 'New Task',
      iconName: 'task',
      onPress: () => {
        setFabOpen(false);
        setActiveNav('Overview');
        requestAnimationFrame(() => {
          const input = document.querySelector<HTMLInputElement>('input[aria-label="New task"]');
          if (input) {
            input.focus();
          } else {
            document.querySelector<HTMLButtonElement>('button[aria-label="Add task"]')?.click();
          }
        });
      },
    },
    {
      label: 'New Event',
      iconName: 'event',
      onPress: () => {
        setFabOpen(false);
        setEventModal({
          visible: true,
          event: null,
          anchorDate: nextFreeSlot(agendaAnchor, events),
        });
      },
    },
  ];

  const overviewMenuActions: ContextMenuAction[] = [
    {
      label: 'Customize overview',
      iconName: 'view-dashboard-edit-outline',
      onPress: () => setCustomizeOpen(true),
    },
    {
      label: 'Export notes',
      iconName: 'download',
      onPress: () => setPortabilityModal({ visible: true, tab: 'export' }),
    },
    {
      label: 'Import notes',
      iconName: 'upload',
      onPress: () => setPortabilityModal({ visible: true, tab: 'import' }),
    },
  ];

  const rawFullName = user?.fullName?.trim() ?? '';
  const isGenericUserPlaceholder = /^(workspace|user)$/i.test(rawFullName);
  const userName = displayName.trim() || (!isGenericUserPlaceholder ? rawFullName : '');
  const activeFolderLabel = folders.find((f) => f.id === selectedFolderId)?.label ?? 'Notes';

  const handleSelectNav = (key: ScreenKey) => {
    if (activeNav === 'Notes' && key !== 'Notes') {
      flushPendingSync();
    }
    setActiveNav(key);
    if (isMobile) setSidebarOpen(false);
  };

  const showTopHeader = activeNav === 'Overview' || activeNav === 'Settings';
  const showCapsuleDock = activeNav !== 'Settings';

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: theme.background,
        color: theme.text,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {sidebarOpen ? (
        isMobile ? (
          <>
            <div
              onClick={() => setSidebarOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 30,
                backgroundColor: theme.scrim,
                backdropFilter: 'blur(3px)',
              }}
            />
            <div
              style={{
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: 0,
                zIndex: 31,
                display: 'flex',
              }}
            >
              <Sidebar
                theme={theme}
                activeNav={activeNav}
                themeName={themeName}
                width={Math.min(sidebarWidth, Math.max(240, windowWidth - 56))}
                resizable={false}
                folders={folders}
                onResize={setSidebarWidth}
                onResizeCommit={commitSidebarWidth}
                selectedFolderId={selectedFolderId}
                noteCounts={noteCounts}
                onToggle={() => setSidebarOpen(false)}
                onSelectNav={handleSelectNav}
                onSelectTheme={setThemeName}
                onSelectFolder={(folderId) => {
                  void setSelectedFolder(folderId);
                  setActiveNav('Notes');
                  setIsEditorOpen(false);
                  setSidebarOpen(false);
                }}
                onCreateNote={(folderId) => void handleCreateNote(folderId)}
                onCreateFolder={(parentId, label) => void createFolder(label, parentId)}
                onRenameFolder={(folderId, label) => void renameFolder(folderId, label)}
                onMoveFolder={(folderId) => {
                  const f: Folder | undefined = folders.find((item) => item.id === folderId);
                  if (f) setMoveTarget({ kind: 'folder', id: f.id, parentId: f.parentId });
                }}
                onDuplicateFolder={(folderId) => void duplicateFolder(folderId)}
                onDeleteFolder={requestDeleteFolder}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                searchResults={searchResults}
                onSelectSearchResult={handleSelectSearchResult}
                onCloseSearch={() => setSearchQuery('')}
              />
            </div>
          </>
        ) : (
          <Sidebar
            theme={theme}
            activeNav={activeNav}
            themeName={themeName}
            width={sidebarWidth}
            resizable
            folders={folders}
            onResize={setSidebarWidth}
            onResizeCommit={commitSidebarWidth}
            selectedFolderId={selectedFolderId}
            noteCounts={noteCounts}
            onToggle={() => setSidebarOpen(false)}
            onSelectNav={handleSelectNav}
            onSelectTheme={setThemeName}
            onSelectFolder={(folderId) => {
              void setSelectedFolder(folderId);
              setActiveNav('Notes');
              setIsEditorOpen(false);
            }}
            onCreateNote={(folderId) => void handleCreateNote(folderId)}
            onCreateFolder={(parentId, label) => void createFolder(label, parentId)}
            onRenameFolder={(folderId, label) => void renameFolder(folderId, label)}
            onMoveFolder={(folderId) => {
              const f: Folder | undefined = folders.find((item) => item.id === folderId);
              if (f) setMoveTarget({ kind: 'folder', id: f.id, parentId: f.parentId });
            }}
            onDuplicateFolder={(folderId) => void duplicateFolder(folderId)}
            onDeleteFolder={requestDeleteFolder}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchResults={searchResults}
            onSelectSearchResult={handleSelectSearchResult}
            onCloseSearch={() => setSearchQuery('')}
          />
        )
      ) : null}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative',
        }}
      >
        {showTopHeader ? (
          <TopHeader
            theme={theme}
            isMobile={isMobile}
            userName={userName}
            greetingText={greeting(greetingHour)}
            showGreeting={activeNav === 'Overview'}
            showSidebarToggle={!sidebarOpen}
            onOpenSearch={activeNav === 'Overview' ? () => setSearchModalOpen(true) : undefined}
            onRefresh={
              activeNav === 'Overview'
                ? async () => {
                    await Promise.all([getAllNotes(), refreshNoteCounts(), initializeEvents()]);
                  }
                : undefined
            }
            onUpdateUserName={setDisplayName}
            onBack={
              activeNav === 'Settings'
                ? () => {
                    if (!settingsRef.current?.goBack()) {
                      setActiveNav('Overview');
                    }
                  }
                : undefined
            }
            onToggleSidebar={() => setSidebarOpen((o) => !o)}
            menuActions={activeNav === 'Overview' ? overviewMenuActions : undefined}
          />
        ) : null}

        {showCapsuleDock && dockPosition === 'top' ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '8px 16px',
              flexShrink: 0,
            }}
          >
            <CapsuleSwitcher
              theme={theme}
              active={activeNav}
              onSelect={handleSelectNav}
              variant={dockVariant}
            />
          </div>
        ) : null}

        {activeNav === 'Overview' ? (
          <OverviewScreen
            theme={theme}
            isMobile={isMobile}
            isLoading={isLoadingNotes && notes.length === 0}
            layout={layout}
            order={order}
            notesTab={notesTab}
            onNotesTab={setNotesTab}
            dashboardNotes={dashboardNotes}
            folders={folders}
            onOpenNote={(note) => focusNote(note, true)}
            actions={noteCardActions}
            availableTags={availableTags}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            upcomingEvents={upcomingEvents}
            tasks={tasks}
            newTask={newTask}
            onNewTaskChange={setNewTask}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            scratch={scratch}
            onScratchChange={setScratch}
            onSaveScratch={() => setSaveScratchOpen(true)}
            showSectionTitles={showSectionTitles}
          />
        ) : null}

        {activeNav === 'Notes' ? (
          <NotesScreen
            theme={theme}
            notes={notes}
            selected={activeNote}
            tabs={noteTabs}
            folderLabel={activeFolderLabel}
            listWidth={listWidth}
            onResizeList={setListWidth}
            onResizeListCommit={commitListWidth}
            isMobile={isMobile}
            isEditorOpen={isEditorOpen}
            isListCollapsed={isListCollapsed}
            onSelect={(note) => focusNote(note, false)}
            onSelectTab={(id) => {
              const found = allNotes.find((n) => n.id === id) ?? notes.find((n) => n.id === id);
              if (found) focusNote(found, false);
            }}
            onCloseTab={handleCloseTab}
            onNewTab={() => void handleCreateNote()}
            onStepTab={handleStepTab}
            onOpenEditor={() => setIsEditorOpen(true)}
            onCloseEditor={() => {
              if (isMobile) {
                setIsEditorOpen(false);
              } else {
                setIsListCollapsed((c) => !c);
              }
            }}
            onContentChange={handleNoteContentChange}
            onDelete={() => {
              if (activeNote) requestDeleteNote(activeNote.id);
            }}
            saveStatus={saveStatus}
            onSaveNow={() => void flushPendingSave()}
            onMoveNote={(noteId) => {
              const n = allNotes.find((item) => item.id === noteId) ?? notes.find((item) => item.id === noteId);
              if (n) setMoveTarget({ kind: 'note', id: n.id, currentFolderId: n.folderId });
            }}
            onDuplicateNote={(noteId) => void duplicateNote(noteId)}
            onDeleteNote={requestDeleteNote}
            onRenameNote={(noteId, title) => {
              if (activeNoteId === noteId) flushPendingSync();
              void updateNote(noteId, { title });
            }}
            onTogglePinNote={(noteId) => {
              void togglePinNote(noteId);
            }}
            onOpenPortability={(tab) => setPortabilityModal({ visible: true, tab })}
            onToggleSidebar={!sidebarOpen ? () => setSidebarOpen(true) : undefined}
            templates={templates}
            onOpenTemplates={(opts) =>
              setTemplatesModal({
                visible: true,
                initialView: opts?.initialView ?? 'browse',
                initialTemplateId: opts?.initialTemplateId,
                liveTitle: opts?.liveTitle,
                liveContent: opts?.liveContent,
              })
            }
            onCreateNoteFromTemplate={handleCreateNoteFromTemplate}
            insertRequest={templateInsertRequest}
          />
        ) : null}

        {activeNav === 'Agenda' ? (
          <AgendaScreen
            theme={theme}
            isMobile={isMobile}
            anchor={agendaAnchor}
            onAnchorChange={setAgendaAnchor}
            events={events}
            onCreateEvent={(start) =>
              setEventModal({ visible: true, event: null, anchorDate: start })
            }
            onOpenEvent={(ev) =>
              setEventModal({ visible: true, event: ev, anchorDate: null })
            }
            onDeleteEvent={(id) => {
              if (!confirmDelete) {
                void softDeleteEvent(id);
                return;
              }
              setConfirmState({
                title: 'Delete event?',
                message: 'Remove this event from your agenda?',
                confirmLabel: 'Delete',
                onConfirm: () => {
                  setConfirmState(null);
                  void softDeleteEvent(id);
                },
              });
            }}
            tasks={tasks}
            newTask={newTask}
            onNewTaskChange={setNewTask}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onToggleSidebar={!sidebarOpen ? () => setSidebarOpen(true) : undefined}
          />
        ) : null}

        {activeNav === 'Settings' ? (
          <SettingsScreen
            ref={settingsRef}
            theme={theme}
            isMobile={isMobile}
            onExportData={handleExportData}
            onOpenPortability={(tab) => setPortabilityModal({ visible: true, tab })}
          />
        ) : null}

        {showCapsuleDock && dockPosition === 'bottom' ? (
          <div
            style={{
              position: 'fixed',
              bottom: 24,
              left: sidebarOpen && !isMobile ? sidebarWidth : 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 18,
            }}
          >
            <div style={{ pointerEvents: 'auto' }}>
              <CapsuleSwitcher
                theme={theme}
                active={activeNav}
                onSelect={handleSelectNav}
                variant={dockVariant}
              />
            </div>
          </div>
        ) : null}

        {showCapsuleDock ? (
          <FloatingActionFab
            theme={theme}
            isOpen={fabOpen}
            onToggle={() => setFabOpen((o) => !o)}
            actions={fabActions}
            variant={fabVariant}
          />
        ) : null}
      </div>

      <CustomizeOverview
        theme={theme}
        visible={customizeOpen}
        order={order}
        isSectionVisible={(id) => layout[id]}
        onToggle={toggleSection}
        onReorder={reorderSections}
        onClose={() => setCustomizeOpen(false)}
      />

      <MoveToModal
        visible={moveTarget !== null}
        theme={theme}
        title={moveTarget?.kind === 'note' ? 'Move note to folder' : 'Move folder'}
        folders={folders}
        currentFolderId={
          moveTarget?.kind === 'note'
            ? moveTarget.currentFolderId
            : moveTarget?.parentId ?? undefined
        }
        excludeFolderId={moveTarget?.kind === 'folder' ? moveTarget.id : undefined}
        onSelect={(folderId) => {
          if (!moveTarget) return;
          if (moveTarget.kind === 'note') {
            void moveNote(moveTarget.id, folderId);
          } else {
            void moveFolder(moveTarget.id, folderId);
          }
          setMoveTarget(null);
        }}
        onCancel={() => setMoveTarget(null)}
      />

      <ConfirmDialog
        visible={confirmState !== null}
        theme={theme}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        confirmLabel={confirmState?.confirmLabel ?? 'Delete'}
        destructive
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />

      <SaveScratchDialog
        theme={theme}
        visible={saveScratchOpen}
        folders={folders}
        tree={folderTree}
        defaultFolderId={selectedFolderId}
        preview={scratch.trim() || 'Empty note'}
        onConfirm={(folderId) => void handleSaveScratchToFolder(folderId)}
        onDismiss={() => setSaveScratchOpen(false)}
      />

      <EventEditorDialog
        theme={theme}
        visible={eventModal.visible}
        event={eventModal.event}
        events={events}
        anchorDate={eventModal.anchorDate}
        onSave={(draft) => void handleSaveEventDraft(draft)}
        onSaveDraft={(draft) => void handleSaveEventDraft(draft)}
        onDismiss={() => setEventModal({ visible: false, event: null, anchorDate: null })}
      />
      <SearchModal
        visible={searchModalOpen}
        theme={theme}
        notes={searchableNotes}
        folders={folders}
        query={modalSearchQuery}
        onQueryChange={setModalSearchQuery}
        onSelectResult={(result) => void handleSelectSearchResult(result)}
        onClose={() => {
          setSearchModalOpen(false);
          setModalSearchQuery('');
        }}
      />

      {(() => {
        const editingNote =
          editingTagsNoteId !== null
            ? (allNotes.find((n) => n.id === editingTagsNoteId) ??
                notes.find((n) => n.id === editingTagsNoteId) ??
                null)
            : null;
        return (
          <TagEditorModal
            visible={editingNote !== null}
            theme={theme}
            noteTitle={editingNote?.title ?? ''}
            tags={editingNote?.tags ?? []}
            availableTags={availableTags.map((t) => t.tag)}
            onSave={(nextTags) => {
              if (editingNote) {
                void updateNote(editingNote.id, { tags: nextTags });
              }
              setEditingTagsNoteId(null);
            }}
            onCancel={() => setEditingTagsNoteId(null)}
          />
        );
      })()}
      <ImportExportModal
        visible={portabilityModal.visible}
        initialTab={portabilityModal.tab}
        theme={theme}
        allNotes={allNotes.length > 0 ? allNotes : notes}
        folders={folders}
        selectedFolderId={selectedFolderId}
        activeNote={activeNote}
        onFlushPending={flushPendingSync}
        onImport={handleImportNotes}
        onClose={() => setPortabilityModal((prev) => ({ ...prev, visible: false }))}
      />
      <TemplatesModal
        visible={templatesModal.visible}
        theme={theme}
        templates={templates}
        initialView={templatesModal.initialView}
        initialTemplateId={templatesModal.initialTemplateId ?? null}
        activeNoteTitle={templatesModal.liveTitle ?? activeNote?.title}
        activeNoteContent={templatesModal.liveContent ?? activeNote?.content}
        activeNoteTags={activeNote?.tags}
        hasActiveNote={activeNote !== null}
        onInsertAtCursor={handleInsertTemplateAtCursor}
        onCreateNoteFromTemplate={handleCreateNoteFromTemplate}
        onCreateTemplate={createTemplate}
        onUpdateTemplate={updateTemplate}
        onDeleteTemplate={deleteTemplate}
        onResetBuiltIns={resetBuiltInTemplates}
        onClose={() => setTemplatesModal((prev) => ({ ...prev, visible: false }))}
      />
    </div>
  );
}
