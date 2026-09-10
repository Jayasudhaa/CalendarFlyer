// ─── Canvas Builder ───────────────────────────────────────────────────────────
// Pure functions for building and updating the Fabric.js canvas.
// Kept separate from React state so they're easy to test and modify.

import { TEMPLE_NAME, TEMPLE_ADDR, TEMPLE_INFO, APP_DOMAIN } from './constants';

// ── Load Google Fonts for Indian script support ───────────────────────────────
const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Sans+Tamil:wght@400;700&family=Noto+Sans+Telugu:wght@400;700&family=Noto+Sans+Kannada:wght@400;700&display=swap';

const loadedLangs = new Set(['en']);
export async function loadFlyerFonts(lang = 'en') {
  // For English, no special font needed

  if (lang === 'en' || loadedLangs.has(lang)) return;

  // Step 1: Inject Google Fonts CSS link
  if (!document.getElementById('flyer-google-fonts')) {
  const link = document.createElement('link');
    link.id   = 'flyer-google-fonts';
  link.rel  = 'stylesheet';
    link.href = FONT_CSS_URL;
  document.head.appendChild(link);
    await new Promise(r => setTimeout(r, 100));
    }
  const fontName = getFontForLang(lang);
  const probe = document.createElement('div');
  probe.style.cssText = [
    `font-family: '${fontName}', monospace`,
    'font-weight: 700',
    'font-size: 72px',
    'position: absolute',
    'left: -9999px',
    'top: -9999px',
    'visibility: hidden',
    'pointer-events: none',
  ].join(';');
  const sampleText = {
    hi: 'घटना का शीर्षक नमस्ते',
    ta: 'நிகழ்வுத் தலைப்பு வணக்கம்',
    te: 'ఈవెంట్ శీర్షిక నమస్కారం',
    kn: 'ಕಾರ್ಯಕ್ರಮದ ಶೀರ್ಷಿಕೆ ನಮಸ್ಕಾರ',
  };
  probe.textContent = sampleText[lang] || 'test';
  document.body.appendChild(probe);
  try {
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 600));
  } catch(e) {
    await new Promise(r => setTimeout(r, 1000));
  }
  document.body.removeChild(probe);
  loadedLangs.add(lang);
}
export function getFontForLang(lang = 'en') {
  const map = {
    hi: 'Noto Sans Devanagari',
    ta: 'Noto Sans Tamil',
    te: 'Noto Sans Telugu',
    kn: 'Noto Sans Kannada',
    en: 'Playfair Display',
  };
  return map[lang] || 'Playfair Display';
}

// ── Load an arbitrary Google Font by family name (Design panel → Text) ────
// Fire-and-forget: injects a stylesheet link once per family and waits
// briefly for it to become available so the very first render picks it up.
const loadedGoogleFonts = new Set();
export async function loadGoogleFont(family) {
  if (!family || family === 'Georgia' || family === 'serif' || loadedGoogleFonts.has(family)) return;
  loadedGoogleFonts.add(family);
  const id = `google-font-${family.replace(/\s+/g, '-')}`;
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
  }
  try {
    await document.fonts.load(`700 32px "${family}"`);
    await document.fonts.ready;
  } catch (e) { /* best effort — canvas will just fall back until it's ready */ }
}

// ── Design panel → Layout → Show Grid / Show Safe Zone overlays ───────────
// Non-selectable guide objects, always kept on top, removed/re-added rather
// than toggled so they never get accidentally serialized into a saved draft
// in a stale state.
export function setGridOverlay(canvas, dims, visible) {
  if (!canvas) return;
  canvas.getObjects().filter(o => o.name === 'grid_overlay').forEach(o => canvas.remove(o));
  if (!visible) { canvas.renderAll(); return; }
  const { w, h } = dims;
  const lines = [];
  const cols = 6, rows = 6;
  for (let i = 1; i < cols; i++) {
    lines.push(new window.fabric.Line([w * (i / cols), 0, w * (i / cols), h], {
      stroke: 'rgba(37,99,235,0.35)', strokeWidth: 1, selectable: false, evented: false,
    }));
  }
  for (let i = 1; i < rows; i++) {
    lines.push(new window.fabric.Line([0, h * (i / rows), w, h * (i / rows)], {
      stroke: 'rgba(37,99,235,0.35)', strokeWidth: 1, selectable: false, evented: false,
    }));
  }
  const group = new window.fabric.Group(lines, { name: 'grid_overlay', selectable: false, evented: false });
  canvas.add(group);
  canvas.bringToFront(group);
  canvas.renderAll();
}
export function setSafeZoneOverlay(canvas, dims, visible) {
  if (!canvas) return;
  canvas.getObjects().filter(o => o.name === 'safe_zone_overlay').forEach(o => canvas.remove(o));
  if (!visible) { canvas.renderAll(); return; }
  const { w, h } = dims;
  const margin = Math.round(Math.min(w, h) * 0.06);
  const rect = new window.fabric.Rect({
    left: margin, top: margin, width: w - margin * 2, height: h - margin * 2,
    fill: 'transparent', stroke: '#ef4444', strokeDashArray: [8, 6], strokeWidth: 2,
    selectable: false, evented: false, name: 'safe_zone_overlay',
  });
  canvas.add(rect);
  canvas.bringToFront(rect);
  canvas.renderAll();
}

/**
 * Draws the full flyer layout onto a Fabric.js canvas.
 * Called whenever layout, theme, or template changes.
 *
 * headingFont/bodyFont: optional Google Font family names (Design panel →
 * Text → Heading/Body Font pairing) — applied to the title/name-role and
 * date/time/desc-role text objects respectively. Falls back to the
 * language-appropriate script font when not provided (or when the active
 * language isn't English, since Indian-script fonts always take priority
 * for legibility).
 * spacing: density multiplier (Design panel → Layout → Spacing) applied to
 * the vertical gaps between sections — 0.85 (Compact) to 1.2 (Spacious).
 */
