import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { BarChart, BudgetBar, DonutChart, StatTile } from '@/components/charts';
import { Space, Type, useTheme } from '@/components/theme';
import { Card, EmptyState, ListRow, Loading, Screen, SectionHeader } from '@/components/ui';
import {
  expenseTotalsByCategory,
  getFinancialsByProperty,
  listPendingReceipts,
  listProperties,
  listRecentExpenses,
  monthlySpend,
} from '@/lib/db/repo';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '@/lib/db/types';
import { formatIso } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { useFocusQuery } from '@/lib/useFocusQuery';

export default function DashboardScreen() {
  const colors = useTheme();
  const { data, loading } = useFocusQuery(async (db) => {
    const [properties, financials, categories, months, recent, pendingReceipts] = await Promise.all([
      listProperties(db),
      getFinancialsByProperty(db),
      expenseTotalsByCategory(db),
      monthlySpend(db, 6),
      listRecentExpenses(db, 8),
      listPendingReceipts(db),
    ]);
    return { properties, financials, categories, months, recent, pendingReceipts };
  });

  if (loading || !data) return <Loading />;

  const { properties, financials, categories, months, recent, pendingReceipts } = data;

  if (properties.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="Welcome to Renovation Tracker"
          message="Add your first property to start tracking projects, expenses, and budgets."
        />
        <Card onPress={() => router.push('/property/new')}>
          <Text style={[Type.subheading, { color: colors.primary, textAlign: 'center' }]}>
            + Add a property
          </Text>
        </Card>
      </Screen>
    );
  }

  let purchaseTotal = 0;
  let expenseTotal = 0;
  let costTotal = 0;
  for (const p of properties) {
    purchaseTotal += p.purchasePriceCents;
    const f = financials.get(p.id);
    expenseTotal += f?.expensesCents ?? 0;
    costTotal += f?.costsCents ?? 0;
  }
  const activeCount = properties.filter((p) => p.status === 'active' || p.status === 'planning').length;

  const propertyName = (id: number) => properties.find((p) => p.id === id)?.name ?? '';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: Space.md }}>
        <StatTile
          label="Total invested"
          value={formatCents(purchaseTotal + expenseTotal + costTotal, { compact: true })}
          sub="Purchase + renovation + carrying"
        />
        <StatTile
          label="Renovation spend"
          value={formatCents(expenseTotal, { compact: true })}
          sub={`${activeCount} active ${activeCount === 1 ? 'property' : 'properties'}`}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: Space.md, marginTop: Space.md }}>
        <StatTile
          label="Carrying costs"
          value={formatCents(costTotal, { compact: true })}
          sub="Loans, taxes, insurance…"
        />
        <StatTile label="Purchase prices" value={formatCents(purchaseTotal, { compact: true })} />
      </View>

      {pendingReceipts.length > 0 ? (
        <>
          <SectionHeader title="Receipts to review" />
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {pendingReceipts.map((r) => (
              <ListRow
                key={r.id}
                title={r.vendor || 'Unknown vendor'}
                subtitle={r.receiptDate ? formatIso(r.receiptDate) : 'No date'}
                right={formatCents(r.totalCents)}
                rightSub="Tap to itemize"
                onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: String(r.id) } })}
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Budgets" action="Properties" onAction={() => router.push('/properties')} />
      {properties.map((p) => {
        const f = financials.get(p.id);
        const spent = (f?.expensesCents ?? 0) + (f?.costsCents ?? 0);
        return (
          <Card
            key={p.id}
            style={{ marginBottom: Space.md }}
            onPress={() => router.push({ pathname: '/property/[id]', params: { id: String(p.id) } })}
          >
            <Text style={[Type.subheading, { color: colors.text, marginBottom: Space.sm }]}>{p.name}</Text>
            <BudgetBar spentCents={spent} budgetCents={p.budgetCents} compactLabels />
          </Card>
        );
      })}

      {categories.length > 0 ? (
        <>
          <SectionHeader title="Spend by category" />
          <Card>
            <DonutChart
              centerLabel="Renovation"
              slices={categories.map((c) => ({
                label: EXPENSE_CATEGORY_LABELS[c.key as ExpenseCategory] ?? c.key,
                valueCents: c.totalCents,
              }))}
            />
          </Card>
        </>
      ) : null}

      {months.length > 1 ? (
        <>
          <SectionHeader title="Monthly spend" />
          <Card>
            <BarChart
              data={months.map((m) => ({
                label: m.month.slice(5),
                valueCents: m.totalCents,
              }))}
            />
          </Card>
        </>
      ) : null}

      {recent.length > 0 ? (
        <>
          <SectionHeader title="Recent expenses" />
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {recent.map((e) => (
              <ListRow
                key={e.id}
                title={e.description}
                subtitle={`${propertyName(e.propertyId)}${e.expenseDate ? ` · ${formatIso(e.expenseDate)}` : ''}`}
                right={formatCents(e.amountCents)}
                onPress={() =>
                  router.push({ pathname: '/expense/new', params: { expenseId: String(e.id) } })
                }
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
