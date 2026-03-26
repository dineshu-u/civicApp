// ============================================
// PREVIEW/SUBMIT GRIEVANCE PAGE
// Phase 2: Full category picker for RLHF feedback
// ============================================

import { AIClassification } from '../services/AIClassifier';
import { AIClassifier } from '../services/AIClassifier';
import { CaptureSession, TrustScore, CATEGORY_CONFIG, ComplaintCategory } from '../types';

interface SubmitGrievancePageProps {
  capturedImage: string | null;
  isProcessing: boolean;
  address: string;
  captureSession: CaptureSession | null;
  aiClassification: AIClassification | null;
  trustScore: TrustScore | null;
  description: string;
  onDescriptionChange: (desc: string) => void;
  onChangeCategory: (classification: AIClassification) => void;
  onSubmit: () => void;
  onRetake: () => void;
}

const ALL_CATEGORIES = Object.values(CATEGORY_CONFIG);

const SubmitGrievancePage = ({
  capturedImage,
  isProcessing,
  address,
  captureSession,
  aiClassification,
  trustScore,
  description,
  onDescriptionChange,
  onChangeCategory,
  onSubmit,
  onRetake,
}: SubmitGrievancePageProps) => {

  const handleCategorySelect = async (newCategory: ComplaintCategory) => {
    if (!aiClassification) return;

    // RLHF: record correction when user manually changes category
    if (newCategory !== aiClassification.category && aiClassification.imageHash) {
      await AIClassifier.submitFeedback(
        aiClassification.imageHash,
        aiClassification.category,
        newCategory
      );
    }

    // Rebuild allPredictions with selected category boosted to top
    const updatedPredictions = aiClassification.allPredictions.map((p) =>
      p.category === newCategory
        ? { ...p, confidence: Math.max(p.confidence, 0.9) }
        : p.category === aiClassification.category
        ? { ...p, confidence: Math.min(p.confidence, 0.3) }
        : p
    ).sort((a, b) => b.confidence - a.confidence);

    onChangeCategory({
      ...aiClassification,
      category: newCategory,
      allPredictions: updatedPredictions,
      confidence: Math.max(aiClassification.confidence, 0.9),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onRetake} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
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
                <p className="text-sm font-medium">Analyzing with AI...</p>
                <p className="text-xs text-white/70 mt-1">Loading MobileNet model</p>
              </div>
            </div>
          )}
          {/* Model badge */}
          {aiClassification && !isProcessing && (
            <div className="absolute top-2 right-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                aiClassification.modelUsed === 'mobilenet'
                  ? 'bg-green-500 text-white'
                  : 'bg-orange-400 text-white'
              }`}>
                {aiClassification.modelUsed === 'mobilenet' ? '🧠 MobileNet' : '📊 Pixel Analysis'}
              </span>
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

        {/* AI Classification + RLHF Category Picker */}
        {aiClassification && (
          <div className="bg-white rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-500">🤖 AI Classification</h3>
              {aiClassification.modelUsed === 'mobilenet' && (
                <span className="text-xs text-green-600 font-medium">MobileNet + RLHF</span>
              )}
            </div>

            {/* Selected category display */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: CATEGORY_CONFIG[aiClassification.category].color + '20' }}
              >
                {CATEGORY_CONFIG[aiClassification.category].icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{CATEGORY_CONFIG[aiClassification.category].label}</p>
                <p className="text-sm text-gray-500">{aiClassification.reasoning}</p>
                <p className="text-xs text-gray-400">Severity: {aiClassification.severity}/5</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600">{Math.round(aiClassification.confidence * 100)}%</p>
                <p className="text-xs text-gray-400">Confidence</p>
              </div>
            </div>

            {/* Full category grid for RLHF correction */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <span>✏️</span>
                <span>Correct the category — your feedback trains the AI (RLHF)</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {ALL_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => handleCategorySelect(cat.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-medium transition-all border-2 ${
                      cat.value === aiClassification.category
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-transparent bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-lg">{cat.icon}</span>
                    <span className="text-center leading-tight">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>
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
                    cx="40" cy="40" r="36"
                    stroke={trustScore.overall >= 70 ? '#10B981' : trustScore.overall >= 50 ? '#F59E0B' : '#EF4444'}
                    strokeWidth="8" fill="none"
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
                  {trustScore.verificationStatus === 'verified' ? '✓ Verified' : trustScore.verificationStatus === 'pending' ? '⏳ Pending Review' : trustScore.verificationStatus === 'manual_review' ? '⚠️ Manual Review' : '❌ Suspicious'}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {trustScore.components.map((comp, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{comp.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${comp.score}%`, backgroundColor: comp.score >= 70 ? '#10B981' : comp.score >= 50 ? '#F59E0B' : '#EF4444' }}
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
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe the issue in detail..."
            maxLength={500}
            className="w-full h-24 p-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">{description.length}/500 characters</p>
        </div>

        {/* Submit Button */}
        <button
          onClick={onSubmit}
          disabled={isProcessing || !aiClassification}
          className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? 'Submitting...' : 'Submit Report'}
        </button>
      </div>
    </div>
  );
};

export default SubmitGrievancePage;