export const buildFlyer = ({ canvas, dims, theme: t, event, onSelectionChange, lang = 'en', headingFont, bodyFont, spacing = 1, category }) => {
  const { w, h } = dims;
  const cx = w / 2;
  const F  = getFontForLang(lang); // font family for translated text
  const FE = "'Playfair Display', Georgia, serif";     // always English for temple name/address
  const isEnglish = lang === 'en';
  const HF = (isEnglish && headingFont) ? headingFont : F; // heading-role font
  const BF = (isEnglish && bodyFont) ? bodyFont : F;        // body-role font
  const S  = spacing || 1;

  // Defensive: buildFlyer() should always start from a clean slate. If it's
  // ever called twice on the same canvas without a canvas.clear() in
  // between (this has happened — see the hasBuiltRef guard in index.jsx),
  // strip any objects it previously added first so we never end up with
  // duplicate 'bg' rects or duplicate text stacked on top of each other.
  const TEMPLATE_NAMES = [
    'bg', 'om_symbol', 'temple_name', 'temple_addr', 'temple_info',
    'img_placeholder', 'img_corner_bracket', 'img_hint',
    'event_title', 'event_subtitle', 'event_date', 'event_time', 'event_desc',
    'rsvp_link', 'footer_bg', 'website',
  ];
  canvas.getObjects().filter(o => TEMPLATE_NAMES.includes(o.name)).forEach(o => canvas.remove(o));

  // ── Borders ───────────────────────────────────────────────────────────────
  canvas.add(new window.fabric.Rect({
    left: 0, top: 0, width: w, height: h,
    fill: '#1a0800', selectable: false, evented: false, name: 'bg',
  }));
  canvas.add(new window.fabric.Rect({
    left: 0, top: 0, width: w, height: Math.round(h * 0.008),
    fill: '#f0c050', selectable: false, evented: false,
  }));

  // ── Header ────────────────────────────────────────────────────────────────
  canvas.add(new window.fabric.Rect({
    left: 14, top: 14, width: w - 28, height: h - 28,
    fill: 'transparent', stroke: '#c8860a', strokeWidth: 1,
    opacity: 0.45, selectable: false, evented: false,
  }));
  // The Om symbol is a Hindu temple motif — only draw it for temple-type
  // orgs. Community/nonprofit orgs got this by default (buildFlyer is the
  // 'traditional' template and was used regardless of org category), which
  // showed a religious symbol with no relevance to their event.
  if (category !== 'community') {
    const omY = Math.round(h * 0.072);
    canvas.add(new window.fabric.Circle({
      left: cx, top: omY, radius: Math.round(w * 0.042),
      originX: 'center', originY: 'center',
      fill: '#2a1000', stroke: '#f0c050', strokeWidth: 1.5,
      opacity: 0.85, selectable: false, evented: false,
    }));
    canvas.add(new window.fabric.Textbox('ॐ', {
      left: cx, top: omY, width: Math.round(w * 0.12), originX: 'center', originY: 'center',
      textAlign: 'center', fontFamily: 'Playfair Display', fontSize: Math.round(w * 0.042),
      fill: '#f0c050', name: 'om_symbol', selectable: false, evented: false,
    }));
  }
  canvas.add(new window.fabric.Textbox(TEMPLE_NAME, {
    left: cx, top: h * 0.135, width: w * 0.82, originX: 'center',
    textAlign: 'center', fontFamily: HF, fontSize: Math.round(w * 0.031),
    fill: '#f0c050', fontWeight: 'bold', charSpacing: 60,
    name: 'temple_name', selectable: true, lineHeight: 1.2,
  }));
  canvas.add(new window.fabric.Line([w * 0.15, h * 0.195, w * 0.85, h * 0.195], {
    stroke: '#c8860a', strokeWidth: 1, opacity: 0.7,
    selectable: false, evented: false,
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_ADDR, {
    left: cx, top: h * 0.205, width: w * 0.78, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.018),
    fill: '#d4a84b', charSpacing: 20,
    name: 'temple_addr', selectable: true,
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_INFO, {
    left: cx, top: h * 0.233, width: w * 0.88, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.013),
    fill: 'rgba(212,168,75,0.65)', name: 'temple_info', selectable: true,
  }));

  canvas.add(new window.fabric.Line([w * 0.3, h * 0.262, w * 0.7, h * 0.262], {
    stroke: '#c8860a', strokeWidth: 0.5, opacity: 0.4,
    selectable: false, evented: false,
  }));
  const imgTop = h * 0.285;
  const imgH   = h * 0.365;
  const imgW   = w * 0.86;
  canvas.add(new window.fabric.Rect({
    left: cx, top: imgTop + imgH / 2, width: imgW, height: imgH,
    originX: 'center', originY: 'center',
    fill: '#2a1000', stroke: '#c8860a', strokeWidth: 1,
    rx: 6, ry: 6, opacity: 0.9,
    // evented (but not selectable) so clicking it can jump the user
    // straight to AI Visual — see the canvas 'mouse:down' handler in
    // index.jsx's canvas-init effect.
    name: 'img_placeholder', selectable: false, evented: true, hoverCursor: 'pointer',
  }));
  const bx = cx - imgW / 2, by = imgTop, bx2 = cx + imgW / 2, by2 = imgTop + imgH;
  const bl = Math.round(w * 0.035);
  [
    [bx + 4, by + 4, bx + 4 + bl, by + 4, bx + 4, by + 4 + bl],
    [bx2 - 4, by + 4, bx2 - 4 - bl, by + 4, bx2 - 4, by + 4 + bl],
    [bx + 4, by2 - 4, bx + 4 + bl, by2 - 4, bx + 4, by2 - 4 - bl],
    [bx2 - 4, by2 - 4, bx2 - 4 - bl, by2 - 4, bx2 - 4, by2 - 4 - bl],
  ].forEach(([x1, y1, x2, y2, x3, y3]) => {
    canvas.add(new window.fabric.Polyline([{x:x1,y:y1},{x:x2,y:y2},{x:x1,y:y1},{x:x3,y:y3}], {
      stroke: '#f0c050', strokeWidth: 1.5, fill: 'transparent', opacity: 0.7,
      selectable: false, evented: false, name: 'img_corner_bracket',
    }));
  });
  canvas.add(new window.fabric.Textbox('🙏\nClick here to add a photo', {
    left: cx, top: imgTop + imgH / 2, width: w * 0.5,
    originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: 'Playfair Display', fontSize: Math.round(w * 0.022),
    fill: 'rgba(212,168,75,0.5)', lineHeight: 1.6,
    name: 'img_hint', selectable: false, evented: true, hoverCursor: 'pointer',
  }));
  const afterImg = imgTop + imgH + h * 0.018 * S;
  canvas.add(new window.fabric.Line([w * 0.15, afterImg, w * 0.85, afterImg], {
    stroke: '#c8860a', strokeWidth: 1, opacity: 0.65,
    selectable: false, evented: false,
  }));
  // ── Event Title ───────────────────────────────────────────────────────────
  const titleTop = afterImg + h * 0.012 * S;
  canvas.add(new window.fabric.Textbox((event?.title || 'EVENT TITLE').toUpperCase(), {
    left: cx, top: titleTop, width: w * 0.88, originX: 'center',
    textAlign: 'center', fontFamily: HF, fontSize: Math.round(w * 0.056),
    fill: '#ffffff', fontWeight: 'bold', charSpacing: 40,
    name: 'event_title', selectable: true, lineHeight: 1.15,
  }));

  canvas.add(new window.fabric.Textbox('CELEBRATION', {
    left: cx, top: titleTop + Math.round(w * 0.072), width: w * 0.6, originX: 'center',
    textAlign: 'center', fontFamily: HF, fontSize: Math.round(w * 0.018),
    fill: '#d4a84b', charSpacing: 120,
    name: 'event_subtitle', selectable: true,
  }));
  // ── Divider ───────────────────────────────────────────────────────────────
  const divY2 = titleTop + Math.round(w * 0.072) + h * 0.038 * S;
  canvas.add(new window.fabric.Line([w * 0.25, divY2, w * 0.75, divY2], {
    stroke: '#c8860a', strokeWidth: 0.5, opacity: 0.5,
    selectable: false, evented: false,
  }));

  // ── Date & Time ───────────────────────────────────────────────────────────
  const dateStr = event?.date
    ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : 'Date To Be Announced';
  const dateTop = divY2 + h * 0.018 * S;
  canvas.add(new window.fabric.Textbox(dateStr, {
    left: cx, top: dateTop, width: w * 0.85, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.030),
    fill: '#f0c050', charSpacing: 30,
    name: 'event_date', selectable: true,
  }));
  // Always create event_time/event_desc, even with no text yet — previously
  // these were skipped entirely when the source event had no time/
  // description, which meant the Event tab's Time/Description fields (and
  // double-click-to-edit) had no canvas object to write into and silently
  // did nothing. Empty Textboxes render invisibly until filled in.
  canvas.add(new window.fabric.Textbox(event?.time || '', {
    left: cx, top: dateTop + h * 0.046 * S, width: w * 0.6, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.022),
    fill: '#d4a84b', charSpacing: 60, fontStyle: 'italic',
    name: 'event_time', selectable: true,
  }));

  // ── Image Placeholder ─────────────────────────────────────────────────────
  const dotY = dateTop + h * 0.085 * S;

  // ── Description ───────────────────────────────────────────────────────────
  // Brighter/warmer fill than the old flat '#c8a060' (better contrast on the
  // dark card), a touch of letter-spacing to match the polish already used
  // on temple_addr/event_date, and italic to read as an invitation line
  // rather than plain body copy — matches event_time's italic treatment.
  // Still fully overridable per-field from the Event & Text panel.
  canvas.add(new window.fabric.Textbox(event?.description || '', {
    left: cx, top: dotY + h * 0.022 * S, width: w * 0.82, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.0215),
    fill: '#e8caa0', charSpacing: 15, fontStyle: 'italic',
    name: 'event_desc', selectable: true, lineHeight: 1.55,
  }));

  const rsvpTop = h * 0.895;
  const rsvpH   = Math.round(h * 0.052);
  canvas.add(new window.fabric.Rect({
    left: cx, top: rsvpTop, width: w * 0.58, height: rsvpH,
    originX: 'center', originY: 'center',
    fill: 'transparent', stroke: '#f0c050', strokeWidth: 1,
    rx: rsvpH / 2, ry: rsvpH / 2, opacity: 0.45,
    selectable: false, evented: false,
  }));
  const dateSlug = event?.date || '';
  const titleSlug = (event?.title || 'event').toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
  const rsvpUrl = event?.date
    ? `${APP_DOMAIN}/rsvp/${dateSlug}-${titleSlug}`
    : `${APP_DOMAIN}/calendar`;
  canvas.add(new window.fabric.Textbox(`RSVP: ${rsvpUrl}`, {
    left: cx, top: rsvpTop, width: w * 0.56, originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.016),
    fill: '#f0c050', charSpacing: 20,
    name: 'rsvp_link', selectable: true,
  }));
  // ── Footer ────────────────────────────────────────────────────────────────
  canvas.add(new window.fabric.Rect({
    left: 0, top: h * 0.927, width: w, height: h * 0.073,
    fill: '#120600', selectable: false, evented: false, name: 'footer_bg',
  }));
  canvas.add(new window.fabric.Textbox('www.example.org', {
    left: cx, top: h * 0.954, width: w * 0.7, originX: 'center',
    textAlign: 'center', fontFamily: 'Playfair Display', fontSize: Math.round(w * 0.024),
    fill: '#f0c050', fontWeight: 'bold', charSpacing: 30,
    name: 'website', selectable: true,
  }));
  canvas.add(new window.fabric.Rect({
    left: 0, top: h - Math.round(h * 0.008), width: w, height: Math.round(h * 0.008),
    fill: '#f0c050', selectable: false, evented: false,
  }));

  canvas.renderAll();
  canvas.discardActiveObject();
  canvas.renderAll();

  // ── Selection tracking ────────────────────────────────────────────────────
  if (onSelectionChange) {
    canvas.on('selection:created', (e) => onSelectionChange(e.selected?.[0] || null));
    canvas.on('selection:updated', (e) => onSelectionChange(e.selected?.[0] || null));
    canvas.on('selection:cleared',  ()  => onSelectionChange(null));
  }
};

