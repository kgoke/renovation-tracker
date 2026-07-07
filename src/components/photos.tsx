import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { PHOTO_KIND_LABELS, type PhotoKind, type RoomPhoto } from '@/lib/db/types';
import { Radius, Space, Type, useTheme } from './theme';
import { Chip } from './ui';

/**
 * Photo grid for a room, grouped by kind (before/after/progress), with a
 * full-screen viewer that supports changing the kind or deleting the photo.
 */
export function PhotoGrid({
  photos,
  onDelete,
  onChangeKind,
}: {
  photos: RoomPhoto[];
  onDelete: (photo: RoomPhoto) => void;
  onChangeKind: (photo: RoomPhoto, kind: PhotoKind) => void;
}) {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const [viewer, setViewer] = useState<RoomPhoto | null>(null);
  const cell = Math.floor((width - Space.lg * 2 - Space.sm * 2) / 3);

  const confirmDelete = (photo: RoomPhoto) => {
    Alert.alert('Delete photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setViewer(null);
          onDelete(photo);
        },
      },
    ]);
  };

  return (
    <View>
      <View style={styles.grid}>
        {photos.map((photo) => (
          <Pressable key={photo.id} onPress={() => setViewer(photo)}>
            <Image
              source={{ uri: photo.imageUri }}
              style={{ width: cell, height: cell, borderRadius: Radius.sm }}
              contentFit="cover"
            />
            <View style={styles.kindBadge}>
              <Chip
                label={PHOTO_KIND_LABELS[photo.kind]}
                tone={photo.kind === 'before' ? 'warning' : photo.kind === 'after' ? 'success' : 'neutral'}
              />
            </View>
          </Pressable>
        ))}
      </View>

      <Modal visible={viewer != null} animationType="fade" onRequestClose={() => setViewer(null)}>
        {viewer ? (
          <View style={[styles.viewer, { backgroundColor: '#000' }]}>
            <Image source={{ uri: viewer.imageUri }} style={{ flex: 1 }} contentFit="contain" />
            <View style={[styles.viewerBar, { backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', gap: Space.sm }}>
                {(Object.keys(PHOTO_KIND_LABELS) as PhotoKind[]).map((kind) => (
                  <Pressable
                    key={kind}
                    onPress={() => {
                      onChangeKind(viewer, kind);
                      setViewer({ ...viewer, kind });
                    }}
                    style={[
                      styles.kindButton,
                      {
                        backgroundColor: viewer.kind === kind ? colors.primary : colors.surfaceAlt,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        Type.label,
                        { color: viewer.kind === kind ? colors.onPrimary : colors.textSecondary },
                      ]}
                    >
                      {PHOTO_KIND_LABELS[kind]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: Space.lg, marginTop: Space.md }}>
                <Pressable onPress={() => confirmDelete(viewer)} hitSlop={8}>
                  <Text style={[Type.label, { color: colors.danger }]}>Delete</Text>
                </Pressable>
                <Pressable onPress={() => setViewer(null)} hitSlop={8}>
                  <Text style={[Type.label, { color: colors.primary }]}>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  kindBadge: { position: 'absolute', top: 6, left: 6 },
  viewer: { flex: 1 },
  viewerBar: { padding: Space.lg, alignItems: 'center' },
  kindButton: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radius.full,
  },
});
