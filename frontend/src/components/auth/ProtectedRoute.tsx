import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { API_BASE } from '../../config/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');

  async function validateToken() {
    const token = localStorage.getItem('token');

    if (!token) {
      setStatus('invalid');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setStatus('valid');
      } else {
        // Token is expired or invalid — clear storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('fitbit_connected');
        localStorage.removeItem('fitbit_user_id');
        setStatus('invalid');
      }
    } catch {
      // Network error — allow access if token exists to avoid locking out on server restart
      const token = localStorage.getItem('token');
      setStatus(token ? 'valid' : 'invalid');
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void validateToken();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-gray-500 text-sm">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
