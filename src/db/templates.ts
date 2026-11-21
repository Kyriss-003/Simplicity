import {
  TEMPLATE_CATEGORIES,
  type NewTemplateInput,
  type NoteTemplate,
  type TemplateCategory,
  type TemplateUpdateInput,
} from '../types';

const TEMPLATES_KEY = 'simplicity_templates_v1';
const TEMPLATES_SEEDED_KEY = 'simplicity_templates_seeded_v1';

export interface TemplatePlaceholder {
  key: string;
  label: string;
  isAuto: boolean;
  defaultValue: string;
}

const AUTO_KEYS = new Set(['date', 'tomorrow', 'time', 'weekday', 'title']);

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatLocalTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatWeekday(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

export function getDefaultTokenValues(noteTitle?: string, now = new Date()): Record<string, string> {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    date: formatLocalDate(now),
    tomorrow: formatLocalDate(tomorrow),
    time: formatLocalTime(now),
    weekday: formatWeekday(now),
    title: noteTitle?.trim() || 'Untitled',
  };
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function extractTemplatePlaceholders(
  content: string,
  noteTitle?: string,
  now = new Date()
): TemplatePlaceholder[] {
  const defaults = getDefaultTokenValues(noteTitle, now);
  const seen = new Set<string>();
  const result: TemplatePlaceholder[] = [];
  const regex = /\{\{\s*([a-zA-Z0-9_ -]+?)\s*\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const rawKey = match[1]?.trim() ?? '';
    if (!rawKey) continue;
    const normalized = rawKey.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const isAuto = AUTO_KEYS.has(normalized);
    result.push({
      key: normalized,
      label: humanizeKey(rawKey),
      isAuto,
      defaultValue: defaults[normalized] ?? '',
    });
  }

  return result;
}

export function resolveTemplateContent(
  content: string,
  customValues: Record<string, string> = {},
  noteTitle?: string,
  now = new Date()
): string {
  const defaults = getDefaultTokenValues(noteTitle, now);
  const merged = new Map<string, string>();

  for (const [k, v] of Object.entries(defaults)) {
    merged.set(k.toLowerCase(), v);
  }
  for (const [k, v] of Object.entries(customValues)) {
    merged.set(k.trim().toLowerCase(), v);
  }

  return content.replace(/\{\{\s*([a-zA-Z0-9_ -]+?)\s*\}\}/g, (_full, rawKey: string) => {
    const normalized = rawKey.trim().toLowerCase();
    return merged.get(normalized) ?? '';
  });
}

export interface SlashTriggerMatch {
  from: number;
  to: number;
  query: string;
}

export function matchSlashTemplateTrigger(
  text: string,
  caretPos: number
): SlashTriggerMatch | null {
  const before = text.slice(0, caretPos);
  const lineStart = before.lastIndexOf('\n') + 1;
  const lineBefore = before.slice(lineStart);
  const m = /(?:^|\s)(\/(?:template|tpl|templat|templa|templ|temp|tem|te|tp|t))(?:\s+([^\n]*))?$/i.exec(
    lineBefore
  );
  if (!m) return null;
  const slashOffsetInLine = lineBefore.lastIndexOf(m[1]!);
  if (slashOffsetInLine === -1) return null;
  return {
    from: lineStart + slashOffsetInLine,
    to: caretPos,
    query: (m[2] ?? '').trim(),
  };
}

const STARTER_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export const STARTER_TEMPLATES: NoteTemplate[] = [
  {
    id: 'tpl_daily',
    name: 'Daily Note',
    category: 'Planning',
    description: 'Top priorities, time blocks, quick capture, and evening wrap-up.',
    tags: ['Daily'],
    isBuiltIn: true,
    createdAt: STARTER_TIMESTAMP,
    updatedAt: STARTER_TIMESTAMP,
    content: `# Daily Note — {{date}}

**{{weekday}}**

## Top 3 Priorities
- [ ] Primary focus
- [ ] Secondary task
- [ ] Quick win

## Schedule
- 09:00 — Deep work block
- 13:00 — Meetings & check-ins
- 16:00 — Wrap-up & inbox zero

## Notes & Capture
- 

## Evening Wrap-Up
- What went well today?
- What carries over to tomorrow?
`,
  },
  {
    id: 'tpl_tomorrow',
    name: 'Tomorrow Plan',
    category: 'Planning',
    description: 'Set tomorrow’s single focus, time blocks, and prep checklist tonight.',
    tags: ['Tomorrow', 'Planning'],
    isBuiltIn: true,
    createdAt: STARTER_TIMESTAMP,
    updatedAt: STARTER_TIMESTAMP,
    content: `# Tomorrow Plan — {{tomorrow}}

> Most important outcome: {{focus}}

## Priority Tasks
- [ ] 
- [ ] 
- [ ] 

## Time Blocks
- **Morning:** Deep focus on top priority
- **Afternoon:** Collaboration & follow-ups
- **Late day:** Review progress and reset workspace

## Prep & Carryover
- [ ] Gather links or files needed before starting
- [ ] Clear blockers or open questions
`,
  },
  {
    id: 'tpl_diary',
    name: 'Personal Diary',
    category: 'Personal',
    description: 'Mood check, gratitude, moments remembered, and quiet reflection.',
    tags: ['Diary', 'Journal'],
    isBuiltIn: true,
    createdAt: STARTER_TIMESTAMP,
    updatedAt: STARTER_TIMESTAMP,
    content: `# Diary — {{date}}

*Logged at {{time}} · Mood: {{mood}}*

## Gratitude
1. 
2. 
3. 

## Moments Worth Remembering
- 

## Freewrite Thoughts


## One Intention for Tomorrow
> 
`,
  },
  {
    id: 'tpl_meeting',
    name: 'Meeting Notes',
    category: 'Work',
    description: 'Structured agenda, key decisions, and owner-assigned action items.',
    tags: ['Meeting'],
    isBuiltIn: true,
    createdAt: STARTER_TIMESTAMP,
    updatedAt: STARTER_TIMESTAMP,
    content: `# Meeting: {{topic}}

**Date:** {{date}} at {{time}}  
**Attendees:** {{attendees}}

## Agenda
- Review status and blockers
- Key decisions needed
- Next steps

## Discussion Notes
- 

## Key Decisions
> Document final agreements clearly here.

## Action Items
| Owner | Action | Due |
| --- | --- | --- |
| @name | Follow up on open question | {{tomorrow}} |
`,
  },
  {
    id: 'tpl_project',
    name: 'Project Brief',
    category: 'Work',
    description: 'Problem statement, measurable goals, scope boundaries, and milestones.',
    tags: ['Project'],
    isBuiltIn: true,
    createdAt: STARTER_TIMESTAMP,
    updatedAt: STARTER_TIMESTAMP,
    content: `# Project Brief: {{project}}

**Owner:** {{owner}} · **Updated:** {{date}}

## Problem & Objective
What problem are we solving, and why does it matter right now?

## Success Metrics
- Outcome 1:
- Outcome 2:

## Scope
- **In scope:** 
- **Out of scope:** 

## Milestones
| Milestone | Owner | Target Date |
| --- | --- | --- |
| Kickoff & alignment | {{owner}} | {{date}} |
| First deliverable | {{owner}} | {{tomorrow}} |

## Risks & Open Questions
- [ ] 
`,
  },
  {
    id: 'tpl_weekly',
    name: 'Weekly Review',
    category: 'Planning',
    description: 'Weekly reflection covering wins, slipped tasks, open loops, and focus.',
    tags: ['Weekly', 'Review'],
    isBuiltIn: true,
    createdAt: STARTER_TIMESTAMP,
    updatedAt: STARTER_TIMESTAMP,
    content: `# Weekly Review — {{date}}

## Wins & Highlights
- 
- 

## What Slipped or Felt Hard
- 

## Open Loops Triage
- [ ] Clear quick notes and scratchpad items
- [ ] Review upcoming calendar events
- [ ] Archive completed tasks

## Key Lesson Learned
> 

## Focus for Next Week
1. 
2. 
3. 
`,
  },
];

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `tpl_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function isValidCategory(value: unknown): value is TemplateCategory {
  return typeof value === 'string' && (TEMPLATE_CATEGORIES as readonly string[]).includes(value);
}

class TemplateRepository {
  private ensureSeeded(): void {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(TEMPLATES_SEEDED_KEY)) return;
    localStorage.setItem(TEMPLATES_SEEDED_KEY, '1');
    if (!localStorage.getItem(TEMPLATES_KEY)) {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(STARTER_TEMPLATES));
    }
  }

  private load(): NoteTemplate[] {
    this.ensureSeeded();
    if (typeof localStorage === 'undefined') return [...STARTER_TEMPLATES];
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY);
      if (!raw) return [...STARTER_TEMPLATES];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [...STARTER_TEMPLATES];
      return parsed
        .filter((item): item is NoteTemplate => Boolean(item && typeof item.id === 'string'))
        .map((item) => ({
          id: item.id,
          name: typeof item.name === 'string' ? item.name : 'Untitled Template',
          category: isValidCategory(item.category) ? item.category : 'Custom',
          description: typeof item.description === 'string' ? item.description : '',
          content: typeof item.content === 'string' ? item.content : '',
          tags: Array.isArray(item.tags)
            ? item.tags.filter((t): t is string => typeof t === 'string')
            : [],
          isBuiltIn: Boolean(item.isBuiltIn),
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : STARTER_TIMESTAMP,
          updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : STARTER_TIMESTAMP,
        }));
    } catch {
      return [...STARTER_TEMPLATES];
    }
  }

  private save(list: NoteTemplate[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  }

  async getAllTemplates(): Promise<NoteTemplate[]> {
    return this.load();
  }

  async createTemplate(input: NewTemplateInput): Promise<NoteTemplate> {
    const list = this.load();
    const now = new Date().toISOString();
    const created: NoteTemplate = {
      id: makeId(),
      name: input.name.trim() || 'Untitled Template',
      category: isValidCategory(input.category) ? input.category : 'Custom',
      description: input.description?.trim() ?? '',
      content: input.content,
      tags: input.tags ? [...input.tags] : [],
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    };
    const next = [created, ...list];
    this.save(next);
    return created;
  }

  async updateTemplate(id: string, input: TemplateUpdateInput): Promise<NoteTemplate | null> {
    const list = this.load();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const cur = list[idx]!;
    const updated: NoteTemplate = {
      ...cur,
      name: input.name !== undefined ? input.name.trim() || cur.name : cur.name,
      category:
        input.category !== undefined && isValidCategory(input.category)
          ? input.category
          : cur.category,
      description: input.description !== undefined ? input.description.trim() : cur.description,
      content: input.content !== undefined ? input.content : cur.content,
      tags: input.tags !== undefined ? [...input.tags] : cur.tags,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    this.save(list);
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const list = this.load();
    const next = list.filter((t) => t.id !== id);
    if (next.length === list.length) return false;
    this.save(next);
    return true;
  }

  async resetBuiltIns(): Promise<NoteTemplate[]> {
    const list = this.load();
    const customOnly = list.filter((t) => !t.isBuiltIn);
    const starterIds = new Set(STARTER_TEMPLATES.map((t) => t.id));
    const merged = [...customOnly.filter((t) => !starterIds.has(t.id)), ...STARTER_TEMPLATES];
    this.save(merged);
    return merged;
  }
}

export const templateRepository = new TemplateRepository();
