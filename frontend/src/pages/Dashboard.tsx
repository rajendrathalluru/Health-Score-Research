import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import MainScoreDisplay from '../components/dashboard/MainScoreDisplay';
import ScoreCard from '../components/dashboard/ScoreCard';
import StatCard from '../components/dashboard/StatCard';
import { API_URL } from '../config/api';

// Monday of the current week (YYYY-MM-DD)
function getCurrentWeekStart(): string {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - diff);
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().split('T')[0];
}

interface WeeklyScoreRow {
  total_score:        string | number | null;
  max_possible_score: number | null;
  weight_score?:      string | number | null;
  plant_score?:       string | number | null;
  upf_score?:         string | number | null;
  meat_score?:        string | number | null;
  ssb_score?:         string | number | null;
  alcohol_score?:     string | number | null;
  activity_score?:    string | number | null;
  components?:        Record<string, number | null>;
  days_answered?:     number | null;
  days_logged:        number;
  risk_level:         string | null;
  calculated_at:      string | null;
}

interface FitbitSyncData {
  steps:          number;
  activeMinutes:  number;
  caloriesBurned: number;
  weightKg:       number | null;
  heightCm:       number | null;
  bmi:            number | null;
  sources: {
    weight:   string | null;
    activity: string;
    bmi:      string;
  };
}

interface ManualActivityEntry {
  date: string;
  mvpa_minutes: number;
}

function ActivityIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h4l2.2-4.5L14 17l2.2-4H20" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16" />
    </svg>
  );
}

function BodyMetricsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 5v14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 5v14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h3M14 8h3M7 12h5M12 16h5" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function WeeklyLogIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3M16 3v3M4 9h16" />
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 14 2 2 4-4" />
    </svg>
  );
}

