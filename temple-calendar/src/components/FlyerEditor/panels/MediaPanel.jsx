import React from 'react';
import { STYLES, COLORS } from '../constants';
import { LogoSection, EditImageSection, GlossyUploadCard, BackgroundTemplatesSection } from './BrandEditFields';
import DesignPanel from './DesignPanel';
import FlyerTemplatesPanel from './FlyerTemplatesPanel';

const { input: inp, sectionLabel: sL } = STYLES;

// Merged "Media" panel — DIY-only (AI mode gets its own slim "Brand & Edit"
// tab instead, via BrandEditPanel.jsx, since AI Visual already covers
// getting a photo in and a full Media tab there felt redundant). Logo and
// Edit Image are shared building blocks imported from BrandEditFields.jsx
// so DIY and AI never drift apart on those two pieces. Library/Stock/
// Upload/Graphics covers getting a photo (or decorative sticker) onto the
// canvas.
const STOCK_CATEGORIES = [
  { label: '🌸 Garland',  q: 'flower garland temple indian' },
  { label: '🪔 Deepam',   q: 'oil lamp deepam diya temple' },
  { label: '🎨 Rangoli',  q: 'rangoli colorful indian festival' },
  { label: '🌺 Marigold', q: 'marigold flowers decoration indian' },
  { label: '🐘 Elephant', q: 'decorated elephant temple india' },
  { label: '🪷 Lotus',    q: 'lotus flower water pink' },
  { label: '🎊 Festival', q: 'indian festival celebration colorful' },
  { label: '🕌 Temple',   q: 'hindu temple gopuram india' },
  { label: '🌙 Diwali',   q: 'diwali lights candles festival' },
  { label: '🌾 Harvest',  q: 'pongal harvest festival india' },
  { label: '🎭 Navratri', q: 'navratri garba festival dance' },
  { label: '🌿 Thoran',   q: 'mango leaves torana temple decoration' },
];
// Must match the folder names server/routes/imageLibrary.js's CATEGORY_MAP
// actually returns ('Deities' | 'Festivals' | 'Flowers' | 'Rangoli' | 'General').
const LIBRARY_CATS = ['All', 'Deities', 'Festivals', 'Flowers', 'Rangoli', 'General'];

