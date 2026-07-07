import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { DateField, MoneyField, SelectField, TextField } from '@/components/forms';
import { Space } from '@/components/theme';
import { Button, Loading, Screen } from '@/components/ui';
import { deleteCost, getCost, insertCost, updateCost, type CostInput } from '@/lib/db/repo';
import {
  COST_CATEGORY_LABELS,
  COST_RECURRENCE_LABELS,
  labelValues,
  type CostCategory,
  type CostRecurrence,
} from '@/lib/db/types';
import { todayIso } from '@/lib/dates';

export default function CostFormScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ propertyId?: string; costId?: string }>();
  const editId = params.costId ? Number(params.costId) : null;

  const [form, setForm] = useState<CostInput | null>(
    editId
      ? null
      : {
          propertyId: Number(params.propertyId ?? 0),
          category: 'loan_payment',
          description: '',
          amountCents: 0,
          costDate: todayIso(),
          recurrence: 'one_time',
          notes: '',
        }
  );

  useEffect(() => {
    if (!editId) return;
    getCost(db, editId).then((c) => {
      if (!c) return;
      const { id, createdAt, ...rest } = c;
      setForm(rest);
    });
  }, [db, editId]);

  if (!form) return <Loading />;

  const set = <K extends keyof CostInput>(key: K, value: CostInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form.propertyId) {
      Alert.alert('Missing property', 'This cost is not linked to a property.');
      return;
    }
    if (form.amountCents <= 0) {
      Alert.alert('Amount required', 'Enter the cost amount.');
      return;
    }
    if (editId) await updateCost(db, editId, form);
    else await insertCost(db, form);
    router.back();
  };

  const confirmDelete = () => {
    if (!editId) return;
    Alert.alert('Delete cost entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteCost(db, editId);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: editId ? 'Edit cost' : 'New cost' }} />

      <SelectField
        label="Category"
        value={form.category}
        options={labelValues<CostCategory>(COST_CATEGORY_LABELS)}
        onChange={(v) => v && set('category', v)}
      />
      <TextField
        label="Description"
        value={form.description}
        onChangeText={(v) => set('description', v)}
        placeholder="e.g. Q3 property tax payment"
      />
      <MoneyField label="Amount" cents={form.amountCents} onChangeCents={(v) => set('amountCents', v)} />
      <DateField label="Date" value={form.costDate} onChange={(v) => set('costDate', v)} />
      <SelectField
        label="Recurrence"
        value={form.recurrence}
        options={labelValues<CostRecurrence>(COST_RECURRENCE_LABELS)}
        onChange={(v) => v && set('recurrence', v)}
      />
      <TextField label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} multiline />

      <Button label={editId ? 'Save changes' : 'Add cost'} onPress={save} />
      {editId ? (
        <View style={{ marginTop: Space.md }}>
          <Button label="Delete cost" variant="danger" onPress={confirmDelete} />
        </View>
      ) : null}
    </Screen>
  );
}
