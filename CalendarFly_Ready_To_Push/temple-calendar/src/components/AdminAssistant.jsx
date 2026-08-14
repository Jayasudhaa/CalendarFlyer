/**
 * AdminAssistant.jsx
 * Floating AI assistant bubble — bottom-right on all admin pages
 * - Answers how-to questions about CalendarFly
 * - Opens modals via onAction callback
 * - Looks up events from props
 * - Suggests next steps based on upcoming events
 *
 * NOTE: All Anthropic API calls go through /api/chat (backend proxy).
 *       Never call api.anthropic.com directly from the browser.
 */
import React, { useState, useRef, useEffect } from 'react';

const W = '#f5deb3';
const G = '#c4a35a';
const B = '#3d3530';
const C = '#302b27';
const D = '#3a3020';

const SUGGESTIONS = [
  'How do I add a new event?',
  'Open broadcast studio',
  'What events are coming up?',
  'How do I import panchang?',
  'Show me RSVP analytics',
  'Create a flyer',
];

function TypingDots() {
  return (
  <div style={{ display: 'flex', gap: 4, padding: '4px 2px' }}>
    {[0,1,2].map(i => (
      <div key={i} style={{
        width: 6, height: 6, borderRadius: '50%', background: G,
        animation: 'wdBounce 1.2s infinite', animationDelay: `${i * 0.2}s`,
      }} />
    ))}
  </div>
);
}

export default function AdminAssistant({ events = [], onAction }) {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([{
    id: 'welcome', role: 'bot',
    text: '🙏 Namaste! I\'m your CalendarFly assistant. Ask me anything or tell me what you need — I\'ll help you get there!',
  }]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [unread,   setUnread]   = useState(0);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { if (open) { setUnread(0); setTimeout(() => inputRef.current?.focus(), 100); } }, [open]);

  const upcomingEvents = events
    .filter(e => e.type !== 'panchang' && new Date(e.date) >= new Date())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)
    .map(e => `${e.date}: ${e.title}${e.time ? ' at ' + e.time : ''}`)
    .join('\n');

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: msg }]);
    setLoading(true);

    try {
      // ✅ Route through backend — never call Anthropic directly from browser
      const res = await fetch('/api/chat/admin-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,

          upcomingEvents: upcomingEvents || 'No upcoming events loaded yet.',



        }),
      });

      const data = await res.json();

      // Backend returns { reply, action } directly
      const reply  = data.reply  || "I can help with that!";
      const action = data.action || null;

      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'bot', text: reply }]);

      if (action && onAction) {
        const actionMap = {
          openAddEvent:  'addEvent',
          openBroadcast: 'broadcast',
          openFlyer:     'flyer',
          openAnalytics: 'analytics',
          openImport:    'import',
          openSettings:  'settings',
          openHelp:      'help',
        };
        const mapped = actionMap[action];
        if (mapped) setTimeout(() => onAction(mapped), 800);
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'bot', text: "Sorry, I couldn't process that right now. Please try again! 🙏" }]);
    } finally {
      setLoading(false);
      if (!open) setUnread(n => n + 1);
    }
  };

  const S = {
    wrapper: { position: 'fixed', bottom: 24, right: 24, zIndex: 8999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, fontFamily: 'Georgia, serif' },
    window: { width: 340, maxWidth: 'calc(100vw - 48px)', maxHeight: 480, background: D, borderRadius: 16, border: `1.5px solid ${B}`, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    header: { background: 'linear-gradient(135deg,#8B4513,#c2410c)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
    messages: { flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, scrollbarWidth: 'thin', scrollbarColor: `${B} transparent` },
    bubble: (role) => ({ maxWidth: '85%', padding: '8px 12px', borderRadius: role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: role === 'user' ? 'linear-gradient(135deg,#8B4513,#c2410c)' : C, color: role === 'user' ? '#fff' : W, fontSize: '0.82rem', lineHeight: 1.6, alignSelf: role === 'user' ? 'flex-end' : 'flex-start', border: role === 'bot' ? `1px solid ${B}` : 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }),
    suggestions: { padding: '8px 12px 10px', display: 'flex', flexWrap: 'wrap', gap: 5, borderTop: `1px solid ${B}`, flexShrink: 0 },
    pill: { padding: '4px 10px', borderRadius: 20, border: `1px solid ${B}`, background: C, color: G, fontSize: '0.7rem', cursor: 'pointer', fontWeight: 600, fontFamily: 'Georgia, serif', transition: 'all 0.12s' },
    inputRow: { display: 'flex', gap: 7, padding: '9px 12px', borderTop: `1px solid ${B}`, background: C, flexShrink: 0 },
    input: { flex: 1, padding: '8px 11px', borderRadius: 20, border: `1px solid ${B}`, background: D, color: W, fontSize: '0.82rem', outline: 'none', fontFamily: 'Georgia, serif' },
    sendBtn: (dis) => ({ width: 34, height: 34, borderRadius: '50%', border: 'none', background: dis ? '#3d3530' : 'linear-gradient(135deg,#8B4513,#c2410c)', color: dis ? '#5a3a20' : '#fff', cursor: dis ? 'not-allowed' : 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }),
    fab: { width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#8B4513,#c2410c)', border: '3px solid #fff', boxShadow: '0 4px 16px rgba(139,69,19,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', transition: 'transform 0.2s', position: 'relative' },
    badge: { position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: '0.62rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' },
  };

  const showSuggestions = messages.length <= 1;

  return (
    <div style={S.wrapper}>
      <style>{`
        @keyframes wdBounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-5px);opacity:1} }
        @keyframes wdSlide { from{opacity:0;transform:translateY(12px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>

      {open && (
        <div style={{ ...S.window, animation: 'wdSlide 0.2s ease' }}>
          <div style={S.header}>
            <div style={{ fontSize: 18 }}>🛕</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem' }}>Temple Assistant</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.66rem', marginTop: 1 }}>Admin AI · CalendarFly</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>

          <div style={S.messages}>
            {messages.map(m => <div key={m.id} style={S.bubble(m.role)}>{m.text}</div>)}
            {loading && <div style={{ ...S.bubble('bot'), padding: '8px 12px' }}><TypingDots /></div>}
            <div ref={bottomRef} />
          </div>

          {showSuggestions && (
            <div style={S.suggestions}>
              {SUGGESTIONS.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)} style={S.pill}
                  onMouseEnter={e => { e.target.style.background = '#3d3530'; e.target.style.borderColor = G; }}
                  onMouseLeave={e => { e.target.style.background = C; e.target.style.borderColor = B; }}
                >{q}</button>
              ))}
            </div>
          )}

          <div style={S.inputRow}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask anything..." style={S.input} disabled={loading} maxLength={300} />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={S.sendBtn(!input.trim() || loading)}>🙏</button>
          </div>
        </div>
      )}

      <button onClick={() => setOpen(v => !v)} style={S.fab} title="Temple Assistant"
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
        {open ? '×' : '🤖'}
        {!open && unread > 0 && <div style={S.badge}>{unread}</div>}
      </button>
    </div>
  );
}
