import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  type Agent,
  type DayReport,
  type MonthReport,
  type Settings,
  type Snapshot,
} from './api';
export function useDashboard(day: string, month: string) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ tasks: [], events: [] });
  const [settings, setSettings] = useState<Settings>();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [daily, setDaily] = useState<DayReport>();
  const [monthly, setMonthly] = useState<MonthReport>();
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const revision = useRef(0);
  const reload = useCallback(async () => {
    const current = ++revision.current;
    const [data, config, clients, dayData, monthData] = await Promise.all([
      api<Snapshot>('snapshot'),
      api<Settings>('settings'),
      api<Agent[]>('agents'),
      api<DayReport>(`day/${day}`),
      api<MonthReport>(`month/${month}`),
    ]);
    if (current !== revision.current) return;
    setSnapshot(data);
    setSettings(config);
    setAgents(clients);
    setDaily(dayData);
    setMonthly(monthData);
    setLoading(false);
  }, [day, month]);
  useEffect(() => {
    void reload().catch((error) => {
      setNotice(error.message);
      setLoading(false);
    });
    const timer = setInterval(() => {
      void reload().catch((error) => setNotice(error.message));
    }, 15_000);
    return () => {
      revision.current++;
      clearInterval(timer);
    };
  }, [reload]);
  return { snapshot, settings, agents, daily, monthly, notice, setNotice, loading, reload };
}
