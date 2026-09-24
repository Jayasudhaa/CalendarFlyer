/**
 * ResetPasswordPage.jsx
 * Landing page for the link in the forgot-password email (see
 * server/routes/auth.js POST /api/auth/reset-password). Reads `token`
 * from the query string like VerifyEmailPage.jsx does, but unlike that
 * page this one doesn't auto-submit on mount — it shows a form (new
 * password + confirm) and only calls the API once the visitor submits it.
 */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';

const MIN_LENGTH = 8;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { resetPassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  // 'form' | 'success' | 'error' | 'no-token'
  const [status, setStatus] = useState(token ? 'form' : 'no-token');
  const [serverError, setServerError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (password.length < MIN_LENGTH) {
      setFormError(`Password must be at least ${MIN_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await resetPassword(token, password);
    setLoading(false);

    if (result.success) {
      setStatus('success');
    } else {
      setServerError(result.error || 'This reset link is invalid or has expired. Please request a new one.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl top-20 left-20 animate-pulse" />
        <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl bottom-20 right-20 animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img src="/calendarfly-icon.png" alt="CalendarFly" className="w-12 h-12 rounded-xl" />
            <span
              className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              CalendarFly
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-gray-400">Choose a new password for your account</p>
        </div>

        <GlassCard gradient className="p-6 sm:p-8">
          {status === 'no-token' && (
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-white mb-2">Missing reset token</h2>
              <p className="text-gray-400 text-sm mb-6">
                This link is missing its reset token. Please request a new password reset link.
              </p>
              <PremiumButton onClick={() => navigate('/forgot-password')} size="lg" fullWidth>
                Request a New Link
              </PremiumButton>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-white mb-2">Password reset!</h2>
              <p className="text-gray-400 text-sm mb-6">
                Your password has been changed. You can now sign in with your new password.
              </p>
              <PremiumButton onClick={() => navigate('/login')} size="lg" fullWidth>
                Go to Sign In
              </PremiumButton>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-white mb-2">Reset failed</h2>
              <p className="text-gray-400 text-sm mb-6">{serverError}</p>
              <PremiumButton onClick={() => navigate('/forgot-password')} size="lg" fullWidth>
                Request a New Link
              </PremiumButton>
            </div>
          )}

          {status === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {formError && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-300 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="reset-new-password" className="block text-sm font-semibold text-gray-300 mb-2">
                  New Password
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-base"
                />
              </div>

              <div>
                <label htmlFor="reset-confirm-password" className="block text-sm font-semibold text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-base"
                />
              </div>

              <PremiumButton type="submit" fullWidth size="lg" disabled={loading}>
                {loading ? 'Resetting…' : 'Reset Password'}
              </PremiumButton>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
