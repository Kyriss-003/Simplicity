import type { FlatFolderRow, Folder, FolderNode } from './types';

export function deriveTitle(content: string): string {
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*#{1,6}\s+(.+?)\s*#*\s*$/);
    if (m) return m[1].trim();
  }
  return '';
}

export function previewLines(content: string, max = 3): string[] {
  if (!content || !content.trim()) return [];
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\s*#{1,6}\s+/.test(l))
    .map((l) => l.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, ''))
    .filter((l) => l.length > 0)
    .slice(0, max);
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function greeting(hour: number = new Date().getHours()): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const byParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const list = byParent.get(f.parentId) ?? [];
    list.push(f);
    byParent.set(f.parentId, list);
  }
  const toNode = (f: Folder): FolderNode => {
    const kids = byParent.get(f.id) ?? [];
    return {
      id: f.id,
      label: f.label,
      ...(kids.length > 0 ? { children: kids.map(toNode) } : {}),
    };
  };
  return (byParent.get(null) ?? []).map(toNode);
}

export function flattenTree(nodes: FolderNode[], depth = 0): FlatFolderRow[] {
  const rows: FlatFolderRow[] = [];
  for (const node of nodes) {
    rows.push({ node, depth });
    if (node.children?.length) {
      rows.push(...flattenTree(node.children, depth + 1));
    }
  }
  return rows;
}

export function collectSubtreeIds(folders: Folder[], rootId: string): string[] {
  const result: string[] = [];
  const visit = (id: string): void => {
    result.push(id);
    folders.filter((f) => f.parentId === id).forEach((child) => visit(child.id));
  };
  visit(rootId);
  return result;
}