// Named objects every template must produce so downstream logic (theme
// recoloring, translation, AI Poster mode hide/show, image placement) works
// no matter which template built the canvas.
const _bindSelection = (canvas, onSelectionChange) => {
  if (!onSelectionChange) return;
  canvas.on('selection:created', (e) => onSelectionChange(e.selected?.[0] || null));
  canvas.on('selection:updated', (e) => onSelectionChange(e.selected?.[0] || null));
  canvas.on('selection:cleared',  ()  => onSelectionChange(null));
};

/**
 * "Modern" template — clean light-card layout: full-width rounded photo up
 * top, bold sans headline below, colored accent bar, simple footer. Uses
 * the same named objects as buildFlyer() so theme/translate/poster-mode
 * logic all keep working regardless of which template is active.
 */
export const buildModernFlyer = ({ canvas, dims, theme: t, event, onSelectionChange, lang = 'en', headingFont, bodyFont, spacing = 1 }) => {
  const { w, h } = dims;
  const cx = w / 2;
  const F  = getFontForLang(lang);
  const isEnglish = lang === 'en';
  const HF = (isEnglish && headingFont) ? headingFont : F;
  const BF = (isEnglish && bodyFont) ? bodyFont : F;
  const S  = spacing || 1;

  const TEMPLATE_NAMES = [
    'bg', 'om_symbol', 'temple_name', 'temple_addr', 'temple_info',
    'img_placeholder', 'img_corner_bracket', 'img_hint',
    'event_title', 'event_subtitle', 'event_date', 'event_time', 'event_desc',
    'rsvp_link', 'footer_bg', 'website',
  ];
  canvas.getObjects().filter(o => TEMPLATE_NAMES.includes(o.name)).forEach(o => canvas.remove(o));

  canvas.add(new window.fabric.Rect({
    left: 0, top: 0, width: w, height: h,
    fill: t.bg, selectable: false, evented: false, name: 'bg',
  }));
  // Accent bar top
  canvas.add(new window.fabric.Rect({
    left: 0, top: 0, width: w, height: Math.round(h * 0.012),
    fill: t.header, selectable: false, evented: false,
  }));
  // Small org name, top-left aligned rather than centered/ornate
  canvas.add(new window.fabric.Textbox(TEMPLE_NAME, {
    left: w * 0.06, top: h * 0.035, width: w * 0.6, originX: 'left',
    textAlign: 'left', fontFamily: BF, fontSize: Math.round(w * 0.02),
    fill: t.text, fontWeight: '600', charSpacing: 20,
    name: 'temple_name', selectable: true,
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_ADDR, {
    left: w * 0.06, top: h * 0.062, width: w * 0.6, originX: 'left',
    textAlign: 'left', fontFamily: BF, fontSize: Math.round(w * 0.013),
    fill: t.text, opacity: 0.6,
    name: 'temple_addr', selectable: true,
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_INFO, {
    left: w * 0.06, top: h * 0.082, width: w * 0.88, originX: 'left',
    textAlign: 'left', fontFamily: BF, fontSize: Math.round(w * 0.01),
    fill: t.text, opacity: 0.45,
    name: 'temple_info', selectable: true,
  }));
  // Rounded full-width photo card
  const imgTop = h * 0.13, imgH = h * 0.42, imgW = w * 0.88;
  canvas.add(new window.fabric.Rect({
    left: cx, top: imgTop + imgH / 2, width: imgW, height: imgH,
    originX: 'center', originY: 'center',
    fill: t.accent, rx: 18, ry: 18,
    // evented (but not selectable) so clicking it jumps to AI Visual —
    // see the canvas 'mouse:down' handler in index.jsx.
    name: 'img_placeholder', selectable: false, evented: true, hoverCursor: 'pointer',
  }));
  canvas.add(new window.fabric.Textbox('🖼\nClick here to add a photo', {
    left: cx, top: imgTop + imgH / 2, width: w * 0.5,
    originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.022),
    fill: t.text, opacity: 0.4, lineHeight: 1.6,
    name: 'img_hint', selectable: false, evented: true, hoverCursor: 'pointer',
  }));
  const afterImg = imgTop + imgH + h * 0.045 * S;
  canvas.add(new window.fabric.Textbox((event?.title || 'EVENT TITLE'), {
    left: cx, top: afterImg, width: w * 0.86, originX: 'center',
    textAlign: 'center', fontFamily: HF, fontSize: Math.round(w * 0.062),
    fill: t.title, fontWeight: '800',
    name: 'event_title', selectable: true, lineHeight: 1.1,
  }));
  const dateStr = event?.date
    ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'Date To Be Announced';
  const dateTop = afterImg + w * 0.09 * S;
  canvas.add(new window.fabric.Rect({
    left: cx, top: dateTop, width: w * 0.5, height: h * 0.045,
    originX: 'center', originY: 'center', rx: h * 0.022, ry: h * 0.022,
    fill: t.header, opacity: 0.15, selectable: false, evented: false,
  }));
  canvas.add(new window.fabric.Textbox(dateStr, {
    left: cx, top: dateTop, width: w * 0.48, originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.024),
    fill: t.date, fontWeight: '700',
    name: 'event_date', selectable: true,
  }));
  // Always created, even with no text yet — see the comment in buildFlyer()
  // above; otherwise the Event tab's Time/Description fields have no canvas
  // object to write into when the source event had neither set.
  canvas.add(new window.fabric.Textbox(event?.time || '', {
    left: cx, top: dateTop + h * 0.05 * S, width: w * 0.5, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.02),
    fill: t.date, name: 'event_time', selectable: true,
  }));
  canvas.add(new window.fabric.Textbox(event?.description || '', {
    left: cx, top: dateTop + h * 0.11 * S, width: w * 0.8, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.019),
    fill: t.text, opacity: 0.8, name: 'event_desc', selectable: true, lineHeight: 1.5,
  }));
  const dateSlug = event?.date || '';
  const titleSlug = (event?.title || 'event').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
  const rsvpUrl = event?.date ? `${APP_DOMAIN}/rsvp/${dateSlug}-${titleSlug}` : `${APP_DOMAIN}/calendar`;
  canvas.add(new window.fabric.Textbox(`RSVP: ${rsvpUrl}`, {
    left: cx, top: h * 0.9, width: w * 0.7, originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.015),
    fill: t.header, fontWeight: '600', name: 'rsvp_link', selectable: true,
  }));
  canvas.add(new window.fabric.Rect({
    left: 0, top: h * 0.955, width: w, height: h * 0.045,
    fill: t.header, selectable: false, evented: false, name: 'footer_bg',
  }));
  canvas.add(new window.fabric.Textbox('www.example.org', {
    left: cx, top: h * 0.977, width: w * 0.7, originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.016),
    fill: '#ffffff', fontWeight: '600', name: 'website', selectable: true,
  }));

  canvas.renderAll();
  canvas.discardActiveObject();
  canvas.renderAll();
  _bindSelection(canvas, onSelectionChange);
};

