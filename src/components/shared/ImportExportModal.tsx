import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, FileCode2, FileText, FolderInput, Upload, X } from 'lucide-react';
import {
  downloadTextFile,
  notesToJson,
  notesToMarkdownBundle,
  parseImportedFile,
  slugifyFilename,
  type ExportFormat,
  type ImportedFolderItem,
  type ImportedNoteItem,
} from '../../db/portability';
import { ROOT_FOLDER_ID } from '../../db/storage';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import type { Folder, Note } from '../../types';
import { buildFolderTree, copyToClipboard, flattenTree } from '../../utils';

export type PortabilityTab = 'export' | 'import';
type ExportScope = 'all' | 'folder' | 'active';

export function ImportExportModal({
  visible,
  initialTab = 'export',
  theme,
  allNotes,
  folders,
  selectedFolderId,
  activeNote,
  onFlushPending,
  onImport,
  onClose,
}: {
  visible: boolean;
  initialTab?: PortabilityTab;
  theme: Theme;
  allNotes: readonly Note[];
  folders: readonly Folder[];
  selectedFolderId: string | null;
  activeNote: Note | null;
  onFlushPending: () => void;
  onImport: (payload: {
    notes: ImportedNoteItem[];
    folders: ImportedFolderItem[];
    targetFolderId: string;
    matchOriginalFolders: boolean;
  }) => Promise<number>;
  onClose: () => void;
}) {
  const ink = surfaceTheme(theme);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<PortabilityTab>(initialTab);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [exportFeedback, setExportFeedback] = useState<'idle' | 'downloaded' | 'copied'>('idle');

  const [targetFolderId, setTargetFolderId] = useState<string>(selectedFolderId ?? ROOT_FOLDER_ID);
  const [matchOriginalFolders, setMatchOriginalFolders] = useState(true);
  const [stagedNotes, setStagedNotes] = useState<ImportedNoteItem[]>([]);
  const [stagedFolders, setStagedFolders] = useState<ImportedFolderItem[]>([]);
  const [stagedFiles, setStagedFiles] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importDoneCount, setImportDoneCount] = useState<number | null>(null);

  const flatFolders = useMemo(() => flattenTree(buildFolderTree([...folders])), [folders]);
  const currentFolderLabel =
    folders.find((f) => f.id === selectedFolderId)?.label ?? 'Main';

  useEffect(() => {
    if (!visible) return;
    setTab(initialTab);
    setTargetFolderId(selectedFolderId ?? ROOT_FOLDER_ID);
    setExportScope(activeNote ? 'active' : 'all');
    setExportFeedback('idle');
    setStagedNotes([]);
    setStagedFolders([]);
    setStagedFiles([]);
    setWarnings([]);
    setImportDoneCount(null);
  }, [visible, initialTab, selectedFolderId, activeNote]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [visible, onClose]);

  const notesForExport = useMemo(() => {
    if (exportScope === 'active' && activeNote) return [activeNote];
    if (exportScope === 'folder' && selectedFolderId) {
      return allNotes.filter((n) => n.folderId === selectedFolderId);
    }
    return [...allNotes];
  }, [exportScope, activeNote, selectedFolderId, allNotes]);

  if (!visible) return null;

  const buildExportPayload = () => {
    onFlushPending();
    const list = notesForExport;
    const dateStamp = new Date().toISOString().slice(0, 10);
    const baseName =
      exportScope === 'active' && activeNote
        ? slugifyFilename(activeNote.title, 'note')
        : exportScope === 'folder'
          ? `simplicity-${slugifyFilename(currentFolderLabel, 'folder')}-${dateStamp}`
          : `simplicity-notes-${dateStamp}`;

    if (exportFormat === 'json') {
      return {
        filename: `${baseName}.json`,
        mime: 'application/json',
        content: notesToJson(list, folders),
      };
    }
    return {
      filename: `${baseName}.md`,
      mime: 'text/markdown;charset=utf-8',
      content: notesToMarkdownBundle(list, folders),
    };
  };

  const handleDownloadExport = () => {
    if (notesForExport.length === 0) return;
    const { filename, mime, content } = buildExportPayload();
    if (downloadTextFile(filename, content, mime)) {
      setExportFeedback('downloaded');
      setTimeout(() => setExportFeedback('idle'), 2000);
    }
  };

  const handleCopyExport = async () => {
    if (notesForExport.length === 0) return;
    const { content } = buildExportPayload();
    const ok = await copyToClipboard(content);
    if (ok) {
      setExportFeedback('copied');
      setTimeout(() => setExportFeedback('idle'), 2000);
    }
  };

  const readFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const nextNotes: ImportedNoteItem[] = [];
    const nextFolders: ImportedFolderItem[] = [];
    const nextWarnings: string[] = [];
    const nextFileNames: string[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        const parsed = parseImportedFile(file.name, text);
        nextNotes.push(...parsed.notes);
        nextFolders.push(...parsed.folders);
        nextWarnings.push(...parsed.warnings);
        nextFileNames.push(file.name);
      } catch {
        nextWarnings.push(`Could not read "${file.name}".`);
      }
    }

    setStagedNotes((prev) => [...prev, ...nextNotes]);
    setStagedFolders((prev) => [...prev, ...nextFolders]);
    setStagedFiles((prev) => [...prev, ...nextFileNames]);
    setWarnings((prev) => [...prev, ...nextWarnings]);
    setImportDoneCount(null);
  };

  const handleConfirmImport = async () => {
    if (stagedNotes.length === 0 || isImporting) return;
    setIsImporting(true);
    try {
      const count = await onImport({
        notes: stagedNotes,
        folders: stagedFolders,
        targetFolderId,
        matchOriginalFolders,
      });
      setImportDoneCount(count);
      setStagedNotes([]);
      setStagedFolders([]);
      setStagedFiles([]);
    } finally {
      setIsImporting(false);
    }
  };

  const folderNoteCount = selectedFolderId
    ? allNotes.filter((n) => n.folderId === selectedFolderId).length
    : allNotes.length;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: theme.scrim,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export and import notes"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '85vh',
          backgroundColor: theme.surfaceRaised,
          border: `1px solid ${ink.border}`,
          borderRadius: Radius.modal,
          boxShadow: `0 20px 48px ${theme.shadow}`,
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
            padding: '16px 18px 12px 18px',
            borderBottom: `1px solid ${ink.border}`,
          }}
        >
          <div>
            <div style={{ ...Typography.app.cardHeader, color: ink.text }}>
              Export &amp; Import Notes
            </div>
            <div style={{ ...Typography.app.caption, color: ink.textMuted }}>
              Move notes cleanly in JSON or Markdown format.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
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

        <div
          role="tablist"
          aria-label="Portability mode"
          style={{
            display: 'flex',
            gap: 6,
            padding: '10px 18px',
            borderBottom: `1px solid ${ink.border}`,
            backgroundColor: theme.surface,
          }}
        >
          {(
            [
              { key: 'export', label: 'Export Notes', Icon: Download },
              { key: 'import', label: 'Import Files', Icon: Upload },
            ] as const
          ).map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                style={{
                  flex: 1,
                  height: 36,
                  borderRadius: Radius.md,
                  border: `1px solid ${active ? theme.accent : ink.border}`,
                  backgroundColor: active ? ink.pillBg : 'transparent',
                  color: active ? ink.text : ink.textMuted,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  ...Typography.app.bodyStrong,
                }}
              >
                <Icon size={15} color={active ? theme.accent : ink.textMuted} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {tab === 'export' ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ ...Typography.app.captionStrong, color: ink.textMuted }}>
                  Format
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(
                    [
                      {
                        key: 'markdown',
                        title: 'Markdown (.md)',
                        detail: 'Readable text with YAML frontmatter',
                        Icon: FileText,
                      },
                      {
                        key: 'json',
                        title: 'JSON (.json)',
                        detail: 'Full structure, tags, pins & folders',
                        Icon: FileCode2,
                      },
                    ] as const
                  ).map(({ key, title, detail, Icon }) => {
                    const active = exportFormat === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setExportFormat(key)}
                        style={{
                          padding: 12,
                          borderRadius: Radius.lg,
                          border: `1.5px solid ${active ? theme.accent : ink.border}`,
                          backgroundColor: active ? ink.pillBg : 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon size={15} color={active ? theme.accent : ink.textMuted} />
                          <span style={{ ...Typography.app.bodyStrong, color: ink.text }}>
                            {title}
                          </span>
                        </div>
                        <span style={{ ...Typography.app.caption, color: ink.textMuted }}>
                          {detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ ...Typography.app.captionStrong, color: ink.textMuted }}>
                  Scope
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(
                    [
                      {
                        key: 'all',
                        label: `All workspace notes (${allNotes.length})`,
                        disabled: allNotes.length === 0,
                      },
                      {
                        key: 'folder',
                        label: `Current folder: ${currentFolderLabel} (${folderNoteCount})`,
                        disabled: folderNoteCount === 0,
                      },
                      ...(activeNote
                        ? [
                            {
                              key: 'active' as const,
                              label: `Current note: ${activeNote.title || 'Untitled'}`,
                              disabled: false,
                            },
                          ]
                        : []),
                    ] as const
                  ).map((opt) => {
                    const active = exportScope === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={opt.disabled}
                        aria-pressed={active}
                        onClick={() => setExportScope(opt.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: Radius.md,
                          border: `1px solid ${active ? theme.accent : ink.border}`,
                          backgroundColor: active ? ink.pillBg : 'transparent',
                          color: ink.text,
                          opacity: opt.disabled ? 0.45 : 1,
                          cursor: opt.disabled ? 'default' : 'pointer',
                          textAlign: 'left',
                          ...Typography.app.body,
                        }}
                      >
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {opt.label}
                        </span>
                        {active ? <Check size={15} color={theme.accent} /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  disabled={notesForExport.length === 0}
                  onClick={() => void handleCopyExport()}
                  style={{
                    height: 40,
                    padding: '0 14px',
                    borderRadius: Radius.button,
                    border: `1px solid ${ink.border}`,
                    backgroundColor: 'transparent',
                    color: ink.text,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: notesForExport.length === 0 ? 'default' : 'pointer',
                    opacity: notesForExport.length === 0 ? 0.45 : 1,
                    ...Typography.app.bodyStrong,
                  }}
                >
                  {exportFeedback === 'copied' ? (
                    <Check size={15} color={theme.accent} />
                  ) : (
                    <Copy size={15} />
                  )}
                  <span>{exportFeedback === 'copied' ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  disabled={notesForExport.length === 0}
                  onClick={handleDownloadExport}
                  style={{
                    height: 40,
                    padding: '0 18px',
                    borderRadius: Radius.button,
                    border: 'none',
                    backgroundColor: theme.accent,
                    color: theme.accentText,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: notesForExport.length === 0 ? 'default' : 'pointer',
                    opacity: notesForExport.length === 0 ? 0.45 : 1,
                    ...Typography.app.bodyStrong,
                  }}
                >
                  {exportFeedback === 'downloaded' ? (
                    <Check size={15} />
                  ) : (
                    <Download size={15} />
                  )}
                  <span>
                    {exportFeedback === 'downloaded'
                      ? 'Downloaded'
                      : `Download .${exportFormat === 'json' ? 'json' : 'md'}`}
                  </span>
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".json,.md,.markdown,.txt,application/json,text/markdown,text/plain"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files) {
                    void readFiles(e.target.files);
                  }
                  e.target.value = '';
                }}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) {
                    void readFiles(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                style={{
                  border: `1.5px dashed ${isDragging ? theme.accent : ink.border}`,
                  backgroundColor: isDragging ? ink.pillBg : theme.surface,
                  borderRadius: Radius.lg,
                  padding: '22px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                <Upload size={22} color={theme.accent} />
                <div style={{ ...Typography.app.bodyStrong, color: ink.text }}>
                  Drop JSON or Markdown files here
                </div>
                <div style={{ ...Typography.app.caption, color: ink.textMuted }}>
                  Or click to select <code>.json</code>, <code>.md</code>, or <code>.txt</code> files
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label
                  htmlFor="import-target-folder"
                  style={{
                    ...Typography.app.captionStrong,
                    color: ink.textMuted,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <FolderInput size={13} />
                  <span>Destination folder</span>
                </label>
                <select
                  id="import-target-folder"
                  value={targetFolderId}
                  onChange={(e) => setTargetFolderId(e.target.value)}
                  style={{
                    height: 38,
                    padding: '0 10px',
                    borderRadius: Radius.input,
                    border: `1px solid ${ink.border}`,
                    backgroundColor: theme.background,
                    color: ink.text,
                    ...Typography.app.body,
                  }}
                >
                  {flatFolders.map(({ node, depth }) => (
                    <option key={node.id} value={node.id}>
                      {'\u00A0'.repeat(depth * 3)}
                      {node.label}
                    </option>
                  ))}
                </select>

                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    ...Typography.app.caption,
                    color: ink.textMuted,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={matchOriginalFolders}
                    onChange={(e) => setMatchOriginalFolders(e.target.checked)}
                  />
                  <span>Preserve or recreate original folders when included in file metadata</span>
                </label>
              </div>

              {warnings.length > 0 ? (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: Radius.md,
                    border: `1px solid ${ink.border}`,
                    backgroundColor: theme.surface,
                    color: ink.error,
                    ...Typography.app.caption,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {warnings.map((w, idx) => (
                    <span key={idx}>{w}</span>
                  ))}
                </div>
              ) : null}

              {importDoneCount !== null ? (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: Radius.md,
                    border: `1px solid ${theme.accent}`,
                    backgroundColor: ink.pillBg,
                    color: ink.text,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    ...Typography.app.bodyStrong,
                  }}
                >
                  <Check size={16} color={theme.accent} />
                  <span>
                    Imported {importDoneCount} {importDoneCount === 1 ? 'note' : 'notes'} into your
                    workspace.
                  </span>
                </div>
              ) : null}

              {stagedNotes.length > 0 ? (
                <div
                  style={{
                    border: `1px solid ${ink.border}`,
                    borderRadius: Radius.md,
                    backgroundColor: theme.surface,
                    padding: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    maxHeight: 148,
                    overflowY: 'auto',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      ...Typography.app.captionStrong,
                      color: ink.textMuted,
                    }}
                  >
                    <span>
                      Ready to import {stagedNotes.length}{' '}
                      {stagedNotes.length === 1 ? 'note' : 'notes'} from {stagedFiles.length}{' '}
                      {stagedFiles.length === 1 ? 'file' : 'files'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setStagedNotes([]);
                        setStagedFolders([]);
                        setStagedFiles([]);
                        setWarnings([]);
                      }}
                      style={{
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: theme.accent,
                        cursor: 'pointer',
                        padding: 0,
                        ...Typography.app.captionStrong,
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  {stagedNotes.slice(0, 8).map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        ...Typography.app.caption,
                        color: ink.text,
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.title}
                      </span>
                      <span style={{ color: ink.textMuted, flexShrink: 0 }}>
                        {item.isPinned ? 'Pinned · ' : ''}
                        {item.tags.length > 0 ? item.tags.slice(0, 2).join(', ') : 'Markdown'}
                      </span>
                    </div>
                  ))}
                  {stagedNotes.length > 8 ? (
                    <div style={{ ...Typography.app.caption, color: ink.textMuted }}>
                      +{stagedNotes.length - 8} more notes
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    height: 40,
                    padding: '0 14px',
                    borderRadius: Radius.button,
                    border: `1px solid ${ink.border}`,
                    backgroundColor: 'transparent',
                    color: ink.text,
                    cursor: 'pointer',
                    ...Typography.app.bodyStrong,
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={stagedNotes.length === 0 || isImporting}
                  onClick={() => void handleConfirmImport()}
                  style={{
                    height: 40,
                    padding: '0 18px',
                    borderRadius: Radius.button,
                    border: 'none',
                    backgroundColor: theme.accent,
                    color: theme.accentText,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: stagedNotes.length === 0 || isImporting ? 'default' : 'pointer',
                    opacity: stagedNotes.length === 0 || isImporting ? 0.45 : 1,
                    ...Typography.app.bodyStrong,
                  }}
                >
                  <Upload size={15} />
                  <span>
                    {isImporting
                      ? 'Importing…'
                      : `Import ${stagedNotes.length > 0 ? stagedNotes.length : ''} ${stagedNotes.length === 1 ? 'note' : 'notes'}`.trim()}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
