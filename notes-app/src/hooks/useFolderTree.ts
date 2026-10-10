import type { FlatFolderRow, Folder, FolderNode } from '../types';

/**
 * Pure helpers over the persisted folder list. Mutations live in
 * `useNoteStore` / `FolderRepository` — this module only builds and flattens the
 * in-memory tree the UI renders.
 *
 * There is deliberately no `findNode` / `subtreeIds` here. Both existed and both
 * were dead: the only caller of the subtree walk is the folder-delete cascade,
 * which runs in the store and the repository and needs flat `Folder[]` rows, not
 * a `FolderNode` tree. The one canonical implementation lives in
 * `FolderRepository.collectSubtreeIds` and is shared.
 */

/** Build a nested tree from flat folder rows. Orphans attach to the root. */
export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  folders.forEach((folder) => {
    byId.set(folder.id, { id: folder.id, label: folder.label, iconName: 'folder-outline', children: [] });
  });

  const roots: FolderNode[] = [];
  folders.forEach((folder) => {
    const node = byId.get(folder.id)!;
    const parent = folder.parentId ? byId.get(folder.parentId) : undefined;
    if (parent && parent.id !== folder.id) {
      parent.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

/** Flatten a tree depth-first, optionally excluding a subtree by id. */
export function flattenTree(
  nodes: FolderNode[],
  depth = 0,
  excludeId: string | null = null,
  out: FlatFolderRow[] = [],
): FlatFolderRow[] {
  for (const node of nodes) {
    if (node.id === excludeId) continue;
    out.push({ node, depth });
    if (node.children?.length) flattenTree(node.children, depth + 1, excludeId, out);
  }
  return out;
}
