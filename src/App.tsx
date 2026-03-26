// ============================================
// TeNet - MAIN APPLICATION ORCHESTRATOR
// Slim entry point that imports all components & pages
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Types
import {
  User,
  Complaint,
  ComplaintStatus,
  Notification,
  DashboardStats,
  CaptureSession,
  TrustScore,
  ValidationFlag,
  ComplaintFilters,
  SortOption,
  CATEGORY_CONFIG,
  TRUST_WEIGHTS,
  VerificationStatus,
} from './types';

// Services
import { EnhancedGpsState, EnhancedGpsService } from './services/GpsService';
import { AIClassification, AIClassifier } from './services/AIClassifier';
import { BackendService } from './services/BackendService';

// Components
import Header from './components/Navigation/Header';
import BottomNav from './components/Navigation/BottomNav';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import CameraPage from './pages/CameraPage';
import SubmitGrievancePage from './pages/SubmitGrievancePage';
import MyGrievancesPage from './pages/MyGrievancesPage';
import MapPage from './pages/MapPage';
import GrievanceDetailsPage from './pages/GrievanceDetailsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';

// ============================================
// PAGE TYPES
// ============================================

type PageType = 'login' | 'register' | 'home' | 'camera' | 'preview' | 'feed' | 'map' | 'detail' | 'dashboard' | 'profile' | 'notifications';

// ============================================
// MAIN APP COMPONENT
// ============================================

