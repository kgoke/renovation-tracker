import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { SelectField } from '@/components/forms';
import { PhotoGrid } from '@/components/photos';
import { Space, Type, useTheme } from '@/components/theme';
import { Button, Card, Chip, EmptyState, ListRow, Loading, Screen, SectionHeader } from '@/components/ui';
import {
  deletePhoto,
  deleteRoom,
  getRoom,
  insertPhoto,
  listExpensesForRoom,
  listPhotosForRoom,
  updatePhoto,
} from '@/lib/db/repo';
import {
  EXPENSE_CATEGORY_LABELS,
  PHOTO_KIND_LABELS,
  ROOM_TYPE_LABELS,
  labelValues,
  type PhotoKind,
} from '@/lib/db/types';
import { formatIso } from '@/lib/dates';
import { captureImage, deleteImage, persistImage, pickImage } from '@/lib/images';
import { formatCents } from '@/lib/money';
import { useFocusQuery } from '@/lib/useFocusQuery';

export default function RoomDetailScreen() {
  const colors = useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id: string }>();
  const roomId = Number(params.id);
  const [photoKind, setPhotoKind] = useState<PhotoKind>('before');

  const { data, loading, refresh } = useFocusQuery(
    async (d) => {
      const room = await getRoom(d, roomId);
      if (!room) return { room: null, photos: [], expenses: [] };
      const [photos, expenses] = await Promise.all([
        listPhotosForRoom(d, roomId),
        listExpensesForRoom(d, roomId),
      ]);
      return { room, photos, expenses };
    },
    [roomId]
  );

  if (loading || !data) return <Loading />;
  const { room, photos, expenses } = data;
  if (!room) {
    return (
      <Screen>
        <EmptyState title="Room not found" />
      </Screen>
    );
  }

  const spent = expenses.reduce((sum, e) => sum + e.amountCents, 0);

  const addPhoto = async (source: 'camera' | 'library') => {
    const picked = source === 'camera' ? await captureImage() : await pickImage();
    if (!picked) return;
    const stored = await persistImage(picked.uri);
    await insertPhoto(db, {
      roomId,
      propertyId: room.propertyId,
      imageUri: stored,
      kind: photoKind,
      caption: '',
    });
    refresh();
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete room?',
      'Photos are removed; expenses stay on the property but lose their room link.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            for (const photo of photos) deleteImage(photo.imageUri);
            await deleteRoom(db, roomId);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: room.name }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space.md }}>
        <Chip label={ROOM_TYPE_LABELS[room.roomType]} tone="primary" />
        <Chip label={`${formatCents(spent, { compact: true })} spent`} />
      </View>
      {room.notes ? (
        <Text style={[Type.body, { color: colors.textSecondary, marginBottom: Space.md }]}>{room.notes}</Text>
      ) : null}

      <SectionHeader
        title={`Photos (${photos.length})`}
        action="Edit room"
        onAction={() => router.push({ pathname: '/room/new', params: { roomId: String(roomId) } })}
      />
      <Card>
        <SelectField
          label="Add as"
          value={photoKind}
          options={labelValues<PhotoKind>(PHOTO_KIND_LABELS)}
          onChange={(v) => v && setPhotoKind(v)}
        />
        <View style={{ flexDirection: 'row', gap: Space.md }}>
          <View style={{ flex: 1 }}>
            <Button label="Take photo" variant="secondary" onPress={() => addPhoto('camera')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Choose photo" variant="secondary" onPress={() => addPhoto('library')} />
          </View>
        </View>
        {photos.length > 0 ? (
          <View style={{ marginTop: Space.lg }}>
            <PhotoGrid
              photos={photos}
              onDelete={async (photo) => {
                deleteImage(photo.imageUri);
                await deletePhoto(db, photo.id);
                refresh();
              }}
              onChangeKind={async (photo, kind) => {
                await updatePhoto(db, photo.id, { kind, caption: photo.caption });
                refresh();
              }}
            />
          </View>
        ) : (
          <Text style={[Type.caption, { color: colors.textMuted, marginTop: Space.md }]}>
            Capture “before” shots now — future you will want them for the listing.
          </Text>
        )}
      </Card>

      <SectionHeader
        title={`Expenses (${expenses.length})`}
        action="+ Add"
        onAction={() =>
          router.push({
            pathname: '/expense/new',
            params: { propertyId: String(room.propertyId), roomId: String(roomId) },
          })
        }
      />
      {expenses.length === 0 ? (
        <EmptyState title="No expenses for this room yet" />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {expenses.map((e) => (
            <ListRow
              key={e.id}
              title={e.description}
              subtitle={`${EXPENSE_CATEGORY_LABELS[e.category]}${e.expenseDate ? ` · ${formatIso(e.expenseDate)}` : ''}`}
              right={formatCents(e.amountCents)}
              onPress={() => router.push({ pathname: '/expense/new', params: { expenseId: String(e.id) } })}
            />
          ))}
        </Card>
      )}

      <View style={{ marginTop: Space.xl }}>
        <Button label="Delete room" variant="danger" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}
