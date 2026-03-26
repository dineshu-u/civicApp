// ============================================
// MY GRIEVANCES / FEED PAGE
// ============================================

import { Complaint, ComplaintCategory, ComplaintStatus, CATEGORY_CONFIG, STATUS_CONFIG } from '../types';
import { ComplaintFilters, SortOption } from '../types';
import ComplaintCard from '../components/GrievanceCard/GrievanceCard';

interface MyGrievancesPageProps {
  filteredComplaints: Complaint[];
  searchQuery: string;
  filters: ComplaintFilters;
  sortBy: SortOption;
  currentUserId: string;
  onSearchChange: (query: string) => void;
  onFiltersChange: (filters: ComplaintFilters) => void;
  onSortChange: (sort: SortOption) => void;
  onSelectComplaint: (complaint: Complaint) => void;
  onVote: (complaintId: string) => void;
  onGoBack: () => void;
}

const MyGrievancesPage = ({
  filteredComplaints,
  searchQuery,
  filters,
  sortBy,
  currentUserId,
  onSearchChange,
  onFiltersChange,
  onSortChange,
  onSelectComplaint,
  onVote,
  onGoBack,
}: MyGrievancesPageProps) => (
  <div className="min-h-screen bg-gray-50 pb-24">
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onGoBack} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Reports</h1>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search reports..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <select
            value={filters.category || 'all'}
            onChange={(e) => onFiltersChange({ ...filters, category: e.target.value as ComplaintCategory | 'all' })}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.icon} {val.label}</option>
            ))}
          </select>

          <select
            value={filters.status || 'all'}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as ComplaintStatus | 'all' })}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="priority">Priority</option>
            <option value="votes">Most Voted</option>
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
            <option value="severity">Severity</option>
          </select>
        </div>
      </div>
    </div>

    <div className="max-w-7xl mx-auto px-4 py-4">
      <div className="space-y-3">
        {filteredComplaints.map((complaint) => (
          <ComplaintCard
            key={complaint.id}
            complaint={complaint}
            onClick={() => onSelectComplaint(complaint)}
            onVote={() => onVote(complaint.id)}
            currentUserId={currentUserId}
          />
        ))}
      </div>
      {filteredComplaints.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No reports found</p>
        </div>
      )}
    </div>
  </div>
);

export default MyGrievancesPage;
