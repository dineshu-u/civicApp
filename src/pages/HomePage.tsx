// ============================================
// HOME PAGE
// BUG FIX: Different CTA for citizen vs admin
// ============================================

import { Complaint, DashboardStats } from '../types';
import ComplaintCard from '../components/GrievanceCard/GrievanceCard';

interface HomePageProps {
  currentUserName: string;
  currentUserId: string;
  userRole: 'citizen' | 'admin' | null;
  stats: DashboardStats | null;
  filteredComplaints: Complaint[];
  onOpenCamera: () => void;
  onViewAllReports: () => void;
  onViewDashboard: () => void;
  onSelectComplaint: (complaint: Complaint) => void;
  onVote: (complaintId: string) => void;
}

const HomePage = ({
  currentUserName,
  currentUserId,
  userRole,
  stats,
  filteredComplaints,
  onOpenCamera,
  onViewAllReports,
  onViewDashboard,
  onSelectComplaint,
  onVote,
}: HomePageProps) => (
  <div className="min-h-screen bg-gray-50 pb-24">
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Welcome Banner */}
      <div className={`rounded-2xl p-6 mb-6 text-white ${
        userRole === 'admin'
          ? 'bg-gradient-to-r from-gray-800 to-gray-900'
          : 'bg-gradient-to-r from-blue-600 to-indigo-600'
      }`}>
        <h2 className="text-xl font-bold mb-2">Welcome, {currentUserName || 'User'}!</h2>
        <p className={`text-sm mb-4 ${userRole === 'admin' ? 'text-gray-300' : 'text-blue-100'}`}>
          {userRole === 'admin'
            ? 'Manage and resolve civic grievances efficiently.'
            : 'Help improve your community by reporting civic issues.'}
        </p>
        {/* BUG FIX: Different button for citizen vs admin */}
        {userRole === 'admin' ? (
          <button
            onClick={onViewDashboard}
            className="bg-white text-gray-800 font-semibold px-6 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            📊 View Dashboard
          </button>
        ) : (
          <button
            onClick={onOpenCamera}
            className="bg-white text-blue-600 font-semibold px-6 py-2 rounded-xl hover:bg-blue-50 transition-colors"
          >
            📷 Report an Issue
          </button>
        )}
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{stats.totalComplaints}</p>
            <p className="text-sm text-gray-500">Total Reports</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-green-600">{stats.resolvedComplaints}</p>
            <p className="text-sm text-gray-500">Resolved</p>
          </div>
        </div>
      )}

      {/* Recent Reports */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Recent Reports</h3>
          <button onClick={onViewAllReports} className="text-blue-600 text-sm font-medium">
            View All →
          </button>
        </div>
        <div className="space-y-3">
          {filteredComplaints.slice(0, 3).map((complaint) => (
            <ComplaintCard
              key={complaint.id}
              complaint={complaint}
              onClick={() => onSelectComplaint(complaint)}
              onVote={() => onVote(complaint.id)}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default HomePage;
