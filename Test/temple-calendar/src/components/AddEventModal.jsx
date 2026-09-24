/**
 * AddEventModal Component
 * Modal form for adding new events
 */
import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

const EVENT_TYPES = ['pooja', 'festival', 'holiday', 'kalyanam', 'abhishekam', 'panchang'];

// Grey Glossy — approved after a side-by-side mockup ("show how grey glossy
// look" → "keep this"). Same black/white palette as before, but every input
// now sits inside its own small glass card (soft diagonal sheen + inset
// highlight) instead of a flat bordered box, and the header/primary button
// carry the same glossy sheen already used elsewhere in the app (Share &
// Publish, the poster-editor's glossy upload cards) — just in charcoal/black
// instead of gold.
const labelStyle = { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#1a1a1a', marginBottom: 5 };
const fieldWrap = {
  position: 'relative', borderRadius: 10, overflow: 'hidden',
  background: 'linear-gradient(160deg, #ffffff, #f2f2f2)',
  border: '1px solid rgba(20,20,20,0.16)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.85) inset, 0 2px 6px -3px rgba(0,0,0,0.18)',
};
const fieldInput = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: 'none', outline: 'none',
  background: 'transparent', fontSize: '0.9rem', color: '#171717', fontFamily: 'inherit',
};

function AddEventModal({ onSave, onClose, defaultDate }) {
  const [form, setForm] = useState({
    title: '',
    date: defaultDate || '',
    time: '',
    type: 'pooja',
    tithi: '',
    nakshatra: '',
    description: '',
    discoverability: 'org_only'
  });
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    onSave(form);
    setSaving(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:16, backdropFilter:"blur(4px)" }}>
      <div style={{
        background: 'linear-gradient(160deg, #fbfbfb 0%, #f0f0f0 55%, #e6e6e6 100%)',
        borderRadius: 20, width: '100%', maxWidth: 520,
        border: '1px solid rgba(20,20,20,0.18)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.7) inset, 0 28px 60px rgba(0,0,0,0.45)',
        animation: 'slideIn 0.25s ease-out',
      }}>

        {/* Header — glossy sheen (diagonal highlight over a charcoal-to-black
            gradient), same trick as the Share & Publish button elsewhere. */}
        <div style={{
          position: 'relative', padding: '18px 20px', color: '#fff',
          borderRadius: '20px 20px 0 0',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg, #4a4a4a, #1a1a1a)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize:"1.15rem", fontWeight:700, display:"flex", alignItems:"center", gap:8, fontFamily:"'Playfair Display', Georgia, serif", letterSpacing:"0.02em" }}>
            <Plus className="w-5 h-5" /> Add New Event
          </h2>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.16)", border:"1px solid rgba(255,255,255,0.25)", color:"#fff", padding:8, borderRadius:8, cursor:"pointer", display:'flex', alignItems:'center', justifyContent:'center' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding:"20px 24px 24px", display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Title */}
          <div>
            <label style={labelStyle}>Event Title *</label>
            <div style={fieldWrap}>
              <input name="title" value={form.title} onChange={handleChange} required autoFocus
                style={fieldInput} placeholder="Enter event title" />
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Date *</label>
              <div style={fieldWrap}>
                <input name="date" type="date" value={form.date} onChange={handleChange} required style={fieldInput} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Time</label>
              <div style={fieldWrap}>
                <input name="time" value={form.time} onChange={handleChange} style={fieldInput} placeholder="e.g. 10:00 AM" />
              </div>
            </div>
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>Event Type *</label>
            <div style={fieldWrap}>
              <select name="type" value={form.type} onChange={handleChange} style={fieldInput}>
                {EVENT_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tithi + Nakshatra */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Tithi</label>
              <div style={fieldWrap}>
                <input name="tithi" value={form.tithi} onChange={handleChange} style={fieldInput} placeholder="e.g. Ekadashi" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Nakshatra</label>
              <div style={fieldWrap}>
                <input name="nakshatra" value={form.nakshatra} onChange={handleChange} style={fieldInput} placeholder="e.g. Rohini" />
              </div>
            </div>
          </div>

          {/* Discoverability — Community Radar opt-in. Off by default: an
              event stays exactly where every event has always shown up
              (this org's own public calendar) unless the admin actively
              switches it on. */}
          <div>
            <label style={labelStyle}>Discoverability</label>
            <div style={{ ...fieldWrap, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <input
                type="checkbox"
                id="add-event-radar"
                checked={form.discoverability === 'radar'}
                onChange={(e) => setForm(prev => ({ ...prev, discoverability: e.target.checked ? 'radar' : 'org_only' }))}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: '#1a1a1a', cursor: 'pointer', flexShrink: 0 }}
              />
              <label htmlFor="add-event-radar" style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: '#171717' }}>Show on Explore</div>
                <div style={{ fontSize: '0.76rem', color: '#666', marginTop: 2, lineHeight: 1.4 }}>
                  Also surfaced to people outside your organization, browsing nearby events. Off = your public calendar only.
                </div>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <div style={fieldWrap}>
              <textarea name="description" value={form.description} onChange={handleChange} rows={2}
                style={{ ...fieldInput, resize: 'none', display: 'block' }}
                placeholder="Optional details..." />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:"flex", gap:12, paddingTop:6 }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '11px 16px', borderRadius: 10, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
              background: 'linear-gradient(160deg, #ffffff, #f2f2f2)',
              border: '1px solid rgba(20,20,20,0.18)', color: '#333',
              boxShadow: '0 1px 0 rgba(255,255,255,0.85) inset',
            }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{
              flex: 1, padding: '11px 16px', borderRadius: 10, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
              border: 'none', color: '#fff',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg, #4a4a4a, #141414)',
              boxShadow: '0 6px 16px -6px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Plus className="w-4 h-4" />
              {saving ? 'Adding...' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

export default AddEventModal;