/**
 * "Minimal" template — understated, text-first, generous whitespace. Small
 * centered photo, thin dividers, no ornamentation. Same named objects as
 * the other templates.
 */
export const buildMinimalFlyer = ({ canvas, dims, theme: t, event, onSelectionChange, lang = 'en', headingFont, bodyFont, spacing = 1 }) => {
  const { w, h } = dims;
  const cx = w / 2;
  const F  = getFontForLang(lang);
  const isEnglish = lang === 'en';
  const HF = (isEnglish && headingFont) ? headingFont : F;
  const BF = (isEnglish && bodyFont) ? bodyFont : F;
  const S  = spacing || 1;

  const TEMPLATE_NAMES = [
    'bg', 'om_symbol', 'temple_name', 'temple_addr', 'temple_info',
    'img_placeholder', 'img_corner_bracket', 'img_hint',
    'event_title', 'event_subtitle', 'event_date', 'event_time', 'event_desc',
    'rsvp_link', 'footer_bg', 'website',
  ];
  canvas.getObjects().filter(o => TEMPLATE_NAMES.includes(o.name)).forEach(o => canvas.remove(o));

  canvas.add(new window.fabric.Rect({
    left: 0, top: 0, width: w, height: h,
    fill: t.bg, selectable: false, evented: false, name: 'bg',
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_NAME, {
    left: cx, top: h * 0.08, width: w * 0.8, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.017),
    fill: t.text, opacity: 0.55, charSpacing: 80,
    name: 'temple_name', selectable: true,
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_ADDR, {
    left: cx, top: h * 0.105, width: w * 0.7, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.012),
    fill: t.text, opacity: 0.4,
    name: 'temple_addr', selectable: true,
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_INFO, {
    left: cx, top: h * 0.125, width: w * 0.7, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.01),
    fill: t.text, opacity: 0.3,
    name: 'temple_info', selectable: true,
  }));
  const imgTop = h * 0.19, imgH = h * 0.32, imgW = w * 0.55;
  canvas.add(new window.fabric.Rect({
    left: cx, top: imgTop + imgH / 2, width: imgW, height: imgH,
    originX: 'center', originY: 'center', fill: t.accent,
    // evented (but not selectable) so clicking it jumps to AI Visual —
    // see the canvas 'mouse:down' handler in index.jsx.
    name: 'img_placeholder', selectable: false, evented: true, hoverCursor: 'pointer',
  }));
  canvas.add(new window.fabric.Textbox('Click here to add a photo', {
    left: cx, top: imgTop + imgH / 2, width: w * 0.4,
    originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.018),
    fill: t.text, opacity: 0.4,
    name: 'img_hint', selectable: false, evented: true, hoverCursor: 'pointer',
  }));
  const afterImg = imgTop + imgH + h * 0.06 * S;
  canvas.add(new window.fabric.Line([w * 0.4, afterImg, w * 0.6, afterImg], {
    stroke: t.border, strokeWidth: 1, selectable: false, evented: false,
  }));
  const titleTop = afterImg + h * 0.03 * S;
  canvas.add(new window.fabric.Textbox((event?.title || 'EVENT TITLE'), {
    left: cx, top: titleTop, width: w * 0.7, originX: 'center',
    textAlign: 'center', fontFamily: HF, fontSize: Math.round(w * 0.048),
    fill: t.title, fontWeight: '600',
    name: 'event_title', selectable: true, lineHeight: 1.2,
  }));
  const dateStr = event?.date
    ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : 'Date To Be Announced';
  const dateTop = titleTop + h * 0.075 * S;
  canvas.add(new window.fabric.Textbox(dateStr, {
    left: cx, top: dateTop, width: w * 0.6, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.02),
    fill: t.date, name: 'event_date', selectable: true,
  }));
  // Always created, even with no text yet — see the comment in buildFlyer()
  // above; otherwise the Event tab's Time/Description fields have no canvas
  // object to write into when the source event had neither set.
  canvas.add(new window.fabric.Textbox(event?.time || '', {
    left: cx, top: dateTop + h * 0.035 * S, width: w * 0.5, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.017),
    fill: t.date, opacity: 0.75, name: 'event_time', selectable: true,
  }));
  canvas.add(new window.fabric.Textbox(event?.description || '', {
    left: cx, top: dateTop + h * 0.075 * S, width: w * 0.66, originX: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.016),
    fill: t.text, opacity: 0.65, name: 'event_desc', selectable: true, lineHeight: 1.5,
  }));
  const dateSlug = event?.date || '';
  const titleSlug = (event?.title || 'event').toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
  const rsvpUrl = event?.date ? `${APP_DOMAIN}/rsvp/${dateSlug}-${titleSlug}` : `${APP_DOMAIN}/calendar`;
  canvas.add(new window.fabric.Textbox(`RSVP: ${rsvpUrl}`, {
    left: cx, top: h * 0.94, width: w * 0.7, originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.013),
    fill: t.text, opacity: 0.5, name: 'rsvp_link', selectable: true,
  }));
  canvas.add(new window.fabric.Textbox('www.example.org', {
    left: cx, top: h * 0.97, width: w * 0.6, originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: BF, fontSize: Math.round(w * 0.013),
    fill: t.text, opacity: 0.35, name: 'website', selectable: true,
  }));

  canvas.renderAll();
  canvas.discardActiveObject();
  canvas.renderAll();
  _bindSelection(canvas, onSelectionChange);
};

// Lookup used by index.jsx's applyTemplate() to select the right builder
// by TEMPLATES[].builder key from constants.js.
export const TEMPLATE_BUILDERS = {
  traditional: buildFlyer,
  modern: buildModernFlyer,
  minimal: buildMinimalFlyer,
};

/**
 * Places a deity/event image onto the canvas, removing the empty-state
 * placeholder if it's still showing.
 *
 * Canva-style multi-photo: this ADDS the new photo alongside any existing
 * ones — it used to remove any prior 'deity_img' first, which meant picking
 * a deity image and then a stock image (or vice versa) silently discarded
 * whichever was placed first. Every call now leaves earlier photos in
 * place; the caller (placeDeityImage in index.jsx) tracks all the URLs so
 * they can be re-applied after a canvas rebuild. A small cascading offset,
 * based on how many photos are already on the canvas, keeps a newly-added
 * photo from landing exactly on top of an existing one — same idea as a
 * paste-cascade in any other design app — so it's obviously a second photo
 * to drag into place rather than a no-op.
 */
export const placeDeityImage = ({ canvas, url, dims }) => {
  if (!canvas || !url) return;

  // Only remove the inert empty-state placeholder — NOT any existing
  // 'deity_img' (see above).
  ['img_placeholder', 'img_hint'].forEach(name => {
    const obj = canvas.getObjects().find(o => o.name === name);
    if (obj) canvas.remove(obj);
  });

  const existingCount = canvas.getObjects().filter(o => o.name === 'deity_img').length;
  const offset = Math.min(existingCount, 6) * 22; // cap so it can't cascade off-canvas

  const loadUrl = url.startsWith('data:')
    ? url
    : `/api/image-proxy?url=${encodeURIComponent(url)}`;

  window.fabric.Image.fromURL(
    loadUrl,
    (img) => {
    if (!img || !img.width) {
      console.error('[placeDeityImage] failed to load:', loadUrl);
      return;
    }
    const scale = Math.min((dims.w * 0.64) / img.width, (dims.h * 0.35) / img.height);
    img.set({
      scaleX: scale, scaleY: scale,
      left: dims.w / 2 + offset, top: dims.h * 0.52 + offset,
      originX: 'center', originY: 'center',
      name: 'deity_img', selectable: true,
      evented: true,
    });
    canvas.add(img);
      canvas.setActiveObject(img);
      // In case a Full Frame image was placed earlier and hidden the card's
      // background rect (see placeImageFullFrame below), restore it now
      // that we're back to a framed/boxed photo. Uses ALL objects named
      // 'bg' (not just the first) in case a stray duplicate ever exists.
      canvas.getObjects().filter(o => o.name === 'bg').forEach(bg => bg.set({ opacity: 1 }));
    canvas.renderAll();
    },
    { crossOrigin: 'anonymous' }
  );
};

/**
 * Places an image as a full-bleed background covering the entire canvas
 * (cropped to fill, like CSS background-size: cover).
 *
 * Rather than trying to position the photo at a precise index "just behind"
 * the other canvas objects (fragile — one misplaced object anywhere in the
 * stack can hide the whole photo), this sends the photo all the way to the
 * back AND makes the opaque template background rect fully transparent.
 * That guarantees nothing can ever sit in front of it and hide it, no
 * matter what else is on the canvas or in what order.
 */
