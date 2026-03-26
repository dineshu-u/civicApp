// ============================================
// ADMIN DASHBOARD PAGE
// ============================================

import { DashboardStats, CATEGORY_CONFIG } from '../types';

interface AdminDashboardPageProps {
  stats: DashboardStats | null;
  onGoBack: () => void;
}

const AdminDashboardPage = ({ stats, onGoBack }: AdminDashboardPageProps) => (
  <div className="min-h-screen bg-gray-50 pb-24">
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <button onClick={onGoBack} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
      </div>
    </div>

    <div className="max-w-7xl mx-auto px-4 py-6">
      {stats && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                <span className="text-xl">📊</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalComplaints}</p>
              <p className="text-sm text-gray-500">Total Reports</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                <span className="text-xl">✅</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.resolvedComplaints}</p>
              <p className="text-sm text-gray-500">Resolved</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center mb-3">
                <span className="text-xl">⏳</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingComplaints}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-3">
                <span className="text-xl">🔧</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.inProgressComplaints}</p>
              <p className="text-sm text-gray-500">In Progress</p>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-4">Category Breakdown</h3>
            <div className="space-y-3">
              {stats.categoryBreakdown.map((cat) => (
                <div key={cat.category} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                    style={{ backgroundColor: CATEGORY_CONFIG[cat.category].color + '20' }}
                  >
                    {CATEGORY_CONFIG[cat.category].icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{CATEGORY_CONFIG[cat.category].label}</span>
                      <span className="text-sm text-gray-500">{cat.count}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: CATEGORY_CONFIG[cat.category].color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust Distribution */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-500 mb-4">Verification Status</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-green-600">{stats.trustDistribution.verified}</p>
                <p className="text-xs text-green-700">Verified</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-yellow-600">{stats.trustDistribution.pending}</p>
                <p className="text-xs text-yellow-700">Pending</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-orange-600">{stats.trustDistribution.manualReview}</p>
                <p className="text-xs text-orange-700">Manual Review</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-red-600">{stats.trustDistribution.suspicious}</p>
                <p className="text-xs text-red-700">Suspicious</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  </div>
);

export default AdminDashboardPage;
