/**
 * VerifyEmailPage.jsx
 * Landing page for the link in the signup verification email
 * (see server/routes/auth.js GET /api/auth/verify-email). Reads the
 * `token` query param, calls the API itself (rather than the email
 * linking straight at the API), and shows a clear success/error state.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('checking'); // 'checking' | 'success' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This link is missing its verification token.');
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        setStatus('success');
        setMessage(data.alreadyVerified ? 'Your email was already verified.' : 'Your email is verified!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message);
      });
  }, [token]);

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
        </div>

        <GlassCard gradient className="p-6 sm:p-8 text-center">
          {status === 'checking' && (
            <>
              <div className="text-5xl mb-4">⏳</div>
              <p className="text-gray-300">Verifying your email…</p>
            </>
          )}
          {status === 'success' && (
            <>
              <div className="text-5xl mb-4">✅</div>
              <h1 className="text-xl font-bold text-white mb-2">{message}</h1>
              <p className="text-gray-400 text-sm mb-6">You can now sign in to your workspace.</p>
              <PremiumButton onClick={() => navigate('/login')} size="lg" fullWidth>
                Go to Sign In
              </PremiumButton>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="text-5xl mb-4">⚠️</div>
              <h1 className="text-xl font-bold text-white mb-2">Verification failed</h1>
              <p className="text-gray-400 text-sm mb-6">{message}</p>
              <PremiumButton onClick={() => navigate('/login')} size="lg" fullWidth>
                Go to Sign In
              </PremiumButton>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
