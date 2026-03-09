import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import MainScoreDisplay from '../components/dashboard/MainScoreDisplay';
import ScoreCard from '../components/dashboard/ScoreCard';
import StatCard from '../components/dashboard/StatCard';
import ManualActivityInput from '../components/dashboard/ManualActivityInput';
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
  waistCm:        number | null;
  sources: {
    weight:   string | null;
    activity: string;
    bmi:      string;
  };
}

export default function Dashboard() {
  const [scoreData, setScoreData]             = useState<WeeklyScoreRow | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [fitbitConnected, setFitbitConnected] = useState(false);
  const [fitbitData, setFitbitData]           = useState<FitbitSyncData | null>(null);
  const [syncing, setSyncing]                 = useState(false);
  const [syncMessage, setSyncMessage]         = useState('');
  const [manualMvpa, setManualMvpa]           = useState<number | null>(null);

  const user      = JSON.parse(localStorage.getItem('user') || '{}');
  const token     = localStorage.getItem('token');
  const weekStart = getCurrentWeekStart();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const p = (v: string | number | null | undefined): number =>
    v === null || v === undefined ? 0 : parseFloat(String(v)) || 0;

  // ── On mount: load score + check Fitbit status ─────────────────────────────
  useEffect(() => {
    loadWeeklyScore();
    checkFitbitStatus();
    loadManualActivity();
  }, []);

  // ── Handle Fitbit OAuth redirect params ───────────────────────────────────
  useEffect(() => {
    const params     = new URLSearchParams(window.location.search);
    const fitbitStatus = params.get('fitbit');
    const fUserId    = params.get('fitbit_user_id');

    if (fitbitStatus === 'connected' && fUserId) {
      setFitbitConnected(true);
      localStorage.setItem('fitbit_user_id', fUserId);
      localStorage.setItem('fitbit_connected', 'true');
      setSyncMessage('Fitbit connected successfully!');
      window.history.replaceState({}, '', '/dashboard');
    } else if (fitbitStatus === 'error') {
      setSyncMessage('Fitbit connection failed. Please try again.');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  // ── Weekly score ──────────────────────────────────────────────────────────
  const loadWeeklyScore = async () => {
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
  };

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
    } catch (err) {
      setError('Failed to refresh score. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // ── Fitbit ────────────────────────────────────────────────────────────────
  const checkFitbitStatus = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/fitbit/status?userId=${user.id}`);
      const data = await res.json();
      if (data.success && data.connected) {
        setFitbitConnected(true);
      }
    } catch (err) {
      console.error('Failed to check Fitbit status:', err);
    }
  };

  const connectFitbit = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/fitbit/auth-url?userId=${user.id}`);
      const data = await res.json();
      if (data.success) window.location.href = data.authUrl;
    } catch (err) {
      console.error('Failed to get Fitbit auth URL:', err);
    }
  };

  const syncFitbit = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res  = await fetch(`${API_URL}/api/fitbit/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        setFitbitData(data.data);
        setSyncMessage(`Synced — ${data.data.steps.toLocaleString()} steps · ${data.data.activeMinutes} active mins today`);
        loadWeeklyScore();
      } else {
        setSyncMessage(`Sync failed: ${data.error || data.message}`);
      }
    } catch (err) {
      setSyncMessage('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const disconnectFitbit = () => {
    localStorage.removeItem('fitbit_connected');
    localStorage.removeItem('fitbit_user_id');
    setFitbitConnected(false);
    setFitbitData(null);
    setSyncMessage('Fitbit disconnected.');
  };

  // ── Manual activity ───────────────────────────────────────────────────────
  const loadManualActivity = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/measurements/activity?userId=${user.id}&weekStart=${weekStart}`, { headers });
      const data = await res.json();
      if (data.success) setManualMvpa(data.data.mvpa_minutes ?? null);
    } catch (err) {
      console.error('Failed to load manual activity:', err);
    }
  };

  const saveManualActivity = async (mvpaMinutes: number) => {
    const res  = await fetch(`${API_URL}/api/measurements/activity`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: user.id, mvpa_minutes: mvpaMinutes, week_start_date: weekStart }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to save');
    setManualMvpa(mvpaMinutes);
  };

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

  const questionLabels: Record<string, { title: string; desc: string }> = {
    weight_score: { title: 'Healthy Weight', desc: 'BMI and waist circumference thresholds' },
    activity_score: { title: 'Physical Activity', desc: 'Total moderate-to-vigorous activity minutes per week' },
    plant_based_score: { title: 'Plant-Based Foods', desc: 'Average of fruit & vegetables, pulses, and whole grains' },
    fast_processed_score: { title: 'Fast/Processed Foods', desc: 'Combined frequency of fast foods and sweets/pastries' },
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
        { id: 1, title: 'Healthy Weight', score: p(scoreData?.weight_score), max: 1, desc: 'BMI and waist circumference' },
        { id: 2, title: 'Physical Activity', score: p(scoreData?.activity_score), max: 1, desc: '150+ min/week MVPA — via Fitbit' },
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
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Week of {new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {riskLevel && (
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${riskColors[riskLevel] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {riskLevel} Risk
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-all disabled:opacity-50"
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

          {/* Fitbit Banner */}
          <div className={`rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${fitbitConnected ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${fitbitConnected ? 'bg-green-100' : 'bg-blue-100'}`}>
                <svg className={`w-5 h-5 ${fitbitConnected ? 'text-green-600' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
              </div>
              <div>
                <p className={`font-semibold text-sm ${fitbitConnected ? 'text-green-800' : 'text-blue-800'}`}>
                  {fitbitConnected ? 'Fitbit Connected' : 'Connect Your Fitbit'}
                </p>
                <p className={`text-xs mt-0.5 ${fitbitConnected ? 'text-green-600' : 'text-blue-600'}`}>
                  {fitbitConnected
                    ? syncMessage || 'Sync to auto-import activity and weight data'
                    : 'Automatically track steps, activity, and weight'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {fitbitConnected ? (
                <>
                  <button onClick={syncFitbit} disabled={syncing}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors">
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                  <button onClick={disconnectFitbit}
                    className="bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium py-2 px-4 rounded-lg border border-gray-200 transition-colors">
                    Disconnect
                  </button>
                </>
              ) : (
                <button onClick={connectFitbit}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors">
                  Connect Fitbit
                </button>
              )}
            </div>
          </div>

          {/* Fitbit synced stats */}
          {fitbitData && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {[
                { label: 'Steps',        value: fitbitData.steps.toLocaleString() },
                { label: 'Active Mins',  value: `${fitbitData.activeMinutes} min` },
                { label: 'Calories Out', value: fitbitData.caloriesBurned.toLocaleString() },
                { label: 'Weight',       value: fitbitData.weightKg  ? `${fitbitData.weightKg} kg`  : 'N/A' },
                { label: 'BMI',          value: fitbitData.bmi       ? `${fitbitData.bmi}`           : 'N/A' },
                { label: 'Height',       value: fitbitData.heightCm  ? `${fitbitData.heightCm} cm`  : 'N/A' },
              ].map(item => (
                <div key={item.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="text-lg font-bold text-gray-900">{item.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Score */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <MainScoreDisplay currentScore={currentScore} maxScore={maxScore} trend={0} />
            </div>
            <div className="space-y-4">
              <StatCard
                label="Current Score"
                value={currentScore.toFixed(1)}
                subtitle={`Out of ${maxScore}`}
                change={`${Math.round((currentScore / maxScore) * 100)}%`}
                changeType="neutral"
              />
              {/* Show manual activity input only when Fitbit is not connected */}
              {!fitbitConnected && (
                <ManualActivityInput
                  onSave={saveManualActivity}
                  savedMinutes={manualMvpa}
                />
              )}
            </div>
          </div>

          {/* Component Breakdown */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Component Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {components.map(c => (
                <ScoreCard key={c.id} title={c.title} score={c.score} maxScore={c.max} description={c.desc} trend={0} />
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => window.location.href = '/health-log'}
              className="bg-gray-900 hover:bg-gray-800 text-white font-medium py-4 px-6 rounded-lg transition-colors text-left flex justify-between items-center">
              <div>
                <div className="font-semibold mb-0.5">Weekly Log</div>
                <div className="text-sm text-gray-300">Log your daily food and drink</div>
              </div>
              <span className="text-lg">→</span>
            </button>
            <button onClick={() => window.location.href = '/measurements'}
              className="bg-white hover:bg-gray-50 text-gray-900 font-medium py-4 px-6 rounded-lg border border-gray-200 transition-colors text-left flex justify-between items-center">
              <div>
                <div className="font-semibold mb-0.5">Add Measurements</div>
                <div className="text-sm text-gray-500">Track weight and activity</div>
              </div>
              <span className="text-lg">→</span>
            </button>
          </div>

          {/* Last calculated */}
          {scoreData?.calculated_at && (
            <p className="text-xs text-gray-400 mt-6 text-right">
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
