import { Text, View, StyleSheet } from 'react-native';
import { Typography, type Theme } from '../../theme';
import type { BehaviourKey } from '../../store/usePrefsStore';
import { SettingsGroup, SettingsRow } from './SettingsRow';
import { ToggleSwitch } from '../shared/ToggleSwitch';

interface BehaviourSpec {
  key: BehaviourKey;
  label: string;
  description: string;
}

/** Only behaviours the app genuinely implements. */
const BEHAVIOURS: BehaviourSpec[] = [
  {
    key: 'confirmDelete',
    label: 'Confirm before deleting',
    description: 'Ask before a note is deleted. With this off, a delete is immediate.',
  },
  {
    key: 'openNewNote',
    label: 'Open new notes straight away',
    description: 'Jump into the editor when a note is created, instead of leaving you where you were.',
  },
];

/** General: how the app behaves, as opposed to how it looks. */
export function GeneralSection({
  theme,
  behaviour,
  onSetBehaviour,
}: {
  theme: Theme;
  behaviour: Record<BehaviourKey, boolean>;
  onSetBehaviour: (key: BehaviourKey, value: boolean) => void;
}) {
  return (
    <>
      <SettingsGroup theme={theme} title="Behaviour">
        {BEHAVIOURS.map((spec, index) => (
          <SettingsRow
            key={spec.key}
            theme={theme}
            title={spec.label}
            description={spec.description}
            isLast={index === BEHAVIOURS.length - 1}
            onPress={() => onSetBehaviour(spec.key, !behaviour[spec.key])}
            accessibilityLabel={spec.label}
            control={
              <ToggleSwitch
                theme={theme}
                value={behaviour[spec.key]}
                accessibilityLabel={spec.label}
              />
            }
          />
        ))}
      </SettingsGroup>

      <View style={styles.note}>
        <Text style={[styles.noteText, { color: theme.textMuted }]}>
          Both of these are stored on this device and apply immediately.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: 4 },
  noteText: { ...Typography.app.caption },
});
