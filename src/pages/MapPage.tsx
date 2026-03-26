// ============================================
// MAP PAGE (Ola/Uber style with Leaflet)
// ============================================

import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { formatDistanceToNow } from 'date-fns';
import { Complaint, CATEGORY_CONFIG, STATUS_CONFIG } from '../types';
import { EnhancedGpsService, EnhancedGpsState } from '../services/GpsService';
import { createCategoryIcon, userLocationIcon, MapRecenter } from '../components/Common/MapHelpers';

interface MapPageProps {
  complaints: Complaint[];
  userLocation: { lat: number; lng: number } | null;
  mapCenter: { lat: number; lng: number };
  gpsState: EnhancedGpsState;
  onSetUserLocation: (loc: { lat: number; lng: number }) => void;
  onSetMapCenter: (center: { lat: number; lng: number }) => void;
  onSelectComplaint: (complaint: Complaint) => void;
  onSetError: (err: string) => void;
  onGoBack: () => void;
}

const MapPage = ({
  complaints,
  userLocation,
  mapCenter,
  gpsState,
  onSetUserLocation,
  onSetMapCenter,
  onSelectComplaint,
  onSetError,
  onGoBack,
}: MapPageProps) => (
  <div className="min-h-screen bg-gray-50 pb-24">
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onGoBack} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Map View</h1>
        </div>
        <button
          onClick={() => {
            if (userLocation) {
              onSetMapCenter(userLocation);
            } else {
              const tracker = EnhancedGpsService.startTracking(
                (state) => {
                  if (state.currentLocation) {
                    onSetUserLocation({
                      lat: state.currentLocation.latitude,
                      lng: state.currentLocation.longitude,
                    });
                    onSetMapCenter({
                      lat: state.currentLocation.latitude,
                      lng: state.currentLocation.longitude,
                    });
                  }
                },
                (err) => onSetError(err)
              );
              if (tracker) {
                setTimeout(() => tracker.stop(), 10000);
              }
            }
          }}
          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>

    <div className="relative" style={{ height: 'calc(100vh - 180px)' }}>
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        className="z-10"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapRecenter lat={mapCenter.lat} lng={mapCenter.lng} />

        {/* User location marker with accuracy circle */}
        {userLocation && (
          <>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={gpsState.accuracy || 50}
              pathOptions={{
                color: '#2563EB',
                fillColor: '#2563EB',
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
              <Popup>
                <div className="text-center p-2">
                  <p className="font-semibold text-gray-900">Your Location</p>
                  <p className="text-sm text-gray-500">Accuracy: {Math.round(gpsState.accuracy || 0)}m</p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Complaint markers */}
        {complaints.map((complaint) => (
          <Marker
            key={complaint.id}
            position={[complaint.location.latitude, complaint.location.longitude]}
            icon={createCategoryIcon(complaint.category)}
          >
            <Popup>
              <div className="w-64">
                <img
                  src={complaint.imageUrl}
                  alt={complaint.title}
                  className="w-full h-32 object-cover rounded-lg mb-2"
                />
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: CATEGORY_CONFIG[complaint.category].color + '20',
                      color: CATEGORY_CONFIG[complaint.category].color,
                    }}
                  >
                    {CATEGORY_CONFIG[complaint.category].icon} {CATEGORY_CONFIG[complaint.category].label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[complaint.status].color}`}>
                    {STATUS_CONFIG[complaint.status].label}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{complaint.title}</h3>
                <p className="text-xs text-gray-500 mb-2">{complaint.address}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(complaint.createdAt), { addSuffix: true })}
                  </span>
                  <span className="text-xs font-medium text-blue-600">👍 {complaint.votes} votes</span>
                </div>
                <button
                  onClick={() => onSelectComplaint(complaint)}
                  className="w-full mt-2 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700"
                >
                  View Details
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-lg p-3 z-20">
        <p className="text-xs font-semibold text-gray-500 mb-2">Categories</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_CONFIG).slice(0, 6).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: val.color }} />
              <span className="text-xs text-gray-600">{val.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default MapPage;
