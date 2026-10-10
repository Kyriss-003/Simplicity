import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ACCENT_NAMES,
  THEME_NAMES,
  Typography,
  surfaceTheme,
  type AccentName,
  type Theme,
  type ThemeName,
} from '../../theme';
import type { DockPosition, DockVariant, FabVariant, LayoutOrder, LayoutPrefs } from '../../types';
import {
  DOCK_POSITIONS,
  DOCK_POSITION_LABELS,
  DOCK_VARIANTS,
  DOCK_VARIANT_LABELS,
  FAB_VARIANTS,
  FAB_VARIANT_LABELS,
} from '../../types';
import { AnimatedPressable } from '../shared/motion';
import { FabMenuPreview } from '../FloatingActionFab';
import { DockVariantPreview } from '../CapsuleSwitcher';
import { DraggableList } from '../shared/DraggableList';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { SettingsGroup, SelectRow, SettingsRow } from './SettingsRow';

const SECTION_COPY: Record<
  LayoutOrder[number],
  { label: string; description: string; iconName: keyof typeof MaterialCommunityIcons.glyphMap }
> = {
  notes: {
    label: 'Recent / Suggested Notes',
    description: 'A horizontal row of note preview cards.',
    iconName: 'note-multiple-outline',
  },
  calendar: {
    label: 'Calendar Preview',
    description: 'The hour timeline, with Today / Week / Month.',
    iconName: 'calendar-clock-outline',
  },
  tasks: {
    label: 'Tasks Preview',
    description: 'Checklist with an inline add-task row.',
    iconName: 'checkbox-marked-circle-outline',
  },
  scratchPad: {
    label: 'Scratch Pad',
    description: 'Quick note with the markdown toolbar.',
    iconName: 'pencil-outline',
  },
};

