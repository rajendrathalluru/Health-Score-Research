import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'google_failed') {
      setError('Google sign in failed. Please try again.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedName = formData.name.trim();
    const normalizedEmail = formData.email.trim().toLowerCase();

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          password: formData.password
        })
      });

      const data = await response.json();

      if (data.success) {
        navigate('/login?registered=1', { replace: true });
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    window.location.href = `${API_BASE}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.12),_transparent_30%),linear-gradient(180deg,_#f7f6f2_0%,_#f3f1eb_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden lg:block">
          <div className="max-w-xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-900 text-white shadow-sm">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h4l2.2-4.5L14 17l2.2-4H20" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">HealthScore</div>
                <div className="text-sm text-stone-500">Cancer survivorship tracking</div>
              </div>
            </div>

            <h1 className="max-w-lg text-3xl font-medium leading-[1.15] tracking-tight text-stone-900 xl:text-4xl">
              Start a survivorship-focused account for weekly health tracking.
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-stone-600">
              Build a weekly routine around activity, body metrics, and evidence-based recommendations designed for cancer survivors.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md lg:max-w-none">
          <div className="rounded-[30px] border border-stone-200 bg-white/92 p-6 shadow-[0_16px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">

            <div className="mb-8 text-center lg:text-left">
              <div className="mb-4 flex justify-center lg:justify-start">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 shadow-sm">
                  <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h4l2.2-4.5L14 17l2.2-4H20" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16" />
                  </svg>
                </div>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Create account</h2>
              <p className="mt-2 text-sm text-stone-500">Set up your weekly score, activity, and survivorship tracking.</p>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="mb-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-stone-300 bg-white px-4 py-3.5 transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              {googleLoading ? (
                <span className="text-sm text-stone-600">Redirecting to Google...</span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.5 33.1 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.2-2.7-.4-4z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.1 0-9.4-2.9-11.3-7.1l-6.6 5.1C9.8 39.8 16.4 44 24 44z"/>
                    <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.5 44 30.1 44 24c0-1.3-.2-2.7-.4-4z"/>
                  </svg>
                  <span className="text-sm font-medium text-stone-700">Continue with Google</span>
                </>
              )}
            </button>

            <div className="mb-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-stone-200" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">or use email</span>
              <div className="h-px flex-1 bg-stone-200" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium text-stone-700">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder-stone-400 outline-none transition-all focus:border-stone-900 focus:bg-white"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-stone-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                  className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder-stone-400 outline-none transition-all focus:border-stone-900 focus:bg-white"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-stone-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  minLength={6}
                  className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder-stone-400 outline-none transition-all focus:border-stone-900 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-stone-700">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  required
                  minLength={6}
                  className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder-stone-400 outline-none transition-all focus:border-stone-900 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading || !formData.name.trim() || !formData.email.trim() || !formData.password || !formData.confirmPassword}
                className="w-full rounded-2xl bg-stone-900 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-stone-500">
              Already have an account?{' '}
              <a href="/login" className="font-medium text-stone-900 hover:text-stone-700">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
