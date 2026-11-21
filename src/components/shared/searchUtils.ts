import type { Folder, Note } from '../../types';
import { relativeTime } from '../../utils';

export interface SearchResult {
  key: string;
  kind: 'note' | 'folder';
  label: string;
  sublabel: string;
  snippet?: string;
  updatedLabel?: string;
  matchReason?: 'title' | 'content' | 'both';
}

export const SIDEBAR_SEARCH_LIMIT = 8;
export const MODAL_SEARCH_LIMIT = 24;

function stripMarkdownNoise(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ' '))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[#>*\-\s]+/gm, '')
    .replace(/[`*_~=]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildContentSnippet(content: string, query: string, tokens: string[]): string | undefined {
  if (!content.trim()) return undefined;
  const lines = content.split('\n');
  const lowerQuery = query.toLowerCase();

  let bestLine = '';
  for (const rawLine of lines) {
    const cleaned = stripMarkdownNoise(rawLine);
    if (!cleaned) continue;
    const lowerLine = cleaned.toLowerCase();
    if (lowerLine.includes(lowerQuery) || tokens.some((t) => lowerLine.includes(t))) {
      bestLine = cleaned;
      break;
    }
  }

  const source = bestLine || stripMarkdownNoise(content);
  if (!source) return undefined;

  const lowerSource = source.toLowerCase();
  let matchAt = lowerSource.indexOf(lowerQuery);
  if (matchAt === -1) {
    for (const token of tokens) {
      const idx = lowerSource.indexOf(token);
      if (idx !== -1 && (matchAt === -1 || idx < matchAt)) {
        matchAt = idx;
      }
    }
  }

  const maxLen = 100;
  if (source.length <= maxLen || matchAt === -1) {
    return source.length > maxLen ? `${source.slice(0, maxLen - 1)}…` : source;
  }

  const start = Math.max(0, matchAt - 32);
  const end = Math.min(source.length, start + maxLen);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';
  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
}

export function searchLocalNotesAndFolders(
  rawQuery: string,
  notes: readonly Note[],
  folders: readonly Folder[],
  options: { includeFolders?: boolean; limit?: number } = {}
): SearchResult[] {
  const query = rawQuery.trim();
  if (!query) return [];

  const { includeFolders = true, limit = MODAL_SEARCH_LIMIT } = options;
  const lowerQuery = query.toLowerCase();
  const tokens = lowerQuery.split(/\s+/).filter(Boolean);

  const folderMap = new Map<string, string>();
  for (const f of folders) {
    folderMap.set(f.id, f.label);
  }

  const scoredNotes: { score: number; updatedAt: string; result: SearchResult }[] = [];

  for (const note of notes) {
    const title = note.title || 'Untitled';
    const lowerTitle = title.toLowerCase();
    const lowerContent = (note.content || '').toLowerCase();
    const lowerTags = (note.tags ?? []).map((t) => `${t} #${t}`.toLowerCase()).join(' ');
    const combined = `${lowerTitle}\n${lowerContent}\n${lowerTags}`;

    const matchesAll = tokens.every((t) => combined.includes(t));
    if (!matchesAll) continue;

    const titleMatches = tokens.some((t) => lowerTitle.includes(t));
    const contentMatches = tokens.some((t) => lowerContent.includes(t));
    const tagMatches = tokens.some((t) => lowerTags.includes(t));

    let score = 0;
    if (lowerTitle === lowerQuery) score += 120;
    else if (lowerTitle.startsWith(lowerQuery)) score += 70;
    else if (lowerTitle.includes(lowerQuery)) score += 45;
    else if (tokens.every((t) => lowerTitle.includes(t))) score += 30;
    else if (titleMatches) score += 15;

    if (tagMatches) score += 25;
    if (lowerContent.includes(lowerQuery)) score += 20;
    else if (contentMatches) score += 10;

    const folderLabel = folderMap.get(note.folderId) ?? 'Main';
    const snippet = buildContentSnippet(note.content, query, tokens);

    scoredNotes.push({
      score,
      updatedAt: note.updatedAt,
      result: {
        key: `note:${note.id}`,
        kind: 'note',
        label: title,
        sublabel: folderLabel,
        snippet,
        updatedLabel: relativeTime(note.updatedAt),
        matchReason:
          titleMatches && contentMatches ? 'both' : titleMatches ? 'title' : 'content',
      },
    });
  }

  scoredNotes.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const folderResults: SearchResult[] = [];
  if (includeFolders) {
    for (const folder of folders) {
      const lowerLabel = folder.label.toLowerCase();
      if (tokens.every((t) => lowerLabel.includes(t))) {
        folderResults.push({
          key: `folder:${folder.id}`,
          kind: 'folder',
          label: folder.label,
          sublabel: 'Folder',
        });
      }
    }
  }

  return [...scoredNotes.map((item) => item.result), ...folderResults].slice(0, limit);
}

export function splitHighlightParts(
  text: string,
  query: string
): { text: string; matched: boolean }[] {
  const trimmed = query.trim();
  if (!trimmed || !text) return [{ text, matched: false }];

  const tokens = Array.from(
    new Set(
      trimmed
        .split(/\s+/)
        .filter((t) => t.length > 0)
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    )
  );
  if (tokens.length === 0) return [{ text, matched: false }];

  const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
  const parts: { text: string; matched: boolean }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), matched: false });
    }
    if (match[0].length > 0) {
      parts.push({ text: match[0], matched: true });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), matched: false });
  }

  return parts.length > 0 ? parts : [{ text, matched: false }];
}
