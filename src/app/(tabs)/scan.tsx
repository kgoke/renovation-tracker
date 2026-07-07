import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { Space, Type, useTheme } from '@/components/theme';
import { Card, ListRow, Screen, SectionHeader } from '@/components/ui';
import { formatIso, todayIso } from '@/lib/dates';
import { insertReceiptDraft, listPendingReceipts } from '@/lib/db/repo';
import { captureImage, persistImage, pickImage } from '@/lib/images';
import { formatCents } from '@/lib/money';
import { recognizeText } from '@/lib/ocr';
import { parseReceiptText } from '@/lib/receiptParser';
import { useFocusQuery } from '@/lib/useFocusQuery';

export default function ScanScreen() {
  const colors = useTheme();
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const { data: pending, refresh } = useFocusQuery((d) => listPendingReceipts(d));

  const handleImage = async (source: 'camera' | 'library') => {
    if (busy) return;
    try {
      const picked = source === 'camera' ? await captureImage() : await pickImage();
      if (!picked) return;
      setBusy(true);

      const storedUri = await persistImage(picked.uri);
      const ocr = await recognizeText(storedUri);
      const parsed = ocr?.text ? parseReceiptText(ocr.text) : null;

      const receiptId = await insertReceiptDraft(db, {
        imageUri: storedUri,
        vendor: parsed?.vendor ?? '',
        receiptDate: parsed?.date ?? todayIso(),
        totalCents: parsed?.totalCents ?? 0,
        subtotalCents: parsed?.subtotalCents ?? 0,
        taxCents: parsed?.taxCents ?? 0,
        ocrText: ocr?.text ?? '',
        items: (parsed?.items ?? []).map((item) => ({
          description: item.description,
          quantity: item.quantity,
          amountCents: item.amountCents,
        })),
      });

      if (!ocr) {
        Alert.alert(
          'Text recognition unavailable',
          'The receipt image was saved, but on-device OCR needs a development build (it is not available in Expo Go). You can itemize it manually.'
        );
      }
      refresh();
      router.push({ pathname: '/receipt/[id]', params: { id: String(receiptId) } });
    } catch (err) {
      console.warn('scan failed', err);
      Alert.alert('Scan failed', 'Something went wrong while processing the receipt image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={[Type.body, { color: colors.textSecondary, marginBottom: Space.lg }]}>
        Snap a photo of a receipt. Text is read on-device with OCR, then you review the itemized
        lines and assign them to a property, project, and room.
      </Text>

      {busy ? (
        <Card style={{ alignItems: 'center', paddingVertical: Space.xxl }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[Type.body, { color: colors.textSecondary, marginTop: Space.md }]}>
            Reading receipt…
          </Text>
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', gap: Space.md }}>
          <Card style={{ flex: 1, alignItems: 'center' }} onPress={() => handleImage('camera')}>
            <Ionicons name="camera-outline" size={32} color={colors.primary} />
            <Text style={[Type.subheading, { color: colors.text, marginTop: Space.sm }]}>Take photo</Text>
            <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]}>Use the camera</Text>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center' }} onPress={() => handleImage('library')}>
            <Ionicons name="images-outline" size={32} color={colors.primary} />
            <Text style={[Type.subheading, { color: colors.text, marginTop: Space.sm }]}>Choose image</Text>
            <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]}>From your photos</Text>
          </Card>
        </View>
      )}

      {pending && pending.length > 0 ? (
        <>
          <SectionHeader title="Waiting for review" />
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {pending.map((r) => (
              <ListRow
                key={r.id}
                title={r.vendor || 'Unknown vendor'}
                subtitle={r.receiptDate ? formatIso(r.receiptDate) : undefined}
                right={formatCents(r.totalCents)}
                rightSub="Tap to itemize"
                onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: String(r.id) } })}
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
