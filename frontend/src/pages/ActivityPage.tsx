import { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import ManualActivityInput from '../components/dashboard/ManualActivityInput';
import { API_URL } from '../config/api';

function getCurrentWeekStart(): string {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - diff);
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().split('T')[0];
}

interface FitbitSyncData {
  steps: number;
  activeMinutes: number;
  caloriesBurned: number;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  waistCm: number | null;
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

export default function ActivityPage() {
  const [fitbitConnected, setFitbitConnected] = useState(false);
  const [fitbitLoading, setFitbitLoading] = useState(true);
  const [fitbitData, setFitbitData] = useState<FitbitSyncData | null>(null);
  const [manualActivityEntries, setManualActivityEntries] = useState<ManualActivityEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const token = localStorage.getItem('token');
  const weekStart = getCurrentWeekStart();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    void checkFitbitStatus();
    void loadManualActivity();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fitbitStatus = params.get('fitbit');

    if (fitbitStatus === 'connected') {
      setSyncMessage('Fitbit connected successfully!');
      void checkFitbitStatus();
      window.history.replaceState({}, '', '/activity');
    } else if (fitbitStatus === 'already_linked') {
      setSyncMessage('This Fitbit account is already linked to a different HealthScore account.');
      window.history.replaceState({}, '', '/activity');
    } else if (fitbitStatus === 'error') {
      setSyncMessage('Fitbit connection failed. Please try again.');
      window.history.replaceState({}, '', '/activity');
    }
  }, []);

  const checkFitbitStatus = async () => {
    try {
      setFitbitLoading(true);
      const res = await fetch(`${API_URL}/api/fitbit/status`, { headers });
      const data = await res.json();
      if (data.success && data.connected) {
        setFitbitConnected(true);
      } else {
        setFitbitConnected(false);
        setFitbitData(null);
      }
    } catch {
      setFitbitConnected(false);
    } finally {
      setFitbitLoading(false);
    }
  };

  const loadManualActivity = async () => {
    try {
      const res = await fetch(`${API_URL}/api/measurements/activity?weekStart=${weekStart}`, { headers });
      const data = await res.json();
      if (data.success) setManualActivityEntries(data.data.entries ?? []);
    } catch {
      // ignore
    }
  };

  const connectFitbit = async () => {
    try {
      setSyncMessage('Redirecting to Fitbit...');
      const res = await fetch(`${API_URL}/api/fitbit/auth-url`, { headers });
      const data = await res.json();
      if (!res.ok || !data.success || !data.authUrl) {
        throw new Error(data.message || 'Failed to start Fitbit connection');
      }
      window.location.assign(data.authUrl);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Could not connect to Fitbit. Please try again.');
    }
  };

  const switchFitbitAccount = () => {
    window.open('https://dev.fitbit.com/logout', '_blank', 'noopener,noreferrer');
    setSyncMessage('Fitbit logout opened in a new tab. Sign out there, then return here and connect again.');
  };

  const syncFitbit = async () => {
    try {
      setSyncing(true);
      setSyncMessage('');
      const res = await fetch(`${API_URL}/api/fitbit/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setFitbitData(data.data);
        setSyncMessage(`Synced current week — ${data.data.steps.toLocaleString()} steps · ${data.data.activeMinutes} active mins`);
        await loadManualActivity();
      } else {
        setSyncMessage(`Sync failed: ${data.error || data.message}`);
      }
    } catch {
      setSyncMessage('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const disconnectFitbit = async () => {
    try {
      const res = await fetch(`${API_URL}/api/fitbit/disconnect`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to disconnect Fitbit');
      }
      setFitbitConnected(false);
      setFitbitData(null);
      setSyncMessage('Fitbit disconnected from this app. Reconnect may complete automatically if Fitbit is still signed in in this browser.');
    } catch {
      setSyncMessage('Could not disconnect Fitbit. Please try again.');
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
  const activityTotal = fitbitConnected && fitbitData ? fitbitData.activeMinutes : totalManualMinutes;
  const goalPercent = Math.min(100, Math.round((activityTotal / 150) * 100));

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Activity</p>
          <h1 className="mt-1.5 text-[1.75rem] font-semibold tracking-tight text-stone-950">Activity</h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-500">Fitbit sync with manual fallback for the current week.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  fitbitConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                }`}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="8" cy="7" r="1.2" />
                    <circle cx="12" cy="7" r="1.2" />
                    <circle cx="16" cy="7" r="1.2" />
                    <circle cx="10" cy="11" r="1.2" />
                    <circle cx="14" cy="11" r="1.2" />
                    <circle cx="8" cy="15" r="1.2" />
                    <circle cx="12" cy="15" r="1.2" />
                    <circle cx="16" cy="15" r="1.2" />
                  </svg>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Fitbit</p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      fitbitLoading
                        ? 'bg-stone-100 text-stone-600'
                        : fitbitConnected
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-stone-100 text-stone-600'
                    }`}>
                      {fitbitLoading ? 'Checking' : fitbitConnected ? 'Connected' : 'Manual'}
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-950">
                    {fitbitLoading ? 'Checking Fitbit state' : fitbitConnected ? 'Fitbit is linked' : 'Connect Fitbit'}
                  </h2>
                  <p className="mt-1 max-w-xl text-xs leading-5 sm:text-sm text-stone-500">
                    {fitbitLoading
                      ? 'Loading your current Fitbit connection.'
                      : fitbitConnected
                        ? syncMessage || 'Sync current-week activity and steps from Fitbit.'
                        : syncMessage || 'Use Fitbit as the primary source. Manual entries fill days Fitbit does not cover.'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {fitbitLoading ? (
                  <button disabled className="rounded-xl bg-stone-200 px-3.5 py-2.5 text-xs font-semibold text-stone-500 sm:text-sm">
                    Checking...
                  </button>
                ) : fitbitConnected ? (
                  <>
                    <button
                      onClick={syncFitbit}
                      disabled={syncing}
                      className="rounded-xl bg-stone-900 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 sm:text-sm"
                    >
                      {syncing ? 'Syncing...' : 'Sync Fitbit'}
                    </button>
                    <button
                      onClick={disconnectFitbit}
                      className="rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 sm:text-sm"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={connectFitbit}
                      className="rounded-xl bg-blue-700 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 sm:text-sm"
                    >
                      Connect Fitbit
                    </button>
                    <button
                      onClick={switchFitbitAccount}
                      className="rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 sm:text-sm"
                    >
                      Use Different Fitbit
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Status', value: fitbitLoading ? 'Checking' : fitbitConnected ? 'Connected' : 'Manual' },
                { label: 'Steps', value: fitbitConnected && fitbitData ? fitbitData.steps.toLocaleString() : 'Not synced' },
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
                      {fitbitConnected ? 'Fitbit leads. Manual fills missing days.' : 'Manual logging is active.'}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    fitbitConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-700'
                  }`}>
                    {fitbitConnected ? 'Fitbit' : 'Manual'}
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
                      {fitbitConnected && fitbitData ? fitbitData.steps.toLocaleString() : totalManualMinutes.toString()}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400">
                      {fitbitConnected ? 'Steps' : 'Manual total'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
                <div className="text-sm font-semibold text-stone-900">Scoring note</div>
                <div className="mt-1 text-xs leading-5 text-stone-500">
                  Weekly activity score uses current-week total minutes. Fitbit data is used when present for a given day; manual entries cover the rest.
                </div>
              </div>
            </div>
          </div>
        </div>

        {!fitbitConnected && (
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
