/**
 * FlyerEditor — Canva-style Temple Flyer Studio
 *
 * Module structure:
 *   index.jsx              ← this file — orchestrator only (~200 lines)
 *   constants.js           ← THEMES, FONTS, LAYOUTS, PANELS, STYLES
 *   promptLibrary.js       ← PROMPT_LIBRARY, buildPrompt()
 *   canvasBuilder.js       ← buildFlyer(), placeDeityImage()
 *   useImageLibrary.js     ← S3 library + Pixabay search hook
 *   panels/DesignPanel.jsx
 *   panels/ImagePanel.jsx
 *   panels/TextPanel.jsx
 *   panels/UploadPanel.jsx
 *   modals/HistoryPanel.jsx
 *   modals/SponsorshipModal.jsx
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useFabric } from './useFabric';

import { LAYOUTS, THEMES, PANELS, LANGUAGES, STYLES } from './constants';
import { buildPrompt }    from './promptLibrary';
import { buildFlyer, placeDeityImage as _placeImage } from './canvasBuilder';
import { useImageLibrary } from './useImageLibrary';

import DesignPanel      from './panels/DesignPanel';
import ImagePanel       from './panels/ImagePanel';
import TextPanel        from './panels/TextPanel';
import UploadPanel      from './panels/UploadPanel';
import HistoryPanel     from './modals/HistoryPanel';
import SponsorshipModal from './modals/SponsorshipModal';
import BroadcastModal   from './modals/BroadcastModal';

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEY  = 'temple_flyer_drafts';
const loadDrafts   = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const saveDraft    = (draft) => { const all = loadDrafts(); const i = all.findIndex(d => d.id === draft.id); if (i >= 0) all[i] = draft; else all.unshift(draft); localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 20))); };
const uploadToS3   = async (dataUrl, filename) => { const res = await fetch('/api/flyers/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageData: dataUrl, filename }) }); if (!res.ok) throw new Error('Upload failed'); return res.json(); };

// ─── Translation helper ───────────────────────────────────────────────────────
const translateText = async (text, lang) => {
  if (!text || lang === 'en') return text;
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`);
    const d = await res.json();
    return d.responseData?.translatedText || text;
  } catch { return text; }
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FlyerEditor({ event, onClose }) {
  const canvasRef   = useRef(null);
  const fabricRef   = useRef(null);
  const fabricReady = useFabric();

  // ── Core state ───────────────────────────────────────────────────────────
  const [layout,       setLayout]      = useState('square');
  const [theme,        setTheme]       = useState('saffron');
  const [activePanel,  setActivePanel] = useState('design');
  const [zoom,         setZoom]        = useState(0.75);
  const [toast,        setToast]       = useState('');
  const [draftId]                      = useState(() => `flyer_${Date.now()}`);

  // ── UI modals ────────────────────────────────────────────────────────────
  const [showHistory,  setShowHistory] = useState(false);
  const [showSponsor,  setShowSponsor] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [sponsorship,  setSponsorship] = useState('');
  const [selectedObject, setSelectedObject] = useState(null);
  const [hasBg,          setHasBg]          = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDragging,     setIsDragging]     = useState(false); // true whenever any drag is in progress
  const dragUrlRef = useRef('');
  const [cropMode,       setCropMode]        = useState(false);
  const [removingBg,     setRemovingBg]      = useState(false);

  // ── Language / translation ───────────────────────────────────────────────
  const [activeLang,   setActiveLang]  = useState('en');
  const [translating,  setTranslating] = useState(false);

  // ── AI image generation ───────────────────────────────────────────────────
  const [genPrompt,    setGenPrompt]   = useState('');
  const [generating,   setGenerating]  = useState(false);
  const [genError,     setGenError]    = useState('');
  const [genSeconds,   setGenSeconds]  = useState(0);
  const genTimerRef = useRef(null);

  // ── Save / download state ─────────────────────────────────────────────────
  const [saving,       setSaving]      = useState(false);
  const [uploading,    setUploading]   = useState(false);
  const [downloading,  setDownloading] = useState(false);

  // ── Image sub-tab ─────────────────────────────────────────────────────────
  const [imageTab, setImageTab] = useState('stock');

  // ── Image library + stock search (custom hook) ────────────────────────────
  const imageLibrary = useImageLibrary(imageTab);

  // ── Derived ───────────────────────────────────────────────────────────────
  const dims = LAYOUTS[layout];
  const t    = THEMES[theme];
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800); };

  // ── Canvas init ───────────────────────────────────────────────────────────
  const layoutStates  = useRef({});          // { square: fabricJSON, portrait: fabricJSON, … }
  const placedImgUrl  = useRef('');          // last image URL placed — survives layout switch
  // ── Canvas init — runs ONCE when Fabric is ready ──────────────────────────
  useEffect(() => {
    if (!fabricReady || !canvasRef.current) return;
    if (fabricRef.current) { try { fabricRef.current.dispose(); } catch (e) {} }
    const dims = LAYOUTS[layout];
    const t    = THEMES[theme];
    const canvas = new window.fabric.Canvas(canvasRef.current, {
      width: dims.w, height: dims.h,
      backgroundColor: t.bg, preserveObjectStacking: true,
    });
    fabricRef.current = canvas;
    buildFlyer({ canvas, dims, theme: t, event, onSelectionChange: setSelectedObject });
    return () => { try { canvas.dispose(); } catch (e) {} };
  }, [fabricReady]); // eslint-disable-line  ← only runs once on mount
  // ── Layout switch — save current state, resize, restore or rebuild ─────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !fabricReady) return;
    const newDims = LAYOUTS[layout];
    // 1. Save the outgoing layout's full canvas JSON (includes images)
    //    We store the *previous* layout key via a ref so we know what to key under
    const prevKey = canvas._currentLayoutKey;
    if (prevKey && prevKey !== layout) {
      layoutStates.current[prevKey] = canvas.toJSON([
        'name', 'selectable', 'evented', 'originX', 'originY',
        'strokeDashArray', 'lineHeight', 'cropX', 'cropY',
      ]);
    }
    canvas._currentLayoutKey = layout;
    // 2. Resize canvas
    canvas.setWidth(newDims.w);
    canvas.setHeight(newDims.h);
    const savedState = layoutStates.current[layout];
    if (savedState) {
      // 3a. Restore previously-saved state for this layout
      canvas.loadFromJSON(savedState, () => canvas.renderAll());
    } else {
      // 3b. First visit — build fresh flyer, then re-place image if one exists
      canvas.clear();
      canvas.setBackgroundColor(THEMES[theme].bg, () => {});
      buildFlyer({ canvas, dims: newDims, theme: THEMES[theme], event, onSelectionChange: setSelectedObject });
      // Re-place image carried over from another layout
      if (placedImgUrl.current) {
        _placeImage({ canvas, url: placedImgUrl.current, dims: newDims });
      }
    }
  }, [layout]); // eslint-disable-line  ← only layout changes trigger this
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
  }, [theme]); // eslint-disable-line  ← only theme changes trigger this

  // ── Responsive zoom ───────────────────────────────────────────────────────
  useEffect(() => {
    const fit = () => {
      const maxW = window.innerWidth - 340;
      const maxH = window.innerHeight - 140;
      setZoom(Math.min(maxW / dims.w, maxH / dims.h, 1));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [layout, dims]);

  // ── Auto-build prompt from event ──────────────────────────────────────────
  // ── Place image on canvas ─────────────────────────────────────────────────
  const placeDeityImage = useCallback((url) => {
    placedImgUrl.current = url;                               // ← remember URL
    _placeImage({ canvas: fabricRef.current, url, dims: LAYOUTS[layout] });
  }, [layout]);
  useEffect(() => { setGenPrompt(buildPrompt(event)); }, [event]);

  // ── Keyboard delete ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') &&
          !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        const c = fabricRef.current;
        const o = c?.getActiveObject();
        if (o) { c.remove(o); c.renderAll(); setSelectedObject(null); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── Drag-and-drop: global cleanup on dragend ────────────────────────────────
  useEffect(() => {
    const onDragEnd = () => {
      dragUrlRef.current = '';
      setIsDragging(false);
      setIsDraggingOver(false);
    };
    document.addEventListener('dragend',  onDragEnd);
    return () => document.removeEventListener('dragend', onDragEnd);
  }, []);

  // (placeDeityImage moved up — defined before useEffects)

  // ── AI generate ───────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true); setGenError(''); setGenSeconds(0);
    genTimerRef.current = setInterval(() => setGenSeconds(s => s + 1), 1000);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: genPrompt, size: '1024x1024' }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      const img = data.imageBase64 || data.imageUrl || data.url;
      if (!img) throw new Error('No image in response — restart your server');
      placeDeityImage(img);
    } catch (err) {
      setGenError(err.message);
    } finally {
      clearInterval(genTimerRef.current);
      setGenerating(false);
    }
  };

  // ── Upload image / logo ───────────────────────────────────────────────────
  const handleUpload = (e, isLogo) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (isLogo) {
        window.fabric.Image.fromURL(ev.target.result, (img) => {
          const scale = Math.min(60 / img.width, 60 / img.height);
          const imgL = window.fabric.util.object.clone(img);
          imgL.set({ scaleX: scale, scaleY: scale, left: 10, top: 8, name: 'logo_l' });
          img.set({ scaleX: scale, scaleY: scale, left: dims.w - 70, top: 8, name: 'logo_r' });
          ['logo_l', 'logo_r'].forEach(n => { const o = fabricRef.current?.getObjects().find(x => x.name === n); if (o) fabricRef.current.remove(o); });
          fabricRef.current?.add(imgL); fabricRef.current?.add(img); fabricRef.current?.renderAll();
        });
      } else { placeDeityImage(ev.target.result); }
    };
    reader.readAsDataURL(file); e.target.value = '';
  };

  // ── Image filter (brightness/contrast) ───────────────────────────────────
  const applyFilter = (type, val) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj || obj.type !== 'image') return;
    obj.filters = obj.filters || [];
    const idx = obj.filters.findIndex(f => f.type === type);
    const filter = type === 'Brightness'
      ? new window.fabric.Image.filters.Brightness({ brightness: val / 100 })
      : new window.fabric.Image.filters.Contrast({ contrast: val / 100 });
    if (idx >= 0) obj.filters[idx] = filter; else obj.filters.push(filter);
    obj.applyFilters(); fabricRef.current.renderAll();
  };

  // ── Set image as full-canvas background ─────────────────────────────────────
  const handleSetBackground = (eOrNull) => {
    const canvas = fabricRef.current; if (!canvas) return;
    const applyBg = (url) => {
      const existing = canvas.getObjects().find(o => o.name === 'bg_template');
      if (existing) canvas.remove(existing);
      window.fabric.Image.fromURL(url, (img) => {
        img.set({
          scaleX: dims.w / img.width, scaleY: dims.h / img.height,
          left: 0, top: 0, originX: 'left', originY: 'top',
          name: 'bg_template', selectable: false, evented: false,
        });
        canvas.insertAt(img, 0);
        canvas.renderAll();
        setHasBg(true);
        showToast('✓ Background applied!');
      });
    };
    if (eOrNull === null) {
      // Use currently selected image on canvas
      const obj = canvas.getActiveObject();
      if (!obj || obj.type !== 'image') { showToast('⚠ Select an image on the canvas first'); return; }
      const el = obj._element;
      if (el?.src) applyBg(el.src);
    } else {
      // File upload
      const file = eOrNull.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => applyBg(ev.target.result);
      reader.readAsDataURL(file);
      eOrNull.target.value = '';
    }
  };
  // ── Remove background image (undo) ─────────────────────────────────────────
  const handleRemoveBgImage = () => {
    const canvas = fabricRef.current; if (!canvas) return;
    const existing = canvas.getObjects().find(o => o.name === 'bg_template');
    if (existing) { canvas.remove(existing); canvas.renderAll(); setHasBg(false); showToast('✓ Background removed'); }
    else showToast('No background set');
  };
  // ── Apply blur to selected image ─────────────────────────────────────────
  const applyBlur = (val) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj || obj.type !== 'image') return;
    obj.filters = obj.filters || [];
    const idx = obj.filters.findIndex(f => f.type === 'Blur');
    const filter = new window.fabric.Image.filters.Blur({ blur: val / 100 });
    if (idx >= 0) obj.filters[idx] = filter; else obj.filters.push(filter);
    obj.applyFilters(); fabricRef.current.renderAll();
  };
  // ── Crop selected image ───────────────────────────────────────────────────
  // Fabric doesn't have built-in crop UI — we implement simple center-crop
  const handleCrop = (aspectStr) => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj || obj.type !== 'image') { showToast('⚠ Select an image first'); return; }
    const [aw, ah] = aspectStr.split(':').map(Number);
    const imgW = obj.width;
    const imgH = obj.height;
    const targetRatio = aw / ah;
    const imgRatio = imgW / imgH;
    let cropX = 0, cropY = 0, cropW = imgW, cropH = imgH;
    if (imgRatio > targetRatio) {
      // Image wider than target — crop sides
      cropW = imgH * targetRatio;
      cropX = (imgW - cropW) / 2;
    } else {
      // Image taller than target — crop top/bottom
      cropH = imgW / targetRatio;
      cropY = (imgH - cropH) / 2;
    }
    obj.set({ cropX, cropY, width: cropW, height: cropH });
    canvas.renderAll();
    showToast(`✓ Cropped to ${aspectStr}`);
  };
  // ── Remove background via Remove.bg API ──────────────────────────────────
  const handleRemoveBgApi = async () => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj || obj.type !== 'image') { showToast('⚠ Select an image first'); return; }
    setRemovingBg(true);
    try {
      // Get image as blob
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width  = obj.width;
      tmpCanvas.height = obj.height;
      const ctx = tmpCanvas.getContext('2d');
      ctx.drawImage(obj._element, 0, 0);
      const blob = await new Promise(res => tmpCanvas.toBlob(res, 'image/png'));
      const formData = new FormData();
      formData.append('image_file', blob, 'image.png');
      // Route through backend to keep API key secure
      const res = await fetch('/api/remove-bg', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status}) — check REMOVE_BG_API_KEY in server .env`);
      }
      const data = await res.json();
      // Replace the image with the bg-removed version
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
  const applySponsorshipToCanvas = (amount, name) => {
    setSponsorship(amount);
    const canvas = fabricRef.current; if (!canvas) return;
    const existing = canvas.getObjects().find(o => o.name === 'sponsorship');
    const text = name ? `🙏 Sponsored by ${name} — ${amount}` : `🙏 Sponsorship: ${amount}`;
    if (amount) {
      if (existing) { existing.set('text', text); canvas.renderAll(); }
      else {
        canvas.add(new window.fabric.Textbox(text, {
          left: dims.w / 2, top: dims.h * 0.81, width: dims.w * 0.74, originX: 'center',
          textAlign: 'center', fontFamily: 'Georgia', fontSize: Math.round(dims.w * 0.024),
          fill: t.title, fontWeight: 'bold', name: 'sponsorship', selectable: true,
        }));
        canvas.renderAll();
      }
    } else if (existing) { canvas.remove(existing); canvas.renderAll(); }
  };

  // ── Translation ───────────────────────────────────────────────────────────
  const handleTranslate = async (langCode) => {
    if (langCode === activeLang) return;
    const cv = fabricRef.current; if (!cv) return;
    setTranslating(true); setActiveLang(langCode);
    const TEXT_FIELDS = ['event_title', 'event_date', 'event_time', 'event_desc', 'sponsorship'];
    const objs = cv.getObjects().filter(o => o.type === 'textbox' && TEXT_FIELDS.includes(o.name));
    for (const obj of objs) {
      const original = obj._originalText || obj.text;
      obj._originalText = original;
      obj.set('text', langCode === 'en' ? original : await translateText(original, langCode));
    }
    cv.renderAll(); setTranslating(false);
  };

  // ── Save / Download ───────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const canvas = fabricRef.current; if (!canvas) return;
      canvas.discardActiveObject(); canvas.renderAll();
      await new Promise(r => setTimeout(r, 150));
      const thumbnail = canvas.toDataURL({ format: 'jpeg', quality: 0.35, multiplier: 0.25 });
      saveDraft({ id: draftId, title: event?.title || 'Untitled Flyer', layout, theme, canvasJSON: JSON.stringify(canvas.toJSON(['name'])), thumbnail, savedAt: new Date().toISOString(), eventId: event?.id });
      showToast('✓ Draft saved locally!');
    } catch { showToast('⚠ Save failed'); } finally { setSaving(false); }
  };

  const handleSaveToS3 = async () => {
    setUploading(true);
    try {
      const canvas = fabricRef.current; if (!canvas) return;
      canvas.discardActiveObject(); canvas.renderAll();
      await new Promise(r => setTimeout(r, 200));
      const dataUrl  = canvas.toDataURL({ format: 'png', multiplier: 2 });
      const filename = `flyers/${draftId}_${(event?.title || 'flyer').replace(/\s+/g, '_')}.png`;
      const result   = await uploadToS3(dataUrl, filename);
      const all = loadDrafts(); const d = all.find(x => x.id === draftId);
      if (d) { d.s3Url = result.url; saveDraft(d); }
      showToast('☁ Saved to cloud (S3)!');
    } catch { showToast('⚠ Cloud save failed — check server/S3 config'); } finally { setUploading(false); }
  };

  const handleLoadDraft = (draft) => {
    setLayout(draft.layout || 'square');
    setTheme(draft.theme || 'saffron');
    setShowHistory(false);
    setTimeout(() => {
      try {
        const canvas = fabricRef.current; if (!canvas) return;
        canvas.loadFromJSON(JSON.parse(draft.canvasJSON), () => canvas.renderAll());
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
    a.download = `${(event?.title || 'flyer').replace(/\s+/g, '_')}_flyer.png`; a.click();
    setDownloading(false);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0f172a', display: 'flex', flexDirection: 'column', fontFamily: 'Georgia,serif' }}>

        {/* ═══ TOP TOOLBAR ═══ */}
        <div style={{ height: 72, background: '#1e293b', borderBottom: '2px solid #334155', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 7, flexShrink: 0, boxShadow: '0 4px 24px rgba(0,0,0,0.6)', overflowX: 'auto' }}>
          <div style={{ background: 'linear-gradient(135deg,#c2410c,#7c2d12)', borderRadius: 10, padding: '10px 16px', color: 'white', fontWeight: '900', fontSize: '0.95rem', letterSpacing: '0.04em', flexShrink: 0, boxShadow: '0 2px 12px rgba(194,65,12,0.6)', fontFamily: 'Georgia, serif' }}>
            🪔 Flyer Studio
          </div>

          {/* Event name */}
          <span style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
            {event?.title || 'New Flyer'}
          </span>

          {/* Language switcher */}
          <div style={{ display: 'flex', gap: 4, marginLeft: 6 }}>
            {LANGUAGES.map(lang => {
              const active = activeLang === lang.code;
              return (
              <button key={lang.code} onClick={() => handleTranslate(lang.code)} disabled={translating} style={{
                  padding: '9px 12px', border: `2px solid ${active ? '#fb923c' : 'rgba(251,146,60,0.4)'}`,
                  background: active ? 'linear-gradient(135deg,#c2410c,#92400e)' : 'rgba(251,146,60,0.1)',
                  color: '#fff', fontWeight: '800', borderRadius: 9, cursor: 'pointer',
                  fontSize: '0.82rem', fontFamily: 'Georgia, serif',
                  boxShadow: active ? '0 2px 10px rgba(251,146,60,0.4)' : 'none',
              }}>
                {lang.label}
              </button>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 38, background: '#475569', margin: '0 3px', flexShrink: 0 }} />

          {/* Layout picker */}
          <div style={{ display: 'flex', gap: 5, marginLeft: 8 }}>
            {Object.entries(LAYOUTS).map(([key, l]) => {
              const active = layout === key;
              const colors = { square: '#f97316', portrait: '#6366f1', landscape: '#0891b2', story: '#a855f7' };
              const c = colors[key];
              return (
                <button key={key} onClick={() => {
                  if (key === layout) return;
                  // Save current canvas JSON before switching
                  if (fabricRef.current) {
                    layoutStates.current[layout] = fabricRef.current.toJSON([
                      'name','selectable','evented','originX','originY','strokeDashArray','lineHeight','cropX','cropY',
                    ]);
                    fabricRef.current._currentLayoutKey = key;
                  }
                  setLayout(key);
                }} style={{
                  padding: '9px 14px',
                  border: `2px solid ${active ? c : c + '55'}`,
                  borderRadius: 9, cursor: 'pointer', fontSize: '0.82rem', fontWeight: '800',
                  background: active ? `linear-gradient(135deg,${c},${c}cc)` : `${c}22`,
                  color: '#fff',
                  display: 'flex', alignItems: 'center', gap: 5,
                  boxShadow: active ? `0 3px 12px ${c}55` : 'none',
                  transform: active ? 'translateY(-1px)' : 'none',
                  transition: 'all 0.15s',
                  fontFamily: 'Georgia, serif',
              }}>
                  {l.icon} {l.label}
                  <span style={{ opacity: 0.75, fontSize: '0.7rem' }}>{l.desc}</span>
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1 }} />

          {/* Action buttons — match admin toolbar style */}
          <button onClick={() => setShowHistory(true)} style={{
            padding: '10px 14px', background: 'linear-gradient(135deg,#37415188,#1e293b88)',
            border: '2px solid #64748b', color: '#fff', borderRadius: 10, cursor: 'pointer',
            fontSize: '0.88rem', fontWeight: '800', fontFamily: 'Georgia, serif',
            boxShadow: '0 2px 8px rgba(100,116,139,0.25)', display: 'flex', alignItems: 'center', gap: 6,
          }}>🕐 History</button>

          <button onClick={handleSaveDraft} disabled={saving} style={{
            padding: '10px 14px', background: 'linear-gradient(135deg,#0f766e88,#0d948888)',
            border: '2px solid #14b8a6', color: '#fff', borderRadius: 10, cursor: 'pointer',
            fontSize: '0.88rem', fontWeight: '800', fontFamily: 'Georgia, serif',
            boxShadow: '0 2px 8px rgba(20,184,166,0.3)', display: 'flex', alignItems: 'center', gap: 6,
          }}>💾 {saving ? 'Saving…' : 'Save Draft'}</button>

          <button onClick={handleSaveToS3} disabled={uploading} style={{
            padding: '10px 14px', background: 'linear-gradient(135deg,#0e749088,#0891b288)',
            border: '2px solid #06b6d4', color: '#fff', borderRadius: 10, cursor: 'pointer',
            fontSize: '0.88rem', fontWeight: '800', fontFamily: 'Georgia, serif',
            boxShadow: '0 2px 8px rgba(6,182,212,0.3)', display: 'flex', alignItems: 'center', gap: 6,
          }}>☁ {uploading ? 'Uploading…' : 'Save to Cloud'}</button>

          <button onClick={handleDownload} disabled={downloading} style={{
            padding: '10px 18px', background: downloading ? '#334155' : 'linear-gradient(135deg,#16a34a,#15803d)',
            border: '2px solid #22c55e', color: 'white', borderRadius: 10,
            cursor: downloading ? 'not-allowed' : 'pointer', fontWeight: '900', fontSize: '0.92rem',
            boxShadow: '0 4px 16px rgba(22,163,74,0.5)', fontFamily: 'Georgia, serif',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>⬇ Download</button>

          <button onClick={() => setShowBroadcast(true)} style={{
            padding: '10px 18px', border: '2px solid #a855f7',
            background: 'linear-gradient(135deg,#6d28d9,#5b21b6)',
            color: 'white', borderRadius: 10, cursor: 'pointer',
            fontWeight: '900', fontSize: '0.92rem', fontFamily: 'Georgia, serif',
            boxShadow: '0 4px 16px rgba(124,58,237,0.5)', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>📣 Broadcast</button>

          {/* Divider */}
          <div style={{ width: 1, height: 38, background: '#475569', margin: '0 2px', flexShrink: 0 }} />

          <button onClick={onClose} style={{
            width: 38, height: 38, background: 'linear-gradient(135deg,#9f121288,#7f1d1d88)',
            border: '2px solid #ef4444', color: '#fff', borderRadius: 10, cursor: 'pointer',
            fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>✕</button>

        </div>

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999999, background: '#1e293b', border: '1px solid #334155', color: toast.startsWith('⚠') ? '#f87171' : '#34d399', padding: '10px 20px', borderRadius: 10, fontSize: '0.85rem', fontWeight: '600', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
            {toast}
          </div>
        )}

        {/* ═══ BODY ═══ */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Icon rail */}
          <div style={{ width: 60, background: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, gap: 2, flexShrink: 0 }}>
            {PANELS.map(p => (
              <button key={p.id} onClick={() => setActivePanel(p.id)} title={p.label} style={{
                width: 46, height: 50, border: 'none', borderRadius: 9, cursor: 'pointer',
                background: activePanel === p.id ? 'rgba(194,65,12,0.2)' : 'transparent',
                color: activePanel === p.id ? '#fb923c' : '#475569',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                borderLeft: activePanel === p.id ? '3px solid #c2410c' : '3px solid transparent',
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: '1.1rem' }}>{p.icon}</span>
                <span style={{ fontSize: '0.5rem', fontFamily: 'system-ui' }}>{p.label}</span>
              </button>
            ))}
          </div>

          {/* Sidebar panel */}
          <div style={{ width: 248, background: '#1e293b', borderRight: '1px solid #334155', overflowY: 'auto', flexShrink: 0 }}>
            <div style={{ padding: '14px 16px' }}>

              {activePanel === 'design' && (
                <DesignPanel
                  theme={theme} setTheme={setTheme}
                  sponsorship={sponsorship}
                  onShowSponsor={() => setShowSponsor(true)}
                  onRemoveSponsor={() => { setSponsorship(''); applySponsorshipToCanvas('', ''); }}
                />
              )}

              {activePanel === 'image' && (
                <ImagePanel
                  imageTab={imageTab} setImageTab={setImageTab}
                  {...imageLibrary}
                  genPrompt={genPrompt} setGenPrompt={setGenPrompt}
                  generating={generating} genSeconds={genSeconds} genError={genError}
                  handleGenerate={handleGenerate}
                  applyFilter={applyFilter}
                  applyBlur={applyBlur}
                  handleCrop={handleCrop}
                  handleRemoveBgApi={handleRemoveBgApi}
                  removingBg={removingBg}
                  selectedObject={selectedObject}
                  onPlaceImage={placeDeityImage}
                  onDragStart={(url) => { dragUrlRef.current = url; setIsDragging(true); }}
                  onDragEnd={() => { dragUrlRef.current = ''; setIsDragging(false); setIsDraggingOver(false); }}
                />
              )}

              {activePanel === 'text' && (
                <TextPanel fabricRef={fabricRef} />
              )}

              {activePanel === 'upload' && (
                <UploadPanel onUpload={handleUpload} onSetBackground={handleSetBackground} hasBg={hasBg} onRemoveBg={handleRemoveBgImage} />
              )}
            </div>
          </div>

          {/* Canvas area */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, background: '#0f172a', position: 'relative' }}>
            {/* Zoom controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '5px 12px' }}>
              <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.2))} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px' }}>−</button>
              <span style={{ color: '#94a3b8', fontSize: '0.78rem', minWidth: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(z + 0.1, 1.5))} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px' }}>+</button>
              <button onClick={() => setZoom(Math.min((window.innerWidth - 340) / dims.w, (window.innerHeight - 140) / dims.h, 1))} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.7rem' }}>Fit</button>
            </div>

            {/* Canvas with drag-drop overlay */}
            <div style={{ position: 'relative', transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
              <div style={{
                boxShadow: isDraggingOver ? '0 0 0 3px #c2410c, 0 32px 80px rgba(0,0,0,0.6)' : '0 32px 80px rgba(0,0,0,0.6)',
                borderRadius: 4, transition: 'box-shadow 0.15s',
              }}>
              <canvas ref={canvasRef} />
              </div>
              {/* Drop overlay — always present, captures drag events over Fabric canvas */}
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
                  // Always intercept drag events; only show visual when dragging
                  pointerEvents: isDragging ? 'all' : 'none', // only capture events during active drag
                  background: isDraggingOver ? 'rgba(194,65,12,0.15)' : 'transparent',
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
            </div>

            {/* Floating delete button */}
            {selectedObject && (
              <div style={{ position: 'absolute', bottom: 32, right: 32 }}>
                <button onClick={() => {
                  const c = fabricRef.current;
                  const o = c?.getActiveObject();
                  if (o) { c.remove(o); c.renderAll(); setSelectedObject(null); }
                }} style={{
                  padding: '8px 18px', background: 'rgba(220,38,38,0.9)', border: '1px solid #ef4444',
                  color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  🗑 Delete Selected
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showHistory && <HistoryPanel onLoad={handleLoadDraft} onClose={() => setShowHistory(false)} />}
      {showBroadcast && (
        <BroadcastModal
          onClose={() => setShowBroadcast(false)}
          fabricRef={fabricRef}
          event={event}
        />
      )}
      {showSponsor && <SponsorshipModal value={sponsorship} onClose={() => setShowSponsor(false)} onApply={applySponsorshipToCanvas} />}
    </>
  );
}
