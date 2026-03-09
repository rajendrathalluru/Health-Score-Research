import { useEffect, useRef } from 'react';

// Handles Google OAuth redirect — saves token and redirects to dashboard
export default function AuthCallback() {
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    const user   = params.get('user');
    const error  = params.get('error');

    if (error || !token || !user) {
      window.location.href = '/login?error=google_failed';
      return;
    }

    try {
      localStorage.setItem('token', token);
      localStorage.setItem('user', decodeURIComponent(user));
      window.location.href = '/dashboard';
    } catch {
      window.location.href = '/login?error=google_failed';
    }
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