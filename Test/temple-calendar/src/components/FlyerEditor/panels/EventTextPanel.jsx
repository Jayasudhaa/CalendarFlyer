import React, { useEffect, useState } from 'react';
import { FONTS, STYLES, COLORS, LANGUAGES } from '../constants';

const { sectionLabel: sLBase, input: inpBase } = STYLES;
// Bumped up from the shared STYLES defaults — scoped to just this panel
// (not the shared constants.js tokens, which other Flyer Studio panels
// also read) since only this panel's text was reported as too small.
const sL  = { ...sLBase, fontSize: '0.82rem' };
const inp = { ...inpBase, fontSize: '0.9rem' };

// ── Structured-card shell + icon badge — groups each section of the panel
// (Language, each field, the tip, Other Text) into its own faint bordered
// card instead of one long scroll of bottom-border-separated blocks, and
// swaps the plain emoji section markers for a small glossy black badge to
// match the rest of the app's monochrome system. ──
// Champagne Glass now — "keep all the panel glass champagne," a direct
// request to carry the AI Visual rail's frosted-gold card language across
// every left-rail tab, this one included, instead of a local plain-gray
// card style that no longer matched.
const CARD_STYLE = {
  background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  border: '1px solid rgba(90,84,74,0.22)', borderRadius: 10, padding: '11px 11px', marginBottom: 9,
};
const GLOSS_BLACK = 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)';
const GLOSS_SHADOW = '0 2px 5px -2px rgba(0,0,0,0.5)';
function IconBadge({ icon, size = 22 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 6, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, background: GLOSS_BLACK, color: '#fff', boxShadow: GLOSS_SHADOW,
    }}>{icon}</span>
  );
}

// Merged Event + Text panel. Used to be two separate tabs: Event (content-
// only editors that wrote into the template's named text objects — title/
// date/time/venue/description) and Text (font/size/color/bold/italic/
// underline controls, but only ever applied to whichever object happened
// to be selected on canvas — no way to target "the date field" specifically
// without clicking it first). That split made "change the date's font"
// a two-tab, click-the-canvas-first operation, and was reported as
// confusing ("1 font on date is not very good" — no direct way to fix it).
//
// Now each of the five named fields gets its own compact content + font
// controls (family, size, bold, italic) that write straight to that named
// object by name — no canvas selection required. The old Text tab's
// free-form tools (add a text box, style whatever's selected, language/
// translate) still exist below, under "Other Text", for anything that
// isn't one of the five named fields.
const FIELD_DEFS = [
  { name: 'event_title', label: 'Title' },
  { name: 'event_date',  label: 'Date' },
  { name: 'event_time',  label: 'Time', placeholder: 'e.g. 6:30 PM' },
  { name: 'temple_addr', label: 'Venue / Address' },
  { name: 'event_desc',  label: 'Description', multiline: true },
];

