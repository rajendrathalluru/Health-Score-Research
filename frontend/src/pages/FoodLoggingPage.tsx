import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';

interface Food {
  fdcId: number;
  description: string;
  brandOwner: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  servingSize: number;
  servingSizeUnit: string;
}

interface FoodEntry {
  id: string;
  food_name: string;
  meal_type: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  serving_size: string;
}

export default function FoodLoggingPage() {
  const [mealType, setMealType] = useState('breakfast');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadDailyEntries();
  }, []);

  const loadDailyEntries = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/food/daily/${user.id}/${today}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setEntries(data.data);
      }
    } catch (error) {
      console.error('Failed to load entries:', error);
    }
  };

  const searchFood = async () => {
    if (searchQuery.trim().length < 2) {
      alert('Please enter at least 2 characters');
      return;
    }

    setSearching(true);
    console.log('Searching for:', searchQuery);
    
    try {
      const url = `http://localhost:3001/api/food/search?query=${encodeURIComponent(searchQuery)}`;
      console.log('Fetching:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success) {
        console.log('Setting results:', data.data.length, 'items');
        setSearchResults(data.data);
      } else {
        console.error('Search failed:', data.message);
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Check console for details.');
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchFood();
    }
  };

  const addFood = async (food: Food) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/food/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          date: today,
          mealType,
          foodName: food.description,
          servingSize: `${food.servingSize}${food.servingSizeUnit}`,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          fiber: food.fiber
        })
      });

      const data = await response.json();
      if (data.success) {
        loadDailyEntries();
        setSearchQuery('');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Failed to add food:', error);
    } finally {
      setLoading(false);
    }
  };

  const totals = entries.reduce((acc, entry) => ({
    calories: acc.calories + (entry.calories || 0),
    protein: acc.protein + (entry.protein_g || 0),
    carbs: acc.carbs + (entry.carbs_g || 0),
    fat: acc.fat + (entry.fat_g || 0),
    fiber: acc.fiber + (entry.fiber_g || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Food Log</h1>
          <p className="text-sm text-gray-500 mt-1">Track your daily nutrition</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Food</h2>
              
              <div className="space-y-4">
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Search foods..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={searchFood}
                    disabled={searching}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                </div>

                <div className="text-sm text-gray-500">
                  {searchResults.length > 0 && `Found ${searchResults.length} results`}
                </div>

                {searchResults.length > 0 && (
                  <div className="border rounded-lg max-h-96 overflow-y-auto">
                    {searchResults.map((food) => (
                      <div key={food.fdcId} className="p-4 border-b last:border-0 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium">{food.description}</h3>
                            {food.brandOwner && <p className="text-xs text-gray-500">{food.brandOwner}</p>}
                            <div className="mt-2 text-xs text-gray-600 space-x-3">
                              <span>Cal: {Math.round(food.calories)}</span>
                              <span>P: {Math.round(food.protein)}g</span>
                              <span>C: {Math.round(food.carbs)}g</span>
                              <span>F: {Math.round(food.fat)}g</span>
                              <span>Fiber: {Math.round(food.fiber)}g</span>
                            </div>
                          </div>
                          <button
                            onClick={() => addFood(food)}
                            disabled={loading}
                            className="ml-4 px-4 py-2 bg-green-600 text-white text-sm rounded-lg"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Meals</h2>
              {entries.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No meals logged</p>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-4">
                      <div className="flex justify-between mb-2">
                        <div>
                          <h3 className="font-medium">{entry.food_name}</h3>
                          <p className="text-xs text-gray-500 capitalize">{entry.meal_type}</p>
                        </div>
                        <span className="font-semibold">{Math.round(entry.calories)} cal</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
                        <div>P: {Math.round(entry.protein_g)}g</div>
                        <div>C: {Math.round(entry.carbs_g)}g</div>
                        <div>F: {Math.round(entry.fat_g)}g</div>
                        <div>Fiber: {Math.round(entry.fiber_g)}g</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Totals</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Calories</span>
                  <span className="text-lg font-semibold">{Math.round(totals.calories)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Protein</span>
                  <span className="text-sm font-medium">{Math.round(totals.protein)}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Carbs</span>
                  <span className="text-sm font-medium">{Math.round(totals.carbs)}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Fat</span>
                  <span className="text-sm font-medium">{Math.round(totals.fat)}g</span>
                </div>
                <div className="flex justify-between pb-3 border-b">
                  <span className="text-sm text-gray-600">Fiber</span>
                  <span className="text-sm font-medium">{Math.round(totals.fiber)}g</span>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-500">Fiber Goal (30g)</span>
                    <span className="text-xs font-medium">{Math.round((totals.fiber / 30) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${Math.min((totals.fiber / 30) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
