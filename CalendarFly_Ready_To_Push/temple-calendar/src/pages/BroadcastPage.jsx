import React, { useState, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';
const FONTS_LOADED_KEY = 'cf_broadcast_fonts';
function useBroadcastFonts() {
  useEffect(() => {
    if (document.getElementById('cf-broadcast-fonts')) return;
    const link = document.createElement('link');
    link.id = 'cf-broadcast-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);
}

const P = {
  get bg()     { return 'var(--cf-bg-base)' },
  get bg2()    { return '#fffdf9' },
  get card()   { return '#fffefc' },
  get border() { return '#e2cfa0' },
  get text()   { return '#2a1c0f' },
  get gold()   { return 'var(--cf-accent)' },
  get muted()  { return '#5c4326' },
  get faint()  { return '#7a5c34' },
  get deep()   { return '#faf3e2' },
};
const PLATFORMS = [
  { id:'whatsapp', label:'WhatsApp',      icon:'💬', color:'#25d366', description:'Temple community group',  setup:true  },
  { id:'facebook', label:'Facebook Page', icon:'📘', color:'#1877f2', description:'Needs FB_PAGE_TOKEN',      setup:false },
  { id:'instagram',label:'Instagram',     icon:'📸', color:'#e1306c', description:'Needs IG_ACCOUNT_ID',      setup:false },
];
const TEMPLATES = [
  { label:'🙏 Pooja Invite', text:`🪔 *Temple Pooja Ceremony*\n\nYou are warmly invited to join us for a sacred pooja ceremony.\n\n🌸 Sample Temple Name\n\n📋 RSVP & details: https://calendarflyapp.com/calendar` },
  { label:'🎉 Festival',     text:`🎊 *Festival Celebrations!*\n\nJoin our temple family for this auspicious occasion filled with devotion, culture, and community.\n\nAll are welcome! 🙏\n\n🌸 Sample Temple Name\n📋 RSVP: https://calendarflyapp.com/calendar` },
  { label:'📢 Announcement', text:`📢 *Important Announcement*\n\nPlease mark your calendars and share with your family and friends.\n\n🌸 Sample Temple Name\n📋 Details: https://calendarflyapp.com/calendar` },
];
const rsvpUrl = 'https://calendarflyapp.com/calendar';
const WA_TEMPLATES = [
  {
    id: 'temple_event_announcement',
    label: '🙏 Temple Event Announcement',
    description: 'Approved Meta template with event details + RSVP',
    vars: [
      { key: '{{1}}', label: 'Event Name',  placeholder: 'e.g. Hanuman Jayanti Celebration' },
      { key: '{{2}}', label: 'Date',         placeholder: 'e.g. May 12, 2026' },
      { key: '{{3}}', label: 'Time',         placeholder: 'e.g. 10:00 AM' },
      { key: '{{4}}', label: 'RSVP Link',    placeholder: 'https://calendarflyapp.com/rsvp/...' },
    ],
    preview: (v) => `Hello,\n🙏 *${v[0]||'{{1}}'}*\n📅 ${v[1]||'{{2}}'} at ${v[2]||'{{3}}'}\n📍 Sample Temple Name, Your City\n\nJoin us and receive blessings. RSVP here: ${v[3]||'{{4}}'}\n\nThank you`,
  },
];
export default function BroadcastPage({ onClose }) {
  const [selected, setSelected]         = useState({ whatsapp: true, facebook: false, instagram: false });
  const [caption,  setCaption]          = useState('');
  const [autoRSVP, setAutoRSVP]         = useState(true);
  const [uploadedMedia, setUploadedMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [copied, setCopied] = useState(false);
  const [status,   setStatus]           = useState({});
  const [errors,   setErrors]           = useState({});
  const [allDone,  setAllDone]          = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);
  // WhatsApp API Template state
  const [showWATemplate, setShowWATemplate]   = useState(false);
  const [selectedWATemplate, setSelectedWATemplate] = useState(WA_TEMPLATES[0]);
  const [waVars, setWaVars]                   = useState(['', '', '', rsvpUrl]);
  const [waSending, setWaSending]             = useState(false);
  const [waResult,  setWaResult]              = useState(null);
  useBroadcastFonts();

  function handleFileUpload(e) {
    const file = e.target.files[0]; if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => { setUploadedMedia(ev.target.result); setMediaType(file.type.startsWith('image/') ? 'image' : 'video'); };
    reader.readAsDataURL(file);
  };

  function removeMedia() { setUploadedMedia(null); setMediaType(null); };
  function copyLink() { navigator.clipboard.writeText(rsvpUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  function applyTemplate(tpl, idx) { setCaption(tpl.text); setActiveTemplate(idx); setShowTemplates(false); };

  const handleBroadcast = async () => {
    const platforms = Object.keys(selected).filter(k => selected[k]);
    if (!platforms.length) return;
    const finalCaption = autoRSVP && !caption.includes(rsvpUrl) ? `${caption}\n\n📋 RSVP: ${rsvpUrl}` : caption;
    
    const ns = {}; platforms.forEach(p => { ns[p] = 'sending'; });
    setStatus(ns); setErrors({}); setAllDone(false);
    await Promise.all(platforms.map(async (platform) => {
      try {
        const body = { platform, caption: finalCaption };
        if (uploadedMedia) body.imageBase64 = uploadedMedia;
        const res = await fetch('/api/broadcast', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Failed');
        setStatus(prev => ({ ...prev, [platform]: 'done' }));
      } catch (err) {
        setStatus(prev => ({ ...prev, [platform]: 'error' }));
        setErrors(prev => ({ ...prev, [platform]: err.message }));
    }
    }));
    
    setAllDone(true);
  };
  // Send approved WhatsApp template via API
  const handleWATemplateBroadcast = async () => {
    setWaSending(true); setWaResult(null);
    try {
      const res = await fetch('/api/broadcast/whatsapp-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('cf_token')}` },
        body: JSON.stringify({
          template_name: selectedWATemplate.id,
          variables: waVars,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to send template');
      setWaResult({ ok: true, message: `✅ Template sent to ${data.sent || 'recipients'} successfully!` });
    } catch (err) {
      setWaResult({ ok: false, message: `❌ ${err.message}` });
    } finally {
      setWaSending(false);
    }
  };
  const anySelected = Object.values(selected).some(Boolean);
  const isSending   = Object.values(status).some(s => s === 'sending');
  const allSuccess  = allDone && Object.keys(status).length > 0 && Object.values(status).every(s => s === 'done');
  const charCount   = caption.length;
  const charColor   = charCount > 950 ? '#ef4444' : charCount > 800 ? '#f59e0b' : P.faint;

  const card  = { background:P.card, border:`1px solid ${P.border}`, borderRadius:12, padding:'14px 16px', marginBottom:12, boxShadow:'0 2px 10px rgba(120,80,20,0.06), 0 1px 2px rgba(120,80,20,0.04)' };
  const lbl   = { fontSize:'0.68rem', color:P.muted, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8, fontFamily:"'Inter', system-ui, sans-serif" };

  function spill(type) {
    const m = { sending:{color:'#f59e0b',bg:'rgba(245,158,11,0.1)',label:'⏳ Sending'}, done:{color:'#4ade80',bg:'rgba(74,222,128,0.1)',label:'✓ Sent'}, error:{color:'#f87171',bg:'rgba(248,113,113,0.1)',label:'✗ Failed'} };
    const t = m[type]; if (!t) return null;
    return { color:t.color, background:t.bg, padding:'3px 10px', borderRadius:20, fontSize:'0.7rem', fontWeight:700, label:t.label };
  };

  return (

    <div style={{ position:'fixed', inset:0, zIndex:50, background:'linear-gradient(180deg, #fffdf7 0%, var(--cf-bg-base) 180px)', overflowY:'auto', fontFamily:"'Inter', system-ui, sans-serif" }}>

      <div style={{ position:'sticky', top:0, zIndex:10, background:'var(--cf-header-bg)', backdropFilter:'blur(8px)', borderBottom:'1px solid #c9943a55', boxShadow:'0 2px 12px rgba(0,0,0,0.15)', padding:'12px 22px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize:18 }}>📣</span>
              <div>
            <div style={{ color:P.text, fontWeight:700, fontSize:'1.15rem', fontFamily:"'Playfair Display', Georgia, serif" }}>Broadcast Studio</div>
            <div style={{ color:P.faint, fontSize:'0.68rem', letterSpacing:'0.08em', textTransform:'uppercase', fontFamily:"'Inter', system-ui, sans-serif", fontWeight:500 }}>Multi-Platform Distribution</div>
              </div>
            </div>
        <button onClick={onClose} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, color:'#f87171', cursor:'pointer', fontWeight:700, fontSize:'0.82rem', fontFamily:"'Inter', system-ui, sans-serif" }}>
          <X size={13} /> Close
            </button>
          </div>

      <style>{`
        @media (max-width: 640px) {
          .cf-broadcast-grid { grid-template-columns: 1fr !important; }
          .cf-broadcast-preview { display: none !important; }
          .cf-broadcast-sticky { position: static !important; }
        }
      `}</style>
      <div className="cf-broadcast-grid" style={{ maxWidth:960, margin:'0 auto', padding:'22px 18px', display:'grid', gridTemplateColumns:'1fr 300px', gap:18 }}>
        <div>
          {/* Platforms */}
          <div style={card}>
            <div style={lbl}>Platforms</div>
            {PLATFORMS.map(p => {
              const isOn = selected[p.id]; const st = status[p.id]; const pill = spill(st);
              return (
                <div key={p.id} onClick={() => !isSending && setSelected(prev => ({ ...prev, [p.id]:!prev[p.id] }))}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:9, marginBottom:6, border:`1.5px solid ${isOn ? p.color : P.border}`, background:isOn ? `${p.color}12` : P.bg, cursor:isSending?'default':'pointer', transition:'all 0.15s', opacity:!p.setup&&!isOn?0.6:1 }}>
                  <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${isOn?p.color:P.muted}`, background:isOn?p.color:'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.6rem', color:'#fff', fontWeight:900, flexShrink:0 }}>{isOn&&'✓'}</div>
                  <span style={{ fontSize:15 }}>{p.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ color:P.text, fontSize:'0.95rem', fontWeight:700, fontFamily:"'Playfair Display', Georgia, serif" }}>{p.label}</div>
                    <div style={{ color:P.muted, fontSize:'0.72rem', fontFamily:"'Inter', system-ui, sans-serif" }}>{p.description}</div>
                  </div>
                  {!p.setup && <span style={{ background:'rgba(245,158,11,0.12)', color:'#f59e0b', fontSize:'0.68rem', padding:'2px 8px', borderRadius:10, fontWeight:700 }}>Setup needed</span>}
                  {pill && <div style={pill}>{pill.label}</div>}
                </div>
              );
            })}
          </div>

            
              
          {/* Media */}
          <div style={card}>
            <div style={lbl}>📎 Attach Media (optional)</div>
                
                {!uploadedMedia ? (
              <label style={{ display:'block', border:`1.5px dashed ${P.border}`, borderRadius:9, padding:'20px', textAlign:'center', cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.borderColor=P.gold} onMouseLeave={e => e.currentTarget.style.borderColor=P.border}>
                <div style={{ fontSize:22, marginBottom:5 }}>🖼️</div>
                <div style={{ color:P.muted, fontSize:'0.82rem', fontWeight:600 }}>Click to upload image or video</div>
                <div style={{ color:P.faint, fontSize:'0.7rem', marginTop:3 }}>PNG, JPG, MP4 · Max 50MB</div>
                <input type="file" accept="image/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                ) : (
              <div style={{ position:'relative', borderRadius:9, overflow:'hidden' }}>
                {mediaType==='image' ? <img src={uploadedMedia} alt="Upload" style={{ width:'100%', maxHeight:200, objectFit:'cover', display:'block' }} /> : <video src={uploadedMedia} controls style={{ width:'100%', maxHeight:200 }} />}
                <button onClick={removeMedia} style={{ position:'absolute', top:8, right:8, width:26, height:26, borderRadius:'50%', background:'rgba(239,68,68,0.85)', border:'none', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={12} /></button>
                  </div>
                )}
              </div>

              {/* Caption */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={lbl}>✍️ Caption & Message</div>
              <button onClick={() => setShowTemplates(v => !v)} style={{ background:'none', border:'none', cursor:'pointer', color:P.gold, fontSize:'0.72rem', fontWeight:700, fontFamily:"'Inter', system-ui, sans-serif" }}>{showTemplates ? '▲ Hide' : '✨ Template'}</button>
                </div>
            {showTemplates && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {TEMPLATES.map((tpl, idx) => (
                  <button key={idx} onClick={() => applyTemplate(tpl, idx)} style={{ padding:'5px 11px', borderRadius:20, cursor:'pointer', border:`1px solid ${activeTemplate===idx ? P.gold : P.border}`, background:activeTemplate===idx ? 'rgba(196,163,90,0.15)' : P.card, color:activeTemplate===idx ? P.gold : P.muted, fontSize:'0.72rem', fontWeight:600, fontFamily:"'Inter', system-ui, sans-serif" }}>{tpl.label}</button>
                ))}
              </div>
            )}
            <textarea value={caption} onChange={e => { setCaption(e.target.value); setActiveTemplate(null); }}
              placeholder={`Write your broadcast message...\n\nExample:\n🙏 Join us for Sri Satyanarayana Swamy Pooja\n📅 March 2, 2026 at 10:00 AM\n📍 Sample Temple Name`}
              style={{ width:'100%', padding:'10px 12px', boxSizing:'border-box', background:P.deep, border:`1.5px solid ${P.border}`, borderRadius:9, color:P.text, fontSize:'0.82rem', lineHeight:1.75, resize:'vertical', outline:'none', fontFamily:"'Inter', system-ui, sans-serif", minHeight:120 }} />


            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <div style={{ color:P.faint, fontSize:'0.68rem' }}>*bold* for WhatsApp bold text</div>
              <div style={{ color:charColor, fontSize:'0.7rem', fontWeight:600 }}>{charCount} / 1024</div>
                </div>
              </div>

              {/* RSVP Link */}
          <div style={card}>
            <div style={lbl}>🔗 RSVP Link</div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ flex:1, background:P.deep, border:`1px solid ${P.border}`, borderRadius:9, padding:'9px 13px', display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ fontSize:13 }}>🔗</span>
                <span style={{ color:P.gold, fontSize:'0.78rem', fontFamily:'monospace' }}>{rsvpUrl}</span>
                  </div>
              <button onClick={copyLink} style={{ padding:'9px 13px', borderRadius:9, cursor:'pointer', background:copied?'rgba(74,222,128,0.1)':'rgba(196,163,90,0.1)', border:`1px solid ${copied?'#4ade80':P.gold}`, color:copied?'#4ade80':P.gold, fontWeight:700, fontSize:'0.78rem', display:'flex', alignItems:'center', gap:5, fontFamily:"'Inter', system-ui, sans-serif" }}>
                {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                  </button>
                </div>
            <label style={{ display:'flex', alignItems:'center', gap:7, marginTop:9, cursor:'pointer' }}>
              <input type="checkbox" checked={autoRSVP} onChange={e => setAutoRSVP(e.target.checked)} style={{ width:14, height:14, accentColor:P.gold }} />
              <span style={{ color:P.muted, fontSize:'0.76rem' }}>Auto-include RSVP link in message</span>
                </label>
              </div>

          {/* Errors */}
          {Object.keys(errors).length > 0 && (
            <div style={{ padding:'11px 13px', marginBottom:12, background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10 }}>
              {Object.entries(errors).map(([p, msg]) => <div key={p} style={{ color:'#fca5a5', fontSize:'0.77rem', marginBottom:3 }}><strong style={{ textTransform:'capitalize' }}>{p}:</strong> {msg}</div>)}
              <div style={{ color:P.faint, fontSize:'0.7rem', marginTop:5 }}>Check your API keys in App Runner environment variables.</div>
                </div>
          )}
          {/* Success */}
          {allSuccess && (
            <div style={{ padding:'13px', marginBottom:12, background:'rgba(74,222,128,0.06)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:10, textAlign:'center' }}>
              <div style={{ color:'#4ade80', fontWeight:800 }}>🎉 Broadcast sent successfully!</div>
              <div style={{ color:P.faint, fontSize:'0.74rem', marginTop:3 }}>Your community will receive the message shortly.</div>
            </div>
          )}

          {/* WhatsApp API Template */}
          <div style={{ padding:'12px 14px', marginBottom:12, background:'rgba(37,211,102,0.04)', border:'1.5px solid rgba(37,211,102,0.3)', borderRadius:11 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <div style={{ color:P.muted, fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>📋 WhatsApp API Template</div>
              <button onClick={() => setShowWATemplate(v => !v)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#4ade80', fontSize:'0.72rem', fontWeight:700, fontFamily:"'Inter', system-ui, sans-serif" }}>
                {showWATemplate ? '▲ Hide' : '▼ Use Template'}
              </button>
            </div>
            <div style={{ color:P.faint, fontSize:'0.72rem', marginBottom: showWATemplate ? 10 : 0, lineHeight:1.5 }}>
              Sends Meta-approved template directly via WhatsApp API to your recipient list.
            </div>
            {showWATemplate && (
              <div>
                {/* Template selector */}
                <div style={{ marginBottom:10 }}>
                  {WA_TEMPLATES.map(tpl => (
                    <div key={tpl.id} onClick={() => setSelectedWATemplate(tpl)}
                      style={{ padding:'8px 12px', borderRadius:8, marginBottom:5, border:`1.5px solid ${selectedWATemplate.id===tpl.id ? '#25d366' : P.border}`, background:selectedWATemplate.id===tpl.id ? 'rgba(37,211,102,0.08)' : P.bg, cursor:'pointer' }}>
                      <div style={{ color:P.text, fontSize:'0.82rem', fontWeight:700 }}>{tpl.label}</div>
                      <div style={{ color:P.faint, fontSize:'0.7rem' }}>{tpl.description}</div>
                    </div>
                  ))}
                </div>
                {/* Variable inputs */}
                <div style={{ marginBottom:10 }}>
                  {selectedWATemplate.vars.map((v, i) => (
                    <div key={i} style={{ marginBottom:7 }}>
                      <div style={{ color:P.muted, fontSize:'0.68rem', fontWeight:600, marginBottom:3 }}>{v.key} — {v.label}</div>
                      <input
                        value={waVars[i] || ''}
                        onChange={e => { const n=[...waVars]; n[i]=e.target.value; setWaVars(n); }}
                        placeholder={v.placeholder}
                        style={{ width:'100%', boxSizing:'border-box', padding:'8px 11px', background:P.deep, border:`1px solid ${P.border}`, borderRadius:8, color:P.text, fontSize:'0.8rem', outline:'none', fontFamily:"'Inter', system-ui, sans-serif" }}
                      />
                    </div>
                  ))}
                </div>
                {/* Live preview */}
                <div style={{ background:P.deep, border:`1px solid ${P.border}`, borderRadius:8, padding:'10px 12px', marginBottom:10, fontSize:'0.76rem', color:P.text, lineHeight:1.75, whiteSpace:'pre-wrap', fontFamily:"'Inter', system-ui, sans-serif" }}>
                  {selectedWATemplate.preview(waVars)}
                </div>
                {/* Result message */}
                {waResult && (
                  <div style={{ padding:'9px 12px', marginBottom:9, borderRadius:8, background: waResult.ok ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)', border:`1px solid ${waResult.ok ? '#4ade8040' : '#f8717140'}`, color: waResult.ok ? '#4ade80' : '#fca5a5', fontSize:'0.76rem', fontWeight:600 }}>
                    {waResult.message}
                  </div>
                )}
                <button onClick={handleWATemplateBroadcast} disabled={waSending}
                  style={{ width:'100%', padding:'10px', background: waSending ? P.border : 'linear-gradient(135deg,#25d366,#128c3e)', border:'none', borderRadius:9, color:'#fff', fontWeight:800, fontSize:'0.88rem', cursor: waSending ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, fontFamily:"'Inter', system-ui, sans-serif" }}>
                  {waSending ? '⏳ Sending Template…' : '📤 Send via WhatsApp API'}
                </button>
              </div>
            )}
          </div>
          {/* WhatsApp Broadcast List */}
          <div style={{ padding:'12px 14px', marginBottom:12, background:'rgba(37,211,102,0.06)', border:'1.5px solid rgba(37,211,102,0.25)', borderRadius:11 }}>
            <div style={{ color:P.muted, fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>💬 WhatsApp Broadcast List — No API Needed</div>
            <div style={{ color:P.faint, fontSize:'0.72rem', marginBottom:9, lineHeight:1.5 }}>Opens WhatsApp with your message pre-filled. Select your <strong style={{ color:'#4ade80' }}>Broadcast List</strong> and tap Send.</div>
            <button onClick={() => { const msg = caption ? (autoRSVP && !caption.includes(rsvpUrl) ? `${caption}\n\n📋 RSVP: ${rsvpUrl}` : caption) : `🙏 Temple Event Update\n\n📋 RSVP & details: ${rsvpUrl}`; window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank'); }}
              style={{ width:'100%', padding:'10px', background:'linear-gradient(135deg,#25d366,#128c3e)', border:'none', borderRadius:9, color:'#fff', fontWeight:800, fontSize:'0.88rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, fontFamily:"'Inter', system-ui, sans-serif" }}>
              💬 Open WhatsApp with Message
            </button>
          </div>
          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap:'wrap' }}>
            <button onClick={onClose} style={{ flex:'1 1 120px', padding:'11px', border:`1px solid ${P.border}`, background:'transparent', color:P.muted, borderRadius:10, cursor:'pointer', fontWeight:600, fontSize:'0.86rem', fontFamily:"'Inter', system-ui, sans-serif" }}>Cancel</button>
            <button onClick={handleBroadcast} disabled={!anySelected||isSending||allSuccess}
              style={{ flex:'2 1 160px', padding:'11px', border:'none', background:(!anySelected||isSending||allSuccess)?'#2a1508':'linear-gradient(135deg,#c2410c,#7c2d12)', color:(!anySelected||isSending||allSuccess)?P.faint:'#fff', borderRadius:10, cursor:(!anySelected||isSending||allSuccess)?'not-allowed':'pointer', fontWeight:800, fontSize:'0.9rem', fontFamily:"'Inter', system-ui, sans-serif" }}>
              {isSending ? '⏳ Broadcasting…' : allSuccess ? '✓ Done' : '📣 API Broadcast'}
            </button>
                </div>

                    </div>
        {/* RIGHT — Preview */}
                    <div className="cf-broadcast-preview">
          <div className="cf-broadcast-sticky" style={{ position:'sticky', top:70 }}>
            <div style={{ ...card, background:P.bg2, marginBottom:0, boxShadow:'0 4px 20px rgba(120,80,20,0.08), 0 1px 3px rgba(120,80,20,0.06)' }}>
              <div style={lbl}>📱 Live Preview</div>
              <div style={{ background:P.deep, borderRadius:10, padding:'13px', border:`1px solid ${P.border}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, paddingBottom:10, borderBottom:`1px solid ${P.border}` }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#25d366,#128c3e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>💬</div>
                  <div>
                    <div style={{ color:P.text, fontWeight:600, fontSize:'0.88rem', fontFamily:"'Playfair Display', Georgia, serif" }}>Temple WhatsApp</div>
                    <div style={{ color:P.faint, fontSize:'0.68rem' }}>Community Group</div>
                    </div>
                  </div>
                  
                <div style={{ background:P.card, borderRadius:'4px 10px 10px 10px', padding:'9px 11px' }}>
                  {uploadedMedia && (
                    <div style={{ borderRadius:7, overflow:'hidden', marginBottom:7 }}>
                      {mediaType==='image' ? <img src={uploadedMedia} alt="preview" style={{ width:'100%', maxHeight:130, objectFit:'cover', display:'block' }} /> : <video src={uploadedMedia} style={{ width:'100%', maxHeight:130 }} />}
                    </div>
                  )}
                  <div style={{ color:caption?P.text:P.faint, fontSize:'0.82rem', lineHeight:1.75, whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:"'Inter', system-ui, sans-serif" }}>{caption || 'Your message will appear here…'}</div>
                  
                  {autoRSVP && caption && !caption.includes(rsvpUrl) && (
                    <div style={{ marginTop:7, padding:'5px 9px', background:'rgba(196,163,90,0.1)', border:`1px solid ${P.border}`, borderRadius:6 }}>
                      <div style={{ color:P.gold, fontSize:'0.7rem', fontFamily:'monospace', wordBreak:'break-all' }}>📋 RSVP: {rsvpUrl}</div>
                    </div>
                  )}
                  <div style={{ color:P.faint, fontSize:'0.62rem', marginTop:5, textAlign:'right' }}>{new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })} ✓✓</div>
                </div>
              </div>

              <div style={{ marginTop:12 }}>
                <div style={lbl}>Sending to</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {PLATFORMS.map(p => (
                    <div key={p.id} style={{ padding:'3px 9px', borderRadius:20, background:selected[p.id]?`${p.color}18`:P.deep, border:`1px solid ${selected[p.id]?p.color:P.border}`, color:selected[p.id]?P.text:P.faint, fontSize:'0.7rem', fontWeight:600 }}>{p.icon} {p.label}</div>
                  
                  
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

