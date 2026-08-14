/**
 * AddEventModal Component
 * Modal form for adding new events
 */
import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

const EVENT_TYPES = ['pooja', 'festival', 'holiday', 'kalyanam', 'abhishekam', 'panchang'];

function AddEventModal({ onSave, onClose, defaultDate }) {
  const [form, setForm] = useState({
    title: '',
    date: defaultDate || '',
    time: '',
    type: 'pooja',
    tithi: '',
    nakshatra: '',
    description: ''
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
      <div style={{ background:"linear-gradient(160deg,#fdf6e9,#fef9f0)", borderRadius:20, boxShadow:"0 24px 60px rgba(0,0,0,0.3)", width:"100%", maxWidth:520, border:"1px solid #d4af37", animation:'slideIn 0.25s ease-out' }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#b83a0a,#8a2c08)", color:"#fff", padding:"18px 20px", borderRadius:"20px 20px 0 0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <h2 style={{ fontSize:"1.15rem", fontWeight:700, display:"flex", alignItems:"center", gap:8, fontFamily:"Cinzel,Georgia,serif", letterSpacing:"0.02em" }}>
            <Plus className="w-5 h-5" /> Add New Event
          </h2>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", padding:8, borderRadius:8, cursor:"pointer" }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding:"20px 24px 24px" }}>
          {/* Title */}
          <div>
            <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#6b2d0a", marginBottom:4 }}>Event Title *</label>
            <input name="title" value={form.title} onChange={handleChange} required autoFocus
              style={{ width:"100%", padding:"9px 12px", border:"1px solid #d4af37", borderRadius:8, fontSize:"0.9rem", background:"#fffdf7", color:"#3d2008", boxSizing:"border-box", outline:"none" }}
              placeholder="Enter event title" />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#6b2d0a", marginBottom:4 }}>Date *</label>
              <input name="date" type="date" value={form.date} onChange={handleChange} required
                style={{ width:"100%", padding:"9px 12px", border:"1px solid #d4af37", borderRadius:8, fontSize:"0.9rem", background:"#fffdf7", color:"#3d2008", boxSizing:"border-box", outline:"none" }} />
            </div>
            <div>
              <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#6b2d0a", marginBottom:4 }}>Time</label>
              <input name="time" value={form.time} onChange={handleChange}
                style={{ width:"100%", padding:"9px 12px", border:"1px solid #d4af37", borderRadius:8, fontSize:"0.9rem", background:"#fffdf7", color:"#3d2008", boxSizing:"border-box", outline:"none" }}
                placeholder="e.g. 10:00 AM" />
            </div>
          </div>

          {/* Type */}
          <div>
            <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#6b2d0a", marginBottom:4 }}>Event Type *</label>
            <select name="type" value={form.type} onChange={handleChange}
              style={{ width:"100%", padding:"9px 12px", border:"1px solid #d4af37", borderRadius:8, fontSize:"0.9rem", background:"#fffdf7", color:"#3d2008", boxSizing:"border-box", outline:"none" }}>
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Tithi + Nakshatra */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#6b2d0a", marginBottom:4 }}>Tithi</label>
              <input name="tithi" value={form.tithi} onChange={handleChange}
                style={{ width:"100%", padding:"9px 12px", border:"1px solid #d4af37", borderRadius:8, fontSize:"0.9rem", background:"#fffdf7", color:"#3d2008", boxSizing:"border-box", outline:"none" }}
                placeholder="e.g. Ekadashi" />
            </div>
            <div>
              <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#6b2d0a", marginBottom:4 }}>Nakshatra</label>
              <input name="nakshatra" value={form.nakshatra} onChange={handleChange}
                style={{ width:"100%", padding:"9px 12px", border:"1px solid #d4af37", borderRadius:8, fontSize:"0.9rem", background:"#fffdf7", color:"#3d2008", boxSizing:"border-box", outline:"none" }}
                placeholder="e.g. Rohini" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#6b2d0a", marginBottom:4 }}>Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={2}
              style={{ width:"100%", padding:"9px 12px", border:"1px solid #d4af37", borderRadius:8, fontSize:"0.9rem", background:"#fffdf7", color:"#3d2008", resize:"none", boxSizing:"border-box", outline:"none" }}
              placeholder="Optional details..." />
          </div>

          {/* Actions */}
          <div style={{ display:"flex", gap:12, paddingTop:8 }}>
            <button type="button" onClick={onClose}
              style={{ flex:1, padding:"10px 16px", border:"1px solid #e8d5a3", borderRadius:8, color:"#b97a3a", background:"#fff", fontWeight:600, cursor:"pointer", fontSize:"0.9rem" }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              style={{ flex:1, padding:"10px 16px", background:"linear-gradient(135deg,#c2410c,#9a3412)", border:"none", color:"#fff", borderRadius:8, fontWeight:700, cursor:"pointer", fontSize:"0.9rem", display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:"0 4px 12px rgba(180,80,0,0.25)" }}>
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
