/**
 * Authentication Service
 * Handles user authentication, session management, and credential validation
 */

// ── Config ────────────────────────────────────────────────────────────────────

// --- HELPERS ---


const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'temple2026',
};

// --- CORE AUTH FUNCTIONS ---
const ALLOWED_GOOGLE_EMAILS = [
];

const SESSION_KEY  = 'temple_auth_session';
const SESSION_DAYS = 7;
export const validateCredentials = (username, password) => {
  return (
    username === ADMIN_CREDENTIALS.username &&
    password === ADMIN_CREDENTIALS.password
  );
};
export const createSession = (username, rememberMe = false) => {
  const session = {
    username,
    displayName: 'Temple Admin',
    authMethod: 'password',
    loginTime: new Date().toISOString(),
    expiresAt: rememberMe
      ? new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()
      : null,
  };
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
};

/**
 * Validates the Google JWT and extracts user info
 */
export const validateGoogleToken = async (credential) => {
  try {
    // Safer way to decode Base64 in browsers
    const parts = credential.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT format');
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Google token expired' };
    }
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
      return { valid: false, error: 'Invalid token issuer' };
    }

    // Check audience matches your client ID
    const clientId = '222197933595-201pgkmptsjb355grv4hrik8en2fin16.apps.googleusercontent.com';
    if (payload.aud !== clientId) {
      return { valid: false, error: 'Token audience mismatch' };
    }

    const user = {
      email:       payload.email,
      displayName: payload.name,
        picture: payload.picture,
      googleId:    payload.sub,
    };
    if (ALLOWED_GOOGLE_EMAILS.length > 0) {
      if (!ALLOWED_GOOGLE_EMAILS.includes(payload.email)) {
        return { valid: false, error: `Access denied for ${payload.email}. Contact temple admin.` };
      }
    }
    return { valid: true, user };
  } catch (err) {
    console.error('Google token decode error:', err);
    return { valid: false, error: 'Failed to validate Google token' };
  }
};

// --- SESSION MANAGEMENT ---

  


export const createGoogleSession = (googleUser, rememberMe = false) => {
  const session = {
    username:    googleUser.email,
    displayName: googleUser.displayName,
    picture:     googleUser.picture,
    email:       googleUser.email,
    authMethod:  'google',
    loginTime:   new Date().toISOString(),
    expiresAt:   rememberMe
      ? new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()
      : null,
  };

  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
};

export const checkAuth = () => {
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  
    try {
    const session = JSON.parse(raw);
    // Check expiry (only for rememberMe sessions)
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      logout(); // Auto-logout if expired
      return null;
    }
    return session;
  } catch {
  return null;
  }
};

export const logout = () => {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
};

