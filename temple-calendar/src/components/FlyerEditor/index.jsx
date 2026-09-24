/**
 * FlyerEditor — CalendarFly Flyer Studio
 *
 * Opens on a DIY-pic-vs-Let-AI-do-it choice (full-screen chooser — see
 * studioMode/showModeChooser below). The choice is locked once made; a
 * "↺ Restart" button in the icon rail re-opens the chooser if you want to
 * pick again. DIY and AI now share almost nothing in the rail: DIY gets
 * Event & Text/Media, AI gets AI Visual/Brand & Edit/Event & Text. Media
 * (photo library/stock/upload/graphics + logo + image-editing tools) is
 * DIY-only — AI mode gets a slim "Brand & Edit" tab (logo + image-editing
 * only) since AI Visual already covers getting a photo in. AI mode also
 * gets a dedicated right-side column for Reference Photos, separate from
 * the left rail panel. The AI Prompt box lives in a horizontal bar below
 * the canvas and only shows in AI mode; Canvas size stays there too but
 * shows in both modes.
 *
 * Module structure:
 *   index.jsx              ← this file — orchestrator
 *   constants.js           ← THEMES, FONTS, LAYOUTS, PANELS_DIY/PANELS_AI, COLORS…
 *   promptLibrary.js / communityPromptLibrary.js ← PROMPT_LIBRARY(S), buildPrompt()
 *   canvasBuilder.js       ← buildFlyer()/buildModernFlyer()/buildMinimalFlyer(), placeDeityImage(), placeGraphic(), initDeleteControl()
 *   useImageLibrary.js     ← S3 library + Pixabay search hook
 *   panels/EventTextPanel.jsx ← merged Event + Text — content editors for the five named
 *                               fields (title/date/time/venue/description), each with its
 *                               own font family/size/bold/italic, PLUS free-form "Other Text"
 *                               tools (add a text box, style whatever's selected, language/
 *                               translate) — both modes. Replaces the old separate
 *                               EventPanel.jsx + TextPanel.jsx (kept on disk, unused —
 *                               see below).
 *   panels/AIVisualPanel.jsx      ← starting-theme pop-up (Change button to reopen) + Poster Spec wizard + Photo Style — AI mode
 *   panels/BrandEditFields.jsx    ← shared LogoSection/EditImageSection building blocks, consumed by both panels below
 *   panels/BrandEditPanel.jsx     ← slim Canvas size + Logo + Edit Image tab — AI mode only
 *   panels/ReferencePhotosPanel.jsx ← reference photo library, rendered by AIVisualPanel.jsx below the wizard — AI mode only
 *   panels/MediaPanel.jsx    ← Canvas size + logo + curated library + Pixabay stock + your uploads + decorative Graphics + image-editing tools — DIY mode only
 *   panels/DesignPanel.jsx   ← Canvas size selector — now rendered inside BrandEditPanel/MediaPanel
 *                               instead of a bar below the canvas (that bar could overlap/"break"
 *                               the poster when the canvas ran taller than the visible area)
 *   modals/HistoryPanel.jsx
 *   modals/PromptHelpModal.jsx ← tips + example prompts (reused from promptLibrary/communityPromptLibrary) + what generated images look like
 *
 * TemplatesPanel.jsx / PhotosPanel.jsx / UploadPanel.jsx / LanguagesPanel.jsx /
 * EditImagePanel.jsx / BrandPanel.jsx / EventPanel.jsx / TextPanel.jsx still
 * exist on disk but are no longer imported anywhere — Templates was removed
 * outright (it set both layout AND color theme for the whole flyer, which
 * didn't fit a photo-first choice); Edit Image and Brand were folded into
 * MediaPanel and later re-extracted into BrandEditFields.jsx; the other
 * three were merged into MediaPanel/AIVisualPanel/TextPanel in an earlier
 * pass; Event + Text were merged into EventTextPanel.jsx in this pass.
 * Safe to delete; left in place for now.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { playComplete } from '../../utils/sound';
import { useNavigate } from 'react-router-dom';
import { useFabric } from './useFabric';
import AdminToolbar from '../AdminToolbar';

import { LAYOUTS, THEMES, PANELS_DIY, PANELS_AI, LANGUAGES, SPACING_OPTIONS, COLORS } from './constants';
import { buildPrompt }    from './promptLibrary';
import { buildCommunityPrompt } from './communityPromptLibrary';
import {
  buildFlyer, placeDeityImage as _placeImage, placeImageFullFrame as _placeImageFull, placeLogo as _placeLogo,
  placeGraphic as _placeGraphic, placeBackgroundTemplate as _placeBg, initDeleteControl,
  setPosterOverlayText, loadFlyerFonts, getFontForLang, loadGoogleFont,
  setGridOverlay, setSafeZoneOverlay, TEMPLATE_BUILDERS,
  // Themed flyer templates (flyerTemplates.js) — a separate, additive
  // system from buildFlyer/TEMPLATE_BUILDERS above (see canvasBuilder.js's
  // own header comment on applyTemplate/placeArtwork). Aliased on import:
  // this file already has its own unrelated `applyTemplate` callback below
  // for the older Starter Templates system (TEMPLATE_BUILDERS), and the
  // two must never be confused for each other.
  applyTemplate as applyFlyerThemeTemplate, placeArtwork,
} from './canvasBuilder';
import { useImageLibrary } from './useImageLibrary';
import { useTempleConfig } from '../../hooks/useTempleConfig';
import { inferPosterSpecDefaults } from './posterSpec';

// Named template text objects hidden in "AI Poster" mode, where the AI has
// already rendered the title/date/time/venue into the image itself.
const POSTER_MODE_HIDDEN_NAMES = [
  'om_symbol', 'temple_name', 'temple_addr', 'temple_info',
  'event_title', 'event_subtitle', 'event_date', 'event_time', 'event_desc',
];
// Extra Fabric props to persist across layout switches / translations —
// 'visible' is included so text hidden by AI Poster mode stays hidden.
const FLYER_JSON_PROPS = [
  'name', 'selectable', 'evented', 'originX', 'originY',
  'strokeDashArray', 'lineHeight', 'cropX', 'cropY', '_originalText', 'visible',
];
// Named text objects a heading-role font applies to (title/name text).
const HEADING_ROLE_NAMES = ['temple_name', 'event_title', 'event_subtitle'];
// Named text objects a body-role font applies to (everything else editable).
const BODY_ROLE_NAMES = ['temple_addr', 'temple_info', 'event_date', 'event_time', 'event_desc', 'rsvp_link', 'website', 'sponsorship'];

import EventTextPanel    from './panels/EventTextPanel';
import AIVisualPanel     from './panels/AIVisualPanel';
import BrandEditPanel    from './panels/BrandEditPanel';
import MediaPanel        from './panels/MediaPanel';
import PromptDock        from './panels/PromptDock';
import { RUNWAY_FONT }   from './panels/runwayUI';
// TemplatesPanel is no longer rendered — see the PANELS_* comment in
// constants.js for why. EditImagePanel and BrandPanel were folded into
// MediaPanel and later re-extracted into panels/BrandEditFields.jsx, shared
// by MediaPanel (DIY) and BrandEditPanel (AI). PhotosPanel, UploadPanel, and
// LanguagesPanel were merged into MediaPanel / TextPanel in an earlier pass.
// All of these files are left on disk unused rather than deleted, in case
// any content still needs to be cross-checked.
import HistoryPanel      from './modals/HistoryPanel';
import BroadcastModal    from './modals/BroadcastModal';
import PromptHelpModal   from './modals/PromptHelpModal';

// Same soft warm-gold halo background used on the admin calendar page —
// applied consistently across every admin page (Broadcast, Flyer, Analytics,
// My Profile, Subscription, Settings) instead of each having its own look.
// Was a warm-gold radial halo (var(--cf-accent-glow) x3) — dropped for a
// flat pure-white page background as part of the black & white redesign
// (same fix as App.jsx/CalendarGrid.jsx/MyProfile.jsx).
const HALO_BG = { backgroundColor: 'var(--cf-bg-base)' };

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEY  = 'temple_flyer_drafts';
const loadDrafts   = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
// Autosave WAS writing correctly the whole time — reported as "saving the
// work doesn't work / gone after reload" because nothing ever read it back.
// draftId used to be a fresh flyer_<timestamp> on every single mount, so
// closing the editor and reopening it (or reloading the page) always
// started a brand-new blank draft — the old one just sat in localStorage,
// orphaned, only reachable through the History panel if you knew to open
// it. This finds the most recent draft for the same context (a specific
// event's flyer, or the general Flyer Studio when event is null) so a
// fresh mount can resume it instead of silently abandoning it. loadDrafts
// is already most-recent-first (saveDraft unshifts), so the first match
// wins.
const getResumableDraft = (eventId) => loadDrafts().find(d => (d.eventId || null) === (eventId || null)) || null;
// Same delete HistoryPanel.jsx's own "🗑" button already does — duplicated
// here (rather than imported) since that file keeps its own tiny local
// copy of these helpers too; both read/write the same localStorage key.
const deleteDraftById = (id) => {
  const all = loadDrafts().filter(d => d.id !== id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch (e) { console.error('[deleteDraftById] failed', e); }
};
const saveDraft    = (draft) => {
  const all = loadDrafts(); const i = all.findIndex(d => d.id === draft.id); if (i >= 0) all[i] = draft; else all.unshift(draft);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 20))); }
  catch (e) { console.error('[saveDraft] localStorage write failed (quota?)', e); throw e; }
};
// Named logo library — a direct request: "when user click save and
// restart, ask for name of the pic and reserve a place in memory to save
// pic and show it next time in both modes." Deliberately a flat, global
// (not per-mode) store — the whole point is a reusable saved logo can be
// picked from either AI or DIY mode later, unlike the current live
// per-mode logo (logoByMode in the component below), which stays separate.
const LOGO_LIBRARY_KEY = 'temple_flyer_logo_library';
const loadLogoLibrary  = () => { try { return JSON.parse(localStorage.getItem(LOGO_LIBRARY_KEY) || '[]'); } catch { return []; } };
// A raw uploaded logo can be a multi-megabyte data URL — saving several of
// those straight into localStorage (which already holds the drafts list,
// itself full of embedded images) blew the browser's ~5-10MB quota.
// localStorage.setItem THROWS on that (QuotaExceededError), and that throw
// was uncaught inside the Save & Restart click handler — which is exactly
// what took the whole app to a blank screen ("save and restart goes
// blank"). Fixed two ways: shrink the image before storing (a logo only
// ever renders at 60x60 on the poster, so 240px is already generous), and
// wrap the actual write so a quota failure degrades to "couldn't save,
// nothing else broke" instead of crashing the page.
const compressDataUrl = (dataUrl, maxDim = 240) => new Promise((resolve) => {
  try {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      // PNG, not JPEG — logos are usually transparent, and JPEG would
      // flatten that to an opaque background.
      try { resolve(c.toDataURL('image/png')); } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  } catch { resolve(dataUrl); }
});
const saveLogoToLibrary = async (name, dataUrl) => {
  const compressed = await compressDataUrl(dataUrl);
  const all = loadLogoLibrary();
  const entry = { id: `logo_${Date.now()}`, name: name.trim(), dataUrl: compressed, savedAt: new Date().toISOString() };
  all.unshift(entry);
  try {
    localStorage.setItem(LOGO_LIBRARY_KEY, JSON.stringify(all.slice(0, 12)));
  } catch (e) {
    console.error('[saveLogoToLibrary] localStorage write failed (quota?)', e);
    return null;
  }
  return entry;
};
const removeLogoFromLibrary = (id) => {
  const all = loadLogoLibrary().filter(l => l.id !== id);
  try { localStorage.setItem(LOGO_LIBRARY_KEY, JSON.stringify(all)); } catch (e) { console.error('[removeLogoFromLibrary] failed', e); }
  return all;
};
// Same token the rest of the app stores after login (see useTempleConfig.js) —
// the /api/flyers/* routes require it via authenticateToken.
const authHeaders  = () => { const token = localStorage.getItem('cf_token'); return token ? { Authorization: `Bearer ${token}` } : {}; };
const uploadToS3   = async (dataUrl, filename) => { const res = await fetch('/api/flyers/upload', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ imageData: dataUrl, filename }) }); if (!res.ok) throw new Error('Upload failed'); return res.json(); };

// ─── Translation helper ───────────────────────────────────────────────────────
const translateText = async (text, lang) => {
  if (!text || lang === 'en') return text;
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang: lang }),
    });
    const d = await res.json();
    return d.translatedText || text;
  } catch { return text; }
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FlyerEditor({ event, onClose }) {
  const navigate    = useNavigate();
  const canvasRef   = useRef(null);
  const fabricRef   = useRef(null);
  const fabricReady = useFabric();
  // Answered-so-far timeline strip — sits snug beneath the poster (the
  // "Tight" placement, chosen over pinning it above the canvas) instead of
  // inside the wizard card itself, so it reads as a caption for THIS poster
  // rather than another step-navigator buried in the rail. wizardRef lets a
  // tapped chip command PosterSpecWizard (a totally separate part of the
  // tree, mounted inside AIVisualPanel) to jump straight to that question;
  // wizardHistory is that same wizard's reported step/answer list.
  const wizardRef = useRef(null);
  const [wizardHistory, setWizardHistory] = useState({ active: 0, items: [] });
  // Manual minimize for the "Answered so far" strip below the canvas —
  // independent of the automatic hide during generation/feedback (see the
  // !generating && !feedbackPending guard on it further down). Lets the
  // user collapse it down to just its label on their own terms, any time.
  const [answeredBarCollapsed, setAnsweredBarCollapsed] = useState(false);
  // Manual hide/show for the left tools panel (264px content column next
  // to the icon rail) — the icon rail itself always stays put so the
  // toggle and the tab buttons remain reachable either way.
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  // If a history chip is tapped while a different left-rail tab is open,
  // the wizard (and wizardRef) isn't mounted yet — stash the target step
  // here and jump to it once the "AI Visual" tab (re)mounts it.
  const pendingWizardStepRef = useRef(null);

  // Toolbar nav buttons that open an AdminCalendar overlay (Broadcast, Sync
  // Chatbot, Add Event, Help) need to close this editor first, then hand off
  // to AdminCalendar via the same pendingAction handoff other pages use —
  // otherwise the newly-opened overlay would render underneath this one.
  const closeThenGo = (pendingAction) => {
    onClose();
    navigate('/admin', { state: { pendingAction } });
  };

  // Computed once per mount (the lazy-init idiom below avoids re-checking
  // localStorage on every render) — see getResumableDraft's comment above.
  const resumeDraftRef = useRef(null);
  if (resumeDraftRef.current === null) resumeDraftRef.current = getResumableDraft(event?.id) || false;
  const resumeDraft = resumeDraftRef.current || null;

  // ── Org type — drives which AI image prompt library/guardrails apply ─────
  // Only org types with their own distinct prompt config in
  // server/config/aiImageDefaults.js get passed through as-is; everything
  // else (regional/language associations, mela/fair organizer, nonprofit,
  // plain community org, other) shares the generic 'community' style — see
  // resolveCategory() in server/routes/generate-image.js, which applies the
  // same fallback server-side regardless of what's sent here.
  const DISTINCT_PROMPT_CATEGORIES = ['temple', 'dance_school', 'music_school', 'yoga_school', 'restaurant', 'grocery'];
  const { config: templeConfig } = useTempleConfig();
  const promptCategory = DISTINCT_PROMPT_CATEGORIES.includes(templeConfig?.category) ? templeConfig.category : 'community';

  // ── Core state ───────────────────────────────────────────────────────────
  const [layout,       setLayout]      = useState(() => resumeDraft?.layout || 'portrait');
  const [theme,        setTheme]       = useState(() => resumeDraft?.theme || 'saffron');
  const [activePanel,  setActivePanel] = useState('event');
  // Flushes a history-chip tap that arrived while a different left-rail tab
  // was open — see pendingWizardStepRef above.
  useEffect(() => {
    if (activePanel !== 'ai' || pendingWizardStepRef.current == null) return;
    const target = pendingWizardStepRef.current;
    pendingWizardStepRef.current = null;
    requestAnimationFrame(() => wizardRef.current?.goToStep(target));
  }, [activePanel]);
  // DIY-vs-AI mode — chosen once via the full-screen chooser on open, then
  // locked: no small toggle to flip it by accident mid-edit anymore. The
  // "↺ Restart" button in the icon rail re-opens the chooser (via
  // handleChooseMode below) if you want to pick again — since Restart means
  // starting over, re-picking rebuilds the canvas fresh for the new mode
  // (blank for AI, the default template for DIY) rather than leaving
  // whatever was there.
  const [studioMode, setStudioMode] = useState(() => resumeDraft?.studioMode || 'ai');
  // Skip the full-screen chooser entirely when resuming — the mode was
  // already decided the last time this draft was saved.
  const [showModeChooser, setShowModeChooser] = useState(() => !resumeDraft);
  // Restart used to reopen the mode chooser straight away, silently
  // discarding whatever was on the canvas the moment a new mode got picked
  // — a direct request now gates it behind a "save your work or discard?"
  // choice first, in both directions (AI→DIY and DIY→AI both go through
  // this one Restart control, so gating it here covers "and vice versa").
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // Named logo library — see saveLogoToLibrary/loadLogoLibrary above.
  // logoLibrary is loaded once (it's plain localStorage, not something any
  // other tab/component mutates live) and refreshed locally after each
  // save/remove rather than re-reading storage on every render.
  const [logoLibrary, setLogoLibrary] = useState(() => loadLogoLibrary());
  const [saveLogoName, setSaveLogoName] = useState('');
  // The canvas-init 'mouse:down' handler below is registered once (it must
  // survive rebuilds without re-attaching) so it closes over stale state —
  // this ref is how it reads the current mode without re-registering.
  const studioModeRef = useRef(studioMode);
  useEffect(() => { studioModeRef.current = studioMode; }, [studioMode]);
  const handleChooseMode = (mode) => {
    // Reported: logo shows as "selected" in AI mode right after uploading
    // it in DIY — which per-mode separation (logoByMode) should prevent.
    // Logged so the next report can confirm from the console whether the
    // AI slot is genuinely non-empty (a real leak) or this is a stale
    // build not reflecting the fix yet.
    console.log(`[handleChooseMode] switching from "${studioMode}" to "${mode}" — logoByMode:`, JSON.stringify({ ai: !!logoByMode.current.ai, diy: !!logoByMode.current.diy }), 'bgByMode:', JSON.stringify({ ai: !!bgByMode.current.ai, diy: !!bgByMode.current.diy }));
    setStudioMode(mode);
    // The effect above only syncs studioModeRef AFTER this render commits —
    // too late for the per-mode logo/background lookups later in this same
    // function, which need the NEW mode right now, not next render. Set it
    // synchronously too (the effect will just redundantly repeat this).
    studioModeRef.current = mode;
    setShowModeChooser(false);
    setActivePanel(mode === 'ai' ? 'ai' : 'event');

    // Rebuild fresh for the chosen mode — AI starts blank (background
    // only; the AI-generated poster carries all the text), DIY starts from
    // the default template. Fires on the first pick and on every Restart.
    const canvas = fabricRef.current;
    if (canvas) {
      canvas.clear();
      canvas.setBackgroundColor(THEMES[theme].bg, () => {});
      // Freshly cleared+rebuilt canvas now genuinely belongs to the NEW
      // mode — without this, the layout-switch effect's "save outgoing
      // state" step would still attribute it to the OLD mode (stale
      // canvas._currentLayoutMode) the next time layout changes, which is
      // exactly the kind of mismatch that let a DIY snapshot get cached
      // and later replayed into AI mode. See layoutStates' comment above.
      canvas._currentLayoutKey = layout;
      canvas._currentLayoutMode = mode;
      if (mode === 'diy') {
        buildFlyer({
          canvas, dims: LAYOUTS[layout], theme: THEMES[theme], event,
          onSelectionChange: setSelectedObject, lang: activeLang, headingFont, bodyFont, spacing,
          category: promptCategory,
        });
      }
      if (placedLogoUrl.current) _placeLogo({ canvas, url: placedLogoUrl.current, dims: LAYOUTS[layout], scale: logoScaleRef.current });
      hasBuiltRef.current = true;
      placedImgUrl.current = '';
      placedFramedImgUrls.current = [];
      placedBgUrl.current = '';
      setHasBg(false);
      layoutStates.current = {};
      canvas.discardActiveObject();
      canvas.renderAll();
      pushHistoryRef.current();
      triggerAutosaveRef.current();
    }
    // Also reset Photo Style / Poster Mode to their defaults — otherwise a
    // "Full Frame"/poster-mode setting picked in a previous AI session
    // silently carries over into DIY, where there's no control to see or
    // undo it, and every photo you place there (even a plain stock pick)
    // ends up full-bleed as if it were a background instead of a normal
    // framed photo.
    setImageStyleState('framed');
    setPosterMode(false);
    setPosterFields({ title: '', date: '', time: '', venue: '' });
    setPosterTitleText('');
    setPosterMessageText('');
  };
  const visiblePanels = studioMode === 'ai' ? PANELS_AI : PANELS_DIY;
  // Matches the "Default zoom" effect below (80%) so there's no flash of a
  // different zoom level before that effect runs on mount.
  const [zoom,         setZoom]        = useState(0.8);
  const [toast,        setToast]       = useState('');
  const [draftId, setDraftId]          = useState(() => resumeDraft?.id || `flyer_${Date.now()}`);
  const [flyerTitle,    setFlyerTitle]     = useState(() => resumeDraft?.title || event?.title || 'New Flyer');
  const [editingTitle,  setEditingTitle]   = useState(false);

  // ── UI modals ────────────────────────────────────────────────────────────
  const [showHistory,  setShowHistory] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPreview,  setShowPreview] = useState(false);
  const [previewUrl,   setPreviewUrl]  = useState('');
  const [shareOpen,    setShareOpen]   = useState(false);
  // Canva-style "File" menu — a direct request, shown a Canva screenshot
  // and asked for the same "in both modes". Toolbar already renders above
  // the mode-chooser check, so anything added here is naturally visible in
  // both AI and DIY without extra wiring.
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [sponsorship,  setSponsorship] = useState('');
  const [selectedObject, setSelectedObject] = useState(null);
  // hasBg (and logoPreviewUrl/placedLogoUrl/placedBgUrl/logoScaleRef further
  // below) used to be single global values shared between AI and DIY mode —
  // reported as "getting confused/messed up between ai mode and diy mode."
  // Backed by per-mode stores now (see logoByMode/bgByMode/logoScaleByMode/
  // hasBgByMode/logoPreviewByMode below); `hasBg` itself stays a plain
  // derived read for whichever mode is currently active, computed after
  // studioMode is declared.
  const [hasBgByMode, setHasBgByMode] = useState({ ai: false, diy: false });
  const hasBg = hasBgByMode[studioMode];
  const setHasBg = (v) => setHasBgByMode(m => ({
    ...m, [studioModeRef.current]: typeof v === 'function' ? v(m[studioModeRef.current]) : v,
  }));
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDragging,     setIsDragging]     = useState(false); // true whenever any drag is in progress
  const dragUrlRef = useRef('');
  const [removingBg,     setRemovingBg]      = useState(false);
  const [isFullscreen,   setIsFullscreen]    = useState(false);

  // ── Language / translation ───────────────────────────────────────────────
  const [activeLang,   setActiveLang]  = useState('en');
  const [translating,  setTranslating] = useState(false);

  // ── AI image generation ───────────────────────────────────────────────────
  // "What do you want to create?" starting-theme pop-up — used to be local
  // state inside AIVisualPanel.jsx, defaulting to true, which meant it reset
  // to true (and popped back up) every time that component remounted — i.e.
  // every single time you left the "AI Visual" tab and came back, not just
  // once per session. Lifted up here, to a component that doesn't unmount
  // on tab switches, so it only shows once per session/new draft, exactly
  // like a real "first time" prompt should.
  const [showThemePicker, setShowThemePicker] = useState(true);
  const [genPrompt,    setGenPrompt]   = useState('');
  const [generating,   setGenerating]  = useState(false);
  const [genError,     setGenError]    = useState('');
  const [genSeconds,   setGenSeconds]  = useState(0);
  const genTimerRef = useRef(null);

  // ── Post-generate 👍/👎 feedback — sent straight to the site owner's
  // inbox (see server/routes/image-feedback.js), same "no DB, straight to
  // email" scoping as the contact form. lastGenInfo snapshots what was
  // actually generated (prompt/category/mode) at success time so a later
  // prompt edit can't mislabel the feedback.
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [lastGenInfo, setLastGenInfo] = useState(null);
  // Reference Photos' spotlight-on-arrival highlight now lives entirely in
  // AIVisualPanel.jsx — it moved from a separate right-side column to a
  // section directly below the wizard (see that file), so there's no
  // longer a cross-component canvas-dim/column-pop to coordinate here.
  async function sendImageFeedback(rating, comment) {
    try {
      const res = await fetch('/api/image-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          rating, comment,
          prompt: lastGenInfo?.prompt || genPrompt,
          category: lastGenInfo?.category || promptCategory,
          mode: lastGenInfo?.mode,
        }),
      });
      if (!res.ok) throw new Error();
      showToast(rating === 'up' ? '👍 Thanks — feedback sent!' : '👎 Thanks — feedback sent, we\'ll take a look.');
    } catch {
      showToast('⚠ Could not send feedback — please try again');
    } finally {
      setFeedbackPending(false);
    }
  }

  // ── Image placement style — 'framed' (boxed photo) or 'full' (edge-to-edge) ─
  const [imageStyle,   setImageStyleState] = useState('framed');

  // ── AI Poster mode — AI bakes title/date/time/venue into the image itself ──
  const [posterMode,   setPosterMode]   = useState(false);
  const [posterFields, setPosterFields] = useState({ title: '', date: '', time: '', venue: '' });
  useEffect(() => {
    setPosterFields(f => ({
      title: event?.title || f.title,
      date: event?.date
        ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : f.date,
      time: event?.time || f.time,
      venue: f.venue || templeConfig?.address || '',
    }));
    setFlyerTitle(t => (t === 'New Flyer' && event?.title) ? event.title : t);
  }, [event]); // eslint-disable-line

  // ── Full Frame title/message text overlay ─────────────────────────────────
  const [posterTitleText,   setPosterTitleText]   = useState('');
  const [posterMessageText, setPosterMessageText] = useState('');

  // ── Poster Specification — structured dropdowns/checkboxes that compile
  // into the AI prompt (Intent engine → Poster spec → Prompt compiler) ──────
  const [posterSpec, setPosterSpecState] = useState(() =>
    inferPosterSpecDefaults({ event, promptCategory, imageStyle: 'framed' })
  );
  const setPosterSpecField = useCallback((key, val) => {
    setPosterSpecState(prev => ({ ...prev, [key]: val }));
  }, []);
  useEffect(() => {
    setPosterSpecState(inferPosterSpecDefaults({ event, promptCategory, imageStyle }));
    // Only re-infer when the event/org context changes — imageStyle read at
    // that moment only, not a trigger (switching Framed/Full shouldn't wipe
    // spec fields the user already edited).
  }, [event, promptCategory]); // eslint-disable-line
  // Spec → prompt compilation now happens automatically inside
  // AIVisualPanel (see its useEffect watching posterSpec/imageStyle/
  // posterMode) as soon as an answer changes, layered on top of whichever
  // theme chip is selected — no separate "Compile" action needed here
  // anymore.

  // ── Reference photos (org library) — optional grounding image for AI gen ──
  // Requires the user to be logged in (org_id + cf_token come from that) —
  // guests/unauthenticated sessions can't use this, same as Save to Cloud.
  const [referencePhotos, setReferencePhotos] = useState([]);
  // Multi-select, capped at MAX_REFERENCE_IMAGES — mirrors the server-side
  // cap in generate-image.js so the UI never lets you pick more than what
  // will actually be used.
  const MAX_REFERENCE_IMAGES = 4;
  const [selectedReferencePhotoKeys, setSelectedReferencePhotoKeys] = useState([]);
  // "Always ask" before generating when the library has photos but none are
  // explicitly picked yet — set true right before a Generate click that
  // needs an answer, resolved by handleReferenceYes/No below.
  const [referencePromptPending, setReferencePromptPending] = useState(false);
  const [loadingReferencePhotos, setLoadingReferencePhotos] = useState(false);
  const [describingReference, setDescribingReference] = useState(false);
  const [referencePhotosNeedsLogin, setReferencePhotosNeedsLogin] = useState(false);
  const friendlyAuthMessage = (status, fallback) =>
    status === 401 || status === 403 ? 'Please log in to your CalendarFly account first' : fallback;
  useEffect(() => {
    if (!templeConfig?.org_id) return;
    setLoadingReferencePhotos(true);
    fetch('/api/flyers/reference-photos', { headers: { ...authHeaders() } })
      .then(res => {
        setReferencePhotosNeedsLogin(res.status === 401 || res.status === 403);
        return res.ok ? res.json() : { photos: [] };
      })
      .then(data => setReferencePhotos(data.photos || []))
      .catch(() => {})
      .finally(() => setLoadingReferencePhotos(false));
  }, [templeConfig?.org_id]);
  const handleUploadReferencePhoto = useCallback((e) => {
    // Accepts one or several files at once (the file input now has
    // `multiple` — previously only e.target.files[0] was ever read, so
    // selecting more than one photo in the OS picker silently dropped all
    // but the first). Uploaded one at a time, in order, so the reference
    // list updates progressively rather than all-or-nothing.
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';

    const readAsDataURL = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => resolve(ev.target.result);
      reader.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
      reader.readAsDataURL(file);
    });

    (async () => {
      setLoadingReferencePhotos(true);
      let failed = 0;
      try {
        for (const file of files) {
          try {
            const imageData = await readAsDataURL(file);
            const res = await fetch('/api/flyers/reference-photos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders() },
              body: JSON.stringify({ imageData, label: file.name }),
            });
            if (!res.ok) {
              setReferencePhotosNeedsLogin(res.status === 401 || res.status === 403);
              const err = await res.json().catch(() => ({}));
              throw new Error(friendlyAuthMessage(res.status, err.error || 'Upload failed'));
            }
            const data = await res.json();
            setReferencePhotos(data.photos || []);
          } catch (err) {
            failed++;
            console.error('[reference-photo] Upload failed:', err);
          }
        }
        const okCount = files.length - failed;
        if (okCount > 0) {
          showToast(okCount === 1 ? '✓ Reference photo added' : `✓ ${okCount} reference photos added`);
        }
        if (failed > 0) {
          showToast(`⚠ ${failed} of ${files.length} photo${files.length === 1 ? '' : 's'} failed to upload`);
        }
      } finally {
        setLoadingReferencePhotos(false);
      }
    })();
  }, []);
  const handleDeleteReferencePhoto = useCallback(async (key) => {
    setLoadingReferencePhotos(true);
    try {
      const res = await fetch(`/api/flyers/reference-photos/${encodeURIComponent(key)}`, {
        method: 'DELETE', headers: { ...authHeaders() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(friendlyAuthMessage(res.status, err.error || 'Delete failed'));
      }
      const data = await res.json();
      setReferencePhotos(data.photos || []);
      setSelectedReferencePhotoKeys(prev => prev.filter(k => k !== key));
      showToast('✓ Reference photo removed');
    } catch (err) {
      console.error('[reference-photo] Delete failed:', err);
      showToast('⚠ ' + err.message);
    } finally {
      setLoadingReferencePhotos(false);
    }
  }, []);

  // Auto-write the AI prompt from a selected reference photo — asks the
  // server to describe what's actually in the photo (setting, architecture,
  // decor, colors, lighting) and writes that straight into the prompt box,
  // so the org doesn't have to describe their own uploaded photo in words.
  const handleDescribeReferencePhoto = useCallback(async () => {
    const key = selectedReferencePhotoKeys[0];
    const photo = referencePhotos.find(p => p.key === key);
    if (!photo?.url) { showToast('⚠ Select a reference photo first'); return; }
    setDescribingReference(true);
    try {
      const res = await fetch('/api/describe-reference-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ url: photo.url, category: promptCategory }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(friendlyAuthMessage(res.status, err.error || 'Could not describe photo'));
      }
      const data = await res.json();
      if (data.description) {
        setGenPrompt(data.description);
        showToast('✓ Prompt written from your reference photo');
      }
    } catch (err) {
      console.error('[describe-reference-image] Failed:', err);
      showToast('⚠ ' + err.message);
    } finally {
      setDescribingReference(false);
    }
  }, [selectedReferencePhotoKeys, referencePhotos, promptCategory]);

  // ── Design panel state: template/font pairing/alignment/spacing/guides ────
  const [activeTemplateId, setActiveTemplateId] = useState('traditional-mahotsav');
  const [activeBuilderKey, setActiveBuilderKey] = useState('traditional'); // drives which canvasBuilder fn a rebuild uses

  // ── Themed flyer templates (DIY mode — flyerTemplates.js) ─────────────────
  // Holds the whole template object (not just an id) — placeArtwork() needs
  // template.artworkSlot to know where to put a picked photo, and this is
  // the only place that's tracked once applyFlyerThemeTemplate has drawn it.
  // Entirely separate from activeTemplateId/activeBuilderKey above (the
  // older Starter Templates system) — the two never read from each other.
  const [activeFlyerTemplate, setActiveFlyerTemplate] = useState(null);
  const [headingFont, setHeadingFont] = useState('Cinzel');
  const [bodyFont,    setBodyFont]    = useState('Poppins');
  const [alignment,   setAlignment]   = useState('center');
  const [spacingKey,  setSpacingKey]  = useState('Comfortable');
  const [showGrid,     setShowGrid]     = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(false);

  // ── Save / download state ─────────────────────────────────────────────────
  const [saving,       setSaving]      = useState(false);
  const [uploading,    setUploading]   = useState(false);
  const [downloading,  setDownloading] = useState(false);

  // ── Autosave ─────────────────────────────────────────────────────────────
  const [autosaveMsg, setAutosaveMsg] = useState('Draft');
  const autosaveTimerRef = useRef(null);

  // ── Undo / redo history ───────────────────────────────────────────────────
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isRestoringRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ── Image sub-tab ─────────────────────────────────────────────────────────
  const [imageTab, setImageTab] = useState('stock');

  // ── Image library + stock search (custom hook) ────────────────────────────
  const imageLibrary = useImageLibrary(imageTab);

  // ── Derived ───────────────────────────────────────────────────────────────
  const dims = LAYOUTS[layout];
  const t    = THEMES[theme];
  // Errors (⚠) stay up longer — easy to miss a 2.8s toast if you looked away
  // right when you clicked, and error text is usually longer to read.
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), msg.startsWith('⚠') ? 6000 : 2800); };
  const activeBuilder = TEMPLATE_BUILDERS[activeBuilderKey] || buildFlyer;
  const spacing = SPACING_OPTIONS[spacingKey] || 1;

  // ── Canvas init ───────────────────────────────────────────────────────────
  // Root cause of the recurring "logo uploaded in DIY shows up in AI mode"
  // report, finally traced: every key here used to be the bare layout name
  // ('square', 'portrait', …) with NO mode in it. AI mode and DIY mode share
  // the same layout names, so a canvas snapshot captured while editing in
  // DIY (with a logo baked into its Fabric JSON) could sit in this cache
  // under e.g. 'square', and later get silently replayed onto the AI-mode
  // canvas the next time AI mode also visited 'square' — the layout-switch
  // effect's own restore branch had no way to tell the two apart. Every
  // read/write below is now keyed `${studioMode}:${layout}` instead, so a
  // DIY snapshot and an AI snapshot for the same layout name can never
  // collide or get replayed into the wrong mode.
  const layoutStates  = useRef({});          // { 'ai:square': fabricJSON, 'diy:portrait': fabricJSON, … }
  const placedImgUrl  = useRef('');          // last image URL placed — survives layout switch
  // Canva-style multi-photo: placeDeityImage ADDS a framed photo instead of
  // replacing the last one, so more than one can be on the canvas at once
  // (e.g. a deity image + a stock image side by side). This array tracks
  // every framed photo's URL so a canvas rebuild (layout switch, spacing
  // change, template apply) can re-place ALL of them, not just the last —
  // placedImgUrl above still tracks just the most-recent one, used for
  // Full Frame mode (always a single edge-to-edge photo) and as a
  // single-photo fallback for state saved before this array existed.
  const placedFramedImgUrls = useRef([]);
  // Logo/background/logo-scale used to be single global refs, shared
  // between AI mode and DIY mode — reported as "getting confused/messed up
  // between ai mode and diy mode." Backed by one store per mode now
  // (logoByMode/bgByMode/logoScaleByMode), keyed by studioModeRef.current
  // (always current, safe inside any closure/useCallback regardless of its
  // dependency array — see studioModeRef's own comment above). placedLogoUrl/
  // placedBgUrl/logoScaleRef below are getter/setter shims that keep the
  // exact same `.current` read/write interface a plain useRef has, so every
  // existing call site (every rebuild path re-placing the logo/background)
  // keeps working completely unchanged — only reads/writes the slot for
  // whichever mode is active right now instead of one shared slot.
  const logoByMode      = useRef({ ai: '', diy: '' });
  const bgByMode        = useRef({ ai: '', diy: '' });
  const logoScaleByMode = useRef({ ai: null, diy: null });
  const placedLogoUrl = {
    get current() { return logoByMode.current[studioModeRef.current]; },
    set current(v) { logoByMode.current[studioModeRef.current] = v; },
  };
  const placedBgUrl = {
    get current() { return bgByMode.current[studioModeRef.current]; },
    set current(v) { bgByMode.current[studioModeRef.current] = v; },
  };
  // Remembers a manually-resized logo's scale (set via the canvas
  // 'object:modified' listener below) so every re-placement — after
  // picking a new photo, switching layout, etc. — re-applies the size the
  // user actually chose instead of silently resetting to the default
  // 60x60 box. null = no custom size yet, use the default.
  const logoScaleRef = {
    get current() { return logoScaleByMode.current[studioModeRef.current]; },
    set current(v) { logoScaleByMode.current[studioModeRef.current] = v; },
  };
  const [logoPreviewByMode, setLogoPreviewByMode] = useState({ ai: '', diy: '' }); // drives the thumbnail shown in the Logo section, per mode
  const logoPreviewUrl = logoPreviewByMode[studioMode];
  const setLogoPreviewUrl = (v) => setLogoPreviewByMode(m => ({
    ...m, [studioModeRef.current]: typeof v === 'function' ? v(m[studioModeRef.current]) : v,
  }));
  // Guards against buildFlyer() being invoked twice on the same fresh canvas.
  // The canvas-init effect below builds asynchronously (it waits for fonts),
  // while the layout-switch effect also fires on initial mount and builds
  // synchronously. Without this flag both would run buildFlyer() — which
  // never clears the canvas itself — leaving a duplicate, fully-opaque
  // second 'bg' Rect stacked on top of everything. That stray rect was the
  // real cause of the full-frame photo (and anything sent to the back)
  // appearing invisible: our opacity/z-order fixes only ever touched the
  // FIRST 'bg' object, never the hidden duplicate sitting above it.
  const hasBuiltRef = useRef(false);

  // ── Autosave + undo/redo trigger (stable ref so the canvas listener never
  // captures a stale closure) ────────────────────────────────────────────────
  const pushHistory = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || isRestoringRef.current) return;
    const json = JSON.stringify(canvas.toJSON(FLYER_JSON_PROPS));
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(json);
    if (historyRef.current.length > 40) historyRef.current.shift();
    historyIndexRef.current = historyRef.current.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const triggerAutosave = useCallback(() => {
    setAutosaveMsg('Saving…');
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      try {
        const canvas = fabricRef.current; if (!canvas) return;
        const thumbnail = canvas.toDataURL({ format: 'jpeg', quality: 0.3, multiplier: 0.2 });
        saveDraft({
          id: draftId, title: flyerTitle || event?.title || 'Untitled Flyer', layout, theme,
          studioMode: studioModeRef.current,
          canvasJSON: JSON.stringify(canvas.toJSON(['name'])), thumbnail,
          savedAt: new Date().toISOString(), eventId: event?.id,
        });
        setAutosaveMsg('Autosaved just now');
        setTimeout(() => setAutosaveMsg(m => m === 'Autosaved just now' ? 'Draft' : m), 6000);
      } catch (e) { setAutosaveMsg('Draft'); }
    }, 1200);
  }, [draftId, flyerTitle, event, layout, theme]);

  const pushHistoryRef = useRef(pushHistory);
  const triggerAutosaveRef = useRef(triggerAutosave);
  useEffect(() => { pushHistoryRef.current = pushHistory; }, [pushHistory]);
  useEffect(() => { triggerAutosaveRef.current = triggerAutosave; }, [triggerAutosave]);
  const onCanvasChanged = useCallback((e) => {
    // If the user just dragged a logo corner to resize it, remember that
    // scale so the next re-placement (new photo, layout switch, etc.)
    // keeps it instead of resetting to the default 60x60 box.
    const name = e?.target?.name;
    if (name === 'logo_l' || name === 'logo_r') {
      logoScaleRef.current = e.target.scaleX;
    }
    pushHistoryRef.current();
    triggerAutosaveRef.current();
  }, []);

  // ── Canvas init — runs ONCE when Fabric is ready ──────────────────────────
  useEffect(() => {
    if (!fabricReady || !canvasRef.current) return;
    if (fabricRef.current) { try { fabricRef.current.dispose(); } catch (e) {} }
    // Canva-style delete-on-corner icon for every selectable object —
    // registered once, globally, on fabric.Object.prototype.controls (see
    // its doc comment in canvasBuilder.js). Replaces the floating "Delete
    // Selected" button below the canvas.
    initDeleteControl();
    hasBuiltRef.current = false;
    const dims = LAYOUTS[layout];
    const t    = THEMES[theme];
    const canvas = new window.fabric.Canvas(canvasRef.current, {
      width: dims.w, height: dims.h,
      backgroundColor: t.bg, preserveObjectStacking: true,
    });
    fabricRef.current = canvas;
    canvas._currentLayoutKey = layout;
    canvas._currentLayoutMode = studioModeRef.current;
    canvas.on('object:modified', onCanvasChanged);
    // Every template's empty image area is an inert, non-selectable
    // placeholder ('img_placeholder'/'img_hint') — clicking it jumps to
    // whichever mode-specific tab is current (Media for DIY, AI Visual for
    // AI) so it reads as "add a photo here", not a dead gray box.
    // Registered once on the canvas instance, so it survives
    // template/spacing rebuilds without needing to be re-attached.
    //
    // Clicking an actual placed photo jumps to Edit Image — but only for a
    // real user click (this handler), not a programmatic setActiveObject()
    // call made right after AI-generating or placing an image. Using the
    // selection:created event for this instead used to fire on every
    // placement, not just clicks, and yanked the tab around mid-generation
    // ("tabs keep changing").
    canvas.on('mouse:down', (opt) => {
      const name = opt.target?.name;
      if (name === 'img_placeholder' || name === 'img_hint') {
        setActivePanel(studioModeRef.current === 'diy' ? 'media' : 'ai');
        showToast('📸 Pick a photo, or generate one with AI');
      } else if (opt.target?.type === 'image') {
        // Edit Image tools live in Media for DIY, and in the slim Brand &
        // Edit tab for AI (Media isn't shown there anymore).
        setActivePanel(studioModeRef.current === 'diy' ? 'media' : 'brand');
      }
    });
    // Load fonts first, then build canvas so scripts render correctly —
    // but only if the layout-switch effect (which runs synchronously right
    // after this one, even on first mount) hasn't already built it.
    loadFlyerFonts(activeLang).then(() => {
      if (hasBuiltRef.current) return; // already built by the layout-switch effect
      // Resuming a saved draft (see resumeDraftRef/getResumableDraft above)
      // — restore its actual canvas content instead of building a fresh
      // template, the same fix that makes "saved but gone after reload"
      // stop happening. Only ever relevant on this very first build.
      if (resumeDraftRef.current) {
        try {
          canvas.loadFromJSON(JSON.parse(resumeDraftRef.current.canvasJSON), () => {
            canvas.renderAll();
            // Same ref-hydration handleLoadDraft already does elsewhere —
            // saveDraft only serializes the canvas objects themselves, never
            // placedLogoUrl/placedBgUrl/placedImgUrl/logoScaleRef/hasBg, and
            // every rebuild path re-places those FROM the refs rather than
            // from whatever's currently drawn.
            const objs = canvas.getObjects();
            const logo = objs.find(o => o.name === 'logo_l' || o.name === 'logo_r');
            if (logo?._element?.src) {
              placedLogoUrl.current = logo._element.src;
              setLogoPreviewUrl(logo._element.src);
              logoScaleRef.current = logo.scaleX || null;
            }
            const bgTemplate = objs.find(o => o.name === 'bg_template');
            if (bgTemplate?._element?.src) {
              placedBgUrl.current = bgTemplate._element.src;
              setHasBg(true);
            }
            const fullFrame = objs.find(o => o.name === 'full_frame_img');
            const framedImgs = objs.filter(o => o.name === 'deity_img').map(o => o._element?.src).filter(Boolean);
            if (fullFrame?._element?.src) {
              placedImgUrl.current = fullFrame._element.src;
            } else if (framedImgs.length) {
              placedImgUrl.current = framedImgs[framedImgs.length - 1];
              placedFramedImgUrls.current = framedImgs;
            }
          });
        } catch (e) {
          console.error('[resume draft] failed to restore, starting fresh instead', e);
          if (studioModeRef.current !== 'ai') {
            buildFlyer({ canvas, dims, theme: t, event, onSelectionChange: setSelectedObject, lang: activeLang, headingFont, bodyFont, spacing, category: promptCategory });
          }
        }
        hasBuiltRef.current = true;
        pushHistoryRef.current();
        return;
      }
      // AI mode starts blank (background only) — the full AI-generated
      // poster carries all the text, so nothing needs to pre-exist. DIY
      // starts from the default template. studioModeRef (not studioMode)
      // since this runs inside an async .then() that may resolve after a
      // re-render.
      if (studioModeRef.current !== 'ai') {
        buildFlyer({ canvas, dims, theme: t, event, onSelectionChange: setSelectedObject, lang: activeLang, headingFont, bodyFont, spacing, category: promptCategory });
      }
      hasBuiltRef.current = true;
      pushHistoryRef.current();
    });
    return () => { try { canvas.dispose(); } catch (e) {} };
  }, [fabricReady]); // eslint-disable-line
  // ── Layout switch — save full state, resize, restore or rebuild ─────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !fabricReady) return;
    const newDims = LAYOUTS[layout];
    const prevKey = canvas._currentLayoutKey;
    // The mode this canvas's CURRENT content actually belongs to — captured
    // the last time this effect (or the canvas-init effect) ran, so a mode
    // switch that happens WITHOUT a layout change (handled entirely by
    // handleChooseMode, which isn't in this effect's dependency array) still
    // gets attributed correctly whenever this effect next runs.
    const prevMode = canvas._currentLayoutMode || studioModeRef.current;

    // 1. Save outgoing layout state — keyed by mode+layout (see layoutStates
    // above) so this can never be replayed into the other mode later.
    if (prevKey && prevKey !== layout) {
      layoutStates.current[`${prevMode}:${prevKey}`] = {
        json: canvas.toJSON(FLYER_JSON_PROPS),
        imgUrl: placedImgUrl.current,
        imgUrls: [...placedFramedImgUrls.current],
      };
    }
    canvas._currentLayoutKey = layout;
    canvas._currentLayoutMode = studioModeRef.current;

    // 2. Resize canvas
    canvas.setWidth(newDims.w);
    canvas.setHeight(newDims.h);
    const saved = layoutStates.current[`${studioModeRef.current}:${layout}`];
    if (saved?.json) {
      // 3a. Restore previously saved state (includes image objects in JSON)
      canvas.loadFromJSON(saved.json, () => {
        if (saved.imgUrl) placedImgUrl.current = saved.imgUrl;
        placedFramedImgUrls.current = saved.imgUrls || [];
        canvas.discardActiveObject();
        canvas.renderAll();
      });
    } else if (resumeDraftRef.current) {
      // Resuming a saved draft (see getResumableDraft/resumeDraftRef
      // above). This layout-switch effect fires synchronously on mount —
      // before the canvas-init effect's async font-load .then() even
      // resolves — so THIS is the branch that actually has to do the
      // restore; by the time that other .then() runs, hasBuiltRef is
      // already true and it just skips past its own copy of this logic.
      const draft = resumeDraftRef.current;
      resumeDraftRef.current = false; // consume — only ever applies to this first build
      try {
        canvas.loadFromJSON(JSON.parse(draft.canvasJSON), () => {
          canvas.renderAll();
          const objs = canvas.getObjects();
          const logo = objs.find(o => o.name === 'logo_l' || o.name === 'logo_r');
          if (logo?._element?.src) {
            placedLogoUrl.current = logo._element.src;
            setLogoPreviewUrl(logo._element.src);
            logoScaleRef.current = logo.scaleX || null;
          }
          const bgTemplate = objs.find(o => o.name === 'bg_template');
          if (bgTemplate?._element?.src) {
            placedBgUrl.current = bgTemplate._element.src;
            setHasBg(true);
          }
          const fullFrame = objs.find(o => o.name === 'full_frame_img');
          const framedImgs = objs.filter(o => o.name === 'deity_img').map(o => o._element?.src).filter(Boolean);
          if (fullFrame?._element?.src) {
            placedImgUrl.current = fullFrame._element.src;
          } else if (framedImgs.length) {
            placedImgUrl.current = framedImgs[framedImgs.length - 1];
            placedFramedImgUrls.current = framedImgs;
          }
        });
      } catch (e) {
        console.error('[resume draft] failed to restore, starting fresh instead', e);
        canvas.clear();
        canvas.setBackgroundColor(THEMES[theme].bg, () => {});
        if (studioModeRef.current !== 'ai') {
          activeBuilder({
            canvas, dims: newDims, theme: THEMES[theme], event,
            onSelectionChange: setSelectedObject, lang: activeLang, headingFont, bodyFont, spacing,
            category: promptCategory,
          });
        }
      }
      hasBuiltRef.current = true;
    } else {
      // 3b. First visit to this layout — build fresh, carry over image
      canvas.clear();
      canvas.setBackgroundColor(THEMES[theme].bg, () => {});
      // Same AI-blank / DIY-default split as the canvas-init effect above —
      // switching canvas size shouldn't resurrect template text in AI mode.
      if (studioModeRef.current !== 'ai') {
        activeBuilder({
          canvas, dims: newDims, theme: THEMES[theme], event,
          onSelectionChange: setSelectedObject, lang: activeLang, headingFont, bodyFont, spacing,
          category: promptCategory,
        });
      }
      hasBuiltRef.current = true; // canvas-init effect's async build must skip now
      if (placedBgUrl.current) {
        setTimeout(() => _placeBg({ canvas, url: placedBgUrl.current, dims: newDims }), 200);
      }
      if (imageStyle === 'full') {
        if (placedImgUrl.current) {
          setTimeout(() => {
            _placeImageFull({ canvas, url: placedImgUrl.current, dims: newDims });
            if (posterMode) {
              canvas.getObjects().forEach(o => {
                if (POSTER_MODE_HIDDEN_NAMES.includes(o.name)) o.set({ visible: false });
              });
              canvas.renderAll();
            }
          }, 200);
        }
      } else {
        // Canva-style multi-photo: re-place every framed photo that
        // survived (placeDeityImage now adds rather than replaces), with a
        // fallback to the single placedImgUrl ref for state saved before
        // this array existed (e.g. an older autosaved draft).
        const framedUrls = placedFramedImgUrls.current.length
          ? placedFramedImgUrls.current
          : (placedImgUrl.current ? [placedImgUrl.current] : []);
        framedUrls.forEach((url, i) => {
          setTimeout(() => _placeImage({ canvas, url, dims: newDims }), 200 + i * 60);
        });
      }
      if (placedLogoUrl.current) {
        setTimeout(() => _placeLogo({ canvas, url: placedLogoUrl.current, dims: newDims, scale: logoScaleRef.current }), 200);
      }
    }
  }, [layout]); // eslint-disable-line
  // ── Theme change — update colors WITHOUT destroying the canvas ─────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !fabricReady) return;
    const t    = THEMES[theme];
    const dims = LAYOUTS[layout];
    // Update background
    canvas.setBackgroundColor(t.bg, () => canvas.renderAll());
    // Update named objects that carry theme colors
    const colorMap = {
      header_bg:  { fill: t.header },
      footer_bg:  { fill: t.header },
      temple_name: { fill: '#FFFFFF' },
      temple_addr: { fill: 'rgba(255,255,255,0.85)' },
      temple_info: { fill: 'rgba(255,255,255,0.75)' },
      event_title: { fill: t.title },
      event_date:  { fill: t.date },
      event_time:  { fill: t.date },
      event_desc:  { fill: t.text },
      rsvp_link:   { fill: t.text },
      img_hint:    { fill: t.date },
      img_placeholder: { fill: t.accent, stroke: t.border },
      sponsorship: { fill: t.title },
    };
    canvas.getObjects().forEach(obj => {
      const updates = colorMap[obj.name];
      if (updates) obj.set(updates);
    });
    // Update border rects (no name, but they are the first two objects)
    canvas.getObjects()
      .filter(o => o.type === 'rect' && !o.name)
      .forEach(o => o.set({ stroke: t.border }));
    canvas.renderAll();
  }, [theme]); // eslint-disable-line

  // ── Font pairing — non-destructive: re-target existing text objects
  // rather than rebuilding the canvas, so edited text is never lost ────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !fabricReady) return;
    loadGoogleFont(headingFont);
    loadGoogleFont(bodyFont);
    canvas.getObjects().forEach(o => {
      if (HEADING_ROLE_NAMES.includes(o.name)) o.set({ fontFamily: headingFont });
      else if (BODY_ROLE_NAMES.includes(o.name)) o.set({ fontFamily: bodyFont });
    });
    canvas.renderAll();
  }, [headingFont, bodyFont]); // eslint-disable-line

  // ── Alignment — non-destructive: repositions the major text blocks ───────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !fabricReady) return;
    const dims = LAYOUTS[layout];
    const originX = alignment;
    const left = alignment === 'left' ? dims.w * 0.06 : alignment === 'right' ? dims.w * 0.94 : dims.w / 2;
    [...HEADING_ROLE_NAMES, ...BODY_ROLE_NAMES].forEach(name => {
      const obj = canvas.getObjects().find(o => o.name === name);
      if (obj) obj.set({ textAlign: alignment, originX, left });
    });
    canvas.renderAll();
  }, [alignment]); // eslint-disable-line

  // ── Spacing — structural, requires a rebuild (documented in the UI) ──────
  const isFirstSpacingRun = useRef(true);
  useEffect(() => {
    if (isFirstSpacingRun.current) { isFirstSpacingRun.current = false; return; }
    const canvas = fabricRef.current;
    if (!canvas || !fabricReady) return;
    canvas.clear();
    canvas.setBackgroundColor(THEMES[theme].bg, () => {});
    activeBuilder({ canvas, dims, theme: t, event, onSelectionChange: setSelectedObject, lang: activeLang, headingFont, bodyFont, spacing, category: promptCategory });
    if (placedBgUrl.current) {
      setTimeout(() => _placeBg({ canvas, url: placedBgUrl.current, dims }), 150);
    }
    if (imageStyle === 'full') {
      if (placedImgUrl.current) {
        setTimeout(() => {
          _placeImageFull({ canvas, url: placedImgUrl.current, dims });
          // Rebuilding recreates the template's title/date/time/venue text and
          // drops the movable Full Frame overlay — both must be restored here
          // or AI Poster mode breaks on every spacing change (template text
          // reappears over the AI image; the custom overlay silently vanishes).
          if (posterMode) {
            canvas.getObjects().forEach(o => {
              if (POSTER_MODE_HIDDEN_NAMES.includes(o.name)) o.set({ visible: false });
            });
            if (posterTitleText || posterMessageText) {
              setPosterOverlayText({ canvas, dims, title: posterTitleText, message: posterMessageText });
            }
            canvas.renderAll();
          }
        }, 150);
      }
    } else {
      // Canva-style multi-photo: re-place every framed photo that survived,
      // falling back to the single placedImgUrl ref for older draft state.
      const framedUrls = placedFramedImgUrls.current.length
        ? placedFramedImgUrls.current
        : (placedImgUrl.current ? [placedImgUrl.current] : []);
      framedUrls.forEach((url, i) => {
        setTimeout(() => _placeImage({ canvas, url, dims }), 150 + i * 60);
      });
    }
    if (placedLogoUrl.current) {
      setTimeout(() => _placeLogo({ canvas, url: placedLogoUrl.current, dims, scale: logoScaleRef.current }), 150);
    }
    pushHistoryRef.current();
    triggerAutosaveRef.current();
  }, [spacingKey]); // eslint-disable-line

  // ── Grid / Safe Zone overlays ─────────────────────────────────────────────
  useEffect(() => { setGridOverlay(fabricRef.current, dims, showGrid); }, [showGrid, layout]); // eslint-disable-line
  useEffect(() => { setSafeZoneOverlay(fabricRef.current, dims, showSafeZone); }, [showSafeZone, layout]); // eslint-disable-line

  // ── Fullscreen sync ───────────────────────────────────────────────────────
  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch (e) { /* not available in this browser/context */ }
  };

  // ── Default zoom ──────────────────────────────────────────────────────────
  // Used to auto-shrink to fit the viewport on every layout/window-resize.
  // 100% was cutting most layouts off past the fold on a typical screen (a
  // direct report — the canvas area scrolls/pans, but a visitor landing on
  // the editor shouldn't have to scroll or zoom out just to see the whole
  // poster on first load), so this defaults to 80% instead. The manual zoom
  // toolbar still lets someone zoom in past that, or out further, at will.
  useEffect(() => {
    setZoom(0.8);
  }, [layout, dims]);

  // ── Save image into current layout state so switching layout retains it ──
  const saveLayoutState = useCallback((url) => {
    const canvas = fabricRef.current;
    setTimeout(() => {
      if (!canvas) return;
      const key = canvas._currentLayoutKey || layout;
      const mode = canvas._currentLayoutMode || studioModeRef.current;
      layoutStates.current[`${mode}:${key}`] = {
        json: canvas.toJSON(FLYER_JSON_PROPS),
        imgUrl: url,
        imgUrls: [...placedFramedImgUrls.current],
      };
    }, 500); // wait for image to fully load onto canvas
  }, [layout]);

  // ── Place image on canvas (respects the Framed / Full Frame toggle) ───────
  // Canva-style: picking a new photo ADDS it alongside whatever's already
  // there (deity image, stock photo, another upload — all can coexist),
  // rather than silently replacing the last one. Full Frame stays a single
  // edge-to-edge photo by nature — placeImageFullFrame already clears every
  // framed photo off the canvas when switching to it, so the tracked array
  // is reset to match.
  const placeDeityImage = useCallback((url) => {
    placedImgUrl.current = url;
    const canvas = fabricRef.current;
    if (imageStyle === 'full') {
      _placeImageFull({ canvas, url, dims: LAYOUTS[layout] });
      // placeImageFullFrame removes any previously-uploaded 'bg_template'
      // object, so the "background image set" indicator would go stale
      // if we didn't clear it here too. Also clear the refs so nothing
      // stale gets silently re-applied (and re-hidden behind the full-frame
      // photo) after the next canvas rebuild.
      setHasBg(false);
      placedBgUrl.current = '';
      placedFramedImgUrls.current = [];
    } else {
      _placeImage({ canvas, url, dims: LAYOUTS[layout] });
      placedFramedImgUrls.current = [...placedFramedImgUrls.current, url];
    }
    // Re-assert the logo after every image swap (Media panel, drag-drop, AI
    // background generation) — reported as disappearing when changing the
    // photo; belt-and-suspenders alongside the rebuild-path fix elsewhere.
    // scale keeps whatever size the user dragged the logo to, if any.
    if (placedLogoUrl.current) _placeLogo({ canvas, url: placedLogoUrl.current, dims: LAYOUTS[layout], scale: logoScaleRef.current });
    saveLayoutState(url);
    triggerAutosaveRef.current();
  }, [layout, imageStyle, saveLayoutState]);

  // ── Drop a decorative graphic (border/flower/flags/rangoli) onto the canvas ──
  const handlePlaceGraphic = useCallback((svg) => {
    const canvas = fabricRef.current;
    _placeGraphic({ canvas, svg, dims: LAYOUTS[layout] });
    triggerAutosaveRef.current();
  }, [layout]);

  // ── Show/hide the template's title/date/time/venue text — used by AI ──────
  // Poster mode, where that information is already baked into the image.
  const setTemplateTextVisible = useCallback((visible) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getObjects().forEach(o => {
      if (POSTER_MODE_HIDDEN_NAMES.includes(o.name)) o.set({ visible });
    });
    canvas.renderAll();
  }, []);

  // ── Toggle AI Poster mode — restore the template text if turned back off ──
  const handleSetPosterMode = useCallback((val) => {
    setPosterMode(val);
    if (!val) setTemplateTextVisible(true);
  }, [setTemplateTextVisible]);

  // ── Switch Framed / Full Frame — re-places the current image if one exists ─
  const handleSetImageStyle = useCallback((style) => {
    setImageStyleState(style);
    const canvas = fabricRef.current;
    if (style === 'framed') {
      setPosterMode(false);
      setTemplateTextVisible(true);
      if (canvas) {
        ['poster_title_text', 'poster_message_text'].forEach(name => {
          const obj = canvas.getObjects().find(o => o.name === name);
          if (obj) canvas.remove(obj);
        });
        canvas.renderAll();
      }
      setPosterTitleText('');
      setPosterMessageText('');
    }
    if (canvas && placedImgUrl.current) {
      const dims = LAYOUTS[layout];
      if (style === 'full') {
        // placeImageFullFrame wipes every framed 'deity_img' off the canvas
        // (a full-bleed photo and separate framed photos don't coexist), so
        // drop the tracked multi-photo array to match.
        _placeImageFull({ canvas, url: placedImgUrl.current, dims });
        placedFramedImgUrls.current = [];
      } else {
        _placeImage({ canvas, url: placedImgUrl.current, dims });
        // Coming back from Full Frame there's only ever the one photo to
        // restore — reseed the array with it so a later rebuild still
        // knows about this photo (it was cleared above when Full Frame
        // was turned on).
        if (!placedFramedImgUrls.current.length) placedFramedImgUrls.current = [placedImgUrl.current];
      }
      saveLayoutState(placedImgUrl.current);
    }
  }, [layout, saveLayoutState, setTemplateTextVisible]);

  // ── Full Frame Title/Message overlay — add/update/remove on the canvas ────
  const handlePosterOverlayChange = useCallback((next) => {
    const title = next.title !== undefined ? next.title : posterTitleText;
    const message = next.message !== undefined ? next.message : posterMessageText;
    if (next.title !== undefined) setPosterTitleText(next.title);
    if (next.message !== undefined) setPosterMessageText(next.message);
    const canvas = fabricRef.current;
    if (canvas) {
      setPosterOverlayText({ canvas, dims: LAYOUTS[layout], title, message });
      saveLayoutState(placedImgUrl.current);
    }
  }, [posterTitleText, posterMessageText, layout, saveLayoutState]);

  useEffect(() => {
    setGenPrompt(promptCategory === 'temple' ? buildPrompt(event) : buildCommunityPrompt(event));
  }, [event, promptCategory]);

  // ── Keyboard delete ───────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.key === 'Delete' || e.key === 'Backspace') &&
          !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        const c = fabricRef.current;
        const o = c?.getActiveObject();
        if (o) { c.remove(o); c.renderAll(); setSelectedObject(null); }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' &&
          !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []); // eslint-disable-line

  // ── Drag-and-drop: global cleanup on dragend ────────────────────────────────
  useEffect(() => {
    function onDragEnd() {
      dragUrlRef.current = '';
      setIsDragging(false);
      setIsDraggingOver(false);
    };
    document.addEventListener('dragend',  onDragEnd);
    return () => document.removeEventListener('dragend', onDragEnd);
  }, []);

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const json = historyRef.current[historyIndexRef.current];
    const canvas = fabricRef.current; if (!canvas || !json) return;
    isRestoringRef.current = true;
    canvas.loadFromJSON(JSON.parse(json), () => {
      canvas.renderAll(); isRestoringRef.current = false;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(true);
    });
  }, []);
  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const json = historyRef.current[historyIndexRef.current];
    const canvas = fabricRef.current; if (!canvas || !json) return;
    isRestoringRef.current = true;
    canvas.loadFromJSON(JSON.parse(json), () => {
      canvas.renderAll(); isRestoringRef.current = false;
      setCanUndo(true);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    });
  }, []);

  // ── Apply a Templates panel selection ─────────────────────────────────────
  const applyTemplate = useCallback((tpl) => {
    const canvas = fabricRef.current;
    if (!canvas) { showToast('⚠ Canvas is still loading — please wait a second and try again'); return; }
    setActiveTemplateId(tpl.id);
    setActiveBuilderKey(tpl.builder);
    setTheme(tpl.theme);
    const builder = TEMPLATE_BUILDERS[tpl.builder] || buildFlyer;
    canvas.clear();
    canvas.setBackgroundColor(THEMES[tpl.theme].bg, () => {});
    builder({ canvas, dims, theme: THEMES[tpl.theme], event, onSelectionChange: setSelectedObject, lang: activeLang, headingFont, bodyFont, spacing, category: promptCategory });
    if (placedBgUrl.current) {
      setTimeout(() => _placeBg({ canvas, url: placedBgUrl.current, dims }), 150);
    }
    if (imageStyle === 'full') {
      if (placedImgUrl.current) {
        setTimeout(() => {
          _placeImageFull({ canvas, url: placedImgUrl.current, dims });
          // Same fix as the spacing-change effect above — a template switch
          // rebuilds the canvas, so AI Poster mode's hidden text + overlay need
          // to be reapplied or they silently break.
          if (posterMode) {
            canvas.getObjects().forEach(o => {
              if (POSTER_MODE_HIDDEN_NAMES.includes(o.name)) o.set({ visible: false });
            });
            if (posterTitleText || posterMessageText) {
              setPosterOverlayText({ canvas, dims, title: posterTitleText, message: posterMessageText });
            }
            canvas.renderAll();
          }
        }, 150);
      }
    } else {
      // Canva-style multi-photo: re-place every framed photo that survived,
      // falling back to the single placedImgUrl ref for older draft state.
      const framedUrls = placedFramedImgUrls.current.length
        ? placedFramedImgUrls.current
        : (placedImgUrl.current ? [placedImgUrl.current] : []);
      framedUrls.forEach((url, i) => {
        setTimeout(() => _placeImage({ canvas, url, dims }), 150 + i * 60);
      });
    }
    if (placedLogoUrl.current) {
      setTimeout(() => _placeLogo({ canvas, url: placedLogoUrl.current, dims, scale: logoScaleRef.current }), 150);
    }
    showToast(`✓ Applied "${tpl.name}"`);
    pushHistoryRef.current();
    triggerAutosaveRef.current();
  }, [dims, event, activeLang, headingFont, bodyFont, spacing, imageStyle, posterMode, posterTitleText, posterMessageText]);

  // ── Apply a themed flyer template (DIY mode — see MediaPanel's Flyer
  // Templates section / FlyerTemplatesPanel.jsx). Separate from the
  // applyTemplate() callback above (the older Starter Templates system) —
  // this one draws via canvasBuilder.js's applyFlyerThemeTemplate (aliased
  // from applyTemplate on import) instead of TEMPLATE_BUILDERS.
  //
  // Each themed template targets a specific LAYOUTS size (its layoutKey —
  // see flyerTemplates.js), so picking one switches `layout` first if it
  // isn't already showing that size. That triggers the existing
  // layout-switch effect (resize + its own default rebuild), and — same
  // setTimeout-after-resize pattern used everywhere else in this file for
  // post-rebuild placement (_placeLogo/_placeImage/_placeBg above) — the
  // themed template is then drawn on top of that once the resize settles.
  const applyFlyerTemplate = useCallback((tpl) => {
    const doApply = () => {
      const canvas = fabricRef.current;
      if (!canvas) { showToast('⚠ Canvas is still loading — please wait a second and try again'); return; }
      const targetDims = LAYOUTS[tpl.layoutKey] || dims;
      applyFlyerThemeTemplate({ canvas, template: tpl, dims: targetDims });
      setActiveFlyerTemplate(tpl);
      if (placedLogoUrl.current) {
        setTimeout(() => _placeLogo({ canvas: fabricRef.current, url: placedLogoUrl.current, dims: targetDims, scale: logoScaleRef.current }), 150);
      }
      showToast(`✓ Applied "${tpl.name}"`);
      pushHistoryRef.current();
      triggerAutosaveRef.current();
    };
    if (layout !== tpl.layoutKey) {
      setLayout(tpl.layoutKey);
      setTimeout(doApply, 260);
    } else {
      doApply();
    }
  }, [layout, dims]);

  // Places a reference photo into the active themed template's artwork
  // slot — see canvasBuilder.js's placeArtwork() and
  // FlyerTemplatesPanel.jsx's ReferencePhotosPanel (mode="place").
  const handlePlaceArtwork = useCallback((url) => {
    const canvas = fabricRef.current;
    if (!canvas) { showToast('⚠ Canvas is still loading — please wait a second and try again'); return; }
    if (!activeFlyerTemplate) { showToast('⚠ Pick a flyer template first'); return; }
    placeArtwork({ canvas, url, template: activeFlyerTemplate });
    triggerAutosaveRef.current();
  }, [activeFlyerTemplate]);

  // ── AI generate ───────────────────────────────────────────────────────────
  // overrideKeys lets the Yes/No reference prompt pass its answer straight
  // through without waiting on a setState/render round-trip (selectedRefer-
  // encePhotoKeys wouldn't be updated yet on the same tick).
  const runGenerate = async (overrideKeys) => {
    const keys = overrideKeys !== undefined ? overrideKeys : selectedReferencePhotoKeys;
    const urls = keys
      .map(k => referencePhotos.find(p => p.key === k)?.url)
      .filter(Boolean)
      .slice(0, MAX_REFERENCE_IMAGES);
    setGenerating(true); setGenError(''); setGenSeconds(0);
    genTimerRef.current = setInterval(() => setGenSeconds(s => s + 1), 1000);
    try {
      const dims = LAYOUTS[layout];
      const body = { prompt: genPrompt, category: promptCategory, width: dims.w, height: dims.h };
      if (posterMode) { body.mode = 'poster'; body.posterText = posterFields; }
      if (urls.length) body.referencePhotoUrls = urls;
      const res = await fetch('/api/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      const img = data.imageBase64 || data.imageUrl || data.url;
      if (!img) throw new Error('No image in response — restart your server');
      if (urls.length && !data.usedReferencePhoto) {
        showToast('⚠ Reference images could not be used — generated without them');
      } else if (data.usage && !data.usage.isUnlimited) {
        showToast(data.usage.overLimit
          ? `💳 Free AI images used up this month — this one added $${(data.usage.overageCentsAdded / 100).toFixed(2)} to your bill (total owed: $${(data.usage.totalOverageCents / 100).toFixed(2)})`
          : `✨ ${data.usage.used}/${data.usage.limit} free AI images used this month`);
      }
      if (posterMode) {
        placedImgUrl.current = img;
        setImageStyleState('full');
        _placeImageFull({ canvas: fabricRef.current, url: img, dims });
        // placeImageFullFrame now clears any previously-uploaded 'bg_template'
        // (fixes "I set a background, generated a poster, background gone" —
        // the old bg_template was being pushed in front of the new poster
        // instead of removed). Keep the UI's background indicator in sync,
        // and clear the ref so it can't come back after a later rebuild.
        setHasBg(false);
        placedBgUrl.current = '';
        // placeImageFullFrame also wipes every framed 'deity_img' off the
        // canvas — drop the tracked multi-photo array to match.
        placedFramedImgUrls.current = [];
        if (placedLogoUrl.current) _placeLogo({ canvas: fabricRef.current, url: placedLogoUrl.current, dims, scale: logoScaleRef.current });
        setTemplateTextVisible(false);
        saveLayoutState(img);
        // Previously force-jumped to the Event tab here, which yanked the
        // user away from AI Visual right after generating (reported as
        // "tabs keep changing") — stay put so they can review/regenerate
        // or tweak poster fields without the view jumping on them.
      } else {
        placeDeityImage(img);
      }
      triggerAutosaveRef.current();
      setLastGenInfo({ prompt: genPrompt, category: promptCategory, mode: posterMode ? 'poster' : 'image' });
      setFeedbackPending(true);
    } catch (err) {
      setGenError(err.message);
      // The red banner lives inside the (often-collapsed) prompt dock —
      // easy to miss, and a silent-looking failure reads as "Generate
      // doesn't work." A toast surfaces the same message somewhere it'll
      // actually be seen.
      showToast(`⚠ Generate failed: ${err.message}`);
    } finally {
      clearInterval(genTimerRef.current);
      setGenerating(false);
    }
  };

  // Generate button's onClick. If the org has library photos and none are
  // explicitly picked, always ask first rather than silently choosing for
  // them — this fires every time (not just once), since a manual pick via
  // the picker itself already counts as an answer and skips the ask.
  const handleGenerate = () => {
    if (referencePhotos.length > 0 && selectedReferencePhotoKeys.length === 0) {
      setReferencePromptPending(true);
      return;
    }
    runGenerate();
  };
  const handleReferenceYes = () => {
    const keys = referencePhotos.slice(-MAX_REFERENCE_IMAGES).map(p => p.key);
    setSelectedReferencePhotoKeys(keys);
    setReferencePromptPending(false);
    runGenerate(keys);
  };
  const handleReferenceNo = () => {
    setReferencePromptPending(false);
    runGenerate([]);
  };

  // ── Upload image / logo ───────────────────────────────────────────────────
  function handleUpload(e, isLogo) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (isLogo) {
        placedLogoUrl.current = ev.target.result;
        setLogoPreviewUrl(ev.target.result);
        // A brand-new logo image gets the default size — logoScaleRef only
        // remembers a resize of the CURRENT logo.
        logoScaleRef.current = null;
        _placeLogo({ canvas: fabricRef.current, url: placedLogoUrl.current, dims });
        triggerAutosaveRef.current();
      } else { placeDeityImage(ev.target.result); }
    };
    reader.readAsDataURL(file); e.target.value = '';
  };

  // Reuse a previously-saved, named logo (from the library) as this mode's
  // current logo — same effect as handleUpload's isLogo branch, just
  // sourced from a stored dataUrl instead of a freshly-picked file.
  function handleSelectLibraryLogo(dataUrl) {
    placedLogoUrl.current = dataUrl;
    setLogoPreviewUrl(dataUrl);
    logoScaleRef.current = null;
    _placeLogo({ canvas: fabricRef.current, url: dataUrl, dims });
    triggerAutosaveRef.current();
    showToast('✓ Logo applied from library');
  }
  function handleRemoveLibraryLogo(id) {
    setLogoLibrary(removeLogoFromLibrary(id));
  }
  function handleRemoveLogo() {
    placedLogoUrl.current = '';
    setLogoPreviewUrl('');
    const canvas = fabricRef.current;
    if (canvas) {
      ['logo_l', 'logo_r'].forEach(name => {
        canvas.getObjects().filter(o => o.name === name).forEach(o => canvas.remove(o));
      });
      canvas.renderAll();
    }
    triggerAutosaveRef.current();
  }

  // ── Image filter (brightness/contrast) ───────────────────────────────────
  // Edit Image's controls (crop/remove-bg/blur/brightness/contrast) used to
  // only work on whatever was already the active canvas selection, and the
  // panel hid all of them behind a "click a photo first" placeholder
  // whenever nothing was selected — awkward now that multiple photos can be
  // on the canvas at once (task: Canva-style multi-photo). This resolves a
  // sensible target automatically: the current selection if it's already an
  // image, otherwise the most recently placed selectable photo (deity_img /
  // full_frame_img — last in z-order = added most recently), selecting it
  // on the canvas so the resize/delete handles show what's about to be
  // edited. Returns null only when there's genuinely no photo anywhere on
  // the canvas yet.
  function getEditableImageObject() {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    const active = canvas.getActiveObject();
    if (active && active.type === 'image') return active;
    const images = canvas.getObjects().filter(o => o.type === 'image' && o.selectable);
    const fallback = images[images.length - 1] || null;
    if (fallback) { canvas.setActiveObject(fallback); canvas.renderAll(); }
    return fallback;
  }

  function applyFilter(type, val) {
    const obj = getEditableImageObject();
    if (!obj) { showToast('⚠ No photo on the canvas yet'); return; }
    obj.filters = obj.filters || [];
    const idx = obj.filters.findIndex(f => f.type === type);
    const filter = type === 'Brightness'
      ? new window.fabric.Image.filters.Brightness({ brightness: val / 100 })
      : new window.fabric.Image.filters.Contrast({ contrast: val / 100 });
    if (idx >= 0) obj.filters[idx] = filter; else obj.filters.push(filter);
    obj.applyFilters(); fabricRef.current.renderAll();
  };

  // ── Set image as full-canvas background ─────────────────────────────────────
  // Delegates the actual Fabric work to placeBackgroundTemplate (canvasBuilder.js,
  // imported as _placeBg) so the exact same logic can be re-run after a
  // rebuild via placedBgUrl.current — same ref-survives-rebuild pattern as
  // placedImgUrl/placedLogoUrl. That was the missing piece: layout switches,
  // spacing changes, and template applies all canvas.clear() and rebuild,
  // and 'bg_template' was never in any template's re-apply list, so the
  // background silently vanished on every one of those actions.
  function handleSetBackground(eOrNull) {
    const canvas = fabricRef.current; if (!canvas) return;
    function applyBg(url) {
      placedBgUrl.current = url;
      _placeBg({ canvas, url, dims: LAYOUTS[layout] });
      setHasBg(true);
      showToast('✓ Background applied!');
      triggerAutosaveRef.current();
    };
    if (eOrNull === null) {
      const obj = canvas.getActiveObject();
      if (!obj || obj.type !== 'image') { showToast('⚠ Select an image on the canvas first'); return; }
      const el = obj._element;
      if (el?.src) applyBg(el.src);
    } else if (typeof eOrNull === 'string') {
      // A Background Templates thumbnail (Pixabay URL or a generated solid-
      // color data URL) — applied directly, no file picker involved.
      applyBg(eOrNull);
    } else {
      const file = eOrNull.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => applyBg(ev.target.result);
      reader.readAsDataURL(file);
      eOrNull.target.value = '';
    }
  };
  // ── Remove background image (undo) ─────────────────────────────────────────
  function handleRemoveBgImage() {
    const canvas = fabricRef.current; if (!canvas) return;
    placedBgUrl.current = ''; // stop it from being re-applied after the next rebuild
    const existing = canvas.getObjects().find(o => o.name === 'bg_template');
    if (existing) {
      canvas.remove(existing);
      canvas.getObjects()
        .filter(o => ['bg', 'img_placeholder', 'img_hint'].includes(o.name))
        .forEach(o => o.set({ opacity: 1 }));
      canvas.renderAll(); setHasBg(false); showToast('✓ Background removed');
    }
    else showToast('No background set');
  };
  // ── Apply blur to selected image ─────────────────────────────────────────
  function applyBlur(val) {
    const obj = getEditableImageObject();
    if (!obj) { showToast('⚠ No photo on the canvas yet'); return; }
    obj.filters = obj.filters || [];
    const idx = obj.filters.findIndex(f => f.type === 'Blur');
    const filter = new window.fabric.Image.filters.Blur({ blur: val / 100 });
    if (idx >= 0) obj.filters[idx] = filter; else obj.filters.push(filter);
    obj.applyFilters(); fabricRef.current.renderAll();
  };
  // ── Crop selected image ───────────────────────────────────────────────────
  // aspectStr is null for the "Free" preset — resets back to the full
  // original photo (no crop) instead of doing nothing, which is what it
  // silently did before.
  function handleCrop(aspectStr) {
    const canvas = fabricRef.current;
    const obj = getEditableImageObject();
    if (!obj) { showToast('⚠ No photo on the canvas yet'); return; }
    // Always measure against the ORIGINAL, uncropped photo. obj.width/
    // height get overwritten to the CROPPED size by the .set() below, so
    // using them here on a second crop would compute the new crop out of
    // whatever was left over from the last one instead of the source
    // photo (reported as "crop doesn't start from the original image").
    // The underlying image element's natural size never changes, so it's
    // always the right reference — fall back to obj.width/height only if
    // it's somehow unavailable.
    const imgW = obj._element?.naturalWidth  || obj.width;
    const imgH = obj._element?.naturalHeight || obj.height;
    // How wide the photo currently appears ON THE CANVAS, before this crop.
    const currentDisplayW = obj.width * obj.scaleX;

    let cropX = 0, cropY = 0, cropW = imgW, cropH = imgH;
    if (aspectStr) {
      const [aw, ah] = aspectStr.split(':').map(Number);
      const targetRatio = aw / ah;
      const imgRatio = imgW / imgH;
      if (imgRatio > targetRatio) {
        cropW = imgH * targetRatio;
        cropX = (imgW - cropW) / 2;
      } else {
        cropH = imgW / targetRatio;
        cropY = (imgH - cropH) / 2;
      }
    }
    // Fabric's width/height on an Image describe the crop box in the
    // photo's own unscaled pixels — scaleX/scaleY are what turn that into
    // an on-canvas size. The old version set width/height WITHOUT touching
    // scale, so the photo would silently jump to a different on-canvas
    // size every time you cropped (shrinking a lot for a wide photo cropped
    // to 1:1, for example) — that jump, not the crop math itself, is what
    // "crop doesn't work well" was actually reporting. Recomputing a
    // uniform scale from the new crop box keeps the photo the same width
    // it was a moment ago; originX/originY being 'center' means it resizes
    // around its current center instead of jumping position too.
    const newScale = currentDisplayW / cropW;
    obj.set({ cropX, cropY, width: cropW, height: cropH, scaleX: newScale, scaleY: newScale });
    canvas.renderAll();
    showToast(aspectStr ? `✓ Cropped to ${aspectStr}` : '✓ Crop reset to original');
  };
  // ── Remove background via Remove.bg API ──────────────────────────────────
  const handleRemoveBgApi = async () => {
    const canvas = fabricRef.current;
    const obj = getEditableImageObject();
    if (!obj) { showToast('⚠ No photo on the canvas yet'); return; }
    setRemovingBg(true);
    try {
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width  = obj.width;
      tmpCanvas.height = obj.height;
      const ctx = tmpCanvas.getContext('2d');
      ctx.drawImage(obj._element, 0, 0);
      const blob = await new Promise(res => tmpCanvas.toBlob(res, 'image/png'));
      const formData = new FormData();
      formData.append('image_file', blob, 'image.png');
      const res = await fetch('/api/remove-bg', { method: 'POST', headers: { ...authHeaders() }, body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status}) — check REMOVE_BG_API_KEY in server .env`);
      }
      const data = await res.json();
      window.fabric.Image.fromURL(data.imageBase64, (newImg) => {
        newImg.set({
          scaleX: obj.scaleX, scaleY: obj.scaleY,
          left: obj.left, top: obj.top,
          originX: obj.originX, originY: obj.originY,
          name: obj.name, selectable: true,
        });
        canvas.remove(obj);
        canvas.add(newImg);
        canvas.setActiveObject(newImg);
        canvas.renderAll();
        showToast('✓ Background removed!');
      });
    } catch (err) {
      showToast('⚠ ' + err.message);
    } finally {
      setRemovingBg(false);
    }
  };
  // ── Sponsorship ───────────────────────────────────────────────────────────
  function applySponsorshipToCanvas(amount, name) {
    setSponsorship(amount);
    const canvas = fabricRef.current; if (!canvas) return;
    const existing = canvas.getObjects().find(o => o.name === 'sponsorship');
    const text = name ? `🙏 Sponsored by ${name} — ${amount}` : `🙏 Sponsorship: ${amount}`;
    if (amount) {
      if (existing) { existing.set('text', text); canvas.renderAll(); }
      else {
        canvas.add(new window.fabric.Textbox(text, {
          left: dims.w / 2, top: dims.h * 0.81, width: dims.w * 0.74, originX: 'center',
          textAlign: 'center', fontFamily: bodyFont, fontSize: Math.round(dims.w * 0.024),
          fill: t.title, fontWeight: 'bold', name: 'sponsorship', selectable: true,
        }));
        canvas.renderAll();
      }
    } else if (existing) { canvas.remove(existing); canvas.renderAll(); }
    triggerAutosaveRef.current();
  };

    // ── Translation ───────────────────────────────────────────────────────────
  const handleTranslate = async (langCode, silent = false) => {
    if (langCode === activeLang && !silent) return;
    const cv = fabricRef.current; if (!cv) return;
    if (!silent) { setTranslating(true); setActiveLang(langCode); }
    const fontMap = { hi: '"Noto Sans Devanagari"', ta: '"Noto Sans Tamil"', te: '"Noto Sans Telugu"', kn: '"Noto Sans Kannada"', en: null };
    const fontFamily = fontMap[langCode]; // null → keep the Design panel's heading/body font pairing
    const TEXT_FIELDS = ['event_title', 'event_date', 'event_time', 'event_desc', 'sponsorship'];

    const objs = cv.getObjects().filter(o => o.type === 'textbox' && (
      TEXT_FIELDS.includes(o.name) || (o.name && o.name.startsWith('custom_text_'))
    ));

    for (const obj of objs) {
      const original = obj._originalText || obj.text;
      obj._originalText = original;
      const translated = langCode === 'en' ? original : await translateText(original, langCode);
      const font = fontFamily || (HEADING_ROLE_NAMES.includes(obj.name) ? headingFont : bodyFont);
      obj.set({ text: translated, fontFamily: font });
    }
    const currentKey = cv._currentLayoutKey || layout;
    const currentMode = cv._currentLayoutMode || studioModeRef.current;
    layoutStates.current[`${currentMode}:${currentKey}`] = {
      json: cv.toJSON(FLYER_JSON_PROPS),
      imgUrl: placedImgUrl.current,
    };
    cv.discardActiveObject();
    cv.renderAll();
    if (!silent) setTranslating(false);
    triggerAutosaveRef.current();
  };

  // ── Save / Download ───────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const canvas = fabricRef.current;
      if (!canvas) { showToast('⚠ Save failed — canvas not ready yet'); return; } // used to return here totally silently
      canvas.discardActiveObject(); canvas.renderAll();
      await new Promise(r => setTimeout(r, 150));
      const thumbnail = canvas.toDataURL({ format: 'jpeg', quality: 0.35, multiplier: 0.25 });
      saveDraft({ id: draftId, title: flyerTitle || event?.title || 'Untitled Flyer', layout, theme, studioMode: studioModeRef.current, canvasJSON: JSON.stringify(canvas.toJSON(['name'])), thumbnail, savedAt: new Date().toISOString(), eventId: event?.id });
      showToast('✓ Draft saved locally!');
      setAutosaveMsg('Autosaved just now');
    } catch { showToast('⚠ Save failed'); } finally { setSaving(false); }
  };

  const handleSaveToS3 = async () => {
    setUploading(true);
    try {
      const canvas = fabricRef.current; if (!canvas) return;
      canvas.discardActiveObject(); canvas.renderAll();
      await new Promise(r => setTimeout(r, 200));
      const dataUrl  = canvas.toDataURL({ format: 'png', multiplier: 2 });
      const filename = `flyers/${draftId}_${(flyerTitle || event?.title || 'flyer').replace(/\s+/g, '_')}.png`;
      const result   = await uploadToS3(dataUrl, filename);
      const all = loadDrafts(); const d = all.find(x => x.id === draftId);
      if (d) { d.s3Url = result.url; saveDraft(d); }
      showToast('☁ Saved to cloud (S3)!');
    } catch { showToast('⚠ Cloud save failed — check server/S3 config'); } finally { setUploading(false); }
  };

  function handleLoadDraft(draft) {
    // Older drafts saved before studioMode was tracked fall back to
    // whatever mode is currently active rather than force-switching.
    const targetMode = draft.studioMode || studioModeRef.current;
    const targetLayout = draft.layout || 'square';
    // Drop any cached layout-state snapshot for the mode+layout we're about
    // to switch into. If setLayout() below actually changes `layout`, the
    // layout-switch effect fires and — before this fix — could find a
    // leftover snapshot cached under that same "mode:layout" key from an
    // earlier, unrelated edit and silently restore IT instead of (or racing
    // against) the draft.canvasJSON this function is about to load itself.
    // That's the same class of bug fixed in layoutStates above, just
    // reachable from History/Load instead of a plain layout change.
    delete layoutStates.current[`${targetMode}:${targetLayout}`];
    setLayout(targetLayout);
    setTheme(draft.theme || 'saffron');
    if (draft.studioMode) {
      setStudioMode(draft.studioMode);
      studioModeRef.current = draft.studioMode; // same sync-immediately need as handleChooseMode
    }
    setShowHistory(false);
    setTimeout(() => {
      try {
        const canvas = fabricRef.current; if (!canvas) return;
        canvas.loadFromJSON(JSON.parse(draft.canvasJSON), () => {
          canvas.renderAll();
          // saveDraft only ever serializes the canvas OBJECTS themselves
          // (canvas.toJSON below) — never placedLogoUrl/placedBgUrl/
          // placedImgUrl/logoScaleRef/placedFramedImgUrls or the hasBg/
          // logoPreviewUrl state. Every rebuild path (layout switch,
          // spacing change, template apply) AND every new AI generation
          // re-places the logo/background/photo from those refs, not from
          // whatever's currently drawn — so a loaded draft looked complete
          // right after loading (it's baked into the restored objects) but
          // silently lost its logo/background the moment anything rebuilt
          // the canvas or a new image was generated, since those refs were
          // still sitting at their untouched empty defaults. Re-derive them
          // from what the restored canvas actually contains, same "read the
          // real element's src" pattern already used in handleSetBackground.
          const objs = canvas.getObjects();
          const logo = objs.find(o => o.name === 'logo_l' || o.name === 'logo_r');
          if (logo?._element?.src) {
            placedLogoUrl.current = logo._element.src;
            setLogoPreviewUrl(logo._element.src);
            logoScaleRef.current = logo.scaleX || null;
          }
          const bgTemplate = objs.find(o => o.name === 'bg_template');
          if (bgTemplate?._element?.src) {
            placedBgUrl.current = bgTemplate._element.src;
            setHasBg(true);
          }
          const fullFrame = objs.find(o => o.name === 'full_frame_img');
          const framedImgs = objs.filter(o => o.name === 'deity_img').map(o => o._element?.src).filter(Boolean);
          if (fullFrame?._element?.src) {
            placedImgUrl.current = fullFrame._element.src;
          } else if (framedImgs.length) {
            placedImgUrl.current = framedImgs[framedImgs.length - 1];
            placedFramedImgUrls.current = framedImgs;
          }
        });
      } catch { showToast('⚠ Could not restore canvas'); }
    }, 450);
  };

  const handleDownload = async () => {
    const canvas = fabricRef.current; if (!canvas) return;
    setDownloading(true);
    canvas.discardActiveObject(); canvas.renderAll();
    await new Promise(r => setTimeout(r, 200));
    const url = canvas.toDataURL({ format: 'png', multiplier: 2 });
    const a = document.createElement('a'); a.href = url;
    a.download = `${(flyerTitle || event?.title || 'flyer').replace(/\s+/g, '_')}_flyer.png`; a.click();
    setDownloading(false);
    playComplete();
  };

  const handlePreview = () => {
    const canvas = fabricRef.current; if (!canvas) return;
    canvas.discardActiveObject(); canvas.renderAll();
    setPreviewUrl(canvas.toDataURL({ format: 'png', multiplier: 1.5 }));
    setShowPreview(true);
  };

  // ── File menu actions ───────────────────────────────────────────────────
  // "Create new design" equivalent — safe to do with no confirmation
  // because of the auto-resume fix above: the current draft is already
  // autosaving under its own draftId, so leaving it for a new one doesn't
  // lose anything — it just sits in History, resumable like any other.
  function handleNewFlyer() {
    setDraftId(`flyer_${Date.now()}`);
    setFlyerTitle('New Flyer');
    setLayout('portrait');
    setTheme('saffron');
    // Clear per-mode logo/background/photo refs so the new flyer doesn't
    // inherit whatever was on the one being left.
    logoByMode.current = { ai: '', diy: '' };
    bgByMode.current = { ai: '', diy: '' };
    logoScaleByMode.current = { ai: null, diy: null };
    setLogoPreviewByMode({ ai: '', diy: '' });
    setHasBgByMode({ ai: false, diy: false });
    placedImgUrl.current = '';
    placedFramedImgUrls.current = [];
    layoutStates.current = {};
    // Reopens the DIY/AI chooser — picking a mode there does the actual
    // canvas.clear() + fresh build via handleChooseMode.
    setShowModeChooser(true);
    showToast('🆕 New flyer — your previous one is saved in History');
  }
  // "Make a copy" — duplicates the CURRENT canvas into a brand-new draft
  // record, then switches this session onto editing that copy (so further
  // autosaves land on the copy, not the original), matching how Canva's
  // "Make a copy" opens the duplicate as the working file.
  async function handleMakeCopy() {
    const canvas = fabricRef.current;
    if (!canvas) { showToast('⚠ Cannot copy — canvas not ready yet'); return; }
    canvas.discardActiveObject(); canvas.renderAll();
    const newId = `flyer_${Date.now()}`;
    const copyTitle = `${flyerTitle || 'Untitled Flyer'} (copy)`;
    const thumbnail = canvas.toDataURL({ format: 'jpeg', quality: 0.35, multiplier: 0.25 });
    saveDraft({
      id: newId, title: copyTitle, layout, theme, studioMode: studioModeRef.current,
      canvasJSON: JSON.stringify(canvas.toJSON(['name'])), thumbnail,
      savedAt: new Date().toISOString(), eventId: event?.id,
    });
    setDraftId(newId);
    setFlyerTitle(copyTitle);
    showToast('✓ Copy created — now editing the copy');
  }
  // "Move to Trash" — deletes the CURRENT draft's saved record, then starts
  // a new blank one the same way handleNewFlyer does. Confirmed first since
  // this is one click on whatever's currently open, not a pick-from-a-list
  // action like History's own delete button.
  function handleMoveToTrash() {
    if (!window.confirm(`Move "${flyerTitle || 'this flyer'}" to trash? This can't be undone.`)) return;
    deleteDraftById(draftId);
    handleNewFlyer();
    showToast('🗑 Moved to trash');
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, ...HALO_BG, display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}>

        {/* AdminToolbar now renders unconditionally, ABOVE the mode-chooser
            check below — previously it sat after that block in the JSX but
            the chooser overlay used position:fixed + a higher z-index, so it
            painted over the toolbar regardless of DOM order (screenshots
            showed the "How do you want to create this flyer?" screen with no
            header/nav at all). Moving it here and dropping the chooser out of
            fixed/full-screen positioning (see below) means the toolbar is
            always visible and the chooser fills the flex space beneath it. */}
        <AdminToolbar
          activePage="flyer"
          showSubheader={false}
          onDashboard={onClose}
          onFlyer={() => {}}
          onBroadcast={() => closeThenGo('broadcast')}
          onSyncChatbot={() => closeThenGo('syncChatbot')}
          onAddEvent={() => closeThenGo('addEvent')}
          onHelp={() => closeThenGo('help')}
        />

        {/* ── DIY vs AI mode chooser — shown once when the editor opens.
            Not a one-way gate: the "↺ Restart" button in the icon rail
            re-opens this same chooser anytime, rebuilding the canvas fresh
            for whichever mode you pick. Restyled monochrome/Runway-style
            (plain white, black text, thin borders, no gradients or heavy
            shadow) to match the rest of the AI creation flow — see
            panels/runwayUI.js — instead of the earlier dark/gold-gradient
            look. Was position:fixed/inset:0 (covering the whole screen,
            AdminToolbar included); now top:58 instead of inset:0 so it only
            covers the area below the toolbar rendered just above, keeping
            the site header visible and navigable instead of being covered
            by this screen. ── */}
        {showModeChooser && (
          <div style={{
            position: 'fixed', top: 58, right: 0, bottom: 0, left: 0, zIndex: 10001,
            background: '#ffffff', overflowY: 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
            <div style={{ maxWidth: 780, width: '100%' }}>
              <div style={{ textAlign: 'center', color: '#111827', fontSize: '1.9rem', fontWeight: '800', marginBottom: 10, letterSpacing: '-0.01em', fontFamily: RUNWAY_FONT }}>
                How do you want to create this flyer?
              </div>
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem', marginBottom: 36, fontFamily: RUNWAY_FONT }}>
                Pick one to get started — hit "↺ Restart" anytime afterward to come back and choose again.
              </div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {[
                  {
                    mode: 'diy', icon: '🎨', title: 'Design it myself',
                    desc: 'Use your own photos — browse our curated library, search stock images, or upload your own. Add a logo, decorative graphics, and edit photos freely.',
                  },
                  {
                    mode: 'ai', icon: '✨', title: 'Let AI do it',
                    desc: 'Describe what you want, or ground it in your own reference photos, and AI generates the image for you.',
                  },
                ].map(card => (
                  <button key={card.mode} onClick={() => handleChooseMode(card.mode)} style={{
                    flex: '1 1 320px', textAlign: 'left', padding: '32px 30px', borderRadius: 16, cursor: 'pointer',
                    background: '#fff', border: '1.5px solid #e5e5e6',
                    boxShadow: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#111827'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e5e6'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ fontSize: '2.2rem', marginBottom: 14 }}>{card.icon}</div>
                    <div style={{ color: '#111827', fontWeight: '800', fontSize: '1.15rem', marginBottom: 8, fontFamily: RUNWAY_FONT }}>{card.title}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.82rem', lineHeight: 1.7, fontFamily: RUNWAY_FONT }}>{card.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TOP BAR (Flyer Studio's own) ═══ */}
        <div style={{ height: 56, background: '#fff', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: '800', fontSize: '0.95rem', color: COLORS.accent, flexShrink: 0 }}>
            🔶 CalendarFly
          </div>
          <div style={{ width: 1, height: 22, background: COLORS.border, margin: '0 4px', flexShrink: 0 }} />

          {editingTitle ? (
            <input
              autoFocus value={flyerTitle}
              onChange={e => setFlyerTitle(e.target.value)}
              onBlur={() => { setEditingTitle(false); triggerAutosaveRef.current(); }}
              onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
              style={{ fontSize: '0.9rem', fontWeight: '600', color: COLORS.text, border: `1px solid ${COLORS.accent}`, borderRadius: 6, padding: '4px 8px', maxWidth: 220 }}
            />
          ) : (
            <span onClick={() => setEditingTitle(true)} style={{ fontSize: '0.9rem', fontWeight: '600', color: COLORS.text, cursor: 'pointer', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title="Click to rename">
              {flyerTitle} <span style={{ opacity: 0.4 }}>✏️</span>
            </span>
          )}

          <span style={{ padding: '2px 9px', background: '#f3f4f6', color: COLORS.textMuted, borderRadius: 20, fontSize: '0.68rem', fontWeight: '700' }}>Draft</span>

          {/* Canva-style "File" menu — a direct request ("need like this in
              both modes"), shown a screenshot of Canva's own File menu.
              Built from what this app actually has rather than a literal
              copy of Canva's list — items like Accessibility/"Open in
              desktop app"/Print don't map to anything real here. Placed
              right next to the flyer name/title ("put file next to name",
              a direct follow-up request after it first shipped grouped
              with Preview/Share on the right) so it reads as acting on
              this document, the same way Canva's own File menu sits next
              to the design name rather than off in a button cluster.
              Renders in the shared toolbar above the mode-chooser check,
              so it's already in both AI and DIY with no extra wiring
              needed. */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setFileMenuOpen(o => !o)} style={{ padding: '5px 12px', background: '#fff', border: `1.5px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', flexShrink: 0 }}>
              File ▾
            </button>
            {fileMenuOpen && (
              <>
                <div onClick={() => setFileMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
                <div style={{ position: 'absolute', left: 0, top: 38, background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', width: 210, zIndex: 101, overflow: 'hidden' }}>
                  {[
                    { label: '🆕 New Flyer', fn: handleNewFlyer },
                    { label: '📋 Make a Copy', fn: handleMakeCopy },
                    { label: '✏️ Rename', fn: () => setEditingTitle(true) },
                    { label: saving ? '💾 Saving…' : '💾 Save', fn: handleSaveDraft },
                    { label: downloading ? '⬇ Downloading…' : '⬇ Download', fn: handleDownload },
                    { label: '🕐 Version History', fn: () => setShowHistory(true) },
                    { label: '🗑 Move to Trash', fn: handleMoveToTrash, danger: true },
                  ].map(item => (
                    <button key={item.label} onClick={() => { item.fn(); setFileMenuOpen(false); }} style={{
                      width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none',
                      borderBottom: `1px solid ${COLORS.border}`, color: item.danger ? COLORS.danger : COLORS.text,
                      fontSize: '0.8rem', cursor: 'pointer',
                    }}>{item.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Autosave status — only shown while there's actually something to
              report ("Saving…" / "Autosaved just now"). It used to render
              the ✅ emoji here even at idle (autosaveMsg === 'Draft'), which
              hid the text but left the bare checkmark floating alone in the
              top bar with nothing labeling it — a colorful emoji with no
              context reads as much bigger/more prominent than it should for
              a subtle status indicator. Swapped for the same plain "✓" used
              in toasts elsewhere, sized to match the surrounding text, and
              hidden entirely rather than shown label-less. */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {autosaveMsg !== 'Draft' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: COLORS.textFaint, fontSize: '0.75rem', lineHeight: 1 }}>
                <span style={{ fontSize: '0.75rem' }}>{autosaveMsg === 'Saving…' ? '⏳' : '✓'}</span>
                {autosaveMsg}
              </span>
            )}
          </div>

          <button onClick={handlePreview} style={{ padding: '7px 14px', background: '#fff', border: `1.5px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>Preview</button>

          <div style={{ position: 'relative' }}>
            {/* Glossy charcoal — matches the site-wide accent (COLORS.accent),
                plus the same white-highlight sheen used on the other
                primary buttons (Generate, PosterSpecWizard's answer bubbles). */}
            <button onClick={() => setShareOpen(o => !o)} style={{
              padding: '7px 16px',
              background: `linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDeep})`,
              border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 3px 10px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.22)',
            }}>
              Share &amp; Publish ▾
            </button>
            {shareOpen && (
              <>
                <div onClick={() => setShareOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 100 }} />
                <div style={{ position: 'absolute', right: 0, top: 42, background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.15)', width: 200, zIndex: 101, overflow: 'hidden' }}>
                  {[
                    { label: `🕐 History`, fn: () => setShowHistory(true) },
                    { label: saving ? '💾 Saving…' : '💾 Save Draft', fn: handleSaveDraft },
                    { label: uploading ? '☁ Uploading…' : '☁ Save to Cloud', fn: handleSaveToS3 },
                    { label: downloading ? '⬇ Downloading…' : '⬇ Download PNG', fn: handleDownload },
                    { label: '📣 Broadcast', fn: () => setShowBroadcast(true) },
                  ].map(item => (
                    <button key={item.label} onClick={() => { item.fn(); setShareOpen(false); }} style={{
                      width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none',
                      borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: '0.8rem', cursor: 'pointer',
                    }}>{item.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button onClick={onClose} style={{ width: 32, height: 32, background: '#fff', border: `1.5px solid ${COLORS.border}`, color: COLORS.textMuted, borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', bottom: 70, right: 24, zIndex: 999999, background: '#111827', color: toast.startsWith('⚠') ? '#fca5a5' : '#86efac', padding: '10px 20px', borderRadius: 10, fontSize: '0.85rem', fontWeight: '600', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            {toast}
          </div>
        )}

        {/* ═══ BODY ═══ */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left icon rail — dark, matches the app's toolbar instead of a
              plain white sidebar, with a strong gold highlight on the active
              panel so both the selection and the labels read clearly. */}
          <div style={{ width: 68, background: 'linear-gradient(180deg,#1c0f05,#170c04)', borderRight: '1px solid rgba(232,200,120,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 3, flexShrink: 0, overflowY: 'auto' }}>
            {/* Hide/show the 264px tools panel next to this rail — this
                rail itself (tabs + Restart) always stays put either way, so
                switching tools or bringing the panel back is never blocked
                by having hidden it. Picking a tab below also un-hides the
                panel automatically (see visiblePanels.map below), so a
                click there always shows something. */}
            <button onClick={() => setLeftPanelCollapsed(v => !v)} title={leftPanelCollapsed ? 'Show panel' : 'Hide panel'} style={{
              width: 56, padding: '7px 2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              border: 'none', borderRadius: 9, cursor: 'pointer', marginBottom: 8,
              background: 'rgba(232,200,120,0.14)', color: '#e8c878',
            }}>
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>{leftPanelCollapsed ? '»' : '«'}</span>
              <span style={{ fontSize: '0.56rem', fontWeight: '800', lineHeight: 1.1 }}>{leftPanelCollapsed ? 'Show' : 'Hide'}</span>
            </button>
            {/* Mode is locked once chosen — this re-opens the full-screen
                chooser instead of a quick toggle, so switching is always a
                deliberate choice, not an accidental tap. Re-picking starts
                over: the canvas rebuilds fresh for the new mode (blank for
                AI, the default template for DIY). Styled bright/oversized
                on purpose so it reads as a distinct, deliberate action, not
                just another rail tab. */}
            <button onClick={() => setShowExitConfirm(true)} title="Restart — choose DIY or AI again" style={{
              width: 56, padding: '10px 2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              border: 'none', borderRadius: 10, cursor: 'pointer', marginBottom: 10,
              background: 'linear-gradient(135deg,#fcd34d,#f59e0b)',
              boxShadow: '0 3px 14px rgba(245,158,11,0.65)',
              color: '#1a0e04',
            }}>
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>↺</span>
              <span style={{ fontSize: '0.64rem', fontWeight: '800', lineHeight: 1.1 }}>Restart</span>
            </button>
            {visiblePanels.map(p => (
              <button key={p.id} onClick={() => { setActivePanel(p.id); setLeftPanelCollapsed(false); }} title={p.label} style={{
                width: 56, padding: '8px 2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                border: 'none', borderRadius: 10, cursor: 'pointer',
                background: activePanel === p.id ? 'linear-gradient(135deg,#d9a847,#b17f26)' : 'transparent',
                color: activePanel === p.id ? '#1a0e04' : '#e8c878',
                boxShadow: activePanel === p.id ? '0 3px 10px rgba(201,148,58,0.45)' : 'none',
              }}>
                <span style={{ fontSize: '1.05rem' }}>{p.icon}</span>
                <span style={{ fontSize: '0.6rem', fontWeight: activePanel === p.id ? '800' : '600', lineHeight: 1.1, textAlign: 'center' }}>{p.label}</span>
              </button>
            ))}
          </div>

          {/* Left content panel — collapsed to zero width via CSS rather
              than unmounted (a prior version of this used
              `{!leftPanelCollapsed && (...)}`, which unmounted
              AIVisualPanel/PosterSpecWizard entirely: hiding the panel
              mid-wizard silently rewound the guided-conversation step
              counter and dropped the in-progress theme selection the next
              time the compiled prompt was rebuilt — found in review, not
              reported, but a real data-loss bug). The inner wrapper keeps
              its full 264px width so nothing inside has to re-measure or
              re-flow when it reappears; the outer div clips it to 0 and
              hides overflow instead. */}
          <div style={{
            width: leftPanelCollapsed ? 0 : 264,
            background: '#fff',
            borderRight: leftPanelCollapsed ? 'none' : `1px solid ${COLORS.border}`,
            overflowY: leftPanelCollapsed ? 'hidden' : 'auto',
            overflowX: 'hidden',
            flexShrink: 0,
          }}>
            <div style={{ width: 264, padding: '14px 16px' }}>

              {activePanel === 'event' && (
                <EventTextPanel
                  fabricRef={fabricRef}
                  activeLang={activeLang} translating={translating} onTranslate={handleTranslate}
                />
              )}

              {activePanel === 'ai' && (
                <AIVisualPanel
                  promptCategory={promptCategory}
                  posterMode={posterMode} setPosterMode={handleSetPosterMode}
                  posterFields={posterFields} setPosterFields={setPosterFields}
                  genPrompt={genPrompt} setGenPrompt={setGenPrompt}
                  posterSpec={posterSpec}
                  setPosterSpecField={setPosterSpecField}
                  referencePhotos={referencePhotos}
                  selectedReferencePhotoKeys={selectedReferencePhotoKeys}
                  setSelectedReferencePhotoKeys={setSelectedReferencePhotoKeys}
                  maxReferenceImages={MAX_REFERENCE_IMAGES}
                  onUploadReferencePhoto={handleUploadReferencePhoto}
                  onDeleteReferencePhoto={handleDeleteReferencePhoto}
                  loadingReferencePhotos={loadingReferencePhotos}
                  referencePhotosNeedsLogin={referencePhotosNeedsLogin}
                  onDescribeReferencePhoto={handleDescribeReferencePhoto}
                  describingReference={describingReference}
                  imageStyle={imageStyle} setImageStyle={handleSetImageStyle}
                  wizardControlRef={wizardRef}
                  onStepsChange={setWizardHistory}
                  showThemePicker={showThemePicker} setShowThemePicker={setShowThemePicker}
                />
              )}

              {activePanel === 'brand' && (
                <BrandEditPanel
                  layout={layout} setLayout={setLayout}
                  onUploadLogo={e => handleUpload(e, true)}
                  logoPreviewUrl={logoPreviewUrl}
                  onRemoveLogo={handleRemoveLogo}
                  logoLibrary={logoLibrary} onSelectLibraryLogo={handleSelectLibraryLogo} onRemoveLibraryLogo={handleRemoveLibraryLogo}
                  selectedObject={selectedObject}
                  applyFilter={applyFilter}
                  applyBlur={applyBlur}
                  handleCrop={handleCrop}
                  handleRemoveBgApi={handleRemoveBgApi}
                  removingBg={removingBg}
                  posterTitleText={posterTitleText}
                  posterMessageText={posterMessageText}
                  onPosterOverlayChange={handlePosterOverlayChange}
                  fabricRef={fabricRef}
                  onSetBackground={handleSetBackground} hasBg={hasBg} onRemoveBg={handleRemoveBgImage}
                  bgTemplateResults={imageLibrary.bgTemplateResults}
                  bgTemplateLoading={imageLibrary.bgTemplateLoading}
                  bgTemplateError={imageLibrary.bgTemplateError}
                  bgTemplateQuery={imageLibrary.bgTemplateQuery}
                  handleBgTemplateSearch={imageLibrary.handleBgTemplateSearch}
                />
              )}

              {activePanel === 'media' && (
                <MediaPanel
                  layout={layout} setLayout={setLayout}
                  imageTab={imageTab} setImageTab={setImageTab}
                  {...imageLibrary}
                  onPlaceImage={placeDeityImage}
                  onDragStart={(url) => { dragUrlRef.current = url; setIsDragging(true); }}
                  onDragEnd={() => { dragUrlRef.current = ''; setIsDragging(false); setIsDraggingOver(false); }}
                  onUpload={handleUpload} onSetBackground={handleSetBackground} hasBg={hasBg} onRemoveBg={handleRemoveBgImage}
                  onPlaceGraphic={handlePlaceGraphic}
                  onUploadLogo={e => handleUpload(e, true)}
                  logoPreviewUrl={logoPreviewUrl}
                  onRemoveLogo={handleRemoveLogo}
                  logoLibrary={logoLibrary} onSelectLibraryLogo={handleSelectLibraryLogo} onRemoveLibraryLogo={handleRemoveLibraryLogo}
                  selectedObject={selectedObject}
                  applyFilter={applyFilter}
                  applyBlur={applyBlur}
                  handleCrop={handleCrop}
                  handleRemoveBgApi={handleRemoveBgApi}
                  removingBg={removingBg}
                  posterTitleText={posterTitleText}
                  posterMessageText={posterMessageText}
                  onPosterOverlayChange={handlePosterOverlayChange}
                  fabricRef={fabricRef}
                  activeFlyerTemplateId={activeFlyerTemplate?.id}
                  onApplyFlyerTemplate={applyFlyerTemplate}
                  onPlaceArtwork={handlePlaceArtwork}
                  referencePhotos={referencePhotos}
                  onUploadReferencePhoto={handleUploadReferencePhoto}
                  onDeleteReferencePhoto={handleDeleteReferencePhoto}
                  loadingReferencePhotos={loadingReferencePhotos}
                  referencePhotosNeedsLogin={referencePhotosNeedsLogin}
                />
              )}
            </div>
          </div>

          {/* Canvas area */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', background: COLORS.canvasBg, position: 'relative' }}>

            {/* Prompt Dock — "What do you want to create?" now docks in a
                slim strip above the canvas (AI mode only) instead of a
                full-width bar pinned below it — a direct request, since the
                old bottom placement pushed it out of view under the fold. */}
            {studioMode === 'ai' && (
              <PromptDock
                genPrompt={genPrompt} setGenPrompt={setGenPrompt} promptCategory={promptCategory}
                onShowHelp={() => setShowHelpModal(true)}
                handleGenerate={handleGenerate} generating={generating} genSeconds={genSeconds} genError={genError}
                feedbackPending={feedbackPending} onSendFeedback={sendImageFeedback}
                onDismissFeedback={() => setFeedbackPending(false)}
              />
            )}

            {/* alignItems/justifyContent: 'center' here used to make the
                zoomed-in canvas effectively un-scrollable -- a flex
                container centers its content even once that content grows
                past the visible area, and most browsers then refuse to
                scroll into the "negative" space needed to reach the
                overflow. Net effect: zooming in to see something small (a
                just-uploaded logo, say) had no way to pan to it, so
                staying zoomed way out was the only option. margin: '0 auto'
                on the scaled child instead of center-aligning the parent
                keeps it horizontally centered and anchored to the top (so
                a tall layout scrolls down from a stable top edge instead of
                floating mid-viewport), and once it overflows the container
                naturally scrolls to every edge. */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', padding: 24, position: 'relative' }}>

            <div style={{ position: 'relative', margin: '0 auto', transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
              <div style={{
                boxShadow: isDraggingOver ? `0 0 0 3px ${COLORS.accent}, 0 20px 50px rgba(0,0,0,0.18)` : '0 20px 50px rgba(0,0,0,0.18)',
                borderRadius: 4, transition: 'box-shadow 0.15s',
              }}>
              <canvas ref={canvasRef} />
              </div>
              <div
                onDragOver={e => {
                  if (!dragUrlRef.current) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  setIsDraggingOver(true);
                }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingOver(false);
                  const url = dragUrlRef.current
                    || e.dataTransfer.getData('imageUrl')
                    || e.dataTransfer.getData('text/plain');
                  dragUrlRef.current = '';
                  if (url) placeDeityImage(url);
                }}
                style={{
                  position: 'absolute', inset: 0,
                  pointerEvents: isDragging ? 'all' : 'none',
                  background: isDraggingOver ? 'rgba(194,65,12,0.1)' : 'transparent',
                  borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                  zIndex: 10,
                }}
              >
                {isDraggingOver && (
                  <div style={{ color: 'white', fontSize: '1.1rem', fontWeight: '800', background: 'rgba(0,0,0,0.6)', padding: '12px 24px', borderRadius: 10 }}>
                    🖼 Drop image here
                  </div>
                )}
                </div>

              {/* Generating overlay — sits right on the poster itself
                  instead of relying on the small spinner/seconds in the
                  prompt dock, which was easy to miss and read as "Generate
                  doesn't work" when nothing seemed to happen. A classic
                  three-dot bounce, directly over the canvas. */}
              {generating && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 11, borderRadius: 4,
                  background: 'rgba(10,10,10,0.58)', backdropFilter: 'blur(2px)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
                }}>
                  <style>{`
                    @keyframes cfGenDotBounce { 0%, 80%, 100% { transform: scale(0.4); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
                    .cf-gen-dot { width: 22px; height: 22px; border-radius: 50%; background: #f3d98a; animation: cfGenDotBounce 1.1s infinite ease-in-out both; box-shadow: 0 2px 10px rgba(0,0,0,0.35); }
                  `}</style>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <span className="cf-gen-dot" style={{ animationDelay: '0s' }} />
                    <span className="cf-gen-dot" style={{ animationDelay: '0.15s' }} />
                    <span className="cf-gen-dot" style={{ animationDelay: '0.3s' }} />
                  </div>
                  <div style={{ color: '#fff', fontSize: '2.2rem', fontWeight: '800', letterSpacing: '0.01em', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                    {Math.min(Math.round((genSeconds / 60) * 100), 95)}%
                  </div>
                  <div style={{ color: '#f3d98a', fontSize: '1rem', fontWeight: '700', letterSpacing: '0.04em' }}>
                    Generating your poster…
                  </div>
                </div>
              )}
            </div>

            {/* Delete is now an integrated Canva-style "×" icon rendered right
                on the selected object's corner (see initDeleteControl in
                canvasBuilder.js) instead of a floating button fixed below
                the canvas — no separate UI needed here anymore. */}

            {/* Floating undo/redo/zoom toolbar — pinned to the bottom of
                THIS canvas viewport specifically (its containing block is
                the scrollable centering wrapper right above, not the whole
                editor column), so it always floats just under the poster
                regardless of the Design bar's height below. */}
            <div style={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 4, background: '#fff',
              border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '6px 8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 12,
            }}>
              <button onClick={handleUndo} disabled={!canUndo} title="Undo" style={{ width: 30, height: 30, background: 'none', border: 'none', borderRadius: 6, cursor: canUndo ? 'pointer' : 'default', color: canUndo ? COLORS.text : COLORS.textFaint, fontSize: '1rem' }}>↶</button>
              <button onClick={handleRedo} disabled={!canRedo} title="Redo" style={{ width: 30, height: 30, background: 'none', border: 'none', borderRadius: 6, cursor: canRedo ? 'pointer' : 'default', color: canRedo ? COLORS.text : COLORS.textFaint, fontSize: '1rem' }}>↷</button>
              <div style={{ width: 1, height: 20, background: COLORS.border, margin: '0 4px' }} />
              <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.2))} style={{ background: 'none', border: 'none', color: COLORS.text, cursor: 'pointer', fontSize: '1.05rem', padding: '0 6px' }}>−</button>
              <span style={{ color: COLORS.textMuted, fontSize: '0.78rem', minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(z + 0.1, 1.5))} style={{ background: 'none', border: 'none', color: COLORS.text, cursor: 'pointer', fontSize: '1.05rem', padding: '0 6px' }}>+</button>
              <div style={{ width: 1, height: 20, background: COLORS.border, margin: '0 4px' }} />
              <button onClick={toggleFullscreen} title="Fullscreen" style={{ width: 30, height: 30, background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', color: COLORS.text, fontSize: '0.95rem' }}>{isFullscreen ? '⤡' : '⤢'}</button>
            </div>
            </div>

            {/* Answered-so-far timeline strip — "Tight" placement, snug
                directly beneath the poster (chosen over pinning it above
                the canvas, per the Timeline Strip Placement preview). Reads
                as a caption belonging to THIS poster rather than a
                step-navigator for the whole editor. Tapping a chip jumps
                PosterSpecWizard straight to that question — see wizardRef /
                pendingWizardStepRef above.
                Auto-collapses (along with the tip box below) while an image
                is generating or the just-finished feedback prompt is up —
                per a direct report that the two of them piling up under the
                canvas at exactly that moment left too little room to see
                the result. Same `generating`/`feedbackPending` signal
                PromptDock.jsx already uses to minimize itself. */}
            {studioMode === 'ai' && wizardHistory.items.length > 0 && !generating && !feedbackPending && (
              <div style={{
                flexShrink: 0, background: 'linear-gradient(155deg, #f1f0ee, #dcdad5)',
                borderTop: '1px solid rgba(90,84,74,0.22)', padding: '9px 16px 10px',
              }}>
                <div
                  onClick={() => setAnsweredBarCollapsed(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
                    fontSize: '0.6rem', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: '#7c5e1f', marginBottom: answeredBarCollapsed ? 0 : 6,
                  }}
                >
                  <span>Answered so far — tap to revisit</span>
                  <span title={answeredBarCollapsed ? 'Show' : 'Minimize'} style={{ fontSize: '0.8rem', flexShrink: 0 }}>
                    {answeredBarCollapsed ? '▾' : '▴'}
                  </span>
                </div>
                {!answeredBarCollapsed && (
                <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2 }}>
                  {wizardHistory.items.filter(it => it.index !== wizardHistory.active).map(it => (
                    <button
                      key={it.index}
                      onClick={() => {
                        // Un-collapse the left panel too — without this, a
                        // tap here while the panel was hidden looked like
                        // it did nothing (goToStep still ran now that the
                        // panel stays mounted when hidden, but there was
                        // nothing visible to jump to).
                        setLeftPanelCollapsed(false);
                        if (activePanel !== 'ai') { pendingWizardStepRef.current = it.index; setActivePanel('ai'); }
                        else wizardRef.current?.goToStep(it.index);
                      }}
                      style={{
                        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, background: '#fff',
                        border: '1px solid rgba(90,84,74,0.25)', borderRadius: 20, padding: '4px 10px 4px 5px',
                        whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(145deg,#c9a44e,#7c5e1f)' }} />
                      <span style={{ fontSize: '0.56rem', color: '#6e6a63' }}>{it.label}</span>
                      <span style={{ fontSize: '0.6rem', fontWeight: '700', color: '#232220' }}>{it.answerLabel || '—'}</span>
                    </button>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* AI disclaimer — used to sit at the bottom of the AI Visual
                left-rail panel (already a long, scrolling panel); moved
                here below the canvas instead, per a direct request, so it
                reads as a note about the whole flyer rather than one more
                thing stacked in the rail.
                Same auto-collapse as the answered-so-far strip above —
                hidden during generation and while the feedback prompt is
                showing, so the canvas gets the room right when there's
                actually something new to look at. */}
            {studioMode === 'ai' && !generating && !feedbackPending && (
              <div style={{ flexShrink: 0, margin: '0 16px 14px', padding: '8px 10px', background: COLORS.accentSoft, border: `1px solid ${COLORS.accent}33`, borderRadius: 7, fontSize: '0.72rem', color: COLORS.accent, lineHeight: 1.6 }}>
                {promptCategory === 'temple'
                  ? '💡 AI works best for deity images. Ground it in your own photos using Reference Photos below the wizard. Need to crop, remove a background, or adjust a photo? Click it on the canvas — it opens in the Finishing Touches tab.'
                  : '💡 AI works best for community/celebration scenes. Ground it in your own photos using Reference Photos below the wizard. Need to crop, remove a background, or adjust a photo? Click it on the canvas — it opens in the Finishing Touches tab.'}
              </div>
            )}
          </div>

          {/* Reference Photos used to have its own right-side column here —
              moved into AIVisualPanel.jsx, directly below the wizard, per a
              direct request ("add reference photo section below let's
              build together"). The canvas above gets that width back. */}
        </div>
      </div>

      {/* "Use your library photos as reference?" — used to render as a small
          inline box at the bottom of the AI Visual rail (AIVisualPanel.jsx),
          easy to miss since Generate itself lives in PromptDock, docked
          above the canvas, a totally different part of the screen. Root
          cause of "I click Generate and nothing happens" whenever the org
          has reference photos and none are explicitly selected yet:
          handleGenerate() below stops short of actually generating and
          waits right here — but "right here" was invisible unless you
          happened to be scrolled to that exact spot on the AI Visual tab.
          A real modal now, so it can't be missed regardless of which tab
          or scroll position you're on when Generate is clicked. */}
      {referencePromptPending && (
        <div onClick={handleReferenceNo} style={{
          position: 'fixed', inset: 0, zIndex: 10002, background: 'rgba(0,0,0,0.72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#ffffff', borderRadius: 16, padding: '20px 22px', maxWidth: 420, width: '100%',
            boxShadow: '0 24px 60px rgba(0,0,0,0.35)', border: '1.5px solid #e5e0d5',
          }}>
            <div style={{ color: '#0a0a0a', fontSize: '1rem', fontWeight: '800', marginBottom: 6 }}>
              Use your reference photos?
            </div>
            <div style={{ color: '#57534e', fontSize: '0.82rem', lineHeight: 1.55, marginBottom: 16 }}>
              Your library has {referencePhotos.length} photo{referencePhotos.length === 1 ? '' : 's'} — use {referencePhotos.length === 1 ? 'it' : 'up to ' + Math.min(referencePhotos.length, MAX_REFERENCE_IMAGES)} as a visual reference for this generation, or generate freely without them?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleReferenceNo} style={{
                flex: 1, padding: '10px', fontSize: '0.8rem', fontWeight: '700',
                border: '1.5px solid #d6d0c4', borderRadius: 9, background: '#fff', color: '#1c1917', cursor: 'pointer',
              }}>Generate freely</button>
              <button onClick={handleReferenceYes} style={{
                flex: 1, padding: '10px', fontSize: '0.8rem', fontWeight: '700', color: '#fff',
                border: 'none', borderRadius: 9, cursor: 'pointer',
                background: 'linear-gradient(135deg, #c9a44e, #7c5e1f)',
                boxShadow: '0 3px 10px -4px rgba(124,94,31,0.5)',
              }}>✓ Use library photos</button>
            </div>
          </div>
        </div>
      )}

      {/* Restart (leaving DIY mode / AI mode) confirmation — a direct
          request so switching modes is never a silent discard. Backdrop
          click / the implicit "close" only cancels (keeps editing); the two
          real choices are explicit buttons. Works the same both directions
          since AI→DIY and DIY→AI both go through this one Restart button. */}
      {showExitConfirm && (
        <div onClick={() => setShowExitConfirm(false)} style={{
          position: 'fixed', inset: 0, zIndex: 10003, background: 'rgba(0,0,0,0.72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#ffffff', borderRadius: 16, padding: '20px 22px', maxWidth: 420, width: '100%',
            boxShadow: '0 24px 60px rgba(0,0,0,0.35)', border: '1.5px solid #e5e0d5',
          }}>
            <div style={{ color: '#0a0a0a', fontSize: '1rem', fontWeight: '800', marginBottom: 6 }}>
              Save your work before restarting?
            </div>
            <div style={{ color: '#57534e', fontSize: '0.82rem', lineHeight: 1.55, marginBottom: 14 }}>
              Restarting picks a mode (DIY or AI) again and rebuilds the canvas fresh — whatever's on it now will be replaced.
            </div>

            {/* Was easy to misread as "this only saves the logo" — the logo
                box below is the ONLY thing visible in the modal besides the
                buttons, with nothing saying the whole flyer is saved too
                (it always has been, via handleSaveDraft — see the Save &
                Restart button below). Made explicit here as a direct fix
                for that confusion, clearly separated from the logo extra. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9 }}>
              <span style={{ fontSize: '0.9rem' }}>✓</span>
              <div style={{ fontSize: '0.76rem', color: '#166534', fontWeight: '600', lineHeight: 1.4 }}>
                "Save & Restart" saves your whole flyer — canvas, text, photos, logo, background — as a draft you can reopen later.
              </div>
            </div>

            {/* Name-and-save-the-logo — a direct request: saving now ALSO
                offers to keep the current logo in a small separate reusable
                library, so it can be picked again later in EITHER mode
                instead of re-uploading the file from disk every time. This
                is an extra on top of the whole-flyer save above, not a
                replacement for it — only shown when there's a logo to save. */}
            {logoPreviewUrl && (
              <div style={{ marginBottom: 16, padding: '10px 12px', background: '#faf7f0', border: '1px solid #e5e0d5', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <img src={logoPreviewUrl} alt="Current logo" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6, border: '1px solid #e5e0d5', background: '#fff' }} />
                  <div style={{ fontSize: '0.76rem', fontWeight: '700', color: '#1c1917' }}>Also save this logo separately for reuse?</div>
                </div>
                <input value={saveLogoName} onChange={e => setSaveLogoName(e.target.value)}
                  placeholder="Name it, e.g. Temple Logo"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1.5px solid #e5e0d5', borderRadius: 7, fontSize: '0.78rem', outline: 'none' }} />
                <div style={{ color: '#a8956e', fontSize: '0.68rem', marginTop: 4 }}>
                  Optional — leave blank to skip. This just makes the logo pickable from a library in both AI and DIY mode, on top of the whole-flyer save above.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <button disabled={saving} onClick={async () => {
                if (logoPreviewUrl && saveLogoName.trim()) {
                  const entry = await saveLogoToLibrary(saveLogoName, logoPreviewUrl);
                  if (entry) {
                    setLogoLibrary(prev => [entry, ...prev].slice(0, 12));
                    setSaveLogoName('');
                  } else {
                    showToast('⚠ Could not save logo to library (storage full) — continuing anyway');
                  }
                }
                try {
                  await handleSaveDraft();
                } catch (e) {
                  console.error('[Save & Restart] draft save failed, restarting anyway', e);
                  showToast('⚠ Draft save failed — restarting anyway');
                }
                setShowExitConfirm(false);
                setShowModeChooser(true);
              }} style={{
                flex: 1, padding: '10px', fontSize: '0.8rem', fontWeight: '700', color: '#fff',
                border: 'none', borderRadius: 9, cursor: saving ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg, #c9a44e, #7c5e1f)',
                boxShadow: '0 3px 10px -4px rgba(124,94,31,0.5)', opacity: saving ? 0.7 : 1,
              }}>{saving ? '💾 Saving…' : '💾 Save & Restart'}</button>
              <button onClick={() => { setShowExitConfirm(false); setShowModeChooser(true); }} style={{
                flex: 1, padding: '10px', fontSize: '0.8rem', fontWeight: '700',
                border: '1.5px solid #d6d0c4', borderRadius: 9, background: '#fff', color: '#1c1917', cursor: 'pointer',
              }}>🗑 Discard & Restart</button>
            </div>
            <button onClick={() => setShowExitConfirm(false)} style={{
              width: '100%', padding: '8px', fontSize: '0.76rem', fontWeight: '600',
              border: 'none', background: 'none', color: '#a8956e', cursor: 'pointer',
            }}>Cancel — keep editing</button>
          </div>
        </div>
      )}

      {/* Preview lightbox */}
      {showPreview && (
        <div onClick={() => setShowPreview(false)} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
          <button onClick={() => setShowPreview(false)} style={{ position: 'absolute', top: 24, right: 24, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Modals */}
      {showHistory && <HistoryPanel onLoad={handleLoadDraft} onClose={() => setShowHistory(false)} />}
      {showBroadcast && (
        <BroadcastModal
          onClose={() => setShowBroadcast(false)}
          fabricRef={fabricRef}
          event={event}
        />
      )}
      {showHelpModal && (
        <PromptHelpModal
          onClose={() => setShowHelpModal(false)}
          promptCategory={promptCategory}
          onUsePrompt={(text) => { setGenPrompt(text); setShowHelpModal(false); showToast('✓ Prompt loaded — review it below, then Generate'); }}
        />
      )}
    </>
  );
}
