import { Platform, Text, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Typography, type Theme } from '../../theme';
import type { Folder } from '../../types';
import { SettingsGroup, SettingsRow, ValueRow } from './SettingsRow';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * Accounts: who is using this, and where their data lives.
 *
 * With Supabase auth wired in, this section reflects the real session: the
 * signed-in user's email, whether sync is on, and a Sign out action. Local
 * SQLite remains the source of truth on device; the account is the identity
 * that gates which cloud rows belong to this user (per-user RLS).
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
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  return (
    <>
      <SettingsGroup theme={theme} title="Account">
        <ValueRow
          theme={theme}
          title="Signed in"
          description={
            user
              ? 'Your account syncs notes, folders and events to the cloud.'
              : 'No active session on this device.'
          }
          value={user?.email ?? 'Not signed in'}
        />
        <ValueRow
          theme={theme}
          title="Sync"
          description={
            user
              ? 'Local changes sync to your private cloud account.'
              : 'Sign in to sync across devices.'
          }
          value={user ? 'On' : 'Off'}
        />
        <ValueRow
          theme={theme}
          title="Storage"
          description={
            Platform.OS === 'web'
              ? 'Encrypted session stored securely on this device.'
              : 'A local SQLite file plus an encrypted session.'
          }
          value={Platform.OS === 'web' ? 'On this device' : 'On this device'}
        />
        {user ? (
          <SettingsRow
            theme={theme}
            title="Sign out"
            description="Sign out of this account on this device."
            tone="muted"
            onPress={() => void signOut()}
            isLast
            control={<MaterialCommunityIcons name="logout" size={16} color={theme.onSurfaceError} />}
          />
        ) : null}
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
          Your notes are encrypted in transit and at rest. Sync only happens when you are signed in
          to your account.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', gap: 12, paddingHorizontal: 4, paddingTop: 8 },
  noticeText: { ...Typography.app.caption, flex: 1, borderRadius: Radius.md },
});