/** Preference: how the app looks, and what the dashboard is made of. */
export function PreferenceSection({
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
}: {
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
}) {
  const visibleCount = Object.values(layout).filter(Boolean).length;
  // The drag rows are drawn inside the group's card, not on the canvas, so they
  // take the surface ink. `SettingsRow` does this for itself; custom row content
  // a section writes has to do it explicitly or its labels go invisible on B&W.
  const ink = surfaceTheme(theme);

  return (
    <>
      <SettingsGroup theme={theme} title="Appearance">
        <SelectRow
          theme={theme}
          title="Theme"
          description="The canvas — how light or dark the app is."
          value={themeName}
          options={[...THEME_NAMES]}
          onSelect={(name) => onSelectTheme(name as ThemeName)}
        />
        <SelectRow
          theme={theme}
          title="Accent"
          description="The 10% layer — active tabs, the FAB, checkboxes, focus."
          value={accent}
          options={[...ACCENT_NAMES]}
          onSelect={(name) => onSelectAccent(name as AccentName)}
        />
      </SettingsGroup>

      <SettingsGroup theme={theme} title="Layout">
        <SelectRow
          theme={theme}
          title="Screen switcher"
          description="Where Overview, Notes and Agenda are switched — floating at the bottom, or as a bar at the top."
          value={DOCK_POSITION_LABELS[dockPosition]}
          options={DOCK_POSITIONS.map((position) => DOCK_POSITION_LABELS[position])}
          onSelect={(label) => {
            const match = DOCK_POSITIONS.find((p) => DOCK_POSITION_LABELS[p] === label);
            if (match) onSelectDockPosition(match);
          }}
        />
        <SelectRow
          theme={theme}
          title="Screen switcher tabs"
          description="Choose whether each tab shows an icon, a name, or both."
          value={DOCK_VARIANT_LABELS[dockVariant]}
          options={DOCK_VARIANTS.map((variant) => DOCK_VARIANT_LABELS[variant])}
          preview={<DockVariantPreview theme={theme} variant={dockVariant} />}
          onSelect={(label) => {
            const match = DOCK_VARIANTS.find((variant) => DOCK_VARIANT_LABELS[variant] === label);
            if (match) onSelectDockVariant(match);
          }}
        />
        {/* The create-menu preference is independent of the screen switcher. */}
        <SelectRow
          theme={theme}
          title="Create button menu"
          description="What each option shows — icons, words, or both."
          value={FAB_VARIANT_LABELS[fabVariant]}
          options={FAB_VARIANTS.map((variant) => FAB_VARIANT_LABELS[variant])}
          preview={<FabMenuPreview theme={theme} variant={fabVariant} />}
          onSelect={(label) => {
            const match = FAB_VARIANTS.find((v) => FAB_VARIANT_LABELS[v] === label);
            if (match) onSelectFabVariant(match);
          }}
          isLast
        />
      </SettingsGroup>

      <SettingsGroup
        theme={theme}
        title="Overview layout"
        meta={`${visibleCount}/${order.length} shown`}
      >
        <SettingsRow
          theme={theme}
          title="Section titles"
          description="Show the heading above each dashboard card."
          control={
            <ToggleSwitch
              theme={theme}
              value={showSectionTitles}
              onPress={() => onSetShowSectionTitles(!showSectionTitles)}
              accessibilityLabel="Section titles"
            />
          }
        />
        {/* Reordered by dragging the handle rather than by a pair of chevrons:
            two buttons per row is a lot of chrome for a one-in-four preference,
            and they can only express "one step" — dragging can express "put it
            there". The handle is also the only thing in the row that drags, so a
            vertical drag over the label or the description cannot be mistaken
            for a reorder. */}
        <DraggableList
          items={order}
          theme={theme}
          keyOf={(section) => section}
          onReorder={onReorderSection}
          rowStyle={(index) => [
            styles.dragRow,
            index < order.length - 1 && { borderBottomColor: ink.border, borderBottomWidth: 1 },
          ]}
          renderItem={(section, _index, handle) => {
            const copy = SECTION_COPY[section];
            // The row is a plain `View`, not a control. It used to be an
            // `AnimatedPressable` with `accessibilityRole="switch"`, so a tap
            // anywhere on 56px of row text toggled a section the user might have
            // been reading rather than aiming at — and the switch itself was
            // rendering `ToggleSwitch`'s static branch, a non-interactive view
            // that merely *looked* like a control. The switch is now the only
            // thing that toggles, which is also the only honest role for it.
            return (
              <View style={styles.row}>
                {handle}
                <MaterialCommunityIcons
                  name={copy.iconName}
                  size={16}
                  color={layout[section] ? theme.accent : ink.textMuted}
                />
                <View style={styles.rowText}>
                  <Text style={[styles.label, { color: ink.text }]}>{copy.label}</Text>
                  <Text
                    style={[styles.description, { color: ink.textMuted }]}
                    numberOfLines={1}
                  >
                    {copy.description}
                  </Text>
                </View>
                <ToggleSwitch
                  theme={theme}
                  value={layout[section]}
                  onPress={() => onToggleSection(section)}
                  accessibilityLabel={copy.label}
                />
              </View>
            );
          }}
        />

        <SettingsRow
          theme={theme}
          title="Restore defaults"
          description="Show every section, in the default order."
          tone="accent"
          onPress={onResetLayout}
          control={<MaterialCommunityIcons name="restore" size={16} color={theme.accent} />}
        />
      </SettingsGroup>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  rowText: { flex: 1, minWidth: 0 },
  label: { ...Typography.app.body },
  description: { ...Typography.app.caption, marginTop: 2 },
  /**
   * The measured, animated box around a draggable row.
   *
   * Separate from `row` because the layout belongs on the pressable *inside*:
   * the wrapper only has to be a box with a height to measure, carry the
   * hairline, and be the thing that lifts and casts a shadow. Putting the
   * layout here instead would leave the inner pressable unstyled and its
   * children stacking as plain blocks.
   */
  dragRow: { minHeight: 56 },
});
