import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import BodyMeasurementsCard from '../components/dashboard/BodyMeasurementsCard';
import { API_URL } from '../config/api';
import { formatFeetInches, kgToLb } from '../utils/units';

interface BodyMeasurements {
  weightKg: number | null;
}

function formatLocalDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function BodyMetricsPage() {
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurements>({ weightKg: null });
  const [googleHealthConnected, setGoogleHealthConnected] = useState(false);
  const [googleHealthWeightKg, setGoogleHealthWeightKg] = useState<number | null>(null);
  const [googleHealthSyncing, setGoogleHealthSyncing] = useState(false);
  const [googleHealthMessage, setGoogleHealthMessage] = useState('');

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
        });
      }
    } catch {
      // ignore
    }
  }, [headers, today]);

  const loadGoogleHealthStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/google-health/status`, { headers });
      const data = await res.json();
      if (data.success && data.connected) {
        setGoogleHealthConnected(true);
        setGoogleHealthWeightKg(data.data?.weightKg ?? null);
      } else {
        setGoogleHealthConnected(false);
        setGoogleHealthWeightKg(null);
      }
    } catch {
      setGoogleHealthConnected(false);
      setGoogleHealthWeightKg(null);
    }
  }, [headers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBodyMeasurements();
      void loadGoogleHealthStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBodyMeasurements, loadGoogleHealthStatus]);

  const saveBodyMeasurements = async ({ weightKg }: BodyMeasurements) => {
    const res = await fetch(`${API_URL}/api/measurements/log`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        date: today,
        weightKg,
        mvpaMinutes: null,
        steps: null,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to save body measurements');
    setBodyMeasurements({ weightKg });
  };

  const syncGoogleHealthWeight = async () => {
    try {
      setGoogleHealthSyncing(true);
      setGoogleHealthMessage('');
      const res = await fetch(`${API_URL}/api/google-health/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Could not sync Google Health weight');
      }

      const nextWeightKg = data.data?.weightKg ?? null;
      setGoogleHealthWeightKg(nextWeightKg);
      if (nextWeightKg !== null) {
        setBodyMeasurements((current) => ({ ...current, weightKg: nextWeightKg }));
        setGoogleHealthMessage('Google Health weight synced. Your latest scale weight is now reflected here.');
      } else {
        setGoogleHealthMessage('Google Health synced, but no scale weight was available yet.');
      }
    } catch (error) {
      setGoogleHealthMessage(error instanceof Error ? error.message : 'Could not sync Google Health weight right now.');
    } finally {
      setGoogleHealthSyncing(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Body Metrics</p>
          <h1 className="mt-1.5 text-[1.75rem] font-semibold tracking-tight text-stone-950">Body Metrics</h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-500">Weekly weight. Height stays in profile.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <BodyMeasurementsCard
            initialWeightKg={bodyMeasurements.weightKg}
            onSave={saveBodyMeasurements}
          />

          <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Reference</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-stone-950">Healthy weight inputs</h2>
            <p className="mt-1.5 text-xs leading-5 sm:text-sm sm:leading-6 text-stone-500">
              Body mass index (BMI) is calculated automatically from your saved weight and profile height.
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
                  {bodyMeasurements.weightKg !== null ? 'Saved' : 'Pending'}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-400">Body metrics status</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-stone-900">Google Health scale weight</div>
                    <div className="mt-1 text-xs leading-5 text-stone-500">
                      If your Fitbit Aria or smart scale has synced to Google Health, we can pull your latest weight into this page.
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    googleHealthConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'
                  }`}>
                    {googleHealthConnected ? 'Connected' : 'Not connected'}
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold tracking-tight text-stone-950">
                      {googleHealthWeightKg !== null ? `${kgToLb(googleHealthWeightKg)?.toFixed(1)} lb` : 'No Google Health weight yet'}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-400">Latest Google Health weight</div>
                  </div>

                  {googleHealthConnected ? (
                    <button
                      onClick={() => void syncGoogleHealthWeight()}
                      disabled={googleHealthSyncing}
                      className="rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60 sm:text-sm"
                    >
                      {googleHealthSyncing ? 'Syncing…' : 'Sync Google Health Weight'}
                    </button>
                  ) : (
                    <Link
                      to="/activity"
                      className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 sm:text-sm"
                    >
                      Connect Google Health
                    </Link>
                  )}
                </div>

                {googleHealthMessage && (
                  <div className="mt-3 text-xs text-stone-600">{googleHealthMessage}</div>
                )}
              </div>

              <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
                <div className="text-sm font-semibold text-stone-900">Scoring rule</div>
                <div className="mt-1 text-xs leading-5 text-stone-500">
                  Healthy weight is now scored from BMI only: 18.5–24.9 = 1, 25–29.9 = 0.5, and &lt;18.5 or ≥30 = 0.
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
