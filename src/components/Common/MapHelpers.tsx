// ============================================
// MAP HELPER COMPONENTS & UTILITIES
// ============================================

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { ComplaintCategory, CATEGORY_CONFIG } from '../../types';

// ============================================
// LEAFLET ICON FIX
// ============================================
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => void })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ============================================
// CUSTOM MAP ICONS
// ============================================

export const createCategoryIcon = (category: ComplaintCategory) => {
  const color = CATEGORY_CONFIG[category]?.color || '#6366F1';
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span style="transform: rotate(45deg); font-size: 18px;">${CATEGORY_CONFIG[category]?.icon || '📍'}</span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
};

// User location marker (Ola/Uber style pulsing)
export const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `
    <div style="position: relative;">
      <div style="
        position: absolute;
        width: 80px;
        height: 80px;
        background: rgba(37, 99, 235, 0.15);
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        animation: pulse-ring 2s ease-out infinite;
      "></div>
      <div style="
        position: absolute;
        width: 40px;
        height: 40px;
        background: rgba(37, 99, 235, 0.3);
        border-radius: 50%;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        animation: pulse-ring 2s ease-out infinite 0.5s;
      "></div>
      <div style="
        width: 20px;
        height: 20px;
        background: #2563EB;
        border: 4px solid white;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.5);
        position: relative;
      "></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// ============================================
// MAP RECENTER COMPONENT
// ============================================

export const MapRecenter = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
};
