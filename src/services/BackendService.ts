// ============================================
// BACKEND SERVICE (LocalForage-based)
// ============================================

import localforage from 'localforage';
import {
  User,
  Complaint,
  ComplaintCategory,
  Notification,
  DashboardStats,
  CATEGORY_CONFIG,
} from '../types';

// ============================================
// AUTH CREDENTIALS
// ============================================

export const AUTH_CREDENTIALS = {
  citizen: { username: 'citizen', password: 'citizen123' },
  admin: { username: 'admin', password: 'admin123' },
};

// ============================================
// BACKEND SERVICE
// ============================================

export const BackendService = {
  init: async () => {
    await localforage.config({ name: 'tenet-grievance', storeName: 'app_data' });
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

  // ============================================
  // OTP REGISTRATION
  // ============================================

  // Login a previously registered citizen by email + password
  loginRegisteredUser: async (email: string, password: string): Promise<User | null> => {
    const registered = await localforage.getItem<{ email: string; passwordHash: string }[]>('registered_users') ?? [];
    const match = registered.find((u) => u.email === email && u.passwordHash === btoa(password));
    if (!match) return null;
    const users = await localforage.getItem<User[]>('users') ?? [];
    return users.find((u) => u.email === email) ?? null;
  },

  generateOtp: async (email: string): Promise<string> => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Store OTP in LocalForage with a 10-minute expiry
    await localforage.setItem(`otp_${email}`, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
    console.log(`[OTP] Generated for ${email}: ${otp}`);
    return otp;
  },

  verifyOtp: async (email: string, entered: string): Promise<boolean> => {
    const stored = await localforage.getItem<{ otp: string; expiresAt: number }>(`otp_${email}`);
    if (!stored) return false;
    if (Date.now() > stored.expiresAt) {
      await localforage.removeItem(`otp_${email}`);
      return false;
    }
    const valid = stored.otp === entered;
    if (valid) await localforage.removeItem(`otp_${email}`); // one-time use
    return valid;
  },

  registerUser: async (params: { name: string; email: string; password: string }): Promise<User> => {
    // Check for duplicate email
    const existing = await localforage.getItem<{ email: string; passwordHash: string }[]>('registered_users') ?? [];
    if (existing.some((u) => u.email === params.email)) {
      throw new Error('An account with this email already exists.');
    }

    const newUser: User = {
      id: `citizen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: params.name,
      email: params.email,
      role: 'citizen',
      createdAt: new Date(),
      impactScore: 0,
      complaintsSubmitted: 0,
      complaintsResolved: 0,
      trustLevel: 'bronze',
    };

    // Store minimal auth record (never store plain passwords in real apps — this is a demo)
    existing.push({ email: params.email, passwordHash: btoa(params.password) });
    await localforage.setItem('registered_users', existing);

    // Also add to users list
    const users = await localforage.getItem<User[]>('users') ?? [];
    users.push(newUser);
    await localforage.setItem('users', users);

    return newUser;
  },
};
