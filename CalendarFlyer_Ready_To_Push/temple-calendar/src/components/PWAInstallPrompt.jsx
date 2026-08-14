/**
 * PWAInstallPrompt.jsx
 * Shows an install banner on mobile when the app is installable.
 * Add <PWAInstallPrompt /> near the bottom of App.jsx (before closing div).
 */
import React, { useState, useEffect } from 'react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow]                     = useState(false);
  const [installed, setInstalled]           = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show on mobile
      if (window.innerWidth < 900) setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setInstalled(true); setShow(false); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setShow(false);
    setDeferredPrompt(null);
  }

  if (!show || installed) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99999,
      background: '#231206', borderTop: '1px solid #c9943a44',
      padding: '14px 16px', display: 'flex', alignItems: 'center',
      gap: 12, fontFamily: 'Georgia, serif',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
      animation: 'slideUp 0.3s ease',
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>

      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#9d6b2a,#6a3a10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
        🕉
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0e0b8', marginBottom: 2 }}>
          Install CalendarFly
        </div>
        <div style={{ fontSize: 11, color: '#7a5a30', lineHeight: 1.4 }}>
          Add to home screen for quick access to temple events
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={() => setShow(false)} style={{
          padding: '8px 12px', borderRadius: 7, border: '1px solid #3a2008',
          background: 'transparent', color: '#7a5a30', fontSize: 12,
          fontWeight: 600, cursor: 'pointer', fontFamily: 'Georgia, serif',
        }}>
          Later
        </button>
        <button onClick={handleInstall} style={{
          padding: '8px 14px', borderRadius: 7, border: 'none',
          background: 'linear-gradient(135deg,#c9943a,#a8761e)', color: '#fff',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif',
        }}>
          Install
        </button>
      </div>
    </div>
  );
}
