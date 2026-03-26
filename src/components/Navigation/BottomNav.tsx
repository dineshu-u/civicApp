// ============================================
// BOTTOM NAVIGATION COMPONENT
// BUG FIX: Role-based nav items
//   - Citizen: Home, Reports, 📷 Report (camera), Map, Stats
//   - Admin: Home, Reports, Map, 📊 Dashboard, 👤 Profile (no camera)
// ============================================

type PageType = 'home' | 'feed' | 'camera' | 'map' | 'dashboard' | 'profile' | 'detail' | 'preview' | 'notifications' | 'login';

interface BottomNavProps {
  currentPage: PageType;
  userRole: 'citizen' | 'admin' | null;
  onNavigate: (page: PageType) => void;
  onOpenCamera: () => void;
}

const BottomNav = ({ currentPage, userRole, onNavigate, onOpenCamera }: BottomNavProps) => {
  // BUG FIX: Different nav items for citizen vs admin
  const citizenNavItems = [
    { id: 'home' as PageType, icon: '🏠', label: 'Home' },
    { id: 'feed' as PageType, icon: '📋', label: 'Reports' },
    { id: 'camera' as PageType, icon: '📷', label: 'Report', isMain: true },
    { id: 'map' as PageType, icon: '🗺️', label: 'Map' },
    { id: 'dashboard' as PageType, icon: '📊', label: 'Stats' },
  ];

  const adminNavItems = [
    { id: 'home' as PageType, icon: '🏠', label: 'Home' },
    { id: 'feed' as PageType, icon: '📋', label: 'Reports' },
    { id: 'map' as PageType, icon: '🗺️', label: 'Map' },
    { id: 'dashboard' as PageType, icon: '📊', label: 'Dashboard', isMain: true },
    { id: 'profile' as PageType, icon: '👤', label: 'Profile' },
  ];

  const navItems = userRole === 'admin' ? adminNavItems : citizenNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'camera') {
                  onOpenCamera();
                } else {
                  onNavigate(item.id);
                }
              }}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
                item.isMain
                  ? userRole === 'admin'
                    ? 'bg-gray-800 text-white -mt-6 shadow-lg'
                    : 'bg-blue-600 text-white -mt-6 shadow-lg'
                  : currentPage === item.id
                  ? 'text-blue-600'
                  : 'text-gray-500'
              }`}
            >
              <span className={item.isMain ? 'text-2xl' : 'text-xl'}>{item.icon}</span>
              <span className="text-xs mt-0.5">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