export default function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'citizen' | 'admin' | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // App state
  const [page, setPage] = useState<PageType>('home');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
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

  const handleLoginSuccess = (user: User, role: 'citizen' | 'admin') => {
    setIsAuthenticated(true);
    setUserRole(role);
    setCurrentUser(user);
  };

  // ============================================
  // CAMERA HANDLERS
  // ============================================

  const startCamera = useCallback(async () => {
    try {
      setCameraReady(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => setCameraReady(true)).catch(console.error);
        };
      }

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

    const captureLocation = gpsState.bestLocation || gpsState.currentLocation;
    const captureTime = Date.now();

    canvas.toBlob(async (blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage(imageUrl);
        setCapturedBlob(blob);

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

        if (captureLocation) {
          const addr = await EnhancedGpsService.reverseGeocode(captureLocation.latitude, captureLocation.longitude);
          setAddress(addr);
        }

        stopCamera();
        setPage('preview');

        setIsProcessing(true);
        const classification = await AIClassifier.classify(blob);
        setAiClassification(classification);

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
  // GPS TRACKING
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
      (errorMsg) => console.error('GPS Error:', errorMsg)
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

    setCapturedImage(null);
    setCapturedBlob(null);
    setCaptureSession(null);
    setAiClassification(null);
    setTrustScore(null);
    setDescription('');
    setAddress('');
    setIsProcessing(false);

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
    const newVoters = hasVoted ? complaint.voters.filter((v) => v !== userId) : [...complaint.voters, userId];
    const newVotes = hasVoted ? complaint.votes - 1 : complaint.votes + 1;

    const normalizedVotes = Math.min(newVotes / 100, 1);
    const recency = Math.max(0, 1 - (Date.now() - new Date(complaint.createdAt).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const newPriority = 0.4 * (complaint.aiSeverity / 5) + 0.4 * normalizedVotes + 0.2 * recency;

    await BackendService.updateComplaint(complaintId, { votes: newVotes, voters: newVoters, priorityScore: newPriority });
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

    const complaint = complaints.find((c) => c.id === complaintId);
    if (complaint) {
      await BackendService.addNotification({
        id: uuidv4(),
        userId: complaint.userId,
        title: 'Status Update',
        message: `Your report "${complaint.title}" is now ${newStatus.replace('_', ' ')}`,
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
  // PROOF UPLOAD (Admin)
  // ============================================

  const handleProofUploaded = async (complaintId: string, _proofImageUrl: string) => {
    await BackendService.updateComplaint(complaintId, {
      resolutionNotes: 'Issue resolved with proof of completion uploaded.',
    });

    const complaint = complaints.find((c) => c.id === complaintId);
    if (complaint) {
      await BackendService.addNotification({
        id: uuidv4(),
        userId: complaint.userId,
        title: 'Proof of Completion',
        message: `Proof has been uploaded for your grievance "${complaint.title}". The issue is now verified as completed.`,
        type: 'resolution',
        referenceId: complaintId,
        isRead: false,
        createdAt: new Date(),
      });
    }

    await loadData();
  };

  // ============================================
  // FILTER & SORT
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
        case 'priority': return b.priorityScore - a.priorityScore;
        case 'votes': return b.votes - a.votes;
        case 'recent': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'severity': return b.aiSeverity - a.aiSeverity;
        default: return 0;
      }
    });

  // ============================================
  // NAVIGATION HELPERS
  // ============================================

  const navigateHome = () => {
    setSelectedComplaint(null);
    setPage('home');
  };

  const openCamera = () => {
    setPage('camera');
    setTimeout(startCamera, 100);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedBlob(null);
    setAiClassification(null);
    setTrustScore(null);
    setPage('camera');
    setTimeout(startCamera, 100);
  };

  const handleCloseCamera = () => {
    stopCamera();
    setPage('home');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setCurrentUser(null);
    setPage('login');
  };

  // ============================================
  // ERROR TOAST
  // ============================================

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

  // ============================================
  // RENDER
  // ============================================

  if (!isAuthenticated) {
    if (page === 'register') {
      return (
        <RegisterPage
          onRegistered={(user) => {
            handleLoginSuccess(user, 'citizen');
            setPage('home');
          }}
          onBack={() => setPage('login')}
        />
      );
    }
    return <LoginPage onLoginSuccess={handleLoginSuccess} onRegister={() => setPage('register')} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {page !== 'camera' && (
        <Header
          userRole={userRole}
          currentUserName={currentUser?.name || ''}
          notifications={notifications}
          onNavigateHome={navigateHome}
          onNavigateNotifications={() => setPage('notifications')}
          onNavigateProfile={() => setPage('profile')}
        />
      )}

      {page !== 'camera' && (
        <BottomNav
          currentPage={page}
          userRole={userRole}
          onNavigate={(p) => setPage(p)}
          onOpenCamera={openCamera}
        />
      )}

      {page === 'home' && (
        <HomePage
          currentUserName={currentUser?.name || 'User'}
          currentUserId={currentUser?.id || ''}
          userRole={userRole}
          stats={stats}
          filteredComplaints={filteredComplaints}
          onOpenCamera={openCamera}
          onViewAllReports={() => setPage('feed')}
          onViewDashboard={() => setPage('dashboard')}
          onSelectComplaint={(c) => { setSelectedComplaint(c); setPage('detail'); }}
          onVote={handleVote}
        />
      )}

      {page === 'camera' && (
        <CameraPage
          videoRef={videoRef}
          canvasRef={canvasRef}
          cameraReady={cameraReady}
          gpsState={gpsState}
          onCapture={capturePhoto}
          onClose={handleCloseCamera}
        />
      )}

      {page === 'preview' && (
        <SubmitGrievancePage
          capturedImage={capturedImage}
          isProcessing={isProcessing}
          address={address}
          captureSession={captureSession}
          aiClassification={aiClassification}
          trustScore={trustScore}
          description={description}
          onDescriptionChange={setDescription}
          onChangeCategory={setAiClassification}
          onSubmit={submitComplaint}
          onRetake={handleRetake}
        />
      )}

      {page === 'feed' && (
        <MyGrievancesPage
          filteredComplaints={filteredComplaints}
          searchQuery={searchQuery}
          filters={filters}
          sortBy={sortBy}
          currentUserId={currentUser?.id || ''}
          onSearchChange={setSearchQuery}
          onFiltersChange={setFilters}
          onSortChange={setSortBy}
          onSelectComplaint={(c) => { setSelectedComplaint(c); setPage('detail'); }}
          onVote={handleVote}
          onGoBack={() => setPage('home')}
        />
      )}

      {page === 'map' && (
        <MapPage
          complaints={complaints}
          userLocation={userLocation}
          mapCenter={mapCenter}
          gpsState={gpsState}
          onSetUserLocation={setUserLocation}
          onSetMapCenter={setMapCenter}
          onSelectComplaint={(c) => { setSelectedComplaint(c); setPage('detail'); }}
          onSetError={setError}
          onGoBack={() => setPage('home')}
        />
      )}

      {page === 'detail' && selectedComplaint && (
        <GrievanceDetailsPage
          complaint={selectedComplaint}
          userRole={userRole}
          currentUserId={currentUser?.id || ''}
          onVote={handleVote}
          onStatusUpdate={handleStatusUpdate}
          onProofUploaded={handleProofUploaded}
          onGoBack={() => setPage('feed')}
          onOpenMap={(lat, lng) => {
            setMapCenter({ lat, lng });
            setPage('map');
          }}
        />
      )}

      {page === 'dashboard' && (
        <AdminDashboardPage
          stats={stats}
          onGoBack={() => setPage('home')}
        />
      )}

      {page === 'profile' && (
        <ProfilePage
          currentUser={currentUser}
          onLogout={handleLogout}
          onGoBack={() => setPage('home')}
        />
      )}

      {page === 'notifications' && (
        <NotificationsPage
          notifications={notifications}
          onMarkRead={(id) => BackendService.markNotificationRead(id)}
          onGoBack={() => setPage('home')}
        />
      )}

      {renderErrorToast()}
    </div>
  );
}
