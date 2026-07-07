import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { DateField, FormRow, MoneyField, SelectField, TextField } from '@/components/forms';
import { Button, Loading, Screen } from '@/components/ui';
import { getProject, insertProject, updateProject, type ProjectInput } from '@/lib/db/repo';
import { PROJECT_STATUS_LABELS, labelValues, type ProjectStatus } from '@/lib/db/types';

export default function ProjectFormScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ propertyId?: string; projectId?: string }>();
  const editId = params.projectId ? Number(params.projectId) : null;

  const [form, setForm] = useState<ProjectInput | null>(
    editId
      ? null
      : {
          propertyId: Number(params.propertyId ?? 0),
          name: '',
          description: '',
          status: 'planned',
          budgetCents: 0,
          startDate: '',
          endDate: '',
        }
  );

  useEffect(() => {
    if (!editId) return;
    getProject(db, editId).then((p) => {
      if (!p) return;
      const { id, createdAt, ...rest } = p;
      setForm(rest);
    });
  }, [db, editId]);

  if (!form) return <Loading />;

  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Give the project a name, e.g. "Kitchen remodel".');
      return;
    }
    if (!form.propertyId) {
      Alert.alert('Missing property', 'This project is not linked to a property.');
      return;
    }
    if (editId) await updateProject(db, editId, { ...form, name: form.name.trim() });
    else await insertProject(db, { ...form, name: form.name.trim() });
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: editId ? 'Edit project' : 'New project' }} />
      <TextField label="Name" value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Kitchen remodel" />
      <TextField label="Description" value={form.description} onChangeText={(v) => set('description', v)} multiline />
      <SelectField
        label="Status"
        value={form.status}
        options={labelValues<ProjectStatus>(PROJECT_STATUS_LABELS)}
        onChange={(v) => v && set('status', v)}
      />
      <MoneyField label="Budget" cents={form.budgetCents} onChangeCents={(v) => set('budgetCents', v)} />
      <FormRow>
        <DateField label="Start date" value={form.startDate} onChange={(v) => set('startDate', v)} />
        <DateField label="End date" value={form.endDate} onChange={(v) => set('endDate', v)} />
      </FormRow>
      <Button label={editId ? 'Save changes' : 'Add project'} onPress={save} />
    </Screen>
  );
}
