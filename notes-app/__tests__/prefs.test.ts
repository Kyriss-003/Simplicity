jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import { PrefsRepository } from '../src/db/PrefsRepository';
import { usePrefsStore } from '../src/store/usePrefsStore';
import { ACCENTS } from '../src/theme';
import {
  DEFAULT_LAYOUT,
  DEFAULT_ORDER,
  DOCK_VARIANTS,
  FAB_VARIANTS,
  LAYOUT_SECTIONS,
  LIST_WIDTH_DEFAULT,
  LIST_WIDTH_MAX,
  LIST_WIDTH_MIN,
} from '../src/types';

const resetStore = () =>
  usePrefsStore.setState({
    ready: false,
    themeName: 'Dark',
    accent: 'Claude',
    dockPosition: 'bottom',
    dockVariant: 'iconLabel',
    fabVariant: 'iconLabel',
    showSectionTitles: true,
    listWidth: LIST_WIDTH_DEFAULT,
    layout: { ...DEFAULT_LAYOUT },
    order: [...DEFAULT_ORDER],
    confirmDelete: true,
    openNewNote: true,
  });

beforeEach(() => {
  localStorage.clear();
  // The store is a module singleton, so its `ready` latch has to be reset for
  // each test or only the first one would ever read from storage.
  resetStore();
});

describe('PrefsRepository (web backend)', () => {
  it('returns an empty bag before anything is written', async () => {
    const repo = new PrefsRepository();
    expect(await repo.getAll()).toEqual({});
    expect(await repo.get('theme')).toBeNull();
  });

  it('round-trips a value through storage', async () => {
    const repo = new PrefsRepository();
    await repo.set('theme', 'OLED');
    expect(await repo.get('theme')).toBe('OLED');
    // A second instance must see the persisted value, not an empty cache.
    expect(await new PrefsRepository().get('theme')).toBe('OLED');
  });

  it('keeps values that contain the key/value separator', async () => {
    const repo = new PrefsRepository();
    await repo.set('layout', '{"notes":true,"note":"a=b"}');
    expect(await repo.get('layout')).toBe('{"notes":true,"note":"a=b"}');
  });

  it('writes many keys at once and overwrites existing ones', async () => {
    const repo = new PrefsRepository();
    await repo.set('theme', 'Light');
    await repo.setMany({ theme: 'Dark', layout: '{"notes":false}' });
    expect(await repo.getAll()).toEqual({ theme: 'Dark', layout: '{"notes":false}' });
  });
});

describe('usePrefsStore', () => {
  it('starts on the default theme with every Overview section visible', async () => {
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().themeName).toBe('Dark');
    expect(usePrefsStore.getState().layout).toEqual(DEFAULT_LAYOUT);
  });

  it('restores the persisted theme and layout on launch', async () => {
    const repo = new PrefsRepository();
    await repo.setMany({ theme: 'OLED', layout: '{"notes":false,"calendar":true}' });

    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().themeName).toBe('OLED');
    // A partial blob keeps defaults for the keys it does not mention.
    expect(usePrefsStore.getState().layout).toEqual({
      notes: false,
      calendar: true,
      tasks: true,
      scratchPad: true,
    });
  });

  it('falls back to defaults when the stored layout is corrupt', async () => {
    await new PrefsRepository().set('layout', '{not json');
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().layout).toEqual(DEFAULT_LAYOUT);
  });

  it('ignores an unknown theme name rather than rendering an undefined theme', async () => {
    await new PrefsRepository().set('theme', 'Midnight');
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().themeName).toBe('Dark');
  });

  it('persists a section toggle', async () => {
    await usePrefsStore.getState().initialize();
    usePrefsStore.getState().toggleSection('calendar');
    expect(usePrefsStore.getState().layout.calendar).toBe(false);

    const stored = JSON.parse((await new PrefsRepository().get('layout')) ?? '{}');
    expect(stored.calendar).toBe(false);
  });

  it('restores the default layout', async () => {
    await usePrefsStore.getState().initialize();
    usePrefsStore.getState().toggleSection('tasks');
    usePrefsStore.getState().resetLayout();
    expect(usePrefsStore.getState().layout).toEqual(DEFAULT_LAYOUT);
  });
});

