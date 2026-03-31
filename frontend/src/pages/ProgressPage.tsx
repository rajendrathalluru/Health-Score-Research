import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Layout from '../components/layout/Layout';
import { API_BASE } from '../config/api';
import { cmToInches, kgToLb } from '../utils/units';

interface ScorePoint {
  isoDate: string;
  date: string;
  score: number;
  maxScore: number;
  risk: string;
}

interface BodyPoint {
  isoDate: string;
  date: string;
  weight: number | null;
  waist: number | null;
  bmi: number | null;
}

interface ActivityPoint {
  isoDate: string;
  date: string;
  mvpa: number;
  steps: number;
}

interface RawScoreItem {
  week_start_date?: unknown;
  total_score?: unknown;
  max_possible_score?: unknown;
  risk_level?: unknown;
}

interface RawBodyItem {
  date?: unknown;
  weight_kg?: unknown;
  waist_cm?: unknown;
  bmi?: unknown;
}

interface RawActivityItem {
  date?: unknown;
  mvpa_minutes?: unknown;
  steps?: unknown;
}

function normalizeDateValue(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateLabel(value: unknown, withYear = false) {
  const parsed = normalizeDateValue(value);
  if (!parsed) return 'Invalid date';

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

function formatSignedDelta(value: number) {
  if (value === 0) return 'No change';
  const abs = Math.abs(value).toFixed(1);
  return value > 0 ? `+${abs}` : `-${abs}`;
}

function formatStepTick(value: number) {
  if (value >= 1000) {
    const compact = value % 1000 === 0 ? (value / 1000).toFixed(0) : (value / 1000).toFixed(1);
    return `${compact}k`;
  }
  return `${value}`;
}

function getCurrentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthRange(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number);
  if (!year || !month) return null;

  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  return { start, end };
}

export default function ProgressPage() {
  const [scoreHistory, setScoreHistory] = useState<ScorePoint[]>([]);
  const [bodyHistory, setBodyHistory] = useState<BodyPoint[]>([]);
  const [activityHistory, setActivityHistory] = useState<ActivityPoint[]>([]);
  const [days, setDays] = useState(30);
  const [filterMode, setFilterMode] = useState<'range' | 'month'>('range');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('token');
  const headers = useMemo<Record<string, string>>(() => {
    const nextHeaders: Record<string, string> = {};
    if (token) {
      nextHeaders.Authorization = `Bearer ${token}`;
    }
    return nextHeaders;
  }, [token]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const monthRange = filterMode === 'month' ? getMonthRange(selectedMonth) : null;
      const query =
        monthRange
          ? `start=${encodeURIComponent(monthRange.start)}&end=${encodeURIComponent(monthRange.end)}`
          : `days=${days}`;

      const [scoresRes, bodyRes, activityRes] = await Promise.all([
        fetch(`${API_BASE}/progress/scores?${query}`, { headers }),
        fetch(`${API_BASE}/progress/body-metrics?${query}`, { headers }),
        fetch(`${API_BASE}/progress/activity?${query}`, { headers }),
      ]);

      const [scoresData, bodyData, activityData] = await Promise.all([
        scoresRes.json(),
        bodyRes.json(),
        activityRes.json(),
      ]);

      if (!scoresRes.ok || !bodyRes.ok || !activityRes.ok) {
        throw new Error(
          scoresData.message || bodyData.message || activityData.message || 'Failed to load progress data'
        );
      }

      setScoreHistory(
        ((scoresData.data ?? []) as RawScoreItem[]).map((item) => ({
          isoDate: String(item.week_start_date ?? ''),
          date: formatDateLabel(item.week_start_date),
          score: Number(item.total_score ?? 0),
          maxScore: Number(item.max_possible_score ?? 7),
          risk: typeof item.risk_level === 'string' ? item.risk_level : 'High',
        }))
      );

      setBodyHistory(
        ((bodyData.data ?? []) as RawBodyItem[]).map((item) => ({
          isoDate: String(item.date ?? ''),
          date: formatDateLabel(item.date),
          weight: item.weight_kg !== null && item.weight_kg !== undefined ? kgToLb(Number(item.weight_kg)) : null,
          waist: item.waist_cm !== null && item.waist_cm !== undefined ? cmToInches(Number(item.waist_cm)) : null,
          bmi: item.bmi !== null && item.bmi !== undefined ? Number(item.bmi) : null,
        }))
      );

      setActivityHistory(
        ((activityData.data ?? []) as RawActivityItem[]).map((item) => ({
          isoDate: String(item.date ?? ''),
          date: formatDateLabel(item.date),
          mvpa: Number(item.mvpa_minutes ?? 0),
          steps: Number(item.steps ?? 0),
        }))
      );
    } catch (fetchError) {
      console.error('Failed to fetch progress history:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load progress data');
    } finally {
      setLoading(false);
    }
  }, [days, filterMode, headers, selectedMonth]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const summary = useMemo(() => {
    const latestScore = scoreHistory[scoreHistory.length - 1] ?? null;
    const previousScore = scoreHistory.length > 1 ? scoreHistory[scoreHistory.length - 2] : null;
    const latestBody = [...bodyHistory].reverse().find((item) => item.weight !== null || item.waist !== null) ?? null;
    const activityTotal = activityHistory.reduce((sum, item) => sum + item.mvpa, 0);
    const avgActivity = activityHistory.length ? Math.round(activityTotal / activityHistory.length) : 0;
    const totalScore = scoreHistory.reduce((sum, item) => sum + item.score, 0);
    const avgScore = scoreHistory.length ? Number((totalScore / scoreHistory.length).toFixed(1)) : null;

    return {
      latestScore,
      scoreDelta: latestScore && previousScore ? latestScore.score - previousScore.score : 0,
      latestBody,
      activityTotal,
      avgActivity,
      avgScore,
    };
  }, [activityHistory, bodyHistory, scoreHistory]);

  const hasAnyData = scoreHistory.length || bodyHistory.length || activityHistory.length;

  return (
    <Layout>
      <div className="min-h-screen bg-stone-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Progress</p>
              <h1 className="mt-1.5 text-[1.75rem] font-semibold tracking-tight text-stone-950 sm:text-[2rem]">Progress</h1>
              <p className="mt-1 text-xs sm:text-sm text-stone-500">Weekly score trend, activity history, and body metrics from the current data model.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setFilterMode('range')}
                  className={`rounded-lg px-3 py-1.5 text-sm ${filterMode === 'range' ? 'bg-stone-950 text-white' : 'text-stone-600'}`}
                >
                  By range
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('month')}
                  className={`rounded-lg px-3 py-1.5 text-sm ${filterMode === 'month' ? 'bg-stone-950 text-white' : 'text-stone-600'}`}
                >
                  By month
                </button>
              </div>
              {filterMode === 'range' ? (
                <select
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value, 10))}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-400"
                >
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                </select>
              ) : (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 outline-none focus:border-stone-400"
                />
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-stone-200 bg-white">
              <div className="flex items-center gap-3 text-stone-500">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-stone-700" />
                Loading progress data...
              </div>
            </div>
          ) : !hasAnyData ? (
            <div className="rounded-[24px] border border-stone-200 bg-white px-6 py-14 text-center">
              <h2 className="text-lg font-semibold text-stone-950">No progress data yet</h2>
              <p className="mt-2 text-sm text-stone-500">
                Complete a weekly questionnaire and log activity or body metrics to start seeing trends here.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-[20px] border border-stone-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Latest score</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-3xl font-semibold tracking-tight text-stone-950">
                      {summary.latestScore ? summary.latestScore.score.toFixed(1) : '—'}
                    </span>
                    <span className="pb-1 text-sm text-stone-400">
                      / {summary.latestScore?.maxScore ?? 7}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-stone-500">
                    {summary.latestScore ? `${summary.latestScore.risk} risk · ${formatSignedDelta(summary.scoreDelta)} vs prior entry` : 'No weekly score yet'}
                  </div>
                </div>

                <div className="rounded-[20px] border border-stone-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Activity average</p>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">{summary.avgActivity}</div>
                  <div className="mt-1 text-xs text-stone-500">Average active minutes per logged day in this range</div>
                </div>

                <div className="rounded-[20px] border border-stone-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Latest body entry</p>
                    <div className="mt-2 text-lg font-semibold tracking-tight text-stone-950">
                      {summary.latestBody?.weight !== null && summary.latestBody?.weight !== undefined
                      ? `${summary.latestBody.weight.toFixed(1)} lb`
                      : '—'}
                    </div>
                  <div className="mt-1 text-xs text-stone-500">
                    {summary.latestBody?.waist !== null && summary.latestBody?.waist !== undefined
                      ? `Waist ${summary.latestBody.waist.toFixed(1)} in`
                      : 'No waist saved yet'}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex flex-col gap-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Weekly score</p>
                    <h2 className="text-lg font-semibold tracking-tight text-stone-950">Score trend</h2>
                    <p className="text-sm text-stone-500">
                      Shows the actual weekly questionnaire score stored for each completed week.
                      {summary.avgScore !== null ? ` Average score in this range: ${summary.avgScore.toFixed(1)}.` : ''}
                    </p>
                  </div>
                  <div className="h-[280px] sm:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={scoreHistory}>
                        <defs>
                          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0f172a" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#0f172a" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#e7e5e4" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#78716c', fontSize: 12 }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 7]} tick={{ fill: '#78716c', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <Tooltip
                            formatter={(value) => [`${Number(value ?? 0).toFixed(1)} / 7`, 'Score']}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.isoDate ? formatDateLabel(payload[0].payload.isoDate, true) : ''}
                          />
                        <ReferenceLine y={3.5} stroke="#f59e0b" strokeDasharray="4 4" />
                        <ReferenceLine y={5.25} stroke="#16a34a" strokeDasharray="4 4" />
                        {summary.avgScore !== null && (
                          <ReferenceLine
                            y={summary.avgScore}
                            stroke="#2563eb"
                            strokeDasharray="6 6"
                            label={{
                              value: `Avg ${summary.avgScore.toFixed(1)}`,
                              position: 'insideTopRight',
                              fill: '#2563eb',
                              fontSize: 12,
                            }}
                          />
                        )}
                        <Area type="monotone" dataKey="score" stroke="#111827" strokeWidth={2.5} fill="url(#scoreFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex flex-col gap-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Activity</p>
                      <h2 className="text-lg font-semibold tracking-tight text-stone-950">Daily activity trend</h2>
                      <p className="text-sm text-stone-500">Bars show active minutes on the left axis. The amber line shows steps on the right axis.</p>
                    </div>
                    <div className="h-[280px] sm:h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={activityHistory}>
                          <CartesianGrid stroke="#e7e5e4" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: '#78716c', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis
                            yAxisId="left"
                            tick={{ fill: '#78716c', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            label={{ value: 'Minutes', angle: -90, position: 'insideLeft', fill: '#78716c', fontSize: 11, dy: 34 }}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fill: '#78716c', fontSize: 12 }}
                            tickFormatter={formatStepTick}
                            tickLine={false}
                            axisLine={false}
                            label={{ value: 'Steps', angle: 90, position: 'insideRight', fill: '#78716c', fontSize: 11, dy: -34 }}
                          />
                          <Tooltip
                            formatter={(value, name) => {
                              const numeric = Number(value ?? 0);
                              const isSteps = name === 'Steps' || name === 'steps';
                              return [isSteps ? numeric.toLocaleString() : `${numeric} min`, isSteps ? 'Steps' : 'Active minutes'];
                            }}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.isoDate ? formatDateLabel(payload[0].payload.isoDate, true) : ''}
                          />
                          <Legend />
                          <Bar yAxisId="left" dataKey="mvpa" fill="#111827" radius={[6, 6, 0, 0]} name="Active minutes" />
                          <Line yAxisId="right" type="monotone" dataKey="steps" stroke="#d97706" strokeWidth={2} dot={false} name="Steps" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="mb-4 flex flex-col gap-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Body metrics</p>
                      <h2 className="text-lg font-semibold tracking-tight text-stone-950">Weight and waist trend</h2>
                      <p className="text-sm text-stone-500">Latest saved body metrics in this date range. BMI is shown in the tooltip.</p>
                    </div>
                    <div className="h-[280px] sm:h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={bodyHistory}>
                          <CartesianGrid stroke="#e7e5e4" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: '#78716c', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="left" tick={{ fill: '#78716c', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#78716c', fontSize: 12 }} tickLine={false} axisLine={false} />
                          <Tooltip
                            formatter={(value, name) => {
                              const numeric = Number(value ?? 0);
                              if (name === 'Weight') return [`${numeric.toFixed(1)} lb`, name];
                              if (name === 'Waist') return [`${numeric.toFixed(1)} in`, name];
                              return [numeric, name];
                            }}
                            labelFormatter={(_, payload) => {
                              const row = payload?.[0]?.payload;
                              if (!row?.isoDate) return '';
                              const bmiLabel = row.bmi !== null && row.bmi !== undefined ? ` · BMI ${row.bmi.toFixed(1)}` : '';
                              return `${formatDateLabel(row.isoDate, true)}${bmiLabel}`;
                            }}
                          />
                          <Legend />
                          <Line yAxisId="left" type="monotone" dataKey="weight" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 3 }} name="Weight" connectNulls />
                          <Line yAxisId="right" type="monotone" dataKey="waist" stroke="#b45309" strokeWidth={2.5} dot={{ r: 3 }} name="Waist" connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
