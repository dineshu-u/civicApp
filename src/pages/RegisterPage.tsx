// ============================================
// REGISTER PAGE — OTP-based citizen registration
// Phase 2: Email → OTP (shown in toast) → Account creation
// ============================================

import { useState, useRef } from 'react';
import { BackendService } from '../services/BackendService';
import { User } from '../types';

interface RegisterPageProps {
  onRegistered: (user: User) => void;
  onBack: () => void;
}

type Step = 'email' | 'otp' | 'details';

const RegisterPage = ({ onRegistered, onBack }: RegisterPageProps) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 8000);
  };

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const otp = await BackendService.generateOtp(email);
      setGeneratedOtp(otp);
      setStep('otp');
      showToast(`📧 Your OTP is: ${otp}  (simulated — no real email sent)`);
    } catch (err) {
      setError('Failed to generate OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const entered = otpInput.join('');
    if (entered.length !== 6) { setError('Enter the full 6-digit OTP.'); return; }
    setError('');
    setLoading(true);

    try {
      const valid = await BackendService.verifyOtp(email, entered);
      if (valid) {
        setStep('details');
        setError('');
      } else {
        setError('Incorrect OTP. Please try again.');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Create account ────────────────────────────────────────────────
  const handleCreateAccount = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setLoading(true);

    try {
      const user = await BackendService.registerUser({ name: name.trim(), email, password });
      showToast(`🎉 Welcome to TeNet, ${user.name}!`);
      setTimeout(() => onRegistered(user), 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // OTP digit input handler
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...otpInput];
    updated[index] = value.slice(-1);
    setOtpInput(updated);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpInput[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      {/* OTP Toast */}
      {toast && (
        <div className="fixed top-6 left-4 right-4 z-50 bg-indigo-900 text-white px-5 py-4 rounded-2xl shadow-2xl border border-indigo-700 text-sm font-medium animate-bounce-in">
          {toast}
        </div>
      )}

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl">
            <span className="text-4xl">🏛️</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">TeNet</h1>
          <p className="text-blue-200">Create your citizen account</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {(['email', 'otp', 'details'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  s === step ? 'bg-blue-600 text-white' : 
                  (['email', 'otp', 'details'].indexOf(step) > i) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {(['email', 'otp', 'details'].indexOf(step) > i) ? '✓' : i + 1}
                </div>
                {i < 2 && <div className={`w-8 h-0.5 ${(['email', 'otp', 'details'].indexOf(step) > i) ? 'bg-green-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          {/* ── Step 1: Email ── */}
          {step === 'email' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1 text-center">Enter your email</h2>
              <p className="text-sm text-gray-500 text-center mb-6">We'll send you a verification code</p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                {loading ? 'Sending OTP...' : 'Send OTP →'}
              </button>
            </div>
          )}

          {/* ── Step 2: OTP ── */}
          {step === 'otp' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1 text-center">Verify OTP</h2>
              <p className="text-sm text-gray-500 text-center mb-1">Enter the 6-digit code sent to</p>
              <p className="text-sm font-medium text-blue-600 text-center mb-6">{email}</p>

              <div className="flex justify-center gap-2 mb-6">
                {otpInput.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { otpRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-11 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                ))}
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otpInput.join('').length < 6}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:bg-blue-300 transition-colors mb-3"
              >
                {loading ? 'Verifying...' : 'Verify OTP →'}
              </button>
              <button
                onClick={() => { showToast(`📧 OTP reminder: ${generatedOtp}`); }}
                className="w-full text-blue-600 text-sm py-2 hover:underline"
              >
                Resend / Show OTP
              </button>
            </div>
          )}

          {/* ── Step 3: Account details ── */}
          {step === 'details' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1 text-center">Create Account</h2>
              <p className="text-sm text-gray-500 text-center mb-6">Email verified ✓ Fill in your details</p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Rajesh Kumar"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                      placeholder="Min. 6 characters"
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

              <button
                onClick={handleCreateAccount}
                disabled={loading}
                className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 disabled:bg-green-300 transition-colors"
              >
                {loading ? 'Creating Account...' : '✓ Create Account'}
              </button>
            </div>
          )}

          {/* Back to login */}
          <button
            onClick={onBack}
            className="w-full mt-4 text-sm text-gray-500 py-2 hover:text-gray-700 transition-colors"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
