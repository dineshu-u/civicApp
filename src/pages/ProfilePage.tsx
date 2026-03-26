// ============================================
// PROFILE PAGE
// ============================================

import { User } from '../types';

interface ProfilePageProps {
  currentUser: User | null;
  onLogout: () => void;
  onGoBack: () => void;
}

const ProfilePage = ({ currentUser, onLogout, onGoBack }: ProfilePageProps) => (
  <div className="min-h-screen bg-gray-50 pb-24">
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <button onClick={onGoBack} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Profile</h1>
      </div>
    </div>

    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
          <span className="text-3xl text-blue-600 font-bold">{currentUser?.name?.charAt(0) || 'U'}</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900">{currentUser?.name}</h2>
        <p className="text-gray-500">{currentUser?.email}</p>
        <div className="mt-3">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 rounded-full text-blue-700 text-sm font-medium">
            {currentUser?.role === 'official' ? '👨‍💼 Official' : '👤 Citizen'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-900">{currentUser?.complaintsSubmitted || 0}</p>
          <p className="text-xs text-gray-500">Reports</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-green-600">{currentUser?.complaintsResolved || 0}</p>
          <p className="text-xs text-gray-500">Resolved</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
          <p className="text-2xl font-bold text-blue-600">{currentUser?.impactScore || 0}</p>
          <p className="text-xs text-gray-500">Impact</p>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full bg-red-50 text-red-600 font-semibold py-3 rounded-2xl hover:bg-red-100 transition-colors"
      >
        Sign Out
      </button>
    </div>
  </div>
);

export default ProfilePage;
