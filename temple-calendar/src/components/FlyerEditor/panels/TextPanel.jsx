import React from 'react';
import { FONTS, STYLES } from '../constants';

const { sectionLabel: sL, input: inp } = STYLES;

export default function TextPanel({ fabricRef }) {
  const getActive = () => fabricRef.current?.getActiveObject();

  const bold       = () => { const o = getActive(); if (o) { o.set('fontWeight',  o.fontWeight  === 'bold'   ? 'normal' : 'bold');   fabricRef.current.renderAll(); } };
  const italic     = () => { const o = getActive(); if (o) { o.set('fontStyle',   o.fontStyle   === 'italic' ? 'normal' : 'italic'); fabricRef.current.renderAll(); } };
  const underline  = () => { const o = getActive(); if (o) { o.set('underline',   !o.underline);                                      fabricRef.current.renderAll(); } };
  const setSize    = (v) => { const o = getActive(); if (o) { o.set('fontSize',   +v);           fabricRef.current.renderAll(); } };
  const setColor   = (v) => { const o = getActive(); if (o) { o.set('fill',       v);            fabricRef.current.renderAll(); } };
  const setFont    = (v) => { const o = getActive(); if (o) { o.set('fontFamily', v);            fabricRef.current.renderAll(); } };

  const addText = () => {
    const c = fabricRef.current; if (!c) return;
    c.add(new window.fabric.Textbox('New Text', {
      left: c.width / 2, top: c.height / 2, originX: 'center',
      fontFamily: 'Georgia', fontSize: 30, fill: '#7c2d12',
      width: c.width * 0.7, textAlign: 'center',
    }));
    c.renderAll();
  };

  const deleteSelected = () => {
    const c = fabricRef.current;
    const o = c?.getActiveObject();
    if (o) { c.remove(o); c.renderAll(); }
  };

  return (
    <div>
      <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.95rem', marginBottom: 4 }}>✏️ Text</div>
      <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 14 }}>Click any text on canvas to select</div>

      {/* Style buttons */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
        {[
          { l: 'B', style: { fontWeight: 'bold' },            fn: bold      },
          { l: 'I', style: { fontStyle: 'italic' },           fn: italic    },
          { l: 'U', style: { textDecoration: 'underline' },   fn: underline },
        ].map(({ l, style, fn }) => (
          <button key={l} onClick={fn} style={{
            width: 38, height: 38, background: '#0f172a',
            border: '1.5px solid #334155', color: 'white',
            borderRadius: 7, cursor: 'pointer', fontSize: '0.95rem', ...style,
          }}>{l}</button>
        ))}
      </div>

      <span style={sL}>Font Size</span>
      <input type="range" min="10" max="130" defaultValue="28"
        style={{ width: '100%', accentColor: '#c2410c', marginBottom: 14 }}
        onChange={e => setSize(e.target.value)} />

      <span style={sL}>Text Color</span>
      <input type="color" defaultValue="#7c2d12"
        style={{ width: '100%', height: 38, border: 'none', cursor: 'pointer', borderRadius: 6, marginBottom: 14 }}
        onChange={e => setColor(e.target.value)} />

      <span style={sL}>Font Family</span>
      <select style={{ ...inp, marginBottom: 14 }} onChange={e => setFont(e.target.value)}>
        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>

      <button onClick={addText} style={{
        width: '100%', padding: '10px', background: '#c2410c',
        border: 'none', color: 'white', borderRadius: 8,
        cursor: 'pointer', fontWeight: 'bold', marginBottom: 8, fontSize: '0.85rem',
      }}>
        + Add Text
      </button>

      <button onClick={deleteSelected} style={{
        width: '100%', padding: '10px', background: 'transparent',
        border: '1px solid #dc2626', color: '#f87171',
        borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem',
      }}>
        🗑 Delete Selected
      </button>
    </div>
  );
}
