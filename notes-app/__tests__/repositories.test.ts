jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import { FolderRepository, ROOT_FOLDER_ID } from '../src/db/FolderRepository';
import { NoteRepository } from '../src/db/NoteRepository';

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
