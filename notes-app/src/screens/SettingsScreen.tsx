import { useCallback, useImperativeHandle, useState, type Ref } from 'react';
import { ScrollView, Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import { Layout, Radius, Typography, type AccentName, type Theme, type ThemeName } from '../theme';
import type {
  DockPosition,
  DockVariant,
  FabVariant,
  Folder,
  LayoutOrder,
  LayoutPrefs,
  SettingsSection,
} from '../types';
import { SETTINGS_SECTIONS } from '../types';
import type { BehaviourKey } from '../store/usePrefsStore';
import { DashboardSection } from '../components/shared/motion';
import { AccountsSection } from '../components/settings/AccountsSection';
import { GeneralSection } from '../components/settings/GeneralSection';
import { HelpSection } from '../components/settings/HelpSection';
import { PreferenceSection } from '../components/settings/PreferenceSection';
import { SETTINGS_NAV, SettingsNav } from '../components/settings/SettingsNav';
import { ShortcutsSection } from '../components/settings/ShortcutsSection';
import { useHorizontalSwipe } from '../hooks/useHorizontalSwipe';

/**
 * Settings, in two shapes.
 *
 * Wide: a rail of sections beside the content. The section and its content are
 * both on screen, so switching is a glance rather than a navigation.
 *
 * Narrow: a **list of sections that navigates**. Tapping one opens it and the
 * header's back chevron returns to the list, so the screen is a real drill-down
 * — which is also what makes it workable by touch. Wide mode has no such level,
 * so there is nothing to go back *to* and the chevron leaves Settings entirely.
 */
export interface SettingsScreenHandle {
  /**
   * Pops one level of the narrow drill-down.
   * Returns `false` at the root, which is the shell's signal to leave Settings.
   */
  goBack: () => boolean;
}

export function SettingsScreen({
  ref,
  theme,
  themeName,
  onSelectTheme,
  accent,
  onSelectAccent,
  dockPosition,
  onSelectDockPosition,
  dockVariant,
  onSelectDockVariant,
  fabVariant,
  onSelectFabVariant,
  layout,
  order,
  onToggleSection,
  onReorderSection,
  onResetLayout,
  showSectionTitles,
  onSetShowSectionTitles,
  behaviour,
  onSetBehaviour,
  notes,
  folders,
  onExportData,
}: {
  /** React 19 passes `ref` as a plain prop, so it belongs in the type. */
  ref: Ref<SettingsScreenHandle>;
  theme: Theme;
  themeName: ThemeName;
  onSelectTheme: (name: ThemeName) => void;
  accent: AccentName;
  onSelectAccent: (name: AccentName) => void;
  dockPosition: DockPosition;
  onSelectDockPosition: (position: DockPosition) => void;
  dockVariant: DockVariant;
  onSelectDockVariant: (variant: DockVariant) => void;
  fabVariant: FabVariant;
  onSelectFabVariant: (variant: FabVariant) => void;
  layout: LayoutPrefs;
  order: LayoutOrder;
  onToggleSection: (section: LayoutOrder[number]) => void;
  onReorderSection: (from: number, to: number) => void;
  onResetLayout: () => void;
  /** Show the heading above each dashboard card. */
  showSectionTitles: boolean;
  onSetShowSectionTitles: (value: boolean) => void;
  behaviour: Record<BehaviourKey, boolean>;
  onSetBehaviour: (key: BehaviourKey, value: boolean) => void;
  notes: { id: number }[];
  folders: Folder[];
  onExportData: () => void;
}) {
  const [section, setSection] = useState<SettingsSection>('accounts');
  /**
   * Narrow layout only: are we showing the list of sections, or one of them?
   * Starts on the list, because a phone arriving in Settings wants to be asked
   * where it is going rather than dropped into whichever section was last read.
   */
  const [atMenu, setAtMenu] = useState(true);
  // The rail needs room; below the tablet breakpoint it becomes a list of links.
  const { width } = useWindowDimensions();
  const isNarrow = width < Layout.breakpoints.tablet;
  const meta = SETTINGS_NAV[section];

  const openSection = useCallback((next: SettingsSection) => {
    setSection(next);
    setAtMenu(false);
  }, []);

  /**
   * Swiping right at the *first* section goes back to the list rather than
   * nowhere, so the gesture has a consistent meaning across the whole drill-down
   * instead of doing nothing on one screen and navigating on the next.
   *
   * Deliberately not a `setSection` updater: calling `setAtMenu` from inside one
   * is a side effect during the update phase, and an updater is re-run whenever
   * React re-checks it. A fast double-swipe then leaves the two states out of
   * step and the screen renders neither the menu nor a section.
   */
  const goToSection = useCallback(
    (delta: number) => {
      const index = SETTINGS_SECTIONS.indexOf(section);
      const next = index + delta;
      if (next < 0) {
        setAtMenu(true);
        return;
      }
      const target = SETTINGS_SECTIONS[next];
      if (target) setSection(target);
    },
    [section]
  );

  const swipe = useHorizontalSwipe({
    enabled: isNarrow && !atMenu,
    onSwipeLeft: () => goToSection(1),
    onSwipeRight: () => goToSection(-1),
  });

  useImperativeHandle(ref, () => ({
    goBack: () => {
      // Wide layout has no drill-down level, so `false` tells the shell to leave.
      if (!isNarrow || atMenu) return false;
      setAtMenu(true);
      return true;
    },
  }));

  return (
    <View style={[styles.shell, isNarrow && styles.shellNarrow]}>
      {isNarrow && atMenu ? (
        <ScrollView
          style={styles.paneScroll}
          contentContainerStyle={styles.menuContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.paneHeader, styles.menuHeader]}>
            <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
          </View>
          <SettingsNav
            theme={theme}
            active={section}
            onSelect={openSection}
            isNarrow={isNarrow}
          />
        </ScrollView>
      ) : (
        <>
          {/* The rail belongs to the wide layout only. On a phone the list is
              the menu above, and the detail page shows just its own section —
              rendering the list here too stacks navigation on top of content. */}
          {isNarrow ? null : (
            <SettingsNav
              theme={theme}
              active={section}
              onSelect={setSection}
              isNarrow={isNarrow}
            />
          )}

          <View style={styles.pane} {...swipe.panHandlers}>
            {/* No rule under the section heading. It is a bare heading over
                grouped cards on the canvas; a hairline here was a divider
                drawn between two things the group's own lifted card already
                separates, and the depth rules put shadow — not outlines —
                between layers. */}
            <View style={styles.paneHeader}>
              <Text style={[styles.title, { color: theme.text }]}>{meta.title}</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>{meta.subtitle}</Text>
              {isNarrow ? (
                <View style={styles.dots} accessibilityElementsHidden>
                  {SETTINGS_SECTIONS.map((key) => (
                    <View
                      key={key}
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            key === section ? theme.accent : theme.border,
                          width: key === section ? 16 : 6,
                        },
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </View>

            <ScrollView
              style={styles.paneScroll}
              contentContainerStyle={styles.paneContent}
              showsVerticalScrollIndicator={false}
            >
              <DashboardSection>
                {section === 'accounts' ? (
                  <AccountsSection
                    theme={theme}
                    notes={notes}
                    folders={folders}
                    onExport={onExportData}
                  />
                ) : null}
                {section === 'general' ? (
                  <GeneralSection
                    theme={theme}
                    behaviour={behaviour}
                    onSetBehaviour={onSetBehaviour}
                />
              ) : null}
                {section === 'preference' ? (
                  <PreferenceSection
                    theme={theme}
                    themeName={themeName}
                    onSelectTheme={onSelectTheme}
                    accent={accent}
                    onSelectAccent={onSelectAccent}
                    dockPosition={dockPosition}
                    onSelectDockPosition={onSelectDockPosition}
                    dockVariant={dockVariant}
                    onSelectDockVariant={onSelectDockVariant}
                    fabVariant={fabVariant}
                    onSelectFabVariant={onSelectFabVariant}
                    layout={layout}
                    order={order}
                    onToggleSection={onToggleSection}
                    onReorderSection={onReorderSection}
                    onResetLayout={onResetLayout}
                    showSectionTitles={showSectionTitles}
                    onSetShowSectionTitles={onSetShowSectionTitles}
                  />
                ) : null}
                {section === 'shortcuts' ? <ShortcutsSection theme={theme} /> : null}
                {section === 'help' ? <HelpSection theme={theme} /> : null}
              </DashboardSection>
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}



/** The rail needs room; below the tablet breakpoint it becomes a chip row. */
const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row' },
  /**
   * Below the tablet breakpoint `SettingsNav` stops being a rail and becomes a
   * horizontal chip band, so the shell has to become a column with it.
   *
   * The shell used to be `row` unconditionally, which made the chip `ScrollView`
   * a *row* child: it sized itself to its full 436px of chips and the `flex: 1`
   * pane beside it was starved to nothing, pushing the whole section off-screen.
   * The narrow nav was written for a column parent and never got one.
   */
  shellNarrow: { flexDirection: 'column' },
  pane: { flex: 1, minWidth: 0 },
  paneHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 4,
  },
  title: { ...Typography.app.pageHeader },
  subtitle: { ...Typography.app.body },
  /** Narrow menu: the list scrolls under a plain title, with no rule under it. */
  menuContent: { paddingBottom: 32 },
  menuHeader: { paddingBottom: 8 },
  /**
   * Swipe affordance. There is no visible handle for a horizontal swipe, so
   * without this the gesture is undiscoverable on a touch screen — the dots
   * both say "there are more sections this way" and show where you are.
   */
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  dot: { height: 6, borderRadius: Radius.full },
  paneScroll: { flex: 1 },
  paneContent: { padding: 16, paddingBottom: 64, gap: 24, maxWidth: Layout.maxContentWidth },
});
