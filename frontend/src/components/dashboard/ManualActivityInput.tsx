import { useEffect, useMemo, useRef, useState } from 'react';

interface DayEntry {
  date: string;
  mvpa_minutes: number;
}

interface Props {
  weekStart: string;
  entries: DayEntry[];
  onSaveDay: (date: string, mvpaMinutes: number) => Promise<void>;
}

function getWeekDates(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00`);
  const dates: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const next = new Date(start);
    next.setDate(start.getDate() + i);
    dates.push(next.toISOString().split('T')[0]);
  }
  return dates;
}

function formatSelectedDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function ManualActivityInput({ weekStart, entries, onSaveDay }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.date, entry.mvpa_minutes])), [entries]);
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.mvpa_minutes, 0);

  const [selectedDate, setSelectedDate] = useState<string>(weekDates[0]);
  const [minutes, setMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!weekDates.includes(selectedDate)) {
      setSelectedDate(weekDates[0]);
    }
  }, [selectedDate, weekDates]);

  useEffect(() => {
    const existing = entryMap.get(selectedDate);
    setMinutes(existing !== undefined ? String(existing) : '');
    setSaved(false);
  }, [selectedDate, entryMap]);

  const guidance = totalMinutes >= 150
    ? { label: 'Goal met', color: 'text-green-600 bg-green-50 border-green-200' }
    : totalMinutes >= 75
      ? { label: `${150 - totalMinutes} min to goal`, color: 'text-amber-600 bg-amber-50 border-amber-200' }
      : totalMinutes > 0
        ? { label: `${150 - totalMinutes} min to goal`, color: 'text-red-600 bg-red-50 border-red-200' }
        : null;

  const selectedLoggedMinutes = entryMap.get(selectedDate) ?? 0;
  const loggedDaysCount = entries.filter((entry) => entry.mvpa_minutes > 0).length;

  const openCalendar = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.click();
    }
  };

  const handleSave = async () => {
    const value = parseInt(minutes, 10);
    if (Number.isNaN(value) || value < 0) {
      setError('Please enter 0 or more minutes for the selected date.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSaveDay(selectedDate, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save activity. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Physical Activity</p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-stone-950">Manual Activity Log</h3>
          <p className="mt-1 text-xs leading-5 sm:text-sm text-stone-500">
            Select a day from the current week and record activity minutes.
          </p>
        </div>
        <span className="w-fit rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600">
          Manual
        </span>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-[18px] border border-stone-200 bg-stone-50 p-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Current week total</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-stone-950">{totalMinutes} min</p>
          <p className="mt-1 text-xs text-stone-400">{loggedDaysCount} day{loggedDaysCount === 1 ? '' : 's'} logged</p>
        </div>
        {guidance && (
          <div className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${guidance.color}`}>
            {guidance.label}
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-[18px] border border-stone-200 bg-stone-50 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Selected Date</p>
            <p className="mt-1 text-base font-semibold text-stone-950">{formatSelectedDate(selectedDate)}</p>
          </div>
          <button
            type="button"
            onClick={openCalendar}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 sm:w-auto"
          >
            <svg className="h-4 w-4 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10m-12 9h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2Z" />
            </svg>
            Choose Date
          </button>
          <input
            ref={inputRef}
            type="date"
            min={weekDates[0]}
            max={weekDates[weekDates.length - 1]}
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setError(null);
            }}
            className="sr-only"
          />
        </div>

        <div>
          <div className="mb-1.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              Activity minutes for {formatSelectedDate(selectedDate)}
            </label>
            <span className="text-xs text-stone-400">
              {selectedLoggedMinutes > 0 ? `Saved: ${selectedLoggedMinutes} min` : 'No entry yet'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              value={minutes}
              placeholder="0"
              onChange={(e) => {
                setMinutes(e.target.value);
                setError(null);
                setSaved(false);
              }}
              className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-stone-400"
            />
            <span className="w-10 text-xs text-stone-400">min</span>
          </div>
        </div>

        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
            saved
              ? 'bg-emerald-600 text-white'
              : saving
                ? 'cursor-not-allowed bg-stone-400 text-white'
                : 'bg-stone-900 text-white hover:bg-stone-800'
          }`}
        >
          {saved ? 'Saved' : saving ? 'Saving...' : 'Save Activity'}
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-stone-400">
        Brisk walking, cycling, swimming, gym, or sport all count. You can only choose dates in the current week.
      </p>

      {error && (
        <p className="mt-3 text-xs text-rose-600">{error}</p>
      )}
    </div>
  );
}
