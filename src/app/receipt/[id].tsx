import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { DateField, FieldLabel, FormRow, MoneyField, SelectField, TextField } from '@/components/forms';
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
  type ReceiptFinalItem,
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
import { allocateProportionally, resolveTaxCents } from '@/lib/receiptParser';

interface DraftItem {
  key: number;
  description: string;
  amountText: string;
  quantity: number;
  projectId: number | null; // per-item override in split mode
  roomId: number | null;
  savedTaxCents: number; // as stored, for the read-only view
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
  const [subtotalCents, setSubtotalCents] = useState(0);
  const [taxCents, setTaxCents] = useState(0);
  const [category, setCategory] = useState<ExpenseCategory>('materials');
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [splitItems, setSplitItems] = useState(false);
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
      setSubtotalCents(r.subtotalCents);
      setTaxCents(r.taxCents);
      setPropertyId(r.propertyId);
      setProjectId(r.projectId);
      setSplitItems(existing.some((item) => item.projectId != null || item.roomId != null));
      setItems(
        existing.map((item) => ({
          key: nextKey++,
          description: item.description,
          amountText: centsToInput(item.amountCents),
          quantity: item.quantity,
          projectId: item.projectId,
          roomId: item.roomId,
          savedTaxCents: item.taxCents,
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

  const amounts = useMemo(() => items.map((item) => parseMoney(item.amountText) ?? 0), [items]);
  const itemsTotal = amounts.reduce((sum, v) => sum + v, 0);
  // Tax: explicit tax field wins; otherwise total − subtotal (falling back to
  // the items sum as the pre-tax figure when no subtotal was read).
  const effectiveTax = resolveTaxCents(
    subtotalCents > 0 ? subtotalCents : itemsTotal,
    taxCents,
    totalCents
  );
  const taxAllocation = useMemo(
    () => allocateProportionally(amounts, effectiveTax),
    [amounts, effectiveTax]
  );
  const grandTotal = itemsTotal + effectiveTax;
  const subtotalMismatch = subtotalCents > 0 && items.length > 0 && itemsTotal !== subtotalCents;
  const totalMismatch = totalCents > 0 && items.length > 0 && grandTotal !== totalCents;

  if (notFound) {
    return (
      <Screen>
        <Text style={[Type.body, { color: colors.textMuted }]}>Receipt not found.</Text>
      </Screen>
    );
  }
  if (!receipt) return <Loading />;

  const readOnly = receipt.status === 'processed';
  const projectName = (id: number | null) => projects.find((p) => p.id === id)?.name ?? null;
  const roomName = (id: number | null) => rooms.find((r) => r.id === id)?.name ?? null;

  const updateItem = (key: number, patch: Partial<DraftItem>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const save = async () => {
    if (!propertyId) {
      Alert.alert('Property required', 'Choose which property these expenses belong to.');
      return;
    }
    const kept = items
      .map((item, index) => ({
        description: item.description.trim(),
        quantity: item.quantity,
        amountCents: parseMoney(item.amountText) ?? 0,
        index,
      }))
      .filter((item) => item.description && item.amountCents !== 0);

    let finalItems: ReceiptFinalItem[];
    if (kept.length === 0) {
      // No line items — record the whole receipt as a single expense.
      const amount = totalCents > 0 ? totalCents - effectiveTax : itemsTotal;
      if (amount <= 0 && effectiveTax <= 0) {
        Alert.alert('Nothing to save', 'Add at least one line item or set a receipt total.');
        return;
      }
      finalItems = [
        {
          description: vendor.trim() ? `${vendor.trim()} receipt` : 'Receipt',
          quantity: 1,
          amountCents: amount,
          taxCents: effectiveTax,
          projectId,
          roomId,
        },
      ];
    } else {
      // Allocate tax over the kept items only, proportional to their amounts.
      const keptAllocation = allocateProportionally(
        kept.map((item) => item.amountCents),
        effectiveTax
      );
      finalItems = kept.map((item, i) => {
        const original = items[item.index];
        return {
          description: item.description,
          quantity: item.quantity,
          amountCents: item.amountCents,
          taxCents: keptAllocation[i],
          projectId: splitItems ? (original.projectId ?? projectId) : projectId,
          roomId: splitItems ? (original.roomId ?? roomId) : roomId,
        };
      });
    }

    setSaving(true);
    try {
      await processReceipt(
        db,
        receiptId,
        {
          propertyId,
          projectId,
          vendor: vendor.trim(),
          receiptDate: date,
          totalCents: totalCents > 0 ? totalCents : grandTotal,
          subtotalCents: subtotalCents > 0 ? subtotalCents : itemsTotal,
          taxCents: effectiveTax,
          category,
        },
        finalItems
      );
      Alert.alert(
        'Receipt processed',
        `${finalItems.length} expense${finalItems.length === 1 ? '' : 's'} created` +
          (effectiveTax > 0 ? `, with ${formatCents(effectiveTax)} tax spread across items.` : '.'),
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
              {date ? formatIso(date) : 'No date'}
            </Text>
            <View style={{ marginTop: Space.md }}>
              <SummaryRow label="Subtotal" value={formatCents(receipt.subtotalCents)} />
              <SummaryRow label="Tax" value={formatCents(receipt.taxCents)} />
              <SummaryRow label="Total" value={formatCents(receipt.totalCents)} bold />
            </View>
          </Card>
          <SectionHeader title="Items" />
          <Card>
            {items.map((item) => {
              const amount = parseMoney(item.amountText) ?? 0;
              const project = projectName(item.projectId);
              const room = roomName(item.roomId);
              const target = [project, room].filter(Boolean).join(' · ');
              return (
                <View key={item.key} style={styles.readonlyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Type.body, { color: colors.text }]} numberOfLines={1}>
                      {item.quantity > 1 ? `${item.quantity} × ` : ''}
                      {item.description}
                    </Text>
                    {target ? (
                      <Text style={[Type.caption, { color: colors.textMuted, marginTop: 1 }]} numberOfLines={1}>
                        {target}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[Type.body, { color: colors.text, fontWeight: '600' }]}>
                      {formatCents(amount + item.savedTaxCents)}
                    </Text>
                    {item.savedTaxCents !== 0 ? (
                      <Text style={[Type.caption, { color: colors.textMuted }]}>
                        incl. {formatCents(item.savedTaxCents)} tax
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      ) : (
        <>
          <TextField label="Vendor" value={vendor} onChangeText={setVendor} placeholder="e.g. Home Depot" />
          <DateField label="Receipt date" value={date} onChange={setDate} />
          <FormRow>
            <MoneyField label="Subtotal (pre-tax)" cents={subtotalCents} onChangeCents={setSubtotalCents} />
            <MoneyField label="Tax" cents={taxCents} onChangeCents={setTaxCents} />
          </FormRow>
          <MoneyField label="Receipt total" cents={totalCents} onChangeCents={setTotalCents} />
          {taxCents === 0 && effectiveTax > 0 ? (
            <Text style={[Type.caption, { color: colors.textSecondary, marginTop: -Space.sm, marginBottom: Space.md }]}>
              Tax of {formatCents(effectiveTax)} derived from total − pre-tax amount; it will be
              spread across items automatically.
            </Text>
          ) : null}

          <SectionHeader title="Assign to" />
          <SelectField
            label="Property"
            value={propertyId}
            options={properties.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(v) => {
              setPropertyId(v);
              setProjectId(null);
              setRoomId(null);
              setItems((list) => list.map((item) => ({ ...item, projectId: null, roomId: null })));
            }}
          />
          <SelectField
            label={splitItems ? 'Default project' : 'Project (optional)'}
            value={projectId}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            onChange={setProjectId}
            allowClear
            placeholder="No project"
          />
          <SelectField
            label={splitItems ? 'Default room' : 'Room (optional)'}
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

          <Card style={{ marginBottom: Space.md }}>
            <View style={styles.splitRow}>
              <View style={{ flex: 1, marginRight: Space.md }}>
                <Text style={[Type.subheading, { color: colors.text }]}>Split items across projects/rooms</Text>
                <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {splitItems
                    ? 'Assign each line item its own project and room; unset items use the defaults above.'
                    : 'Off: the whole receipt goes to the project and room above.'}
                </Text>
              </View>
              <Switch
                value={splitItems}
                onValueChange={setSplitItems}
                trackColor={{ true: colors.primary }}
              />
            </View>
          </Card>

          <SectionHeader title={`Line items (${items.length})`} />
          {items.map((item, index) => {
            const amount = parseMoney(item.amountText) ?? 0;
            const itemTax = taxAllocation[index] ?? 0;
            return (
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

                {splitItems ? (
                  <View style={{ marginTop: Space.sm }}>
                    <FormRow>
                      <SelectField
                        label="Project"
                        value={item.projectId}
                        options={projects.map((p) => ({ value: p.id, label: p.name }))}
                        onChange={(v) => updateItem(item.key, { projectId: v })}
                        allowClear
                        placeholder={projectId ? `Default (${projectName(projectId)})` : 'Default (none)'}
                      />
                      <SelectField
                        label="Room"
                        value={item.roomId}
                        options={rooms.map((r) => ({ value: r.id, label: r.name }))}
                        onChange={(v) => updateItem(item.key, { roomId: v })}
                        allowClear
                        placeholder={roomId ? `Default (${roomName(roomId)})` : 'Default (none)'}
                      />
                    </FormRow>
                  </View>
                ) : null}

                {amount !== 0 && itemTax !== 0 ? (
                  <Text style={[Type.caption, { color: colors.textSecondary, marginTop: splitItems ? 0 : Space.sm }]}>
                    + {formatCents(itemTax)} tax → {formatCents(amount + itemTax)} expensed
                  </Text>
                ) : null}
              </Card>
            );
          })}
          <Button
            label="+ Add line item"
            variant="secondary"
            onPress={() =>
              setItems((list) => [
                ...list,
                {
                  key: nextKey++,
                  description: '',
                  amountText: '',
                  quantity: 1,
                  projectId: null,
                  roomId: null,
                  savedTaxCents: 0,
                },
              ])
            }
          />

          <Card style={{ marginTop: Space.lg }}>
            <SummaryRow label={`Items (${items.length})`} value={formatCents(itemsTotal)} warn={subtotalMismatch} />
            <SummaryRow label="Tax (spread across items)" value={formatCents(effectiveTax)} />
            <SummaryRow label="Grand total" value={formatCents(grandTotal)} bold warn={totalMismatch} />
            {subtotalMismatch ? (
              <Text style={[Type.caption, { color: colors.warning, marginTop: 4 }]}>
                Items add up to {formatCents(itemsTotal)}, but the receipt subtotal is{' '}
                {formatCents(subtotalCents)} — OCR may have missed or misread a line. You can save anyway.
              </Text>
            ) : null}
            {!subtotalMismatch && totalMismatch ? (
              <Text style={[Type.caption, { color: colors.warning, marginTop: 4 }]}>
                Items + tax come to {formatCents(grandTotal)}, but the receipt total is{' '}
                {formatCents(totalCents)}. You can save anyway.
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

function SummaryRow({
  label,
  value,
  bold = false,
  warn = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  warn?: boolean;
}) {
  const colors = useTheme();
  return (
    <View style={styles.summaryRow}>
      <Text style={[Type.body, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          bold ? Type.subheading : Type.body,
          { color: warn ? colors.warning : colors.text, fontWeight: '600' },
        ]}
      >
        {value}
      </Text>
    </View>
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
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
});
