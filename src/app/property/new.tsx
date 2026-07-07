import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { DateField, FormRow, MoneyField, SelectField, TextField } from '@/components/forms';
import { Radius, Space, Type, useTheme } from '@/components/theme';
import { Button, Card, Loading, Screen } from '@/components/ui';
import {
  getProperty,
  insertProperty,
  updateProperty,
  type PropertyInput,
} from '@/lib/db/repo';
import {
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  labelValues,
  type PropertyStatus,
  type PropertyType,
} from '@/lib/db/types';
import { captureImage, deleteImage, persistImage, pickImage } from '@/lib/images';

const emptyForm: PropertyInput = {
  name: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  latitude: null,
  longitude: null,
  propertyType: 'single_family',
  status: 'planning',
  bedrooms: null,
  bathrooms: null,
  squareFeet: null,
  lotSize: '',
  yearBuilt: null,
  purchasePriceCents: 0,
  purchaseDate: '',
  budgetCents: 0,
  notes: '',
  coverPhotoUri: null,
};

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function PropertyFormScreen() {
  const colors = useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ propertyId?: string }>();
  const editId = params.propertyId ? Number(params.propertyId) : null;

  const [form, setForm] = useState<PropertyInput | null>(editId ? null : emptyForm);
  // Numeric fields keep raw text so partial input ("3." while typing) isn't lost.
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [sqft, setSqft] = useState('');
  const [year, setYear] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  useEffect(() => {
    if (!editId) return;
    getProperty(db, editId).then((p) => {
      if (!p) return;
      const { id, createdAt, ...rest } = p;
      setForm(rest);
      setBeds(p.bedrooms != null ? String(p.bedrooms) : '');
      setBaths(p.bathrooms != null ? String(p.bathrooms) : '');
      setSqft(p.squareFeet != null ? String(p.squareFeet) : '');
      setYear(p.yearBuilt != null ? String(p.yearBuilt) : '');
      setLat(p.latitude != null ? String(p.latitude) : '');
      setLng(p.longitude != null ? String(p.longitude) : '');
    });
  }, [db, editId]);

  if (!form) return <Loading />;

  const set = <K extends keyof PropertyInput>(key: K, value: PropertyInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const attachPhoto = async (source: 'camera' | 'library') => {
    const picked = source === 'camera' ? await captureImage() : await pickImage();
    if (!picked) return;
    const stored = await persistImage(picked.uri);
    deleteImage(form.coverPhotoUri);
    set('coverPhotoUri', stored);
  };

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Give the property a name so you can find it later.');
      return;
    }
    const payload: PropertyInput = {
      ...form,
      name: form.name.trim(),
      bedrooms: numOrNull(beds),
      bathrooms: numOrNull(baths),
      squareFeet: numOrNull(sqft),
      yearBuilt: numOrNull(year),
      latitude: numOrNull(lat),
      longitude: numOrNull(lng),
    };
    if (editId) await updateProperty(db, editId, payload);
    else await insertProperty(db, payload);
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: editId ? 'Edit property' : 'New property' }} />

      <TextField label="Name" value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. 412 Maple St flip" />

      <FormRow>
        <SelectField
          label="Status"
          value={form.status}
          options={labelValues<PropertyStatus>(PROPERTY_STATUS_LABELS)}
          onChange={(v) => v && set('status', v)}
        />
        <SelectField
          label="Type"
          value={form.propertyType}
          options={labelValues<PropertyType>(PROPERTY_TYPE_LABELS)}
          onChange={(v) => v && set('propertyType', v)}
        />
      </FormRow>

      <Text style={[Type.subheading, { color: colors.text, marginBottom: Space.md }]}>Location</Text>
      <TextField label="Street address" value={form.address} onChangeText={(v) => set('address', v)} />
      <FormRow>
        <TextField label="City" value={form.city} onChangeText={(v) => set('city', v)} />
        <TextField label="State" value={form.state} onChangeText={(v) => set('state', v)} autoCapitalize="characters" />
        <TextField label="ZIP" value={form.zip} onChangeText={(v) => set('zip', v)} keyboardType="number-pad" />
      </FormRow>
      <FormRow>
        <TextField label="Latitude (optional)" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" />
        <TextField label="Longitude (optional)" value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" />
      </FormRow>

      <Text style={[Type.subheading, { color: colors.text, marginBottom: Space.md }]}>Details</Text>
      <FormRow>
        <TextField label="Bedrooms" value={beds} onChangeText={setBeds} keyboardType="decimal-pad" />
        <TextField label="Bathrooms" value={baths} onChangeText={setBaths} keyboardType="decimal-pad" />
      </FormRow>
      <FormRow>
        <TextField label="Square feet" value={sqft} onChangeText={setSqft} keyboardType="number-pad" />
        <TextField label="Year built" value={year} onChangeText={setYear} keyboardType="number-pad" />
      </FormRow>
      <TextField label="Lot size" value={form.lotSize} onChangeText={(v) => set('lotSize', v)} placeholder="e.g. 0.25 acres" />

      <Text style={[Type.subheading, { color: colors.text, marginBottom: Space.md }]}>Financials</Text>
      <MoneyField label="Purchase price" cents={form.purchasePriceCents} onChangeCents={(v) => set('purchasePriceCents', v)} />
      <DateField label="Purchase date" value={form.purchaseDate} onChange={(v) => set('purchaseDate', v)} />
      <MoneyField label="Renovation budget" cents={form.budgetCents} onChangeCents={(v) => set('budgetCents', v)} />

      <Text style={[Type.subheading, { color: colors.text, marginBottom: Space.md }]}>Cover photo</Text>
      {form.coverPhotoUri ? (
        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: Space.md }}>
          <Image source={{ uri: form.coverPhotoUri }} style={{ width: '100%', height: 180, borderRadius: Radius.lg }} contentFit="cover" />
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', gap: Space.md, marginBottom: Space.lg }}>
        <View style={{ flex: 1 }}>
          <Button label="Take photo" variant="secondary" onPress={() => attachPhoto('camera')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Choose photo" variant="secondary" onPress={() => attachPhoto('library')} />
        </View>
      </View>

      <TextField label="Notes" value={form.notes} onChangeText={(v) => set('notes', v)} multiline />

      <Button label={editId ? 'Save changes' : 'Add property'} onPress={save} />
    </Screen>
  );
}
