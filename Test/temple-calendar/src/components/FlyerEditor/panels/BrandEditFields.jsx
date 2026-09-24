import React, { useState } from 'react';
import { STYLES, COLORS } from '../constants';

const { input: inp, sectionLabel: sL } = STYLES;

// ─── Premium "glossy" upload card shell ────────────────────────────────────
// Shared visual treatment for every image-upload field (Logo, Deity/Event
// Photo, Background Template) — a soft diagonal sheen, a raised circular
// icon badge, and a lift-on-hover shadow, instead of the old flat dashed
// rectangle. `accent` picks a warmer, richer tint for the field meant to
// stand out (Background Template); everything else gets a quieter ivory
// version of the same treatment so the whole set still reads as one family.
// Exported so MediaPanel.jsx's photo/background uploaders share this exact
// look instead of drifting apart from Logo here.
function glossyCardStyle(accent, hover) {
  return {
    position: 'relative', width: '100%', borderRadius: 14, overflow: 'hidden',
    background: accent
      ? 'linear-gradient(155deg, #fff9f5 0%, #ffe9db 55%, #ffdcc4 100%)'
      : 'linear-gradient(155deg, #ffffff 0%, #fbfaf8 55%, #f3f0ec 100%)',
    border: `1.5px solid ${accent ? '#f3c8a8' : COLORS.border}`,
    boxShadow: hover
      ? `0 1px 0 rgba(255,255,255,0.9) inset, 0 10px 22px -10px ${accent ? 'rgba(194,65,12,0.38)' : 'rgba(17,24,39,0.16)'}`
      : `0 1px 0 rgba(255,255,255,0.8) inset, 0 4px 12px -8px ${accent ? 'rgba(194,65,12,0.28)' : 'rgba(17,24,39,0.10)'}`,
    transform: hover ? 'translateY(-1px)' : 'none',
    transition: 'box-shadow 0.18s, transform 0.18s, border-color 0.18s',
  };
}

function GlossyIconBadge({ icon, accent }) {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
      background: accent ? 'linear-gradient(135deg, #f0956a, #c2410c)' : 'linear-gradient(135deg, #fff7f0, #f3ece3)',
      color: accent ? '#ffffff' : COLORS.accent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.05rem', boxShadow: '0 2px 6px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.6) inset',
    }}>
      {icon}
    </div>
  );
}

export function GlossyUploadCard({ icon, label, sub, accent, onChange }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...glossyCardStyle(accent, hover), padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
    >
      <GlossyIconBadge icon={icon} accent={accent} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: COLORS.text, fontSize: '0.83rem', fontWeight: '700' }}>{label}</div>
        {sub && <div style={{ color: COLORS.textFaint, fontSize: '0.68rem', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{
        fontSize: '0.66rem', fontWeight: '700', color: accent ? COLORS.accent : COLORS.textMuted,
        border: `1px solid ${accent ? '#f3c8a8' : COLORS.border}`, borderRadius: 20, padding: '4px 10px',
        flexShrink: 0, background: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap',
      }}>
        Upload
      </div>
      <input type="file" accept="image/*" onChange={onChange}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
    </div>
  );
}

// ─── Background Templates ───────────────────────────────────────────────
// "need templates like these" — a screenshot of a Canva-style background
// picker (wood/marble/paper textures, sky, city, fabric, solid colors,
// photography). Built from the app's existing Pixabay stock-search plumbing
// (same /api/pixabay-search route the Photo → Stock tab already uses) so no
// new server work was needed — just a curated set of texture/background
// queries instead of the temple/festival-photo categories, plus a small
// solid-color row generated on the fly (a filled <canvas> exported to a PNG
// data URL) for the plain color swatches in the reference grid. Shared by
// BrandEditPanel (AI mode) and MediaPanel (DIY mode) so both stay in sync.
const BG_TEMPLATE_CATEGORIES = [
  { label: '🪵 Wood',     q: 'wood plank texture background' },
  { label: '🤍 Marble',   q: 'white marble texture background' },
  { label: '📄 Paper',    q: 'crumpled paper texture background' },
  { label: '🧱 Brick',    q: 'grey brick wall texture' },
  { label: '☁️ Sky',      q: 'blue sky clouds background' },
  { label: '🌆 City',     q: 'city skyline sunset background' },
  { label: '🧵 Fabric',   q: 'linen fabric texture background' },
  { label: '🌅 Sunset',   q: 'sunset gradient sky background' },
  { label: '🎈 Balloons', q: 'colorful balloons background' },
  { label: '🤝 Unity',    q: 'joined hands together circle' },
  { label: '📷 B&W',      q: 'black and white street photography' },
  { label: '🎨 Solid',    color: true },
];

const SOLID_SWATCHES = ['#d6336c', '#b3283f', '#f6cfd9', '#111111', '#f4efe4', '#0f172a', '#2563eb', '#166534'];