// Hand-authored decorative graphics — plain SVG markup, small and simple by
// design rather than sourced from stock photography. Each string doubles as
// the inline preview (dangerouslySetInnerHTML below) and the canvas object
// (passed straight to placeGraphic()/fabric.loadSVGFromString in
// canvasBuilder.js), so there's exactly one definition of each design.
const GRAPHICS = [
  {
    name: 'Border Frame',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect x="6" y="6" width="228" height="148" rx="14" fill="none" stroke="#c2410c" stroke-width="6"/><rect x="16" y="16" width="208" height="128" rx="8" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 5"/><circle cx="6" cy="6" r="7" fill="#c2410c"/><circle cx="234" cy="6" r="7" fill="#c2410c"/><circle cx="6" cy="154" r="7" fill="#c2410c"/><circle cx="234" cy="154" r="7" fill="#c2410c"/></svg>`,
  },
  {
    name: 'Flower',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="translate(50,50)"><g fill="#fb7185"><ellipse cx="0" cy="-24" rx="12" ry="22" transform="rotate(0)"/><ellipse cx="0" cy="-24" rx="12" ry="22" transform="rotate(60)"/><ellipse cx="0" cy="-24" rx="12" ry="22" transform="rotate(120)"/><ellipse cx="0" cy="-24" rx="12" ry="22" transform="rotate(180)"/><ellipse cx="0" cy="-24" rx="12" ry="22" transform="rotate(240)"/><ellipse cx="0" cy="-24" rx="12" ry="22" transform="rotate(300)"/></g><circle cx="0" cy="0" r="12" fill="#f59e0b"/></g></svg>`,
  },
  {
    name: 'Bunting Flags',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 90"><path d="M0,10 Q150,70 300,10" fill="none" stroke="#7c2d12" stroke-width="3"/><polygon points="20,14 40,14 30,50" fill="#c2410c"/><polygon points="68,26 88,26 78,62" fill="#f59e0b"/><polygon points="116,34 136,34 126,70" fill="#166534"/><polygon points="164,34 184,34 174,70" fill="#c2410c"/><polygon points="212,26 232,26 222,62" fill="#f59e0b"/><polygon points="260,14 280,14 270,50" fill="#166534"/></svg>`,
  },
  {
    name: 'Rangoli',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g transform="translate(100,100)"><g fill="#c2410c"><polygon points="0,-80 14,-40 0,-20 -14,-40" transform="rotate(0)"/><polygon points="0,-80 14,-40 0,-20 -14,-40" transform="rotate(45)"/><polygon points="0,-80 14,-40 0,-20 -14,-40" transform="rotate(90)"/><polygon points="0,-80 14,-40 0,-20 -14,-40" transform="rotate(135)"/><polygon points="0,-80 14,-40 0,-20 -14,-40" transform="rotate(180)"/><polygon points="0,-80 14,-40 0,-20 -14,-40" transform="rotate(225)"/><polygon points="0,-80 14,-40 0,-20 -14,-40" transform="rotate(270)"/><polygon points="0,-80 14,-40 0,-20 -14,-40" transform="rotate(315)"/></g><g fill="#f59e0b"><polygon points="0,-55 9,-28 0,-14 -9,-28" transform="rotate(22.5)"/><polygon points="0,-55 9,-28 0,-14 -9,-28" transform="rotate(67.5)"/><polygon points="0,-55 9,-28 0,-14 -9,-28" transform="rotate(112.5)"/><polygon points="0,-55 9,-28 0,-14 -9,-28" transform="rotate(157.5)"/><polygon points="0,-55 9,-28 0,-14 -9,-28" transform="rotate(202.5)"/><polygon points="0,-55 9,-28 0,-14 -9,-28" transform="rotate(247.5)"/><polygon points="0,-55 9,-28 0,-14 -9,-28" transform="rotate(292.5)"/><polygon points="0,-55 9,-28 0,-14 -9,-28" transform="rotate(337.5)"/></g><circle cx="0" cy="0" r="18" fill="#166534"/><circle cx="0" cy="0" r="8" fill="#fde68a"/></g></svg>`,
  },
];

const tileWrap = {
  cursor: 'grab', borderRadius: 8, overflow: 'hidden',
  border: `2px solid ${COLORS.border}`, aspectRatio: '1', background: '#f3f4f6',
  transition: 'border-color 0.15s, transform 0.1s',
};

// Thin wrapper around the shared GlossyUploadCard (BrandEditFields.jsx) so
// the Deity/Event Photo and Background Template uploaders below get the
// exact same premium glossy look as Logo, instead of the old flat dashed
// rectangle each panel used to draw separately.
function UploadButton({ label, sub, icon, onChange, accent }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <GlossyUploadCard icon={icon} label={label} sub={sub} accent={accent} onChange={onChange} />
    </div>
  );
}

export default function MediaPanel({
  layout, setLayout,
  imageTab, setImageTab,
  libraryLoading, libraryError, filteredLibrary, libraryCat, setLibraryCat,
  stockResults, stockLoading, stockError, stockQuery, stockSearchInput, setStockSearchInput, handleStockSearch,
  onPlaceImage, onDragStart, onDragEnd,
  onUpload, onSetBackground, hasBg, onRemoveBg,
  bgTemplateResults, bgTemplateLoading, bgTemplateError, bgTemplateQuery, handleBgTemplateSearch,
  onPlaceGraphic,
  // Brand (logo) — shared with BrandEditPanel (AI mode) via BrandEditFields
  onUploadLogo, logoPreviewUrl, onRemoveLogo,
  logoLibrary, onSelectLibraryLogo, onRemoveLibraryLogo,
  // Edit Image — shared with BrandEditPanel (AI mode) via BrandEditFields
  selectedObject, applyFilter, applyBlur, handleCrop, handleRemoveBgApi, removingBg,
  posterTitleText, posterMessageText, onPosterOverlayChange, fabricRef,
  // Themed flyer templates (flyerTemplates.js) + their artwork slot —
  // reference photos are the same org-scoped library AI mode uses (see
  // ReferencePhotosPanel.jsx), passed through so FlyerTemplatesPanel can
  // reuse that exact grid/upload/delete UI in mode="place".
  activeFlyerTemplateId, onApplyFlyerTemplate, onPlaceArtwork,
  referencePhotos, onUploadReferencePhoto, onDeleteReferencePhoto,
  loadingReferencePhotos, referencePhotosNeedsLogin,
}) {
  return (
    // Champagne Glass bleed — "keep all the panel glass champagne," a
    // direct request to carry the same frosted-gold rail look here too.
    <div style={{ margin: '-14px -16px', padding: '14px 16px', minHeight: 'calc(100% + 28px)', background: 'linear-gradient(155deg, #f1f0ee, #dcdad5)' }}>
      <div style={{ color: '#232220', fontWeight: '800', fontSize: '0.95rem', marginBottom: 10 }}>🖼 Media</div>

      <div style={{ marginBottom: 16 }}>
        <DesignPanel layout={layout} setLayout={setLayout} />
      </div>

      <FlyerTemplatesPanel
        activeFlyerTemplateId={activeFlyerTemplateId}
        onApplyTemplate={onApplyFlyerTemplate}
        onPlaceArtwork={onPlaceArtwork}
        referencePhotos={referencePhotos}
        onUploadReferencePhoto={onUploadReferencePhoto}
        onDeleteReferencePhoto={onDeleteReferencePhoto}
        loadingReferencePhotos={loadingReferencePhotos}
        referencePhotosNeedsLogin={referencePhotosNeedsLogin}
      />

      <LogoSection onUploadLogo={onUploadLogo} logoPreviewUrl={logoPreviewUrl} onRemoveLogo={onRemoveLogo}
        logoLibrary={logoLibrary} onSelectLibraryLogo={onSelectLibraryLogo} onRemoveLibraryLogo={onRemoveLibraryLogo} />

      {/* Background Template — pulled out of the "Upload" sub-tab below and
          made always-visible here instead, right next to Logo. It used to
          only exist three clicks deep (Media → Upload tab → scroll past
          Deity/Event Photo), which read as "background upload doesn't
          work" when it was really "can't find it." Mirrors the AI mode
          equivalent ("Or Upload Your Own" in BrandEditPanel.jsx). */}
      <span style={sL}>Background</span>
      <div style={{ color: COLORS.textFaint, fontSize: '0.7rem', marginBottom: 6 }}>Fills the entire canvas behind everything else</div>

      {!hasBg && (
        <BackgroundTemplatesSection
          bgTemplateResults={bgTemplateResults} bgTemplateLoading={bgTemplateLoading}
          bgTemplateError={bgTemplateError} bgTemplateQuery={bgTemplateQuery}
          onSearchBgTemplate={handleBgTemplateSearch} onApplyTemplate={onSetBackground}
        />
      )}

      {hasBg ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1.5px solid ${COLORS.border}`, borderRadius: 8, background: '#fff', marginBottom: 14 }}>
          <div style={{ flex: 1, fontSize: '0.72rem', color: COLORS.text, fontWeight: '600' }}>✓ Background image set</div>
          <button onClick={() => onRemoveBg?.()} style={{ background: 'none', border: 'none', color: COLORS.danger, fontSize: '0.68rem', cursor: 'pointer', padding: 0, fontWeight: '600' }}>
            ✕ Remove
          </button>
        </div>
      ) : (
        <UploadButton label="Upload background" sub="PNG or JPG — fills the whole flyer" icon="🎨" accent onChange={e => onSetBackground(e)} />
      )}

      {/* ── Library / Stock / Upload / Graphics ── */}
      <span style={sL}>Photo</span>
      <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3, marginBottom: 14, gap: 2 }}>
        {[{ id: 'library', label: '📚 Library' }, { id: 'stock', label: '🔍 Stock' }, { id: 'upload', label: '☁️ Upload' }, { id: 'graphics', label: '🎨 Graphics' }].map(tab => (
          <button key={tab.id} onClick={() => setImageTab(tab.id)} style={{
            flex: 1, padding: '6px 2px', border: 'none', borderRadius: 6, cursor: 'pointer',
            background: imageTab === tab.id ? COLORS.accent : 'transparent',
            color: imageTab === tab.id ? 'white' : COLORS.textMuted,
            fontSize: '0.72rem', fontWeight: imageTab === tab.id ? '700' : '500',
          }}>{tab.label}</button>
        ))}
      </div>

      {imageTab === 'library' && (
        <div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {LIBRARY_CATS.map(cat => (
              <button key={cat} onClick={() => setLibraryCat(cat)} style={{
                padding: '5px 10px', borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${libraryCat === cat ? COLORS.accent : COLORS.border}`,
                background: libraryCat === cat ? COLORS.accent : '#fff',
                color: libraryCat === cat ? 'white' : COLORS.textMuted,
                fontSize: '0.72rem', fontWeight: libraryCat === cat ? '700' : '400',
              }}>{cat}</button>
            ))}
          </div>

          {libraryLoading && <div style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '0.82rem', padding: '20px 0' }}>Loading library…</div>}
          {libraryError  && <div style={{ color: '#b91c1c', fontSize: '0.78rem', background: '#fef2f2', padding: '10px', borderRadius: 6, marginBottom: 8, lineHeight: 1.6 }}>⚠ {libraryError}</div>}

          {!libraryLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
              {filteredLibrary.map((img, i) => (
                <div key={i}
                  onClick={() => onPlaceImage(img.url)}
                  draggable="true"
                  onDragStart={e => {
                    e.dataTransfer.setData('imageUrl', img.url);
                    e.dataTransfer.setData('text/plain', img.url);
                    e.dataTransfer.effectAllowed = 'copy';
                    onDragStart?.(img.url);
                  }}
                  onDragEnd={() => onDragEnd?.()}
                  style={tileWrap}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = 'scale(1.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <img src={img.thumb || img.url} alt={img.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                </div>
              ))}
              {filteredLibrary.length === 0 && !libraryLoading && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: COLORS.textMuted, fontSize: '0.82rem', padding: '20px 0', lineHeight: 2 }}>
                  No images yet.<br />
                  <span style={{ fontSize: '0.72rem', color: COLORS.textFaint }}>
                    Upload to S3:<br />temple-images/library/{libraryCat === 'All' ? 'Deities' : libraryCat}/
                  </span>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 12, padding: '10px 12px', background: COLORS.accentSoft, border: `1px solid ${COLORS.accent}33`, borderRadius: 7, fontSize: '0.72rem', color: COLORS.accent, lineHeight: 1.8 }}>
            💡 Click to place · Drag onto canvas
          </div>
        </div>
      )}

      {imageTab === 'stock' && (
        <div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {STOCK_CATEGORIES.map(({ label, q }) => (
              <button key={q} onClick={() => handleStockSearch(q)} style={{
                padding: '4px 9px', borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${stockQuery === q ? COLORS.accent : COLORS.border}`,
                background: stockQuery === q ? COLORS.accent : '#fff',
                color: stockQuery === q ? 'white' : COLORS.text,
                fontSize: '0.72rem', fontWeight: '500',
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
            <input value={stockSearchInput} onChange={e => setStockSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStockSearch(stockSearchInput)}
              placeholder="e.g. rangoli, deepam, lotus..."
              style={{ ...inp, flex: 1, marginBottom: 0, fontSize: '0.75rem' }} />
            <button onClick={() => handleStockSearch(stockSearchInput)}
              style={{ padding: '0 12px', background: COLORS.accent, border: 'none', color: 'white', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem' }}>🔍</button>
          </div>

          {stockLoading && <div style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: '0.82rem', padding: '20px 0' }}>Searching…</div>}
          {stockError  && <div style={{ color: '#b91c1c', fontSize: '0.78rem', background: '#fef2f2', padding: '10px', borderRadius: 6, marginBottom: 8 }}>⚠ {stockError}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
            {stockResults.map((img, i) => (
              <div key={i}
                onClick={() => onPlaceImage(img.largeImageURL || img.webformatURL)}
                draggable="true"
                onDragStart={e => {
                  const url = img.largeImageURL || img.webformatURL;
                  e.dataTransfer.setData('imageUrl', url);
                  e.dataTransfer.setData('text/plain', url);
                  e.dataTransfer.effectAllowed = 'copy';
                  onDragStart?.(url);
                }}
                onDragEnd={() => onDragEnd?.()}
                title={img.tags} style={tileWrap}
                onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = 'scale(1.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <img src={img.previewURL} alt={img.tags}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
              </div>
            ))}
            {!stockLoading && stockResults.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: COLORS.textMuted, fontSize: '0.82rem', padding: '20px 0' }}>
                Click a category or search above
              </div>
            )}
          </div>
          {stockResults.length > 0 && <div style={{ marginTop: 8, fontSize: '0.72rem', color: COLORS.textFaint, textAlign: 'center' }}>Free images from Pixabay</div>}
        </div>
      )}

      {imageTab === 'upload' && (
        <div>
          <UploadButton label="Deity / Event Photo" sub="Placed in center image area"          icon="🖼" onChange={e => onUpload(e, false)} />

          {/* Background Template upload now lives always-visible above,
              next to Logo — see the "Background" section near the top of
              this panel. This "Selected Image as Background" action is
              different (promotes whatever's already selected on canvas) so
              it stays here. */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: COLORS.text, fontSize: '0.82rem', fontWeight: '600', marginBottom: 2 }}>🔁 Selected Image as Background</div>
            <div style={{ color: COLORS.textFaint, fontSize: '0.7rem', marginBottom: 6 }}>Select any image on canvas, then click</div>
            <button onClick={() => onSetBackground(null)} style={{ width: '100%', padding: '11px', border: `1.5px solid ${COLORS.border}`, background: '#f9fafb', color: COLORS.text, borderRadius: 9, cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
              ⬇ Set Selected as Background
            </button>
          </div>

          <div style={{ marginTop: 4, padding: '12px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 9, fontSize: '0.72rem', color: '#4338ca', lineHeight: 1.9 }}>
            💡 <strong>Tips</strong><br />
            • Background sits behind all text &amp; images<br />
            • Use the Edit Image tools below to crop &amp; blur a photo<br />
            • Double-click text to edit inline<br />
            • Delete / Backspace removes selected object
          </div>
        </div>
      )}

      {imageTab === 'graphics' && (
        <div>
          <div style={{ color: COLORS.textFaint, fontSize: '0.7rem', marginBottom: 10, lineHeight: 1.5 }}>
            Decorative stickers you can drop on the canvas, then move, resize, or recolor like any other object — borders, florals, bunting, rangoli.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {GRAPHICS.map(g => (
              <div key={g.name}
                onClick={() => onPlaceGraphic?.(g.svg)}
                title={`Add ${g.name}`}
                style={{
                  cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
                  border: `2px solid ${COLORS.border}`, background: '#fff',
                  transition: 'border-color 0.15s, transform 0.1s',
                  display: 'flex', flexDirection: 'column',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.transform = 'scale(1.03)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <div
                  style={{ aspectRatio: '1', padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}
                  dangerouslySetInnerHTML={{ __html: g.svg }}
                />
                <div style={{ padding: '5px 6px', fontSize: '0.68rem', fontWeight: '600', color: COLORS.text, textAlign: 'center', borderTop: `1px solid ${COLORS.border}` }}>
                  {g.name}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: '10px 12px', background: COLORS.accentSoft, border: `1px solid ${COLORS.accent}33`, borderRadius: 7, fontSize: '0.72rem', color: COLORS.accent, lineHeight: 1.8 }}>
            💡 Click to add · Drag its handles on the canvas to resize
          </div>
        </div>
      )}

      <EditImageSection
        selectedObject={selectedObject} applyFilter={applyFilter} applyBlur={applyBlur}
        handleCrop={handleCrop} handleRemoveBgApi={handleRemoveBgApi} removingBg={removingBg}
        posterTitleText={posterTitleText} posterMessageText={posterMessageText}
        onPosterOverlayChange={onPosterOverlayChange} fabricRef={fabricRef}
      />
    </div>
  );
}
