import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  HelpCircle,
  Keyboard,
  LogOut,
  Menu,
  Palette,
  SlidersHorizontal,
  Upload,
  User,
} from 'lucide-react';
import { DockVariantPreview } from '../components/CapsuleSwitcher';
import { FabMenuPreview } from '../components/FloatingActionFab';
import { SECTION_COPY } from '../components/overview/CustomizeOverview';
import { ToggleSwitch } from '../components/shared/ToggleSwitch';
import { useAuthStore } from '../store/useAuthStore';
import { useNoteStore } from '../store/useNoteStore';
import { usePrefsStore, type BehaviourKey } from '../store/usePrefsStore';
import {
  ACCENTS,
  ACCENT_NAMES,
  Layout,
  Radius,
  THEMES,
  THEME_NAMES,
  Typography,
  surfaceTheme,
  type AccentName,
  type Theme,
  type ThemeName,
} from '../theme';
import {
  DOCK_POSITIONS,
  DOCK_POSITION_LABELS,
  DOCK_VARIANTS,
  DOCK_VARIANT_LABELS,
  FAB_VARIANTS,
  FAB_VARIANT_LABELS,
  NOTES_LAYOUTS,
  NOTES_LAYOUT_LABELS,
  SETTINGS_SECTIONS,
  type DockPosition,
  type DockVariant,
  type FabVariant,
  type NotesLayout,
  type SettingsSection,
} from '../types';
import { copyToClipboard } from '../utils';

export interface SettingsHandle {
  goBack: () => boolean;
}

const SECTION_META: Record<
  SettingsSection,
  { label: string; description: string }
> = {
  accounts: { label: 'Accounts', description: 'Profile, workspace export & session' },
  general: { label: 'General', description: 'Deleting, creating & editor behaviour' },
  preference: { label: 'Preference', description: 'Theme, accent, switcher & overview layout' },
  shortcuts: { label: 'Shortcuts', description: 'Keyboard & pointer shortcuts' },
  help: { label: 'Help', description: 'Local workspace info & diagnostics' },
};

function renderSectionIcon(section: SettingsSection, color: string) {
  switch (section) {
    case 'accounts':
      return <User size={16} color={color} />;
    case 'general':
      return <SlidersHorizontal size={16} color={color} />;
    case 'preference':
      return <Palette size={16} color={color} />;
    case 'shortcuts':
      return <Keyboard size={16} color={color} />;
    case 'help':
      return <HelpCircle size={16} color={color} />;
  }
}

const BEHAVIOUR_ROWS: { key: BehaviourKey; label: string; hint: string }[] = [
  {
    key: 'confirmDelete',
    label: 'Confirm before deleting',
    hint: 'Ask before removing notes, folders, or events.',
  },
  {
    key: 'openNewNote',
    label: 'Open new notes immediately',
    hint: 'Jump straight into the Notes editor after creating a note.',
  },
];

const SHORTCUT_ITEMS: { keys: string; label: string; detail: string }[] = [
  { keys: 'Ctrl / ⌘ + K', label: 'Quick search', detail: 'Jump directly to the sidebar search field.' },
  { keys: 'Esc', label: 'Close overlay or menu', detail: 'Dismiss active dialogs, context menus, or search.' },
  { keys: 'Right-click', label: 'Context actions', detail: 'Rename, move, duplicate, or delete notes and folders.' },
  { keys: '[ ] * ` >', label: 'Auto-pairs & markdown', detail: 'Matching brackets/quotes close automatically while typing.' },
  { keys: 'Ctrl + Drag / Scroll', label: 'Resize & pan', detail: 'Drag sidebar or note list borders; scroll horizontally on note cards.' },
];

export const SettingsScreen = forwardRef<
  SettingsHandle,
  {
    theme: Theme;
    isMobile: boolean;
    onExportData: () => Promise<boolean>;
    onOpenPortability?: (tab: 'export' | 'import') => void;
  }
