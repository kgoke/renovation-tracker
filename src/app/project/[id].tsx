import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Text, View } from 'react-native';
import { BudgetBar } from '@/components/charts';
import { Space, Type, useTheme } from '@/components/theme';
import { Button, Card, Chip, EmptyState, Fab, ListRow, Loading, Screen, SectionHeader } from '@/components/ui';
import { deleteProject, getProject, listExpensesForProject, listRooms } from '@/lib/db/repo';
import { EXPENSE_CATEGORY_LABELS, PROJECT_STATUS_LABELS } from '@/lib/db/types';
import { formatIso } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { useFocusQuery } from '@/lib/useFocusQuery';

export default function ProjectDetailScreen() {
  const colors = useTheme();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id: string }>();
  const projectId = Number(params.id);

  const { data, loading } = useFocusQuery(
    async (d) => {
      const project = await getProject(d, projectId);
      if (!project) return { project: null, expenses: [], rooms: [] };
      const [expenses, rooms] = await Promise.all([
        listExpensesForProject(d, projectId),
        listRooms(d, project.propertyId),
      ]);
      return { project, expenses, rooms };
    },
    [projectId]
  );

  if (loading || !data) return <Loading />;
  const { project, expenses, rooms } = data;
  if (!project) {
    return (
      <Screen>
        <EmptyState title="Project not found" />
      </Screen>
    );
  }

  const spent = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const roomName = (id: number | null) => (id == null ? null : rooms.find((r) => r.id === id)?.name ?? null);

  const confirmDelete = () => {
    Alert.alert(
      'Delete project?',
      'Expenses stay on the property but lose their project link. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteProject(db, projectId);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: project.name }} />
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginBottom: Space.md }}>
          <Chip label={PROJECT_STATUS_LABELS[project.status]} tone="primary" />
          {project.startDate ? <Chip label={`Start ${formatIso(project.startDate)}`} /> : null}
          {project.endDate ? <Chip label={`End ${formatIso(project.endDate)}`} /> : null}
        </View>

        {project.description ? (
          <Text style={[Type.body, { color: colors.textSecondary, marginBottom: Space.md }]}>
            {project.description}
          </Text>
        ) : null}

        <Card>
          <BudgetBar spentCents={spent} budgetCents={project.budgetCents} />
        </Card>

        <SectionHeader
          title={`Expenses (${expenses.length})`}
          action="Edit project"
          onAction={() => router.push({ pathname: '/project/new', params: { projectId: String(projectId) } })}
        />
        {expenses.length === 0 ? (
          <EmptyState title="No expenses yet" message="Add expenses directly or by scanning a receipt." />
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {expenses.map((e) => {
              const room = roomName(e.roomId);
              return (
                <ListRow
                  key={e.id}
                  title={e.description}
                  subtitle={`${EXPENSE_CATEGORY_LABELS[e.category]}${room ? ` · ${room}` : ''}${e.expenseDate ? ` · ${formatIso(e.expenseDate)}` : ''}`}
                  right={formatCents(e.amountCents)}
                  onPress={() => router.push({ pathname: '/expense/new', params: { expenseId: String(e.id) } })}
                />
              );
            })}
          </Card>
        )}

        <View style={{ marginTop: Space.xl }}>
          <Button label="Delete project" variant="danger" onPress={confirmDelete} />
        </View>
      </Screen>
      <Fab
        label="+ Expense"
        onPress={() =>
          router.push({
            pathname: '/expense/new',
            params: { propertyId: String(project.propertyId), projectId: String(projectId) },
          })
        }
      />
    </View>
  );
}
