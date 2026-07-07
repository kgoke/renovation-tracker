import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Runs a database query whenever the screen gains focus (which also covers
 * returning from an edit screen), exposing loading state and a manual
 * `refresh` for pull-to-refresh or post-mutation reloads.
 */
export function useFocusQuery<T>(
  query: (db: SQLiteDatabase) => Promise<T>,
  deps: readonly unknown[] = []
): { data: T | null; loading: boolean; refresh: () => void } {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);

  const run = useCallback(() => {
    const current = ++generation.current;
    query(db)
      .then((result) => {
        if (generation.current === current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('query failed', err);
        if (generation.current === current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ...deps]);

  useFocusEffect(
    useCallback(() => {
      run();
    }, [run])
  );

  return { data, loading, refresh: run };
}
