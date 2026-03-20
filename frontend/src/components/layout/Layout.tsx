import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Weekly Log', href: '/weekly-log' },
  { label: 'Progress', href: '/progress' },
];
const REFERENCE_URL = 'https://epi.grants.cancer.gov/wcrf-aicr-score/details.html#weight';

function ActivityIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h4l2.2-4.5L14 17l2.2-4H20" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16" />
    </svg>
  );
}

function BodyMetricsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 5v14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 5v14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h3M14 8h3M7 12h5M12 16h5" />
    </svg>
  );
}

function ProfileIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function LogoutIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 4v16" />
    </svg>
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const dropRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<any>({});
  const [dropOpen, setDropOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setUser(JSON.parse(localStorage.getItem('user') || '{}'));
    setAvatarFailed(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const avatarUrl: string | null = user.avatar_url ?? null;
  const displayName: string = user.name || 'User';

  const avatarNode = avatarUrl && !avatarFailed ? (
    <img
      src={avatarUrl}
      alt="avatar"
      className="h-full w-full object-cover"
      onError={() => setAvatarFailed(true)}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-stone-900 text-[10px] font-bold text-white">
      {initials(displayName)}
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-stone-900">
                <span className="text-xs font-bold text-white">H</span>
              </div>
              <div className="min-w-0">
                <span className="block truncate text-sm font-semibold text-stone-950 sm:text-base">HealthScore</span>
                <span className="hidden text-[11px] uppercase tracking-[0.2em] text-stone-400 sm:block">Tracker</span>
              </div>
            </Link>

            <div className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map(({ label, href }) => (
                <NavLink
                  key={href}
                  to={href}
                  className={({ isActive: active }) =>
                    `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
              <a
                href={REFERENCE_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900"
              >
                Reference
              </a>
            </div>

            <div className="hidden items-center gap-3 md:flex" ref={dropRef}>
              <div className="relative">
                <button
                  onClick={() => setDropOpen((current) => !current)}
                  className="group flex items-center gap-2.5 rounded-xl border border-transparent py-1.5 pl-3 pr-2 transition-all hover:border-stone-200 hover:bg-stone-50"
                >
                  <div className="h-8 w-8 overflow-hidden rounded-full flex-shrink-0">
                    {avatarNode}
                  </div>
                  <span className="max-w-[120px] truncate text-sm font-medium text-stone-700">{displayName}</span>
                  <svg
                    className={`h-3.5 w-3.5 text-stone-400 transition-transform ${dropOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                    />
                  </svg>
                </button>

                {dropOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-52 rounded-2xl border border-stone-100 bg-white py-1 shadow-lg">
                    <div className="mb-1 border-b border-stone-50 px-3 py-2">
                      <p className="truncate text-xs font-semibold text-stone-800">{displayName}</p>
                      <p className="truncate text-xs text-stone-400">{user.email}</p>
                    </div>
                    <Link
                      to="/activity"
                      onClick={() => setDropOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                        <ActivityIcon />
                      </span>
                      Activity
                    </Link>
                    <Link
                      to="/body-metrics"
                      onClick={() => setDropOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                        <BodyMetricsIcon />
                      </span>
                      Body Metrics
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setDropOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                        <ProfileIcon />
                      </span>
                      Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                        <LogoutIcon />
                      </span>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setMobileOpen((current) => !current)}
              className="rounded-xl p-2 text-stone-600 hover:bg-stone-50 md:hidden"
            >
              {mobileOpen ? (
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z"
                  />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75Zm0 5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-stone-100 bg-white px-4 py-4 md:hidden">
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-stone-100 bg-stone-50 px-3 py-3">
              <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full">
                {avatarNode}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-900">{displayName}</p>
                <p className="truncate text-xs text-stone-400">{user.email}</p>
              </div>
            </div>

            <div className="space-y-1">
              {NAV_LINKS.map(({ label, href }) => (
                <NavLink
                  key={href}
                  to={href}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive: active }) =>
                    `block rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-600 hover:bg-stone-50'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
              <a
                href={REFERENCE_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl px-3 py-3 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
              >
                Reference
              </a>
            </div>

            <div className="mt-3 space-y-1 border-t border-stone-100 pt-3">
              <Link
                to="/activity"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                  <ActivityIcon />
                </span>
                Activity
              </Link>
              <Link
                to="/body-metrics"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                  <BodyMetricsIcon />
                </span>
                Body Metrics
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                  <ProfileIcon />
                </span>
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <LogoutIcon />
                </span>
                Log out
              </button>
            </div>
          </div>
        )}
      </nav>

      <main>{children}</main>
    </div>
  );
}
