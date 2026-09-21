/**
 * PremiumLogin.jsx
 * - Eye icon toggle on password field
 * - Mobile responsive
 * - Redirects straight to /dashboard (canManage) or the public calendar
 *   (viewer-only) after login -- no more intermediate "choose mode" step.
 * Black & white — white background, black text — see PremiumLanding.jsx.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import GlassCard from './GlassCard';
import PremiumButton from './PremiumButton';
import GoogleLoginButton from './components/GoogleLoginButton';


// login()/loginWithGoogle() write the fresh user+org to localStorage
// synchronously before resolving (see AuthContext.jsx), so reading it right
// back out here -- rather than destructuring canManage/organization from
// useAuth() at the top of this component -- avoids a stale-closure read:
// this component's own render hasn't picked up the just-completed login
// yet at the point this function runs.
function postLoginDestination() {
  try {
    const user = JSON.parse(localStorage.getItem('cf_user') || 'null');
    const org = JSON.parse(localStorage.getItem('cf_org') || 'null');
    const canManage = !!user && ['owner', 'admin'].includes(user.role);
    if (canManage) return '/dashboard';
    return org?.subdomain ? `/calendar?org=${encodeURIComponent(org.subdomain)}` : '/calendar';
  } catch {
    return '/dashboard';
  }
}

export default function PremiumLogin() {
  const navigate = useNavigate();
  const { login, resendVerification, loginWithGoogle } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Set when login fails specifically because the account isn't verified
  // yet, so the error box can offer a resend action instead of a dead end.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNeedsVerification(false);

    const result = await login(formData.email, formData.password);

    if (result.success) {
      navigate(postLoginDestination());
    } else {
      setError(result.error);
      setNeedsVerification(!!result.needsVerification);
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    await resendVerification(formData.email);
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  };

  const handleGoogleSuccess = async (credential) => {
    setError('');
    setNeedsVerification(false);
    setGoogleLoading(true);
    const result = await loginWithGoogle(credential);
    setGoogleLoading(false);
    if (result.success) {
      navigate(postLoginDestination());
    } else {
      setError(result.error || 'Google sign-in failed. Please try again.');
    }
  };

  const handleGoogleError = (message) => {
    setError(message || 'Google sign-in failed. Please try again.');
  };

  return (
    <div className="relative min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-96 h-96 bg-gray-50 rounded-full blur-3xl top-20 left-20" />
        <div className="absolute w-96 h-96 bg-gray-50 rounded-full blur-3xl bottom-20 right-20" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img src="/calendarfly-icon.png" alt="CalendarFly" className="w-12 h-12 rounded-xl" />
            <span
              className="text-3xl font-bold text-black"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              CalendarFly
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-black mb-2">Welcome Back</h1>
          <p className="text-gray-500">Sign in to your workspace</p>
        </div>

        <GlassCard light className="p-6 sm:p-8">
          {error && (
            // Monochrome by design (see ContactPage/MarketingNav/Footer, PremiumLanding, etc.) —
            // an error is told apart by weight and an icon, not color.
            <div className="mb-6 p-4 rounded-lg bg-gray-50 border-2 border-black text-black text-sm font-semibold">
              <p>✕ {error}</p>
              {needsVerification && (
                <>
                  {resent ? (
                    <p className="mt-2 font-normal">✓ Verification email sent — check your inbox.</p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      className="mt-2 text-black hover:text-gray-600 font-semibold underline disabled:opacity-60"
                    >
                      {resending ? 'Resending…' : 'Resend verification email'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@yourorg.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-300 text-black placeholder-gray-400 transition-colors hover:border-gray-400 focus:outline-none focus:border-black focus:ring-2 focus:ring-black text-base"
              />
            </div>

            {/* Password with eye icon */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div style={{ position: 'relative' }}>
              <input
                  type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-300 text-black placeholder-gray-400 transition-colors hover:border-gray-400 focus:outline-none focus:border-black focus:ring-2 focus:ring-black text-base"
                  style={{ paddingRight: 48 }}
              />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: 14, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: showPassword ? '#000000' : '#9ca3af',
                    padding: 0, display: 'flex', alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    // Eye-off icon
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    // Eye icon
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between text-sm flex-wrap gap-2">
              <label className="flex items-center gap-2 text-gray-500 cursor-pointer">
                <input type="checkbox" className="rounded" />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-black hover:text-gray-600 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <PremiumButton type="submit" fullWidth size="lg" variant="dark" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </PremiumButton>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">Or continue with</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <GoogleLoginButton theme="filled_black" onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
          {googleLoading && (
            <p className="mt-3 text-center text-sm text-gray-500">Signing in…</p>
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Don't have an account?{' '}
              <button
                onClick={() => navigate('/signup')}
                className="text-black hover:text-gray-600 font-semibold transition-colors"
              >
                Start free today
              </button>
            </p>
            {/* The one-click "Try it free" sandbox lives on the landing
                page now (right below the demo card, PremiumLanding.jsx) —
                a more prominent, no-commitment entry point than a footnote
                on the login form. This just points there instead of
                duplicating the button. */}
            <p className="text-gray-400 text-xs mt-2">
              Just want to look around first?{' '}
              <button
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-black font-semibold underline transition-colors"
              >
                Try a free sandbox
              </button>
            </p>
          </div>
        </GlassCard>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-black transition-colors text-sm"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
