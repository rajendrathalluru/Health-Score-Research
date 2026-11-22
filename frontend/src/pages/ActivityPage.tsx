import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Layout from '../components/layout/Layout';
import ManualActivityInput from '../components/dashboard/ManualActivityInput';
import { API_URL } from '../config/api';

function formatLocalDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentWeekStart(): string {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - diff);
  mon.setHours(0, 0, 0, 0);
  return formatLocalDateOnly(mon);
}

interface GoogleHealthSyncData {
  steps: number;
  activeMinutes: number;
  caloriesBurned: number;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  warnings?: string[];
  sources: {
    weight: string | null;
    activity: string;
    bmi: string;
  };
}

interface ManualActivityEntry {
  date: string;
  mvpa_minutes: number;
}

interface TimeSeriesPoint {
  date: string;
  value: number;
  fatBurn?: number;
  cardio?: number;
  peak?: number;
}

interface GoogleHealthTimeSeries {
  metric: 'steps' | 'active' | 'azm';
  period: 'day' | 'week' | 'month';
  start: string;
  end: string;
  points: TimeSeriesPoint[];
  total: number;
  average: number;
}

function formatDayLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
}

function formatRangeLabel(start: string, end: string, period: 'day' | 'week' | 'month') {
  const startDate = new Date(`${start}T00:00:00`);
  let endDate = new Date(`${end}T00:00:00`);
  if (period === 'day') {
    return startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (period === 'week') {
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
  } else if (period === 'month') {
    endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
  }

  const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

function shiftAnchorDate(anchorDate: string, period: 'day' | 'week' | 'month', direction: -1 | 1) {
  const next = new Date(`${anchorDate}T00:00:00`);
  if (period === 'month') {
    next.setMonth(next.getMonth() + direction);
  } else if (period === 'day') {
    next.setDate(next.getDate() + direction);
  } else {
    next.setDate(next.getDate() + (7 * direction));
  }
  return formatLocalDateOnly(next);
}

function isCurrentOrFutureRange(end: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(`${end}T00:00:00`);
  return endDate >= today;
}

export default function ActivityPage() {
  const [googleHealthConnected, setGoogleHealthConnected] = useState(false);
  const [googleHealthLoading, setGoogleHealthLoading] = useState(true);
  const [googleHealthEmail, setGoogleHealthEmail] = useState<string | null>(null);
  const [googleHealthData, setGoogleHealthData] = useState<GoogleHealthSyncData | null>(null);
  const [timeSeriesOpen, setTimeSeriesOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'steps' | 'active' | 'azm'>('steps');
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [anchorDate, setAnchorDate] = useState(() => formatLocalDateOnly(new Date()));
  const [timeSeries, setTimeSeries] = useState<GoogleHealthTimeSeries | null>(null);
  const [timeSeriesLoading, setTimeSeriesLoading] = useState(false);
  const [timeSeriesMessage, setTimeSeriesMessage] = useState('');
  const [manualActivityEntries, setManualActivityEntries] = useState<ManualActivityEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const token = localStorage.getItem('token');
  const weekStart = getCurrentWeekStart();
  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const checkGoogleHealthStatus = useCallback(async () => {
    try {
      setGoogleHealthLoading(true);
      const res = await fetch(`${API_URL}/api/google-health/status`, { headers });
      const data = await res.json();
      if (data.success && data.connected) {
        setGoogleHealthConnected(true);
        setGoogleHealthEmail(data.google_email ?? null);
        setGoogleHealthData(data.data ?? null);
      } else {
        setGoogleHealthConnected(false);
        setGoogleHealthEmail(null);
        setGoogleHealthData(null);
        if (selectedMetric === 'azm') {
          setSelectedMetric('steps');
        }
      }
    } catch {
      setGoogleHealthConnected(false);
      setGoogleHealthEmail(null);
      setGoogleHealthData(null);
      if (selectedMetric === 'azm') {
        setSelectedMetric('steps');
      }
    } finally {
      setGoogleHealthLoading(false);
    }
  }, [headers, selectedMetric]);

  const loadTimeSeries = useCallback(async (
    metric: 'steps' | 'active' | 'azm',
    period: 'day' | 'week' | 'month'
  ) => {
    if (metric === 'azm' && !googleHealthConnected) {
      setTimeSeries(null);
      setTimeSeriesMessage('Connect Google Health to view Active Zone Minutes.');
      return;
    }

    try {
      setTimeSeriesLoading(true);
      const res = await fetch(`${API_URL}/api/google-health/timeseries?metric=${metric}&period=${period}&anchorDate=${anchorDate}`, {
        headers,
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && data.available && data.data) {
        setTimeSeries(data.data);
        setTimeSeriesMessage('');
      } else {
        setTimeSeries(null);
        setTimeSeriesMessage(data.message || '');
      }
    } catch {
      setTimeSeries(null);
      setTimeSeriesMessage('Could not load time series right now.');
    } finally {
      setTimeSeriesLoading(false);
    }
  }, [anchorDate, googleHealthConnected, headers]);

  const loadManualActivity = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/measurements/activity?weekStart=${weekStart}`, { headers });
      const data = await res.json();
      if (data.success) setManualActivityEntries(data.data.entries ?? []);
    } catch {
      // ignore
    }
  }, [headers, weekStart]);

  useEffect(() => {
    void checkGoogleHealthStatus();
    void loadManualActivity();
  }, [checkGoogleHealthStatus, loadManualActivity]);

  useEffect(() => {
    void loadTimeSeries(selectedMetric, selectedPeriod);
  }, [selectedMetric, selectedPeriod, googleHealthConnected, anchorDate, loadTimeSeries]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const healthStatus = params.get('google_health');

    if (healthStatus === 'connected') {
      setSyncMessage('Google Health connected successfully!');
      void checkGoogleHealthStatus();
      window.history.replaceState({}, '', '/activity');
    } else if (healthStatus === 'partial') {
      setSyncMessage('Google Health connected with partial permissions. Some metrics may need manual entry.');
      void checkGoogleHealthStatus();
      window.history.replaceState({}, '', '/activity');
    } else if (healthStatus === 'no_permissions') {
      setSyncMessage('No Google Health data permissions were granted. Select at least one permission to connect.');
      window.history.replaceState({}, '', '/activity');
    } else if (healthStatus === 'already_linked') {
      setSyncMessage('This Google Health account is already linked to a different ThriveScore account.');
      window.history.replaceState({}, '', '/activity');
    } else if (healthStatus === 'error') {
      setSyncMessage('Google Health connection failed. Please try again.');
      window.history.replaceState({}, '', '/activity');
    }
  }, [checkGoogleHealthStatus]);

  const connectGoogleHealth = async () => {
    try {
      setSyncMessage('Redirecting to Google Health...');
      const res = await fetch(`${API_URL}/api/google-health/auth-url`, {
        headers,
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.authUrl) {
        throw new Error(data.message || 'Failed to start Google Health connection');
      }
      window.location.assign(data.authUrl);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Could not connect to Google Health. Please try again.');
    }
  };

  const syncGoogleHealth = async () => {
    try {
      setSyncing(true);
      setSyncMessage('');
      const res = await fetch(`${API_URL}/api/google-health/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setGoogleHealthData(data.data);
        const warningText = Array.isArray(data.data?.warnings) && data.data.warnings.length
          ? ` (${data.data.warnings.join(' ')})`
          : '';
        setSyncMessage(`Synced current week — ${data.data.steps.toLocaleString()} steps · ${data.data.activeMinutes} active mins${warningText}`);
        await loadManualActivity();
        await loadTimeSeries(selectedMetric, selectedPeriod);
      } else {
        setSyncMessage(`Sync failed: ${data.error || data.message}`);
      }
    } catch {
      setSyncMessage('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const disconnectGoogleHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/api/google-health/disconnect`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to disconnect Google Health');
      }
      setGoogleHealthConnected(false);
      setGoogleHealthEmail(null);
      setGoogleHealthData(null);
      if (selectedMetric === 'azm') {
        setSelectedMetric('steps');
      }
      setSyncMessage('Google Health disconnected from this app.');
    } catch {
      setSyncMessage('Could not disconnect Google Health. Please try again.');
    }
  };

  const saveManualActivity = async (date: string, mvpaMinutes: number) => {
    const res = await fetch(`${API_URL}/api/measurements/activity`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ date, mvpa_minutes: mvpaMinutes, week_start_date: weekStart }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to save');
    setManualActivityEntries((current) => {
      const next = current.filter((entry) => entry.date !== date);
      next.push({ date, mvpa_minutes: mvpaMinutes });
      next.sort((a, b) => a.date.localeCompare(b.date));
      return next;
    });
  };

  const totalManualMinutes = manualActivityEntries.reduce((sum, entry) => sum + Number(entry.mvpa_minutes || 0), 0);
  const activityTotal = googleHealthConnected && googleHealthData ? googleHealthData.activeMinutes : totalManualMinutes;
  const goalPercent = Math.min(100, Math.round((activityTotal / 150) * 100));
  const chartGoal = selectedMetric === 'steps' ? 10000 : selectedMetric === 'active' ? 150 : undefined;
  const chartLabel = selectedMetric === 'steps'
    ? 'steps'
    : selectedMetric === 'active'
      ? 'active min'
      : 'AZM';
  const chartDescription = useMemo(() => {
    if (!timeSeries) return '';
    if (selectedMetric === 'steps') {
      return `You logged a total of ${Math.round(timeSeries.total).toLocaleString()} steps in this ${selectedPeriod}.`;
    }
    if (selectedMetric === 'active') {
      return `You logged ${Math.round(timeSeries.total)} active minutes in this ${selectedPeriod}.`;
    }
    return `You earned ${Math.round(timeSeries.total)} Active Zone Minutes in this ${selectedPeriod}.`;
  }, [selectedMetric, selectedPeriod, timeSeries]);
  const chartData = useMemo(() => {
    if (!timeSeries) return [];
    return timeSeries.points.map((point) => ({
      ...point,
      label:
        selectedPeriod === 'month'
          ? new Date(`${point.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : formatDayLabel(point.date),
    }));
  }, [selectedPeriod, timeSeries]);
  const canGoForward = !timeSeries || !isCurrentOrFutureRange(timeSeries.end);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Activity</p>
          <h1 className="mt-1.5 text-[1.75rem] font-semibold tracking-tight text-stone-950">Activity</h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-500">Google Health sync (Fitbit &amp; Wear OS) with manual fallback for the current week.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  googleHealthConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                }`}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.35-9-9.5C1.5 7.5 4.5 4 8 4c2 0 3.5 1 4 2.5C12.5 5 14 4 16 4c3.5 0 6.5 3.5 5 7.5-2 5.15-9 9.5-9 9.5Z" />
                  </svg>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Google Health</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      googleHealthLoading
                        ? 'bg-stone-100 text-stone-600'
                        : googleHealthConnected
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-stone-100 text-stone-600'
                    }`}>
                      {googleHealthLoading ? 'Checking' : googleHealthConnected ? 'Connected' : 'Manual'}
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-950">
                    {googleHealthLoading ? 'Checking Google Health state' : googleHealthConnected ? 'Google Health is linked' : 'Connect Google Health'}
                  </h2>
                  <p className="mt-1 max-w-xl text-xs leading-5 sm:text-sm text-stone-500">
                    {googleHealthLoading
                      ? 'Loading your current Google Health connection.'
                      : googleHealthConnected
                        ? syncMessage || (googleHealthEmail ? `Linked to ${googleHealthEmail}. Sync current-week activity and steps from Google Health.` : 'Sync current-week activity and steps from Google Health.')
                        : syncMessage || 'Connect Google Health to sync Fitbit, Pixel Watch, or Wear OS activity. Manual entries fill any uncovered days.'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {googleHealthLoading ? (
                  <button disabled className="rounded-xl bg-stone-200 px-3.5 py-2.5 text-xs font-semibold text-stone-500 sm:text-sm">
                    Checking...
                  </button>
                ) : googleHealthConnected ? (
                  <>
                    <button
                      onClick={syncGoogleHealth}
                      disabled={syncing}
                      className="rounded-xl bg-stone-900 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 sm:text-sm"
                    >
                      {syncing ? 'Syncing...' : 'Sync Google Health'}
                    </button>
                    <button
                      onClick={disconnectGoogleHealth}
                      className="rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 sm:text-sm"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={connectGoogleHealth}
                    className="rounded-xl bg-blue-700 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 sm:text-sm"
                  >
                    Connect Google Health
                  </button>
                )}
              </div>
            </div>

            {!googleHealthLoading && !googleHealthConnected && (
              <div className="mt-4 rounded-[18px] border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-xs leading-5 text-stone-700">
                <span className="font-semibold text-stone-900">Data access disclosure:</span>{' '}
                Connecting Google Health requests read-only access to your <strong>activity</strong> (steps, moderate/vigorous active minutes, Active Zone Minutes) and <strong>body measurements</strong> (weight, height) solely to compute your weekly WCRF/AICR score and display your trends. We never sell your data or use it for ads. See our{' '}
                <a href="/privacypolicy.html" target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline hover:text-blue-800">
                  Privacy Policy
                </a>.
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Status', value: googleHealthLoading ? 'Checking' : googleHealthConnected ? 'Connected' : 'Manual' },
                { label: 'Steps', value: googleHealthConnected && googleHealthData ? googleHealthData.steps.toLocaleString() : 'Not synced' },
                { label: 'Active', value: `${activityTotal} min` },
                { label: 'Goal', value: `${goalPercent}%` },
              ].map((item) => (
                <div key={item.label} className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
                  <div className="text-sm font-semibold text-stone-950">{item.value}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[18px] border border-stone-200 bg-stone-50 p-3">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold text-stone-600">
                <span>Weekly target</span>
                <span>{activityTotal} / 150 min</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-stone-200">
                <div
                  className={`h-2 rounded-full ${activityTotal >= 150 ? 'bg-emerald-600' : activityTotal >= 75 ? 'bg-amber-500' : 'bg-stone-500'}`}
                  style={{ width: `${goalPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Weekly read</p>
            <div className="mt-3 space-y-2.5">
              <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-stone-900">Primary source</div>
                    <div className="mt-0.5 text-xs text-stone-500">
                      {googleHealthConnected ? 'Google Health leads. Manual fills missing days.' : 'Manual logging is active.'}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    googleHealthConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-700'
                  }`}>
                    {googleHealthConnected ? 'Google Health' : 'Manual'}
                  </span>
                </div>
              </div>

              <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
                <div className="text-sm font-semibold text-stone-900">Coverage</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <div className="text-lg font-semibold tracking-tight text-stone-950">{activityTotal}</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400">Active min</div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <div className="text-lg font-semibold tracking-tight text-stone-950">
                      {googleHealthConnected && googleHealthData ? googleHealthData.steps.toLocaleString() : totalManualMinutes.toString()}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400">
                      {googleHealthConnected ? 'Steps' : 'Manual total'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
                <div className="text-sm font-semibold text-stone-900">Scoring note</div>
                <div className="mt-1 text-xs leading-5 text-stone-500">
                  Weekly activity score uses current-week total minutes. Google Health data is used when present for a given day; manual entries cover the rest.
                </div>
              </div>

            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-stone-200 bg-white p-4 text-stone-950 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Time series</p>
              <h2 className="mt-1 text-base font-semibold tracking-tight sm:text-lg">
                {selectedMetric === 'steps' ? 'Steps' : selectedMetric === 'active' ? 'Active Minutes' : 'Active Zone Minutes'}
              </h2>
            </div>
            <button
              onClick={() => setTimeSeriesOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
              aria-expanded={timeSeriesOpen}
            >
              {timeSeriesOpen ? 'Hide' : 'Show'}
              <svg
                className={`h-4 w-4 text-stone-500 transition-transform ${timeSeriesOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m5 8 5 5 5-5" />
              </svg>
            </button>
          </div>

          {timeSeriesOpen && (
            <>
              <div className="mt-5 overflow-x-auto">
                <div className="inline-flex min-w-full justify-center gap-8 border-b border-stone-200 px-1 text-[15px] font-medium text-stone-500">
                  {([
                    { key: 'day', label: 'Day' },
                    { key: 'week', label: 'Week' },
                    { key: 'month', label: 'Month' },
                  ] as const).map((item) => (
                    <button
                      key={item.key}
                    onClick={() => setSelectedPeriod(item.key)}
                    className={`border-b-2 px-1 pb-3 pt-1 transition ${
                      selectedPeriod === item.key
                          ? 'border-[#50dbc8] text-[#16b6a1]'
                          : 'border-transparent hover:text-stone-900'
                    }`}
                  >
                    {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
                {([
                  { key: 'steps', label: 'Steps' },
                  { key: 'active', label: 'Active Minutes' },
                  { key: 'azm', label: 'AZM' },
                ] as const).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setSelectedMetric(item.key)}
                    disabled={item.key === 'azm' && !googleHealthConnected}
                    className={`rounded-full px-4 py-2 transition ${
                      selectedMetric === item.key
                        ? 'bg-[#dff8f1] text-[#0f766e]'
                        : 'border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => setAnchorDate((current) => shiftAnchorDate(current, selectedPeriod, -1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-xl text-stone-700 transition hover:bg-stone-100"
                  aria-label={`Previous ${selectedPeriod}`}
                >
                  ‹
                </button>
                <div className="text-base font-medium text-stone-900 sm:text-lg">
                  {timeSeries ? formatRangeLabel(timeSeries.start, timeSeries.end, selectedPeriod) : 'Current range'}
                </div>
                <button
                  onClick={() => setAnchorDate((current) => shiftAnchorDate(current, selectedPeriod, 1))}
                  disabled={!canGoForward}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-stone-50 text-xl text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Next ${selectedPeriod}`}
                >
                  ›
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div />
              </div>

              <div className="mt-4">
                {timeSeriesLoading ? (
                  <div className="flex h-[240px] items-center justify-center rounded-[20px] border border-stone-200 bg-stone-50 text-stone-500">
                    Loading time series...
                  </div>
                ) : timeSeries ? (
                  <>
                    <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                      <div className="text-4xl font-semibold leading-none tracking-tight sm:text-5xl">
                        {Math.round(timeSeries.average).toLocaleString()}
                      </div>
                      <div className="pb-1 text-base text-stone-500 sm:pb-1.5 sm:text-lg">
                        {chartLabel} per day (avg)
                      </div>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{chartDescription}</p>

                    <div className="mt-5 h-[210px] sm:mt-5 sm:h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#ece7df" vertical={false} />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#78716c', fontSize: 12 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#78716c', fontSize: 12 }}
                            tickFormatter={(value) => selectedMetric === 'steps' ? `${Math.round(value / 1000)}k` : `${value}`}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(80,219,200,0.08)' }}
                            contentStyle={{
                              background: '#ffffff',
                              border: '1px solid #e7e5e4',
                              borderRadius: '16px',
                              color: '#1c1917',
                            }}
                            formatter={(value) => [`${Math.round(Number(value ?? 0)).toLocaleString()} ${chartLabel}`, 'Value']}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                          />
                          {chartGoal ? (
                            <YAxis hide yAxisId="goal" domain={[0, chartGoal]} />
                          ) : null}
                          <Bar dataKey="value" fill="#50dbc8" radius={[8, 8, 0, 0]} maxBarSize={selectedPeriod === 'month' ? 18 : 28} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-stone-400">Total</div>
                        <div className="mt-1 text-lg font-semibold sm:text-xl">{Math.round(timeSeries.total).toLocaleString()}</div>
                      </div>
                      <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-stone-400">Average</div>
                        <div className="mt-1 text-lg font-semibold sm:text-xl">{Math.round(timeSeries.average).toLocaleString()}</div>
                      </div>
                      <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-stone-400">Source</div>
                        <div className="mt-1 text-sm font-medium sm:text-[15px]">
                          {selectedMetric === 'azm' ? 'Google Health AZM' : selectedMetric === 'steps' ? 'Stored daily steps' : 'Stored active min'}
                        </div>
                      </div>
                    </div>

                  </>
                ) : (
                  <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                    {timeSeriesMessage || 'No time series data available for this selection yet.'}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {!googleHealthConnected && (
          <div className="mt-6">
            <ManualActivityInput
              weekStart={weekStart}
              entries={manualActivityEntries}
              onSaveDay={saveManualActivity}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
