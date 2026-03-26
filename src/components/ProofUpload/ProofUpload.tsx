// ============================================
// PROOF UPLOAD COMPONENT (Camera-only for Admin)
// Admin takes live camera photos as proof of work completion
// No file upload allowed to prevent fake proof
// ============================================

import { useState, useRef, useCallback, useEffect } from 'react';

interface ProofUploadProps {
  grievanceId: string;
  onProofCaptured: (imageDataUrl: string, blob: Blob) => void;
  onCancel: () => void;
}

const ProofUpload = ({ grievanceId, onProofCaptured, onCancel }: ProofUploadProps) => {
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedProof, setCapturedProof] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setCameraReady(false);
      setError(null);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setCameraReady(true);
          }).catch(console.error);
        };
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Unable to access camera. Please check permissions and try again.');
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
  }, []);

  const captureProofPhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        setCapturedProof(imageUrl);
        setCapturedBlob(blob);
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  }, [cameraReady, stopCamera]);

  const retakePhoto = useCallback(() => {
    if (capturedProof) {
      URL.revokeObjectURL(capturedProof);
    }
    setCapturedProof(null);
    setCapturedBlob(null);
    startCamera();
  }, [capturedProof, startCamera]);

  // Auto-start camera on mount; stop on unmount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmProof = useCallback(() => {
    if (capturedProof && capturedBlob) {
      onProofCaptured(capturedProof, capturedBlob);
    }
  }, [capturedProof, capturedBlob, onProofCaptured]);

  const handleClose = useCallback(() => {
    stopCamera();
    if (capturedProof) {
      URL.revokeObjectURL(capturedProof);
    }
    onCancel();
  }, [stopCamera, capturedProof, onCancel]);

  // Show captured proof for confirmation
  if (capturedProof) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent z-10">
          <div className="flex items-center justify-between">
            <button onClick={handleClose} className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h1 className="text-white font-semibold">Confirm Proof</h1>
            <div className="w-10" />
          </div>
        </div>

        <img src={capturedProof} alt="Proof" className="flex-1 object-contain" />

        <div className="p-4 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-white/70 text-xs text-center mb-3">
            Proof for Grievance: {grievanceId}
          </p>
          <div className="flex gap-3">
            <button
              onClick={retakePhoto}
              className="flex-1 py-3 px-4 bg-white/20 backdrop-blur text-white font-semibold rounded-xl hover:bg-white/30"
            >
              🔄 Retake
            </button>
            <button
              onClick={confirmProof}
              className="flex-1 py-3 px-4 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600"
            >
              ✓ Upload Proof
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Camera view
  return (
    <div className="fixed inset-0 bg-black z-50">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Loading */}
      {!cameraReady && !error && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">Starting Camera...</p>
            <p className="text-white/50 text-sm mt-2">Camera-only: ensures authentic proof</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="text-center px-8">
            <div className="w-16 h-16 bg-red-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-3xl">📷</span>
            </div>
            <p className="text-white text-lg mb-2">Camera Error</p>
            <p className="text-white/60 text-sm mb-6">{error}</p>
            <div className="flex gap-3">
              <button onClick={handleClose} className="flex-1 py-3 px-4 bg-white/20 text-white rounded-xl">
                Cancel
              </button>
              <button onClick={startCamera} className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-xl">
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <button onClick={handleClose} className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="text-center">
            <h1 className="text-white font-semibold">Upload Proof</h1>
            <p className="text-white/50 text-xs">Camera capture only</p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Frame Guide */}
      {cameraReady && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 border-2 border-green-400/50 rounded-lg">
            <div className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
            <div className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
            <div className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
            <div className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center justify-center">
          <button
            onClick={captureProofPhoto}
            disabled={!cameraReady}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
              cameraReady ? 'bg-white' : 'bg-gray-500'
            }`}
          >
            <div className={`w-16 h-16 rounded-full border-4 ${cameraReady ? 'border-green-500' : 'border-gray-400'}`} />
          </button>
        </div>
        <p className="text-center text-white/70 text-sm mt-4">
          {cameraReady ? 'Capture proof of completed work' : 'Initializing camera...'}
        </p>
      </div>
    </div>
  );
};

export default ProofUpload;
