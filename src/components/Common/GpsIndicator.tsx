// ============================================
// GPS INDICATOR COMPONENT (Ola/Uber style)
// ============================================

import { EnhancedGpsState } from '../../services/GpsService';

interface GpsIndicatorProps {
  gpsState: EnhancedGpsState;
}

const GpsIndicator = ({ gpsState }: GpsIndicatorProps) => {
  const { status, signalStrength, accuracy, currentLocation } = gpsState;

  const getSignalBars = () => {
    const bars = ['none', 'weak', 'medium', 'strong', 'excellent'].indexOf(signalStrength);
    return Array(4).fill(0).map((_, i) => (
      <div
        key={i}
        className={`w-1 rounded-full transition-all ${
          i < bars ? 'bg-green-500' : 'bg-gray-300'
        }`}
        style={{ height: `${8 + i * 4}px` }}
      />
    ));
  };

  const statusColors = {
    idle: 'bg-gray-100 text-gray-600',
    acquiring: 'bg-yellow-100 text-yellow-700',
    locked: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };

  const statusLabels = {
    idle: 'GPS Idle',
    acquiring: 'Acquiring GPS...',
    locked: `GPS Locked • ${Math.round(accuracy)}m`,
    error: 'GPS Error',
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl ${statusColors[status]}`}>
      <div className="flex items-end gap-0.5 h-6">
        {getSignalBars()}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{statusLabels[status]}</p>
        {currentLocation && status === 'locked' && (
          <p className="text-xs opacity-75">
            {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
          </p>
        )}
      </div>
      {status === 'locked' && (
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
      )}
      {status === 'acquiring' && (
        <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  );
};

export default GpsIndicator;
