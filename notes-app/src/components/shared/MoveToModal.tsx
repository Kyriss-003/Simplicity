import { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Theme } from '../../theme';
import type { FolderNode } from '../../hooks/useFolderTree';

/** Flattened row for rendering the hierarchy. */
interface FlatRow {
  node: FolderNode;
  depth: number;
}

/** Flatten a tree, excluding the subtree rooted at `excludeId`. */
function flatten(nodes: FolderNode[], depth: number, excludeId: string, out: FlatRow[]): FlatRow[] {
  for (const node of nodes) {
    if (node.id === excludeId) continue;
    out.push({ node, depth });
    if (node.children?.length) flatten(node.children, depth + 1, excludeId, out);
  }
  return out;
}

/**
 * "Move folder to…" picker modal. Displays the full folder hierarchy
 * (excluding the moving subtree) and confirms a destination.
 * Form factor: maxWidth 540, maxHeight 680, borderRadius 16 (AGENTS.md).
 */
export function MoveToModal({
  visible,
  folders,
  excludeId,
  folderLabel,
  onConfirm,
  onClose,
  theme,
}: {
  visible: boolean;
  folders: FolderNode[];
  excludeId: string | null;
  folderLabel: string | null;
  onConfirm: (targetParentId: string) => void;
  onClose: () => void;
  theme: Theme;
}) {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(
    () => (excludeId ? flatten(folders, 0, excludeId, []) : []),
    [folders, excludeId]
  );

  // Reset selection each time the modal opens.
  useEffect(() => {
    if (visible) setSelectedId(null);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.card,
            // Responsive form factor: fluid 90% width / 80% height,
            // clamped to the iPad-mini form factor (540×680) on wide screens.
            {
              width: Math.min(winWidth * 0.9, 540),
              height: Math.min(winHeight * 0.8, 680),
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Header */}
          <Text style={[styles.title, { color: theme.text }]}>
            Move “{folderLabel ?? 'folder'}” to…
          </Text>

          {/* Folder tree */}
          <ScrollView style={styles.tree} contentContainerStyle={{ gap: 4, paddingBottom: 8 }}>
            {rows.map(({ node, depth }) => {
              const selected = selectedId === node.id;
              return (
                <Pressable
                  key={node.id}
                  onPress={() => setSelectedId(node.id)}
                  style={({ pressed }) => [
                    styles.row,
                    { paddingLeft: 16 + depth * 16 },
                    (selected || pressed) && { backgroundColor: theme.pillBg },
                  ]}
                  accessibilityLabel={`Move to ${node.label}`}
                >
                  <MaterialCommunityIcons
                    name={node.iconName ?? 'folder-outline'}
                    size={16}
                    color={selected ? theme.accent : theme.textMuted}
                  />
                  <Text
                    style={{
                      color: selected ? theme.text : theme.textMuted,
                      fontSize: 14,
                      fontWeight: selected ? '600' : '400',
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {node.label}
                  </Text>
                  {selected ? (
                    <MaterialCommunityIcons name="check" size={16} color={theme.accent} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={[styles.ghostBtn, { borderColor: theme.border }]}
              accessibilityLabel="Cancel move"
            >
              <Text style={[styles.btnLabel, { color: theme.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => selectedId && onConfirm(selectedId)}
              disabled={!selectedId}
              style={[
                styles.primaryBtn,
                { backgroundColor: selectedId ? theme.accent : theme.pillBg },
              ]}
              accessibilityLabel="Confirm move"
            >
              <Text
                style={[
                  styles.btnLabel,
                  { color: selectedId ? theme.accentText : theme.textMuted },
                ]}
              >
                Move Here
              </Text>
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
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 16,
    overflow: 'hidden',
    boxShadow: [{ offsetX: 0, offsetY: 16, blurRadius: 40, color: 'rgba(0,0,0,0.4)' }],
    elevation: 16,
  },
  title: { fontSize: 18, fontWeight: '600' },
  tree: { flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    gap: 12,
    paddingRight: 12,
    borderRadius: 8,
  },
  actions: { flexDirection: 'row', gap: 12 },
  ghostBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  primaryBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  btnLabel: { fontSize: 14, fontWeight: '600' },
});