export const placeImageFullFrame = ({ canvas, url, dims }) => {
  if (!canvas || !url) return;

  // 'bg_template' is included here because a user-uploaded background image
  // (set via handleSetBackground) is also sent to the back of the canvas —
  // without removing it, generating a full AI poster would just push it up
  // one z-order slot instead of clearing it, leaving the old opaque
  // background covering the newly-generated poster.
  ['img_placeholder', 'img_hint', 'img_corner_bracket', 'deity_img', 'full_frame_img', 'full_frame_scrim', 'bg_template']
    .forEach(name => {
      canvas.getObjects().filter(o => o.name === name).forEach(o => canvas.remove(o));
    });

  const isDataUrl = url.startsWith('data:');
  const loadUrl = isDataUrl ? url : `/api/image-proxy?url=${encodeURIComponent(url)}`;

  window.fabric.Image.fromURL(
    loadUrl,
    (img) => {
      if (!img || !img.width) {
        console.error('[placeImageFullFrame] failed to load:', loadUrl);
        return;
      }
      // Cover-fit: scale so the image fills the whole canvas, cropping overflow.
      const scale = Math.max(dims.w / img.width, dims.h / img.height);
      img.set({
        scaleX: scale, scaleY: scale,
        left: dims.w / 2, top: dims.h / 2,
        originX: 'center', originY: 'center',
        name: 'full_frame_img', selectable: true, evented: true,
      });

      // Slight darkening so light-colored text stays legible over busy
      // photo areas. Only attempted for same-origin data: URLs (AI Poster
      // mode) — reading pixel data for a cross-origin/proxied photo can
      // throw, and it's not worth risking the image for a nice-to-have.
      if (isDataUrl) {
        try {
          img.filters = img.filters || [];
          img.filters.push(new window.fabric.Image.filters.Brightness({ brightness: -0.18 }));
          img.applyFilters();
        } catch (e) { /* filter unsupported — image still shows, just a bit brighter */ }
      }

      canvas.add(img);
      canvas.sendToBack(img);

      // Neutralize EVERY object named 'bg' (not just the first match) —
      // if the canvas was ever built twice (e.g. a mount-time race), a
      // stray duplicate opaque 'bg' Rect could otherwise still be sitting
      // above the photo, invisible to a single-object opacity fix.
      canvas.getObjects().filter(o => o.name === 'bg').forEach(bg => bg.set({ opacity: 0 }));

      canvas.setActiveObject(img);
      canvas.renderAll();
    },
    { crossOrigin: 'anonymous' }
  );
};

/**
 * Places an org logo in both top corners of the flyer (small, non-intrusive
 * brand mark). Shared between the AI Visual panel's upload handler and every
 * canvas-rebuild path (layout switch, spacing change, template switch) —
 * those rebuilds call canvas.clear() and only re-placed the deity/background
 * photo, so a previously-uploaded logo silently disappeared the moment the
 * user changed spacing, switched templates, or picked a different canvas
 * size. Re-calling this after every rebuild (same pattern as
 * placeDeityImage/placeImageFullFrame + placedImgUrl.current) keeps the logo
 * present until the user removes it.
 */
// Was 60, then 100 — see the comment inside placeLogo() below for why a
// real-world upload needs more room than a pre-cropped square logo does.
// 150 reads clearly at every canvas size in LAYOUTS (constants.js: 1080-
// 1350px wide) without crowding the header text next to it.
const LOGO_BOX = 150;
const LOGO_MARGIN = 14;

export const placeLogo = ({ canvas, url, dims, scale: customScale }) => {
  // These early-returns used to be completely silent — "Logo uploaded"
  // could show in the rail (that state is set independent of whether this
  // function ever actually draws anything) while nothing appeared on the
  // canvas and nothing said why. Logged now so a report like that is a
  // 10-second console check instead of a guessing game.
  if (!canvas) { console.error('[placeLogo] no canvas — logo state was set but there is nothing to draw on yet'); return; }
  if (!url) { console.error('[placeLogo] no url — placedLogoUrl was empty when this ran'); return; }
  if (!dims) { console.error('[placeLogo] no dims — logo_r would have crashed on dims.w, bailing instead'); return; }

  ['logo_l', 'logo_r'].forEach(name => {
    canvas.getObjects().filter(o => o.name === name).forEach(o => canvas.remove(o));
  });

  // Load the logo independently for each corner rather than loading once
  // and cloning via fabric.util.object.clone() — that's a generic shallow
  // object-copy utility, not a proper Fabric object clone, and sharing
  // internal state (_element, filters, cache canvas) between two objects
  // placed at different spots is a plausible source of the logo
  // occasionally rendering at the wrong size after a fresh image
  // placement. Two independent loads cost a little more but guarantee
  // logo_l and logo_r can never interfere with each other's scale.
  const place = (name, left) => {
    window.fabric.Image.fromURL(url, (img) => {
      if (!img || !img.width) {
        console.error('[placeLogo] failed to load logo image');
        return;
      }
      // If the caller passed the user's own previously-set scale (they
      // dragged the logo bigger/smaller on the canvas), keep it — every
      // re-placement used to silently reset to this default box, wiping
      // out a manual resize the moment a new photo was placed.
      // lockUniScaling keeps future manual resizes proportional so this
      // single scale value always describes both dimensions.
      //
      // LOGO_BOX was 60px, sized for a pre-cropped square logo. Real
      // uploads are usually a full-resolution phone photo/export (seen
      // live at ~1400px+ wide) — at 60px that scales to ~0.04, a few
      // pixels across once placed on a flyer with 20+ other elements, and
      // reads as "the upload did nothing" even though it placed
      // correctly (confirmed via this exact console.log — see below).
      // 100px keeps the same corner-badge treatment but stays visible at
      // realistic upload sizes.
      const scale = customScale || Math.min(LOGO_BOX / img.width, LOGO_BOX / img.height);
      img.set({ scaleX: scale, scaleY: scale, left, top: 8, name, lockUniScaling: true });
      canvas.add(img);
      canvas.renderAll();
      console.log(`[placeLogo] placed ${name} at (${left}, 8), scale ${scale.toFixed(3)} — canvas now has ${canvas.getObjects().length} objects`);
    }, { crossOrigin: 'anonymous' });
  };

  place('logo_l', LOGO_MARGIN);
  place('logo_r', dims.w - LOGO_MARGIN - LOGO_BOX);
};

/**
 * Uploads a full-canvas background image (Media → Background upload, or the
 * "Or Upload Your Own" shortcut in AI mode) — separate from placeDeityImage/
 * placeImageFullFrame's subject photo. Neutralizes the template's own 'bg'
 * rect and the 'img_placeholder'/'img_hint' empty-state so the uploaded
 * image is actually visible instead of hidden behind them.
 *
 * Extracted out of index.jsx's handleSetBackground so it can be re-called
 * after a canvas rebuild, the same way placeLogo/placeDeityImage already
 * are. Like the logo and photo, this object is NOT included in any
 * template's TEMPLATE_NAMES removal list, so a canvas.clear() (layout
 * switch, spacing change, template apply) wipes it out — the caller must
 * track the URL (a placedBgUrl ref, mirroring placedImgUrl/placedLogoUrl)
 * and re-call this after every rebuild, or the background silently
 * disappears the moment the canvas size or spacing changes.
 */
export const placeBackgroundTemplate = ({ canvas, url, dims }) => {
  // Same silent-failure risk as placeLogo — "Background image set" is a
  // React state flag set independently of whether this ever actually draws
  // anything, so a swallowed early-return here used to look identical to
  // success from the rail's point of view.
  if (!canvas) { console.error('[placeBackgroundTemplate] no canvas — background state was set but there is nothing to draw on yet'); return; }
  if (!url) { console.error('[placeBackgroundTemplate] no url — placedBgUrl was empty when this ran'); return; }
  if (!dims) { console.error('[placeBackgroundTemplate] no dims'); return; }
  const existing = canvas.getObjects().find(o => o.name === 'bg_template');
  if (existing) canvas.remove(existing);
  window.fabric.Image.fromURL(url, (img) => {
    if (!img || !img.width) { console.error('[placeBackgroundTemplate] failed to load — image element had no width (broken/undecodable source)', url?.slice(0, 60)); return; }
    img.set({
      scaleX: dims.w / img.width, scaleY: dims.h / img.height,
      left: 0, top: 0, originX: 'left', originY: 'top',
      name: 'bg_template', selectable: false, evented: false,
    });
    canvas.add(img);
    canvas.sendToBack(img);
    canvas.getObjects()
      .filter(o => ['bg', 'img_placeholder', 'img_hint'].includes(o.name))
      .forEach(o => o.set({ opacity: 0 }));
    canvas.renderAll();
    console.log(`[placeBackgroundTemplate] placed at scale (${(dims.w / img.width).toFixed(3)}, ${(dims.h / img.height).toFixed(3)}) — canvas now has ${canvas.getObjects().length} objects`);
  }, { crossOrigin: 'anonymous' });
};

