import { useEffect, useRef } from 'react';
import { API_BASE } from '../config/api';

// Handles Google OAuth redirect — saves token and redirects to dashboard
export default function AuthCallback() {
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const finishGoogleLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const user = params.get('user');
      const error = params.get('error');

      if (error || !token) {
        window.location.href = '/login?error=google_failed';
        return;
      }

      try {
        localStorage.setItem('token', token);

        if (user) {
          // URLSearchParams already decodes the query value once.
          JSON.parse(user);
          localStorage.setItem('user', user);
          window.location.href = '/dashboard';
          return;
        }

        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error('Failed to fetch authenticated user');
        }

        const data = await res.json();
        localStorage.setItem('user', JSON.stringify(data.data.user));
        window.location.href = '/dashboard';
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login?error=google_failed';
      }
    };

    void finishGoogleLogin();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-4xl mb-4">🔐</div>
        <p className="text-gray-600 font-medium">Signing you in...</p>
        <p className="text-gray-400 text-sm mt-1">Please wait</p>
      </div>
    </div>
  );
}
