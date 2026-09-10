import React from 'react';
import { STYLES, COLORS } from '../constants';
import { FLYER_TEMPLATES } from '../flyerTemplates';
import ReferencePhotosPanel from './ReferencePhotosPanel';

const { sectionLabel: sL } = STYLES;

// DIY-mode template picker — a small swatch grid for the 4 themed flyer
// templates (flyerTemplates.js), plus (once a template is active) the
// artwork-slot picker for it. Reuses ReferencePhotosPanel.jsx's existing
// grid/upload/delete UI and API wiring rather than a second photo picker —
// same org-scoped reference photo library AI mode already uses, just in
// mode="place" here (see ReferencePhotosPanel.jsx) so a click drops the
// photo straight into the template's artworkSlot instead of toggling a
// generation-grounding selection.
//
// Deliberately separate from the older Starter Templates system (retired
// from the UI — see the PANELS_* comment in constants.js — TemplatesPanel.jsx
// is its unused leftover) — this is the new theme-based system described in
// flyerTemplates.js's own header comment.
export default function FlyerTemplatesPanel({
  activeFlyerTemplateId, onApplyTemplate,
  referencePhotos, onUploadReferencePhoto, onDeleteReferencePhoto,
  loadingReferencePhotos, referencePhotosNeedsLogin, onPlaceArtwork,
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <span style={sL}>Flyer Templates</span>
      <div style={{ color: COLORS.textFaint, fontSize: '0.7rem', marginBottom: 8, lineHeight: 1.5 }}>
        Start from a ready-made theme — background, border, title, date, and sponsorship layout are all drawn for you and stay fully editable afterward.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: activeFlyerTemplateId ? 14 : 4 }}>
        {FLYER_TEMPLATES.map(tpl => {
          const active = activeFlyerTemplateId === tpl.id;
          return (
            <button key={tpl.id} onClick={() => onApplyTemplate?.(tpl)} title={tpl.description || tpl.name} style={{
              cursor: 'pointer', borderRadius: 10, overflow: 'hidden', padding: 0,
              border: `2px solid ${active ? COLORS.accent : COLORS.border}`,
              background: '#fff', textAlign: 'left',
            }}>
              <div style={{
                height: 44, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 5,
                background: tpl.colors.bgGradient
                  ? `linear-gradient(160deg, ${tpl.colors.bgGradient[0]}, ${tpl.colors.bgGradient[1]})`
                  : tpl.colors.bg,
              }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: tpl.colors.accent, border: `1px solid ${tpl.colors.ink}66` }} />
              </div>
              <div style={{ padding: '6px 8px', fontSize: '0.7rem', fontWeight: '700', color: COLORS.text }}>
                {active ? '✓ ' : ''}{tpl.name}
              </div>
            </button>
          );
        })}
      </div>

      {activeFlyerTemplateId && (
        <div>
          <span style={sL}>Template Artwork</span>
          <ReferencePhotosPanel
            bare
            mode="place"
            onPlace={onPlaceArtwork}
            referencePhotos={referencePhotos}
            selectedReferencePhotoKeys={[]}
            setSelectedReferencePhotoKeys={() => {}}
            maxReferenceImages={1}
            onUploadReferencePhoto={onUploadReferencePhoto}
            onDeleteReferencePhoto={onDeleteReferencePhoto}
            loadingReferencePhotos={loadingReferencePhotos}
            referencePhotosNeedsLogin={referencePhotosNeedsLogin}
          />
        </div>
      )}
    </div>
  );
}
