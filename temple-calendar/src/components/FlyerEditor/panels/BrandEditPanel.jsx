import React from 'react';
import { COLORS } from '../constants';
import { LogoSection, EditImageSection, BackgroundTemplatesSection } from './BrandEditFields';
import DesignPanel from './DesignPanel';

// AI mode's slim rail tab — Canvas size + Logo + Edit Image, the tools that
// still matter once AI Visual (and the Reference Photos section below the
// wizard) already cover getting a photo/background in. Keeps AI mode from
// showing a full photo library that would sit unused next to AI
// generation. Canvas size used to live in its own bar pinned below the
// canvas — moved in here since that bar could overlap/"break" the poster
// when the canvas ran taller than the visible viewport.
//
// Renamed from "Brand & Edit" to "Finishing Touches" — a direct request
// for "a stylish name" — since everything here (logo, crop, background
// removal, blur/contrast, and now the direct background upload moved in
// from Reference Photos) is exactly that: the last pass over a poster
// after the image itself is already in place.
//
// "Or Upload Your Own" — skip generation entirely and drop in a background
// directly — moved here from ReferencePhotosPanel.jsx per a direct
// request, since it's a different kind of action (replace the whole
// background outright) than picking reference photos to ground an AI
// generation.
export default function BrandEditPanel({
  layout, setLayout,
  onUploadLogo, logoPreviewUrl, onRemoveLogo,
  logoLibrary, onSelectLibraryLogo, onRemoveLibraryLogo,
  selectedObject, applyFilter, applyBlur, handleCrop, handleRemoveBgApi, removingBg,
  posterTitleText, posterMessageText, onPosterOverlayChange, fabricRef,
  onSetBackground, hasBg, onRemoveBg,
  bgTemplateResults, bgTemplateLoading, bgTemplateError, bgTemplateQuery, handleBgTemplateSearch,
}) {
  return (
    // Champagne Glass bleed — "keep all the panel glass champagne," a
    // direct request to carry the AI Visual rail's frosted-gold look across
    // every left-rail tab, not just that one. Same bleed trick AIVisualPanel.jsx
    // uses: negative-margins out past the rail's own padding, then pads
    // itself back so the gradient reaches every edge.
    <div style={{ margin: '-14px -16px', padding: '14px 16px', minHeight: 'calc(100% + 28px)', background: 'linear-gradient(155deg, #f1f0ee, #dcdad5)' }}>
      <div style={{ color: '#232220', fontWeight: '800', fontSize: '0.95rem', marginBottom: 10 }}>✨ Finishing Touches</div>

      <div style={{ marginBottom: 16 }}>
        <DesignPanel layout={layout} setLayout={setLayout} />
      </div>

      <LogoSection onUploadLogo={onUploadLogo} logoPreviewUrl={logoPreviewUrl} onRemoveLogo={onRemoveLogo}
        logoLibrary={logoLibrary} onSelectLibraryLogo={onSelectLibraryLogo} onRemoveLibraryLogo={onRemoveLibraryLogo} />

      <EditImageSection
        selectedObject={selectedObject} applyFilter={applyFilter} applyBlur={applyBlur}
        handleCrop={handleCrop} handleRemoveBgApi={handleRemoveBgApi} removingBg={removingBg}
        posterTitleText={posterTitleText} posterMessageText={posterMessageText}
        onPosterOverlayChange={onPosterOverlayChange} fabricRef={fabricRef}
      />

      {onSetBackground && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
          {!hasBg && (
            <BackgroundTemplatesSection
              bgTemplateResults={bgTemplateResults} bgTemplateLoading={bgTemplateLoading}
              bgTemplateError={bgTemplateError} bgTemplateQuery={bgTemplateQuery}
              onSearchBgTemplate={handleBgTemplateSearch} onApplyTemplate={onSetBackground}
            />
          )}

          <div style={{ color: COLORS.text, fontWeight: '700', fontSize: '0.82rem', marginBottom: 4 }}>🖼 Or Upload Your Own</div>
          <div style={{ color: COLORS.textMuted, fontSize: '0.7rem', marginBottom: 8, lineHeight: 1.5 }}>
            Fills the whole flyer, same as a Media background upload — no generation needed
          </div>
          {hasBg ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1.5px solid ${COLORS.border}`, borderRadius: 8, background: '#fff' }}>
              <div style={{ flex: 1, fontSize: '0.72rem', color: COLORS.text, fontWeight: '600' }}>✓ Background image set</div>
              <button onClick={() => onRemoveBg?.()} style={{ background: 'none', border: 'none', color: COLORS.danger, fontSize: '0.68rem', cursor: 'pointer', padding: 0, fontWeight: '600' }}>
                ✕ Remove
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative', width: '100%' }}>
              <button style={{
                width: '100%', padding: '10px', border: `2px dashed ${COLORS.border}`,
                background: '#fff', color: COLORS.textMuted, borderRadius: 8,
                cursor: 'pointer', fontSize: '0.76rem', pointerEvents: 'none',
              }}>
                📤 Upload background image
              </button>
              <input type="file" accept="image/*" onChange={e => onSetBackground?.(e)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
