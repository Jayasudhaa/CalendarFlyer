import React, { useState, useEffect, useRef } from 'react';
import { PROMPT_LIBRARY_OPTIONS, getPromptByName } from '../promptLibrary';
import { COMMUNITY_PROMPT_LIBRARY_OPTIONS, getCommunityPromptByName } from '../communityPromptLibrary';
import { buildPosterSpec, compileBackgroundPrompt } from '../posterSpec';
import { RUNWAY_FONT } from './runwayUI';
import PosterSpecWizard from './PosterSpecWizard';
import ReferencePhotosPanel from './ReferencePhotosPanel';

// "Champagne Glass" — the confirmed ultra-premium palette for this whole
// rail, now on a grey ground (a direct request, after comparing pale-yellow
// vs. grey side by side) instead of the original pale-yellow one. Gold
// stays as the accent on buttons/highlights (GOLD_DEEP below, used for CTAs
// elsewhere in this file) — only the background/border/ink tokens moved to
// grey. Same hex values as PosterSpecWizard.jsx's own consts — kept as a
// separate copy here rather than a shared import since each panel file in
// this project deliberately owns its own small color/gloss recipe (see
// PosterSpecWizard's comment on that).
const GOLD_DEEP   = '#7c5e1f';
const GOLD_LINE   = 'rgba(90,84,74,0.22)';
const INK2        = '#232220';
const RAIL_GRADIENT = 'linear-gradient(155deg, #f1f0ee, #dcdad5)';
const GLASS_CARD = {
  background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  border: `1px solid ${GOLD_LINE}`, borderRadius: 12, padding: '12px 13px', marginBottom: 12,
  boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 20px -18px rgba(60,56,50,0.35)',
};

