// ============================================
// DIGITAL GRIEVANCE - TYPE DEFINITIONS
// ============================================

export type ComplaintCategory =
  | 'pothole'
  | 'garbage'
  | 'streetlight'
  | 'drainage'
  | 'road_damage'
  | 'water_leak'
  | 'illegal_parking'
  | 'tree_fall'
  | 'encroachment'
  | 'noise_pollution'
  | 'air_pollution'
  | 'stray_animals'
  | 'other';

export type ComplaintStatus = 'submitted' | 'under_review' | 'assigned' | 'in_progress' | 'resolved' | 'rejected';

export type VerificationStatus = 'verified' | 'pending' | 'manual_review' | 'suspicious';

export type SortOption = 'priority' | 'votes' | 'recent' | 'oldest' | 'severity';

export interface GpsLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'citizen' | 'official' | 'admin';
  createdAt: Date;
  impactScore: number;
  complaintsSubmitted: number;
  complaintsResolved: number;
  trustLevel: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface Complaint {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  imageUrl: string;
  location: GpsLocation;
  address: string;
  status: ComplaintStatus;
  votes: number;
  voters: string[];
  priorityScore: number;
  createdAt: Date;
  updatedAt: Date;
  aiCategory: ComplaintCategory;
  aiConfidence: number;
  aiSeverity: number;
  aiProcessed: boolean;
  needsManualReview: boolean;
  captureSessionId: string;
  locationConfidence: number;
  imageTrustScore: number;
  verificationStatus: VerificationStatus;
  viewCount: number;
  commentCount: number;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'status_update' | 'new_vote' | 'new_comment' | 'resolution';
  title: string;
  message: string;
  referenceId: string;
  isRead: boolean;
  createdAt: Date;
}

export interface DashboardStats {
  totalComplaints: number;
  pendingComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
  rejectedComplaints?: number;
  resolutionRate?: number;
  avgResolutionTime?: number;
  userSatisfaction?: number;
  categoryBreakdown: CategoryStat[];
  recentTrends?: TrendData[];
  topAreas?: AreaStat[];
  trustDistribution: TrustDistribution;
}

export interface CategoryStat {
  category: ComplaintCategory;
  count: number;
  percentage: number;
  resolved?: number;
  averageSeverity?: number;
}

export interface TrendData {
  date: string;
  submitted: number;
  resolved: number;
}

export interface AreaStat {
  area: string;
  count: number;
  topCategory: ComplaintCategory;
}

export interface TrustDistribution {
  verified: number;
  suspicious: number;
  manualReview: number;
  pending: number;
}

export interface AIClassification {
  category: ComplaintCategory;
  confidence: number;
  severity: number;
  processingTime: number;
  allPredictions: { category: ComplaintCategory; confidence: number }[];
  reasoning: string;
}

export interface CaptureSession {
  id: string;
  sessionId?: string;
  userId?: string;
  startedAt: number;
  location?: GpsLocation;
  locationAccuracy?: number;
  locationConfidence?: number;
  imageBlob?: Blob | null;
  imageHash?: string | null;
  exifData?: Record<string, unknown> | null;
  metadata?: CaptureMetadata;
  status?: 'active' | 'completed' | 'expired';
  expiresAt?: number;
  isValid?: boolean;
}

export interface CaptureMetadata {
  deviceInfo: DeviceInfo;
  networkType: string | null;
  batteryLevel: number | null;
  orientation: string;
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
}

export interface TrustComponent {
  name: string;
  score: number;
  weight: number;
  details?: string;
}

export interface TrustScore {
  overall: number;
  components: TrustComponent[];
  level: 'high' | 'medium' | 'low' | 'untrusted';
  verificationStatus: VerificationStatus;
  flags: ValidationFlag[];
}

