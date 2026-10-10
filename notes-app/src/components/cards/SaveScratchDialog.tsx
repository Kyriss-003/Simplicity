import { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Typography, surfaceTheme, type Theme } from '../../theme';
import type { Folder, FolderNode } from '../../types';

interface FlatRow {
  node: FolderNode;
  depth: number;
}

function flatten(nodes: FolderNode[], depth: number, out: FlatRow[]): FlatRow[] {
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children?.length) flatten(node.children, depth + 1, out);
  }
  return out;
}

/**
 * Where a scratch pad becomes a note.
 *
 * It is its own dialog rather than a reuse of `MoveToModal` because the words
 * are the whole point: that modal says "Move", which is wrong for something that
 * does not exist yet, and its confirm button reads "Move here". A user who has
 * just been asked to save something new should not be told they are moving
 * something old.
 *
 * The list is the folder tree flattened, indented — the same shape the sidebar
 * already uses for the same hierarchy, so a folder looks the same everywhere it
 * appears.
 */
export function SaveScratchDialog({
  theme,
  visible,
  folders,
  tree,
  defaultFolderId,
  preview,
  onConfirm,
  onDismiss,
}: {
  theme: Theme;
  visible: boolean;
  /** Flat folder list, used to resolve the default selection's label. */
  folders: Folder[];
  tree: FolderNode[];
  /** Pre-selected — the folder currently in scope in the sidebar. */
  defaultFolderId: string | null;
  /** The first lines of what is about to be saved, so the effect is visible. */
  preview: string;
  onConfirm: (folderId: string) => void;
  onDismiss: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => flatten(tree, 0, []), [tree]);

  // Seed on open: the folder in scope, else the first one. Opening with nothing
  // selected makes the confirm button look inert.
  useEffect(() => {
    if (!visible) return;
    setSelectedId(defaultFolderId ?? tree[0]?.id ?? null);
  }, [visible, defaultFolderId, tree]);

  const selectedLabel =
    folders.find((f) => f.id === selectedId)?.label ?? 'this folder';

  // The whole modal body is a surface.
  const ink = surfaceTheme(theme);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: ink.border,
              boxShadow: [{ offsetX: 0, offsetY: 16, blurRadius: 40, color: theme.shadow }],
            },
          ]}
        >
          <Text style={[styles.heading, { color: ink.text }]}>Save as a note</Text>
          <Text style={[styles.preview, { color: ink.textMuted }]} numberOfLines={2}>
            {preview}
          </Text>

          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {rows.map(({ node, depth }) => {
              const selected = selectedId === node.id;
              return (
                <Pressable
                  key={node.id}
                  onPress={() => setSelectedId(node.id)}
                  style={[
                    styles.row,
                    {
                      backgroundColor: selected ? theme.pillBg : 'transparent',
                      paddingLeft: 12 + depth * 16,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={node.label}
                >
                  <MaterialCommunityIcons
                    name={node.iconName ?? 'folder-outline'}
                    size={16}
                    color={selected ? theme.accent : ink.textMuted}
                  />
                  <Text
                    style={[
                      selected ? Typography.app.bodyStrong : Typography.app.body,
                      { color: selected ? ink.text : ink.textMuted, flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {node.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={onDismiss}
              style={[styles.action, { borderColor: ink.border }]}
              accessibilityRole="button"
            >
              <Text style={[styles.actionText, { color: ink.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => selectedId && onConfirm(selectedId)}
              disabled={!selectedId}
              style={[
                styles.action,
                { backgroundColor: theme.accent, opacity: selectedId ? 1 : 0.4 },
              ]}
              accessibilityRole="button"
              // The label names the destination, so the effect is stated rather
              // than implied by a generic "Save".
              accessibilityLabel={`Save into ${selectedLabel}`}
            >
              <Text style={[styles.actionText, { color: theme.accentText }]}>
                {`Save to ${selectedLabel}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.modal,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  heading: { ...Typography.app.cardHeader },
  preview: { ...Typography.app.caption },
  list: { maxHeight: 280 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 48,
    paddingRight: 12,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: 8 },
  action: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  actionText: { ...Typography.app.bodyStrong },
});