// Image editing (crop/remove background/blur/brightness/contrast) lives in
// the Finishing Touches tab now — see BrandEditPanel.jsx. This panel is
// pure image GENERATION: what to make, not adjustments to what's already
// placed. Reference Photos used to live in its own right-side column
// (index.jsx) — moved down here, directly below the wizard, per a direct
// request ("add reference photo section below let's build together"); the
// right column is gone and the canvas has that width back. The "Or Upload
// Your Own" direct-background-upload fallback that used to live alongside
// it moved to the Finishing Touches tab instead (BrandEditPanel.jsx) — a
// separate direct request. The "💡 AI works best…" disclaimer stays in
// index.jsx, rendered below the canvas.
//
// The theme-chip picker ("What do you want to create?" + a wrapped row of
// chips) used to sit permanently at the top of this panel. It's now a
// pop-up shown once when you first land on this tab — a direct request, so
// the pick happens as a deliberate "starting ask" instead of taking up rail
// space for the rest of the session — collapsing afterward into a one-line
// "Starting theme: …" row with a Change button, so the choice stays easy to
// revisit without the chip grid being permanently in the way.
export default function AIVisualPanel({
  promptCategory,
  posterMode, setPosterMode,
  posterFields, setPosterFields,
  genPrompt, setGenPrompt,
  posterSpec, setPosterSpecField,
  referencePhotos, selectedReferencePhotoKeys, setSelectedReferencePhotoKeys, maxReferenceImages,
  onUploadReferencePhoto, onDeleteReferencePhoto, loadingReferencePhotos, referencePhotosNeedsLogin,
  onDescribeReferencePhoto, describingReference,
  // Merged in from the old Design panel — how the placed photo displays is
  // directly tied to the photo itself, so it now lives here next to it.
  imageStyle, setImageStyle,
  // Threaded straight through to PosterSpecWizard — see its own comments.
  // wizardControlRef lets index.jsx's below-canvas timeline strip command
  // the wizard to jump to a step; onStepsChange reports the wizard's
  // current step/answer list up to that same strip.
  wizardControlRef, onStepsChange,
  // Lifted up to index.jsx (a direct request: "keep only for first time or
  // starting a new session, not everytime") — this component remounts every
  // time you leave and come back to the "AI Visual" tab, so local state
  // here reset to true on every single remount, not just once per session.
  showThemePicker, setShowThemePicker,
}) {
  const [selectedDeityName, setSelectedDeityName] = useState('');
  // Spotlight the Reference Photos section (right below) for a few seconds
  // when the wizard's own reference-photo question comes up — a pulsing
  // gold ring, since the section is now right there rather than off in a
  // separate column, plus an auto-scroll so it's actually in view.
  const [highlightReference, setHighlightReference] = useState(false);
  const referenceSectionRef = useRef(null);
  useEffect(() => {
    if (highlightReference) referenceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightReference]);
  const isTemple = promptCategory === 'temple';
  const libraryOptions = isTemple ? PROMPT_LIBRARY_OPTIONS : COMMUNITY_PROMPT_LIBRARY_OPTIONS;
  const getLibraryPrompt = isTemple ? getPromptByName : getCommunityPromptByName;

  // Auto-recompile: fires whenever a wizard answer changes (posterSpec /
  // imageStyle / posterMode), layering the compiled spec on top of the
  // currently selected theme chip's base prompt. Skips the very first run
  // so it doesn't clobber the default prompt index.jsx already seeded
  // before the user has touched anything here.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) { isFirstRun.current = false; return; }
    if (!posterSpec) return;
    const compiled = compileBackgroundPrompt(buildPosterSpec(posterSpec, { promptCategory }));
    const base = selectedDeityName ? getLibraryPrompt(selectedDeityName) : '';
    setGenPrompt(base ? `${base}\n\n${compiled}` : compiled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posterSpec, imageStyle, posterMode]);

  const chooseTheme = (name) => {
    setSelectedDeityName(name);
    const base = getLibraryPrompt(name);
    // If the wizard's already been answered at least once, keep layering
    // the compiled spec on top of the newly-picked theme instead of
    // wiping it out.
    if (!isFirstRun.current && posterSpec) {
      const compiled = compileBackgroundPrompt(buildPosterSpec(posterSpec, { promptCategory }));
      setGenPrompt(base ? `${base}\n\n${compiled}` : compiled);
    } else {
      setGenPrompt(base);
    }
  };

  return (
    // Champagne Glass bleed — the confirmed "ultra premium" palette for this
    // rail. Negative-margins out past the rail's own 14px/16px padding
    // (index.jsx) and pads itself back out so the gradient reaches every
    // edge instead of leaving a plain-white gutter around it.
    <div style={{ margin: '-14px -16px', padding: '14px 16px', minHeight: 'calc(100% + 28px)', background: RAIL_GRADIENT }}>
      {/* ── Starting theme — compact row + Change button. The actual chip
          picker lives in the pop-up below now. ── */}
      <div style={{ ...GLASS_CARD, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: GOLD_DEEP, fontSize: '0.6rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
            Starting theme
          </div>
          <div style={{ color: INK2, fontSize: '0.82rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedDeityName || 'None picked yet — or just start typing above the canvas'}
          </div>
        </div>
        <button onClick={() => setShowThemePicker(true)} style={{
          padding: '7px 12px', borderRadius: 8, border: `1px solid ${GOLD_LINE}`,
          background: '#fff', color: GOLD_DEEP, fontWeight: '700', fontSize: '0.74rem',
          cursor: 'pointer', flexShrink: 0,
        }}>
          🎨 Change
        </button>
      </div>

      {/* ── Starting-theme pop-up — shown automatically the first time you
          land here, reopenable anytime via the Change button above. ── */}
      {showThemePicker && (
        <div onClick={() => setShowThemePicker(false)} style={{
          position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.78)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <style>{`
            .cf-theme-card { transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease, background 0.12s ease; }
            .cf-theme-card:hover { border-color: #111827; background: #fafafa; box-shadow: 0 4px 14px rgba(0,0,0,0.12); transform: translateY(-1px); }
            .cf-theme-card:hover .cf-theme-icon { box-shadow: 0 3px 10px -2px rgba(0,0,0,0.55); }
          `}</style>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, padding: '22px 24px', maxWidth: 460, width: '100%',
            maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
              <div style={{ fontFamily: RUNWAY_FONT, fontSize: '1.15rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.01em' }}>
                What do you want to create?
              </div>
              <button onClick={() => setShowThemePicker(false)} title="Close" style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.15rem',
                color: '#9ca3af', lineHeight: 1, padding: 4, flexShrink: 0,
              }}>✕</button>
            </div>
            <div style={{ color: '#111827', fontSize: '0.78rem', marginBottom: 14, lineHeight: 1.5, fontFamily: RUNWAY_FONT }}>
              Pick a starting theme below, or close this and just start typing in the prompt box above the canvas.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              {libraryOptions.map(name => {
                const spaceIdx = name.indexOf(' ');
                const emoji = spaceIdx > -1 ? name.slice(0, spaceIdx) : '✨';
                const label = spaceIdx > -1 ? name.slice(spaceIdx + 1) : name;
                const selected = selectedDeityName === name;
                return (
                  <button
                    key={name}
                    onClick={() => { chooseTheme(name); setShowThemePicker(false); }}
                    className="cf-theme-card"
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left',
                      padding: '12px 10px', borderRadius: 12, cursor: 'pointer',
                      border: selected ? '1.5px solid #111827' : '1.5px solid #e5e7eb',
                      background: selected ? '#fafafa' : '#ffffff',
                      boxShadow: selected ? '0 0 0 1px #111827' : 'none',
                      fontFamily: RUNWAY_FONT,
                    }}
                  >
                    <span className="cf-theme-icon" style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)',
                      boxShadow: '0 2px 6px -2px rgba(0,0,0,0.5)',
                    }}>{emoji}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.3, color: '#111827' }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Interactive Q&A — replaces Poster Specification + Photo Style ── */}
      <PosterSpecWizard
        ref={wizardControlRef}
        posterSpec={posterSpec} setPosterSpecField={setPosterSpecField}
        imageStyle={imageStyle} setImageStyle={setImageStyle}
        posterMode={posterMode} setPosterMode={setPosterMode}
        posterFields={posterFields} setPosterFields={setPosterFields}
        referencePhotos={referencePhotos}
        onReferenceStepActive={setHighlightReference}
        onStepsChange={onStepsChange}
      />

      {/* Reference Photos — moved here from the old right-side column, right
          below the wizard, per a direct request. Gets a pulsing gold ring
          + auto-scroll when the wizard's reference-photo question fires.
          Carries its own Champagne Glass frosted-card chrome now (the panel
          itself renders `bare`, so this is the only card box around it). */}
      <div id="reference-photos-section" ref={referenceSectionRef} style={{
        ...GLASS_CARD, marginBottom: 16,
        boxShadow: highlightReference
          ? '0 0 0 3px rgba(184,134,11,0.28), 0 10px 24px -10px rgba(184,134,11,0.5)'
          : GLASS_CARD.boxShadow,
        transition: 'box-shadow 0.35s',
      }}>
        <ReferencePhotosPanel
          bare
          referencePhotos={referencePhotos}
          selectedReferencePhotoKeys={selectedReferencePhotoKeys}
          setSelectedReferencePhotoKeys={setSelectedReferencePhotoKeys}
          maxReferenceImages={maxReferenceImages}
          onUploadReferencePhoto={onUploadReferencePhoto}
          onDeleteReferencePhoto={onDeleteReferencePhoto}
          loadingReferencePhotos={loadingReferencePhotos}
          referencePhotosNeedsLogin={referencePhotosNeedsLogin}
          onDescribeReferencePhoto={onDescribeReferencePhoto}
          describingReference={describingReference}
        />
      </div>

      {/* The "use your library photos as reference?" question used to render
          right here — a small inline box at the bottom of this rail panel.
          Root cause of "I click Generate and nothing happens, no image, no
          error": Generate lives in PromptDock, docked above the canvas —
          a completely different part of the screen from this rail. When
          the org has reference photos and none are explicitly selected,
          index.jsx's handleGenerate() stops short of actually generating
          and waits on this question instead — but the question appeared
          down here, easy to never see if you're not scrolled to this exact
          spot on the "AI Visual" tab. It's a real always-visible modal in
          index.jsx now instead (see referencePromptPending there), so the
          question can't be missed regardless of tab or scroll position.

          Generate button, progress bar, and error message all moved to
          PromptDock.jsx, docked above the canvas — no need to duplicate
          them here too. The "AI works best for…" disclaimer moved to
          index.jsx, rendered below the canvas. */}
    </div>
  );
}