export default function Dashboard() {
  const [scoreData, setScoreData]             = useState<WeeklyScoreRow | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [fitbitConnected, setFitbitConnected] = useState(false);
  const [fitbitData, setFitbitData]           = useState<FitbitSyncData | null>(null);
  const [manualActivityEntries, setManualActivityEntries] = useState<ManualActivityEntry[]>([]);

  const token     = localStorage.getItem('token');
  const weekStart = getCurrentWeekStart();

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const p = (v: string | number | null | undefined): number =>
    v === null || v === undefined ? 0 : parseFloat(String(v)) || 0;

  const loadWeeklyScore = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res  = await fetch(`${API_URL}/api/weekly-score?weekStart=${weekStart}`, { headers });
      const data = await res.json();
      if (data.success && data.data) setScoreData(data.data);
    } catch (err) {
      console.error('Failed to load weekly score:', err);
      setError('Could not load your score. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [headers, weekStart]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const res  = await fetch(`${API_URL}/api/weekly-score`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ weekStart }),
      });
      const data = await res.json();
      if (data.success && data.data) setScoreData(data.data);
      else setError(data.message || 'Failed to refresh score.');
    } catch {
      setError('Failed to refresh score. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // ── Fitbit ────────────────────────────────────────────────────────────────
  const checkFitbitStatus = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/api/fitbit/status`, { headers });
      const data = await res.json();
      if (data.success && data.connected) {
        setFitbitConnected(true);
        setFitbitData(data.data ?? null);
      } else {
        setFitbitConnected(false);
        setFitbitData(null);
      }
    } catch (err) {
      console.error('Failed to check Fitbit status:', err);
      setFitbitConnected(false);
      setFitbitData(null);
    }
  }, [headers]);

  // ── Manual activity ───────────────────────────────────────────────────────
  const loadManualActivity = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/api/measurements/activity?weekStart=${weekStart}`, { headers });
      const data = await res.json();
      if (data.success) {
        setManualActivityEntries(data.data.entries ?? []);
      }
    } catch (err) {
      console.error('Failed to load manual activity:', err);
    }
  }, [headers, weekStart]);

  // ── On mount: load score + check Fitbit status ─────────────────────────────
  useEffect(() => {
    void loadWeeklyScore();
    void checkFitbitStatus();
    void loadManualActivity();
  }, [loadWeeklyScore, checkFitbitStatus, loadManualActivity]);

  // ── Handle Fitbit OAuth redirect params ───────────────────────────────────
  useEffect(() => {
    const params     = new URLSearchParams(window.location.search);
    const fitbitStatus = params.get('fitbit');

    if (fitbitStatus === 'connected') {
      void checkFitbitStatus();
      window.history.replaceState({}, '', '/dashboard');
    } else if (fitbitStatus === 'error') {
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [checkFitbitStatus]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center min-h-64">
          <div className="flex items-center gap-3 text-gray-500">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            Loading your weekly score...
          </div>
        </div>
      </Layout>
    );
  }

  const currentScore = p(scoreData?.total_score);
  const maxScore     = scoreData?.max_possible_score ?? 7;
  const riskLevel    = scoreData?.risk_level ?? null;
  const weekLabel = `Week of ${new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })}`;
  const answeredCount = scoreData?.days_answered ?? 0;
  const questionnaireProgress = `${answeredCount}/9`;
  const activityThisWeek = fitbitConnected && fitbitData
    ? fitbitData.activeMinutes
    : manualActivityEntries.reduce((sum, entry) => sum + Number(entry.mvpa_minutes || 0), 0);
  const syncedStepCount = fitbitData?.steps ?? 0;
  const questionLabels: Record<string, { title: string; desc: string }> = {
    weight_score: { title: 'Healthy Weight', desc: 'BMI-based healthy weight thresholds' },
    activity_score: { title: 'Physical Activity', desc: 'Total active minutes per week' },
    plant_based_score: { title: 'Plant-Based Foods', desc: 'Average of fruit & vegetables, pulses, and whole grains' },
    fast_processed_score: { title: 'Fast/Processed Foods', desc: 'fast foods and sweets/pastries' },
    red_processed_meat_score: { title: 'Red & Processed Meat', desc: 'Weekly red meat and processed meat pattern' },
    sugary_drinks_score: { title: 'Sugary Drinks', desc: 'Sugar-sweetened drink frequency' },
    alcohol_score: { title: 'Alcohol', desc: 'Alcohol intake frequency (sex-specific threshold)' },
    q29: { title: 'Fruit & Vegetables', desc: 'Daily portions of fruit and non-starchy vegetables' },
    q30: { title: 'Beans/Pulses', desc: 'Weekly legume consumption' },
    q31: { title: 'Whole Grains', desc: 'Whole grain intake frequency' },
    q32: { title: 'Fast/Processed Foods', desc: 'Frequency of fast and processed foods' },
    q33: { title: 'Sweets & Pastries', desc: 'Frequency of sweets and pastries' },
    q34: { title: 'Red Meat', desc: 'Weekly red meat portions' },
    q35: { title: 'Processed Meat', desc: 'Weekly processed meat portions' },
    q36: { title: 'Sugary Drinks', desc: 'Sugary drink frequency' },
    q37: { title: 'Alcohol', desc: 'Alcohol intake frequency' },
  };

  const components = scoreData?.components
    ? Object.entries(scoreData.components).map(([key, value], idx) => ({
        id: idx + 1,
        title: questionLabels[key]?.title ?? key,
        score: value ?? 0,
        max: 1,
        desc: questionLabels[key]?.desc ?? '',
      }))
    : [
        { id: 1, title: 'Healthy Weight', score: p(scoreData?.weight_score), max: 1, desc: 'BMI only' },
        { id: 2, title: 'Physical Activity', score: p(scoreData?.activity_score), max: 1, desc: '150+ active min/week — via Fitbit or manual log' },
        { id: 3, title: 'Plant Foods', score: p(scoreData?.plant_score), max: 1, desc: 'Fruits, vegetables and fiber' },
        { id: 4, title: 'Processed Foods', score: p(scoreData?.upf_score), max: 1, desc: 'Ultra-processed food intake' },
        { id: 5, title: 'Red and Processed Meat', score: p(scoreData?.meat_score), max: 1, desc: 'Weekly meat consumption' },
        { id: 6, title: 'Sugar Drinks', score: p(scoreData?.ssb_score), max: 1, desc: 'Sugar-sweetened beverages' },
        { id: 7, title: 'Alcohol', score: p(scoreData?.alcohol_score), max: 1, desc: 'Weekly alcohol consumption' },
      ];

  const riskColors: Record<string, string> = {
    Low:      'bg-green-50 text-green-700 border-green-200',
    Moderate: 'bg-amber-50 text-amber-700 border-amber-200',
    High:     'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <Layout>
      <div className="bg-stone-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

          {/* Header */}
          <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Health Overview</p>
              <h1 className="mt-1.5 text-[1.75rem] font-semibold tracking-tight text-stone-950 sm:text-[2rem]">Dashboard</h1>
              <p className="mt-1 text-xs sm:text-sm text-stone-500">{weekLabel}</p>
            </div>
            <div className="flex items-center gap-3">
              {riskLevel && (
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${riskColors[riskLevel] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {riskLevel} Risk
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 transition-all hover:bg-stone-50 disabled:opacity-50 sm:text-sm"
              >
                <svg className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshing ? 'Calculating...' : 'Refresh Score'}
              </button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between items-center">
              {error}
              <button className="text-red-400 hover:text-red-600 ml-3 text-xs underline" onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}

          {/* No score yet */}
          {!scoreData && !error && !loading && (
            <div className="mb-6 px-5 py-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              No score calculated yet for this week. Log your daily entries in the{' '}
              <strong>Weekly Log</strong> page, then click <strong>Refresh Score</strong> to calculate your WCRF/AICR risk score.
            </div>
          )}

          <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
            <MainScoreDisplay
              currentScore={currentScore}
              maxScore={maxScore}
              trend={0}
              riskLevel={riskLevel}
              weekLabel={weekLabel}
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <StatCard
                label="Questionnaire"
                value={questionnaireProgress}
                subtitle="Sections completed for this week"
                change={answeredCount === 9 ? 'Ready' : 'Pending'}
                changeType={answeredCount === 9 ? 'positive' : 'neutral'}
              />
              <StatCard
                label="Activity This Week"
                value={`${activityThisWeek}`}
                subtitle="Moderate-to-vigorous minutes logged or synced"
                change={activityThisWeek >= 150 ? 'Goal met' : `${Math.max(150 - activityThisWeek, 0)} min left`}
                changeType={activityThisWeek >= 150 ? 'positive' : activityThisWeek >= 75 ? 'neutral' : 'negative'}
              />
              <StatCard
                label="Fitbit Steps"
                value={fitbitConnected && syncedStepCount ? syncedStepCount.toLocaleString() : 'Not synced'}
                subtitle={fitbitConnected ? 'Current week total from Fitbit sync' : 'Connect Fitbit for automatic import'}
                change={fitbitConnected ? 'Live source' : 'Manual mode'}
                changeType={fitbitConnected ? 'positive' : 'neutral'}
              />
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[20px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">This week</p>
                  <h2 className="mt-1 text-base font-semibold tracking-tight text-stone-950">Progress snapshot</h2>
                </div>
                <Link to="/progress" className="text-xs font-semibold text-stone-500 hover:text-stone-900">See progress</Link>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-stone-900">Questionnaire</div>
                    <div className="text-xs font-medium text-stone-500">{answeredCount}/9</div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-stone-200">
                    <div
                      className="h-1.5 rounded-full bg-stone-900"
                      style={{ width: `${Math.max(0, Math.min(100, (answeredCount / 9) * 100))}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-stone-500">
                    {answeredCount === 9 ? 'Complete for this week' : `${9 - answeredCount} sections remaining`}
                  </div>
                </div>

                <div className="rounded-[18px] border border-stone-200 bg-stone-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-stone-900">Activity target</div>
                    <div className="text-xs font-medium text-stone-500">{activityThisWeek}/150</div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-stone-200">
                    <div
                      className={`h-1.5 rounded-full ${activityThisWeek >= 150 ? 'bg-emerald-600' : activityThisWeek >= 75 ? 'bg-amber-500' : 'bg-stone-500'}`}
                      style={{ width: `${Math.max(0, Math.min(100, (activityThisWeek / 150) * 100))}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-stone-500">
                    {activityThisWeek >= 150 ? 'Goal met this week' : `${Math.max(150 - activityThisWeek, 0)} minutes to goal`}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Go to</p>
                  <h2 className="mt-1 text-base font-semibold tracking-tight text-stone-950">Core actions</h2>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { href: '/weekly-log', title: 'Weekly Log', meta: 'Questionnaire', icon: <WeeklyLogIcon /> },
                  { href: '/activity', title: 'Activity', meta: fitbitConnected ? 'Fitbit + manual' : 'Manual logging', icon: <ActivityIcon /> },
                  { href: '/body-metrics', title: 'Body Metrics', meta: 'Weight tracking', icon: <BodyMetricsIcon /> },
                  { href: '/profile', title: 'Profile', meta: 'Height and account', icon: <ProfileIcon /> },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="group rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-3 transition-colors hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-stone-600">
                          {item.icon}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-stone-900">{item.title}</div>
                          <div className="mt-0.5 text-xs text-stone-500">{item.meta}</div>
                        </div>
                      </div>
                      <span className="text-stone-400 transition-transform group-hover:translate-x-0.5">→</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Component Breakdown */}
          <div className="mb-6">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Breakdown</p>
                <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-stone-950">Recommendation Components</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {components.map(c => (
                <ScoreCard key={c.id} title={c.title} score={c.score} maxScore={c.max} description={c.desc} trend={0} />
              ))}
            </div>
          </div>

          {/* Last calculated */}
          {scoreData?.calculated_at && (
            <p className="mt-6 text-right text-xs text-stone-400">
              Last calculated:{' '}
              {new Date(scoreData.calculated_at).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}

        </div>
      </div>
    </Layout>
  );
}
