import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import WelcomePage from './pages/WelcomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ActivityPage from './pages/ActivityPage';
import BodyMetricsPage from './pages/BodyMetricsPage';
import ProgressPage from './pages/ProgressPage';
import AuthCallback from './pages/AuthCallback';
import HealthLog from './pages/HealthLog';
import ProfilePage from './pages/ProfilePage';
import { API_BASE } from './config/api';



// Handles Fitbit OAuth redirect and passes code to backend
function FitbitCallback() {
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return; // prevent double call
    redirected.current = true;

    const params = new URLSearchParams(window.location.search);
    const code  = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error || !code) {
      window.location.href = '/dashboard?fitbit=error';
      return;
    }

    window.location.href = `${API_BASE}/fitbit/callback?code=${code}&state=${state}`;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-4xl mb-4">⌚</div>
        <p className="text-gray-600 font-medium">Connecting your Fitbit...</p>
        <p className="text-gray-400 text-sm mt-1">Please wait</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Fitbit OAuth callback — no auth required */}
        <Route path="/auth/fitbit/callback" element={<FitbitCallback />} />

        {/* Google OAuth callback — no auth required */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute>
              <ActivityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/body-metrics"
          element={
            <ProtectedRoute>
              <BodyMetricsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/progress"
          element={
            <ProtectedRoute>
              <ProgressPage />
            </ProtectedRoute>
          }
        />

        <Route
  path="/health-log"
  element={
    <ProtectedRoute>
      <HealthLog />
    </ProtectedRoute>
  }
/>
<Route
  path="/profile"
  element={
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  }
/>
      </Routes>
    </Router>
  );
}

export default App;
