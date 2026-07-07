import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DATABASE_NAME, migrateDb } from '@/lib/db/database';
import { Loading } from '@/components/ui';
import { useTheme } from '@/components/theme';

export default function RootLayout() {
  const colors = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Suspense fallback={<Loading />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDb} useSuspense>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: '700' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="property/new" options={{ title: 'Property', presentation: 'modal' }} />
            <Stack.Screen name="property/[id]" options={{ title: 'Property' }} />
            <Stack.Screen name="project/new" options={{ title: 'Project', presentation: 'modal' }} />
            <Stack.Screen name="project/[id]" options={{ title: 'Project' }} />
            <Stack.Screen name="room/new" options={{ title: 'Room', presentation: 'modal' }} />
            <Stack.Screen name="room/[id]" options={{ title: 'Room' }} />
            <Stack.Screen name="expense/new" options={{ title: 'Expense', presentation: 'modal' }} />
            <Stack.Screen name="cost/new" options={{ title: 'Property cost', presentation: 'modal' }} />
            <Stack.Screen name="loan/new" options={{ title: 'Loan', presentation: 'modal' }} />
            <Stack.Screen name="receipt/[id]" options={{ title: 'Receipt' }} />
          </Stack>
        </SQLiteProvider>
      </Suspense>
    </GestureHandlerRootView>
  );
}
