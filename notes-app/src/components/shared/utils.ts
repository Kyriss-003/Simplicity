/**
 * Shared utilities used across dashboard card components.
 */
import { Platform } from 'react-native';
import { Radius, Typography, type Theme } from '../../theme';

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

/**
 * Time-of-day greeting. `hour` is injectable so the buckets can be tested —
 * reading the clock inside the function made every hour untestable except
 * whichever one the suite happened to run in.
 *
 * The boundaries are midnight / noon / five. Morning used to start at 5, which
 * put 00:00–04:59 in the *evening* bucket, so anyone awake at 3am was greeted
 * with "Good evening" — the same 12-hour label a night hour and the evening one
 * share, which is the whole confusion. Midnight to noon is morning.
 */
export function greeting(hour: number = new Date().getHours()): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
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

/** Shared markdown stylesheet factory — used by ScratchPadCard. */
export function getMarkdownStyles(theme: Theme) {
  return {
    body: { color: theme.text, ...Typography.app.body },
    heading1: { color: theme.text, ...Typography.app.pageHeader, marginVertical: 8 },
    heading2: { color: theme.text, ...Typography.app.cardHeader, marginVertical: 8 },
    heading3: { color: theme.text, ...Typography.app.bodyStrong, marginVertical: 4 },
    strong: { ...Typography.app.bodyStrong },
    em: { fontStyle: 'italic' as const },
    code_inline: {
      backgroundColor: theme.pillBg,
      color: theme.text,
      borderRadius: Radius.sm,
      paddingHorizontal: 4,
    },
    code_block: {
      backgroundColor: theme.background,
      color: theme.text,
      padding: 12,
      borderRadius: Radius.md,
      marginVertical: 8,
    },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
  };
}

/**
 * Copies text to the system clipboard. Web only, and resolves `false` rather
 * than throwing: clipboard access can be denied by permissions, and a settings
 * row that fails silently is better than one that takes the screen down.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Token colours for the live markdown editor (`MarkdownTextInput`).
 *
 * The library styles *ranges* of the text, so every value here has to come
 * from a token — the design system does not get a second, looser vocabulary just
 * because the styling happens per token instead of per component.
 *
 * `syntax` is the one that matters most: it dims `**`, `#`, backticks and list
 * bullets *in place*, so the raw text is still exactly where the user thinks it
 * is and the caret never drifts.
 */
export function liveMarkdownStyle(theme: Theme) {
  return {
    /** Raw markers, set to the canvas so they render invisible. */
    syntax: { color: theme.syntaxDim },
    link: { color: theme.accent },
    /** The library scales headings by size only, so level-1 is the one it gets. */
    h1: { fontSize: Typography.app.pageHeader.fontSize },
    blockquote: {
      borderColor: theme.border,
      borderWidth: 2,
      marginLeft: 8,
      paddingLeft: 12,
    },
    code: {
      fontSize: Typography.app.caption.fontSize,
      color: theme.text,
      backgroundColor: theme.pillBg,
      borderRadius: Radius.sm,
      paddingHorizontal: 4,
    },
    pre: {
      fontSize: Typography.app.body.fontSize,
      color: theme.text,
      backgroundColor: theme.surface,
      borderRadius: Radius.md,
      padding: 12,
    },
  };
}