function solidColorDataUrl(hex) {
  try {
    const c = document.createElement('canvas');
    c.width = 100; c.height = 100;
    const ctx = c.getContext('2d');
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, 100, 100);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function BackgroundTemplatesSection({
  bgTemplateResults, bgTemplateLoading, bgTemplateError, bgTemplateQuery,
  onSearchBgTemplate, onApplyTemplate,
}) {
  const [showColors, setShowColors] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: COLORS.text, fontSize: '0.75rem', fontWeight: '600', marginBottom: 6 }}>🖼 Background Templates</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {BG_TEMPLATE_CATEGORIES.map(cat => {
          const active = cat.color ? showColors : (!showColors && bgTemplateQuery === cat.q);
          return (
            <button key={cat.label}
              onClick={() => { if (cat.color) { setShowColors(true); } else { setShowColors(false); onSearchBgTemplate?.(cat.q); } }}
              style={{
                padding: '4px 9px', borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
                background: active ? COLORS.accent : '#fff',
                color: active ? '#fff' : COLORS.text,
                fontSize: '0.7rem', fontWeight: '500',
              }}>{cat.label}</button>
          );
        })}
      </div>

      {showColors ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {SOLID_SWATCHES.map(hex => (
            <div key={hex}
              onClick={() => { const url = solidColorDataUrl(hex); if (url) onApplyTemplate?.(url); }}
              title={hex}
              style={{ aspectRatio: '1', borderRadius: 8, cursor: 'pointer', background: hex, border: `2px solid ${COLORS.border}` }}
            />
          ))}
        </div>
      ) : (
        <>
          {bgTemplateLoading && <div style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '0.78rem', padding: '14px 0' }}>Loading…</div>}
          {bgTemplateError && <div style={{ color: '#b91c1c', fontSize: '0.72rem', background: '#fef2f2', padding: '8px', borderRadius: 6, marginBottom: 6, lineHeight: 1.6 }}>⚠ {bgTemplateError}</div>}
          {!bgTemplateLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
              {(bgTemplateResults || []).map((img, i) => (
                <div key={i}
                  onClick={() => onApplyTemplate?.(img.largeImageURL || img.webformatURL)}
                  title={img.tags}
                  style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: `2px solid ${COLORS.border}`, aspectRatio: '1', background: '#f3f4f6', transition: 'border-color 0.15s, transform 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = 'scale(1.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <img src={img.previewURL} alt={img.tags} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                </div>
              ))}
            </div>
          )}
          {!bgTemplateLoading && bgTemplateResults?.length > 0 && (
            <div style={{ marginTop: 6, fontSize: '0.68rem', color: COLORS.textFaint, textAlign: 'center' }}>Free images from Pixabay · click to apply</div>
          )}
        </>
      )}
    </div>
  );
}

const CROP_PRESETS = [
  { label: '1:1',  val: '1:1'  },
  { label: '4:3',  val: '4:3'  },
  { label: '3:4',  val: '3:4'  },
  { label: '16:9', val: '16:9' },
  { label: 'Free', val: null   },
];

// Shared building blocks for Logo and Edit Image — used by both MediaPanel
// (DIY, where they sit alongside the photo library) and BrandEditPanel (AI,
// a slim tab with just these two, since AI Visual already covers getting a
// photo in). Kept in one place so the two tabs never drift out of sync.

