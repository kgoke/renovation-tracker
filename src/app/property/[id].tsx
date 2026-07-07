import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BudgetBar, DonutChart } from '@/components/charts';
import { Radius, Space, Type, useTheme } from '@/components/theme';
import { Button, Card, Chip, EmptyState, ListRow, Loading, Screen, SectionHeader } from '@/components/ui';
import {
  costTotalsByCategory,
  countPhotosByRoom,
  deleteProperty,
  expenseTotalsByCategory,
  expenseTotalsByProject,
  expenseTotalsByRoom,
  getProperty,
  listCosts,
  listExpensesForProperty,
  listLoans,
  listProjects,
  listReceiptsForProperty,
  listRooms,
} from '@/lib/db/repo';
import {
  COST_CATEGORY_LABELS,
  COST_RECURRENCE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  ROOM_TYPE_LABELS,
  type CostCategory,
  type ExpenseCategory,
  type ProjectStatus,
} from '@/lib/db/types';
import { formatIso } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { useFocusQuery } from '@/lib/useFocusQuery';

const TABS = ['Overview', 'Projects', 'Rooms', 'Costs', 'Receipts'] as const;
type Tab = (typeof TABS)[number];

const PROJECT_TONES: Record<ProjectStatus, 'accent' | 'primary' | 'warning' | 'success'> = {
  planned: 'accent',
  in_progress: 'primary',
  on_hold: 'warning',
  completed: 'success',
};

