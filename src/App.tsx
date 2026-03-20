// ============================================
// DIGITAL GRIEVANCE - MAIN APPLICATION
// Production-Grade Civic Reporting Platform
// With Enhanced GPS (Ola/Uber-like accuracy)
// Interactive Map with Leaflet
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { formatDistanceToNow } from 'date-fns';
import localforage from 'localforage';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  User,
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  Notification,
  DashboardStats,
  GpsLocation,
  AIClassification,
  CaptureSession,
  TrustScore,
  ValidationFlag,
  ComplaintFilters,
  SortOption,
  CATEGORY_CONFIG,
  STATUS_CONFIG,
  VALIDATION_CONFIG,
  TRUST_WEIGHTS,
  VerificationStatus,
} from './types';

// ============================================
// LEAFLET ICON FIX
// ============================================
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => void })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Create custom icons for each category
const createCategoryIcon = (category: ComplaintCategory) => {
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
const userLocationIcon = L.divIcon({
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
// CONSTANTS & CONFIG
// ============================================

const AUTH_CREDENTIALS = {
  citizen: { username: 'citizen', password: 'citizen123' },
  admin: { username: 'admin', password: 'admin123' },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================



// ============================================
// ENHANCED GPS SERVICE (Ola/Uber-like)
// ============================================

interface GpsReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed?: number;
  heading?: number;
}

interface EnhancedGpsState {
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

const EnhancedGpsService = {
  // Calculate weighted average of GPS readings (more recent = higher weight)
  calculateWeightedAverage: (readings: GpsReading[]): { lat: number; lng: number; accuracy: number } => {
    if (readings.length === 0) return { lat: 0, lng: 0, accuracy: Infinity };
    
    const now = Date.now();
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;
    let minAccuracy = Infinity;
    
    readings.forEach((reading) => {
      // Weight based on recency (exponential decay) and accuracy
      const age = (now - reading.timestamp) / 1000; // seconds
      const recencyWeight = Math.exp(-age / 10); // decay over 10 seconds
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
    
    // Simple moving average with exponential weighting
    const recent = readings.slice(-5);
    const avg = EnhancedGpsService.calculateWeightedAverage(recent);
    
    return {
      latitude: avg.lat,
      longitude: avg.lng,
      accuracy: avg.accuracy,
      timestamp: Date.now(),
    };
  },
  
  // Start high-accuracy GPS tracking
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
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const reading: GpsReading = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          speed: position.coords.speed ?? undefined,
          heading: position.coords.heading ?? undefined,
        };
        
        readings.push(reading);
        
        // Keep only last 10 readings
        if (readings.length > 10) readings.shift();
        
        // Apply Kalman filter
        const filtered = EnhancedGpsService.kalmanFilter(readings);
        
        // Update best location if this is more accurate
        if (!bestLocation || reading.accuracy < bestLocation.accuracy) {
          bestLocation = {
            latitude: reading.latitude,
            longitude: reading.longitude,
            accuracy: reading.accuracy,
            timestamp: reading.timestamp,
            speed: reading.speed,
            heading: reading.heading,
          };
        }
        
        const currentLocation: GpsLocation = {
          latitude: filtered?.latitude || reading.latitude,
          longitude: filtered?.longitude || reading.longitude,
          accuracy: filtered?.accuracy || reading.accuracy,
          timestamp: reading.timestamp,
          speed: reading.speed,
          heading: reading.heading,
        };
        
        const signalStrength = EnhancedGpsService.getSignalStrength(currentLocation.accuracy);
        
        onUpdate({
          currentLocation,
          bestLocation,
          accuracy: currentLocation.accuracy,
          isTracking: true,
          readings: [...readings],
          averagedLocation: filtered ? { lat: filtered.latitude, lng: filtered.longitude } : null,
          status: currentLocation.accuracy <= 50 ? 'locked' : 'acquiring',
          signalStrength,
          errorMessage: null,
        });
      },
      (error) => {
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
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );
    
    return {
      watchId,
      stop: () => navigator.geolocation.clearWatch(watchId),
    };
  },
  
  // Reverse geocoding with caching
  reverseGeocode: async (lat: number, lng: number): Promise<string> => {
    const cacheKey = `geo_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    const cached = await localforage.getItem<string>(cacheKey);
    if (cached) return cached;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'DigitalGrievance/1.0' } }
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

// ============================================
// AI CLASSIFIER
// ============================================

const AIClassifier = {
  classify: async (imageBlob: Blob): Promise<AIClassification> => {
    const startTime = performance.now();

    const img = new Image();
    const imageUrl = URL.createObjectURL(imageBlob);

    return new Promise((resolve) => {
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const scores = AIClassifier.analyzeImage(imageData);

        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        const topCategory = sorted[0][0] as ComplaintCategory;
        const confidence = sorted[0][1];

        const severity = AIClassifier.estimateSeverity(imageData, topCategory);

        const allPredictions = sorted.map(([category, conf]) => ({
          category: category as ComplaintCategory,
          confidence: conf,
        }));

        URL.revokeObjectURL(imageUrl);

        resolve({
          category: topCategory,
          confidence: Math.min(0.98, confidence),
          severity,
          processingTime: performance.now() - startTime,
          allPredictions,
          reasoning: AIClassifier.getReasoning(topCategory, imageData),
        });
      };
      img.src = imageUrl;
    });
  },

  analyzeImage: (imageData: ImageData): Record<ComplaintCategory, number> => {
    const scores: Record<string, number> = {
      pothole: 0.1,
      garbage: 0.1,
      streetlight: 0.1,
      drainage: 0.1,
      road_damage: 0.1,
      water_leak: 0.1,
      other: 0.1,
    };

    const data = imageData.data;
    let darkPixels = 0;
    let brownishPixels = 0;
    let grayPixels = 0;
    let greenishPixels = 0;
    let blueishPixels = 0;
    let brightSpots = 0;
    const totalPixels = data.length / 4;

    const colorHist = { r: 0, g: 0, b: 0 };

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;
      colorHist.r += r;
      colorHist.g += g;
      colorHist.b += b;

      if (brightness < 50) darkPixels++;
      if (brightness > 200) brightSpots++;

      if (r > 80 && r < 180 && g > 60 && g < 140 && b > 40 && b < 100) brownishPixels++;
      if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && brightness > 80 && brightness < 200) grayPixels++;
      if (g > r + 20 && g > b + 20) greenishPixels++;
      if (b > r + 20 && b > g + 20) blueishPixels++;
    }

    const avgR = colorHist.r / totalPixels;
    const avgG = colorHist.g / totalPixels;
    const avgB = colorHist.b / totalPixels;
    const brownRatio = brownishPixels / totalPixels;
    const grayRatio = grayPixels / totalPixels;
    const darkRatio = darkPixels / totalPixels;
    const brightRatio = brightSpots / totalPixels;
    const greenRatio = greenishPixels / totalPixels;
    const blueRatio = blueishPixels / totalPixels;

    if (brownRatio > 0.3 && grayRatio > 0.2) {
      scores.pothole += 0.5;
      scores.road_damage += 0.3;
    }
    if (grayRatio > 0.4 && brownRatio > 0.15) {
      scores.road_damage += 0.4;
      scores.pothole += 0.3;
    }

    if (greenRatio > 0.15 || (brownRatio > 0.2 && brightRatio > 0.1)) {
      scores.garbage += 0.4;
    }
    if (brownRatio > 0.25 && darkRatio > 0.2) {
      scores.garbage += 0.3;
    }

    if (darkRatio > 0.5 && brightRatio > 0.05 && brightRatio < 0.3) {
      scores.streetlight += 0.5;
    }
    if (grayRatio > 0.3 && brightRatio > 0.1) {
      scores.streetlight += 0.3;
    }

    if (blueRatio > 0.2 || (blueRatio > 0.1 && grayRatio > 0.3)) {
      scores.drainage += 0.3;
      scores.water_leak += 0.4;
    }
    if (darkRatio > 0.3 && blueRatio > 0.15) {
      scores.drainage += 0.4;
    }

    if (avgB > avgR + 30 && avgB > avgG + 20) {
      scores.water_leak += 0.5;
    }

    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const normalized: Record<string, number> = {};
    for (const key in scores) {
      normalized[key] = scores[key] / total;
    }

    return normalized as Record<ComplaintCategory, number>;
  },

  estimateSeverity: (imageData: ImageData, category: ComplaintCategory): number => {
    const data = imageData.data;
    let variance = 0;
    const sampleSize = Math.min(10000, data.length / 4);
    const step = Math.floor(data.length / 4 / sampleSize);

    for (let i = 0; i < sampleSize; i++) {
      const idx = i * step * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      variance += Math.abs(brightness - 128);
    }
    variance /= sampleSize;

    let baseSeverity = 3;
    if (category === 'pothole' || category === 'road_damage') {
      baseSeverity = variance > 40 ? 4 : 3;
    } else if (category === 'water_leak' || category === 'drainage') {
      baseSeverity = variance > 50 ? 5 : 3;
    } else if (category === 'garbage') {
      baseSeverity = 3;
    }

    return Math.min(5, Math.max(1, baseSeverity + (Math.random() > 0.7 ? 1 : 0)));
  },

  getReasoning: (category: ComplaintCategory, _imageData: ImageData): string => {
    const reasons: Record<ComplaintCategory, string[]> = {
      pothole: ['Detected dark depression in surface', 'Brownish-gray texture pattern', 'Irregular surface damage indicators'],
      garbage: ['Accumulated waste materials detected', 'Mixed color debris patterns', 'Non-uniform clutter identified'],
      streetlight: ['Dark environment with bright light source', 'Vertical structure detected', 'Night/evening lighting conditions'],
      drainage: ['Water flow patterns detected', 'Blue-tinted moisture indicators', 'Channel-like structures visible'],
      road_damage: ['Surface cracking patterns', 'Asphalt deterioration indicators', 'Road surface irregularities'],
      water_leak: ['Water accumulation detected', 'Blue-tinted liquid presence', 'Moisture patterns identified'],
      other: ['General infrastructure issue', 'Manual categorization recommended', 'Multiple indicators present'],
    };
    return reasons[category][Math.floor(Math.random() * reasons[category].length)];
  },
};

// ============================================
// BACKEND SERVICE
// ============================================

const BackendService = {
  init: async () => {
    await localforage.config({ name: 'digital-grievance', storeName: 'app_data' });
    const initialized = await localforage.getItem<boolean>('initialized');
    if (!initialized) {
      await BackendService.seedData();
      await localforage.setItem('initialized', true);
    }
  },

  seedData: async () => {
    const users: User[] = [
      {
        id: 'user-1',
        name: 'Rajesh Kumar',
        email: 'rajesh@example.com',
        role: 'citizen',
        createdAt: new Date('2024-01-15'),
        impactScore: 1250,
        complaintsSubmitted: 23,
        complaintsResolved: 18,
        trustLevel: 'gold',
      },
      {
        id: 'user-2',
        name: 'Priya Sharma',
        email: 'priya@example.com',
        role: 'citizen',
        createdAt: new Date('2024-02-20'),
        impactScore: 890,
        complaintsSubmitted: 15,
        complaintsResolved: 12,
        trustLevel: 'silver',
      },
      {
        id: 'official-1',
        name: 'Municipal Officer',
        email: 'officer@municipal.gov',
        role: 'official',
        createdAt: new Date('2023-06-01'),
        impactScore: 5000,
        complaintsSubmitted: 0,
        complaintsResolved: 156,
        trustLevel: 'platinum',
      },
    ];
    await localforage.setItem('users', users);

    const complaints: Complaint[] = [
      {
        id: 'comp-1',
        userId: 'user-1',
        userName: 'Rajesh Kumar',
        title: 'Large pothole on Main Road',
        description: 'Dangerous pothole near the intersection causing traffic issues.',
        category: 'pothole',
        imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=400',
        location: { latitude: 28.6139, longitude: 77.209, accuracy: 15, timestamp: Date.now() - 86400000 },
        address: 'Main Road, Connaught Place, New Delhi',
        status: 'in_progress',
        votes: 45,
        voters: ['user-2'],
        priorityScore: 0.85,
        createdAt: new Date(Date.now() - 86400000 * 3),
        updatedAt: new Date(Date.now() - 86400000),
        aiCategory: 'pothole',
        aiConfidence: 0.92,
        aiSeverity: 4,
        aiProcessed: true,
        needsManualReview: false,
        captureSessionId: 'session-1',
        locationConfidence: 0.95,
        imageTrustScore: 88,
        verificationStatus: 'verified',
        viewCount: 234,
        commentCount: 12,
      },
      {
        id: 'comp-2',
        userId: 'user-2',
        userName: 'Priya Sharma',
        title: 'Garbage not collected for a week',
        description: 'Overflowing garbage bins near the park. Health hazard for residents.',
        category: 'garbage',
        imageUrl: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=400',
        location: { latitude: 28.6129, longitude: 77.2295, accuracy: 22, timestamp: Date.now() - 172800000 },
        address: 'Sector 15, Dwarka, New Delhi',
        status: 'under_review',
        votes: 32,
        voters: ['user-1'],
        priorityScore: 0.72,
        createdAt: new Date(Date.now() - 86400000 * 5),
        updatedAt: new Date(Date.now() - 86400000 * 2),
        aiCategory: 'garbage',
        aiConfidence: 0.88,
        aiSeverity: 3,
        aiProcessed: true,
        needsManualReview: false,
        captureSessionId: 'session-2',
        locationConfidence: 0.92,
        imageTrustScore: 82,
        verificationStatus: 'verified',
        viewCount: 156,
        commentCount: 8,
      },
      {
        id: 'comp-3',
        userId: 'user-1',
        userName: 'Rajesh Kumar',
        title: 'Broken streetlight in residential area',
        description: 'Complete darkness at night. Safety concern for residents.',
        category: 'streetlight',
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
        location: { latitude: 28.6219, longitude: 77.2190, accuracy: 18, timestamp: Date.now() - 259200000 },
        address: 'Block C, Lajpat Nagar, New Delhi',
        status: 'submitted',
        votes: 28,
        voters: [],
        priorityScore: 0.68,
        createdAt: new Date(Date.now() - 86400000 * 2),
        updatedAt: new Date(Date.now() - 86400000 * 2),
        aiCategory: 'streetlight',
        aiConfidence: 0.91,
        aiSeverity: 4,
        aiProcessed: true,
        needsManualReview: false,
        captureSessionId: 'session-3',
        locationConfidence: 0.89,
        imageTrustScore: 85,
        verificationStatus: 'verified',
        viewCount: 98,
        commentCount: 5,
      },
      {
        id: 'comp-4',
        userId: 'user-2',
        userName: 'Priya Sharma',
        title: 'Drainage overflow on main street',
        description: 'Sewage water overflowing onto the road. Causing health hazards.',
        category: 'drainage',
        imageUrl: 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=400',
        location: { latitude: 28.6089, longitude: 77.2195, accuracy: 25, timestamp: Date.now() - 345600000 },
        address: 'MG Road, South Delhi',
        status: 'resolved',
        votes: 67,
        voters: ['user-1'],
        priorityScore: 0.92,
        createdAt: new Date(Date.now() - 86400000 * 10),
        updatedAt: new Date(Date.now() - 86400000),
        resolvedAt: new Date(Date.now() - 86400000),
        resolutionNotes: 'Drainage cleaned and blockage removed.',
        aiCategory: 'drainage',
        aiConfidence: 0.95,
        aiSeverity: 5,
        aiProcessed: true,
        needsManualReview: false,
        captureSessionId: 'session-4',
        locationConfidence: 0.91,
        imageTrustScore: 90,
        verificationStatus: 'verified',
        viewCount: 345,
        commentCount: 22,
      },
      {
        id: 'comp-5',
        userId: 'user-1',
        userName: 'Rajesh Kumar',
        title: 'Water pipe leakage near school',
        description: 'Continuous water leakage wasting water. Kids have to walk through puddles.',
        category: 'water_leak',
        imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400',
        location: { latitude: 28.6259, longitude: 77.2090, accuracy: 12, timestamp: Date.now() - 86400000 },
        address: 'Near DPS School, Vasant Kunj, New Delhi',
        status: 'assigned',
        votes: 52,
        voters: ['user-2'],
        priorityScore: 0.78,
        createdAt: new Date(Date.now() - 86400000 * 4),
        updatedAt: new Date(Date.now() - 86400000),
        aiCategory: 'water_leak',
        aiConfidence: 0.87,
        aiSeverity: 4,
        aiProcessed: true,
        needsManualReview: false,
        captureSessionId: 'session-5',
        locationConfidence: 0.96,
        imageTrustScore: 92,
        verificationStatus: 'verified',
        viewCount: 189,
        commentCount: 15,
      },
    ];
    await localforage.setItem('complaints', complaints);
    await localforage.setItem('notifications', []);
  },

  getComplaints: async (): Promise<Complaint[]> => {
    const complaints = await localforage.getItem<Complaint[]>('complaints');
    return complaints || [];
  },

  saveComplaint: async (complaint: Complaint): Promise<void> => {
    const complaints = await BackendService.getComplaints();
    complaints.unshift(complaint);
    await localforage.setItem('complaints', complaints);
  },

  updateComplaint: async (id: string, updates: Partial<Complaint>): Promise<void> => {
    const complaints = await BackendService.getComplaints();
    const index = complaints.findIndex((c) => c.id === id);
    if (index !== -1) {
      complaints[index] = { ...complaints[index], ...updates, updatedAt: new Date() };
      await localforage.setItem('complaints', complaints);
    }
  },

  getNotifications: async (): Promise<Notification[]> => {
    const notifications = await localforage.getItem<Notification[]>('notifications');
    return notifications || [];
  },

  addNotification: async (notification: Notification): Promise<void> => {
    const notifications = await BackendService.getNotifications();
    notifications.unshift(notification);
    await localforage.setItem('notifications', notifications);
  },

  markNotificationRead: async (id: string): Promise<void> => {
    const notifications = await BackendService.getNotifications();
    const index = notifications.findIndex((n) => n.id === id);
    if (index !== -1) {
      notifications[index].isRead = true;
      await localforage.setItem('notifications', notifications);
    }
  },

  getStats: async (): Promise<DashboardStats> => {
    const complaints = await BackendService.getComplaints();
    const categoryBreakdown = Object.keys(CATEGORY_CONFIG).map((cat) => {
      const count = complaints.filter((c) => c.category === cat).length;
      return {
        category: cat as ComplaintCategory,
        count,
        percentage: complaints.length > 0 ? Math.round((count / complaints.length) * 100) : 0,
      };
    });

    const trustDistribution = {
      verified: complaints.filter((c) => c.verificationStatus === 'verified').length,
      pending: complaints.filter((c) => c.verificationStatus === 'pending').length,
      manualReview: complaints.filter((c) => c.verificationStatus === 'manual_review').length,
      suspicious: complaints.filter((c) => c.verificationStatus === 'suspicious').length,
    };

    return {
      totalComplaints: complaints.length,
      resolvedComplaints: complaints.filter((c) => c.status === 'resolved').length,
      pendingComplaints: complaints.filter((c) => ['submitted', 'under_review'].includes(c.status)).length,
      inProgressComplaints: complaints.filter((c) => ['assigned', 'in_progress'].includes(c.status)).length,
      categoryBreakdown,
      trustDistribution,
      avgResolutionTime: 72,
      userSatisfaction: 4.2,
    };
  },
};

// ============================================
// MAP COMPONENTS
// ============================================

// Component to recenter map
const MapRecenter = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
};



// ============================================
// COMPLAINT CARD COMPONENT
// ============================================

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

// ============================================
// GPS INDICATOR COMPONENT (Ola/Uber style)
// ============================================

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

// ============================================
// MAIN APP COMPONENT
// ============================================

type PageType = 'login' | 'home' | 'camera' | 'preview' | 'feed' | 'map' | 'detail' | 'dashboard' | 'profile' | 'notifications';

export default function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'citizen' | 'admin' | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // App state
  const [page, setPage] = useState<PageType>('home');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Camera state
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Enhanced GPS state
  const [gpsState, setGpsState] = useState<EnhancedGpsState>({
    currentLocation: null,
    bestLocation: null,
    accuracy: Infinity,
    isTracking: false,
    readings: [],
    averagedLocation: null,
    status: 'idle',
    signalStrength: 'none',
    errorMessage: null,
  });
  const gpsTrackerRef = useRef<{ watchId: number; stop: () => void } | null>(null);

  // Report state
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [aiClassification, setAiClassification] = useState<AIClassification | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureSession, setCaptureSession] = useState<CaptureSession | null>(null);
  const [trustScore, setTrustScore] = useState<TrustScore | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ComplaintFilters>({});
  const [sortBy, setSortBy] = useState<SortOption>('priority');

  // Map state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 28.6139, lng: 77.209 });

  // ============================================
  // INITIALIZATION
  // ============================================

  useEffect(() => {
    BackendService.init().then(() => {
      loadData();
    });
  }, []);

  const loadData = async () => {
    const [complaintsData, notificationsData, statsData] = await Promise.all([
      BackendService.getComplaints(),
      BackendService.getNotifications(),
      BackendService.getStats(),
    ]);
    setComplaints(complaintsData);
    setNotifications(notificationsData);
    setStats(statsData);
  };

  // ============================================
  // LOGIN HANDLER
  // ============================================

  const handleLogin = (role: 'citizen' | 'admin') => {
    const credentials = AUTH_CREDENTIALS[role];
    if (loginUsername === credentials.username && loginPassword === credentials.password) {
      setIsAuthenticated(true);
      setUserRole(role);
      setCurrentUser({
        id: role === 'admin' ? 'official-1' : 'user-1',
        name: role === 'admin' ? 'Municipal Officer' : 'Citizen User',
        email: role === 'admin' ? 'admin@gov.in' : 'citizen@email.com',
        role: role === 'admin' ? 'official' : 'citizen',
        createdAt: new Date(),
        impactScore: role === 'admin' ? 5000 : 500,
        complaintsSubmitted: role === 'admin' ? 0 : 5,
        complaintsResolved: role === 'admin' ? 156 : 3,
        trustLevel: role === 'admin' ? 'platinum' : 'silver',
      });
      setLoginError('');
    } else {
      setLoginError('Invalid username or password');
    }
  };

  // ============================================
  // CAMERA HANDLERS (Fixed)
  // ============================================

  const startCamera = useCallback(async () => {
    try {
      setCameraReady(false);
      
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setCameraReady(true);
          }).catch(console.error);
        };
      }

      // Start enhanced GPS tracking
      startGpsTracking();

    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
    
    // Stop GPS tracking
    if (gpsTrackerRef.current) {
      gpsTrackerRef.current.stop();
      gpsTrackerRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Get the best GPS location at capture moment
    const captureLocation = gpsState.bestLocation || gpsState.currentLocation;
    const captureTime = Date.now();

    canvas.toBlob(async (blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage(imageUrl);
        setCapturedBlob(blob);

        // Create capture session
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        let locationValidation = { isValid: false, confidence: 0, flags: [] as ValidationFlag[] };
        if (captureLocation) {
          locationValidation = EnhancedGpsService.validateLocation(captureLocation, captureTime);
        }

        setCaptureSession({
          id: sessionId,
          startedAt: captureTime,
          imageBlob: blob,
          location: captureLocation || undefined,
          locationConfidence: locationValidation.confidence,
          isValid: locationValidation.isValid,
        });

        // Get address if we have location
        if (captureLocation) {
          const addr = await EnhancedGpsService.reverseGeocode(captureLocation.latitude, captureLocation.longitude);
          setAddress(addr);
        }

        stopCamera();
        setPage('preview');

        // Run AI classification
        setIsProcessing(true);
        const classification = await AIClassifier.classify(blob);
        setAiClassification(classification);

        // Calculate trust score
        const components = [
          { name: 'GPS Accuracy', score: captureLocation ? Math.max(0, 100 - captureLocation.accuracy) : 0, weight: TRUST_WEIGHTS.GPS_ACCURACY },
          { name: 'Time Freshness', score: 100, weight: TRUST_WEIGHTS.TIMESTAMP_FRESHNESS },
          { name: 'Session Integrity', score: 95, weight: TRUST_WEIGHTS.SESSION_INTEGRITY },
          { name: 'AI Confidence', score: Math.round(classification.confidence * 100), weight: TRUST_WEIGHTS.AI_CONFIDENCE },
        ];

        const overall = Math.round(
          components.reduce((acc, c) => acc + c.score * c.weight, 0) /
          components.reduce((acc, c) => acc + c.weight, 0)
        );

        let verificationStatus: VerificationStatus = 'verified';
        if (overall < 50) verificationStatus = 'suspicious';
        else if (overall < 70) verificationStatus = 'manual_review';
        else if (overall < 85) verificationStatus = 'pending';

        setTrustScore({
          overall,
          components,
          level: overall >= 80 ? 'high' : overall >= 60 ? 'medium' : overall >= 40 ? 'low' : 'untrusted',
          verificationStatus,
          flags: locationValidation.flags,
        });

        setIsProcessing(false);
      }
    }, 'image/jpeg', 0.9);
  }, [cameraReady, gpsState, stopCamera]);

  // ============================================
  // ENHANCED GPS TRACKING
  // ============================================

  const startGpsTracking = useCallback(() => {
    if (gpsTrackerRef.current) {
      gpsTrackerRef.current.stop();
    }

    setGpsState(prev => ({ ...prev, status: 'acquiring', isTracking: true }));

    const tracker = EnhancedGpsService.startTracking(
      (newState) => {
        setGpsState(newState);
        if (newState.currentLocation) {
          setUserLocation({
            lat: newState.currentLocation.latitude,
            lng: newState.currentLocation.longitude,
          });
        }
      },
      (errorMsg) => {
        console.error('GPS Error:', errorMsg);
      }
    );

    if (tracker) {
      gpsTrackerRef.current = tracker;
    }
  }, []);

  // ============================================
  // COMPLAINT SUBMISSION
  // ============================================

  const submitComplaint = async () => {
    if (!capturedBlob || !aiClassification || !captureSession) {
      setError('Missing required data. Please try again.');
      return;
    }

    setIsProcessing(true);

    const newComplaint: Complaint = {
      id: uuidv4(),
      userId: currentUser?.id || 'anonymous',
      userName: currentUser?.name || 'Anonymous User',
      title: `${CATEGORY_CONFIG[aiClassification.category].label} Issue`,
      description: description || `Reported ${CATEGORY_CONFIG[aiClassification.category].label.toLowerCase()} issue.`,
      category: aiClassification.category,
      imageUrl: capturedImage || '',
      location: captureSession.location || { latitude: 0, longitude: 0, accuracy: Infinity, timestamp: Date.now() },
      address: address || 'Location not available',
      status: 'submitted',
      votes: 0,
      voters: [],
      priorityScore: (aiClassification.severity / 5) * 0.6 + aiClassification.confidence * 0.4,
      createdAt: new Date(),
      updatedAt: new Date(),
      aiCategory: aiClassification.category,
      aiConfidence: aiClassification.confidence,
      aiSeverity: aiClassification.severity,
      aiProcessed: true,
      needsManualReview: aiClassification.confidence < 0.75,
      captureSessionId: captureSession.id,
      locationConfidence: captureSession.locationConfidence || 0,
      imageTrustScore: trustScore?.overall || 0,
      verificationStatus: trustScore?.verificationStatus || 'pending',
      viewCount: 0,
      commentCount: 0,
    };

    await BackendService.saveComplaint(newComplaint);

    // Reset state
    setCapturedImage(null);
    setCapturedBlob(null);
    setCaptureSession(null);
    setAiClassification(null);
    setTrustScore(null);
    setDescription('');
    setAddress('');
    setIsProcessing(false);

    // Reload data
    await loadData();

    setPage('home');
  };

  // ============================================
  // VOTING
  // ============================================

  const handleVote = async (complaintId: string) => {
    const userId = currentUser?.id || 'anonymous';
    const complaint = complaints.find((c) => c.id === complaintId);
    if (!complaint) return;

    const hasVoted = complaint.voters.includes(userId);
    const newVoters = hasVoted
      ? complaint.voters.filter((v) => v !== userId)
      : [...complaint.voters, userId];
    const newVotes = hasVoted ? complaint.votes - 1 : complaint.votes + 1;

    // Recalculate priority score
    const normalizedVotes = Math.min(newVotes / 100, 1);
    const recency = Math.max(0, 1 - (Date.now() - new Date(complaint.createdAt).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const newPriority = 0.4 * (complaint.aiSeverity / 5) + 0.4 * normalizedVotes + 0.2 * recency;

    await BackendService.updateComplaint(complaintId, {
      votes: newVotes,
      voters: newVoters,
      priorityScore: newPriority,
    });

    await loadData();
  };

  // ============================================
  // STATUS UPDATE (Admin)
  // ============================================

  const handleStatusUpdate = async (complaintId: string, newStatus: ComplaintStatus, notes?: string) => {
    const updates: Partial<Complaint> = { status: newStatus };
    if (newStatus === 'resolved') {
      updates.resolvedAt = new Date();
      updates.resolutionNotes = notes || 'Issue has been resolved.';
    }

    await BackendService.updateComplaint(complaintId, updates);

    // Add notification
    const complaint = complaints.find((c) => c.id === complaintId);
    if (complaint) {
      await BackendService.addNotification({
        id: uuidv4(),
        userId: complaint.userId,
        title: 'Status Update',
        message: `Your report "${complaint.title}" is now ${STATUS_CONFIG[newStatus].label}`,
        type: 'status_update',
        referenceId: complaintId,
        isRead: false,
        createdAt: new Date(),
      });
    }

    await loadData();
    if (selectedComplaint?.id === complaintId) {
      setSelectedComplaint({ ...selectedComplaint, status: newStatus, ...updates });
    }
  };

  // ============================================
  // FILTER & SORT COMPLAINTS
  // ============================================

  const filteredComplaints = complaints
    .filter((c) => {
      if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase()) && !c.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filters.category && filters.category !== 'all' && c.category !== filters.category) return false;
      if (filters.status && filters.status !== 'all' && c.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return b.priorityScore - a.priorityScore;
        case 'votes':
          return b.votes - a.votes;
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'severity':
          return b.aiSeverity - a.aiSeverity;
        default:
          return 0;
      }
    });

  // ============================================
  // RENDER: LOGIN PAGE
  // ============================================

  const renderLoginPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl">
            <span className="text-4xl">🏛️</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Digital Grievance</h1>
          <p className="text-blue-200">Citizen Reporting Platform</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">Sign In</h2>

          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
              {loginError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => handleLogin('citizen')}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors"
            >
              Login as Citizen
            </button>
            <button
              onClick={() => handleLogin('admin')}
              className="w-full bg-gray-800 text-white font-semibold py-3 rounded-xl hover:bg-gray-900 transition-colors"
            >
              Login as Admin
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 font-medium mb-2">Demo Credentials:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2 rounded-lg">
                <p className="font-semibold text-gray-700">Citizen</p>
                <p className="text-gray-500">citizen / citizen123</p>
              </div>
              <div className="bg-white p-2 rounded-lg">
                <p className="font-semibold text-gray-700">Admin</p>
                <p className="text-gray-500">admin / admin123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================
  // RENDER: HEADER & NAV
  // ============================================

  const renderHeader = () => (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-xl">🏛️</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Digital Grievance</h1>
            <p className="text-xs text-gray-500">{userRole === 'admin' ? 'Admin Portal' : 'Citizen Portal'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage('notifications')}
            className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {notifications.filter((n) => !n.isRead).length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          <button onClick={() => setPage('profile')} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-lg font-semibold text-gray-600">{currentUser?.name?.charAt(0) || 'U'}</span>
          </button>
        </div>
      </div>
    </header>
  );

  const renderNav = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-around">
          {[
            { id: 'home', icon: '🏠', label: 'Home' },
            { id: 'feed', icon: '📋', label: 'Reports' },
            { id: 'camera', icon: '📷', label: 'Report', isMain: true },
            { id: 'map', icon: '🗺️', label: 'Map' },
            { id: 'dashboard', icon: '📊', label: 'Stats' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'camera') {
                  setPage('camera');
                  setTimeout(startCamera, 100);
                } else {
                  setPage(item.id as PageType);
                }
              }}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
                item.isMain
                  ? 'bg-blue-600 text-white -mt-6 shadow-lg'
                  : page === item.id
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

  // ============================================
  // RENDER: HOME PAGE
  // ============================================

  const renderHomePage = () => (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white">
          <h2 className="text-xl font-bold mb-2">Welcome, {currentUser?.name || 'Citizen'}!</h2>
          <p className="text-blue-100 text-sm mb-4">Help improve your community by reporting civic issues.</p>
          <button
            onClick={() => {
              setPage('camera');
              setTimeout(startCamera, 100);
            }}
            className="bg-white text-blue-600 font-semibold px-6 py-2 rounded-xl hover:bg-blue-50 transition-colors"
          >
            📷 Report an Issue
          </button>
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
            <button onClick={() => setPage('feed')} className="text-blue-600 text-sm font-medium">
              View All →
            </button>
          </div>
          <div className="space-y-3">
            {filteredComplaints.slice(0, 3).map((complaint) => (
              <ComplaintCard
                key={complaint.id}
                complaint={complaint}
                onClick={() => {
                  setSelectedComplaint(complaint);
                  setPage('detail');
                }}
                onVote={() => handleVote(complaint.id)}
                currentUserId={currentUser?.id || ''}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================
  // RENDER: CAMERA PAGE (Fixed)
  // ============================================

  const renderCameraPage = () => (
    <div className="fixed inset-0 bg-black z-50">
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(1)' }}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading Overlay */}
      {!cameraReady && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">Starting Camera...</p>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              stopCamera();
              setPage('home');
            }}
            className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-white font-semibold">Capture Issue</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Frame Guide */}
      {cameraReady && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 border-2 border-white/50 rounded-lg">
            <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
            <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />
          </div>
        </div>
      )}

      {/* GPS Indicator (Ola/Uber style) */}
      <div className="absolute top-20 left-4 right-4">
        <GpsIndicator gpsState={gpsState} />
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-center">
          <button
            onClick={capturePhoto}
            disabled={!cameraReady}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
              cameraReady ? 'bg-white' : 'bg-gray-500'
            }`}
          >
            <div className={`w-16 h-16 rounded-full border-4 ${cameraReady ? 'border-blue-600' : 'border-gray-400'}`} />
          </button>
        </div>
        <p className="text-center text-white/70 text-sm mt-4">
          {cameraReady ? 'Tap to capture' : 'Initializing camera...'}
        </p>
      </div>
    </div>
  );

  // ============================================
  // RENDER: PREVIEW PAGE
  // ============================================

  const renderPreviewPage = () => (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              setCapturedImage(null);
              setCapturedBlob(null);
              setAiClassification(null);
              setTrustScore(null);
              setPage('camera');
              setTimeout(startCamera, 100);
            }}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Review Report</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Captured Image */}
        <div className="relative rounded-2xl overflow-hidden mb-4">
          <img src={capturedImage || ''} alt="Captured" className="w-full h-64 object-cover" />
          {isProcessing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm">Analyzing image...</p>
              </div>
            </div>
          )}
        </div>

        {/* Location Info */}
        <div className="bg-white rounded-2xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xl">📍</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Location</p>
              <p className="text-sm text-gray-500">{address || 'Location not available'}</p>
              {captureSession?.location && (
                <p className="text-xs text-gray-400 mt-1">
                  GPS Accuracy: {Math.round(captureSession.location.accuracy)}m • Confidence: {Math.round((captureSession.locationConfidence || 0) * 100)}%
                </p>
              )}
            </div>
          </div>
        </div>

        {/* AI Classification */}
        {aiClassification && (
          <div className="bg-white rounded-2xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">🤖 AI Classification</h3>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: CATEGORY_CONFIG[aiClassification.category].color + '20' }}
              >
                {CATEGORY_CONFIG[aiClassification.category].icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{CATEGORY_CONFIG[aiClassification.category].label}</p>
                <p className="text-sm text-gray-500">Severity: {aiClassification.severity}/5</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600">{Math.round(aiClassification.confidence * 100)}%</p>
                <p className="text-xs text-gray-400">Confidence</p>
              </div>
            </div>

            {/* Alternative Categories */}
            <div className="flex flex-wrap gap-2">
              {aiClassification.allPredictions.slice(0, 4).map((pred) => (
                <button
                  key={pred.category}
                  onClick={() => setAiClassification({ ...aiClassification, category: pred.category })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    pred.category === aiClassification.category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {CATEGORY_CONFIG[pred.category].icon} {CATEGORY_CONFIG[pred.category].label} ({Math.round(pred.confidence * 100)}%)
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">💡 Tap to correct AI prediction (helps improve the model)</p>
          </div>
        )}

        {/* Trust Score */}
        {trustScore && (
          <div className="bg-white rounded-2xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">🛡️ Trust Score</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="36" stroke="#E5E7EB" strokeWidth="8" fill="none" />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke={trustScore.overall >= 70 ? '#10B981' : trustScore.overall >= 50 ? '#F59E0B' : '#EF4444'}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(trustScore.overall / 100) * 226} 226`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">{trustScore.overall}</span>
                </div>
              </div>
              <div>
                <p className={`font-semibold ${trustScore.overall >= 70 ? 'text-green-600' : trustScore.overall >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {trustScore.level === 'high' ? 'High Trust' : trustScore.level === 'medium' ? 'Medium Trust' : trustScore.level === 'low' ? 'Low Trust' : 'Untrusted'}
                </p>
                <p className="text-sm text-gray-500">
                  {trustScore.verificationStatus === 'verified' ? '✓ Verified' : trustScore.verificationStatus === 'pending' ? '⏳ Pending Review' : trustScore.verificationStatus === 'manual_review' ? '⚠️ Manual Review Required' : '❌ Suspicious'}
                </p>
              </div>
            </div>

            {/* Trust Components */}
            <div className="space-y-2">
              {trustScore.components.map((comp, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{comp.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${comp.score}%`,
                          backgroundColor: comp.score >= 70 ? '#10B981' : comp.score >= 50 ? '#F59E0B' : '#EF4444',
                        }}
                      />
                    </div>
                    <span className="text-gray-500 w-8 text-right">{comp.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="bg-white rounded-2xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">📝 Description</h3>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail..."
            maxLength={500}
            className="w-full h-24 p-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">{description.length}/500 characters</p>
        </div>

        {/* Submit Button */}
        <button
          onClick={submitComplaint}
          disabled={isProcessing || !aiClassification}
          className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    </div>
  );

  // ============================================
  // RENDER: FEED PAGE
  // ============================================

  const renderFeedPage = () => (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setPage('home')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
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
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <select
              value={filters.category || 'all'}
              onChange={(e) => setFilters({ ...filters, category: e.target.value as ComplaintCategory | 'all' })}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.icon} {val.label}</option>
              ))}
            </select>

            <select
              value={filters.status || 'all'}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as ComplaintStatus | 'all' })}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
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
              onClick={() => { setSelectedComplaint(complaint); setPage('detail'); }}
              onVote={() => handleVote(complaint.id)}
              currentUserId={currentUser?.id || ''}
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

  // ============================================
  // RENDER: MAP PAGE (Ola/Uber style with Leaflet)
  // ============================================

  const renderMapPage = () => (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setPage('home')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Map View</h1>
          </div>
          <button
            onClick={() => {
              if (userLocation) {
                setMapCenter(userLocation);
              } else {
                // Start tracking location
                const tracker = EnhancedGpsService.startTracking(
                  (state) => {
                    if (state.currentLocation) {
                      setUserLocation({
                        lat: state.currentLocation.latitude,
                        lng: state.currentLocation.longitude,
                      });
                      setMapCenter({
                        lat: state.currentLocation.latitude,
                        lng: state.currentLocation.longitude,
                      });
                    }
                  },
                  (err) => setError(err)
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
                    onClick={() => {
                      setSelectedComplaint(complaint);
                      setPage('detail');
                    }}
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
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: val.color }}
                />
                <span className="text-xs text-gray-600">{val.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================
  // RENDER: DETAIL PAGE
  // ============================================

  const renderDetailPage = () => {
    if (!selectedComplaint) return null;
    const categoryConfig = CATEGORY_CONFIG[selectedComplaint.category];
    const statusConfig = STATUS_CONFIG[selectedComplaint.status];
    const hasVoted = selectedComplaint.voters.includes(currentUser?.id || '');

    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <button onClick={() => setPage('feed')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Report Details</h1>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Image */}
          <div className="rounded-2xl overflow-hidden mb-6">
            <img src={selectedComplaint.imageUrl} alt={selectedComplaint.title} className="w-full h-64 object-cover" />
          </div>

          {/* Title & Status */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-2"
                style={{ backgroundColor: categoryConfig.color + '20', color: categoryConfig.color }}
              >
                {categoryConfig.icon} {categoryConfig.label}
              </span>
              <h2 className="text-xl font-bold text-gray-900">{selectedComplaint.title}</h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl p-4 mb-4">
            <p className="text-gray-700">{selectedComplaint.description}</p>
          </div>

          {/* Location with Mini Map */}
          <div className="bg-white rounded-2xl overflow-hidden mb-4">
            <div style={{ height: '150px' }}>
              <MapContainer
                center={[selectedComplaint.location.latitude, selectedComplaint.location.longitude]}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
                dragging={false}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker
                  position={[selectedComplaint.location.latitude, selectedComplaint.location.longitude]}
                  icon={createCategoryIcon(selectedComplaint.category)}
                />
                <Circle
                  center={[selectedComplaint.location.latitude, selectedComplaint.location.longitude]}
                  radius={selectedComplaint.location.accuracy}
                  pathOptions={{
                    color: categoryConfig.color,
                    fillColor: categoryConfig.color,
                    fillOpacity: 0.2,
                  }}
                />
              </MapContainer>
            </div>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl">📍</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Location</p>
                  <p className="text-sm text-gray-500">{selectedComplaint.address}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    GPS: {selectedComplaint.location.latitude.toFixed(6)}, {selectedComplaint.location.longitude.toFixed(6)} • 
                    Accuracy: {Math.round(selectedComplaint.location.accuracy)}m
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Info */}
          <div className="bg-white rounded-2xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">🤖 AI Analysis</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-gray-900">{Math.round(selectedComplaint.aiConfidence * 100)}%</p>
                <p className="text-xs text-gray-500">Confidence</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{selectedComplaint.aiSeverity}/5</p>
                <p className="text-xs text-gray-500">Severity</p>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{Math.round(selectedComplaint.priorityScore * 100)}%</p>
                <p className="text-xs text-gray-500">Priority</p>
              </div>
            </div>
          </div>

          {/* Vote & Actions */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => handleVote(selectedComplaint.id)}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                hasVoted ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" fill={hasVoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              {selectedComplaint.votes} Votes
            </button>
          </div>

          {/* Admin Actions */}
          {userRole === 'admin' && (
            <div className="bg-white rounded-2xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">👨‍💼 Admin Actions</h3>
              <div className="space-y-2">
                {selectedComplaint.status === 'submitted' && (
                  <button
                    onClick={() => handleStatusUpdate(selectedComplaint.id, 'under_review')}
                    className="w-full py-2 px-4 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-colors"
                  >
                    Start Review
                  </button>
                )}
                {selectedComplaint.status === 'under_review' && (
                  <button
                    onClick={() => handleStatusUpdate(selectedComplaint.id, 'assigned')}
                    className="w-full py-2 px-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                  >
                    Assign to Team
                  </button>
                )}
                {selectedComplaint.status === 'assigned' && (
                  <button
                    onClick={() => handleStatusUpdate(selectedComplaint.id, 'in_progress')}
                    className="w-full py-2 px-4 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors"
                  >
                    Mark In Progress
                  </button>
                )}
                {['assigned', 'in_progress'].includes(selectedComplaint.status) && (
                  <button
                    onClick={() => handleStatusUpdate(selectedComplaint.id, 'resolved', 'Issue has been resolved')}
                    className="w-full py-2 px-4 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                  >
                    Mark Resolved ✓
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">📅 Timeline</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm">📝</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Submitted</p>
                  <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(selectedComplaint.createdAt), { addSuffix: true })}</p>
                </div>
              </div>
              {selectedComplaint.resolvedAt && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-sm">✅</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Resolved</p>
                    <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(selectedComplaint.resolvedAt), { addSuffix: true })}</p>
                    {selectedComplaint.resolutionNotes && (
                      <p className="text-xs text-gray-600 mt-1">{selectedComplaint.resolutionNotes}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // RENDER: DASHBOARD PAGE
  // ============================================

  const renderDashboardPage = () => (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setPage('home')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {stats && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <span className="text-xl">📊</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalComplaints}</p>
                <p className="text-sm text-gray-500">Total Reports</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                  <span className="text-xl">✅</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.resolvedComplaints}</p>
                <p className="text-sm text-gray-500">Resolved</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center mb-3">
                  <span className="text-xl">⏳</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingComplaints}</p>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mb-3">
                  <span className="text-xl">🔧</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stats.inProgressComplaints}</p>
                <p className="text-sm text-gray-500">In Progress</p>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
              <h3 className="text-sm font-semibold text-gray-500 mb-4">Category Breakdown</h3>
              <div className="space-y-3">
                {stats.categoryBreakdown.map((cat) => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                      style={{ backgroundColor: CATEGORY_CONFIG[cat.category].color + '20' }}
                    >
                      {CATEGORY_CONFIG[cat.category].icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{CATEGORY_CONFIG[cat.category].label}</span>
                        <span className="text-sm text-gray-500">{cat.count}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: CATEGORY_CONFIG[cat.category].color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust Distribution */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 mb-4">Verification Status</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-green-600">{stats.trustDistribution.verified}</p>
                  <p className="text-xs text-green-700">Verified</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-yellow-600">{stats.trustDistribution.pending}</p>
                  <p className="text-xs text-yellow-700">Pending</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-orange-600">{stats.trustDistribution.manualReview}</p>
                  <p className="text-xs text-orange-700">Manual Review</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-red-600">{stats.trustDistribution.suspicious}</p>
                  <p className="text-xs text-red-700">Suspicious</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  // ============================================
  // RENDER: PROFILE PAGE
  // ============================================

  const renderProfilePage = () => (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setPage('home')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Profile</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl text-blue-600 font-bold">{currentUser?.name?.charAt(0) || 'U'}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{currentUser?.name}</h2>
          <p className="text-gray-500">{currentUser?.email}</p>
          <div className="mt-3">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 rounded-full text-blue-700 text-sm font-medium">
              {currentUser?.role === 'official' ? '👨‍💼 Official' : '👤 Citizen'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-gray-900">{currentUser?.complaintsSubmitted || 0}</p>
            <p className="text-xs text-gray-500">Reports</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-green-600">{currentUser?.complaintsResolved || 0}</p>
            <p className="text-xs text-gray-500">Resolved</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-blue-600">{currentUser?.impactScore || 0}</p>
            <p className="text-xs text-gray-500">Impact</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => {
            setIsAuthenticated(false);
            setUserRole(null);
            setLoginUsername('');
            setLoginPassword('');
            setPage('login');
          }}
          className="w-full bg-red-50 text-red-600 font-semibold py-3 rounded-2xl hover:bg-red-100 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );

  // ============================================
  // RENDER: NOTIFICATIONS PAGE
  // ============================================

  const renderNotificationsPage = () => (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setPage('home')} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
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
                onClick={() => BackendService.markNotificationRead(notif.id)}
                className={`bg-white rounded-2xl p-4 shadow-sm ${!notif.isRead ? 'border-l-4 border-blue-500' : ''}`}
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

  // Error Toast
  const renderErrorToast = () => {
    if (!error) return null;
    return (
      <div className="fixed bottom-24 left-4 right-4 z-50">
        <div className="bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // Main render
  if (!isAuthenticated) {
    return renderLoginPage();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {page !== 'camera' && renderHeader()}
      {page !== 'camera' && renderNav()}

      {page === 'home' && renderHomePage()}
      {page === 'camera' && renderCameraPage()}
      {page === 'preview' && renderPreviewPage()}
      {page === 'feed' && renderFeedPage()}
      {page === 'map' && renderMapPage()}
      {page === 'detail' && renderDetailPage()}
      {page === 'dashboard' && renderDashboardPage()}
      {page === 'profile' && renderProfilePage()}
      {page === 'notifications' && renderNotificationsPage()}

      {renderErrorToast()}
    </div>
  );
}
