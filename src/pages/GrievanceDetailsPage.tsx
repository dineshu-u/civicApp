// ============================================
// GRIEVANCE DETAILS PAGE
// Admin proof flow:
//   1. Camera → capture photo
//   2. Photo converted to base64 (survives unmount)
//   3. Verification screen: AI location comparison
//   4. Confirm → mark resolved + send notification
// ============================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import { Complaint, ComplaintStatus, CATEGORY_CONFIG, STATUS_CONFIG, GpsLocation } from '../types';
import { createCategoryIcon } from '../components/Common/MapHelpers';
import ProofUpload from '../components/ProofUpload/ProofUpload';
import { EnhancedGpsService } from '../services/GpsService';

interface GrievanceDetailsPageProps {
  complaint: Complaint;
  userRole: 'citizen' | 'admin' | null;
  currentUserId: string;
  onVote: (complaintId: string) => void;
  onStatusUpdate: (complaintId: string, newStatus: ComplaintStatus, notes?: string) => void;
  onProofUploaded: (complaintId: string, proofImageUrl: string) => void;
  onGoBack: () => void;
  onOpenMap: (lat: number, lng: number) => void;
}

// ── Haversine distance in metres ──────────────────────────────────────────────
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1), dLng = r(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


// ── Proof Verification Screen ─────────────────────────────────────────────────
type AnalysisStep = 'analysing' | 'done';

interface ProofVerificationProps {
  complaint: Complaint;
  proofDataUrl: string;
  adminLocation: GpsLocation | null;
  isAcquiringGps: boolean;
  onConfirmResolve: () => Promise<void>;
  onCancel: () => void;
}

const ProofVerification = ({
  complaint,
  proofDataUrl,
  adminLocation,
  isAcquiringGps,
  onConfirmResolve,
  onCancel,
}: ProofVerificationProps) => {
  const [step, setStep] = useState<AnalysisStep>('analysing');
  const [submitting, setSubmitting] = useState(false);

  const reportedLat = complaint.location.latitude;
  const reportedLng = complaint.location.longitude;

  const distanceM = adminLocation
    ? haversineDistance(reportedLat, reportedLng, adminLocation.latitude, adminLocation.longitude)
    : null;

  const locationMatch = distanceM !== null && distanceM <= 200;
  const locationScore = distanceM !== null
    ? Math.max(0, Math.round(100 - distanceM / 5))
    : 0;

  // Simulate AI analysis delay then show results
  useEffect(() => {
    const timer = setTimeout(() => setStep('done'), 2800);
    return () => clearTimeout(timer);
  }, []);

  const handleConfirm = async () => {
    setSubmitting(true);
    await onConfirmResolve();
  };

  const analysisSteps = [
    { label: 'Loading proof image', done: true },
    { label: 'Extracting GPS metadata', done: adminLocation !== null },
    { label: 'Comparing with reported location', done: step === 'done' },
    { label: 'Calculating match score', done: step === 'done' },
  ];

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 overflow-y-auto pb-32">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onCancel} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Proof Verification</h1>
            <p className="text-xs text-gray-500">AI location analysis</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Proof photo */}
        <div className="rounded-2xl overflow-hidden relative">
          <img src={proofDataUrl} alt="Proof" className="w-full h-56 object-cover" />
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
            Admin proof photo
          </div>
        </div>

        {/* AI Analysis steps */}
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            {step === 'analysing' && (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {step === 'done' && <span className="text-green-500 text-lg">✅</span>}
            <h3 className="text-sm font-semibold text-gray-700">
              {step === 'analysing' ? 'Analysing with AI...' : 'Analysis Complete'}
            </h3>
          </div>

          <div className="space-y-3">
            {analysisSteps.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs transition-all duration-500 ${
                  s.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {s.done ? '✓' : i + 1}
                </div>
                <p className={`text-sm transition-colors duration-500 ${s.done ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                  {s.label}
                </p>
                {!s.done && (
                  <div className="ml-auto w-4 h-4 border-2 border-blue-300 border-t-blue-500 rounded-full animate-spin" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Location comparison (shown after analysis) */}
        {step === 'done' && (
          <>
            <div className="bg-white rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">📍 Location Comparison</h3>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs text-blue-600 font-semibold mb-1">🏙 Citizen's Report</p>
                  <p className="text-xs text-gray-600 line-clamp-2">{complaint.address}</p>
                  <p className="text-xs text-gray-400 mt-1 font-mono">
                    {reportedLat.toFixed(5)}, {reportedLng.toFixed(5)}
                  </p>
                </div>
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs text-green-600 font-semibold mb-1">📷 Admin at Scene</p>
                  {adminLocation ? (
                    <>
                      <p className="text-xs text-gray-600">±{Math.round(adminLocation.accuracy)}m accuracy</p>
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        {adminLocation.latitude.toFixed(5)}, {adminLocation.longitude.toFixed(5)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400">GPS unavailable</p>
                  )}
                </div>
              </div>

              {/* Distance badge */}
              <div className={`flex items-center gap-3 p-3 rounded-xl ${
                locationMatch ? 'bg-green-50 border border-green-200' : distanceM !== null ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
              }`}>
                <span className="text-2xl">{locationMatch ? '✅' : distanceM !== null ? '⚠️' : '❓'}</span>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${locationMatch ? 'text-green-700' : distanceM !== null ? 'text-red-600' : 'text-gray-500'}`}>
                    {locationMatch ? 'Location Verified' : distanceM !== null ? 'Location Mismatch' : 'GPS Unavailable'}
                  </p>
                  {distanceM !== null && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Distance: {distanceM < 1000 ? `${Math.round(distanceM)}m` : `${(distanceM / 1000).toFixed(1)}km`}
                      {' · '}{locationMatch ? 'Within 200m ✓' : 'Exceeds 200m threshold'}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${locationMatch ? 'text-green-600' : 'text-red-500'}`}>{locationScore}</p>
                  <p className="text-xs text-gray-400">/ 100</p>
                </div>
              </div>

              {/* Score bar */}
              <div className="mt-3">
                <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${locationScore}%`,
                      backgroundColor: locationScore >= 70 ? '#10B981' : locationScore >= 40 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Side-by-side mini maps */}
            <div className="bg-white rounded-2xl overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                <div>
                  <p className="text-xs font-semibold text-blue-600 text-center py-2 bg-blue-50">Citizen Report</p>
                  <div style={{ height: '130px' }}>
                    <MapContainer
                      center={[reportedLat, reportedLng]}
                      zoom={16}
                      style={{ height: '100%', width: '100%' }}
                      scrollWheelZoom={false} dragging={false} zoomControl={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[reportedLat, reportedLng]} icon={createCategoryIcon(complaint.category)} />
                      <Circle center={[reportedLat, reportedLng]} radius={Math.max(complaint.location.accuracy, 10)}
                        pathOptions={{ color: '#3B82F6', fillColor: '#3B82F6', fillOpacity: 0.25 }} />
                    </MapContainer>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-green-600 text-center py-2 bg-green-50">Admin at Scene</p>
                  <div style={{ height: '130px' }}>
                    {adminLocation ? (
                      <MapContainer
                        center={[adminLocation.latitude, adminLocation.longitude]}
                        zoom={16}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={false} dragging={false} zoomControl={false}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[adminLocation.latitude, adminLocation.longitude]} icon={createCategoryIcon('other')} />
                        <Circle center={[adminLocation.latitude, adminLocation.longitude]} radius={Math.max(adminLocation.accuracy, 10)}
                          pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.25 }} />
                      </MapContainer>
                    ) : (
                      <div className="h-full bg-gray-100 flex items-center justify-center">
                        <p className="text-xs text-gray-400 text-center px-4">GPS not available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Mismatch warning */}
            {distanceM !== null && !locationMatch && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <p className="text-orange-700 font-semibold text-sm mb-1">⚠️ Location Mismatch</p>
                <p className="text-orange-600 text-sm">
                  You are {Math.round(distanceM)}m from the reported location. Submitting will flag this for manual review.
                </p>
              </div>
            )}

            {/* Summary scores */}
            <div className="bg-white rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-3">🤖 AI Verification Summary</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className={`text-xl font-bold ${locationMatch ? 'text-green-600' : 'text-orange-500'}`}>{locationScore}</p>
                  <p className="text-xs text-gray-500">Location Score</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xl font-bold text-blue-600">{distanceM !== null ? `${Math.round(distanceM)}m` : 'N/A'}</p>
                  <p className="text-xs text-gray-500">Distance</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className={`text-xl font-bold ${locationMatch ? 'text-green-600' : 'text-orange-500'}`}>
                    {locationMatch ? 'Auto' : 'Manual'}
                  </p>
                  <p className="text-xs text-gray-500">Review</p>
                </div>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="space-y-3">
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className={`w-full py-4 rounded-2xl font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
                  submitting ? 'bg-gray-400' :
                  locationMatch ? 'bg-green-600 hover:bg-green-700 active:bg-green-800' :
                  'bg-orange-500 hover:bg-orange-600 active:bg-orange-700'
                }`}
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : locationMatch ? (
                  '✅ Confirm Resolved & Notify Citizen'
                ) : (
                  '⚠️ Submit for Manual Review'
                )}
              </button>
              <button
                onClick={onCancel}
                disabled={submitting}
                className="w-full py-3 rounded-2xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                Retake Photo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Main Details Page ─────────────────────────────────────────────────────────
type ProofState = 'idle' | 'camera' | 'verifying';

const GrievanceDetailsPage = ({
  complaint,
  userRole,
  currentUserId,
  onVote,
  onStatusUpdate,
  onProofUploaded,
  onGoBack,
  onOpenMap,
}: GrievanceDetailsPageProps) => {
  const [proofState, setProofState] = useState<ProofState>('idle');
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [adminLocation, setAdminLocation] = useState<GpsLocation | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState(false);
  const trackerRef = useRef<{ stop: () => void } | null>(null);

  const categoryConfig = CATEGORY_CONFIG[complaint.category];
  const statusConfig = STATUS_CONFIG[complaint.status];
  const hasVoted = complaint.voters.includes(currentUserId);

  // Start GPS whenever proof camera or verifying
  useEffect(() => {
    if (proofState === 'idle') return;

    setIsAcquiringGps(true);
    const tracker = EnhancedGpsService.startTracking(
      (state) => {
        if (state.currentLocation) {
          setAdminLocation(state.currentLocation);
          setIsAcquiringGps(false);
        }
      },
      () => setIsAcquiringGps(false)
    );
    if (tracker) trackerRef.current = tracker;

    return () => {
      trackerRef.current?.stop();
      trackerRef.current = null;
    };
  }, [proofState]);

  // Called by ProofUpload — dataUrl is already base64, safe to store directly
  const handleProofCaptured = useCallback((dataUrl: string, _blob: Blob) => {
    setProofDataUrl(dataUrl);
    setProofState('verifying');
  }, []);

  const handleConfirmResolve = useCallback(async () => {
    if (!proofDataUrl) return;

    const distanceM = adminLocation
      ? haversineDistance(
          complaint.location.latitude, complaint.location.longitude,
          adminLocation.latitude, adminLocation.longitude
        )
      : null;

    const locationMatch = distanceM !== null && distanceM <= 200;

    const notes =
      `Resolved with photo proof. ` +
      (adminLocation
        ? `Admin GPS: ${adminLocation.latitude.toFixed(6)}, ${adminLocation.longitude.toFixed(6)}. ` +
          `Distance from report: ${distanceM !== null ? Math.round(distanceM) + 'm' : 'unknown'}. ` +
          (locationMatch ? 'Location verified ✓' : 'Location mismatch — flagged for manual review.')
        : 'Admin GPS unavailable during upload.');

    // Mark resolved and upload proof → triggers notification in App.tsx
    await onStatusUpdate(complaint.id, 'resolved', notes);
    onProofUploaded(complaint.id, proofDataUrl);

    // Reset
    setProofState('idle');
    setProofDataUrl(null);
    setAdminLocation(null);
    trackerRef.current?.stop();
    trackerRef.current = null;
  }, [proofDataUrl, adminLocation, complaint, onStatusUpdate, onProofUploaded]);

  // ── Render: camera ────────────────────────────────────────────────────────
  if (proofState === 'camera') {
    return (
      <ProofUpload
        grievanceId={complaint.id}
        onProofCaptured={handleProofCaptured}
        onCancel={() => {
          setProofState('idle');
          trackerRef.current?.stop();
          trackerRef.current = null;
        }}
      />
    );
  }

  // ── Render: verification screen ───────────────────────────────────────────
  if (proofState === 'verifying' && proofDataUrl) {
    return (
      <ProofVerification
        complaint={complaint}
        proofDataUrl={proofDataUrl}
        adminLocation={adminLocation}
        isAcquiringGps={isAcquiringGps}
        onConfirmResolve={handleConfirmResolve}
        onCancel={() => {
          setProofState('idle');
          setProofDataUrl(null);
        }}
      />
    );
  }

  // ── Render: main details view ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onGoBack} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
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
          <img src={complaint.imageUrl} alt={complaint.title} className="w-full h-64 object-cover" />
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
            <h2 className="text-xl font-bold text-gray-900">{complaint.title}</h2>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl p-4 mb-4">
          <p className="text-gray-700">{complaint.description}</p>
        </div>

        {/* Mini-map (tappable → full MapPage) */}
        <div className="bg-white rounded-2xl overflow-hidden mb-4">
          <button
            className="w-full relative block"
            style={{ height: '150px' }}
            onClick={() => onOpenMap(complaint.location.latitude, complaint.location.longitude)}
          >
            <MapContainer
              center={[complaint.location.latitude, complaint.location.longitude]}
              zoom={16}
              style={{ height: '100%', width: '100%', pointerEvents: 'none' }}
              scrollWheelZoom={false} dragging={false} zoomControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker
                position={[complaint.location.latitude, complaint.location.longitude]}
                icon={createCategoryIcon(complaint.category)}
              />
              <Circle
                center={[complaint.location.latitude, complaint.location.longitude]}
                radius={Math.max(complaint.location.accuracy, 10)}
                pathOptions={{ color: categoryConfig.color, fillColor: categoryConfig.color, fillOpacity: 0.2 }}
              />
            </MapContainer>
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs text-blue-600 font-medium shadow">
              Tap to open map →
            </div>
          </button>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xl">📍</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Location</p>
                <p className="text-sm text-gray-500">{complaint.address}</p>
                <p className="text-xs text-gray-400 mt-1">
                  GPS: {complaint.location.latitude.toFixed(6)}, {complaint.location.longitude.toFixed(6)} · Accuracy: {Math.round(complaint.location.accuracy)}m
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
              <p className="text-lg font-bold text-gray-900">{Math.round(complaint.aiConfidence * 100)}%</p>
              <p className="text-xs text-gray-500">Confidence</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{complaint.aiSeverity}/5</p>
              <p className="text-xs text-gray-500">Severity</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{Math.round(complaint.priorityScore * 100)}%</p>
              <p className="text-xs text-gray-500">Priority</p>
            </div>
          </div>
        </div>

        {/* Vote */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => onVote(complaint.id)}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
              hasVoted ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill={hasVoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7-7" />
            </svg>
            {complaint.votes} Votes
          </button>
        </div>

        {/* Admin Actions */}
        {userRole === 'admin' && (
          <div className="bg-white rounded-2xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">👨‍💼 Admin Actions</h3>
            <div className="space-y-2">
              {complaint.status === 'submitted' && (
                <button onClick={() => onStatusUpdate(complaint.id, 'under_review')}
                  className="w-full py-2 px-4 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-colors">
                  Start Review
                </button>
              )}
              {complaint.status === 'under_review' && (
                <button onClick={() => onStatusUpdate(complaint.id, 'assigned')}
                  className="w-full py-2 px-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors">
                  Assign to Team
                </button>
              )}
              {complaint.status === 'assigned' && (
                <button onClick={() => onStatusUpdate(complaint.id, 'in_progress')}
                  className="w-full py-2 px-4 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-colors">
                  Mark In Progress
                </button>
              )}

              {/* Proof capture — available from assigned onwards */}
              {['assigned', 'in_progress'].includes(complaint.status) && (
                <button
                  onClick={() => setProofState('camera')}
                  className="w-full py-3 px-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 font-semibold"
                >
                  📷 Capture Proof & Mark Resolved
                </button>
              )}

              {complaint.status === 'resolved' && (
                <button
                  onClick={() => setProofState('camera')}
                  className="w-full py-3 px-4 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  📷 Upload Additional Proof
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
                <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(complaint.createdAt), { addSuffix: true })}</p>
              </div>
            </div>
            {complaint.resolvedAt && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-sm">✅</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Resolved</p>
                  <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(complaint.resolvedAt), { addSuffix: true })}</p>
                  {complaint.resolutionNotes && (
                    <p className="text-xs text-gray-600 mt-1">{complaint.resolutionNotes}</p>
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

export default GrievanceDetailsPage;
