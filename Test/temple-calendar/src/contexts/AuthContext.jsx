/**
 * AuthContext - UPDATED with calendar redirect
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('cf_token');
    const savedUser = localStorage.getItem('cf_user');
    const savedOrg = localStorage.getItem('cf_org');

    if (token && savedUser && savedOrg) {
      setUser(JSON.parse(savedUser));
      setOrganization(JSON.parse(savedOrg));
    }
    setLoading(false);
  }, []);

  // Fetches the complete organization object (plan, features, limits,
  // usage, team_members_used, billing, ...) right after a successful
  // login/Google sign-in, so pages reading useAuth().organization --
  // e.g. AdminToolbar's plan badge -- don't keep showing a stale "Free"
  // state until the user happens to visit the Subscription page (the
  // only place that previously called setOrganizationData with a full
  // org). Falls back to the lightweight `fallbackOrg` already returned
  // by the login/google response if this fetch fails for any reason
  // (network hiccup, etc.), so login still succeeds either way.
  const fetchFullOrganization = async (token, fallbackOrg) => {
    // login()/Google sign-in await this before ever returning, so a hung
    // request here (slow network, backend stall) used to freeze the
    // "Signing in..." button forever with no error shown. Bounded with a
    // timeout so a stall just falls back to the lightweight org from the
    // login response instead of blocking sign-in indefinitely.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/organizations/me', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok) return fallbackOrg;
      // GET /api/organizations/me returns the org fields directly
      // (no `{ organization }` wrapper) -- see routes/organizations.js.
      const fullOrg = await response.json();
      return fullOrg && fullOrg.org_id ? fullOrg : fallbackOrg;
    } catch (error) {
      return fallbackOrg;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        // Unverified-email accounts get a distinct flag (plus the email
        // address) so the login screen can offer a "resend" action instead
        // of just showing a dead-end error.
        return { success: false, error: data.error || 'Login failed', needsVerification: !!data.needsVerification, email: data.email };
      }

      localStorage.setItem('cf_token', data.token);
      localStorage.setItem('cf_user', JSON.stringify(data.user));
      setUser(data.user);

      const fullOrg = await fetchFullOrganization(data.token, data.organization);
      localStorage.setItem('cf_org', JSON.stringify(fullOrg));
      setOrganization(fullOrg);

      return { success: true, organization: fullOrg };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Signs in with a Google ID token (the `credential` from the frontend's
  // GoogleLogin button — see components/GoogleLoginButton.jsx). The server
  // verifies it, signs a/an existing account in, or creates a brand-new
  // organization for a first-time email — see POST /api/auth/google in
  // server/routes/auth.js for what actually decides that. Same response
  // shape as login(), so it's stored the same way.
  const loginWithGoogle = async (credential) => {
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Google sign-in failed' };
      }

      localStorage.setItem('cf_token', data.token);
      localStorage.setItem('cf_user', JSON.stringify(data.user));
      setUser(data.user);

      const fullOrg = await fetchFullOrganization(data.token, data.organization);
      localStorage.setItem('cf_org', JSON.stringify(fullOrg));
      setOrganization(fullOrg);

      return { success: true, organization: fullOrg };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Self-serve "Try it free" sandbox — POST /api/auth/guest-sandbox creates
  // a brand-new isolated org+account with no form, no password, and a 48h
  // expiry baked into the token itself (see auth.js). Stored the same way
  // login()/loginWithGoogle() store a session, then seeds the fresh org
  // with sample events (via eventTemplates.js — the same starter-event data
  // PremiumSettings.jsx offers a real admin) so the guest lands in a
  // populated calendar instead of an empty one.
  const startGuestSandbox = async (category = 'temple') => {
    try {
      const response = await fetch('/api/auth/guest-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Could not start a sandbox session' };
      }

      localStorage.setItem('cf_token', data.token);
      localStorage.setItem('cf_user', JSON.stringify(data.user));
      setUser(data.user);

      const fullOrg = await fetchFullOrganization(data.token, data.organization);
      localStorage.setItem('cf_org', JSON.stringify(fullOrg));
      setOrganization(fullOrg);

      // Best-effort seeding — a guest still gets a working (if partly- or
      // un-seeded) sandbox even if this fails, so it never blocks the
      // sandbox session itself from starting.
      try {
        const { getTemplateEvents } = await import('../utils/eventTemplates');
        const templateEvents = getTemplateEvents(data.category || category);
        for (const ev of templateEvents) {
          await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
            body: JSON.stringify(ev),
          });
        }
      } catch (seedError) {
        console.error('[AUTH] Failed to seed sandbox sample events:', seedError);
      }

      return { success: true, organization: fullOrg, sandbox_expires_at: data.sandbox_expires_at };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Signup no longer returns a login token — the account is created
  // unverified and the server emails a verification link (see
  // routes/auth.js). Nothing to store here or log the user into; the
  // caller (PremiumSignup.jsx) shows a "check your email" screen using
  // the returned email/message instead of navigating into the app.
  const signup = async (formData) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }
      return { success: true, needsVerification: true, email: data.email, message: data.message, emailSendFailed: data.emailSendFailed };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Resends the verification email — used from both the post-signup
  // confirmation screen and the "email not verified" state on the login
  // page. Always resolves success (the server intentionally never reveals
  // whether an address exists or was already verified).
  const resendVerification = async (email) => {
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Requests a password reset email. Always resolves success from the
  // caller's point of view — same anti-enumeration pattern as
  // resendVerification() above, the server intentionally never reveals
  // whether the address exists. Callers should show a generic "check your
  // email" message regardless of the resolved value here.
  const forgotPassword = async (email) => {
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Submits a new password for the account identified by `token` (the
  // reset-password link's query param — see ResetPasswordPage.jsx and
  // POST /api/auth/reset-password in server/routes/auth.js). Unlike
  // forgotPassword above, this DOES surface a real error — an invalid,
  // expired, or already-used token needs to tell the visitor to request a
  // new link rather than pretending it worked.
  const resetPassword = async (token, newPassword) => {
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'This reset link is invalid or has expired. Please request a new one.' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  function logout() {
    localStorage.removeItem('cf_token');
    localStorage.removeItem('cf_user');
    localStorage.removeItem('cf_org');
    // Clear flyer studio data on logout
    localStorage.removeItem('flyer_studio_data');
    setUser(null);
    setOrganization(null);
    // This used to only clear state, with no redirect — fine on /admin
    // itself (it Navigates to /login as soon as isAuthenticated goes
    // false, see App.jsx's AdminCalendar), but every other authenticated
    // page (Profile, Settings, Subscription, Team, Analytics, ...) has no
    // such guard, so clicking Logout from AdminToolbar's account menu on
    // any of them just cleared your session and left you sitting on the
    // same page — it looked like the button did nothing. Redirecting here,
    // once, covers every caller instead of adding a guard to each page.
    navigate('/login', { replace: true });
  };

  const updateOrganization = async (updates) => {
    try {
      const token = localStorage.getItem('cf_token');
      const response = await fetch('/api/organizations/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Update failed');
      }
      const updatedOrg = data.organization;
      localStorage.setItem('cf_org', JSON.stringify(updatedOrg));
      setOrganization(updatedOrg);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const updateProfile = async (updates) => {
    try {
      const token = localStorage.getItem('cf_token');
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Update failed');
      }
      const updatedUser = data.user;
      localStorage.setItem('cf_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const token = localStorage.getItem('cf_token');
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Sync fresh org data (plan, billing, usage, ...) into shared context
  // state -- for callers (SubscriptionPage after checkout/plan switch) that
  // already fetched the current organization themselves and just need
  // every other page reading useAuth().organization to see it too, without
  // a network round-trip or a full page reload. Distinct from
  // updateOrganization() above, which PUTs to /api/organizations/settings
  // (org profile edits) -- this only ever writes local state + cache.
  const setOrganizationData = (org) => {
    if (!org) return;
    localStorage.setItem('cf_org', JSON.stringify(org));
    setOrganization(org);
  };

  // Normalizes user.role the same way server/middleware/roles.js does, so
  // the client and server never disagree about what a given role can do.
  // 'guest' is the legacy tier this replaced — treated identically to
  // 'viewer' rather than requiring every existing account to be rewritten.
  const role = (() => {
    if (!user) return null;
    if (user.role === 'guest') return 'viewer';
    if (['owner', 'admin', 'viewer'].includes(user.role)) return user.role;
    return 'viewer'; // fail closed on an unrecognized value
  })();
  const isOwner = role === 'owner';
  const isAdmin = role === 'admin';
  const isViewer = role === 'viewer';
  const canManage = isOwner || isAdmin; // create/edit events, flyers, broadcast, settings, team

  const value = {
    user,
    organization,
    loading,
    isAuthenticated: !!user,
    role,
    isOwner,
    isAdmin,
    isViewer,
    canManage,
    login,
    loginWithGoogle,
    startGuestSandbox,
    signup,
    resendVerification,
    forgotPassword,
    resetPassword,
    logout,
    updateOrganization,
    setOrganizationData,
    updateProfile,
    changePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );

  }