/**
 * Adds/updates/removes the movable Title and Message text overlays used on
 * a Full Frame image (most useful with AI Poster mode, where the built-in
 * template text fields are hidden). Passing an empty string removes that
 * text object; passing text creates it if missing or just updates it in
 * place if it already exists and has been repositioned by the user.
 */
export const setPosterOverlayText = ({ canvas, dims, title, message }) => {
  if (!canvas) return;

  const upsert = (name, text, defaults) => {
    const existing = canvas.getObjects().find(o => o.name === name);
    if (!text || !text.trim()) {
      if (existing) canvas.remove(existing);
      return;
    }
    if (existing) {
      existing.set({ text });
    } else {
      canvas.add(new window.fabric.Textbox(text, { name, ...defaults }));
    }
  };

  upsert('poster_title_text', title, {
    left: dims.w / 2, top: dims.h * 0.08, width: dims.w * 0.86,
    originX: 'center', textAlign: 'center', fontFamily: 'Playfair Display',
    fontSize: Math.round(dims.w * 0.06), fontWeight: 'bold',
    fill: '#ffffff', shadow: 'rgba(0,0,0,0.65) 0px 2px 8px',
    selectable: true, evented: true,
  });
  upsert('poster_message_text', message, {
    left: dims.w / 2, top: dims.h * 0.80, width: dims.w * 0.8,
    originX: 'center', textAlign: 'center', fontFamily: 'Playfair Display',
    fontSize: Math.round(dims.w * 0.03),
    fill: '#ffffff', shadow: 'rgba(0,0,0,0.65) 0px 1px 5px',
    selectable: true, evented: true, lineHeight: 1.35,
  });

  canvas.renderAll();
};

/**
 * Places a decorative graphic (border, flower, flags, rangoli, …) from the
 * Media → Graphics tab — parses raw SVG markup into Fabric objects, groups
 * them into one movable/resizable/deletable object, and drops it centered
 * at a sensible default size. Clicking a graphic again adds another copy —
 * Fabric objects don't collide, so layering a few (e.g. flags along the
 * top, a border around the edge) is the expected way to use this, same as
 * a sticker/clip-art tool in any other design app.
 */
export const placeGraphic = ({ canvas, svg, dims }) => {
  if (!canvas || !svg || !window.fabric?.loadSVGFromString) return;
  window.fabric.loadSVGFromString(svg, (objects, options) => {
    const group = window.fabric.util.groupSVGElements(objects, options);
    const targetW = dims.w * 0.24;
    const scale = group.width ? targetW / group.width : 1;
    group.set({
      left: dims.w / 2, top: dims.h / 2,
      originX: 'center', originY: 'center',
      scaleX: scale, scaleY: scale,
      name: 'graphic', selectable: true, evented: true,
    });
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
  });
};

/**
 * Registers a Canva-style "×" delete control that renders directly on a
 * selected object's bounding box (top-right corner, just outside the
 * normal resize handle) — replaces the old floating "🗑 Delete Selected"
 * button that used to sit in a fixed spot below the canvas regardless of
 * what was selected or where it was on the page.
 *
 * fabric.Object.prototype.controls is the shared control set every Fabric
 * object inherits by reference, so setting one named entry on it here
 * (once) adds the icon to every selectable object on the canvas — photos,
 * graphics, and text alike — without having to attach it per-instance or
 * re-attach it after every rebuild. Guarded by a module-level flag (rather
 * than a marker on the controls object itself) so calling this more than
 * once — e.g. from every canvas-init effect run — is a harmless no-op;
 * Fabric iterates `controls` assuming every value is a real Control
 * instance, so nothing extra should ever be stored on that object.
 */
let _deleteControlInstalled = false;
export const initDeleteControl = () => {
  if (_deleteControlInstalled) return;
  const fabric = window.fabric;
  if (!fabric || !fabric.Object || !fabric.Control) return;

  const deleteHandler = (eventData, transform) => {
    const target = transform.target;
    const canvas = target?.canvas;
    if (!canvas) return true;
    // Discard the selection FIRST (while the object is still active) so the
    // canvas's 'selection:cleared' listener fires and index.jsx's
    // selectedObject state — which drives the side panels — drops back to
    // "nothing selected", exactly like the keyboard Delete/Backspace path.
    canvas.discardActiveObject();
    canvas.remove(target);
    canvas.requestRenderAll();
    return true;
  };

  // Drawn programmatically (small red circle + white ×) instead of an
  // image icon — no async asset to load/fail, and it always matches the
  // object's current rotation.
  const renderDeleteIcon = function (ctx, left, top, styleOverride, fabricObject) {
    const size = this.cornerSize || 22;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle || 0));
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.beginPath();
    const r = size * 0.22;
    ctx.moveTo(-r, -r); ctx.lineTo(r, r);
    ctx.moveTo(r, -r); ctx.lineTo(-r, r);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  };

  fabric.Object.prototype.controls.deleteControl = new fabric.Control({
    x: 0.5,
    y: -0.5,
    offsetX: 16,
    offsetY: -16,
    cursorStyle: 'pointer',
    mouseUpHandler: deleteHandler,
    render: renderDeleteIcon,
    cornerSize: 22,
  });
  _deleteControlInstalled = true;
};

// ─────────────────────────────────────────────────────────────────────────
// ── Themed Flyer Templates (flyerTemplates.js) ─────────────────────────────
// applyTemplate()/placeArtwork() below are the drawing/placement half of a
// separate, additive template system — flyerTemplates.js holds the DATA
// (colors, border treatment, title/date/sponsorship/info-panel/footer
// specs, and the artworkSlot rectangle); this file only turns that data
// into fabric objects. It does not read from or write to buildFlyer() /
// buildModernFlyer() / buildMinimalFlyer() / TEMPLATE_BUILDERS above (the
// original "Starter Templates" system, retired from the UI — see the
// PANELS_* comment in constants.js — but left on disk) or THEMES. Every
// object it draws is named 'tpl_...' so it can be found/edited/removed
// independently of anything the older system ever drew.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Draws a themed flyer template (flyerTemplates.js) onto a Fabric.js
 * canvas: a background (solid or top-to-bottom gradient), an optional
 * deterministic starfield (Cosmic Navy), an ornamental double-stroke border
 * with gold corner accent marks, a placeholder title with a divider
 * ornament, a date/time pill, a sponsorship block (a two-column "provided
 * by temple / provided by devotee" comparison table, or a simple sponsor
 * badge — per template.sponsorshipStyle), an optional info panel (a
 * schedule+guidance grid, or a menu-style bullet list — per
 * template.infoPanelStyle), a footer, and a dashed placeholder marking
 * template.artworkSlot (removed by placeArtwork() below once a photo is
 * placed there). Every object is named 'tpl_...' — see each section below.
 *
 * Starts from a clean slate (canvas.clear()) rather than only removing its
 * own 'tpl_...' objects — same "start fresh" behavior as the existing
 * Starter Templates system's applyTemplate() in index.jsx: picking a themed
 * template replaces whatever was on the canvas before it, it doesn't layer
 * on top of it. The caller is responsible for re-placing anything that
 * should survive a template switch (e.g. a logo — see placeLogo above),
 * exactly like every other canvas-rebuilding function in this file already
 * expects.
 */
