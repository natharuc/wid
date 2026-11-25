import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  type Agent,
  type DayReport,
  type MonthReport,
  type Settings,
  type Snapshot,
} from './api';
import type { ContextSummary } from '../src/domain/context';
import { contextQuery } from './context-scope';
export function useDashboard(day: string, month: string, context: string) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ tasks: [], events: [] });
  const [settings, setSettings] = useState<Settings>();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [contexts, setContexts] = useState<ContextSummary[]>([]);
  const [daily, setDaily] = useState<DayReport>();
  const [monthly, setMonthly] = useState<MonthReport>();
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const revision = useRef(0);
  const reload = useCallback(async () => {
    const current = ++revision.current;
    const suffix = contextQuery(context);
    const [data, config, clients, dayData, monthData, groups] = await Promise.all([
      api<Snapshot>(`snapshot${suffix}`),
      api<Settings>('settings'),
      api<Agent[]>('agents'),
      api<DayReport>(`day/${day}${suffix}`),
      api<MonthReport>(`month/${month}${suffix}`),
      api<ContextSummary[]>('contexts'),
    ]);
    if (current !== revision.current) return;
    setSnapshot(data);
    setSettings(config);
    setAgents(clients);
    setContexts(groups);
    setDaily(dayData);
    setMonthly(monthData);
    setLoading(false);
  }, [day, month, context]);
  useEffect(() => {
    setLoading(true);
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
  return {
    snapshot,
    settings,
    agents,
    contexts,
    daily,
    monthly,
    notice,
    setNotice,
    loading,
    reload,
  };
}
