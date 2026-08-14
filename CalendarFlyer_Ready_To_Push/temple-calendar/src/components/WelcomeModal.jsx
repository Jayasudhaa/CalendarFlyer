/**
 * WelcomeModal.jsx
 * Smart welcome modal — shown once per session after admin password gate
 * - 6 quick action cards (instant, no AI)
 * - AI text input — type freely, get directed to right feature
 * - Upcoming events strip
 * Dismissed via sessionStorage for rest of session
 *
 * NOTE: All Anthropic API calls go through /api/chat (backend proxy).
 *       Never call api.anthropic.com directly from the browser.
 */
import React, { useState, useRef, useEffect } from 'react';

const W = '#f5deb3';   // wheat text
const G = '#c4a35a';   // gold
const B = '#3d3530';   // border brown
const C = '#302b27';   // card bg
const D = '#3a3020';   // deep bg

const ACTIONS = [
  { id: 'addEvent',   icon: '📅', label: 'Add event',    sub: 'Create a pooja or festival'  },
  { id: 'broadcast',  icon: '📣', label: 'Broadcast',    sub: 'Send to WhatsApp or social'  },
  { id: 'flyer',      icon: '🪄', label: 'Design flyer', sub: 'Open Flyer Studio'           },
  { id: 'analytics',  icon: '📊', label: 'Analytics',    sub: 'View RSVPs and attendance'   },
  { id: 'import',     icon: '📥', label: 'Import events', sub: 'Upload panchang or JSON'    },
  { id: 'settings',   icon: '⚙️', label: 'Settings',     sub: 'Temple config and profile'   },
];

export default function WelcomeModal({ onClose, onAction, upcomingEvents = [] }) {
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [reply,   setReply]   = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const handleAI = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setReply('');
    try {
      // ✅ Route through backend — never call Anthropic directly from browser
      const res = await fetch('/api/chat/welcome-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.trim() }),


      });
      const data = await res.json();

      // Backend returns { action, reply } directly
      const parsedReply  = data.reply  || '';
      const parsedAction = data.action || 'answerQuestion';

      setReply(parsedReply);
      if (parsedAction && parsedAction !== 'answerQuestion') {
        setTimeout(() => {
          onAction(parsedAction);
          onClose();
        }, 1200);
      }
    } catch {
      setReply("Sorry, I couldn't process that. Please use the quick action cards above.");
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  const upcoming = upcomingEvents
    .filter(e => e.type !== 'panchang' && new Date(e.date) >= now)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, fontFamily: 'Georgia, serif',
    }}>
      <div style={{
        background: D, borderRadius: 18, width: 540, maxWidth: '95vw',
        border: `1px solid ${B}`, boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#8B4513,#c2410c)', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28 }}>🛕</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem' }}>Welcome back, Admin</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginTop: 2 }}>Sample Temple Name · What would you like to do today?</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ padding: '20px 22px' }}>

          {/* Action cards */}
          <div style={{ fontSize: '0.68rem', color: '#7c5a3a', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Quick Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            {ACTIONS.map(a => (
              <button key={a.id} onClick={() => { onAction(a.id); onClose(); }} style={{
                textAlign: 'left', padding: '12px 14px',
                background: C, border: `1px solid ${B}`,
                borderRadius: 11, cursor: 'pointer',
                transition: 'all 0.15s', fontFamily: 'Georgia, serif',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#c4a35a'; e.currentTarget.style.background = '#3d3530'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = B; e.currentTarget.style.background = C; }}
              >
                <div style={{ fontSize: 20, marginBottom: 5 }}>{a.icon}</div>
                <div style={{ color: W, fontWeight: 700, fontSize: '0.88rem', marginBottom: 2 }}>{a.label}</div>
                <div style={{ color: '#7c5a3a', fontSize: '0.72rem' }}>{a.sub}</div>
              </button>
            ))}
          </div>

          {/* AI input */}
          <div style={{ background: C, border: `1px solid ${B}`, borderRadius: 11, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: '0.68rem', color: '#7c5a3a', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Or tell me what you need...
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAI()}
                placeholder="e.g. send out the Rama Navami invite..."
                style={{
                  flex: 1, padding: '9px 12px',
                  background: D, border: `1px solid ${B}`,
                  borderRadius: 8, color: W, fontSize: '0.84rem',
                  outline: 'none', fontFamily: 'Georgia, serif',
                }}
              />
              <button onClick={handleAI} disabled={!input.trim() || loading} style={{
                padding: '9px 16px',
                background: !input.trim() || loading ? '#3d3530' : 'linear-gradient(135deg,#8B4513,#c2410c)',
                border: 'none', borderRadius: 8,
                color: !input.trim() || loading ? '#5a3a20' : '#fff',
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                fontWeight: 800, fontSize: '0.84rem', fontFamily: 'Georgia, serif',
              }}>
                {loading ? '...' : '🙏'}
              </button>
            </div>
            {reply && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#3d3530', border: `1px solid ${B}`, borderRadius: 8, color: G, fontSize: '0.82rem', lineHeight: 1.5 }}>
                {reply}
              </div>
            )}
          </div>

          {/* Upcoming events */}
          {upcoming.length > 0 && (
            <div>
              <div style={{ fontSize: '0.68rem', color: '#7c5a3a', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Upcoming This Week</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {upcoming.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: C, border: `1px solid ${B}`, borderRadius: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c2410c', flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: '0.82rem', color: W, fontWeight: 600 }}>{e.title}</div>
                    <div style={{ fontSize: '0.72rem', color: '#7c5a3a' }}>{e.date}{e.time ? ` · ${e.time}` : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
