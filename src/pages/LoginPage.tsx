// ============================================
// LOGIN PAGE — supports demo creds + registered citizens
// ============================================

import { useState } from 'react';
import { AUTH_CREDENTIALS, BackendService } from '../services/BackendService';
import { User } from '../types';

interface LoginPageProps {
  onLoginSuccess: (user: User, role: 'citizen' | 'admin') => void;
  onRegister: () => void;
}

const LoginPage = ({ onLoginSuccess, onRegister }: LoginPageProps) => {
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (role: 'citizen' | 'admin') => {
    setLoginError('');
    setLoading(true);

    try {
      // 1. Check hardcoded demo credentials
      const credentials = AUTH_CREDENTIALS[role];
      if (loginUsername === credentials.username && loginPassword === credentials.password) {
        const user: User = {
          id: role === 'admin' ? 'official-1' : 'user-1',
          name: role === 'admin' ? 'Municipal Officer' : 'Citizen User',
          email: role === 'admin' ? 'admin@gov.in' : 'citizen@email.com',
          role: role === 'admin' ? 'official' : 'citizen',
          createdAt: new Date(),
          impactScore: role === 'admin' ? 5000 : 500,
          complaintsSubmitted: role === 'admin' ? 0 : 5,
          complaintsResolved: role === 'admin' ? 156 : 3,
          trustLevel: role === 'admin' ? 'platinum' : 'silver',
        };
        onLoginSuccess(user, role);
        return;
      }

      // 2. For citizen role, also check registered users by email+password
      if (role === 'citizen') {
        const registeredUser = await BackendService.loginRegisteredUser(loginUsername, loginPassword);
        if (registeredUser) {
          onLoginSuccess(registeredUser, 'citizen');
          return;
        }
      }

      setLoginError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl">
            <span className="text-4xl">🏛️</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">TeNet</h1>
          <p className="text-blue-200">Citizen Reporting Platform</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">Sign In</h2>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
              {loginError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username / Email</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin('citizen')}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Username or registered email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin('citizen')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => handleLogin('citizen')}
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {loading ? 'Signing in...' : 'Login as Citizen'}
            </button>
            <button
              onClick={() => handleLogin('admin')}
              disabled={loading}
              className="w-full bg-gray-800 text-white font-semibold py-3 rounded-xl hover:bg-gray-900 disabled:bg-gray-500 transition-colors"
            >
              Login as Admin
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 font-medium mb-2">Demo Credentials:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2 rounded-lg">
                <p className="font-semibold text-gray-700">Citizen</p>
                <p className="text-gray-500">citizen / citizen123</p>
              </div>
              <div className="bg-white p-2 rounded-lg">
                <p className="font-semibold text-gray-700">Admin</p>
                <p className="text-gray-500">admin / admin123</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Registered citizens: use your email + password</p>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={onRegister}
              className="text-blue-600 text-sm font-medium hover:underline"
            >
              New citizen? Register here →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