>(function SettingsScreen({ theme, isMobile, onExportData, onOpenPortability }, ref) {
  const ink = surfaceTheme(theme);
  const [section, setSection] = useState<SettingsSection>('preference');
  const [mobileDetail, setMobileDetail] = useState(false);

  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const notes = useNoteStore((s) => s.notes);
  const folders = useNoteStore((s) => s.folders);
  const noteCounts = useNoteStore((s) => s.noteCounts);

  const themeName = usePrefsStore((s) => s.themeName);
  const accent = usePrefsStore((s) => s.accent);
  const displayName = usePrefsStore((s) => s.displayName);
  const dockPosition = usePrefsStore((s) => s.dockPosition);
  const dockVariant = usePrefsStore((s) => s.dockVariant);
  const fabVariant = usePrefsStore((s) => s.fabVariant);
  const showSectionTitles = usePrefsStore((s) => s.showSectionTitles);
  const layout = usePrefsStore((s) => s.layout);
  const order = usePrefsStore((s) => s.order);
  const confirmDelete = usePrefsStore((s) => s.confirmDelete);
  const openNewNote = usePrefsStore((s) => s.openNewNote);
  const notesLayout = usePrefsStore((s) => s.notesLayout);
  const setNotesLayout = usePrefsStore((s) => s.setNotesLayout);

  const setThemeName = usePrefsStore((s) => s.setThemeName);
  const setAccent = usePrefsStore((s) => s.setAccent);
  const setDisplayName = usePrefsStore((s) => s.setDisplayName);
  const setDockPosition = usePrefsStore((s) => s.setDockPosition);
  const setDockVariant = usePrefsStore((s) => s.setDockVariant);
  const setFabVariant = usePrefsStore((s) => s.setFabVariant);
  const setShowSectionTitles = usePrefsStore((s) => s.setShowSectionTitles);
  const toggleSection = usePrefsStore((s) => s.toggleSection);
  const reorderSections = usePrefsStore((s) => s.reorderSections);
  const setBehaviour = usePrefsStore((s) => s.setBehaviour);
  const resetLayout = usePrefsStore((s) => s.resetLayout);

  const [nameDraft, setNameDraft] = useState(displayName || user?.fullName || '');
  const [exportStatus, setExportStatus] = useState<'idle' | 'done'>('idle');
  const [diagCopied, setDiagCopied] = useState(false);

  useEffect(() => {
    setNameDraft(displayName || user?.fullName || '');
  }, [displayName, user?.fullName]);

  useImperativeHandle(
    ref,
    () => ({
      goBack: () => {
        if (isMobile && mobileDetail) {
          setMobileDetail(false);
          return true;
        }
        return false;
      },
    }),
    [isMobile, mobileDetail]
  );

  const totalNotes = Object.values(noteCounts).reduce((acc, n) => acc + n, 0) || notes.length;

  const handleExport = async () => {
    const ok = await onExportData();
    if (ok) {
      setExportStatus('done');
      setTimeout(() => setExportStatus('idle'), 2000);
    }
  };

  const handleCopyDiagnostics = async () => {
    const payload = [
      `Simplicity Web Workspace`,
      `Theme: ${themeName} (${accent})`,
      `Dock: ${dockPosition} / ${dockVariant}`,
      `Notes: ${totalNotes} across ${folders.length} folders`,
      `UserAgent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`,
    ].join('\n');
    const ok = await copyToClipboard(payload);
    if (ok) {
      setDiagCopied(true);
      setTimeout(() => setDiagCopied(false), 1800);
    }
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.surface,
    border: `1px solid ${ink.border}`,
    borderRadius: Radius.card,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  const draggedIndexRef = useRef<number | null>(null);

  const renderAccounts = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: Radius.full,
              backgroundColor: theme.accent,
              color: theme.accentText,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              ...Typography.app.cardHeader,
            }}
          >
            {(displayName || user?.fullName || user?.email || 'W').slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...Typography.app.cardHeader, color: ink.text }}>
              {displayName || user?.fullName || 'Workspace'}
            </div>
            <div style={{ ...Typography.app.caption, color: ink.textMuted }}>
              {user?.email ?? 'workspace@simplicity.local'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <label
            htmlFor="settings-display-name"
            style={{ ...Typography.app.captionStrong, color: ink.textMuted }}
          >
            Display name (used in Overview greeting)
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="settings-display-name"
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => setDisplayName(nameDraft)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setDisplayName(nameDraft);
              }}
              placeholder="Your name"
              style={{
                flex: 1,
                height: 42,
                padding: '0 12px',
                borderRadius: Radius.input,
                border: `1px solid ${ink.border}`,
                backgroundColor: theme.background,
                color: ink.text,
                ...Typography.app.body,
              }}
            />
            <button
              type="button"
              onClick={() => setDisplayName(nameDraft)}
              style={{
                height: 42,
                padding: '0 16px',
                borderRadius: Radius.button,
                border: `1px solid ${ink.border}`,
                backgroundColor: ink.pillBg,
                color: ink.text,
                cursor: 'pointer',
                ...Typography.app.bodyStrong,
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ ...Typography.app.bodyStrong, color: ink.text }}>Workspace Data</div>
        <div style={{ ...Typography.app.caption, color: ink.textMuted }}>
          Stored locally in this browser ({totalNotes} notes, {folders.length} folders).
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            onClick={() => void handleExport()}
            style={{
              height: 44,
              padding: '0 16px',
              borderRadius: Radius.button,
              border: `1px solid ${ink.border}`,
              backgroundColor: ink.pillBg,
              color: ink.text,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            {exportStatus === 'done' ? <Check size={16} color={theme.accent} /> : <Download size={16} />}
            <span>{exportStatus === 'done' ? 'Exported JSON' : 'Export workspace (.json)'}</span>
          </button>

          {onOpenPortability ? (
            <>
              <button
                type="button"
                onClick={() => onOpenPortability('export')}
                style={{
                  height: 44,
                  padding: '0 16px',
                  borderRadius: Radius.button,
                  border: `1px solid ${ink.border}`,
                  backgroundColor: ink.pillBg,
                  color: ink.text,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  ...Typography.app.bodyStrong,
                }}
              >
                <Download size={16} />
                <span>Export notes (.md / .json)</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenPortability('import')}
                style={{
                  height: 44,
                  padding: '0 16px',
                  borderRadius: Radius.button,
                  border: `1px solid ${ink.border}`,
                  backgroundColor: ink.pillBg,
                  color: ink.text,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  ...Typography.app.bodyStrong,
                }}
              >
                <Upload size={16} />
                <span>Import notes</span>
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={signOut}
            style={{
              height: 44,
              padding: '0 16px',
              borderRadius: Radius.button,
              border: `1px solid ${ink.border}`,
              backgroundColor: 'transparent',
              color: ink.error,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              ...Typography.app.bodyStrong,
            }}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderGeneral = () => {
    const values: Record<BehaviourKey, boolean> = { confirmDelete, openNewNote };
    return (
      <div style={cardStyle}>
        {BEHAVIOUR_ROWS.map((row, idx) => (
          <div
            key={row.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minHeight: 56,
              paddingBottom: idx < BEHAVIOUR_ROWS.length - 1 ? 12 : 0,
              borderBottom: idx < BEHAVIOUR_ROWS.length - 1 ? `1px solid ${ink.border}` : 'none',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...Typography.app.bodyStrong, color: ink.text }}>{row.label}</div>
              <div style={{ ...Typography.app.caption, color: ink.textMuted }}>{row.hint}</div>
            </div>
            <ToggleSwitch
              theme={theme}
              value={values[row.key]}
              onValueChange={(next) => setBehaviour(row.key, next)}
              accessibilityLabel={row.label}
            />
          </div>
        ))}
      </div>
    );
  };

  const renderPreference = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={cardStyle}>
        <div style={{ ...Typography.app.bodyStrong, color: ink.text }}>Theme</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: 8 }}>
          {THEME_NAMES.map((name: ThemeName) => {
            const active = themeName === name;
            const palette = THEMES[name];
            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                onClick={() => setThemeName(name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 48,
                  padding: '0 12px',
                  borderRadius: Radius.lg,
                  border: `1.5px solid ${active ? theme.accent : ink.border}`,
                  backgroundColor: active ? ink.pillBg : 'transparent',
                  color: ink.text,
                  cursor: 'pointer',
                  ...Typography.app.bodyStrong,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: Radius.full,
                    backgroundColor: palette.background,
                    border: `2px solid ${palette.text}`,
                    flexShrink: 0,
                  }}
                />
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ ...Typography.app.bodyStrong, color: ink.text }}>Accent</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))', gap: 8 }}>
          {ACCENT_NAMES.map((name: AccentName) => {
            const active = accent === name;
            const swatch = ACCENTS[name];
            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                onClick={() => setAccent(name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 48,
                  padding: '0 12px',
                  borderRadius: Radius.lg,
                  border: `1.5px solid ${active ? theme.accent : ink.border}`,
                  backgroundColor: active ? ink.pillBg : 'transparent',
                  color: ink.text,
                  cursor: 'pointer',
                  ...Typography.app.bodyStrong,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: Radius.full,
                    backgroundColor: swatch.value,
                    border: `1px solid ${ink.border}`,
                    flexShrink: 0,
                  }}
                />
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ ...Typography.app.bodyStrong, color: ink.text }}>Notes list layout</div>
        <div style={{ ...Typography.app.caption, color: ink.textMuted }}>
          Choose where the note list bar appears or switch to a left ribbon rail.
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {NOTES_LAYOUTS.map((nl: NotesLayout) => {
            const active = notesLayout === nl;
            return (
              <button
                key={nl}
                type="button"
                aria-pressed={active}
                onClick={() => setNotesLayout(nl)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: Radius.lg,
                  border: `1.5px solid ${active ? theme.accent : ink.border}`,
                  backgroundColor: active ? ink.pillBg : 'transparent',
                  color: ink.text,
                  cursor: 'pointer',
                  ...Typography.app.bodyStrong,
                }}
              >
                {NOTES_LAYOUT_LABELS[nl]}
              </button>
            );
          })}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ ...Typography.app.bodyStrong, color: ink.text }}>Screen switcher</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {DOCK_POSITIONS.map((pos: DockPosition) => {
            const active = dockPosition === pos;
            return (
              <button
                key={pos}
                type="button"
                aria-pressed={active}
                onClick={() => setDockPosition(pos)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: Radius.lg,
                  border: `1.5px solid ${active ? theme.accent : ink.border}`,
                  backgroundColor: active ? ink.pillBg : 'transparent',
                  color: ink.text,
                  cursor: 'pointer',
                  ...Typography.app.bodyStrong,
                }}
              >
                {DOCK_POSITION_LABELS[pos]}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {DOCK_VARIANTS.map((variant: DockVariant) => {
            const active = dockVariant === variant;
            return (
              <button
                key={variant}
                type="button"
                aria-pressed={active}
                onClick={() => setDockVariant(variant)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  minHeight: 48,
                  padding: '8px 12px',
                  borderRadius: Radius.lg,
                  border: `1.5px solid ${active ? theme.accent : ink.border}`,
                  backgroundColor: active ? ink.pillBg : 'transparent',
                  color: ink.text,
                  cursor: 'pointer',
                  ...Typography.app.body,
                }}
              >
                <span>{DOCK_VARIANT_LABELS[variant]}</span>
                <DockVariantPreview theme={theme} variant={variant} />
              </button>
            );
          })}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ ...Typography.app.bodyStrong, color: ink.text }}>Create button menu</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FAB_VARIANTS.map((variant: FabVariant) => {
            const active = fabVariant === variant;
            return (
              <button
                key={variant}
                type="button"
                aria-pressed={active}
                onClick={() => setFabVariant(variant)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  minHeight: 48,
                  padding: '8px 12px',
                  borderRadius: Radius.lg,
                  border: `1.5px solid ${active ? theme.accent : ink.border}`,
                  backgroundColor: active ? ink.pillBg : 'transparent',
                  color: ink.text,
                  cursor: 'pointer',
                  ...Typography.app.body,
                }}
              >
                <span>{FAB_VARIANT_LABELS[variant]}</span>
                <FabMenuPreview theme={theme} variant={variant} />
              </button>
            );
          })}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ ...Typography.app.bodyStrong, color: ink.text }}>Overview layout</div>
            <div style={{ ...Typography.app.caption, color: ink.textMuted }}>
              Show section headings and customize card order.
            </div>
          </div>
          <button
            type="button"
            onClick={resetLayout}
            style={{
              height: 34,
              padding: '0 12px',
              borderRadius: Radius.md,
              border: `1px solid ${ink.border}`,
              backgroundColor: 'transparent',
              color: ink.textMuted,
              cursor: 'pointer',
              ...Typography.app.captionStrong,
            }}
          >
            Restore defaults
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 48,
            paddingBottom: 8,
            borderBottom: `1px solid ${ink.border}`,
          }}
        >
          <span style={{ ...Typography.app.body, color: ink.text }}>Show section titles</span>
          <ToggleSwitch
            theme={theme}
            value={showSectionTitles}
            onValueChange={setShowSectionTitles}
            accessibilityLabel="Show section titles"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {order.map((key, index) => {
            const copy = SECTION_COPY[key];
            const visible = layout[key];
            return (
              <div
                key={key}
                draggable
                onDragStart={(e) => {
                  draggedIndexRef.current = index;
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = draggedIndexRef.current;
                  if (from !== null && from !== index) {
                    reorderSections(from, index);
                  }
                  draggedIndexRef.current = null;
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 48,
                  padding: '6px 8px',
                  borderRadius: Radius.md,
                  backgroundColor: theme.background,
                  border: `1px solid ${ink.border}`,
                  cursor: 'grab',
                }}
              >
                <div
                  aria-label={`Drag to reorder ${copy.label}`}
                  title="Hold and drag to reorder"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    color: ink.textMuted,
                    cursor: 'grab',
                    flexShrink: 0,
                  }}
                >
                  <Menu size={16} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...Typography.app.body, color: ink.text }}>{copy.label}</div>
                </div>

                <ToggleSwitch
                  theme={theme}
                  value={visible}
                  onValueChange={() => toggleSection(key)}
                  accessibilityLabel={copy.label}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderShortcuts = () => (
    <div style={cardStyle}>
      {SHORTCUT_ITEMS.map((item, idx) => (
        <div
          key={item.keys}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            minHeight: 52,
            paddingBottom: idx < SHORTCUT_ITEMS.length - 1 ? 10 : 0,
            borderBottom: idx < SHORTCUT_ITEMS.length - 1 ? `1px solid ${ink.border}` : 'none',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...Typography.app.bodyStrong, color: ink.text }}>{item.label}</div>
            <div style={{ ...Typography.app.caption, color: ink.textMuted }}>{item.detail}</div>
          </div>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: Radius.md,
              backgroundColor: ink.pillBg,
              border: `1px solid ${ink.border}`,
              color: ink.text,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {item.keys}
          </span>
        </div>
      ))}
    </div>
  );

  const renderHelp = () => (
    <div style={cardStyle}>
      <div style={{ ...Typography.app.cardHeader, color: ink.text }}>Simplicity</div>
      <div style={{ ...Typography.app.body, color: ink.textMuted }}>
        Local-first notes, tasks, scratch pad, and agenda workspace. Everything is saved immediately
        to your browser storage with zero setup required.
      </div>
      <div>
        <button
          type="button"
          onClick={() => void handleCopyDiagnostics()}
          style={{
            height: 42,
            padding: '0 14px',
            borderRadius: Radius.button,
            border: `1px solid ${ink.border}`,
            backgroundColor: ink.pillBg,
            color: ink.text,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            ...Typography.app.bodyStrong,
          }}
        >
          {diagCopied ? <Check size={16} color={theme.accent} /> : <Copy size={16} />}
          <span>{diagCopied ? 'Diagnostics copied' : 'Copy diagnostics'}</span>
        </button>
      </div>
    </div>
  );

  const renderDetail = () => {
    switch (section) {
      case 'accounts':
        return renderAccounts();
      case 'general':
        return renderGeneral();
      case 'preference':
        return renderPreference();
      case 'shortcuts':
        return renderShortcuts();
      case 'help':
        return renderHelp();
    }
  };

  if (isMobile) {
    return (
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            width: '100%',
            maxWidth: Layout.contentMaxWidth,
            margin: '0 auto',
            padding: '8px 16px 96px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {mobileDetail ? (
            <>
              <button
                type="button"
                onClick={() => setMobileDetail(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: theme.accent,
                  padding: '6px 0',
                  cursor: 'pointer',
                  ...Typography.app.bodyStrong,
                }}
              >
                <ChevronLeft size={18} />
                <span>{SECTION_META[section].label}</span>
              </button>
              {renderDetail()}
            </>
          ) : (
            <div style={cardStyle}>
              {SETTINGS_SECTIONS.map((key, idx) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSection(key);
                    setMobileDetail(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    minHeight: 52,
                    width: '100%',
                    border: 'none',
                    borderBottom: idx < SETTINGS_SECTIONS.length - 1 ? `1px solid ${ink.border}` : 'none',
                    backgroundColor: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: '6px 0',
                  }}
                >
                  {renderSectionIcon(key, theme.accent)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...Typography.app.bodyStrong, color: ink.text }}>
                      {SECTION_META[key].label}
                    </div>
                    <div style={{ ...Typography.app.caption, color: ink.textMuted }}>
                      {SECTION_META[key].description}
                    </div>
                  </div>
                  <ChevronRight size={16} color={ink.textMuted} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          margin: '0 auto',
          padding: '16px 24px 96px 24px',
          display: 'flex',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        <nav
          aria-label="Settings sections"
          style={{
            width: 220,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {SETTINGS_SECTIONS.map((key) => {
            const active = section === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 44,
                  padding: '0 12px',
                  borderRadius: Radius.md,
                  border: 'none',
                  backgroundColor: active ? theme.pillBg : 'transparent',
                  color: active ? theme.text : theme.textMuted,
                  cursor: 'pointer',
                  textAlign: 'left',
                  ...(active ? Typography.app.bodyStrong : Typography.app.body),
                }}
              >
                {renderSectionIcon(key, active ? theme.accent : theme.textMuted)}
                <span>{SECTION_META[key].label}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ ...Typography.app.pageHeader, color: theme.text }}>
              {SECTION_META[section].label}
            </div>
            <div style={{ ...Typography.app.caption, color: theme.textMuted }}>
              {SECTION_META[section].description}
            </div>
          </div>
          {renderDetail()}
        </div>
      </div>
    </div>
  );
});
