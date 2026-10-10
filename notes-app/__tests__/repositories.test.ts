jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import { FolderRepository, ROOT_FOLDER_ID, collectSubtreeIds } from '../src/db/FolderRepository';
import { NoteRepository } from '../src/db/NoteRepository';
import { EventRepository } from '../src/db/EventRepository';

/**
 * The repositories hydrate their in-memory cache from `localStorage` only in the
 * constructor, so each test constructs its own instances against cleared storage
 * to get an isolated copy.
 */

beforeEach(() => {
  localStorage.clear();
});

describe('FolderRepository', () => {
  it('seeds a single root folder labeled "Main"', async () => {
    const folderRepository = new FolderRepository();
    const all = await folderRepository.getAllFolders();
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(ROOT_FOLDER_ID);
    expect(all[0]!.label).toBe('Main');
    expect(all[0]!.parentId).toBeNull();
  });

  it('refuses to rename the root folder', async () => {
    const folderRepository = new FolderRepository();
    await folderRepository.getAllFolders();
    expect(await folderRepository.renameFolder(ROOT_FOLDER_ID, 'Hijacked')).toBeNull();
    const all = await folderRepository.getAllFolders();
    expect(all[0]!.label).toBe('Main');
  });

  it('refuses to move, duplicate, or delete the root folder', async () => {
    const folderRepository = new FolderRepository();
    await folderRepository.getAllFolders();
    expect(await folderRepository.moveFolder(ROOT_FOLDER_ID, 'other')).toBe(false);
    expect(await folderRepository.duplicateFolder(ROOT_FOLDER_ID)).toBeNull();
    expect(await folderRepository.softDeleteFolder(ROOT_FOLDER_ID)).toBe(false);
  });

  it('deep-clones a subtree as siblings at the right depth', async () => {
    const folderRepository = new FolderRepository();
    await folderRepository.getAllFolders();
    const work = await folderRepository.createFolder('Work', ROOT_FOLDER_ID);
    await folderRepository.createFolder('Deep', work.id);

    const clone = await folderRepository.duplicateFolder(work.id);
    expect(clone).not.toBeNull();
    expect(clone!.label).toBe('Work copy');
    expect(clone!.parentId).toBe(ROOT_FOLDER_ID);

    const all = await folderRepository.getAllFolders();
    const cloneChildren = all.filter((f) => f.parentId === clone!.id);
    expect(cloneChildren).toHaveLength(1);
    // Only the clone ROOT gets the " copy" suffix; descendants keep their label.
    expect(cloneChildren[0]!.label).toBe('Deep');
  });

  it('rejects a move that would create a cycle', async () => {
    const folderRepository = new FolderRepository();
    await folderRepository.getAllFolders();
    const parent = await folderRepository.createFolder('Parent', ROOT_FOLDER_ID);
    const child = await folderRepository.createFolder('Child', parent.id);
    // Cannot move the parent into its own descendant.
    expect(await folderRepository.moveFolder(parent.id, child.id)).toBe(false);
    const all = await folderRepository.getAllFolders();
    expect(all.find((f) => f.id === parent.id)!.parentId).toBe(ROOT_FOLDER_ID);
  });
});

describe('collectSubtreeIds', () => {
  const rows = [
    { id: 'main', uuid: 'u1', label: 'Main', parentId: null, createdAt: '', updatedAt: '', isDeleted: false },
    { id: 'work', uuid: 'u2', label: 'Work', parentId: 'main', createdAt: '', updatedAt: '', isDeleted: false },
    { id: 'deep', uuid: 'u3', label: 'Deep', parentId: 'work', createdAt: '', updatedAt: '', isDeleted: false },
    { id: 'other', uuid: 'u4', label: 'Other', parentId: 'main', createdAt: '', updatedAt: '', isDeleted: false },
  ];

  it('collects the root and every descendant', () => {
    expect(collectSubtreeIds(rows, 'work').sort()).toEqual(['deep', 'work']);
  });

  it('includes the root itself when asked for the whole tree', () => {
    expect(collectSubtreeIds(rows, 'main').sort()).toEqual(['deep', 'main', 'other', 'work']);
  });

  it('returns just the root for a leaf', () => {
    expect(collectSubtreeIds(rows, 'other')).toEqual(['other']);
  });
});