export const applyTemplate = ({ canvas, template, dims }) => {
  // Same not-silent guard shape as placeLogo above — these used to be easy
  // to get wrong quietly (a template picked with the canvas not ready yet
  // would otherwise just do nothing, with no clue why).
  if (!canvas) { console.error('[applyTemplate] no canvas — a template was picked but there is nothing to draw on yet'); return; }
  if (!template) { console.error('[applyTemplate] no template — nothing to draw'); return; }
  if (!dims) { console.error('[applyTemplate] no dims — would have crashed computing positions, bailing instead'); return; }

  const fabric = window.fabric;
  if (!fabric) { console.error('[applyTemplate] window.fabric not loaded yet'); return; }

  const { w, h } = dims;
  const cx = w / 2;
  const {
    colors = {}, border = {}, title = {}, datePill = {},
    sponsorshipStyle, sponsorship = {},
    infoPanel, infoPanelStyle, infoPanelContent = {},
    footer = {}, artworkSlot,
  } = template;
  const ink    = colors.ink    || '#333333';
  const accent = colors.accent || '#C9A227';

  canvas.clear();

  // ── Background — solid, or a top-to-bottom gradient ─────────────────────
  const bgFill = colors.bgGradient
    ? new fabric.Gradient({
        type: 'linear',
        coords: { x1: 0, y1: 0, x2: 0, y2: h },
        colorStops: [
          { offset: 0, color: colors.bgGradient[0] },
          { offset: 1, color: colors.bgGradient[1] },
        ],
      })
    : (colors.bg || '#ffffff');
  canvas.add(new fabric.Rect({
    left: 0, top: 0, width: w, height: h,
    fill: bgFill, selectable: false, evented: false, name: 'tpl_bg',
  }));

  // ── Optional starfield (Cosmic Navy) ─────────────────────────────────────
  // Deterministic scatter (a small linear-congruential hash, not
  // Math.random()) so the same template always renders identically —
  // matters for this being testable at all, and means two admins picking
  // this template never get a visually different starfield for no reason.
  if (template.starfield) {
    const STAR_COUNT = 60;
    let seed = 42;
    const nextRand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < STAR_COUNT; i++) {
      const sx = nextRand() * w;
      const sy = nextRand() * h;
      const r  = 1 + nextRand() * 1.6;
      canvas.add(new fabric.Circle({
        left: sx, top: sy, radius: r, originX: 'center', originY: 'center',
        fill: '#ffffff', opacity: 0.35 + nextRand() * 0.5,
        selectable: false, evented: false, name: 'tpl_star',
      }));
    }
  }

  // ── Ornamental border: double stroke + corner accent marks ──────────────
  // A tasteful, achievable-in-fabric.js stand-in for real filigree art:
  // an outer solid-stroke rect, a dashed inner rect, and a short L-shaped
  // gold accent mark at each of the 4 corners.
  const outerInset = border.outerInset ?? 24;
  const innerInset = border.innerInset ?? 34;
  const cornerSize = border.cornerSize ?? 40;
  canvas.add(new fabric.Rect({
    left: outerInset, top: outerInset, width: w - outerInset * 2, height: h - outerInset * 2,
    fill: 'transparent', stroke: accent, strokeWidth: 2.5,
    selectable: false, evented: false, name: 'tpl_border_outer',
  }));
  canvas.add(new fabric.Rect({
    left: innerInset, top: innerInset, width: w - innerInset * 2, height: h - innerInset * 2,
    fill: 'transparent', stroke: accent, strokeWidth: 1, strokeDashArray: [5, 5], opacity: 0.7,
    selectable: false, evented: false, name: 'tpl_border_inner',
  }));
  [
    ['tpl_corner_tl', innerInset,     innerInset,      1,  1],
    ['tpl_corner_tr', w - innerInset, innerInset,     -1,  1],
    ['tpl_corner_bl', innerInset,     h - innerInset,  1, -1],
    ['tpl_corner_br', w - innerInset, h - innerInset, -1, -1],
  ].forEach(([name, x0, y0, dx, dy]) => {
    canvas.add(new fabric.Polyline([
      { x: x0, y: y0 + dy * cornerSize },
      { x: x0, y: y0 },
      { x: x0 + dx * cornerSize, y: y0 },
    ], {
      fill: 'transparent', stroke: accent, strokeWidth: 3,
      selectable: false, evented: false, name,
    }));
  });

  // ── Title + divider ornament ─────────────────────────────────────────────
  const titleFontSize = title.fontSize ?? 0.058;
  const titleTop = h * (title.top ?? 0.1);
  canvas.add(new fabric.Textbox(title.placeholder || 'Event Title', {
    left: cx, top: titleTop, width: w * 0.82, originX: 'center',
    textAlign: 'center', fontFamily: title.font || 'Playfair Display',
    fontSize: Math.round(w * titleFontSize), fontWeight: 'bold',
    fill: title.color || ink, charSpacing: 30, lineHeight: 1.15,
    name: 'tpl_title', selectable: true,
  }));
  if (title.divider) {
    const divY = titleTop + w * titleFontSize * 1.3;
    canvas.add(new fabric.Line([w * 0.32, divY, w * 0.68, divY], {
      stroke: accent, strokeWidth: 1, opacity: 0.8,
      selectable: false, evented: false, name: 'tpl_title_divider',
    }));
    canvas.add(new fabric.Rect({
      left: cx, top: divY, width: 9, height: 9, angle: 45, originX: 'center', originY: 'center',
      fill: accent, selectable: false, evented: false, name: 'tpl_title_ornament',
    }));
  }

  // ── Date / time pill ──────────────────────────────────────────────────────
  const pillTop = h * (datePill.top ?? 0.2);
  const pillH   = Math.round(h * 0.04);
  const filled  = datePill.style === 'filled';
  canvas.add(new fabric.Rect({
    left: cx, top: pillTop, width: w * 0.56, height: pillH,
    originX: 'center', originY: 'center', rx: pillH / 2, ry: pillH / 2,
    fill: filled ? accent : 'transparent', stroke: accent, strokeWidth: 1.2,
    selectable: false, evented: false, name: 'tpl_date_pill_bg',
  }));
  canvas.add(new fabric.Textbox(datePill.placeholder || 'Date  •  Time', {
    left: cx, top: pillTop, width: w * 0.54, originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: title.font || 'Playfair Display',
    fontSize: Math.round(w * 0.02), charSpacing: 20,
    fill: filled ? (colors.bg || '#ffffff') : ink,
    name: 'tpl_date_pill_text', selectable: true,
  }));

  // ── Sponsorship block ─────────────────────────────────────────────────────
  if (sponsorshipStyle === 'comparison') {
    const spTop = h * (sponsorship.top ?? 0.6);
    canvas.add(new fabric.Textbox(sponsorship.heading || 'Sponsorship', {
      left: cx, top: spTop, width: w * 0.7, originX: 'center',
      textAlign: 'center', fontFamily: title.font || 'Playfair Display',
      fontSize: Math.round(w * 0.026), fill: ink, fontWeight: 'bold', charSpacing: 20,
      name: 'tpl_sponsorship_heading', selectable: true,
    }));
    const colsTop = spTop + h * 0.045;
    const [left, right] = sponsorship.columns || [
      { label: 'Provided by Temple', items: [] },
      { label: 'Provided by Devotee', items: [] },
    ];
    canvas.add(new fabric.Line([cx, colsTop, cx, colsTop + h * 0.16], {
      stroke: accent, strokeWidth: 1, opacity: 0.5,
      selectable: false, evented: false, name: 'tpl_sponsorship_divider',
    }));
    canvas.add(new fabric.Textbox(left.label, {
      left: w * 0.27, top: colsTop, width: w * 0.4, originX: 'center',
      textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.018),
      fill: accent, fontWeight: 'bold', name: 'tpl_sponsorship_col_left_label', selectable: true,
    }));
    canvas.add(new fabric.Textbox((left.items || []).map(i => `• ${i}`).join('\n'), {
      left: w * 0.27, top: colsTop + h * 0.032, width: w * 0.4, originX: 'center',
      textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.015),
      fill: ink, lineHeight: 1.5, name: 'tpl_sponsorship_col_left_items', selectable: true,
    }));
    canvas.add(new fabric.Textbox(right.label, {
      left: w * 0.73, top: colsTop, width: w * 0.4, originX: 'center',
      textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.018),
      fill: accent, fontWeight: 'bold', name: 'tpl_sponsorship_col_right_label', selectable: true,
    }));
    canvas.add(new fabric.Textbox((right.items || []).map(i => `• ${i}`).join('\n'), {
      left: w * 0.73, top: colsTop + h * 0.032, width: w * 0.4, originX: 'center',
      textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.015),
      fill: ink, lineHeight: 1.5, name: 'tpl_sponsorship_col_right_items', selectable: true,
    }));
  } else if (sponsorshipStyle === 'simple') {
    const spTop  = h * (sponsorship.top ?? 0.6);
    const badgeH = Math.round(h * 0.055);
    canvas.add(new fabric.Rect({
      left: cx, top: spTop, width: w * 0.5, height: badgeH,
      originX: 'center', originY: 'center', rx: 8, ry: 8,
      fill: 'transparent', stroke: accent, strokeWidth: 1,
      selectable: false, evented: false, name: 'tpl_sponsorship_badge_bg',
    }));
    canvas.add(new fabric.Textbox(`${sponsorship.heading || 'Sponsored By'}: ${sponsorship.badgeText || ''}`.trim(), {
      left: cx, top: spTop, width: w * 0.48, originX: 'center', originY: 'center',
      textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.017),
      fill: ink, name: 'tpl_sponsorship_badge_text', selectable: true,
    }));
  }

  // ── Info panel — schedule+guidance grid, or a menu-style bullet list ────
  if (infoPanel) {
    const c = infoPanelContent;
    const panelTop    = h * (c.top ?? 0.6);
    const panelHeight = h * (c.height ?? 0.25);
    const panelLeft   = w * (c.left ?? 0.1);
    const panelWidth  = w * (c.width ?? (1 - (c.left ?? 0.1) * 2));
    canvas.add(new fabric.Rect({
      left: panelLeft, top: panelTop, width: panelWidth, height: panelHeight,
      fill: colors.bgGradient ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      stroke: accent, strokeWidth: 1, opacity: 0.9, rx: 10, ry: 10,
      selectable: false, evented: false, name: 'tpl_info_panel_bg',
    }));
    if (infoPanelStyle === 'grid') {
      const cols     = c.columns || {};
      const leftCol  = cols.left  || { title: 'Schedule', rows: [] };
      const rightCol = cols.right || { title: 'Guidance',  rows: [] };
      const half = panelWidth / 2;
      canvas.add(new fabric.Textbox(leftCol.title, {
        left: panelLeft + half / 2, top: panelTop + panelHeight * 0.12, width: half * 0.86, originX: 'center',
        textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.018),
        fill: accent, fontWeight: 'bold', name: 'tpl_info_left_title', selectable: true,
      }));
      canvas.add(new fabric.Textbox((leftCol.rows || []).join('\n'), {
        left: panelLeft + half / 2, top: panelTop + panelHeight * 0.3, width: half * 0.86, originX: 'center',
        textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.014),
        fill: ink, lineHeight: 1.7, name: 'tpl_info_left_rows', selectable: true,
      }));
      canvas.add(new fabric.Textbox(rightCol.title, {
        left: panelLeft + half + half / 2, top: panelTop + panelHeight * 0.12, width: half * 0.86, originX: 'center',
        textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.018),
        fill: accent, fontWeight: 'bold', name: 'tpl_info_right_title', selectable: true,
      }));
      canvas.add(new fabric.Textbox((rightCol.rows || []).map(r => `• ${r}`).join('\n'), {
        left: panelLeft + half + half / 2, top: panelTop + panelHeight * 0.3, width: half * 0.86, originX: 'center',
        textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.014),
        fill: ink, lineHeight: 1.7, name: 'tpl_info_right_rows', selectable: true,
      }));
    } else {
      // 'list' — single-column heading + bullet rows (e.g. Harvest Green's
      // Sadya menu).
      canvas.add(new fabric.Textbox(c.title || 'Details', {
        left: panelLeft + panelWidth / 2, top: panelTop + panelHeight * 0.1, width: panelWidth * 0.88, originX: 'center',
        textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.02),
        fill: accent, fontWeight: 'bold', name: 'tpl_info_title', selectable: true,
      }));
      canvas.add(new fabric.Textbox((c.rows || []).map(r => `• ${r}`).join('\n'), {
        left: panelLeft + panelWidth / 2, top: panelTop + panelHeight * 0.26, width: panelWidth * 0.88, originX: 'center',
        textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.016),
        fill: ink, lineHeight: 1.8, name: 'tpl_info_rows', selectable: true,
      }));
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerTop = h * (footer.top ?? 0.93);
  canvas.add(new fabric.Line([w * 0.3, footerTop - h * 0.02, w * 0.7, footerTop - h * 0.02], {
    stroke: accent, strokeWidth: 0.5, opacity: 0.5,
    selectable: false, evented: false, name: 'tpl_footer_rule',
  }));
  canvas.add(new fabric.Textbox(footer.text || 'Temple Name  •  Address  •  Phone', {
    left: cx, top: footerTop, width: w * 0.86, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.014),
    fill: ink, opacity: 0.85, name: 'tpl_footer_text', selectable: true,
  }));

  // ── Artwork slot — empty-state placeholder, replaced by placeArtwork() ──
  if (artworkSlot) {
    const { x, y, width: aw, height: ah } = artworkSlot;
    canvas.add(new fabric.Rect({
      left: x, top: y, width: aw, height: ah,
      fill: 'rgba(0,0,0,0.03)', stroke: accent, strokeWidth: 1.5, strokeDashArray: [8, 6],
      selectable: false, evented: true, hoverCursor: 'pointer', name: 'tpl_artwork_placeholder',
    }));
    canvas.add(new fabric.Textbox('Tap a reference photo below\nto add artwork here', {
      left: x + aw / 2, top: y + ah / 2, width: aw * 0.8,
      originX: 'center', originY: 'center', textAlign: 'center',
      fontFamily: 'Georgia', fontSize: Math.round(w * 0.017), fill: ink, opacity: 0.55, lineHeight: 1.6,
      selectable: false, evented: true, hoverCursor: 'pointer', name: 'tpl_artwork_hint',
    }));
  }

  canvas.renderAll();
  canvas.discardActiveObject();
  canvas.renderAll();
};

