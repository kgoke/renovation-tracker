import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { SelectField, TextField } from '@/components/forms';
import { Button, Loading, Screen } from '@/components/ui';
import { getRoom, insertRoom, updateRoom, type RoomInput } from '@/lib/db/repo';
import { ROOM_TYPE_LABELS, labelValues, type RoomType } from '@/lib/db/types';

export default function RoomFormScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ propertyId?: string; roomId?: string }>();
  const editId = params.roomId ? Number(params.roomId) : null;

  const [form, setForm] = useState<RoomInput | null>(
    editId
      ? null
      : {
          propertyId: Number(params.propertyId ?? 0),
          name: '',
          roomType: 'other',
          notes: '',
        }
  );

  useEffect(() => {
    if (!editId) return;
    getRoom(db, editId).then((r) => {
      if (!r) return;
      const { id, createdAt, ...rest } = r;
      setForm(rest);
    });
  }, [db, editId]);

  if (!form) return <Loading />;

  const set = <K extends keyof RoomInput>(key: K, value: RoomInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Give the room or area a name, e.g. "Primary bathroom".');
      return;
    }
    if (!form.propertyId) {
      Alert.alert('Missing property', 'This room is not linked to a property.');
      return;
    }
    if (editId) await updateRoom(db, editId, { ...form, name: form.name.trim() });
    else await insertRoom(db, { ...form, name: form.name.trim() });
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: editId ? 'Edit room' : 'New room' }} />
      <TextField label="Name" value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Primary bathroom" />
      <SelectField
        label="Type"
        value={form.roomType}
        options={labelValues<RoomType>(ROOM_TYPE_LABELS)}
        onChange={(v) => v && set('roomType', v)}
      />
      <TextField label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} multiline />
      <Button label={editId ? 'Save changes' : 'Add room'} onPress={save} />
    </Screen>
  );
}
