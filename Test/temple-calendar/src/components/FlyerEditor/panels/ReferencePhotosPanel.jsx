import React from 'react';
import { STYLES, COLORS } from '../constants';

const { sectionHeader: sH } = STYLES;

// Reference Library — ground AI generation in your org's own photos. Now
// rendered directly below the Guided Conversation wizard in AI Visual's
// left rail (see AIVisualPanel.jsx) instead of a separate right-side
// column, per a direct request — "multiple pics" still gets a real 3-wide
// grid, just inline with the rest of the flow instead of off to the side.
// "Or Upload Your Own" (a direct background upload, skipping generation)
// used to live here, grouped with the reference photo grid — moved out to
// the Finishing Touches tab instead (BrandEditPanel.jsx), a separate
// direct request, since it's a different kind of action (replace the
// whole background outright) than picking reference photos to ground a
// generation.
export default function ReferencePhotosPanel({
  referencePhotos, selectedReferencePhotoKeys, setSelectedReferencePhotoKeys, maxReferenceImages,
  onUploadReferencePhoto, onDeleteReferencePhoto, loadingReferencePhotos, referencePhotosNeedsLogin,
  onDescribeReferencePhoto, describingReference,
  // When true, skips this panel's own sectionCard chrome (padding/background/
  // border) — used by AIVisualPanel.jsx, which now wraps this in its own
  // frosted-glass Champagne Glass card and would otherwise double-box it.
  bare,
  // 'select' (the default) preserves the original AI-mode behavior
  // byte-for-byte: clicking a thumbnail toggles it into
  // selectedReferencePhotoKeys, used to ground an AI generation. 'place' is
  // for DIY mode's template artwork picker (see FlyerTemplatesPanel.jsx) —
  // clicking a thumbnail calls onPlace(url, photo) to drop it straight onto
  // the canvas instead, and the selection UI (checkmark, cap, describe
  // button, "N selected" copy) is skipped since there's no selection here.
  mode = 'select',
  onPlace,
}) {
  if (!referencePhotos) return null;
  const isPlace = mode === 'place';

  return (
    <div style={bare ? { padding: 0 } : { ...STYLES.sectionCard, marginBottom: 0 }}>
      <div style={sH}>📷 Reference Photos</div>
      <div style={{ color: COLORS.text, fontSize: '0.7rem', marginBottom: 10, lineHeight: 1.6 }}>
        {isPlace
          ? 'Click a photo to place it into this template\'s artwork slot.'
          : `Upload photos of your temple/venue, deities, or decor — pick up to ${maxReferenceImages} below so generated images are grounded in what your organization actually looks like.`}
      </div>

      {referencePhotosNeedsLogin && (
        <div style={{ padding: '8px 10px', marginBottom: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, fontSize: '0.7rem', color: '#b91c1c', lineHeight: 1.5 }}>
          ⚠ You need to be logged in to your CalendarFly account to save reference photos — please log in and reopen Flyer Studio.
        </div>
      )}

      {onUploadReferencePhoto && (
        <div style={{ position: 'relative', width: '100%', marginBottom: 12 }}>
          <button disabled={loadingReferencePhotos} style={{
            width: '100%', padding: '11px', border: `2px dashed ${COLORS.border}`,
            background: '#fff', color: COLORS.textMuted, borderRadius: 9,
            cursor: loadingReferencePhotos ? 'default' : 'pointer', fontSize: '0.78rem', pointerEvents: 'none',
          }}>
            {loadingReferencePhotos ? '⏳ Working…' : '📤 Upload reference photo(s)'}
          </button>
          <input type="file" accept="image/*" multiple disabled={loadingReferencePhotos} onChange={e => onUploadReferencePhoto?.(e)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: loadingReferencePhotos ? 'default' : 'pointer' }} />
        </div>
      )}

      {referencePhotos.length === 0 ? (
        <div style={{ color: COLORS.textFaint, fontSize: '0.74rem', lineHeight: 1.6, textAlign: 'center', padding: '18px 8px', border: `1.5px dashed ${COLORS.border}`, borderRadius: 10 }}>
          No reference photos yet — upload one or more above to get started. You can select as many as you like at once.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            {referencePhotos.map(p => {
              const selected = !isPlace && selectedReferencePhotoKeys.includes(p.key);
              const atCap = !isPlace && !selected && selectedReferencePhotoKeys.length >= maxReferenceImages;
              return (
                <div key={p.key} style={{ position: 'relative', width: '100%', aspectRatio: '1' }}>
                  <button disabled={atCap} onClick={() => {
                      if (isPlace) { onPlace?.(p.url, p); return; }
                      setSelectedReferencePhotoKeys(prev => selected ? prev.filter(k => k !== p.key) : [...prev, p.key]);
                    }}
                    title={isPlace ? (p.label || 'Place on canvas') : (atCap ? `Up to ${maxReferenceImages} at a time` : (p.label || 'Reference photo'))} style={{
                      width: '100%', height: '100%', padding: 0, borderRadius: 9, cursor: atCap ? 'not-allowed' : 'pointer', overflow: 'hidden',
                      border: `2.5px solid ${selected ? COLORS.accent : COLORS.border}`,
                      backgroundImage: `url(${p.url})`, backgroundSize: 'cover', backgroundPosition: 'center',
                      opacity: atCap ? 0.45 : 1,
                    }}>
                    {selected && <span style={{ position: 'absolute', top: 3, right: 3, background: COLORS.accent, color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>}
                  </button>
                  {onDeleteReferencePhoto && (
                    <button onClick={() => onDeleteReferencePhoto(p.key)} title="Remove" style={{
                      position: 'absolute', top: -6, left: -6, width: 18, height: 18, borderRadius: '50%',
                      background: COLORS.danger, color: '#fff', border: '2px solid #fff', cursor: 'pointer',
                      fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}>✕</button>
                  )}
                </div>
              );
            })}
          </div>
          {!isPlace && (
            <div style={{ color: COLORS.textFaint, fontSize: '0.7rem', lineHeight: 1.6, marginBottom: selectedReferencePhotoKeys.length > 0 && onDescribeReferencePhoto ? 8 : 0 }}>
              {selectedReferencePhotoKeys.length > 0
                ? `${selectedReferencePhotoKeys.length}/${maxReferenceImages} selected — generation will be visually grounded in these (higher fidelity, slightly slower).`
                : `Pick up to ${maxReferenceImages} as a visual reference, or leave unselected to generate freely.`}
            </div>
          )}
          {!isPlace && selectedReferencePhotoKeys.length > 0 && onDescribeReferencePhoto && (
            <button onClick={onDescribeReferencePhoto} disabled={describingReference} style={{
              width: '100%', padding: '10px',
              background: describingReference ? '#f3f4f6' : '#fff',
              color: describingReference ? COLORS.textMuted : COLORS.accent,
              border: `1.5px solid ${describingReference ? COLORS.border : COLORS.accent}`,
              borderRadius: 8, cursor: describingReference ? 'not-allowed' : 'pointer',
              fontWeight: '700', fontSize: '0.78rem',
            }}>
              {describingReference ? '⏳ Writing prompt…' : '🪄 Write prompt from this photo'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