describe('behaviour preferences', () => {
  it('defaults to the safe options: confirm deletes, open new notes', () => {
    expect(usePrefsStore.getState().confirmDelete).toBe(true);
    expect(usePrefsStore.getState().openNewNote).toBe(true);
  });

  it('persists a change', () => {
    usePrefsStore.getState().setBehaviour('confirmDelete', false);
    const stored = JSON.parse(localStorage.getItem('notes_app_prefs')?.match(/^general=(.*)$/m)?.[1] ?? '{}');
    expect(stored.confirmDelete).toBe(false);
  });

  it('leaves the other flag alone when one changes', () => {
    usePrefsStore.getState().setBehaviour('openNewNote', false);
    expect(usePrefsStore.getState().confirmDelete).toBe(true);
    expect(usePrefsStore.getState().openNewNote).toBe(false);
  });

  it('ignores an unknown key rather than writing it', () => {
    // @ts-expect-error — deliberately passing a key that does not exist
    usePrefsStore.getState().setBehaviour('nonsense', true);
    const stored = JSON.parse(localStorage.getItem('notes_app_prefs')?.match(/^general=(.*)$/m)?.[1] ?? '{}');
    expect(stored.nonsense).toBeUndefined();
  });

  it('restores a corrupt behaviour blob to the defaults', () => {
    localStorage.setItem('notes_app_prefs', 'general={not json');
    usePrefsStore.setState({ ready: false });
    return usePrefsStore.getState().initialize().then(() => {
      expect(usePrefsStore.getState().confirmDelete).toBe(true);
      expect(usePrefsStore.getState().openNewNote).toBe(true);
    });
  });

  it('keeps only known keys from a stored blob', () => {
    // The repository stores the value verbatim, so the blob is raw JSON.
    localStorage.setItem(
      'notes_app_prefs',
      'general={"confirmDelete":false,"ghost":true}'
    );
    usePrefsStore.setState({ ready: false });
    return usePrefsStore.getState().initialize().then(() => {
      expect(usePrefsStore.getState().confirmDelete).toBe(false);
      expect(usePrefsStore.getState().openNewNote).toBe(true);
    });
  });
});

describe('accent preference', () => {
  it('defaults to the brand accent', async () => {
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().accent).toBe('Claude');
  });

  it('resolves the renamed Coral to Claude, colour unchanged', async () => {
    // `Coral` was renamed to `Claude`. A stored value from before the rename
    // must not fall through to the fallback — the fallback happens to be the same
    // colour today, so this would pass by luck and break the next rename. What is
    // actually being pinned is that the legacy map resolves it explicitly.
    await new PrefsRepository().set('accent', 'Coral');
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().accent).toBe('Claude');
    expect(ACCENTS.Claude.value).toBe('#f76f53');
  });

  it('persists a non-default accent', async () => {
    await usePrefsStore.getState().initialize();
    usePrefsStore.getState().setAccent('Lavender');
    expect(usePrefsStore.getState().accent).toBe('Lavender');
    expect(await new PrefsRepository().get('accent')).toBe('Lavender');
  });

  it('persists both monochrome accents', async () => {
    await usePrefsStore.getState().initialize();
    usePrefsStore.getState().setAccent('Black');
    expect(await new PrefsRepository().get('accent')).toBe('Black');
    usePrefsStore.getState().setAccent('White');
    expect(await new PrefsRepository().get('accent')).toBe('White');
  });

  it('ignores an unknown accent name', async () => {
    await new PrefsRepository().set('accent', 'Mint');
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().accent).toBe('Claude');
  });
});

