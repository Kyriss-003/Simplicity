import { buildFolderTree, flattenTree } from '../src/hooks/useFolderTree';

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: { glyphMap: {} } }));

const folders = [
  { id: 'main', uuid: 'u1', label: 'Main', parentId: null, createdAt: '', updatedAt: '', isDeleted: false },
  { id: 'a', uuid: 'u2', label: 'Work', parentId: 'main', createdAt: '', updatedAt: '', isDeleted: false },
  { id: 'b', uuid: 'u3', label: 'Deep', parentId: 'a', createdAt: '', updatedAt: '', isDeleted: false },
  { id: 'c', uuid: 'u4', label: 'Personal', parentId: 'main', createdAt: '', updatedAt: '', isDeleted: false },
];

describe('buildFolderTree', () => {
  it('nests children under their parent', () => {
    const roots = buildFolderTree(folders);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.id).toBe('main');
    expect(roots[0]!.children!.map((c) => c.id).sort()).toEqual(['a', 'c']);
    expect(roots[0]!.children!.find((c) => c.id === 'a')!.children![0]!.id).toBe('b');
  });

  it('attaches orphans to the root so a bad parent id cannot hide a folder', () => {
    const roots = buildFolderTree([...folders, { ...folders[0]!, id: 'orphan', parentId: 'ghost' }]);
    expect(roots.map((r) => r.id).sort()).toEqual(['main', 'orphan']);
  });
});

describe('flattenTree', () => {
  it('returns depth-first rows with correct depth', () => {
    const rows = flattenTree(buildFolderTree(folders));
    expect(rows.map((r) => [r.node.id, r.depth])).toEqual([
      ['main', 0],
      ['a', 1],
      ['b', 2],
      ['c', 1],
    ]);
  });

  it('excludes a subtree and does not descend into it', () => {
    const rows = flattenTree(buildFolderTree(folders), 0, 'a');
    expect(rows.map((r) => r.node.id)).toEqual(['main', 'c']);
  });
});