describe('NoteRepository', () => {
  it('round-trips a note with parsed string[] tags', async () => {
    const noteRepository = new NoteRepository();
    const created = await noteRepository.createNote({
      title: 'Hello',
      content: '# Hi',
      tags: ['work', 'idea'],
      folderId: ROOT_FOLDER_ID,
    });
    expect(created.tags).toEqual(['work', 'idea']);
    expect(created.isDeleted).toBe(false);

    const all = await noteRepository.getAllNotes(ROOT_FOLDER_ID);
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(created.id);
  });

  it('filters by folder', async () => {
    const folderRepository = new FolderRepository();
    const noteRepository = new NoteRepository();
    await folderRepository.getAllFolders();
    const other = await folderRepository.createFolder('Other', ROOT_FOLDER_ID);
    await noteRepository.createNote({ title: 'In main', content: '', tags: [], folderId: ROOT_FOLDER_ID });
    const elsewhere = await noteRepository.createNote({ title: 'In other', content: '', tags: [], folderId: other.id });

    const inMain = await noteRepository.getAllNotes(ROOT_FOLDER_ID);
    expect(inMain.map((n) => n.id)).not.toContain(elsewhere.id);
  });

  it('excludes soft-deleted rows from reads', async () => {
    const noteRepository = new NoteRepository();
    const created = await noteRepository.createNote({
      title: 'Doomed',
      content: '',
      tags: [],
      folderId: ROOT_FOLDER_ID,
    });
    expect(await noteRepository.softDeleteNote(created.id)).toBe(true);
    expect(await noteRepository.getAllNotes(ROOT_FOLDER_ID)).toHaveLength(0);
  });

  it('cascades softDeleteNotesInFolders across a subtree', async () => {
    const folderRepository = new FolderRepository();
    const noteRepository = new NoteRepository();
    await folderRepository.getAllFolders();
    const work = await folderRepository.createFolder('Work', ROOT_FOLDER_ID);
    const deep = await folderRepository.createFolder('Deep', work.id);
    await noteRepository.createNote({ title: 'a', content: '', tags: [], folderId: work.id });
    await noteRepository.createNote({ title: 'b', content: '', tags: [], folderId: deep.id });
    const survivor = await noteRepository.createNote({ title: 'c', content: '', tags: [], folderId: ROOT_FOLDER_ID });

    const changed = await noteRepository.softDeleteNotesInFolders([work.id, deep.id]);
    expect(changed).toBe(2);

    const remaining = await noteRepository.getAllNotes();
    expect(remaining.map((n) => n.id)).toEqual([survivor.id]);
  });
});

