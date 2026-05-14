import { useEffect, useState } from 'react';
import { kgToLb, lbToKg } from '../../utils/units';

interface Props {
  initialWeightKg: number | null;
  onSave: (payload: { weightKg: number | null }) => Promise<void>;
}

export default function BodyMeasurementsCard({ initialWeightKg, onSave }: Props) {
  const [weightLb, setWeightLb] = useState(initialWeightKg !== null ? String(kgToLb(initialWeightKg)) : '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setWeightLb(initialWeightKg !== null ? String(kgToLb(initialWeightKg)) : '');
  }, [initialWeightKg]);

  const handleSave = async () => {
    const parsedWeightLb = weightLb.trim() === '' ? null : parseFloat(weightLb);
    const parsedWeight = parsedWeightLb === null ? null : lbToKg(parsedWeightLb);

    if (parsedWeightLb !== null && Number.isNaN(parsedWeightLb)) {
      setError('Enter a valid numeric value for weight.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave({ weightKg: parsedWeight });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save weight. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Body Measurements</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-stone-950">Weight</h3>
          <p className="mt-1 text-xs leading-5 sm:text-sm text-stone-500">
            Save weight for this week. Height is managed in your profile so BMI updates automatically.
          </p>
        </div>
        <span className="w-fit rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600">
          Weekly
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            Weight (lb)
          </label>
          <input
            type="number"
            min={0}
            step="0.1"
            value={weightLb}
            onChange={(e) => {
              setWeightLb(e.target.value);
              setError(null);
              setSaved(false);
            }}
            placeholder="e.g. 155.4"
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
