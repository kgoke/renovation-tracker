import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BudgetBar } from '@/components/charts';
import { Radius, Space, Type, useTheme } from '@/components/theme';
import { Card, Chip, EmptyState, Fab, Loading, Screen } from '@/components/ui';
import { getFinancialsByProperty, listProperties } from '@/lib/db/repo';
import {
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  type Property,
  type PropertyStatus,
} from '@/lib/db/types';
import { useFocusQuery } from '@/lib/useFocusQuery';

const STATUS_TONES: Record<PropertyStatus, 'primary' | 'accent' | 'warning' | 'success' | 'neutral'> = {
  planning: 'accent',
  active: 'primary',
  on_hold: 'warning',
  completed: 'success',
  sold: 'neutral',
};

function detailsLine(p: Property): string {
  const parts: string[] = [];
  if (p.bedrooms != null) parts.push(`${p.bedrooms} bd`);
  if (p.bathrooms != null) parts.push(`${p.bathrooms} ba`);
  if (p.squareFeet != null) parts.push(`${p.squareFeet.toLocaleString('en-US')} sqft`);
  parts.push(PROPERTY_TYPE_LABELS[p.propertyType]);
  return parts.join(' · ');
}

export default function PropertiesScreen() {
  const colors = useTheme();
  const { data, loading } = useFocusQuery(async (db) => {
    const [properties, financials] = await Promise.all([listProperties(db), getFinancialsByProperty(db)]);
    return { properties, financials };
  });

  if (loading || !data) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {data.properties.length === 0 ? (
          <EmptyState
            title="No properties yet"
            message="Add a property to start tracking its projects, rooms, and costs."
          />
        ) : (
          data.properties.map((p) => {
            const f = data.financials.get(p.id);
            const spent = (f?.expensesCents ?? 0) + (f?.costsCents ?? 0);
            const address = [p.address, p.city].filter(Boolean).join(', ');
            return (
              <Card
                key={p.id}
                style={{ marginBottom: Space.md, padding: 0, overflow: 'hidden' }}
                onPress={() => router.push({ pathname: '/property/[id]', params: { id: String(p.id) } })}
              >
                {p.coverPhotoUri ? (
                  <Image source={{ uri: p.coverPhotoUri }} style={styles.cover} contentFit="cover" />
                ) : null}
                <View style={{ padding: Space.lg }}>
                  <View style={styles.titleRow}>
                    <Text style={[Type.heading, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Chip label={PROPERTY_STATUS_LABELS[p.status]} tone={STATUS_TONES[p.status]} />
                  </View>
                  {address ? (
                    <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
                      {address}
                    </Text>
                  ) : null}
                  <Text style={[Type.caption, { color: colors.textSecondary, marginTop: Space.sm }]}>
                    {detailsLine(p)}
                  </Text>
                  <View style={{ marginTop: Space.md }}>
                    <BudgetBar spentCents={spent} budgetCents={p.budgetCents} compactLabels />
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </Screen>
      <Fab label="+ Property" onPress={() => router.push('/property/new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 150, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
});
