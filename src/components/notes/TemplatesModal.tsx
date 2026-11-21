import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Code2,
  Copy,
  FilePlus2,
  LayoutTemplate,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  extractTemplatePlaceholders,
  getDefaultTokenValues,
  resolveTemplateContent,
} from '../../db/templates';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import {
  TEMPLATE_CATEGORIES,
  type NewTemplateInput,
  type NoteTemplate,
  type TemplateCategory,
  type TemplateUpdateInput,
} from '../../types';
import { deriveTitle } from '../../utils';
import { MarkdownReadView } from './MarkdownReadView';

export type TemplatesModalInitialView = 'browse' | 'create' | 'saveNote';

export interface TemplatesModalProps {
  visible: boolean;
  theme: Theme;
  templates: NoteTemplate[];
  initialView?: TemplatesModalInitialView;
  initialTemplateId?: string | null;
  activeNoteTitle?: string;
  activeNoteContent?: string;
  activeNoteTags?: string[];
  hasActiveNote: boolean;
  onInsertAtCursor: (resolvedContent: string, template: NoteTemplate) => void;
  onCreateNoteFromTemplate: (
    resolvedTitle: string,
    resolvedContent: string,
    template: NoteTemplate
  ) => Promise<void> | void;
  onCreateTemplate: (input: NewTemplateInput) => Promise<NoteTemplate | null>;
  onUpdateTemplate: (id: string, input: TemplateUpdateInput) => Promise<NoteTemplate | null>;
  onDeleteTemplate: (id: string) => Promise<boolean>;
  onResetBuiltIns: () => Promise<void>;
  onClose: () => void;
}

type CategoryFilter = 'All' | TemplateCategory;

const TOKEN_SNIPPETS: ReadonlyArray<{ token: string; label: string }> = [
  { token: '{{date}}', label: 'Today' },
  { token: '{{tomorrow}}', label: 'Tomorrow' },
  { token: '{{time}}', label: 'Time' },
  { token: '{{weekday}}', label: 'Weekday' },
  { token: '{{title}}', label: 'Title' },
  { token: '{{topic}}', label: 'Topic' },
];