describe('note list pane width', () => {
  it('defaults to the width the pane has always used', async () => {
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().listWidth).toBe(LIST_WIDTH_DEFAULT);
  });

  it('writes the live width during a drag but persists only on commit', async () => {
    // The two-phase split is the point: a preference write per pointer frame
    // would hammer the repository for a value the user cannot see until they
    // let go.
    await usePrefsStore.getState().initialize();
    usePrefsStore.getState().setListWidth(360);
    expect(usePrefsStore.getState().listWidth).toBe(360);
    expect(await new PrefsRepository().get('notes_list_width')).toBeNull();

    usePrefsStore.getState().commitListWidth(360);
    expect(await new PrefsRepository().get('notes_list_width')).toBe('360');
  });

  it('clamps a commit to the allowed range', async () => {
    await usePrefsStore.getState().initialize();
    usePrefsStore.getState().commitListWidth(5000);
    expect(usePrefsStore.getState().listWidth).toBe(LIST_WIDTH_MAX);
    usePrefsStore.getState().commitListWidth(10);
    expect(usePrefsStore.getState().listWidth).toBe(LIST_WIDTH_MIN);
  });

  it('clamps on read as well as on write', async () => {
    // A stored number is the one value that can come from a device that no
    // longer exists — an old build, or a hand-edited entry. Clamping only on
    // write would let one through on the first launch after the change.
    await new PrefsRepository().set('notes_list_width', '9000');
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().listWidth).toBe(LIST_WIDTH_MAX);
  });

  it('falls back to the default when the stored width is not a number', async () => {
    await new PrefsRepository().set('notes_list_width', 'wide');
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().listWidth).toBe(LIST_WIDTH_DEFAULT);
  });

  it('restores the committed width on the next launch', async () => {
    usePrefsStore.getState().commitListWidth(400);
    resetStore();
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().listWidth).toBe(400);
  });
});

describe('section order', () => {
  const stored = async () => JSON.parse((await new PrefsRepository().get('order')) ?? 'null');

  it('moves a section down and up again', async () => {
    await usePrefsStore.getState().initialize();
    usePrefsStore.getState().reorderSections(0, 1);
    expect(usePrefsStore.getState().order).toEqual(['calendar', 'notes', 'tasks', 'scratchPad']);
    usePrefsStore.getState().reorderSections(1, 0);
    expect(usePrefsStore.getState().order).toEqual(DEFAULT_ORDER);
  });

  it('persists the new order', async () => {
    await usePrefsStore.getState().initialize();
    usePrefsStore.getState().reorderSections(3, 2);
    expect(await stored()).toEqual(['notes', 'calendar', 'scratchPad', 'tasks']);
  });

  it('ignores a move off either end instead of wrapping', async () => {
    // A drag released past the end of the list lands out of range. Wrapping the
    // dashboard onto itself is not a reorder anyone asked for.
    await usePrefsStore.getState().initialize();
    usePrefsStore.getState().reorderSections(0, -1);
    usePrefsStore.getState().reorderSections(3, 4);
    expect(usePrefsStore.getState().order).toEqual(DEFAULT_ORDER);
  });

  it('appends a section missing from a stored order rather than dropping it', async () => {
    // A section added in a later release must appear, not silently vanish.
    await new PrefsRepository().set('order', '["calendar","notes"]');
    await usePrefsStore.getState().initialize();
    const order = usePrefsStore.getState().order;
    expect(order).toHaveLength(LAYOUT_SECTIONS.length);
    expect([...order].sort()).toEqual([...LAYOUT_SECTIONS].sort());
  });

  it('discards unknown and duplicated ids from a stored order', async () => {
    await new PrefsRepository().set('order', '["notes","notes","ghost","calendar"]');
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().order).toEqual(['notes', 'calendar', 'tasks', 'scratchPad']);
  });

  it('falls back to the default order when the stored value is corrupt', async () => {
    await new PrefsRepository().set('order', '{not json');
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().order).toEqual(DEFAULT_ORDER);
  });

  it('resetLayout restores both visibility and order', async () => {
    await usePrefsStore.getState().initialize();
    usePrefsStore.getState().reorderSections(0, 1);
    usePrefsStore.getState().toggleSection('tasks');
    usePrefsStore.getState().resetLayout();
    expect(usePrefsStore.getState().order).toEqual(DEFAULT_ORDER);
    expect(usePrefsStore.getState().layout).toEqual(DEFAULT_LAYOUT);
  });
});

