import type { Folder, Note } from '../types';
import { deriveTitle } from '../utils';

export type ExportFormat = 'json' | 'markdown';

export interface ImportedNoteItem {
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  folderLabel?: string;
  folderId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportedFolderItem {
  id: string;
  label: string;
  parentId: string | null;
}

export interface ParsedImportPayload {
  notes: ImportedNoteItem[];
  folders: ImportedFolderItem[];
  warnings: string[];
}

export function slugifyFilename(input: string, fallback = 'note'): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || fallback;
}

export function downloadTextFile(filename: string, content: string, mimeType: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

function escapeYamlString(value: string): string {
  if (/[:#[\]{}&*!|>'"%@`\n]/.test(value) || value.trim() !== value) {
    return JSON.stringify(value);
  }
  return value;
}

export function noteToMarkdown(note: Note, folderLabel?: string): string {
  const lines: string[] = [
    '---',
    `title: ${escapeYamlString(note.title || 'Untitled')}`,
  ];
  if (folderLabel) {
    lines.push(`folder: ${escapeYamlString(folderLabel)}`);
  }
  if (note.tags.length > 0) {
    lines.push(`tags: [${note.tags.map(escapeYamlString).join(', ')}]`);
  }
  if (note.isPinned) {
    lines.push('pinned: true');
  }
  lines.push(`created: ${note.createdAt}`);
  lines.push(`updated: ${note.updatedAt}`);
  lines.push('---', '');

  const body = note.content || '';
  return `${lines.join('\n')}${body}${body.endsWith('\n') ? '' : '\n'}`;
}

export function notesToMarkdownBundle(notes: readonly Note[], folders: readonly Folder[]): string {
  const folderMap = new Map(folders.map((f) => [f.id, f.label]));
  if (notes.length === 1) {
    const single = notes[0]!;
    return noteToMarkdown(single, folderMap.get(single.folderId));
  }

  return notes
    .map((note) => {
      const folderLabel = folderMap.get(note.folderId) ?? 'Main';
      return [
        `<!-- simplicity-note: ${JSON.stringify({
          title: note.title,
          folder: folderLabel,
          folderId: note.folderId,
          tags: note.tags,
          pinned: note.isPinned,
          created: note.createdAt,
          updated: note.updatedAt,
        })} -->`,
        note.content || `# ${note.title || 'Untitled'}`,
      ].join('\n');
    })
    .join('\n\n---\n\n');
}

export function notesToJson(notes: readonly Note[], folders: readonly Folder[]): string {
  const usedFolderIds = new Set(notes.map((n) => n.folderId));
  const exportedFolders = folders
    .filter((f) => usedFolderIds.has(f.id) || f.id === 'main')
    .map((f) => ({
      id: f.id,
      label: f.label,
      parentId: f.parentId,
    }));

  return JSON.stringify(
    {
      format: 'simplicity-notes',
      version: 1,
      exportedAt: new Date().toISOString(),
      folders: exportedFolders,
      notes: notes.map((n) => ({
        id: n.id,
        uuid: n.uuid,
        title: n.title,
        content: n.content,
        tags: n.tags,
        folderId: n.folderId,
        isPinned: Boolean(n.isPinned),
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
    },
    null,
    2
  );
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      if (trimmed.startsWith('"')) return String(JSON.parse(trimmed));
    } catch {
      // fall through
    }
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseMarkdownFrontmatter(raw: string): {
  title?: string;
  folderLabel?: string;
  tags: string[];
  isPinned: boolean;
  createdAt?: string;
  updatedAt?: string;
  body: string;
} {
  const normalized = raw.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { tags: [], isPinned: false, body: normalized };
  }

  const endIdx = normalized.indexOf('\n---\n', 4);
  const eofIdx = endIdx === -1 && normalized.endsWith('\n---') ? normalized.length - 4 : endIdx;
  if (eofIdx === -1) {
    return { tags: [], isPinned: false, body: normalized };
  }

  const headerBlock = normalized.slice(4, eofIdx);
  const body = normalized.slice(eofIdx + 5).replace(/^\n/, '');
  const meta: {
    title?: string;
    folderLabel?: string;
    tags: string[];
    isPinned: boolean;
    createdAt?: string;
    updatedAt?: string;
  } = { tags: [], isPinned: false };

  let readingTagList = false;
  for (const line of headerBlock.split('\n')) {
    if (readingTagList) {
      const bullet = /^\s*-\s+(.+)$/.exec(line);
      if (bullet) {
        const tag = stripWrappingQuotes(bullet[1]!).replace(/^#+/, '').trim();
        if (tag) meta.tags.push(tag);
        continue;
      }
      readingTagList = false;
    }

    const kv = /^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1]!.toLowerCase();
    const val = kv[2]!.trim();

    if (key === 'title' && val) {
      meta.title = stripWrappingQuotes(val);
    } else if (key === 'folder' && val) {
      meta.folderLabel = stripWrappingQuotes(val);
    } else if ((key === 'pinned' || key === 'ispinned') && val) {
      meta.isPinned = val.toLowerCase() === 'true' || val === '1' || val.toLowerCase() === 'yes';
    } else if ((key === 'created' || key === 'createdat' || key === 'created_at') && val) {
      meta.createdAt = stripWrappingQuotes(val);
    } else if ((key === 'updated' || key === 'updatedat' || key === 'updated_at') && val) {
      meta.updatedAt = stripWrappingQuotes(val);
    } else if (key === 'tags') {
      if (!val) {
        readingTagList = true;
      } else if (val.startsWith('[') && val.endsWith(']')) {
        const inner = val.slice(1, -1);
        for (const piece of inner.split(',')) {
          const clean = stripWrappingQuotes(piece).replace(/^#+/, '').trim();
          if (clean) meta.tags.push(clean);
        }
      } else {
        for (const piece of val.split(',')) {
          const clean = stripWrappingQuotes(piece).replace(/^#+/, '').trim();
          if (clean) meta.tags.push(clean);
        }
      }
    }
  }

  return { ...meta, body };
}

function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return base || 'Imported Note';
}

function normalizeJsonNote(raw: unknown, index: number): ImportedNoteItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (obj.isDeleted === true || obj.is_deleted === 1) return null;

  const content = typeof obj.content === 'string' ? obj.content : '';
  const rawTitle = typeof obj.title === 'string' ? obj.title.trim() : '';
  const title = rawTitle || deriveTitle(content) || `Imported Note ${index + 1}`;

  let tags: string[] = [];
  if (Array.isArray(obj.tags)) {
    tags = obj.tags.map((t) => String(t).trim()).filter(Boolean);
  } else if (typeof obj.tags === 'string' && obj.tags.trim()) {
    try {
      const parsed = JSON.parse(obj.tags);
      if (Array.isArray(parsed)) tags = parsed.map((t) => String(t).trim()).filter(Boolean);
    } catch {
      tags = obj.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  const folderId =
    typeof obj.folderId === 'string'
      ? obj.folderId
      : typeof obj.folder_id === 'string'
        ? obj.folder_id
        : undefined;
  const folderLabel = typeof obj.folder === 'string' ? obj.folder.trim() : undefined;
  const isPinned = obj.isPinned === true || obj.is_pinned === 1 || obj.pinned === true;
  const createdAt =
    typeof obj.createdAt === 'string'
      ? obj.createdAt
      : typeof obj.created_at === 'string'
        ? obj.created_at
        : undefined;
  const updatedAt =
    typeof obj.updatedAt === 'string'
      ? obj.updatedAt
      : typeof obj.updated_at === 'string'
        ? obj.updated_at
        : undefined;

  return {
    title,
    content,
    tags,
    isPinned,
    folderId,
    folderLabel,
    createdAt,
    updatedAt,
  };
}

function parseBundledMarkdown(raw: string): ImportedNoteItem[] | null {
  const normalized = raw.replace(/\r\n/g, '\n');
  const markerRe = /^<!-- simplicity-note: (\{.*\}) -->$/gm;
  const matches = Array.from(normalized.matchAll(markerRe));
  if (matches.length === 0) return null;

  const items: ImportedNoteItem[] = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]!;
    const metaStart = match.index ?? 0;
    const contentStart = metaStart + match[0].length + 1;
    const nextStart = i + 1 < matches.length ? (matches[i + 1]!.index ?? normalized.length) : normalized.length;

    let body = normalized.slice(contentStart, nextStart).trimEnd();
    if (i + 1 < matches.length && body.endsWith('\n\n---')) {
      body = body.slice(0, -5).trimEnd();
    }

    try {
      const meta = JSON.parse(match[1]!) as {
        title?: string;
        folder?: string;
        folderId?: string;
        tags?: string[];
        pinned?: boolean;
        created?: string;
        updated?: string;
      };
      items.push({
        title: (meta.title || deriveTitle(body) || `Imported Note ${i + 1}`).trim(),
        content: body,
        tags: Array.isArray(meta.tags) ? meta.tags.map(String).filter(Boolean) : [],
        isPinned: Boolean(meta.pinned),
        folderId: typeof meta.folderId === 'string' ? meta.folderId : undefined,
        folderLabel: typeof meta.folder === 'string' ? meta.folder : undefined,
        createdAt: typeof meta.created === 'string' ? meta.created : undefined,
        updatedAt: typeof meta.updated === 'string' ? meta.updated : undefined,
      });
    } catch {
      items.push({
        title: deriveTitle(body) || `Imported Note ${i + 1}`,
        content: body,
        tags: [],
        isPinned: false,
      });
    }
  }
  return items;
}

export function parseImportedFile(filename: string, rawText: string): ParsedImportPayload {
  const lower = filename.toLowerCase();
  const warnings: string[] = [];

  if (lower.endsWith('.json') || rawText.trimStart().startsWith('{') || rawText.trimStart().startsWith('[')) {
    try {
      const parsed = JSON.parse(rawText) as unknown;
      const folders: ImportedFolderItem[] = [];
      let rawNotes: unknown[] = [];

      if (Array.isArray(parsed)) {
        rawNotes = parsed;
      } else if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.folders)) {
          for (const f of obj.folders) {
            if (f && typeof f === 'object') {
              const fo = f as Record<string, unknown>;
              if (typeof fo.id === 'string' && typeof fo.label === 'string' && fo.isDeleted !== true) {
                folders.push({
                  id: fo.id,
                  label: fo.label,
                  parentId: typeof fo.parentId === 'string' ? fo.parentId : null,
                });
              }
            }
          }
        }
        if (Array.isArray(obj.notes)) {
          rawNotes = obj.notes;
        } else if (typeof obj.content === 'string' || typeof obj.title === 'string') {
          rawNotes = [obj];
        }
      }

      const notes = rawNotes
        .map((item, idx) => normalizeJsonNote(item, idx))
        .filter((n): n is ImportedNoteItem => n !== null);

      if (notes.length === 0) {
        warnings.push(`No valid notes found in "${filename}".`);
      }
      return { notes, folders, warnings };
    } catch {
      if (lower.endsWith('.json')) {
        return {
          notes: [],
          folders: [],
          warnings: [`Could not parse "${filename}" as valid JSON.`],
        };
      }
    }
  }

  const bundled = parseBundledMarkdown(rawText);
  if (bundled && bundled.length > 0) {
    return { notes: bundled, folders: [], warnings };
  }

  const parsedMd = parseMarkdownFrontmatter(rawText);
  const title = parsedMd.title || deriveTitle(parsedMd.body) || titleFromFilename(filename);

  return {
    notes: [
      {
        title,
        content: parsedMd.body,
        tags: parsedMd.tags,
        isPinned: parsedMd.isPinned,
        folderLabel: parsedMd.folderLabel,
        createdAt: parsedMd.createdAt,
        updatedAt: parsedMd.updatedAt,
      },
    ],
    folders: [],
    warnings,
  };
}
