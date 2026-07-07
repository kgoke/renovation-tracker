import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { DateField, MoneyField, SelectField, TextField } from '@/components/forms';
import { Space } from '@/components/theme';
import { Button, Loading, Screen } from '@/components/ui';
import {
  deleteExpense,
  getExpense,
  insertExpense,
  listProjects,
  listProperties,
  listRooms,
  updateExpense,
  type ExpenseInput,
} from '@/lib/db/repo';
import {
  EXPENSE_CATEGORY_LABELS,
  labelValues,
  type ExpenseCategory,
  type Project,
  type Property,
  type RoomArea,
} from '@/lib/db/types';
import { todayIso } from '@/lib/dates';

export default function ExpenseFormScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{
    propertyId?: string;
    projectId?: string;
    roomId?: string;
    expenseId?: string;
  }>();
  const editId = params.expenseId ? Number(params.expenseId) : null;

  const [form, setForm] = useState<ExpenseInput | null>(
    editId
      ? null
      : {
          propertyId: Number(params.propertyId ?? 0),
          projectId: params.projectId ? Number(params.projectId) : null,
          roomId: params.roomId ? Number(params.roomId) : null,
          receiptId: null,
          description: '',
          category: 'materials',
          vendor: '',
          amountCents: 0,
          expenseDate: todayIso(),
          notes: '',
        }
  );
  const [properties, setProperties] = useState<Property[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rooms, setRooms] = useState<RoomArea[]>([]);

  useEffect(() => {
    listProperties(db).then(setProperties);
    if (editId) {
      getExpense(db, editId).then((e) => {
        if (!e) return;
        const { id, createdAt, ...rest } = e;
        setForm(rest);
      });
    }
  }, [db, editId]);

  const propertyId = form?.propertyId ?? 0;
  useEffect(() => {
    if (!propertyId) {
      setProjects([]);
      setRooms([]);
      return;
    }
    listProjects(db, propertyId).then(setProjects);
    listRooms(db, propertyId).then(setRooms);
  }, [db, propertyId]);

  if (!form) return <Loading />;

  const set = <K extends keyof ExpenseInput>(key: K, value: ExpenseInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form.propertyId) {
      Alert.alert('Property required', 'Choose which property this expense belongs to.');
      return;
    }
    if (!form.description.trim()) {
      Alert.alert('Description required', 'Describe the expense, e.g. "Tile for shower walls".');
      return;
    }
    const payload = { ...form, description: form.description.trim() };
    if (editId) await updateExpense(db, editId, payload);
    else await insertExpense(db, payload);
    router.back();
  };

  const confirmDelete = () => {
    if (!editId) return;
    Alert.alert('Delete expense?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(db, editId);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: editId ? 'Edit expense' : 'New expense' }} />

      <SelectField
        label="Property"
        value={form.propertyId || null}
        options={properties.map((p) => ({ value: p.id, label: p.name }))}
        onChange={(v) => {
          set('propertyId', v ?? 0);
          set('projectId', null);
          set('roomId', null);
        }}
      />
      <SelectField
        label="Project (optional)"
        value={form.projectId}
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
        onChange={(v) => set('projectId', v)}
        allowClear
        placeholder="No project"
      />
      <SelectField
        label="Room (optional)"
        value={form.roomId}
        options={rooms.map((r) => ({ value: r.id, label: r.name }))}
        onChange={(v) => set('roomId', v)}
        allowClear
        placeholder="No room"
      />

      <TextField label="Description" value={form.description} onChangeText={(v) => set('description', v)} placeholder="e.g. Tile for shower walls" />
      <MoneyField label="Amount" cents={form.amountCents} onChangeCents={(v) => set('amountCents', v)} />
      <SelectField
        label="Category"
        value={form.category}
        options={labelValues<ExpenseCategory>(EXPENSE_CATEGORY_LABELS)}
        onChange={(v) => v && set('category', v)}
      />
      <TextField label="Vendor" value={form.vendor} onChangeText={(v) => set('vendor', v)} placeholder="e.g. Home Depot" />
      <DateField label="Date" value={form.expenseDate} onChange={(v) => set('expenseDate', v)} />
      <TextField label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} multiline />

      <Button label={editId ? 'Save changes' : 'Add expense'} onPress={save} />
      {editId ? (
        <View style={{ marginTop: Space.md }}>
          <Button label="Delete expense" variant="danger" onPress={confirmDelete} />
        </View>
      ) : null}
    </Screen>
  );
}
