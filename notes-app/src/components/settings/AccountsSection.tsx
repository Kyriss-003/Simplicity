import { Platform, Text, TextInput, View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '../shared/icons';
import { Radius, Typography, type Theme } from '../../theme';
import type { Folder } from '../../types';
import { SettingsGroup, SettingsRow, ValueRow } from './SettingsRow';
import { useAuthStore } from '../../store/useAuthStore';
import { usePrefsStore } from '../../store/usePrefsStore';

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
  const displayName = usePrefsStore((s) => s.displayName);
  const setDisplayName = usePrefsStore((s) => s.setDisplayName);
  return (
    <>
      <SettingsGroup theme={theme} title="Account">
        <ValueRow
          theme={theme}
          title="Name"
          description={
            displayName
              ? 'Overrides the account name in the greeting.'
              : 'Set a name to show in the greeting.'
          }
          value={displayName || user?.user_metadata?.full_name || 'Not set'}
        />
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={user?.user_metadata?.full_name || 'Your name'}
          placeholderTextColor={theme.textMuted}
          style={[styles.nameInput, { backgroundColor: theme.surfaceRaised, color: theme.text, borderColor: theme.onSurfaceBorder }]}
          returnKeyType="done"
          accessibilityLabel="Display name"
          clearButtonMode="never"
        />
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
  nameInput: {
    ...Typography.app.body,
    height: 40,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  notice: { flexDirection: 'row', gap: 12, paddingHorizontal: 4, paddingTop: 8 },
  noticeText: { ...Typography.app.caption, flex: 1, borderRadius: Radius.md },
});
