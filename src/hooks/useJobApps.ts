import { useState, useEffect, useCallback } from 'react';
import Storage from '../utils/storage';
import type { JobApp } from '../types';

export function useJobApps() {
  const [apps, setApps] = useState<JobApp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Storage.get('job-apps').then((raw) => {
      setApps(raw ? JSON.parse(raw) : []);
      setLoading(false);
    });
  }, []);

  const persist = useCallback(async (next: JobApp[]) => {
    setApps(next);
    await Storage.set('job-apps', JSON.stringify(next));
  }, []);

  const addApp = useCallback(
    (app: JobApp) => persist([app, ...apps]),
    [apps, persist]
  );

  const updateApp = useCallback(
    (id: string, patch: Partial<JobApp>) =>
      persist(apps.map((a) => (a.id === id ? { ...a, ...patch } : a))),
    [apps, persist]
  );

  const deleteApp = useCallback(
    (id: string) => persist(apps.filter((a) => a.id !== id)),
    [apps, persist]
  );

  const importApps = useCallback(
    (newApps: JobApp[]) => persist([...newApps, ...apps]),
    [apps, persist]
  );

  return { apps, loading, addApp, updateApp, deleteApp, importApps };
}
