/**
 * WebChatWidget.jsx
 * Claude-powered web chat widget for [Your Organization Name]
 * - Sits on public calendar (bottom-right)
 * - Calls /api/chat/temple-bot (backend proxy → Claude API)
 * - Injected with live events from /api/events/upcoming
 * - WhatsApp fallback button always available
 *
 * Usage: import WebChatWidget from './components/WebChatWidget';
 *        <WebChatWidget />
 */

import React, { useState, useEffect, useRef } from 'react';

const TEMPLE_WA = '17203313601';

const SUGGESTED_QUESTIONS = [
  'What events are happening this week?',
  'When is the next abhishekam?',
  'What are the temple timings?',
  'Tell me about kalyanam',
  'Where is the temple located?',
  'What is annadanam?',
];

function TypingDots() {
  return (
  <div style={{ display:'flex', gap:4, padding:'4px 2px', alignItems:'center' }}>
    {[0,1,2].map(i => (
      <div key={i} style={{
        width:7, height:7, borderRadius:'50%',
        background:'#c9943a',
        animation:'wcBounce 1.2s infinite',
        animationDelay:`${i*0.2}s`,
      }}/>
    ))}
  </div>
);
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display:'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom:10,
    }}>
      {!isUser && (
        <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#8B4513,#c2410c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, marginRight:7, marginTop:2 }}>🛕</div>
      )}
      <div style={{
        maxWidth:'78%',
        padding:'9px 13px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser ? 'linear-gradient(135deg,#8B4513,#c2410c)' : '#1e1208',
        color: isUser ? '#fff' : '#f0e0b8',
        fontSize:'0.83rem',
        lineHeight:1.65,
        border: isUser ? 'none' : '1px solid #3a2008',
        whiteSpace:'pre-wrap',
        wordBreak:'break-word',
        boxShadow: isUser ? '0 2px 8px rgba(139,69,19,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        {msg.text}
      </div>
    </div>
  );
}

export default function WebChatWidget({ events = [] }) {
  const [open,      setOpen]      = useState(false);
  const [messages,  setMessages]  = useState([{
    id:'welcome', role:'bot',
    text:'🙏 Namaste! I am the Sample Temple Name assistant. Ask me about events, poojas, timings, or anything about our temple!',
  }]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [unread,    setUnread]    = useState(0);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);


  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    // Compute fresh at send time so async-loaded events are always included
    const today = new Date().toISOString().slice(0, 10);
    const upcomingFiltered = events
      .filter(e => e.type !== 'panchang' && e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 20);
    const upcomingText = upcomingFiltered.length > 0
      ? upcomingFiltered.map(e => `${e.date}: ${e.title}${e.time ? ' at ' + e.time : ''}`).join('\n')
      : 'No upcoming events loaded.';

    const userMsg = { id: Date.now(), role:'user', text: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat/temple-bot', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ message: msg, upcomingEvents: upcomingText }),
      });
      const data = await res.json();
      const reply = data.reply || "I'm not sure about that. Please contact the temple directly.";
      setMessages(prev => [...prev, { id: Date.now()+1, role:'bot', text: reply }]);
      if (!open) setUnread(n => n+1);
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now()+1, role:'bot',
        text:'Sorry, I\'m having trouble connecting right now. Please try again or reach us on WhatsApp 🙏',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const openWA = () => {
    window.open(`https://wa.me/${TEMPLE_WA}?text=${encodeURIComponent('Namaste! I have a question about the temple.')}`, '_blank');
  };

  const showSuggestions = messages.length <= 1;

  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9100, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:10, fontFamily:'Georgia,serif' }}>
      <style>{`
        @keyframes wcBounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-5px);opacity:1} }
        @keyframes wcSlide  { from{opacity:0;transform:translateY(14px) scale(0.96)} to{opacity:1;transform:translateY(0) scale(1)} }
        .wc-input:focus { outline:none; border-color:#c9943a !important; }
        .wc-pill:hover  { background:#3a2008 !important; border-color:#c9943a !important; color:#e8c878 !important; }
        .wc-send:hover:not(:disabled) { background:linear-gradient(135deg,#a0340a,#8B4513) !important; }
        .wc-wa:hover    { background:linear-gradient(135deg,#1a9e4a,#128c3e) !important; }
      `}</style>

      {/* ── Chat window ── */}
      {open && (
        <div style={{
          width:340, maxWidth:'calc(100vw - 48px)',
          height:480, maxHeight:'calc(100vh - 120px)',
          background:'#160b02',
          borderRadius:18,
          border:'1px solid #3a2008',
          boxShadow:'0 24px 60px rgba(0,0,0,0.6)',
          display:'flex', flexDirection:'column',
          overflow:'hidden',
          animation:'wcSlide 0.22s ease',
        }}>

          {/* Header */}
          <div style={{ background:'linear-gradient(135deg,#8B4513,#c2410c)', padding:'13px 15px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <div style={{ fontSize:'1.3rem' }}>🛕</div>
            <div style={{ flex:1 }}>
              <div style={{ color:'#fff', fontWeight:800, fontSize:'0.9rem' }}>Temple Assistant</div>
              <div style={{ color:'rgba(255,255,255,0.72)', fontSize:'0.65rem', marginTop:1 }}>
                Powered by AI · {events.filter(e=>e.type!=="panchang").length} events loaded
              </div>
            </div>
            {/* WhatsApp icon in header */}
            <button onClick={openWA} className="wc-wa" title="Open WhatsApp"
              style={{ background:'#25d366', border:'none', borderRadius:8, padding:'5px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:4, color:'#fff', fontSize:'0.68rem', fontWeight:700, fontFamily:'Georgia,serif', transition:'all 0.15s' }}>
              💬 WA
            </button>
            <button onClick={() => setOpen(false)}
              style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:'1rem', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>×</button>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px 12px 6px', display:'flex', flexDirection:'column', scrollbarWidth:'thin', scrollbarColor:'#3a2008 transparent' }}>
            {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
            {loading && (
              <div style={{ display:'flex', alignItems:'flex-start', marginBottom:10 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#8B4513,#c2410c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, marginRight:7, marginTop:2 }}>🛕</div>
                <div style={{ background:'#1e1208', border:'1px solid #3a2008', borderRadius:'16px 16px 16px 4px', padding:'9px 13px' }}>
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick suggestions */}
          {showSuggestions && !loading && (
            <div style={{ padding:'6px 10px 4px', display:'flex', flexWrap:'wrap', gap:5, borderTop:'1px solid #2a1208', flexShrink:0 }}>
              {SUGGESTED_QUESTIONS.map((q,i) => (
                <button key={i} onClick={() => sendMessage(q)} className="wc-pill"
                  style={{ padding:'4px 10px', borderRadius:18, border:'1px solid #3a2008', background:'#1e1208', color:'#c9943a', fontSize:'0.68rem', cursor:'pointer', fontWeight:600, fontFamily:'Georgia,serif', transition:'all 0.12s' }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{ display:'flex', gap:7, padding:'9px 10px', borderTop:'1px solid #2a1208', background:'#1e1208', flexShrink:0 }}>
            <input
              ref={inputRef}
              className="wc-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask about events, poojas, timings..."
              disabled={loading}
              maxLength={300}
              style={{ flex:1, padding:'8px 11px', borderRadius:20, border:'1px solid #3a2008', background:'#160b02', color:'#f0e0b8', fontSize:'0.8rem', fontFamily:'Georgia,serif', transition:'border-color 0.15s' }}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim()||loading} className="wc-send"
              style={{ width:36, height:36, borderRadius:'50%', border:'none', background: (!input.trim()||loading) ? '#2a1208' : 'linear-gradient(135deg,#c2410c,#8B4513)', color: (!input.trim()||loading) ? '#5a3a20' : '#fff', cursor: (!input.trim()||loading) ? 'not-allowed' : 'pointer', fontSize:'0.9rem', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
              🙏
            </button>
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <button onClick={() => setOpen(v => !v)}
        style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#8B4513,#c2410c)', border:'3px solid #fff', boxShadow:'0 4px 20px rgba(139,69,19,0.45)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', transition:'transform 0.2s', position:'relative' }}
        onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
        title="Chat with Temple Assistant">
        {open ? '×' : '🛕'}
        {!open && unread > 0 && (
          <div style={{ position:'absolute', top:-4, right:-4, background:'#ef4444', color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:'0.6rem', fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #fff' }}>
            {unread}
          </div>
        )}
      </button>
    </div>
  );
}
