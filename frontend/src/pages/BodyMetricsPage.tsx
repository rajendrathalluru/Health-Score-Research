import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import BodyMeasurementsCard from '../components/dashboard/BodyMeasurementsCard';
import { API_URL } from '../config/api';
import { formatFeetInches, kgToLb } from '../utils/units';

interface BodyMeasurements {
  weightKg: number | null;
  waistCm: number | null;
}

function formatLocalDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function BodyMetricsPage() {
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurements>({ weightKg: null, waistCm: null });
  const [fitbitConnected, setFitbitConnected] = useState(false);
  const [fitbitWeightKg, setFitbitWeightKg] = useState<number | null>(null);
  const [fitbitSyncing, setFitbitSyncing] = useState(false);
  const [fitbitMessage, setFitbitMessage] = useState('');

  const token = localStorage.getItem('token');
  const today = formatLocalDateOnly(new Date());
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const loadBodyMeasurements = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/measurements/${today}`, { headers });
      const data = await res.json();
      if (data.success && data.data) {
        setBodyMeasurements({
          weightKg: data.data.weight_kg ?? null,
          waistCm: data.data.waist_cm ?? null,
        });
      }
    } catch {
      // ignore
    }
  }, [headers, today]);

  const loadFitbitStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/fitbit/status`, { headers });
      const data = await res.json();
      if (data.success && data.connected) {
        setFitbitConnected(true);
        setFitbitWeightKg(data.data?.weightKg ?? null);
      } else {
        setFitbitConnected(false);
        setFitbitWeightKg(null);
      }
    } catch {
      setFitbitConnected(false);
      setFitbitWeightKg(null);
    }
  }, [headers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBodyMeasurements();
      void loadFitbitStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBodyMeasurements, loadFitbitStatus]);

  const saveBodyMeasurements = async ({ weightKg, waistCm }: BodyMeasurements) => {
    const res = await fetch(`${API_URL}/api/measurements/log`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        date: today,
        weightKg,
        waistCm,
        mvpaMinutes: null,
        steps: null,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to save body measurements');
    setBodyMeasurements({ weightKg, waistCm });
  };

  const syncFitbitWeight = async () => {
    try {
      setFitbitSyncing(true);
      setFitbitMessage('');
      const res = await fetch(`${API_URL}/api/fitbit/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Could not sync Fitbit weight');
      }

      const nextWeightKg = data.data?.weightKg ?? null;
      setFitbitWeightKg(nextWeightKg);
      if (nextWeightKg !== null) {
        setBodyMeasurements((current) => ({ ...current, weightKg: nextWeightKg }));
        setFitbitMessage('Fitbit weight synced. Your latest scale weight is now reflected here.');
      } else {
        setFitbitMessage('Fitbit synced, but no scale weight was available for today yet.');
      }
    } catch (error) {
      setFitbitMessage(error instanceof Error ? error.message : 'Could not sync Fitbit weight right now.');
    } finally {
      setFitbitSyncing(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Body Metrics</p>
          <h1 className="mt-1.5 text-[1.75rem] font-semibold tracking-tight text-stone-950">Body Metrics</h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-500">Weekly weight and waist. Height stays in profile.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <BodyMeasurementsCard
            initialWeightKg={bodyMeasurements.weightKg}
            initialWaistCm={bodyMeasurements.waistCm}
            onSave={saveBodyMeasurements}
          />

          <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Reference</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-950">Healthy weight inputs</h2>
            <p className="mt-1.5 text-xs leading-5 sm:text-sm sm:leading-6 text-stone-500">
              Weight combines with profile height to calculate BMI. Waist circumference is scored separately using sex-specific thresholds.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] bg-stone-50 p-3">
                <div className="text-sm font-semibold text-stone-900">Profile height</div>
                <div className="mt-1.5 text-xl font-semibold tracking-tight text-stone-950">
                  {storedUser?.height_cm ? formatFeetInches(storedUser.height_cm) : 'Missing'}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-400">Edit in profile</div>
              </div>
              <div className="rounded-[18px] bg-stone-50 p-3">
                <div className="text-sm font-semibold text-stone-900">This week</div>
                <div className="mt-1.5 text-xl font-semibold tracking-tight text-stone-950">
                  {bodyMeasurements.weightKg !== null || bodyMeasurements.waistCm !== null ? 'Saved' : 'Pending'}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-400">Body metrics status</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-stone-900">Fitbit scale weight</div>
                    <div className="mt-1 text-xs leading-5 text-stone-500">
                      If your Aria Air has synced to Fitbit, we can pull today&apos;s weight into this page.
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    fitbitConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'
                  }`}>
                    {fitbitConnected ? 'Connected' : 'Not connected'}
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold tracking-tight text-stone-950">
                      {fitbitWeightKg !== null ? `${kgToLb(fitbitWeightKg)?.toFixed(1)} lb` : 'No Fitbit weight yet'}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-400">Latest Fitbit weight</div>
                  </div>

                  {fitbitConnected ? (
                    <button
                      onClick={() => void syncFitbitWeight()}
                      disabled={fitbitSyncing}
                      className="rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60 sm:text-sm"
                    >
                      {fitbitSyncing ? 'Syncing…' : 'Sync Fitbit Weight'}
                    </button>
                  ) : (
                    <Link
                      to="/activity"
                      className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 sm:text-sm"
                    >
                      Connect Fitbit
                    </Link>
                  )}
                </div>

                {fitbitMessage && (
                  <div className="mt-3 text-xs text-stone-600">{fitbitMessage}</div>
                )}
              </div>

              <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
                <div className="text-sm font-semibold text-stone-900">Scoring rule</div>
                <div className="mt-1 text-xs leading-5 text-stone-500">
                  Healthy weight combines BMI and waist circumference. Save this week&apos;s values so the dashboard uses the current week first.
                </div>
              </div>
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 sm:text-sm"
              >
                Profile Height
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
