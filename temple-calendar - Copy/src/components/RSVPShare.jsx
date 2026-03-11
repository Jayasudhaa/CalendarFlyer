/**
 * src/components/RSVPShare.jsx
 * Drop-in share panel for the Flyer Editor or event detail view.
 * Shows: copy link, QR code, WhatsApp share, admin link.
 *
 * Usage:
 *   import RSVPShare from './RSVPShare';
 *   <RSVPShare event={event} />
 */
import React, { useState } from 'react';
import { getRsvpUrl, getAdminUrl, getQrUrl } from '../utils/rsvpUrl';

export default function RSVPShare({ event, compact = false }) {
  const [copied,       setCopied]       = useState(false);
  const [copiedAdmin,  setCopiedAdmin]  = useState(false);
  const [showQr,       setShowQr]       = useState(false);
  const [showAdmin,    setShowAdmin]    = useState(false);

  if (!event) return null;

  const rsvpUrl  = getRsvpUrl(event);
  const adminUrl = getAdminUrl(event);
  const qrUrl    = getQrUrl(event, 200);

  const copy = async (text, setter) => {
    try { await navigator.clipboard.writeText(text); }
    catch { /* fallback */
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el);
      el.select(); document.execCommand('copy');
      document.body.removeChild(el);
    }
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const whatsappShare = () => {
    const msg = `You're invited to *${event.title}*!\n\n📅 ${event.date || ''} ${event.time || ''}\n\nPlease RSVP here:\n${rsvpUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div style={{
      background: '#111827', border: '1px solid #1f2937', borderRadius: 10,
      padding: compact ? '12px' : '16px', fontFamily: 'system-ui, Georgia, serif',
    }}>
      <div style={{ color: '#9ca3af', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        📎 RSVP Link
      </div>

      {/* URL display */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <div style={{ flex: 1, background: '#0d1117', border: '1px solid #374151', borderRadius: 6,
          padding: '7px 10px', fontSize: '0.7rem', color: '#6b7280',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rsvpUrl}
        </div>
        <button onClick={() => copy(rsvpUrl, setCopied)}
          style={{ padding: '7px 12px', background: copied ? '#16a34a' : '#1f2937',
            border: '1px solid #374151', color: 'white', borderRadius: 6, cursor: 'pointer',
            fontSize: '0.72rem', fontWeight: '600', whiteSpace: 'nowrap', transition: 'background 0.2s' }}>
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={whatsappShare}
          style={{ flex: 1, padding: '8px', background: '#166534', border: 'none',
            color: 'white', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
          💬 WhatsApp
        </button>
        <button onClick={() => setShowQr(q => !q)}
          style={{ flex: 1, padding: '8px', background: showQr ? '#1d4ed8' : '#1f2937',
            border: '1px solid #374151', color: 'white', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem' }}>
          {showQr ? '✕ Hide QR' : '⬛ QR Code'}
        </button>
        <button onClick={() => window.open(rsvpUrl, '_blank')}
          style={{ flex: 1, padding: '8px', background: '#1f2937', border: '1px solid #374151',
            color: '#9ca3af', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem' }}>
          🔗 Preview
        </button>
      </div>

      {/* QR code */}
      {showQr && (
        <div style={{ textAlign: 'center', padding: '12px 0', marginBottom: 10,
          background: '#0d1117', borderRadius: 8, border: '1px solid #1f2937' }}>
          <img src={qrUrl} alt="RSVP QR Code" width={160} height={160}
            style={{ borderRadius: 8, display: 'block', margin: '0 auto 8px' }} />
          <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>Scan to RSVP</div>
          <a href={qrUrl} download={`rsvp_qr_${event.title?.replace(/\s+/g,'_')}.png`}
            style={{ fontSize: '0.68rem', color: '#3b82f6', textDecoration: 'none', display: 'block', marginTop: 4 }}>
            ⬇ Download QR
          </a>
        </div>
      )}

      {/* Admin link */}
      <div style={{ borderTop: '1px solid #1f2937', paddingTop: 10 }}>
        <button onClick={() => setShowAdmin(a => !a)}
          style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer',
            fontSize: '0.68rem', padding: 0, textDecoration: 'underline' }}>
          {showAdmin ? 'Hide' : '🔑 Admin Dashboard Link'}
        </button>
        {showAdmin && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, background: '#0d1117', border: '1px solid #374151', borderRadius: 6,
                padding: '7px 10px', fontSize: '0.65rem', color: '#6b7280',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {adminUrl}
              </div>
              <button onClick={() => copy(adminUrl, setCopiedAdmin)}
                style={{ padding: '7px 10px', background: copiedAdmin ? '#16a34a' : '#1f2937',
                  border: '1px solid #374151', color: 'white', borderRadius: 6, cursor: 'pointer',
                  fontSize: '0.7rem', transition: 'background 0.2s' }}>
                {copiedAdmin ? '✓' : '📋'}
              </button>
              <button onClick={() => window.open(adminUrl, '_blank')}
                style={{ padding: '7px 10px', background: '#1f2937', border: '1px solid #374151',
                  color: '#9ca3af', borderRadius: 6, cursor: 'pointer', fontSize: '0.7rem' }}>
                Open
              </button>
            </div>
            <div style={{ color: '#4b5563', fontSize: '0.62rem', marginTop: 4 }}>
              ⚠ Keep this link private — it shows all RSVP data
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
