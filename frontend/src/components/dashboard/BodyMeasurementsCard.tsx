import { useEffect, useState } from 'react';

interface Props {
  initialWeightKg: number | null;
  initialWaistCm: number | null;
  onSave: (payload: { weightKg: number | null; waistCm: number | null }) => Promise<void>;
}

export default function BodyMeasurementsCard({ initialWeightKg, initialWaistCm, onSave }: Props) {
  const [weightKg, setWeightKg] = useState(initialWeightKg !== null ? String(initialWeightKg) : '');
  const [waistCm, setWaistCm] = useState(initialWaistCm !== null ? String(initialWaistCm) : '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWeightKg(initialWeightKg !== null ? String(initialWeightKg) : '');
    setWaistCm(initialWaistCm !== null ? String(initialWaistCm) : '');
  }, [initialWeightKg, initialWaistCm]);

  const handleSave = async () => {
    const parsedWeight = weightKg.trim() === '' ? null : parseFloat(weightKg);
    const parsedWaist = waistCm.trim() === '' ? null : parseFloat(waistCm);

    if ((parsedWeight !== null && Number.isNaN(parsedWeight)) || (parsedWaist !== null && Number.isNaN(parsedWaist))) {
      setError('Enter valid numeric values for weight and waist circumference.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave({ weightKg: parsedWeight, waistCm: parsedWaist });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save body measurements. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Body Measurements</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-stone-950">Weight and Waist</h3>
          <p className="mt-1 text-xs leading-5 sm:text-sm text-stone-500">
            Save weight and waist for this week. Height is managed in your profile.
          </p>
        </div>
        <span className="w-fit rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600">
          Weekly
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Weight (kg)
          </label>
          <input
            type="number"
            min={0}
            step="0.1"
            value={weightKg}
            onChange={(e) => {
              setWeightKg(e.target.value);
              setError(null);
              setSaved(false);
            }}
            placeholder="e.g. 70.5"
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-stone-400"
          />
        </div>

        <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Waist Circumference (cm)
          </label>
          <input
            type="number"
            min={0}
            step="0.1"
            value={waistCm}
            onChange={(e) => {
              setWaistCm(e.target.value);
              setError(null);
              setSaved(false);
            }}
            placeholder="e.g. 85"
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-stone-400"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-rose-600">{error}</p>
      )}

      <button
        onClick={() => void handleSave()}
        disabled={saving}
        className={`mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
          saved
            ? 'bg-emerald-600 text-white'
            : saving
              ? 'cursor-not-allowed bg-stone-400 text-white'
              : 'bg-stone-900 text-white hover:bg-stone-800'
        }`}
      >
        {saved ? 'Saved' : saving ? 'Saving...' : 'Save Measurements'}
      </button>
    </div>
  );
}