describe('screen switcher tabs', () => {
  it('defaults to showing icons and text', async () => {
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().dockVariant).toBe('iconLabel');
  });

  it('persists each display mode independently from the create button menu', async () => {
    for (const variant of DOCK_VARIANTS) {
      usePrefsStore.getState().setDockVariant(variant);
      expect(usePrefsStore.getState().dockVariant).toBe(variant);
    }
    usePrefsStore.getState().setFabVariant('label');

    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().dockVariant).toBe('icon');
    expect(usePrefsStore.getState().fabVariant).toBe('label');
    expect(await new PrefsRepository().get('dock_variant')).toBe('icon');
  });

  it('falls back to showing icons and text for unknown values', async () => {
    await new PrefsRepository().set('dock_variant', 'unknown');
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().dockVariant).toBe('iconLabel');
  });
});

describe('section titles', () => {
  it('shows the titles by default', async () => {
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().showSectionTitles).toBe(true);
  });

  it('persists being hidden and reads it back on the next launch', async () => {
    usePrefsStore.getState().setShowSectionTitles(false);
    expect(await new PrefsRepository().get('section_titles')).toBe('false');

    usePrefsStore.setState({ ready: false });
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().showSectionTitles).toBe(false);
  });

  it('can be turned back on', async () => {
    usePrefsStore.getState().setShowSectionTitles(false);
    usePrefsStore.getState().setShowSectionTitles(true);
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().showSectionTitles).toBe(true);
  });

  it('keeps the titles for a missing or hand-edited value', async () => {
    // Hiding the headings is the destructive direction: a corrupt entry must
    // not leave the dashboard as four unlabelled cards.
    const repo = new PrefsRepository();
    for (const raw of ['', 'perhaps', '0']) {
      await repo.set('section_titles', raw);
      usePrefsStore.setState({ ready: false });
      await usePrefsStore.getState().initialize();
      expect(usePrefsStore.getState().showSectionTitles).toBe(true);
    }
    // And with the key absent entirely — written straight to the bag, since the
    // repository has no delete and the web backend is a plain localStorage blob.
    localStorage.setItem('notes_app_prefs', 'theme=Dark');
    usePrefsStore.setState({ ready: false });
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().showSectionTitles).toBe(true);
  });

  it('is independent of which sections are visible', async () => {
    // `resetLayout` owns section visibility and order. It must not reach into
    // the title preference, and hiding a section must not hide the titles.
    usePrefsStore.getState().setShowSectionTitles(false);
    usePrefsStore.getState().resetLayout();
    expect(usePrefsStore.getState().showSectionTitles).toBe(false);
    expect(usePrefsStore.getState().layout).toEqual(DEFAULT_LAYOUT);
  });
});

describe('create button menu', () => {
  it('defaults to the mode that names every action', async () => {
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().fabVariant).toBe('iconLabel');
  });

  it('persists each mode and reads it back on the next launch', async () => {
    for (const variant of FAB_VARIANTS) {
      usePrefsStore.getState().setFabVariant(variant);
      expect(usePrefsStore.getState().fabVariant).toBe(variant);
    }
    // A second store instance must see what was written, not its own default.
    await new PrefsRepository().set('fab_variant', 'icon');
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().fabVariant).toBe('icon');
  });

  it('falls back to the labelled mode for an unknown or missing value', async () => {
    // The fallback is the only mode whose rows state what they do, so it is the
    // safe answer for a hand-edited or future value — and it must not be
    // whichever name happens to be listed first.
    await new PrefsRepository().set('fab_variant', 'hieroglyphs');
    await usePrefsStore.getState().initialize();
    expect(usePrefsStore.getState().fabVariant).toBe('iconLabel');
  });
});
