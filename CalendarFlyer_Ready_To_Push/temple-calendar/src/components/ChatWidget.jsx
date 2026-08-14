/**
 * ChatWidget.jsx
 * Floating chat bubble — opens WhatsApp directly with pre-filled message
 * Temple WhatsApp: +1 720 331 3601
 */

import React, { useState } from 'react';

const TEMPLE_WHATSAPP = '17203313601'; // E.164 format without +
const TEMPLE_NAME     = 'Sample Temple Name';
const SUGGESTED_QUESTIONS = [
  "What events are coming up this week?",
  "When is the next pooja?",
  "What are the temple timings?",
  "How do I RSVP for an event?",
  "Tell me about abhishekam",
  "What is the temple address?",
];


export default function ChatWidget() {
  const [open,     setOpen]     = useState(false);



  function openWhatsApp(question) {


    const msg = question || 'Namaste! I have a question about the temple.';
    const url = `https://wa.me/${TEMPLE_WHATSAPP}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };


  const S = {
    wrapper: {
      position:  'fixed',
      bottom:    24,
      right:     24,
      zIndex:    9000,
      display:   'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 12,
      fontFamily: "'Georgia', 'Times New Roman', serif",
    },
    window: {
      width:         340,
      maxWidth:     'calc(100vw - 48px)',
      background:   '#fffdf7',
      borderRadius: 18,
      boxShadow:    '0 20px 60px rgba(139,69,19,0.2), 0 4px 16px rgba(0,0,0,0.12)',
      border:       '1.5px solid #e8d5a3',
      overflow:     'hidden',
      animation:     'slideUp 0.25s ease',
    },
    header: {
      background:    'linear-gradient(135deg, #8B4513, #c2410c)',
      padding:       '14px 16px',
      display:       'flex',
      alignItems:    'center',
      gap:           10,
    },
    closeBtn: {
      background: 'rgba(255,255,255,0.15)',
      border:     'none',
      color:      '#fff',
      width:      28,
      height:     28,
      borderRadius: '50%',
      cursor:     'pointer',
      fontSize:       '1.1rem',
      display:    'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      lineHeight:     1,
    },
    body: {
      padding: '16px',
    },
    greeting: {
      background:   '#fff8ee',
      border:       '1px solid #f0e0c0',
      borderRadius: '12px 12px 12px 4px',
      padding:      '12px 14px',
      color:        '#3d2008',
      fontSize:     '0.84rem',
      lineHeight:   1.6,
      marginBottom: 14,
    },
    sectionLabel: {
      color:         '#92400e',
      fontSize:      '0.68rem',
      fontWeight:    '700',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginBottom:  8,
    },
    pillGrid: {
      display:    'flex',
      flexWrap:   'wrap',
      gap:        6,
      marginBottom: 14,
    },
    pill: {
      padding:      '6px 12px',
      borderRadius: 20,
      border:       '1px solid #e8d5a3',
      background:   '#fffaf0',
      color:        '#8B4513',
      fontSize:     '0.74rem',
      cursor:       'pointer',
      fontWeight:   '600',
      transition:   'all 0.12s',
      fontFamily:   'inherit',
    },
    waBtn: {
      width:          '100%',
      padding:        '12px',
      background:     'linear-gradient(135deg, #25d366, #128c3e)',
      border:       'none',
      borderRadius:   11,
      color:          '#fff',
      fontWeight:     '800',
      fontSize:       '0.9rem',
      cursor:         'pointer',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'center',
      gap:            8,
      boxShadow:      '0 3px 12px rgba(37,211,102,0.35)',
      fontFamily:     'inherit',
      transition:   'all 0.15s',
    },
    note: {
      color:      '#b8966a',
      fontSize:   '0.68rem',
      textAlign:  'center',
      marginTop:  10,
      lineHeight: 1.4,
    },
    fab: {
      width:        56,
      height:       56,
      borderRadius: '50%',
      background:   'linear-gradient(135deg, #8B4513, #c2410c)',
      border:       '3px solid #fff',
      boxShadow:    '0 4px 20px rgba(139,69,19,0.4)',
      cursor:       'pointer',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'center',
      fontSize:     '1.5rem',
      transition:   'transform 0.2s',
    },
  };


  return (
    <div style={S.wrapper}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Chat window */}
      {open && (
        <div style={S.window}>

          {/* Header */}
          <div style={S.header}>
            <div style={{ fontSize: '1.4rem' }}>🛕</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: '800', fontSize: '0.95rem' }}>
                Temple Assistant
            </div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.7rem', marginTop: 1 }}>
                Replies via WhatsApp · +1 720 331 3601
          </div>

              </div>
            <button
              onClick={() => setOpen(false)}
              style={S.closeBtn}
            >×</button>
              </div>

          {/* Body */}
          <div style={S.body}>
            {/* Greeting bubble */}
            <div style={S.greeting}>
              🙏 <strong>Namaste!</strong> I'm the SV Temple assistant. Tap a question below or open WhatsApp to ask anything about our temple, events, and poojas!
          </div>

            {/* Quick questions */}
            <div style={S.sectionLabel}>Quick Questions</div>
            <div style={S.pillGrid}>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => openWhatsApp(q)}
                  style={S.pill}
                  onMouseEnter={e => {
                    e.target.style.background = '#fef3e2';
                    e.target.style.borderColor = '#c4a35a';
                    e.target.style.transform     = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = '#fffaf0';
                    e.target.style.borderColor = '#e8d5a3';
                    e.target.style.transform     = 'translateY(0)';
                  }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Main WhatsApp button */}
            <button
              onClick={() => openWhatsApp()}
              style={S.waBtn}
              onMouseEnter={e => {
                e.currentTarget.style.transform  = 'translateY(-2px)';
                e.currentTarget.style.boxShadow  = '0 6px 18px rgba(37,211,102,0.5)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform  = 'translateY(0)';
                e.currentTarget.style.boxShadow  = '0 3px 12px rgba(37,211,102,0.35)';
              }}
            >
              💬 Open WhatsApp Chat
            </button>
            <div style={S.note}>
              Opens WhatsApp with your question pre-filled.<br />
              Our bot replies instantly 24/7 🙏
          </div>

          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={S.fab}
        title="Chat with Temple Assistant"
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {open ? '×' : '🛕'}
      </button>
    </div>
  );
}
