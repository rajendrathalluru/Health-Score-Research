const rawApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_URL = rawApiUrl || '';
export const API_BASE = API_URL ? `${API_URL}/api` : '/api';
