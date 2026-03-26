// ============================================
// CAMERA PAGE (Citizen grievance capture)
// ============================================

import { RefObject } from 'react';
import GpsIndicator from '../components/Common/GpsIndicator';
import { EnhancedGpsState } from '../services/GpsService';

interface CameraPageProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  cameraReady: boolean;
  gpsState: EnhancedGpsState;
  onCapture: () => void;
  onClose: () => void;
}

const CameraPage = ({
  videoRef,
  canvasRef,
  cameraReady,
  gpsState,
  onCapture,
  onClose,
}: CameraPageProps) => (
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
          onClick={onClose}
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

    {/* GPS Indicator */}
    <div className="absolute top-20 left-4 right-4">
      <GpsIndicator gpsState={gpsState} />
    </div>

    {/* Bottom Controls */}
    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
      <div className="flex items-center justify-center">
        <button
          onClick={onCapture}
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

export default CameraPage;
