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
    fill: 'transparent', stroke: t.border, strokeWidth: 10,
    selectable: false, evented: false,
  }));
  canvas.add(new window.fabric.Rect({
    left: 8, top: 8, width: w - 16, height: h - 16,
    fill: 'transparent', stroke: t.border, strokeWidth: 2,
    strokeDashArray: [6, 4], selectable: false, evented: false,
  }));

  // ── Header ────────────────────────────────────────────────────────────────
  canvas.add(new window.fabric.Rect({
    left: 0, top: 0, width: w, height: h * 0.13,
    fill: t.header, selectable: false, evented: false, name: 'header_bg',
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_NAME, {
    left: cx, top: h * 0.018, width: w * 0.75, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.027),
    fill: '#FFFFFF', fontWeight: 'bold', name: 'temple_name', selectable: true,
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_ADDR, {
    left: cx, top: h * 0.067, width: w * 0.75, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.018),
    fill: 'rgba(255,255,255,0.85)', name: 'temple_addr', selectable: true,
  }));
  canvas.add(new window.fabric.Textbox(TEMPLE_INFO, {
    left: cx, top: h * 0.099, width: w * 0.88, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.013),
    fill: 'rgba(255,255,255,0.75)', name: 'temple_info', selectable: true,
  }));

  // ── Event Title ───────────────────────────────────────────────────────────
  canvas.add(new window.fabric.Textbox((event?.title || 'EVENT TITLE').toUpperCase(), {
    left: cx, top: h * 0.15, width: w * 0.88, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.054),
    fill: t.title, fontWeight: 'bold', name: 'event_title', selectable: true, lineHeight: 1.2,
  }));

  // ── Divider ───────────────────────────────────────────────────────────────

  // ── Date & Time ───────────────────────────────────────────────────────────
  const dateStr = event?.date
    ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }).toUpperCase()
    : 'DATE TBD';
  canvas.add(new window.fabric.Textbox(dateStr, {
    left: cx, top: h * 0.245, width: w * 0.85, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.032),
    fill: t.date, fontWeight: 'bold', name: 'event_date', selectable: true,
  }));
  if (event?.time) {
    canvas.add(new window.fabric.Textbox(`⏰  ${event.time}`, {
      left: cx, top: h * 0.295, width: w * 0.85, originX: 'center',
      textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.028),
      fill: t.date, fontStyle: 'italic', name: 'event_time', selectable: true,
    }));
  }

  // ── Image Placeholder ─────────────────────────────────────────────────────
  canvas.add(new window.fabric.Rect({
    left: cx, top: h * 0.52, width: w * 0.64, height: h * 0.35,
    originX: 'center', originY: 'center',
    fill: t.accent, stroke: t.border, strokeWidth: 2.5,
    strokeDashArray: [10, 5], rx: 8, ry: 8,
    name: 'img_placeholder', selectable: false, evented: false,
  }));
  canvas.add(new window.fabric.Textbox('🙏\nClick "Generate Image"\nor upload a photo', {
    left: cx, top: h * 0.52, width: w * 0.5, originX: 'center', originY: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.023),
    fill: t.date, lineHeight: 1.6, name: 'img_hint', selectable: false, evented: false,
  }));

  // ── Description ───────────────────────────────────────────────────────────
  if (event?.description) {
    canvas.add(new window.fabric.Textbox(event.description, {
      left: cx, top: h * 0.735, width: w * 0.84, originX: 'center',
      textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.022),
      fill: t.text, name: 'event_desc', selectable: true, lineHeight: 1.45,
    }));
  }

  const eventSlug = (event?.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const rsvpUrl = `${APP_DOMAIN}/rsvp/${eventSlug}`;
  canvas.add(new window.fabric.Textbox(`📋 RSVP: ${rsvpUrl}`, {
    left: cx, top: h * 0.88, width: w * 0.88, originX: 'center',
    textAlign: 'center', fontFamily: 'Arial', fontSize: Math.round(w * 0.018),
    fill: t.text, name: 'rsvp_link', selectable: true,
  }));
  // ── Footer ────────────────────────────────────────────────────────────────
  canvas.add(new window.fabric.Rect({
    left: 0, top: h * 0.925, width: w, height: h * 0.075,
    fill: t.header, selectable: false, evented: false, name: 'footer_bg',
  }));
  canvas.add(new window.fabric.Textbox('www.svtempleco.org', {
    left: cx, top: h * 0.95, width: w * 0.7, originX: 'center',
    textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(w * 0.023),
    fill: '#FFFFFF', fontWeight: 'bold', name: 'website', selectable: true,
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