function FieldBlock({ fabricRef, def }) {
  const { name, label, multiline, placeholder } = def;
  const [text, setText]     = useState('');
  const [font, setFont]     = useState('Playfair Display');
  const [size, setSize]     = useState(24);
  const [bold, setBold]     = useState(false);
  const [italic, setItalic] = useState(false);
  const [found, setFound]   = useState(true);

  // Read the field's current text/style off the canvas once on mount —
  // same "read at mount time" pattern the old EventPanel used; by the time
  // this tab is visible the canvas has already been built.
  useEffect(() => {
    const c = fabricRef.current; if (!c) return;
    const obj = c.getObjects().find(o => o.name === name);
    if (!obj) { setFound(false); return; }
    setText(obj.text || '');
    setFont(obj.fontFamily || 'Playfair Display');
    setSize(Math.round(obj.fontSize) || 24);
    setBold(obj.fontWeight === 'bold');
    setItalic(obj.fontStyle === 'italic');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withObj = (fn) => {
    const c = fabricRef.current; if (!c) return;
    const obj = c.getObjects().find(o => o.name === name);
    if (!obj) return;
    fn(obj, c);
  };

  const applyText   = (v) => { setText(v); withObj((obj, c) => { obj.set('text', v); c.renderAll(); }); };
  const applyFont   = (v) => { setFont(v); withObj((obj, c) => { obj.set('fontFamily', v); c.renderAll(); }); };
  const applySize   = (v) => { const n = +v || 1; setSize(n); withObj((obj, c) => { obj.set('fontSize', n); c.renderAll(); }); };
  const toggleBold  = () => { const v = !bold; setBold(v); withObj((obj, c) => { obj.set('fontWeight', v ? 'bold' : 'normal'); c.renderAll(); }); };
  const toggleItalic = () => { const v = !italic; setItalic(v); withObj((obj, c) => { obj.set('fontStyle', v ? 'italic' : 'normal'); c.renderAll(); }); };

  if (!found) return null; // template doesn't have this field (shouldn't normally happen — every builder creates all five)

  return (
    <div style={CARD_STYLE}>
      <span style={sL}>{label}</span>
      {multiline ? (
        <textarea value={text} onChange={e => applyText(e.target.value)} rows={4} placeholder={placeholder}
          style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
      ) : (
        <input value={text} onChange={e => applyText(e.target.value)} placeholder={placeholder}
          style={{ ...inp, marginBottom: 8 }} />
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <select value={font} onChange={e => applyFont(e.target.value)} title="Font family" style={{
          flex: 1, minWidth: 0, padding: '7px 6px', border: `1.5px solid ${COLORS.border}`,
          borderRadius: 6, fontSize: '0.78rem', background: '#fff', color: COLORS.text,
        }}>
          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <input type="number" min="8" max="140" value={size} onChange={e => applySize(e.target.value)} title="Font size"
          style={{ width: 52, padding: '7px 4px', border: `1.5px solid ${COLORS.border}`, borderRadius: 6, fontSize: '0.8rem', textAlign: 'center' }} />
        <button onClick={toggleBold} title="Bold" style={{
          width: 30, height: 30, flexShrink: 0,
          background: bold ? '#000000' : '#f9fafb',
          border: `1.5px solid ${bold ? '#000000' : COLORS.border}`, borderRadius: 6,
          cursor: 'pointer', fontWeight: 'bold', fontSize: '0.86rem', color: bold ? '#ffffff' : COLORS.text,
        }}>B</button>
        <button onClick={toggleItalic} title="Italic" style={{
          width: 30, height: 30, flexShrink: 0,
          background: italic ? '#000000' : '#f9fafb',
          border: `1.5px solid ${italic ? '#000000' : COLORS.border}`, borderRadius: 6,
          cursor: 'pointer', fontStyle: 'italic', fontSize: '0.86rem', color: italic ? '#ffffff' : COLORS.text,
        }}>I</button>
      </div>
    </div>
  );
}

export default function EventTextPanel({ fabricRef, activeLang, translating, onTranslate }) {
  const getActive = () => fabricRef.current?.getActiveObject();
  const boldSel      = () => { const o = getActive(); if (o) { o.set('fontWeight', o.fontWeight === 'bold' ? 'normal' : 'bold');   fabricRef.current.renderAll(); } };
  const italicSel     = () => { const o = getActive(); if (o) { o.set('fontStyle', o.fontStyle === 'italic' ? 'normal' : 'italic'); fabricRef.current.renderAll(); } };
  const underlineSel  = () => { const o = getActive(); if (o) { o.set('underline', !o.underline);                                   fabricRef.current.renderAll(); } };
  const setSizeSel    = (v) => { const o = getActive(); if (o) { o.set('fontSize', +v);           fabricRef.current.renderAll(); } };
  const setColorSel   = (v) => { const o = getActive(); if (o) { o.set('fill', v);                fabricRef.current.renderAll(); } };
  const setFontSel    = (v) => { const o = getActive(); if (o) { o.set('fontFamily', v);          fabricRef.current.renderAll(); } };

  function addText() {
    const c = fabricRef.current; if (!c) return;
    // Named custom_text_<timestamp> so the translate button above (which
    // only touches a known set of named text objects) can find and
    // translate any text box added here too.
    const box = new window.fabric.Textbox('New Text', {
      left: c.width / 2, top: c.height / 2, originX: 'center',
      fontFamily: 'Playfair Display', fontSize: 30, fill: '#7c2d12',
      width: c.width * 0.7, textAlign: 'center',
      name: `custom_text_${Date.now()}`, selectable: true, evented: true,
    });
    c.add(box);
    c.setActiveObject(box);
    c.renderAll();
  }

  return (
    <div style={{ margin: '-14px -16px', padding: '14px 16px', minHeight: 'calc(100% + 28px)', background: 'linear-gradient(155deg, #f1f0ee, #dcdad5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <IconBadge icon="📅" />
        <div style={{ color: COLORS.text, fontWeight: '700', fontSize: '1.08rem' }}>Event &amp; Text</div>
      </div>
      <div style={{ color: COLORS.textMuted, fontSize: '0.84rem', marginBottom: 14 }}>
        Edit each field's text and font below — or double-click anything directly on the canvas.
      </div>

      {/* Language — merged in from the old Languages panel so translating
          and editing text live in one place. Grouped into its own card
          (see CARD_STYLE) so it reads as a distinct step from the field
          editors below rather than blending into one long scroll. */}
      {onTranslate && (
        <div style={CARD_STYLE}>
          <span style={sL}>Language</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
            {LANGUAGES.map(lang => {
              const active = activeLang === lang.code;
              return (
                <button key={lang.code} onClick={() => onTranslate(lang.code)} disabled={translating} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 10px', borderRadius: 20, cursor: translating ? 'wait' : 'pointer',
                  border: `1.5px solid ${active ? '#000000' : COLORS.border}`,
                  background: active ? '#000000' : '#fff',
                  color: active ? '#ffffff' : COLORS.text,
                  fontSize: '0.84rem', fontWeight: active ? '700' : '500',
                }}>
                  <span>{lang.flag}</span>{lang.label}
                  {active && <span style={{ fontSize: '0.72rem' }}>✓</span>}
                </button>
              );
            })}
          </div>
          {translating && <div style={{ color: COLORS.textMuted, fontSize: '0.8rem' }}>Translating…</div>}
          <div style={{ color: COLORS.textFaint, fontSize: '0.75rem', marginTop: 4, lineHeight: 1.5 }}>
            Translates the title, date, time, description, sponsorship line, and any text boxes below — temple name/address always stay in English.
          </div>
        </div>
      )}

      {/* ── The five named template fields — content + their own font,
          each in its own card now instead of a bottom-border block ── */}
      {FIELD_DEFS.map(def => <FieldBlock key={def.name} fabricRef={fabricRef} def={def} />)}

      {/* ── Other Text — free-form text boxes / styling whatever's selected,
          grouped into one card so it visually separates from the named
          fields above. ── */}
      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <IconBadge icon="🔤" size={20} />
          <div style={{ color: COLORS.text, fontWeight: '700', fontSize: '0.95rem' }}>Other Text</div>
        </div>
        <div style={{ color: COLORS.textMuted, fontSize: '0.8rem', marginBottom: 12 }}>Click any other text on the canvas to style it, or add a new box below</div>

        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {[
            { l: 'B', style: { fontWeight: 'bold' },          fn: boldSel      },
            { l: 'I', style: { fontStyle: 'italic' },         fn: italicSel    },
            { l: 'U', style: { textDecoration: 'underline' }, fn: underlineSel },
          ].map(({ l, style, fn }) => (
            <button key={l} onClick={fn} style={{
              width: 40, height: 40, background: '#f9fafb',
              border: `1.5px solid ${COLORS.border}`, color: COLORS.text,
              borderRadius: 7, cursor: 'pointer', fontSize: '1.05rem', ...style,
            }}>{l}</button>
          ))}
        </div>

        <span style={sL}>Font Size</span>
        <input type="range" min="10" max="130" defaultValue="28"
          style={{ width: '100%', accentColor: '#000000', marginBottom: 14 }}
          onChange={e => setSizeSel(e.target.value)} />

        <span style={sL}>Text Color</span>
        <input type="color" defaultValue="#7c2d12"
          style={{ width: '100%', height: 38, border: `1px solid ${COLORS.border}`, cursor: 'pointer', borderRadius: 6, marginBottom: 14 }}
          onChange={e => setColorSel(e.target.value)} />

        <span style={sL}>Font Family</span>
        <select style={{ ...inp, marginBottom: 14 }} onChange={e => setFontSel(e.target.value)}>
          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        <button onClick={addText} style={{
          width: '100%', padding: '11px', background: GLOSS_BLACK, boxShadow: GLOSS_SHADOW,
          border: 'none', color: 'white', borderRadius: 8,
          cursor: 'pointer', fontWeight: 'bold', marginBottom: 6, fontSize: '0.95rem',
        }}>
          + Add Text
        </button>
        <div style={{ color: COLORS.textMuted, fontSize: '0.76rem', lineHeight: 1.5 }}>
          Added text boxes are also translated when you switch language above.
        </div>
      </div>
    </div>
  );
}
