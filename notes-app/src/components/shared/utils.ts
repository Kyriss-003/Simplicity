/**
 * Shared utilities used across dashboard card components.
 */
import type { Theme } from '../../theme';

/** Extracts a title from the first markdown heading in content. */
export function deriveTitle(content: string): string {
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*#{1,6}\s+(.+?)\s*#*\s*$/);
    if (m) return m[1].trim();
  }
  return '';
}

/** Extracts up to `max` non-heading content lines for note previews. */
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

/** Human-readable relative time label. */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3_600_000);
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Time-of-day greeting. */
export function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Today's long date label (e.g. "Monday, January 15"). */
export function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** Shared markdown stylesheet factory — used by ScratchPadCard & NotesView. */
export function getMarkdownStyles(theme: Theme, bodySize = 14) {
  return {
    body: { color: theme.text, fontSize: bodySize, lineHeight: bodySize + 6 },
    heading1: { color: theme.text, fontSize: 22, fontWeight: '700' as const, marginVertical: 6 },
    heading2: { color: theme.text, fontSize: 18, fontWeight: '700' as const, marginVertical: 4 },
    heading3: { color: theme.text, fontSize: 16, fontWeight: '700' as const, marginVertical: 3 },
    strong: { fontWeight: '700' as const },
    em: { fontStyle: 'italic' as const },
    code_inline: {
      backgroundColor: theme.pillBg,
      color: theme.text,
      borderRadius: 4,
      paddingHorizontal: 4,
    },
    code_block: {
      backgroundColor: theme.background,
      color: theme.text,
      padding: 12,
      borderRadius: 8,
      marginVertical: 6,
    },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
  };
}
