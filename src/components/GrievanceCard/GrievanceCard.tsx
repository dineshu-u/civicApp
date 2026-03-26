// ============================================
// COMPLAINT CARD COMPONENT
// ============================================

import { formatDistanceToNow } from 'date-fns';
import { Complaint, CATEGORY_CONFIG, STATUS_CONFIG } from '../../types';

interface ComplaintCardProps {
  complaint: Complaint;
  onClick: () => void;
  onVote: () => void;
  currentUserId: string;
}

const ComplaintCard = ({ complaint, onClick, onVote, currentUserId }: ComplaintCardProps) => {
  const categoryConfig = CATEGORY_CONFIG[complaint.category];
  const statusConfig = STATUS_CONFIG[complaint.status];
  const hasVoted = complaint.voters.includes(currentUserId);

  return (
    <div
      className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex">
        <div className="w-24 h-24 flex-shrink-0">
          <img src={complaint.imageUrl} alt={complaint.title} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: categoryConfig.color + '20', color: categoryConfig.color }}
            >
              {categoryConfig.icon} {categoryConfig.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{complaint.title}</h3>
          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{complaint.address}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(complaint.createdAt), { addSuffix: true })}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onVote();
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                hasVoted ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill={hasVoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              {complaint.votes}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplaintCard;
