// ============================================
// NOTIFICATIONS PAGE
// ============================================

import { formatDistanceToNow } from 'date-fns';
import { Notification } from '../types';

interface NotificationsPageProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onGoBack: () => void;
}

const NotificationsPage = ({ notifications, onMarkRead, onGoBack }: NotificationsPageProps) => (
  <div className="min-h-screen bg-gray-50 pb-24">
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <button onClick={onGoBack} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
      </div>
    </div>

    <div className="max-w-7xl mx-auto px-4 py-6">
      {notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => onMarkRead(notif.id)}
              className={`bg-white rounded-2xl p-4 shadow-sm cursor-pointer ${!notif.isRead ? 'border-l-4 border-blue-500' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  notif.type === 'status_update' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  <span className="text-xl">{notif.type === 'status_update' ? '📢' : '👍'}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{notif.title}</p>
                  <p className="text-sm text-gray-500">{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl">🔔</span>
          </div>
          <p className="text-gray-500">No notifications yet</p>
        </div>
      )}
    </div>
  </div>
);

export default NotificationsPage;
