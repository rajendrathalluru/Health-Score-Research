import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Show error if redirected back from Google with error
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'google_failed') {
      setError('Google sign in failed. Please try again.');
    }
    if (params.get('registered') === '1') {
      setInfo('Account created successfully. Sign in with your email and password.');
    }
  }, []);

  const hydrateUserSession = async (token: string, fallbackUser?: unknown) => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && data.data?.user) {
        localStorage.setItem('user', JSON.stringify(data.data.user));
        return;
      }
    } catch {
      // Fall back to the login response user below.
    }

    if (fallbackUser) {
      localStorage.setItem('user', JSON.stringify(fallbackUser));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password;

    if (!normalizedEmail || !normalizedPassword) {
      setError('Email and password are required.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('token', data.data.token);
        await hydrateUserSession(data.data.token, data.data.user);
        navigate('/dashboard', { replace: true });
      } else {
        setError(data.message || 'Login failed');
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
              Built for cancer survivors tracking weekly health progress.
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-stone-600">
              Follow activity, body metrics, and evidence-based recommendations in a calmer weekly workflow designed for survivorship care.
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
              <h2 className="text-3xl font-semibold tracking-tight text-stone-950">Sign in</h2>
              <p className="mt-2 text-sm text-stone-500">Access your weekly score, activity, and body metrics.</p>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            {info && (
              <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm text-emerald-700">{info}</p>
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
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-stone-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-900 placeholder-stone-400 outline-none transition-all focus:border-stone-900 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading || !email.trim() || !password}
                className="w-full rounded-2xl bg-stone-900 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-stone-500">
              Don&apos;t have an account?{' '}
              <a href="/register" className="font-medium text-stone-900 hover:text-stone-700">
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