export default function PropertyDetailScreen() {
  const colors = useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const propertyId = Number(params.id);
  const [tab, setTab] = useState<Tab>(
    TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'Overview'
  );

  const { data, loading, refresh } = useFocusQuery(
    async (d) => {
      const [
        property,
        projects,
        rooms,
        expenses,
        costs,
        loans,
        receipts,
        expenseCats,
        costCats,
        projectSpend,
        roomSpend,
        photoCounts,
      ] = await Promise.all([
        getProperty(d, propertyId),
        listProjects(d, propertyId),
        listRooms(d, propertyId),
        listExpensesForProperty(d, propertyId),
        listCosts(d, propertyId),
        listLoans(d, propertyId),
        listReceiptsForProperty(d, propertyId),
        expenseTotalsByCategory(d, propertyId),
        costTotalsByCategory(d, propertyId),
        expenseTotalsByProject(d, propertyId),
        expenseTotalsByRoom(d, propertyId),
        countPhotosByRoom(d, propertyId),
      ]);
      return {
        property, projects, rooms, expenses, costs, loans, receipts,
        expenseCats, costCats, projectSpend, roomSpend, photoCounts,
      };
    },
    [propertyId]
  );

  if (loading || !data) return <Loading />;
  const { property } = data;
  if (!property) {
    return (
      <Screen>
        <EmptyState title="Property not found" />
      </Screen>
    );
  }

  const expenseTotal = data.expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const costTotal = data.costs.reduce((sum, c) => sum + c.amountCents, 0);
  const allIn = property.purchasePriceCents + expenseTotal + costTotal;

  const confirmDelete = () => {
    Alert.alert(
      'Delete property?',
      `"${property.name}" and all of its projects, rooms, expenses, costs, and photos will be removed. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteProperty(db, propertyId);
            router.back();
          },
        },
      ]
    );
  };

  const address = [property.address, property.city, property.state, property.zip]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: property.name }} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingHorizontal: Space.lg, paddingVertical: Space.sm, gap: Space.sm }}
      >
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tab,
              {
                backgroundColor: tab === t ? colors.primary : colors.surfaceAlt,
              },
            ]}
          >
            <Text style={[Type.label, { color: tab === t ? colors.onPrimary : colors.textSecondary }]}>
              {t}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'Overview' ? (
        <Screen>
          {property.coverPhotoUri ? (
            <Image
              source={{ uri: property.coverPhotoUri }}
              style={{ width: '100%', height: 190, borderRadius: Radius.lg, marginBottom: Space.md }}
              contentFit="cover"
            />
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space.sm }}>
            <Chip label={PROPERTY_STATUS_LABELS[property.status]} tone="primary" />
            <Chip label={PROPERTY_TYPE_LABELS[property.propertyType]} />
          </View>
          {address ? (
            <Text style={[Type.body, { color: colors.textSecondary, marginBottom: Space.md }]}>{address}</Text>
          ) : null}

          <Card>
            <Text style={[Type.label, { color: colors.textMuted, marginBottom: Space.sm }]}>ALL-IN COST</Text>
            <Text style={[Type.stat, { color: colors.text }]}>{formatCents(allIn)}</Text>
            <View style={styles.allInRow}>
              <Text style={[Type.caption, { color: colors.textSecondary }]}>
                Purchase {formatCents(property.purchasePriceCents, { compact: true })}
              </Text>
              <Text style={[Type.caption, { color: colors.textSecondary }]}>
                Renovation {formatCents(expenseTotal, { compact: true })}
              </Text>
              <Text style={[Type.caption, { color: colors.textSecondary }]}>
                Carrying {formatCents(costTotal, { compact: true })}
              </Text>
            </View>
            <View style={{ marginTop: Space.lg }}>
              <BudgetBar spentCents={expenseTotal + costTotal} budgetCents={property.budgetCents} />
            </View>
          </Card>

          <SectionHeader title="Details" action="Edit" onAction={() =>
            router.push({ pathname: '/property/new', params: { propertyId: String(propertyId) } })
          } />
          <Card>
            <DetailRow label="Bedrooms" value={property.bedrooms != null ? String(property.bedrooms) : '—'} />
            <DetailRow label="Bathrooms" value={property.bathrooms != null ? String(property.bathrooms) : '—'} />
            <DetailRow
              label="Square feet"
              value={property.squareFeet != null ? property.squareFeet.toLocaleString('en-US') : '—'}
            />
            <DetailRow label="Lot size" value={property.lotSize || '—'} />
            <DetailRow label="Year built" value={property.yearBuilt != null ? String(property.yearBuilt) : '—'} />
            <DetailRow
              label="Purchased"
              value={property.purchaseDate ? formatIso(property.purchaseDate) : '—'}
            />
            <DetailRow
              label="Coordinates"
              value={
                property.latitude != null && property.longitude != null
                  ? `${property.latitude.toFixed(5)}, ${property.longitude.toFixed(5)}`
                  : '—'
              }
              last
            />
          </Card>

          {property.notes ? (
            <>
              <SectionHeader title="Notes" />
              <Card>
                <Text style={[Type.body, { color: colors.textSecondary }]}>{property.notes}</Text>
              </Card>
            </>
          ) : null}

          {data.expenseCats.length > 0 ? (
            <>
              <SectionHeader title="Renovation by category" />
              <Card>
                <DonutChart
                  centerLabel="Renovation"
                  slices={data.expenseCats.map((c) => ({
                    label: EXPENSE_CATEGORY_LABELS[c.key as ExpenseCategory] ?? c.key,
                    valueCents: c.totalCents,
                  }))}
                />
              </Card>
            </>
          ) : null}

          {data.costCats.length > 0 ? (
            <>
              <SectionHeader title="Carrying costs by category" />
              <Card>
                <DonutChart
                  centerLabel="Carrying"
                  slices={data.costCats.map((c) => ({
                    label: COST_CATEGORY_LABELS[c.key as CostCategory] ?? c.key,
                    valueCents: c.totalCents,
                  }))}
                />
              </Card>
            </>
          ) : null}

          <View style={{ marginTop: Space.xl }}>
            <Button label="Delete property" variant="danger" onPress={confirmDelete} />
          </View>
        </Screen>
      ) : null}

      {tab === 'Projects' ? (
        <Screen>
          {data.projects.length === 0 ? (
            <EmptyState title="No projects yet" message="Break the renovation into projects like Kitchen remodel or Roof replacement." />
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {data.projects.map((p) => (
                <ListRow
                  key={p.id}
                  title={p.name}
                  subtitle={
                    p.budgetCents > 0
                      ? `Budget ${formatCents(p.budgetCents, { compact: true })}`
                      : undefined
                  }
                  right={formatCents(data.projectSpend.get(p.id) ?? 0)}
                  rightSub="spent"
                  chip={<Chip label={PROJECT_STATUS_LABELS[p.status]} tone={PROJECT_TONES[p.status]} />}
                  onPress={() => router.push({ pathname: '/project/[id]', params: { id: String(p.id) } })}
                />
              ))}
            </Card>
          )}
          <View style={{ marginTop: Space.lg }}>
            <Button
              label="+ Add project"
              variant="secondary"
              onPress={() => router.push({ pathname: '/project/new', params: { propertyId: String(propertyId) } })}
            />
          </View>
        </Screen>
      ) : null}

      {tab === 'Rooms' ? (
        <Screen>
          {data.rooms.length === 0 ? (
            <EmptyState title="No rooms yet" message="Add rooms and areas to organize expenses and before/after photos." />
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {data.rooms.map((r) => (
                <ListRow
                  key={r.id}
                  title={r.name}
                  subtitle={`${ROOM_TYPE_LABELS[r.roomType]} · ${data.photoCounts.get(r.id) ?? 0} photos`}
                  right={formatCents(data.roomSpend.get(r.id) ?? 0)}
                  rightSub="spent"
                  onPress={() => router.push({ pathname: '/room/[id]', params: { id: String(r.id) } })}
                />
              ))}
            </Card>
          )}
          <View style={{ marginTop: Space.lg }}>
            <Button
              label="+ Add room"
              variant="secondary"
              onPress={() => router.push({ pathname: '/room/new', params: { propertyId: String(propertyId) } })}
            />
          </View>
        </Screen>
      ) : null}

      {tab === 'Costs' ? (
        <Screen>
          <SectionHeader
            title="Loans"
            action="+ Add"
            onAction={() => router.push({ pathname: '/loan/new', params: { propertyId: String(propertyId) } })}
          />
          {data.loans.length === 0 ? (
            <Card>
              <Text style={[Type.body, { color: colors.textMuted }]}>
                Track mortgages and hard-money loans: lender, principal, rate, and payment.
              </Text>
            </Card>
          ) : (
            data.loans.map((loan) => (
              <Card
                key={loan.id}
                style={{ marginBottom: Space.md }}
                onPress={() => router.push({ pathname: '/loan/new', params: { loanId: String(loan.id) } })}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[Type.subheading, { color: colors.text }]}>{loan.lender}</Text>
                  <Text style={[Type.subheading, { color: colors.text }]}>
                    {formatCents(loan.principalCents, { compact: true })}
                  </Text>
                </View>
                <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4 }]}>
                  {loan.interestRatePct}% APR
                  {loan.termMonths ? ` · ${loan.termMonths} mo term` : ''}
                  {loan.monthlyPaymentCents > 0
                    ? ` · ${formatCents(loan.monthlyPaymentCents)}/mo`
                    : ''}
                </Text>
                {loan.startDate ? (
                  <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]}>
                    Started {formatIso(loan.startDate)}
                  </Text>
                ) : null}
              </Card>
            ))
          )}

          <SectionHeader
            title="Cost entries"
            action="+ Add"
            onAction={() => router.push({ pathname: '/cost/new', params: { propertyId: String(propertyId) } })}
          />
          {data.costs.length === 0 ? (
            <Card>
              <Text style={[Type.body, { color: colors.textMuted }]}>
                Log carrying costs here: loan payments, interest, insurance, property taxes,
                utilities, HOA dues, closing costs.
              </Text>
            </Card>
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {data.costs.map((c) => (
                <ListRow
                  key={c.id}
                  title={c.description || COST_CATEGORY_LABELS[c.category]}
                  subtitle={`${COST_CATEGORY_LABELS[c.category]} · ${COST_RECURRENCE_LABELS[c.recurrence]}${c.costDate ? ` · ${formatIso(c.costDate)}` : ''}`}
                  right={formatCents(c.amountCents)}
                  onPress={() => router.push({ pathname: '/cost/new', params: { costId: String(c.id) } })}
                />
              ))}
            </Card>
          )}
          <Card style={{ marginTop: Space.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[Type.subheading, { color: colors.textSecondary }]}>Total carrying costs</Text>
              <Text style={[Type.subheading, { color: colors.text }]}>{formatCents(costTotal)}</Text>
            </View>
          </Card>
        </Screen>
      ) : null}

      {tab === 'Receipts' ? (
        <Screen>
          {data.receipts.length === 0 ? (
            <EmptyState
              title="No receipts yet"
              message="Scan receipts from the Scan tab — they land here once assigned to this property."
            />
          ) : (
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {data.receipts.map((r) => (
                <ListRow
                  key={r.id}
                  title={r.vendor || 'Unknown vendor'}
                  subtitle={r.receiptDate ? formatIso(r.receiptDate) : undefined}
                  right={formatCents(r.totalCents)}
                  chip={
                    r.status === 'pending' ? (
                      <Chip label="Needs review" tone="warning" />
                    ) : (
                      <Chip label="Processed" tone="success" />
                    )
                  }
                  onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: String(r.id) } })}
                />
              ))}
            </Card>
          )}
          <View style={{ marginTop: Space.lg }}>
            <Button label="Scan a receipt" variant="secondary" onPress={() => router.push('/scan')} />
          </View>
        </Screen>
      ) : null}
    </View>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const colors = useTheme();
  return (
    <View
      style={[
        styles.detailRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[Type.body, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[Type.body, { color: colors.text, fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radius.full,
  },
  allInRow: {
    flexDirection: 'row',
    gap: Space.lg,
    marginTop: Space.sm,
    flexWrap: 'wrap',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
});