export interface ValidationFlag {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ExifData {
  make?: string;
  model?: string;
  dateTime?: string;
  dateTimeOriginal?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAltitude?: number;
  gpsTimestamp?: string;
  orientation?: number;
  imageWidth?: number;
  imageHeight?: number;
  software?: string;
  isEdited: boolean;
  hasGps: boolean;
  hasTimestamp: boolean;
}

export interface ImageIntegrityResult {
  hash: string;
  perceptualHash: string;
  isDuplicate: boolean;
  duplicateOf?: string;
  similarityScore: number;
  exifValidation: ExifValidation;
  trustScore: number;
  flags: ValidationFlag[];
}

export interface ExifValidation {
  hasMetadata: boolean;
  hasGps: boolean;
  hasTimestamp: boolean;
  timestampValid: boolean;
  gpsConsistent: boolean;
  isEdited: boolean;
  metadataScore: number;
}

export interface LocationValidation {
  isValid: boolean;
  accuracyScore: number;
  recencyScore: number;
  consistencyScore: number;
  overallConfidence: number;
  flags: ValidationFlag[];
}

export interface ComplaintFilters {
  category?: ComplaintCategory | 'all';
  status?: ComplaintStatus | 'all';
  searchQuery?: string;
  minVotes?: number;
  verificationStatus?: VerificationStatus | 'all';
}

export interface UserImpact {
  userId: string;
  totalReports: number;
  verifiedReports: number;
  issuesResolved: number;
  peopleHelped: number;
  impactScore: number;
  rank: number;
  badges: Badge[];
  streakDays: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt: Date;
}

// Category configuration
export const CATEGORY_CONFIG: Record<ComplaintCategory, { value: ComplaintCategory; label: string; icon: string; color: string }> = {
  pothole: { value: 'pothole', label: 'Pothole', icon: '🕳️', color: '#EF4444' },
  garbage: { value: 'garbage', label: 'Garbage', icon: '🗑️', color: '#F59E0B' },
  streetlight: { value: 'streetlight', label: 'Streetlight', icon: '💡', color: '#6366F1' },
  drainage: { value: 'drainage', label: 'Drainage', icon: '🌊', color: '#06B6D4' },
  road_damage: { value: 'road_damage', label: 'Road Damage', icon: '🚧', color: '#EC4899' },
  water_leak: { value: 'water_leak', label: 'Water Leak', icon: '💧', color: '#3B82F6' },
  illegal_parking: { value: 'illegal_parking', label: 'Illegal Parking', icon: '🚗', color: '#F97316' },
  tree_fall: { value: 'tree_fall', label: 'Tree Fall', icon: '🌳', color: '#84CC16' },
  encroachment: { value: 'encroachment', label: 'Encroachment', icon: '🏚️', color: '#A78BFA' },
  noise_pollution: { value: 'noise_pollution', label: 'Noise Pollution', icon: '🔊', color: '#FB923C' },
  air_pollution: { value: 'air_pollution', label: 'Air Pollution', icon: '💨', color: '#94A3B8' },
  stray_animals: { value: 'stray_animals', label: 'Stray Animals', icon: '🐕', color: '#D97706' },
  other: { value: 'other', label: 'Other', icon: '📋', color: '#8B5CF6' },
};

// Status configuration
export const STATUS_CONFIG: Record<ComplaintStatus, { value: ComplaintStatus; label: string; color: string }> = {
  submitted: { value: 'submitted', label: 'Submitted', color: 'bg-gray-100 text-gray-700' },
  under_review: { value: 'under_review', label: 'Under Review', color: 'bg-yellow-100 text-yellow-700' },
  assigned: { value: 'assigned', label: 'Assigned', color: 'bg-blue-100 text-blue-700' },
  in_progress: { value: 'in_progress', label: 'In Progress', color: 'bg-indigo-100 text-indigo-700' },
  resolved: { value: 'resolved', label: 'Resolved', color: 'bg-green-100 text-green-700' },
  rejected: { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

// Validation configuration
export const VALIDATION_CONFIG = {
  MAX_GPS_ACCURACY: 100,
  MAX_CAPTURE_AGE: 5 * 60 * 1000,
  DUPLICATE_RADIUS: 80,
  SESSION_EXPIRY: 5 * 60 * 1000,
  MAX_LOCATION_DRIFT: 50,
};

// Trust weights
export const TRUST_WEIGHTS = {
  GPS_ACCURACY: 0.3,
  LOCATION_RECENCY: 0.2,
  EXIF_VALIDATION: 0.2,
  IMAGE_FRESHNESS: 0.1,
  SESSION_INTEGRITY: 0.1,
  USER_REPUTATION: 0.1,
  TIMESTAMP_FRESHNESS: 0.15,
  AI_CONFIDENCE: 0.15,
};
