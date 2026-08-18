import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Folder } from '../db/FolderRepository';

/** Folder tree node built from the persisted flat folder list. */
export interface FolderNode {
  id: string;
  label: string;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  children?: FolderNode[];
}

/**
 * Pure helpers over the persisted folder list. Mutations live in
 * `useNoteStore` / `FolderRepository` — this module only builds and
 * interrogates the in-memory tree the UI renders.
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

/** Depth-first search for a node by id. */
export function findNode(nodes: FolderNode[], id: string): FolderNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = node.children ? findNode(node.children, id) : null;
    if (found) return found;
  }
  return null;
}

/** Flattened row for rendering a hierarchy with indentation. */
export interface FlatFolderRow {
  node: FolderNode;
  depth: number;
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

/** All node ids in the subtree rooted at `rootId` (inclusive). */
export function subtreeIds(nodes: FolderNode[], rootId: string): string[] {
  const target = findNode(nodes, rootId);
  if (!target) return [];
  const ids: string[] = [];
  const visit = (node: FolderNode): void => {
    ids.push(node.id);
    node.children?.forEach(visit);
  };
  visit(target);
  return ids;
}
