import { Platform, Text, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Typography, type Theme } from '../../theme';
import type { Folder } from '../../types';
import { SettingsGroup, SettingsRow, ValueRow } from './SettingsRow';

/**
 * Accounts: who is using this, and where their data lives.
 *
 * There is no auth in this app — local SQLite is the only source of truth and
 * nothing is synced — so this section does not pretend to offer sign-in. It
 * states the two things that are actually true and load-bearing: your data never
 * leaves the device, and here is how to take a copy of it with you.
 */
export function AccountsSection({
  theme,
  notes,
  folders,
  onExport,
}: {
  theme: Theme;
  notes: { id: number }[];
  folders: Folder[];
  onExport: () => void;
}) {
  return (
    <>
      <SettingsGroup theme={theme} title="Account">
        <ValueRow
          theme={theme}
          title="Signed in"
          description="This build has no account system — nothing to sign into."
          value="Not signed in"
        />
        <ValueRow
          theme={theme}
          title="Sync"
          description="Notes are stored on this device only and are never uploaded."
          value="Off"
        />
        <ValueRow
          theme={theme}
          title="Storage"
          description={
            Platform.OS === 'web'
              ? 'Browser storage, scoped to this site.'
              : 'A local SQLite file in the app container.'
          }
          value={Platform.OS === 'web' ? 'On this device' : 'On this device'}
          isLast
        />
      </SettingsGroup>

      <SettingsGroup theme={theme} title="Your data">
        <ValueRow
          theme={theme}
          title="Notes"
          description="In the currently selected folder."
          value={String(notes.length)}
        />
        <ValueRow
          theme={theme}
          title="Folders"
          description="Including the root folder."
          value={String(folders.length)}
        />
        <SettingsRow
          theme={theme}
          title="Export everything"
          description="Copies every note and folder as JSON to the clipboard."
          tone="accent"
          onPress={onExport}
          isLast
          control={<MaterialCommunityIcons name="content-copy" size={16} color={theme.accent} />}
        />
      </SettingsGroup>

      <View style={styles.notice}>
        <MaterialCommunityIcons name="shield-check-outline" size={16} color={theme.textMuted} />
        <Text style={[styles.noticeText, { color: theme.textMuted }]}>
          Nothing you write here is sent anywhere. There is no server, no analytics and no
          telemetry — the app works entirely offline.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', gap: 12, paddingHorizontal: 4, paddingTop: 8 },
  noticeText: { ...Typography.app.caption, flex: 1, borderRadius: Radius.md },
});
