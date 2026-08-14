import React, { useState } from 'react';

const inp = {
  width: '100%', padding: '10px 12px', background: '#111827',
  border: '1.5px solid #374151', color: 'white', borderRadius: 8,
  fontSize: '0.88rem', boxSizing: 'border-box', outline: 'none',
  fontFamily: 'Georgia,serif', marginBottom: 14,
};

export default function SponsorshipModal({ value, onClose, onApply }) {
  const [amount, setAmount] = useState(value || '');
  const [name,   setName]   = useState('');

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1f2937', borderRadius: 16, padding: 28, width: 420,
          border: '1px solid #374151', boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ color: 'white', fontWeight: '800', fontSize: '1.1rem', marginBottom: 4, fontFamily: 'Georgia,serif' }}>
          🙏 Add Sponsorship
        </div>
        <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: 20 }}>
          Sponsorship text will appear on the flyer
        </div>

        <label style={{ display: 'block', color: '#d1d5db', fontSize: '0.8rem', marginBottom: 6, fontWeight: '600' }}>
          Sponsor Name (optional)
        </label>
        <input
          placeholder="e.g. Sharma Family, Anonymous Devotee"
          value={name} onChange={e => setName(e.target.value)}
          style={inp}
        />

        <label style={{ display: 'block', color: '#d1d5db', fontSize: '0.8rem', marginBottom: 6, fontWeight: '600' }}>
          Sponsorship Amount *
        </label>
        <input
          placeholder="e.g. $51, $108, $116, $251"
          value={amount} onChange={e => setAmount(e.target.value)}
          style={inp}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', background: 'transparent',
            border: '1.5px solid #374151', color: '#9ca3af',
            borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem',
          }}>Cancel</button>
          <button
            onClick={() => { onApply(amount, name); onClose(); }}
            disabled={!amount}
            style={{
              flex: 2, padding: '10px',
              background: amount ? 'linear-gradient(135deg,#c2410c,#7c2d12)' : '#374151',
              border: 'none', color: 'white', borderRadius: 8,
              cursor: amount ? 'pointer' : 'not-allowed',
              fontWeight: '700', fontSize: '0.88rem',
            }}
          >
            ✓ Add to Flyer
          </button>
        </div>
      </div>
    </div>
  );
}
