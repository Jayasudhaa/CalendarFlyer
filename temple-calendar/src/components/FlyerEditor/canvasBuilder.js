// ─── Canvas Builder ───────────────────────────────────────────────────────────
// Pure functions for building and updating the Fabric.js canvas.
// Kept separate from React state so they're easy to test and modify.

import { TEMPLE_NAME, TEMPLE_ADDR, TEMPLE_INFO, APP_DOMAIN } from './constants';

/**
 * Draws the full flyer layout onto a Fabric.js canvas.
 * Called whenever layout or theme changes.
 */
export const buildFlyer = ({ canvas, dims, theme: t, event, onSelectionChange }) => {
  const { w, h } = dims;
  const cx = w / 2;

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
  const omY = Math.round(h * 0.072);
  canvas.add(new window.fabric.Circle({
    left: cx, top: omY, radius: Math.round(w * 0.042),
    originX: 'center', originY: 'center',
    fill: '#2a1000', stroke: '#f0c050', strokeWidth: 1.5,
    opacity: 0.85, selectable: false, evented: false,
  }));
  canvas.add(new window.fabric.Textbox('ॐ', {
    left: cx, top: omY, width: Math.round(w * 0.12), originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.042),
    fill: '#f0c050', name: 'om_symbol', selectable: false, evented: false,
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_NAME, {
    left: cx, top: h * 0.135, width: w * 0.82, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.031),
    fill: '#f0c050', fontWeight: 'bold', charSpacing: 60,
    name: 'temple_name', selectable: true, lineHeight: 1.2,
  }));
  canvas.add(new window.fabric.Line([w * 0.15, h * 0.195, w * 0.85, h * 0.195], {
    stroke: '#c8860a', strokeWidth: 1, opacity: 0.7,
    selectable: false, evented: false,
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_ADDR, {
    left: cx, top: h * 0.205, width: w * 0.78, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.018),
    fill: '#d4a84b', charSpacing: 20,
    name: 'temple_addr', selectable: true,
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_INFO, {
    left: cx, top: h * 0.233, width: w * 0.88, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.013),
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
    name: 'img_placeholder', selectable: false, evented: false,
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
      selectable: false, evented: false,
    }));
  });
  canvas.add(new window.fabric.Textbox('🙏\nClick "Generate Image"\nor upload a photo', {
    left: cx, top: imgTop + imgH / 2, width: w * 0.5,
    originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.022),
    fill: 'rgba(212,168,75,0.5)', lineHeight: 1.6,
    name: 'img_hint', selectable: false, evented: false,
  }));
  const afterImg = imgTop + imgH + h * 0.018;
  canvas.add(new window.fabric.Line([w * 0.15, afterImg, w * 0.85, afterImg], {
    stroke: '#c8860a', strokeWidth: 1, opacity: 0.65,
    selectable: false, evented: false,
  }));
  // ── Event Title ───────────────────────────────────────────────────────────
  const titleTop = afterImg + h * 0.012;
  canvas.add(new window.fabric.Textbox((event?.title || 'EVENT TITLE').toUpperCase(), {
    left: cx, top: titleTop, width: w * 0.88, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.056),
    fill: '#ffffff', fontWeight: 'bold', charSpacing: 40,
    name: 'event_title', selectable: true, lineHeight: 1.15,
  }));

  canvas.add(new window.fabric.Textbox('CELEBRATION', {
    left: cx, top: titleTop + Math.round(w * 0.072), width: w * 0.6, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.018),
    fill: '#d4a84b', charSpacing: 120,
    name: 'event_subtitle', selectable: true,
  }));
  // ── Divider ───────────────────────────────────────────────────────────────
  const divY2 = titleTop + Math.round(w * 0.072) + h * 0.038;
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
  const dateTop = divY2 + h * 0.018;
  canvas.add(new window.fabric.Textbox(dateStr, {
    left: cx, top: dateTop, width: w * 0.85, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.030),
    fill: '#f0c050', charSpacing: 30,
    name: 'event_date', selectable: true,
  }));
  if (event?.time) {
    canvas.add(new window.fabric.Textbox(event.time, {
      left: cx, top: dateTop + h * 0.046, width: w * 0.6, originX: 'center',
      textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.022),
      fill: '#d4a84b', charSpacing: 60, fontStyle: 'italic',
      name: 'event_time', selectable: true,
    }));
  }

  // ── Image Placeholder ─────────────────────────────────────────────────────
  const dotY = dateTop + h * 0.085;
  [-20, 0, 20].forEach((offset, i) => {
    canvas.add(new window.fabric.Circle({
      left: cx + offset, top: dotY, radius: Math.round(w * 0.004),
    originX: 'center', originY: 'center',
      fill: '#f0c050', opacity: i === 1 ? 0.9 : 0.5,
      selectable: false, evented: false,
  }));
  });

  // ── Description ───────────────────────────────────────────────────────────
  if (event?.description) {
    canvas.add(new window.fabric.Textbox(event.description, {
      left: cx, top: dotY + h * 0.022, width: w * 0.84, originX: 'center',
      textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.020),
      fill: '#c8a060', name: 'event_desc', selectable: true, lineHeight: 1.45,
    }));
  }

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
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.016),
    fill: '#f0c050', charSpacing: 20,
    name: 'rsvp_link', selectable: true,
  }));
  // ── Footer ────────────────────────────────────────────────────────────────
  canvas.add(new window.fabric.Rect({
    left: 0, top: h * 0.927, width: w, height: h * 0.073,
    fill: '#120600', selectable: false, evented: false, name: 'footer_bg',
  }));
  canvas.add(new window.fabric.Textbox('www.svtempleco.org', {
    left: cx, top: h * 0.954, width: w * 0.7, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.024),
    fill: '#f0c050', fontWeight: 'bold', charSpacing: 30,
    name: 'website', selectable: true,
  }));
  canvas.add(new window.fabric.Rect({
    left: 0, top: h - Math.round(h * 0.008), width: w, height: Math.round(h * 0.008),
    fill: '#f0c050', selectable: false, evented: false,
  }));

  canvas.renderAll();

  // ── Selection tracking ────────────────────────────────────────────────────
  if (onSelectionChange) {
    canvas.on('selection:created', (e) => onSelectionChange(e.selected?.[0] || null));
    canvas.on('selection:updated', (e) => onSelectionChange(e.selected?.[0] || null));
    canvas.on('selection:cleared',  ()  => onSelectionChange(null));
  }
};

/**
 * Places a deity/event image onto the canvas, removing any existing placeholder.
 */
export const placeDeityImage = ({ canvas, url, dims }) => {
  if (!canvas || !url) return;

  // Remove placeholder and any existing deity image
  ['img_placeholder', 'img_hint', 'deity_img'].forEach(name => {
    const obj = canvas.getObjects().find(o => o.name === name);
    if (obj) canvas.remove(obj);
  });

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
      left: dims.w / 2, top: dims.h * 0.52,
      originX: 'center', originY: 'center',
      name: 'deity_img', selectable: true,
      evented: true,
    });
    canvas.add(img);
      canvas.setActiveObject(img);
    canvas.renderAll();
    },
    { crossOrigin: 'anonymous' }
  );
};