export function LogoSection({ onUploadLogo, logoPreviewUrl, onRemoveLogo, logoLibrary, onSelectLibraryLogo, onRemoveLibraryLogo }) {
  const [hover, setHover] = useState(false);
  return (
    <>
      <span style={sL}>Logo</span>
      <div style={{ color: COLORS.textFaint, fontSize: '0.7rem', marginBottom: 6 }}>Placed in the header corners of your flyer</div>

      {logoPreviewUrl ? (
        <div
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{ ...glossyCardStyle(false, hover), marginBottom: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <img src={logoPreviewUrl} alt="Uploaded logo" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }} />
          <div style={{ flex: 1, fontSize: '0.76rem', color: COLORS.text, fontWeight: '600' }}>Logo uploaded</div>
          <label style={{ fontSize: '0.7rem', color: COLORS.accent, cursor: 'pointer', fontWeight: '700' }}>
            Replace
            <input type="file" accept="image/*" onChange={e => onUploadLogo?.(e)} style={{ display: 'none' }} />
          </label>
          <button onClick={() => onRemoveLogo?.()} style={{ background: 'none', border: 'none', color: COLORS.danger, fontSize: '0.7rem', cursor: 'pointer', padding: 0, fontWeight: '600' }}>
            ✕ Remove
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <GlossyUploadCard icon="📤" label="Upload logo" sub="PNG with transparent background works best" onChange={e => onUploadLogo?.(e)} />
        </div>
      )}

      {/* Saved logo library — named logos saved from the "Save & Restart"
          dialog. Shared across AI and DIY mode on purpose (unlike the
          current live logo above, which is separate per mode) so a logo
          you've already named once can be reused in either without
          re-uploading the file from disk. */}
      {logoLibrary && logoLibrary.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: COLORS.textFaint, fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            📁 Saved logos
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {logoLibrary.map(l => (
              <div key={l.id} title={l.name} onClick={() => onSelectLibraryLogo?.(l.dataUrl)} style={{
                position: 'relative', width: 52, cursor: 'pointer', textAlign: 'center',
              }}>
                <img src={l.dataUrl} alt={l.name} style={{
                  width: 44, height: 44, objectFit: 'contain', borderRadius: 8, background: '#fff',
                  border: `1.5px solid ${logoPreviewUrl === l.dataUrl ? COLORS.accent : COLORS.border}`, padding: 3,
                }} />
                <div style={{ fontSize: '0.6rem', color: COLORS.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {l.name}
                </div>
                <button onClick={e => { e.stopPropagation(); onRemoveLibraryLogo?.(l.id); }} title="Remove from library" style={{
                  position: 'absolute', top: -5, right: 2, width: 15, height: 15, borderRadius: '50%',
                  background: '#fff', border: `1px solid ${COLORS.border}`, color: COLORS.danger,
                  fontSize: '0.55rem', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function EditImageSection({
  selectedObject, applyFilter, applyBlur, handleCrop, handleRemoveBgApi, removingBg,
  posterTitleText, posterMessageText, onPosterOverlayChange, fabricRef,
}) {
  // These tools now target a sensible photo automatically (see
  // getEditableImageObject in index.jsx) — the current canvas selection if
  // it's an image, otherwise the most recently placed one — so the panel no
  // longer needs to hide everything behind a "click a photo first"
  // placeholder. It only falls back to a real empty state when there is
  // genuinely no photo anywhere on the canvas yet. Read directly off the
  // canvas rather than tracked in React state — every place a photo gets
  // added or removed already selects/deselects it, which re-renders this
  // panel via the selectedObject prop, so this stays in sync in practice.
  const canvas = fabricRef?.current;
  const hasAnyPhoto = !!canvas?.getObjects().some(o => o.type === 'image' && o.selectable);
  const isFullFrameImageSelected = selectedObject?.name === 'full_frame_img';

  return (
    <>
      <span style={sL}>🎚 Edit Image</span>

      {!hasAnyPhoto && (
        <div style={{
          color: COLORS.textFaint, fontSize: '0.78rem', fontStyle: 'italic',
          padding: '20px 12px', textAlign: 'center', border: `1.5px dashed ${COLORS.border}`, borderRadius: 10,
        }}>
          🖼 No photo on the canvas yet — add one from Media, then crop, remove its background, or adjust it here.
        </div>
      )}

      {hasAnyPhoto && (
        <>
          {isFullFrameImageSelected ? (
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: COLORS.text, fontSize: '0.75rem', fontWeight: '600', marginBottom: 6 }}>📝 Title &amp; Message</div>
              <input value={posterTitleText || ''} onChange={e => onPosterOverlayChange({ title: e.target.value })}
                placeholder="Title text over the photo" style={{ ...inp, marginBottom: 6, fontSize: '0.78rem' }} />
              <textarea value={posterMessageText || ''} onChange={e => onPosterOverlayChange({ message: e.target.value })}
                placeholder="Message text over the photo" rows={3}
                style={{ ...inp, resize: 'vertical', fontSize: '0.75rem', marginBottom: 0 }} />
              <div style={{ color: COLORS.textFaint, fontSize: '0.68rem', marginTop: 4, lineHeight: 1.5 }}>
                Adds movable, editable text on top of the photo. Leave blank to remove.
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: COLORS.text, fontSize: '0.75rem', fontWeight: '600', marginBottom: 6 }}>✂ Crop</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {CROP_PRESETS.map(({ label, val }) => (
                  <button key={label}
                    onClick={() => handleCrop(val)}
                    title={val ? `Crop to ${val}` : 'Reset to the original, uncropped photo'}
                    style={{
                      padding: '5px 11px', border: `1px solid ${COLORS.border}`,
                      background: '#f9fafb', color: COLORS.text,
                      borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem',
                    }}>{label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Remove Background removed per direct request — it needed a
              REMOVE_BG_API_KEY the server .env doesn't have, so the button
              only ever surfaced a "not configured" error. handleRemoveBgApi/
              removingBg are still accepted as props (harmless if unused) so
              callers don't need to change their call sites. */}

          <div style={{ color: COLORS.text, fontSize: '0.75rem', fontWeight: '600', marginBottom: 4 }}>💧 Blur</div>
          <input type="range" min="0" max="100" defaultValue="0"
            style={{ width: '100%', accentColor: COLORS.accent, marginBottom: 14 }}
            onChange={e => applyBlur(+e.target.value)} />

          {['Brightness', 'Contrast'].map(type => (
            <label key={type} style={{ display: 'block', color: COLORS.textMuted, marginBottom: 12 }}>
              <div style={{ fontSize: '0.75rem', marginBottom: 4 }}>{type === 'Brightness' ? '☀' : '◑'} {type}</div>
              <input type="range" min="-100" max="100" defaultValue="0"
                style={{ width: '100%', accentColor: COLORS.accent }}
                onChange={e => applyFilter(type, +e.target.value)} />
            </label>
          ))}
        </>
      )}
    </>
  );
}
