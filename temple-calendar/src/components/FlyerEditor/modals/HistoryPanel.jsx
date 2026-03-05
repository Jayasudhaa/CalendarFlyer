import React, { useState } from 'react';

const loadDrafts = () => {
  try { return JSON.parse(localStorage.getItem('temple_flyer_drafts') || '[]'); } catch { return []; }
};
const deleteDraft = (id) => {
  const all = loadDrafts().filter(d => d.id !== id);
  localStorage.setItem('temple_flyer_drafts', JSON.stringify(all));
};

export default function HistoryPanel({ onLoad, onClose }) {
  const [drafts, setDrafts] = useState(loadDrafts());

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#111827', borderRadius: 16, width: '100%', maxWidth: 840,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        border: '1px solid #374151', boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #374151',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(135deg,#7c2d12,#c2410c)',
          borderRadius: '16px 16px 0 0',
        }}>
          <div>
            <div style={{ color: 'white', fontWeight: '800', fontSize: '1.2rem', fontFamily: 'Georgia,serif' }}>
              📚 Flyer History
            </div>
            <div style={{ color: '#fcd9b0', fontSize: '0.75rem', marginTop: 2 }}>
              {drafts.length} saved flyer{drafts.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
            borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem',
          }}>
            ✕ Close
          </button>
        </div>

        {/* Drafts grid */}
        <div style={{ overflowY: 'auto', padding: 20, flex: 1 }}>
          {drafts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#4b5563' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎨</div>
              <div style={{ color: '#6b7280' }}>No saved flyers yet. Save a draft to see it here.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
              {drafts.map(draft => (
                <div key={draft.id} style={{
                  background: '#1f2937', borderRadius: 12,
                  overflow: 'hidden', border: '1px solid #374151',
                }}>
                  {/* Thumbnail */}
                  <div style={{ height: 140, background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {draft.thumbnail
                      ? <img src={draft.thumbnail} alt={draft.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ fontSize: '2.5rem' }}>🪔</div>}
                  </div>
                  {/* Info */}
                  <div style={{ padding: '12px 14px' }}>
                    <div style={{ color: 'white', fontWeight: '700', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {draft.title}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '0.68rem', marginTop: 3 }}>
                      {new Date(draft.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {draft.s3Url && <div style={{ color: '#34d399', fontSize: '0.65rem', marginTop: 2 }}>☁ Saved to cloud</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button onClick={() => onLoad(draft)} style={{
                        flex: 1, padding: '7px',
                        background: 'linear-gradient(135deg,#c2410c,#7c2d12)',
                        border: 'none', color: 'white', borderRadius: 7,
                        cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700',
                      }}>▶ Resume</button>
                      <button onClick={() => { deleteDraft(draft.id); setDrafts(loadDrafts()); }} style={{
                        padding: '7px 10px', background: 'transparent',
                        border: '1px solid #4b5563', color: '#9ca3af',
                        borderRadius: 7, cursor: 'pointer', fontSize: '0.75rem',
                      }}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
