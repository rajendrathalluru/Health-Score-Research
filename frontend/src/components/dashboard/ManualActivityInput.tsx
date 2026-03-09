import { useState } from 'react';

interface Props {
  onSave: (mvpaMinutes: number) => Promise<void>;
  savedMinutes: number | null;
}

export default function ManualActivityInput({ onSave, savedMinutes }: Props) {
  const [minutes, setMinutes] = useState(savedMinutes !== null ? String(savedMinutes) : '');
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleSave = async () => {
    const val = parseInt(minutes, 10);
    if (isNaN(val) || val < 0) {
      setError('Please enter a valid number of minutes (0 or more).');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSave(val);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // MVPA guidance helper
  const getGuidance = (min: number) => {
    if (min >= 150) return { label: 'Goal met', color: 'text-green-600 bg-green-50 border-green-200' };
    if (min >= 75)  return { label: `${150 - min} min to goal`, color: 'text-amber-600 bg-amber-50 border-amber-200' };
    if (min > 0)    return { label: `${150 - min} min to goal`, color: 'text-red-600 bg-red-50 border-red-200' };
    return null;
  };

  const parsed   = parseInt(minutes, 10);
  const guidance = !isNaN(parsed) && parsed >= 0 ? getGuidance(parsed) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Physical Activity</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Manual entry — connect Fitbit to sync automatically
          </p>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
          Manual
        </span>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-gray-600">
            Moderate-to-Vigorous Activity this week
          </label>
          <span className="text-xs text-gray-400">minutes</span>
        </div>
        <input
          type="number"
          min={0}
          placeholder="e.g. 150"
          value={minutes}
          onChange={e => { setMinutes(e.target.value); setError(null); setSaved(false); }}
          className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all"
        />
        <p className="text-xs text-gray-400 mt-1.5">
          Brisk walking, cycling, swimming, gym, sport — anything that raises your heart rate.
          WCRF goal: 150+ min/week.
        </p>
      </div>

      {/* Live guidance badge */}
      {guidance && (
        <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg border mb-3 inline-block ${guidance.color}`}>
          {guidance.label}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mb-3">{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving || minutes === ''}
        className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all
          ${saved
            ? 'bg-green-600 text-white'
            : saving
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : 'bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-40'}`}
      >
        {saved ? 'Saved' : saving ? 'Saving...' : savedMinutes !== null ? 'Update Activity' : 'Save Activity'}
      </button>
    </div>
  );
}