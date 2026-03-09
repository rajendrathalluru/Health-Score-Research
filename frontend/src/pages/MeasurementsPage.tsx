import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { API_BASE } from '../config/api';

export default function MeasurementsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    weightKg: '',
    waistCm: '',
    mvpaMinutes: '',
    steps: '',
    heightCm: ''
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadTodaysMeasurement();
  }, []);

  const loadTodaysMeasurement = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/measurements/${user.id}/${today}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();
      if (data.success && data.data) {
        setFormData({
          weightKg: data.data.weight_kg || '',
          waistCm: data.data.waist_cm || '',
          mvpaMinutes: data.data.mvpa_minutes || '',
          steps: data.data.steps || '',
          heightCm: ''
        });
      }
    } catch (error) {
      console.error('Failed to load measurement:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update height if provided
      if (formData.heightCm) {
        await fetch(`${API_BASE}/measurements/user/${user.id}/height`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ heightCm: parseFloat(formData.heightCm) })
        });
      }

      // Save measurements
      const response = await fetch(`${API_BASE}/measurements/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          date: today,
          weightKg: formData.weightKg ? parseFloat(formData.weightKg) : null,
          waistCm: formData.waistCm ? parseFloat(formData.waistCm) : null,
          mvpaMinutes: formData.mvpaMinutes ? parseInt(formData.mvpaMinutes) : null,
          steps: formData.steps ? parseInt(formData.steps) : null
        })
      });

      const data = await response.json();
      if (data.success) {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Failed to save measurement:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Activity & Measurements</h1>
          <p className="text-sm text-gray-500 mt-1">Track your daily activity and body measurements</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Body Measurements</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Height (cm) - One time setup
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.heightCm}
                  onChange={(e) => setFormData({...formData, heightCm: e.target.value})}
                  placeholder="e.g., 175"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.weightKg}
                  onChange={(e) => setFormData({...formData, weightKg: e.target.value})}
                  placeholder="e.g., 70.5"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Waist Circumference (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.waistCm}
                  onChange={(e) => setFormData({...formData, waistCm: e.target.value})}
                  placeholder="e.g., 85"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Physical Activity</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Moderate to Vigorous Activity (minutes)
                </label>
                <input
                  type="number"
                  value={formData.mvpaMinutes}
                  onChange={(e) => setFormData({...formData, mvpaMinutes: e.target.value})}
                  placeholder="e.g., 45"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Goal: 150+ minutes per week (21+ per day)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Steps
                </label>
                <input
                  type="number"
                  value={formData.steps}
                  onChange={(e) => setFormData({...formData, steps: e.target.value})}
                  placeholder="e.g., 8547"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Measurements'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
