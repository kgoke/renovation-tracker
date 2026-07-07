import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DateField, FieldLabel, MoneyField, SelectField, TextField } from '@/components/forms';
import { Radius, Space, Type, useTheme } from '@/components/theme';
import { Button, Card, Chip, Loading, Screen, SectionHeader } from '@/components/ui';
import {
  deleteReceipt,
  getReceipt,
  listProjects,
  listProperties,
  listReceiptItems,
  listRooms,
  processReceipt,
} from '@/lib/db/repo';
import {
  EXPENSE_CATEGORY_LABELS,
  labelValues,
  type ExpenseCategory,
  type Project,
  type Property,
  type Receipt,
  type RoomArea,
} from '@/lib/db/types';
import { formatIso } from '@/lib/dates';
import { deleteImage } from '@/lib/images';
import { centsToInput, formatCents, parseMoney } from '@/lib/money';

interface DraftItem {
  key: number;
  description: string;
  amountText: string;
  quantity: number;
}

let nextKey = 1;

export default function ReceiptReviewScreen() {
  const colors = useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id: string }>();
  const receiptId = Number(params.id);

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState('');
  const [totalCents, setTotalCents] = useState(0);
  const [category, setCategory] = useState<ExpenseCategory>('materials');
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [showImage, setShowImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const [properties, setProperties] = useState<Property[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rooms, setRooms] = useState<RoomArea[]>([]);

  useEffect(() => {
    (async () => {
      const r = await getReceipt(db, receiptId);
      if (!r) {
        setNotFound(true);
        return;
      }
      const existing = await listReceiptItems(db, receiptId);
      setReceipt(r);
      setVendor(r.vendor);
      setDate(r.receiptDate);
      setTotalCents(r.totalCents);
      setPropertyId(r.propertyId);
      setProjectId(r.projectId);
      setItems(
        existing.map((item) => ({
          key: nextKey++,
          description: item.description,
          amountText: centsToInput(item.amountCents),
          quantity: item.quantity,
        }))
      );
      setProperties(await listProperties(db));
    })();
  }, [db, receiptId]);

  useEffect(() => {
    if (!propertyId) {
      setProjects([]);
      setRooms([]);
      return;
    }
    listProjects(db, propertyId).then(setProjects);
    listRooms(db, propertyId).then(setRooms);
  }, [db, propertyId]);

  if (notFound) {
    return (
      <Screen>
        <Text style={[Type.body, { color: colors.textMuted }]}>Receipt not found.</Text>
      </Screen>
    );
  }
  if (!receipt) return <Loading />;

  const readOnly = receipt.status === 'processed';
  const itemsTotal = items.reduce((sum, item) => sum + (parseMoney(item.amountText) ?? 0), 0);
  const mismatch = totalCents > 0 && itemsTotal !== totalCents;

  const updateItem = (key: number, patch: Partial<DraftItem>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const save = async () => {
    if (!propertyId) {
      Alert.alert('Property required', 'Choose which property these expenses belong to.');
      return;
    }
    let finalItems = items
      .map((item) => ({
        description: item.description.trim(),
        quantity: item.quantity,
        amountCents: parseMoney(item.amountText) ?? 0,
      }))
      .filter((item) => item.description && item.amountCents !== 0);
    if (finalItems.length === 0) {
      if (totalCents > 0) {
        // No line items — record the whole receipt as a single expense.
        finalItems = [
          {
            description: vendor.trim() ? `${vendor.trim()} receipt` : 'Receipt',
            quantity: 1,
            amountCents: totalCents,
          },
        ];
      } else {
        Alert.alert('Nothing to save', 'Add at least one line item or set a receipt total.');
        return;
      }
    }
    setSaving(true);
    try {
      await processReceipt(
        db,
        receiptId,
        {
          propertyId,
          projectId,
          roomId,
          vendor: vendor.trim(),
          receiptDate: date,
          totalCents: totalCents > 0 ? totalCents : itemsTotal,
          category,
        },
        finalItems
      );
      Alert.alert(
        'Receipt processed',
        `${finalItems.length} expense${finalItems.length === 1 ? '' : 's'} created.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete receipt?',
      readOnly
        ? 'The receipt and its image are removed. Expenses created from it are kept.'
        : 'The receipt and its image are removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            deleteImage(receipt.imageUri);
            await deleteReceipt(db, receiptId);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: readOnly ? 'Receipt' : 'Review receipt' }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space.md }}>
        {readOnly ? <Chip label="Processed" tone="success" /> : <Chip label="Needs review" tone="warning" />}
        {receipt.ocrText ? <Chip label="Scanned with OCR" tone="primary" /> : <Chip label="Manual entry" />}
      </View>

      {receipt.imageUri ? (
        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: Space.lg }}>
          <Pressable onPress={() => setShowImage((v) => !v)}>
            <Image
              source={{ uri: receipt.imageUri }}
              style={{ width: '100%', height: showImage ? 420 : 120, borderRadius: Radius.lg }}
              contentFit={showImage ? 'contain' : 'cover'}
            />
            <View style={[styles.imageHint, { backgroundColor: colors.surface }]}>
              <Text style={[Type.caption, { color: colors.textSecondary }]}>
                {showImage ? 'Collapse' : 'Tap to expand'}
              </Text>
            </View>
          </Pressable>
        </Card>
      ) : null}

      {readOnly ? (
        <>
          <Card>
            <Text style={[Type.heading, { color: colors.text }]}>{vendor || 'Unknown vendor'}</Text>
            <Text style={[Type.body, { color: colors.textSecondary, marginTop: 4 }]}>
              {date ? formatIso(date) : 'No date'} · {formatCents(totalCents)}
            </Text>
          </Card>
          <SectionHeader title="Items" />
          <Card>
            {items.map((item) => (
              <View key={item.key} style={styles.readonlyRow}>
                <Text style={[Type.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                  {item.quantity > 1 ? `${item.quantity} × ` : ''}
                  {item.description}
                </Text>
                <Text style={[Type.body, { color: colors.text, fontWeight: '600' }]}>
                  {formatCents(parseMoney(item.amountText) ?? 0)}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <>
          <TextField label="Vendor" value={vendor} onChangeText={setVendor} placeholder="e.g. Home Depot" />
          <DateField label="Receipt date" value={date} onChange={setDate} />
          <MoneyField label="Receipt total" cents={totalCents} onChangeCents={setTotalCents} />

          <SectionHeader title="Assign to" />
          <SelectField
            label="Property"
            value={propertyId}
            options={properties.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(v) => {
              setPropertyId(v);
              setProjectId(null);
              setRoomId(null);
            }}
          />
          <SelectField
            label="Project (optional)"
            value={projectId}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            onChange={setProjectId}
            allowClear
            placeholder="No project"
          />
          <SelectField
            label="Room (optional)"
            value={roomId}
            options={rooms.map((r) => ({ value: r.id, label: r.name }))}
            onChange={setRoomId}
            allowClear
            placeholder="No room"
          />
          <SelectField
            label="Expense category"
            value={category}
            options={labelValues<ExpenseCategory>(EXPENSE_CATEGORY_LABELS)}
            onChange={(v) => v && setCategory(v)}
          />

          <SectionHeader title={`Line items (${items.length})`} />
          {items.map((item) => (
            <Card key={item.key} style={{ marginBottom: Space.md, padding: Space.md }}>
              <View style={{ flexDirection: 'row', gap: Space.md, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel text="Item" />
                  <TextInput
                    value={item.description}
                    onChangeText={(v) => updateItem(item.key, { description: v })}
                    placeholder="Item description"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.itemInput,
                      Type.body,
                      { backgroundColor: colors.surfaceAlt, color: colors.text },
                    ]}
                  />
                </View>
                <View style={{ width: 110 }}>
                  <FieldLabel text="Amount" />
                  <TextInput
                    value={item.amountText}
                    onChangeText={(v) => updateItem(item.key, { amountText: v })}
                    placeholder="0.00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    style={[
                      styles.itemInput,
                      Type.body,
                      { backgroundColor: colors.surfaceAlt, color: colors.text },
                    ]}
                  />
                </View>
                <Pressable
                  onPress={() => setItems((list) => list.filter((i) => i.key !== item.key))}
                  hitSlop={8}
                  style={{ marginTop: 26 }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            </Card>
          ))}
          <Button
            label="+ Add line item"
            variant="secondary"
            onPress={() =>
              setItems((list) => [...list, { key: nextKey++, description: '', amountText: '', quantity: 1 }])
            }
          />

          <Card style={{ marginTop: Space.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[Type.body, { color: colors.textSecondary }]}>Items total</Text>
              <Text style={[Type.subheading, { color: mismatch ? colors.warning : colors.text }]}>
                {formatCents(itemsTotal)}
              </Text>
            </View>
            {mismatch ? (
              <Text style={[Type.caption, { color: colors.warning, marginTop: 4 }]}>
                Doesn’t match the receipt total of {formatCents(totalCents)} — OCR may have missed
                items, tax, or discounts. You can save anyway.
              </Text>
            ) : null}
          </Card>

          <View style={{ marginTop: Space.lg }}>
            <Button
              label={saving ? 'Saving…' : 'Save & create expenses'}
              onPress={save}
              disabled={saving}
            />
          </View>
        </>
      )}

      <View style={{ marginTop: Space.md }}>
        <Button label="Delete receipt" variant="danger" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  imageHint: {
    position: 'absolute',
    right: Space.sm,
    bottom: Space.sm,
    paddingHorizontal: Space.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    opacity: 0.9,
  },
  readonlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Space.md,
    paddingVertical: 6,
  },
  itemInput: {
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
