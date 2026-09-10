/**
 * WelcomeModal.jsx
 * Welcome modal — shown once per session after admin password gate.
 * Purely conversational now: one prompt ("What would you like to do?"),
 * type freely, get directed to the right feature. No quick-action grid,
 * no upcoming-events strip — those made this feel like a second dashboard
 * instead of a quick "tell me what you need" moment.
 * Dismissed via sessionStorage for rest of session.
 *
 * NOTE: All Anthropic API calls go through /api/chat (backend proxy).
 *       Never call api.anthropic.com directly from the browser.
 *
 * Colors: reads the app's --cf-* tokens (index.css) instead of a local
 * palette — this used to hardcode its own cream/saffron brown-and-gold
 * colors, left over from before the app moved to the jet-black-header /
 * white-page system every other admin surface (toolbar, calendar, account
 * menu) already uses.
 */
import React, { useState, useRef, useEffect } from 'react';

// Same 5-step order as the admin toolbar nav (AdminToolbar.jsx):
// Dashboard -> Flyer -> Announce -> Analytics -> Connect. Shown here as a
// quick, non-clickable orientation strip — the text input below is still
// the one way to actually act from this modal.
const FLOW_STEPS = [
  { icon: '📊', label: 'Dashboard' },
  { icon: '🪔', label: 'Flyer' },
  { icon: '📢', label: 'Announce' },
  { icon: '📈', label: 'Analytics' },
  { icon: '👥', label: 'Connect' },
];

export default function WelcomeModal({ onClose, onAction }) {
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
      setReply("Sorry, I couldn't process that — please try rephrasing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        background: 'var(--cf-bg-surface)', borderRadius: 18, width: 480, maxWidth: '95vw',
        border: '1px solid var(--cf-border)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        overflow: 'hidden', maxHeight: '92vh', overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{ background: 'var(--cf-header-bg)', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28 }}>🛕</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem' }}>Welcome back, Admin</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginTop: 2 }}>What would you like to do?</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        <div style={{ padding: '22px' }}>
          {/* Flow strip — how the five tabs fit together, at a glance */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: '0.66rem', color: 'var(--cf-text-muted)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' }}>
              Your flow
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 2 }}>
              {FLOW_STEPS.map((step, i) => (
                <React.Fragment key={step.label}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 60 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9,
                      background: 'var(--cf-bg-card)', border: '1px solid var(--cf-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                    }}>{step.icon}</div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--cf-text-secondary)', textAlign: 'center', lineHeight: 1.2 }}>{step.label}</div>
                  </div>
                  {i < FLOW_STEPS.length - 1 && (
                    <div style={{ color: 'var(--cf-text-muted)', fontSize: 12, flexShrink: 0, marginTop: 8 }}>→</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAI()}
              placeholder="e.g. send out the Rama Navami invite..."
              style={{
                flex: 1, padding: '12px 14px',
                background: 'var(--cf-bg-base)', border: '1px solid var(--cf-border)',
                borderRadius: 10, color: 'var(--cf-text-primary)', fontSize: '0.92rem',
                outline: 'none', fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <button onClick={handleAI} disabled={!input.trim() || loading} style={{
              padding: '12px 18px',
              background: !input.trim() || loading ? 'var(--cf-border)' : 'var(--cf-btn-bg)',
              border: 'none', borderRadius: 10,
              color: !input.trim() || loading ? 'var(--cf-text-muted)' : '#fff',
              cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
              fontWeight: 800, fontSize: '0.92rem', fontFamily: "'DM Sans', sans-serif",
            }}>
              {loading ? '...' : '🙏'}
            </button>
          </div>
          {reply && (
            <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--cf-bg-deep)', border: '1px solid var(--cf-border)', borderRadius: 10, color: 'var(--cf-text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              {reply}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
