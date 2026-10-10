import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';

/**
 * Lightweight confirmation dialog for destructive actions.
 * Same form factor as MoveToModal (maxWidth 540, borderRadius 16).
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  theme,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  theme: Theme;
}) {
  // The dialog card is a surface; the destructive button is a *fill* on top of
  // it, so that one keeps the canvas `error` / `errorText` pair.
  const ink = surfaceTheme(theme);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View
          style={[styles.card, { backgroundColor: theme.surfaceRaised, borderColor: ink.border }]}
        >
          <Text style={[styles.title, { color: ink.text }]}>{title}</Text>
          <Text style={[styles.message, { color: ink.textMuted }]}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={[styles.ghostBtn, { borderColor: ink.border }]}
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.btnLabel, { color: ink.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={[styles.destructiveBtn, { backgroundColor: theme.error }]}
              accessibilityLabel={confirmLabel}
            >
              <Text style={[styles.btnLabel, { color: theme.errorText }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 540,
    borderRadius: Radius.modal,
    borderWidth: 1,
    padding: 24,
    gap: 16,
    boxShadow: [{ offsetX: 0, offsetY: 16, blurRadius: 40, color: 'rgba(0,0,0,0.4)' }],
    elevation: 16,
  },
  title: { ...Typography.app.cardHeader },
  message: { ...Typography.app.body },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  ghostBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  destructiveBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
  },
  btnLabel: { ...Typography.app.bodyStrong },
});
