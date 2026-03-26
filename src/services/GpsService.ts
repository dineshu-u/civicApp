// ============================================
// ENHANCED GPS SERVICE (Ola/Uber-like)
// ============================================

import localforage from 'localforage';
import { GpsLocation, ValidationFlag, VALIDATION_CONFIG } from '../types';

export interface GpsReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

export interface EnhancedGpsState {
  currentLocation: GpsLocation | null;
  bestLocation: GpsLocation | null;
  accuracy: number;
  isTracking: boolean;
  readings: GpsReading[];
  averagedLocation: { lat: number; lng: number } | null;
  status: 'idle' | 'acquiring' | 'locked' | 'error';
  signalStrength: 'none' | 'weak' | 'medium' | 'strong' | 'excellent';
  errorMessage: string | null;
}

export const EnhancedGpsService = {
  // Calculate weighted average of GPS readings (more recent = higher weight)
  calculateWeightedAverage: (readings: GpsReading[]): { lat: number; lng: number; accuracy: number } => {
    if (readings.length === 0) return { lat: 0, lng: 0, accuracy: Infinity };

    const now = Date.now();
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;
    let minAccuracy = Infinity;

    readings.forEach((reading) => {
      const age = (now - reading.timestamp) / 1000;
      const recencyWeight = Math.exp(-age / 10);
      const accuracyWeight = 1 / Math.max(reading.accuracy, 1);
      const weight = recencyWeight * accuracyWeight;

      weightedLat += reading.latitude * weight;
      weightedLng += reading.longitude * weight;
      totalWeight += weight;
      minAccuracy = Math.min(minAccuracy, reading.accuracy);
    });

    return {
      lat: weightedLat / totalWeight,
      lng: weightedLng / totalWeight,
      accuracy: minAccuracy,
    };
  },

  // Get signal strength category
  getSignalStrength: (accuracy: number): 'none' | 'weak' | 'medium' | 'strong' | 'excellent' => {
    if (accuracy <= 5) return 'excellent';
    if (accuracy <= 15) return 'strong';
    if (accuracy <= 50) return 'medium';
    if (accuracy <= 100) return 'weak';
    return 'none';
  },

  // Kalman filter for smoothing GPS readings
  kalmanFilter: (readings: GpsReading[]): GpsReading | null => {
    if (readings.length === 0) return null;
    if (readings.length === 1) return readings[0];

    const recent = readings.slice(-5);
    const avg = EnhancedGpsService.calculateWeightedAverage(recent);

    return {
      latitude: avg.lat,
      longitude: avg.lng,
      accuracy: avg.accuracy,
      timestamp: Date.now(),
    };
  },

  // Start high-accuracy GPS tracking — 3-phase strategy (Ola/Uber-like)
  // Phase 1: Instant  — getCurrent with maximumAge:60000 (cached, <100ms)
  // Phase 2: Fast     — watchPosition with enableHighAccuracy:false (coarse, <2s)
  // Phase 3: Precise  — watchPosition with enableHighAccuracy:true (refined, ongoing)
  startTracking: (
    onUpdate: (state: EnhancedGpsState) => void,
    onError: (error: string) => void
  ): { watchId: number; stop: () => void } | null => {
    if (!navigator.geolocation) {
      onError('Geolocation not supported');
      return null;
    }

    const readings: GpsReading[] = [];
    let bestLocation: GpsLocation | null = null;
    let fastWatchId: number | null = null;
    let preciseWatchId: number | null = null;
    let stopped = false;

    const buildState = (
      location: GpsLocation,
      status: EnhancedGpsState['status']
    ): EnhancedGpsState => {
      const filtered = EnhancedGpsService.kalmanFilter(readings);
      const currentLocation: GpsLocation = {
        latitude: filtered?.latitude ?? location.latitude,
        longitude: filtered?.longitude ?? location.longitude,
        accuracy: filtered?.accuracy ?? location.accuracy,
        timestamp: location.timestamp,
        speed: location.speed,
        heading: location.heading,
      };
      return {
        currentLocation,
        bestLocation,
        accuracy: currentLocation.accuracy,
        isTracking: true,
        readings: [...readings],
        averagedLocation: filtered
          ? { lat: filtered.latitude, lng: filtered.longitude }
          : null,
        status,
        signalStrength: EnhancedGpsService.getSignalStrength(currentLocation.accuracy),
        errorMessage: null,
      };
    };

    const handlePosition = (position: GeolocationPosition) => {
      if (stopped) return;
      const reading: GpsReading = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        speed: position.coords.speed ?? undefined,
        heading: position.coords.heading ?? undefined,
      };

      readings.push(reading);
      if (readings.length > 10) readings.shift();

      const asLocation: GpsLocation = {
        latitude: reading.latitude,
        longitude: reading.longitude,
        accuracy: reading.accuracy,
        timestamp: reading.timestamp,
        speed: reading.speed,
        heading: reading.heading,
      };

      if (!bestLocation || reading.accuracy < bestLocation.accuracy) {
        bestLocation = asLocation;
      }

      const status = reading.accuracy <= 50 ? 'locked' : 'acquiring';
      onUpdate(buildState(asLocation, status));
    };

    const handleError = (error: GeolocationPositionError) => {
      if (stopped) return;
      let errorMessage = 'Unable to get location';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location permission denied. Please enable in settings.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location unavailable. Move to open area.';
          break;
        case error.TIMEOUT:
          errorMessage = 'Location timeout. Retrying...';
          break;
      }
      onUpdate({
        currentLocation: null,
        bestLocation,
        accuracy: Infinity,
        isTracking: true,
        readings,
        averagedLocation: null,
        status: 'error',
        signalStrength: 'none',
        errorMessage,
      });
      onError(errorMessage);
    };

    // ── Phase 1: Instant cached fix ───────────────────────────────────────────
    navigator.geolocation.getCurrentPosition(
      handlePosition,
      () => { /* silently ignore — phases 2+3 will cover */ },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 2000 }
    );

    // ── Phase 2: Fast coarse fix ──────────────────────────────────────────────
    fastWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        handlePosition(pos);
        // Once we have a reasonable coarse fix, stop phase 2 (phase 3 takes over)
        if (pos.coords.accuracy <= 200 && preciseWatchId !== null) {
          if (fastWatchId !== null) {
            navigator.geolocation.clearWatch(fastWatchId);
            fastWatchId = null;
          }
        }
      },
      handleError,
      { enableHighAccuracy: false, maximumAge: 5000, timeout: 10000 }
    );

    // ── Phase 3: High-accuracy refinement (starts immediately in parallel) ────
    preciseWatchId = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );

    const stop = () => {
      stopped = true;
      if (fastWatchId !== null) navigator.geolocation.clearWatch(fastWatchId);
      if (preciseWatchId !== null) navigator.geolocation.clearWatch(preciseWatchId);
    };

    // Return a sentinel watchId (preciseWatchId) so callers can still clearWatch if needed
    return { watchId: preciseWatchId, stop };
  },

  // Reverse geocoding with caching
  reverseGeocode: async (lat: number, lng: number): Promise<string> => {
    const cacheKey = `geo_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const cached = await localforage.getItem<string>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'TeNet/1.0' } }
      );
      const data = await response.json();
      const address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      await localforage.setItem(cacheKey, address);
      return address;
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  },

  validateLocation: (location: GpsLocation, captureTime: number): { isValid: boolean; confidence: number; flags: ValidationFlag[] } => {
    const flags: ValidationFlag[] = [];
    let confidence = 1;

    if (location.accuracy > VALIDATION_CONFIG.MAX_GPS_ACCURACY) {
      const penalty = Math.min(0.5, (location.accuracy - VALIDATION_CONFIG.MAX_GPS_ACCURACY) / 500);
      confidence -= penalty;
      flags.push({
        type: location.accuracy > 500 ? 'error' : 'warning',
        code: 'LOW_ACCURACY',
        message: `GPS accuracy: ${Math.round(location.accuracy)}m (recommended: <${VALIDATION_CONFIG.MAX_GPS_ACCURACY}m)`,
        severity: location.accuracy > 500 ? 'high' : 'medium',
      });
    }

    const age = Date.now() - captureTime;
    if (age > VALIDATION_CONFIG.MAX_CAPTURE_AGE) {
      const penalty = Math.min(0.4, (age - VALIDATION_CONFIG.MAX_CAPTURE_AGE) / (10 * 60 * 1000));
      confidence -= penalty;
      flags.push({
        type: 'warning',
        code: 'STALE_CAPTURE',
        message: `Location captured ${Math.round(age / 60000)} minutes ago`,
        severity: 'medium',
      });
    }

    confidence = Math.max(0, confidence);

    return {
      isValid: confidence > 0.5 && !flags.some((f) => f.type === 'error'),
      confidence,
      flags,
    };
  },
};
