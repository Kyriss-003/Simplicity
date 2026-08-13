import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '../shared/Card';
import type { Theme } from '../../theme';
import type { Note } from '../../db/NoteRepository';
import { previewLines, relativeTime } from '../shared/utils';

/**
 * Horizontal scrolling row of note cards for the Overview dashboard.
 * Each card binds to a real `Note` from the store and calls `onOpenNote`.
 */
export function NotesCardRow({
  notes,
  theme,
  onOpenNote,
}: {
  notes: Note[];
  theme: Theme;
  onOpenNote: (n: Note) => void;
}) {
  if (notes.length === 0) {
    return (
      <Card theme={theme} style={{ paddingVertical: 18, paddingHorizontal: 16 }}>
        <View
          style={[
            styles.emptyNoteCard,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <MaterialCommunityIcons
            name="note-plus-outline"
            size={22}
            color={theme.textMuted}
          />
          <Text
            style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8 }}
          >
            No notes yet. Tap &quot;+ New Note&quot;.
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingBottom: 2 }}
    >
      {notes.map((item) => {
        const tagLabel = item.tags[0] ?? 'Notebook';
        const previews = item.content?.trim() ? previewLines(item.content) : [];
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => onOpenNote(item)}
            activeOpacity={0.8}
          >
            <Card theme={theme} style={styles.noteCard}>
              {/* tag row — fixed flex row prevents overlap */}
              <View style={styles.noteTagRow}>
                <View style={styles.noteTagLeft}>
                  <View style={[styles.noteIconBox, { backgroundColor: theme.pillBg }]}>
                    <MaterialCommunityIcons
                      name="file-document-outline"
                      size={11}
                      color={theme.textMuted}
                    />
                  </View>
                  <Text
                    style={[styles.tagLabel, { color: theme.textMuted }]}
                    numberOfLines={1}
                  >
                    {tagLabel}
                  </Text>
                </View>
                <Text style={[styles.tagTime, { color: theme.textMuted }]}>
                  {relativeTime(item.updatedAt)}
                </Text>
              </View>

              <Text style={[styles.noteTitle, { color: theme.text }]} numberOfLines={2}>
                {item.title}
              </Text>

              {previews.length > 0 ? (
                previews.map((p, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={[styles.bullet, { color: theme.textMuted }]}>•</Text>
                    <Text
                      style={[styles.bulletText, { color: theme.textMuted }]}
                      numberOfLines={1}
                    >
                      {p}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.bulletText, { color: theme.textMuted }]}>
                  Empty note
                </Text>
              )}
            </Card>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  noteCard: { width: 220, minHeight: 148 },
  emptyNoteCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
    gap: 4,
  },
  noteTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  noteTagLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  noteIconBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tagLabel: { fontSize: 11, fontWeight: '600' },
  tagTime: { fontSize: 11, flexShrink: 0 },
  noteTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  bulletRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 1.5,
    alignItems: 'flex-start',
  },
  bullet: { fontSize: 11, marginTop: 1, flexShrink: 0 },
  bulletText: { fontSize: 11, flex: 1, minWidth: 0, lineHeight: 14 },
});