export function TemplatesModal({
  visible,
  theme,
  templates,
  initialView = 'browse',
  initialTemplateId = null,
  activeNoteTitle,
  activeNoteContent,
  activeNoteTags,
  hasActiveNote,
  onInsertAtCursor,
  onCreateNoteFromTemplate,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onResetBuiltIns,
  onClose,
}: TemplatesModalProps) {
  const ink = surfaceTheme(theme);

  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  const isCompact = windowWidth < 720;

  const [category, setCategory] = useState<CategoryFilter>('All');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftCategory, setDraftCategory] = useState<TemplateCategory>('Custom');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showAutoFields, setShowAutoFields] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<'rendered' | 'source'>('rendered');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const draftTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setConfirmDeleteId(null);
    setFormError(null);
    setShowAutoFields(false);
    setQuery('');
    setCategory('All');

    if (initialView === 'create') {
      setMode('edit');
      setEditingId(null);
      setDraftName('');
      setDraftCategory('Custom');
      setDraftDescription('');
      setDraftTags('');
      setDraftContent('# {{title}}\n\n## Overview\n- \n\n## Next Steps\n- [ ] \n');
      setMobileShowDetail(true);
      return;
    }

    if (initialView === 'saveNote') {
      const seedTitle =
        activeNoteTitle?.trim() || deriveTitle(activeNoteContent ?? '') || 'Custom Template';
      setMode('edit');
      setEditingId(null);
      setDraftName(seedTitle === 'Untitled' ? 'My Custom Template' : `${seedTitle} Template`);
      setDraftCategory('Custom');
      setDraftDescription('Saved from current note structure.');
      setDraftTags((activeNoteTags ?? []).join(', '));
      setDraftContent(activeNoteContent?.trim() ? activeNoteContent : '# {{title}}\n\n');
      setMobileShowDetail(true);
      return;
    }

    setMode('preview');
    const candidate =
      (initialTemplateId && templates.find((t) => t.id === initialTemplateId)) || templates[0] || null;
    setSelectedId(candidate?.id ?? null);
    setMobileShowDetail(Boolean(initialTemplateId));
  }, [
    visible,
    initialView,
    initialTemplateId,
    activeNoteTitle,
    activeNoteContent,
    activeNoteTags,
    templates,
  ]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onClose]);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (category !== 'All' && tpl.category !== category) return false;
      if (!q) return true;
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q) ||
        tpl.category.toLowerCase().includes(q) ||
        tpl.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [templates, category, query]);

  const selectedTemplate = useMemo(
    () =>
      templates.find((t) => t.id === selectedId) ??
      filteredTemplates[0] ??
      templates[0] ??
      null,
    [templates, filteredTemplates, selectedId]
  );

  const placeholders = useMemo(() => {
    if (!selectedTemplate) return [];
    return extractTemplatePlaceholders(selectedTemplate.content, activeNoteTitle);
  }, [selectedTemplate, activeNoteTitle]);

  const customPlaceholders = useMemo(
    () => placeholders.filter((p) => !p.isAuto),
    [placeholders]
  );
  const autoPlaceholders = useMemo(
    () => placeholders.filter((p) => p.isAuto),
    [placeholders]
  );

  useEffect(() => {
    if (!selectedTemplate) {
      setFieldValues({});
      return;
    }
    const defaults = getDefaultTokenValues(activeNoteTitle);
    const next: Record<string, string> = {};
    for (const ph of extractTemplatePlaceholders(selectedTemplate.content, activeNoteTitle)) {
      next[ph.key] = ph.isAuto ? (defaults[ph.key] ?? '') : '';
    }
    setFieldValues(next);
    setShowAutoFields(false);
    setConfirmDeleteId(null);
  }, [selectedTemplate?.id, selectedTemplate?.content, activeNoteTitle]);

  const resolvedPreview = useMemo(() => {
    if (!selectedTemplate) return '';
    return resolveTemplateContent(selectedTemplate.content, fieldValues, activeNoteTitle);
  }, [selectedTemplate, fieldValues, activeNoteTitle]);

  if (!visible) return null;

  const startCreate = () => {
    setMode('edit');
    setEditingId(null);
    setDraftName('');
    setDraftCategory('Custom');
    setDraftDescription('');
    setDraftTags('');
    setDraftContent('# {{title}}\n\n## Notes\n- \n');
    setFormError(null);
    setMobileShowDetail(true);
  };

  const startEdit = (tpl: NoteTemplate) => {
    setMode('edit');
    setEditingId(tpl.id);
    setDraftName(tpl.name);
    setDraftCategory(tpl.category);
    setDraftDescription(tpl.description);
    setDraftTags(tpl.tags.join(', '));
    setDraftContent(tpl.content);
    setFormError(null);
    setMobileShowDetail(true);
  };

  const handleDuplicate = async (tpl: NoteTemplate) => {
    const created = await onCreateTemplate({
      name: `${tpl.name} Copy`,
      category: tpl.category,
      description: tpl.description,
      tags: [...tpl.tags],
      content: tpl.content,
    });
    if (created) {
      setSelectedId(created.id);
      setMode('preview');
      setMobileShowDetail(true);
    }
  };

  const handleSaveTemplateForm = async () => {
    const cleanName = draftName.trim();
    if (!cleanName) {
      setFormError('Give this template a short name.');
      return;
    }
    if (!draftContent.trim()) {
      setFormError('Template body cannot be empty.');
      return;
    }
    const parsedTags = draftTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setIsSavingForm(true);
    setFormError(null);
    try {
      if (editingId) {
        const updated = await onUpdateTemplate(editingId, {
          name: cleanName,
          category: draftCategory,
          description: draftDescription.trim(),
          tags: parsedTags,
          content: draftContent,
        });
        if (updated) {
          setSelectedId(updated.id);
          setMode('preview');
        }
      } else {
        const created = await onCreateTemplate({
          name: cleanName,
          category: draftCategory,
          description: draftDescription.trim(),
          tags: parsedTags,
          content: draftContent,
        });
        if (created) {
          setSelectedId(created.id);
          setMode('preview');
        }
      }
    } finally {
      setIsSavingForm(false);
    }
  };

  const insertTokenIntoDraft = (token: string) => {
    const el = draftTextareaRef.current;
    if (!el) {
      setDraftContent((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? draftContent.length;
    const end = el.selectionEnd ?? start;
    const next = draftContent.slice(0, start) + token + draftContent.slice(end);
    setDraftContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleApplyInsert = () => {
    if (!selectedTemplate) return;
    onInsertAtCursor(resolvedPreview, selectedTemplate);
    onClose();
  };

  const handleApplyNewNote = async () => {
    if (!selectedTemplate || applying) return;
    setApplying(true);
    try {
      const derived = deriveTitle(resolvedPreview);
      const fallbackTitle = resolveTemplateContent(selectedTemplate.name, fieldValues, activeNoteTitle);
      await onCreateNoteFromTemplate(derived || fallbackTitle, resolvedPreview, selectedTemplate);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const visibleFields = showAutoFields
    ? [...customPlaceholders, ...autoPlaceholders]
    : customPlaceholders;

  const showListPane = !isCompact || !mobileShowDetail;
  const showDetailPane = !isCompact || mobileShowDetail;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isCompact ? 12 : 24,
        backgroundColor: theme.scrim,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Note templates"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 920,
          height: isCompact ? '88vh' : 620,
          maxHeight: '88vh',
          backgroundColor: theme.surfaceRaised,
          border: `1px solid ${ink.border}`,
          borderRadius: Radius.modal,
          boxShadow: `0 20px 54px ${theme.shadow}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 18px',
            borderBottom: `1px solid ${ink.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {isCompact && mobileShowDetail ? (
              <button
                type="button"
                onClick={() => {
                  if (mode === 'edit') {
                    setMode('preview');
                    if (initialView === 'create' || initialView === 'saveNote') {
                      setMobileShowDetail(false);
                    }
                  } else {
                    setMobileShowDetail(false);
                  }
                }}
                aria-label="Back to templates list"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: Radius.md,
                  border: `1px solid ${ink.border}`,
                  backgroundColor: 'transparent',
                  color: ink.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <ArrowLeft size={16} />
              </button>
            ) : (
              <LayoutTemplate size={18} color={theme.accent} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ ...Typography.app.cardHeader, color: ink.text }}>
                Templates
              </div>
              <div
                style={{
                  ...Typography.app.caption,
                  color: ink.textMuted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Reuse structured boilerplates or type /template anywhere in the editor.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {hasActiveNote && mode !== 'edit' ? (
              <button
                type="button"
                onClick={() => {
                  const seedTitle =
                    activeNoteTitle?.trim() ||
                    deriveTitle(activeNoteContent ?? '') ||
                    'Custom Template';
                  setMode('edit');
                  setEditingId(null);
                  setDraftName(
                    seedTitle === 'Untitled' ? 'My Custom Template' : `${seedTitle} Template`
                  );
                  setDraftCategory('Custom');
                  setDraftDescription('Saved from active note.');
                  setDraftTags((activeNoteTags ?? []).join(', '));
                  setDraftContent(activeNoteContent?.trim() ? activeNoteContent : '# {{title}}\n\n');
                  setFormError(null);
                  setMobileShowDetail(true);
                }}
                style={{
                  height: 34,
                  padding: '0 12px',
                  borderRadius: Radius.button,
                  border: `1px solid ${ink.border}`,
                  backgroundColor: 'transparent',
                  color: ink.text,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  ...Typography.app.captionStrong,
                }}
              >
                <FilePlus2 size={14} color={theme.accent} />
                <span>Save current note</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={startCreate}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: Radius.button,
                border: `1px solid ${ink.border}`,
                backgroundColor: theme.surface,
                color: ink.text,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                ...Typography.app.captionStrong,
              }}
            >
              <Plus size={14} />
              <span>New</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close templates"
              style={{
                width: 34,
                height: 34,
                borderRadius: Radius.md,
                border: 'none',
                backgroundColor: 'transparent',
                color: ink.textMuted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {showListPane ? (
            <div
              style={{
                width: isCompact ? '100%' : 290,
                borderRight: isCompact ? 'none' : `1px solid ${ink.border}`,
                backgroundColor: theme.surface,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                flexShrink: 0,
              }}
            >
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    height: 36,
                    padding: '0 10px',
                    borderRadius: Radius.input,
                    border: `1px solid ${ink.border}`,
                    backgroundColor: theme.background,
                  }}
                >
                  <Search size={14} color={ink.textMuted} />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter templates…"
                    aria-label="Filter templates"
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      color: ink.text,
                      ...Typography.app.body,
                    }}
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Clear filter"
                      style={{
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: ink.textMuted,
                        cursor: 'pointer',
                        display: 'flex',
                        padding: 2,
                      }}
                    >
                      <X size={13} />
                    </button>
                  ) : null}
                </div>

                <div
                  role="tablist"
                  aria-label="Template categories"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    overflowX: 'auto',
                    paddingBottom: 2,
                  }}
                >
                  {(['All', ...TEMPLATE_CATEGORIES] as const).map((cat) => {
                    const active = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setCategory(cat)}
                        style={{
                          height: 28,
                          padding: '0 10px',
                          borderRadius: Radius.md,
                          border: active ? `1px solid ${theme.accent}` : `1px solid transparent`,
                          backgroundColor: active ? ink.pillBg : 'transparent',
                          color: active ? ink.text : ink.textMuted,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          ...Typography.app.captionStrong,
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '0 8px 12px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {filteredTemplates.length === 0 ? (
                  <div
                    style={{
                      padding: 20,
                      textAlign: 'center',
                      color: ink.textMuted,
                      ...Typography.app.caption,
                    }}
                  >
                    No matching templates. Create a custom one with New above.
                  </div>
                ) : (
                  filteredTemplates.map((tpl) => {
                    const isSelected = mode === 'preview' && selectedTemplate?.id === tpl.id;
                    const phCount = extractTemplatePlaceholders(tpl.content, activeNoteTitle).length;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(tpl.id);
                          setMode('preview');
                          setMobileShowDetail(true);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 3,
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: Radius.md,
                          border: 'none',
                          backgroundColor: isSelected ? ink.pillBg : 'transparent',
                          color: ink.text,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              ...Typography.app.bodyStrong,
                              color: isSelected ? theme.text : ink.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tpl.name}
                          </span>
                        </div>
                        <span
                          style={{
                            ...Typography.app.caption,
                            color: ink.textMuted,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {tpl.category}
                          {phCount > 0 ? ` · ${phCount} ${phCount === 1 ? 'field' : 'fields'}` : ''}
                          {tpl.isBuiltIn ? '' : ' · Custom'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  borderTop: `1px solid ${ink.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    ...Typography.app.caption,
                    color: ink.textMuted,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {templates.length} {templates.length === 1 ? 'template' : 'templates'}
                </span>
                <button
                  type="button"
                  onClick={() => void onResetBuiltIns()}
                  title="Restore starter pack templates"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: ink.textMuted,
                    cursor: 'pointer',
                    padding: '4px 6px',
                    borderRadius: Radius.sm,
                    ...Typography.app.caption,
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Restore starters</span>
                </button>
              </div>
            </div>
          ) : null}

          {showDetailPane ? (
            <div
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: theme.background,
              }}
            >
              {mode === 'edit' ? (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ ...Typography.app.bodyStrong, color: ink.text }}>
                      {editingId ? 'Edit template' : 'Save new template'}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label
                          htmlFor="tpl-name"
                          style={{ ...Typography.app.captionStrong, color: ink.textMuted }}
                        >
                          Name
                        </label>
                        <input
                          id="tpl-name"
                          type="text"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          placeholder="e.g. Sprint Retrospective"
                          style={{
                            height: 38,
                            padding: '0 10px',
                            borderRadius: Radius.input,
                            border: `1px solid ${ink.border}`,
                            backgroundColor: theme.surface,
                            color: ink.text,
                            ...Typography.app.body,
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label
                          htmlFor="tpl-category"
                          style={{ ...Typography.app.captionStrong, color: ink.textMuted }}
                        >
                          Category
                        </label>
                        <select
                          id="tpl-category"
                          value={draftCategory}
                          onChange={(e) => setDraftCategory(e.target.value as TemplateCategory)}
                          style={{
                            height: 38,
                            padding: '0 10px',
                            borderRadius: Radius.input,
                            border: `1px solid ${ink.border}`,
                            backgroundColor: theme.surface,
                            color: ink.text,
                            ...Typography.app.body,
                          }}
                        >
                          {TEMPLATE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label
                          htmlFor="tpl-desc"
                          style={{ ...Typography.app.captionStrong, color: ink.textMuted }}
                        >
                          Description
                        </label>
                        <input
                          id="tpl-desc"
                          type="text"
                          value={draftDescription}
                          onChange={(e) => setDraftDescription(e.target.value)}
                          placeholder="Short summary of when to use it"
                          style={{
                            height: 36,
                            padding: '0 10px',
                            borderRadius: Radius.input,
                            border: `1px solid ${ink.border}`,
                            backgroundColor: theme.surface,
                            color: ink.text,
                            ...Typography.app.body,
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label
                          htmlFor="tpl-tags"
                          style={{ ...Typography.app.captionStrong, color: ink.textMuted }}
                        >
                          Default tags (comma separated)
                        </label>
                        <input
                          id="tpl-tags"
                          type="text"
                          value={draftTags}
                          onChange={(e) => setDraftTags(e.target.value)}
                          placeholder="Daily, Review"
                          style={{
                            height: 36,
                            padding: '0 10px',
                            borderRadius: Radius.input,
                            border: `1px solid ${ink.border}`,
                            backgroundColor: theme.surface,
                            color: ink.text,
                            ...Typography.app.body,
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <label
                          htmlFor="tpl-body"
                          style={{ ...Typography.app.captionStrong, color: ink.textMuted }}
                        >
                          Markdown structure
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {TOKEN_SNIPPETS.map((item) => (
                            <button
                              key={item.token}
                              type="button"
                              onClick={() => insertTokenIntoDraft(item.token)}
                              title={`Insert ${item.token}`}
                              style={{
                                height: 24,
                                padding: '0 8px',
                                borderRadius: Radius.sm,
                                border: `1px solid ${ink.border}`,
                                backgroundColor: theme.surface,
                                color: ink.textMuted,
                                cursor: 'pointer',
                                ...Typography.app.caption,
                              }}
                            >
                              +{item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        ref={draftTextareaRef}
                        id="tpl-body"
                        value={draftContent}
                        onChange={(e) => setDraftContent(e.target.value)}
                        rows={10}
                        placeholder="# {{title}}\n\nWrite your reusable Markdown structure here..."
                        style={{
                          flex: 1,
                          minHeight: 200,
                          padding: 12,
                          borderRadius: Radius.input,
                          border: `1px solid ${ink.border}`,
                          backgroundColor: theme.surface,
                          color: ink.text,
                          resize: 'vertical',
                          outline: 'none',
                          ...Typography.app.body,
                        }}
                      />
                    </div>

                    {formError ? (
                      <div style={{ ...Typography.app.caption, color: ink.error }}>
                        {formError}
                      </div>
                    ) : null}
                  </div>

                  <div
                    style={{
                      padding: '12px 18px',
                      borderTop: `1px solid ${ink.border}`,
                      backgroundColor: theme.surface,
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setMode('preview')}
                      style={{
                        height: 38,
                        padding: '0 14px',
                        borderRadius: Radius.button,
                        border: `1px solid ${ink.border}`,
                        backgroundColor: 'transparent',
                        color: ink.text,
                        cursor: 'pointer',
                        ...Typography.app.bodyStrong,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingForm}
                      onClick={() => void handleSaveTemplateForm()}
                      style={{
                        height: 38,
                        padding: '0 18px',
                        borderRadius: Radius.button,
                        border: 'none',
                        backgroundColor: theme.accent,
                        color: theme.accentText,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: isSavingForm ? 'default' : 'pointer',
                        ...Typography.app.bodyStrong,
                      }}
                    >
                      <Check size={15} />
                      <span>{editingId ? 'Save changes' : 'Save template'}</span>
                    </button>
                  </div>
                </div>
              ) : selectedTemplate ? (
                <>
                  <div
                    style={{
                      padding: '14px 18px 12px 18px',
                      borderBottom: `1px solid ${ink.border}`,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...Typography.app.cardHeader, color: ink.text }}>
                        {selectedTemplate.name}
                      </div>
                      <div style={{ ...Typography.app.caption, color: ink.textMuted, marginTop: 2 }}>
                        {selectedTemplate.description || selectedTemplate.category}
                        {selectedTemplate.tags.length > 0
                          ? ` · Tags: ${selectedTemplate.tags.join(', ')}`
                          : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => startEdit(selectedTemplate)}
                        title="Edit template"
                        aria-label="Edit template"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: Radius.md,
                          border: `1px solid ${ink.border}`,
                          backgroundColor: 'transparent',
                          color: ink.textMuted,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDuplicate(selectedTemplate)}
                        title="Duplicate template"
                        aria-label="Duplicate template"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: Radius.md,
                          border: `1px solid ${ink.border}`,
                          backgroundColor: 'transparent',
                          color: ink.textMuted,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Copy size={14} />
                      </button>
                      {confirmDeleteId === selectedTemplate.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            void onDeleteTemplate(selectedTemplate.id).then(() => {
                              setConfirmDeleteId(null);
                              setSelectedId(null);
                            });
                          }}
                          style={{
                            height: 32,
                            padding: '0 10px',
                            borderRadius: Radius.md,
                            border: 'none',
                            backgroundColor: theme.error,
                            color: theme.errorText,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            ...Typography.app.captionStrong,
                          }}
                        >
                          Confirm delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(selectedTemplate.id)}
                          title="Delete template"
                          aria-label="Delete template"
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: Radius.md,
                            border: `1px solid ${ink.border}`,
                            backgroundColor: 'transparent',
                            color: ink.textMuted,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {placeholders.length > 0 ? (
                    <div
                      style={{
                        padding: '10px 18px',
                        borderBottom: `1px solid ${ink.border}`,
                        backgroundColor: theme.surface,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span style={{ ...Typography.app.captionStrong, color: ink.textMuted }}>
                          {customPlaceholders.length > 0
                            ? 'Template fields'
                            : 'Dynamic date & title tokens'}
                        </span>
                        {autoPlaceholders.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setShowAutoFields((s) => !s)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: theme.accent,
                              cursor: 'pointer',
                              padding: 0,
                              ...Typography.app.captionStrong,
                            }}
                          >
                            <SlidersHorizontal size={12} />
                            <span>
                              {showAutoFields
                                ? 'Hide auto tokens'
                                : customPlaceholders.length > 0
                                  ? 'Customize date & title'
                                  : 'Customize auto tokens'}
                            </span>
                          </button>
                        ) : null}
                      </div>

                      {visibleFields.length > 0 ? (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                            gap: 8,
                          }}
                        >
                          {visibleFields.map((ph) => (
                            <div
                              key={ph.key}
                              style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
                            >
                              <label
                                htmlFor={`tpl-var-${ph.key}`}
                                style={{ ...Typography.app.caption, color: ink.textMuted }}
                              >
                                {ph.label}
                              </label>
                              <input
                                id={`tpl-var-${ph.key}`}
                                type="text"
                                value={fieldValues[ph.key] ?? ''}
                                onChange={(e) =>
                                  setFieldValues((prev) => ({ ...prev, [ph.key]: e.target.value }))
                                }
                                placeholder={ph.defaultValue || `Enter ${ph.label.toLowerCase()}`}
                                style={{
                                  height: 32,
                                  padding: '0 8px',
                                  borderRadius: Radius.sm,
                                  border: `1px solid ${ink.border}`,
                                  backgroundColor: theme.background,
                                  color: ink.text,
                                  ...Typography.app.caption,
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '8px 18px',
                      borderBottom: `1px solid ${ink.border}`,
                      backgroundColor: theme.background,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        ...Typography.app.caption,
                        color: ink.textMuted,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {(resolvedPreview ? resolvedPreview.split('\n').length : 0)} lines ·{' '}
                      {(resolvedPreview.trim() ? resolvedPreview.trim().split(/\s+/).length : 0)} words ·{' '}
                      {resolvedPreview.length} chars
                    </span>

                    <div
                      role="tablist"
                      aria-label="Preview format"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                        padding: 2,
                        borderRadius: Radius.md,
                        backgroundColor: theme.surface,
                        border: `1px solid ${ink.border}`,
                      }}
                    >
                      {(
                        [
                          { key: 'rendered', label: 'Rendered', Icon: BookOpen },
                          { key: 'source', label: 'Markdown source', Icon: Code2 },
                        ] as const
                      ).map(({ key, label, Icon }) => {
                        const active = previewFormat === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setPreviewFormat(key)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              height: 26,
                              padding: '0 9px',
                              borderRadius: Radius.sm,
                              border: 'none',
                              backgroundColor: active ? ink.pillBg : 'transparent',
                              color: active ? ink.text : ink.textMuted,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              ...Typography.app.captionStrong,
                            }}
                          >
                            <Icon size={12} color={active ? theme.accent : ink.textMuted} />
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      padding: '16px 22px',
                    }}
                  >
                    {previewFormat === 'rendered' ? (
                      <MarkdownReadView content={resolvedPreview} theme={theme} />
                    ) : (
                      <pre
                        style={{
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: 13,
                          lineHeight: '20px',
                          color: ink.text,
                        }}
                      >
                        {resolvedPreview}
                      </pre>
                    )}
                  </div>

                  <div
                    style={{
                      padding: '12px 18px',
                      borderTop: `1px solid ${ink.border}`,
                      backgroundColor: theme.surface,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      disabled={applying}
                      onClick={() => void handleApplyNewNote()}
                      style={{
                        height: 38,
                        padding: '0 14px',
                        borderRadius: Radius.button,
                        border: hasActiveNote ? `1px solid ${ink.border}` : 'none',
                        backgroundColor: hasActiveNote ? 'transparent' : theme.accent,
                        color: hasActiveNote ? ink.text : theme.accentText,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: applying ? 'default' : 'pointer',
                        whiteSpace: 'nowrap',
                        ...Typography.app.bodyStrong,
                      }}
                    >
                      <FilePlus2 size={15} />
                      <span>New note from template</span>
                    </button>

                    {hasActiveNote ? (
                      <button
                        type="button"
                        onClick={handleApplyInsert}
                        style={{
                          height: 38,
                          padding: '0 18px',
                          borderRadius: Radius.button,
                          border: 'none',
                          backgroundColor: theme.accent,
                          color: theme.accentText,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          ...Typography.app.bodyStrong,
                        }}
                      >
                        <LayoutTemplate size={15} />
                        <span>Insert at cursor</span>
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: 24,
                    color: ink.textMuted,
                  }}
                >
                  <LayoutTemplate size={32} />
                  <div style={{ ...Typography.app.body }}>
                    No templates available yet. Create one to get started.
                  </div>
                  <button
                    type="button"
                    onClick={startCreate}
                    style={{
                      height: 36,
                      padding: '0 14px',
                      borderRadius: Radius.button,
                      border: 'none',
                      backgroundColor: theme.accent,
                      color: theme.accentText,
                      cursor: 'pointer',
                      ...Typography.app.bodyStrong,
                    }}
                  >
                    Create template
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
