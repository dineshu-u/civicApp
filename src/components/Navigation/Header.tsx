// ============================================
// HEADER COMPONENT
// BUG FIX: "Digital Grievance" → "TeNet"
// BUG FIX: TeNet logo/text is now clickable → navigates to Home
// ============================================

import { Notification } from '../../types';

interface HeaderProps {
  userRole: 'citizen' | 'admin' | null;
  currentUserName: string;
  notifications: Notification[];
  onNavigateHome: () => void;
  onNavigateNotifications: () => void;
  onNavigateProfile: () => void;
}

const Header = ({
  userRole,
  currentUserName,
  notifications,
  onNavigateHome,
  onNavigateNotifications,
  onNavigateProfile,
}: HeaderProps) => {
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* BUG FIX: Logo is now clickable and navigates to Home */}
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-xl">🏛️</span>
          </div>
          <div className="text-left">
            {/* BUG FIX: Changed from "Digital Grievance" to "TeNet" */}
            <h1 className="font-bold text-gray-900">TeNet</h1>
            <p className="text-xs text-gray-500">{userRole === 'admin' ? 'Admin Portal' : 'Citizen Portal'}</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateNotifications}
            className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          <button onClick={onNavigateProfile} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-lg font-semibold text-gray-600">{currentUserName?.charAt(0) || 'U'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