describe('EventRepository', () => {
  const at = (h: number, day = 30) => new Date(2026, 8, day, h, 0).toISOString();

  it('creates an event and reads it back', async () => {
    const eventRepository = new EventRepository();
    const created = await eventRepository.createEvent({ title: 'Standup', startsAt: at(9) });
    expect(created.title).toBe('Standup');
    expect(created.notes).toBe('');
    expect(created.durationMinutes).toBe(60);
    expect(created.isPinned).toBe(false);

    const all = await eventRepository.getAllEvents();
    expect(all).toHaveLength(1);
    expect(all[0]!.id).toBe(created.id);
    expect(all[0]!.startsAt).toBe(created.startsAt);
  });

  it('persists event notes through create and update', async () => {
    const eventRepository = new EventRepository();
    const created = await eventRepository.createEvent({
      title: 'Planning',
      notes: 'Bring the roadmap',
      startsAt: at(9),
    });
    expect(created.notes).toBe('Bring the roadmap');

    const updated = await eventRepository.updateEvent(created.id, { notes: 'Bring the revised roadmap' });
    expect(updated?.notes).toBe('Bring the revised roadmap');
    expect((await eventRepository.getAllEvents())[0]?.notes).toBe('Bring the revised roadmap');
  });

  it('returns events soonest first', async () => {
    const eventRepository = new EventRepository();
    await eventRepository.createEvent({ title: 'Later', startsAt: at(17) });
    await eventRepository.createEvent({ title: 'Earlier', startsAt: at(8) });
    const all = await eventRepository.getAllEvents();
    expect(all.map((e) => e.title)).toEqual(['Earlier', 'Later']);
  });

  it('keeps an empty title as a placeholder rather than ""', async () => {
    const eventRepository = new EventRepository();
    const created = await eventRepository.createEvent({ title: '   ', startsAt: at(9) });
    expect(created.title).toBe('Untitled Event');
  });

  it('omits colour entirely when none was given, so the accent can apply', async () => {
    const eventRepository = new EventRepository();
    const created = await eventRepository.createEvent({ title: 'Plain', startsAt: at(9) });
    expect('color' in created).toBe(false);
  });

  it('clamps a duration into a drawable range', async () => {
    const eventRepository = new EventRepository();
    const tiny = await eventRepository.createEvent({ title: 'a', startsAt: at(9), durationMinutes: 1 });
    const huge = await eventRepository.createEvent({
      title: 'b',
      startsAt: at(10),
      durationMinutes: 99999,
    });
    const nonsense = await eventRepository.createEvent({
      title: 'c',
      startsAt: at(11),
      durationMinutes: Number.NaN,
    });
    expect(tiny.durationMinutes).toBe(15);
    expect(huge.durationMinutes).toBe(1440);
    expect(nonsense.durationMinutes).toBe(60);
  });

  it('updates only the fields it is given', async () => {
    const eventRepository = new EventRepository();
    const created = await eventRepository.createEvent({
      title: 'Before',
      startsAt: at(9),
      isPinned: true,
    });
    const updated = await eventRepository.updateEvent(created.id, { title: 'After' });
    expect(updated?.title).toBe('After');
    expect(updated?.startsAt).toBe(created.startsAt);
    expect(updated?.isPinned).toBe(true);
  });

  it('returns null when updating an event that does not exist', async () => {
    const eventRepository = new EventRepository();
    expect(await eventRepository.updateEvent(999, { title: 'Ghost' })).toBeNull();
  });

  it('soft-deletes an event and hides it from reads', async () => {
    const eventRepository = new EventRepository();
    const created = await eventRepository.createEvent({ title: 'Gone', startsAt: at(9) });
    expect(await eventRepository.softDeleteEvent(created.id)).toBe(true);
    expect(await eventRepository.getAllEvents()).toHaveLength(0);
  });

  it('reports false when deleting an event that is already gone', async () => {
    const eventRepository = new EventRepository();
    expect(await eventRepository.softDeleteEvent(999)).toBe(false);
  });

  it('does not disturb notes — the two collections share storage, not a key', async () => {
    const eventRepository = new EventRepository();
    const noteRepository = new NoteRepository();
    await eventRepository.createEvent({ title: 'Event', startsAt: at(9) });
    await noteRepository.createNote({ title: 'Note', content: '', tags: [], folderId: ROOT_FOLDER_ID });
    expect(await eventRepository.getAllEvents()).toHaveLength(1);
    expect(await noteRepository.getAllNotes()).toHaveLength(1);
  });

  it('survives a corrupt localStorage payload', async () => {
    localStorage.setItem('notes_app_events', 'not json');
    const eventRepository = new EventRepository();
    expect(await eventRepository.getAllEvents()).toEqual([]);
  });
});