/**
 * Places a photo into a themed flyer template's artwork slot (see
 * flyerTemplates.js's artworkSlot rectangle and applyTemplate's
 * 'tpl_artwork_placeholder'/'tpl_artwork_hint' empty-state above) — same
 * load/guard/dedup-before-replace shape as placeLogo above, sized and
 * positioned to template.artworkSlot instead of a fixed LOGO_BOX.
 *
 * Cover-fits the image within the slot (scales to fill it, cropping
 * overflow) and clips it to the slot's rectangle with an
 * absolutely-positioned clipPath, so an odd-aspect or oversized photo can
 * never spill past the template's artwork frame onto the border/title/
 * sponsorship block around it — same cover-fit reasoning as
 * placeImageFullFrame's full-canvas background above, just scoped to one
 * rectangle instead of the whole canvas.
 */
export const placeArtwork = ({ canvas, url, template }) => {
  if (!canvas) { console.error('[placeArtwork] no canvas — artwork was picked but there is nothing to draw on yet'); return; }
  if (!url) { console.error('[placeArtwork] no url — the reference photo had no url'); return; }
  if (!template?.artworkSlot) { console.error('[placeArtwork] no template.artworkSlot — this template has no artwork slot defined'); return; }

  const { x, y, width, height } = template.artworkSlot;

  // Remove the empty-state placeholder (applyTemplate's dashed rect + hint
  // text) and any previously-placed artwork before adding the new photo —
  // same dedup-before-replace pattern as placeLogo's logo_l/logo_r removal
  // above, so re-picking a photo replaces rather than stacks.
  ['tpl_artwork_placeholder', 'tpl_artwork_hint', 'tpl_artwork_img'].forEach(name => {
    canvas.getObjects().filter(o => o.name === name).forEach(o => canvas.remove(o));
  });

  const loadUrl = url.startsWith('data:')
    ? url
    : `/api/image-proxy?url=${encodeURIComponent(url)}`;

  window.fabric.Image.fromURL(loadUrl, (img) => {
    if (!img || !img.width) {
      console.error('[placeArtwork] failed to load:', loadUrl);
      return;
    }
    const scale = Math.max(width / img.width, height / img.height);
    img.set({
      scaleX: scale, scaleY: scale,
      left: x + width / 2, top: y + height / 2,
      originX: 'center', originY: 'center',
      name: 'tpl_artwork_img', selectable: true, evented: true,
      clipPath: new window.fabric.Rect({
        left: x, top: y, width, height,
        originX: 'left', originY: 'top', absolutePositioned: true,
      }),
    });
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.renderAll();
    console.log(`[placeArtwork] placed artwork at (${x}, ${y}) ${width}x${height}, scale ${scale.toFixed(3)} — canvas now has ${canvas.getObjects().length} objects`);
  }, { crossOrigin: 'anonymous' });
};
