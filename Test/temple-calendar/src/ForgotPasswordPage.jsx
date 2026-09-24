/**
 * ForgotPasswordPage.jsx
 * Entry point for "Forgot password?" on the login page. A single email
 * field that calls useAuth().forgotPassword(email) — see
 * POST /api/auth/forgot-password in server/routes/auth.js.
 *
 * Always shows the same generic success message no matter what the server
 * actually did (account found or not, email sent or not) — the backend is
 * deliberately non-enumerating (see that route's comments), and having the
 * frontend try to show a different message for "found" vs "not found"
 * would undermine that by letting response *shape* leak what the response
 * *text* doesn't. So this page never inspects the response for that.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';

const GENERIC_MESSAGE = "If an account exists for that email, check your inbox for a reset link.";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    // Intentionally ignore the resolved {success, error} shape for what's
    // shown to the user — success or failure, the visible outcome is
    // always the same generic confirmation (see file header).
    await forgotPassword(email.trim());
    setLoading(false);
    setSubmitted(true);
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
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Forgot Password</h1>
          <p className="text-gray-400">We'll email you a link to reset it</p>
        </div>

        <GlassCard gradient className="p-6 sm:p-8">
          {submitted ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📬</div>
              <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
              <p className="text-gray-400 text-sm mb-6">{GENERIC_MESSAGE}</p>
              <PremiumButton onClick={() => navigate('/login')} size="lg" fullWidth>
                Back to Sign In
              </PremiumButton>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@temple.org"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-base"
                />
              </div>

              <PremiumButton type="submit" fullWidth size="lg" disabled={loading}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </PremiumButton>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-purple-400 hover:text-purple-300 transition-colors text-sm"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
