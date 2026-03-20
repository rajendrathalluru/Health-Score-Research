import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import BodyMeasurementsCard from '../components/dashboard/BodyMeasurementsCard';
import { API_URL } from '../config/api';
import { formatFeetInches } from '../utils/units';

interface BodyMeasurements {
  weightKg: number | null;
  waistCm: number | null;
}

export default function BodyMetricsPage() {
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurements>({ weightKg: null, waistCm: null });

  const token = localStorage.getItem('token');
  const today = new Date().toISOString().split('T')[0];
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  useEffect(() => {
    void loadBodyMeasurements();
  }, []);

  const loadBodyMeasurements = async () => {
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
  };

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

            <div className="mt-4 space-y-2">
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
