import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ScoreData {
  date: string;
  score: number;
}

interface WeightData {
  date: string;
  weight: number;
  bmi: number;
}

interface NutritionData {
  date: string;
  calories: number;
  fiber: number;
}

export default function ProgressPage() {
  const [scoreHistory, setScoreHistory] = useState<ScoreData[]>([]);
  const [weightHistory, setWeightHistory] = useState<WeightData[]>([]);
  const [nutritionHistory, setNutritionHistory] = useState<NutritionData[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchHistory();
  }, [days]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const [scoresRes, weightRes, nutritionRes] = await Promise.all([
        fetch(`http://localhost:3001/api/progress/scores/${user.id}?days=${days}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:3001/api/progress/weight/${user.id}?days=${days}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`http://localhost:3001/api/progress/nutrition/${user.id}?days=${days}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const scoresData = await scoresRes.json();
      const weightData = await weightRes.json();
      const nutritionData = await nutritionRes.json();

      if (scoresData.success) {
        const formatted: ScoreData[] = scoresData.data.map((item: any) => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          score: parseFloat(item.total_score)
        }));
        setScoreHistory(formatted);
      }

      if (weightData.success) {
        const formatted: WeightData[] = weightData.data.map((item: any) => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          weight: parseFloat(item.weight_kg),
          bmi: parseFloat(item.bmi)
        }));
        setWeightHistory(formatted);
      }

      if (nutritionData.success) {
        const formatted: NutritionData[] = nutritionData.data.map((item: any) => ({
          date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          calories: parseInt(item.total_calories),
          fiber: parseFloat(item.total_fiber)
        }));
        setNutritionHistory(formatted);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="text-gray-500">Loading progress data...</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Progress Tracking</h1>
              <p className="text-sm text-gray-500 mt-1">View your health trends over time</p>
            </div>
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
        </div>

        <div className="space-y-6">
          {scoreHistory.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">WCRF/AICR Score Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={scoreHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 7]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} name="Daily Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {weightHistory.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Weight & BMI Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={weightHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} name="Weight (kg)" />
                  <Line yAxisId="right" type="monotone" dataKey="bmi" stroke="#f59e0b" strokeWidth={2} name="BMI" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {nutritionHistory.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Nutrition Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={nutritionHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="calories" stroke="#8b5cf6" strokeWidth={2} name="Calories" />
                  <Line yAxisId="right" type="monotone" dataKey="fiber" stroke="#22c55e" strokeWidth={2} name="Fiber (g)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {scoreHistory.length === 0 && weightHistory.length === 0 && nutritionHistory.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <p className="text-gray-500">No data available yet. Start tracking to see your progress!</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}