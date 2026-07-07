import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { DateField, FormRow, MoneyField, TextField } from '@/components/forms';
import { Space, Type, useTheme } from '@/components/theme';
import { Button, Card, Loading, Screen } from '@/components/ui';
import { deleteLoan, getLoan, insertLoan, updateLoan, type LoanInput } from '@/lib/db/repo';
import { formatCents } from '@/lib/money';

export default function LoanFormScreen() {
  const colors = useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ propertyId?: string; loanId?: string }>();
  const editId = params.loanId ? Number(params.loanId) : null;

  const [form, setForm] = useState<LoanInput | null>(
    editId
      ? null
      : {
          propertyId: Number(params.propertyId ?? 0),
          lender: '',
          principalCents: 0,
          interestRatePct: 0,
          termMonths: null,
          monthlyPaymentCents: 0,
          startDate: '',
          notes: '',
        }
  );
  const [rate, setRate] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    if (!editId) return;
    getLoan(db, editId).then((l) => {
      if (!l) return;
      const { id, createdAt, ...rest } = l;
      setForm(rest);
      setRate(l.interestRatePct ? String(l.interestRatePct) : '');
      setTerm(l.termMonths != null ? String(l.termMonths) : '');
    });
  }, [db, editId]);

  if (!form) return <Loading />;

  const set = <K extends keyof LoanInput>(key: K, value: LoanInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  // Rough interest estimate for display: simple interest on principal.
  const rateNum = Number(rate) || 0;
  const termNum = Number(term) || 0;
  const estimatedAnnualInterest = Math.round((form.principalCents * rateNum) / 100);

  const save = async () => {
    if (!form.lender.trim()) {
      Alert.alert('Lender required', 'Enter who the loan is with.');
      return;
    }
    if (!form.propertyId) {
      Alert.alert('Missing property', 'This loan is not linked to a property.');
      return;
    }
    const payload: LoanInput = {
      ...form,
      lender: form.lender.trim(),
      interestRatePct: Number(rate) || 0,
      termMonths: term.trim() ? Number(term) || null : null,
    };
    if (editId) await updateLoan(db, editId, payload);
    else await insertLoan(db, payload);
    router.back();
  };

  const confirmDelete = () => {
    if (!editId) return;
    Alert.alert('Delete loan?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteLoan(db, editId);
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: editId ? 'Edit loan' : 'New loan' }} />

      <TextField label="Lender" value={form.lender} onChangeText={(v) => set('lender', v)} placeholder="e.g. First National Bank" />
      <MoneyField label="Principal" cents={form.principalCents} onChangeCents={(v) => set('principalCents', v)} />
      <FormRow>
        <TextField label="Interest rate (%)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="e.g. 7.25" />
        <TextField label="Term (months)" value={term} onChangeText={setTerm} keyboardType="number-pad" placeholder="e.g. 360" />
      </FormRow>
      <MoneyField label="Monthly payment" cents={form.monthlyPaymentCents} onChangeCents={(v) => set('monthlyPaymentCents', v)} />
      <DateField label="Start date" value={form.startDate} onChange={(v) => set('startDate', v)} />
      <TextField label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} multiline />

      {form.principalCents > 0 && rateNum > 0 ? (
        <Card style={{ marginBottom: Space.lg }}>
          <Text style={[Type.caption, { color: colors.textSecondary }]}>
            ≈ {formatCents(estimatedAnnualInterest)} interest per year (simple interest estimate
            {termNum > 0 ? `, ${formatCents(Math.round((estimatedAnnualInterest * termNum) / 12))} over the full term` : ''}).
            Log actual interest paid under Costs → Interest to count it in totals.
          </Text>
        </Card>
      ) : null}

      <Button label={editId ? 'Save changes' : 'Add loan'} onPress={save} />
      {editId ? (
        <View style={{ marginTop: Space.md }}>
          <Button label="Delete loan" variant="danger" onPress={confirmDelete} />
        </View>
      ) : null}
    </Screen>
  );
}
