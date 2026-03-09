import { API_URL } from '../config/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface WeeklyDietAnswers {
  q29: string | null;
  q30: string | null;
  q31: string | null;
  q32: string | null;
  q33: string | null;
  q34: string | null;
  q35: string | null;
  q36: string | null;
  q37: string | null;
}

export interface WeeklyScoreResponse {
  week_start_date: string;
  total_score: number;
  max_possible_score: number;
  risk_level: 'Low' | 'Moderate' | 'High' | string;
  calculated_at: string;
  answers: WeeklyDietAnswers;
  components: Record<string, number | null>;
  days_answered: number;
  days_logged: number;
}

export interface WeeklyScoreHistoryItem {
  week_start_date: string;
  total_score: number;
  max_possible_score: number;
  risk_level: 'Low' | 'Moderate' | 'High' | string;
  calculated_at: string;
  component_count: number;
}

// Save questionnaire answers and compute/persist weekly score
export async function saveWeeklyQuestionnaire(
  weekStart: string,
  answers: WeeklyDietAnswers
): Promise<WeeklyScoreResponse> {
  const res = await fetch(`${API_URL}/api/weekly-score`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ weekStart, answers }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to save questionnaire');
  }

  return data.data;
}

// Load previously saved questionnaire + score for a week
export async function getWeeklyQuestionnaire(
  weekStart: string
): Promise<WeeklyScoreResponse | null> {
  const res = await fetch(
    `${API_URL}/api/weekly-score?weekStart=${weekStart}`,
    { headers: getAuthHeaders() }
  );

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch weekly questionnaire');
  }

  return data.data;
}

// Recompute from stored weekly answers
export async function refreshWeeklyScore(weekStart: string): Promise<WeeklyScoreResponse> {
  const res = await fetch(`${API_URL}/api/weekly-score`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ weekStart }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to compute weekly score');
  }

  return data.data;
}

export async function getWeeklyScoreHistory(limit = 26): Promise<WeeklyScoreHistoryItem[]> {
  const res = await fetch(`${API_URL}/api/weekly-score/history?limit=${limit}`, {
    headers: getAuthHeaders(),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch weekly history');
  }

  return data.data;
}
