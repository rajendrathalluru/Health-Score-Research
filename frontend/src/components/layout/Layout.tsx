import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

const NAV_LINKS = [
  { label: 'Dashboard',   href: '/dashboard'  },
  { label: 'Weekly Log',  href: '/health-log'  },
  { label: 'Progress',    href: '/progress'    },
];

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function Layout({ children }: LayoutProps) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const dropRef   = useRef<HTMLDivElement>(null);

  const [user, setUser]           = useState<any>({});
  const [dropOpen, setDropOpen]   = useState(false);
  const [mobileOpen, setMobile]   = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Re-read user from localStorage whenever route changes (picks up profile saves)
  useEffect(() => {
    setUser(JSON.parse(localStorage.getItem('user') || '{}'));
    setAvatarFailed(false);
  }, [location.pathname]);

  // Close dropdown on outside click
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
    navigate('/login');
  };

  const isActive = (href: string) => location.pathname === href;

  const avatarUrl: string | null = user.avatar_url ?? null;
  const displayName: string      = user.name || 'User';

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top nav ──────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">

            {/* Brand */}
            <a href="/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">H</span>
              </div>
              <span className="text-base font-semibold text-gray-900">HealthScore</span>
            </a>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${isActive(href)
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                >
                  {label}
                </a>
              ))}
            </div>

            {/* Desktop — user dropdown */}
            <div className="hidden md:flex items-center gap-3" ref={dropRef}>
              <div className="relative">
                <button
                  onClick={() => setDropOpen(o => !o)}
                  className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-xl
                             hover:bg-gray-50 border border-transparent hover:border-gray-200
                             transition-all group"
                >
                  {/* Avatar */}
                  <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                    {avatarUrl && !avatarFailed ? (
                      <img
                        src={avatarUrl}
                        alt="avatar"
                        className="w-full h-full object-cover"
                        onError={() => setAvatarFailed(true)}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600
                                      flex items-center justify-center text-white text-[10px] font-bold">
                        {initials(displayName)}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">
                    {displayName}
                  </span>
                  {/* Chevron */}
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd"
                      d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" />
                  </svg>
                </button>

                {/* Dropdown menu */}
                {dropOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-gray-100
                                  shadow-lg py-1 z-50">
                    <div className="px-3 py-2 border-b border-gray-50 mb-1">
                      <p className="text-xs font-semibold text-gray-800 truncate">{displayName}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    <a href="/profile"
                      onClick={() => setDropOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700
                                 hover:bg-gray-50 transition-colors">
                      <span className="text-base">👤</span> Profile
                    </a>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-600
                                 hover:bg-rose-50 transition-colors">
                      <span className="text-base">🚪</span> Log out
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobile(o => !o)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd"
                    d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd"
                    d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75Zm0 5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            {NAV_LINKS.map(({ label, href }) => (
              <a key={href} href={href}
                onClick={() => setMobile(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive(href)
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </a>
            ))}
            <div className="pt-2 border-t border-gray-100 mt-2 space-y-1">
              <a href="/profile" onClick={() => setMobile(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
                👤 Profile
              </a>
              <button onClick={handleLogout}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50">
                🚪 Log out
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <main>{children}</main>
    </div>
  );
}
