/**
 * SyncChatbotModal.jsx
 * Modal for syncing events and panchang data to WhatsApp Chatbot
 */
import React from 'react';

export default function SyncChatbotModal({ events, syncStatus, syncMessage, setSyncStatus, setSyncMessage, onClose, inline = false }) {
  const nonPanchang = events.filter(e => e.type !== 'panchang');
  const allEvents   = events;

  // Format events as .txt matching Lambda data_raw format
  function formatAsTxt(eventsArr) {
    const byMonth = {};
    eventsArr.forEach(ev => {
      if (!ev.date) return;
      const d = new Date(ev.date + 'T12:00:00');
      const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(ev);
    });
    let txt = '';
    Object.entries(byMonth).forEach(([monthYear, evs]) => {
      txt += `${monthYear} EVENTS\n\n${'═'.repeat(55)}\n\n`;
      evs.sort((a,b) => a.date.localeCompare(b.date)).forEach(ev => {
        const d = new Date(ev.date + 'T12:00:00');
        const dateStr = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }).toUpperCase();
        txt += `${dateStr} - ${(ev.title || '').toUpperCase()}\n\n`;
        if (ev.time) txt += `Time: ${ev.time}\n`;
        if (ev.description) txt += `${ev.description}\n`;
        txt += `\n${'═'.repeat(55)}\n\n`;
      });
    });
    return txt;
  }

  async function handleS3Sync() {
    setSyncStatus('syncing');
    setSyncMessage('Exporting events and uploading to S3...');
    try {
      const txt = formatAsTxt(nonPanchang);
      const res = await fetch('/api/chat/sync-s3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('cf_token')}` },
        body: JSON.stringify({ events_txt: txt, event_count: nonPanchang.length })
      });
      const data = await res.json();
      if (res.ok) {
        setSyncStatus('success');
        setSyncMessage(`✅ ${nonPanchang.length} events synced to S3. Chatbot will pick up changes within 60 seconds.`);
      } else {
        setSyncStatus('error');
        setSyncMessage(`❌ S3 sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage(`❌ Network error: ${e.message}`);
    }
  }

  async function handleDynamoSync() {
    setSyncStatus('syncing');
    setSyncMessage('Writing events to DynamoDB...');
    try {
      const res = await fetch('/api/chat/sync-dynamo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('cf_token')}` },
        body: JSON.stringify({ events: events })
      });
      const data = await res.json();
      if (res.ok) {
        setSyncStatus('success');
        setSyncMessage(`✅ ${allEvents.length} events written to DynamoDB (including panchang). Chatbot answers are live immediately.`);
      } else {
        setSyncStatus('error');
        setSyncMessage(`❌ DynamoDB sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage(`❌ Network error: ${e.message}`);
    }
  }

  async function handlePanchangSync() {
    setSyncStatus('syncing');
    setSyncMessage('Syncing panchang to DynamoDB...');
    try {
      const res = await fetch('/api/chat/sync-panchang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('cf_token')}` },
        body: JSON.stringify({ events: events })
      });
      const data = await res.json();
      if (res.ok) {
        setSyncStatus('success');
        setSyncMessage(`✅ ${data.written} panchang entries synced to DynamoDB.`);
      } else {
        setSyncStatus('error');
        setSyncMessage(`❌ Panchang sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      setSyncStatus('error');
      setSyncMessage(`❌ Network error: ${e.message}`);
    }
  }

  function handleDownloadTxt() {
    const txt = formatAsTxt(nonPanchang);
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temple_events_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setSyncStatus('success');
    setSyncMessage(`✅ Downloaded ${nonPanchang.length} events as .txt — upload to S3 data_raw/Events/ folder in Lambda.`);
  }

  const statusColor = syncStatus === 'success' ? '#86efac' : syncStatus === 'error' ? '#fca5a5' : '#fde68a';
  const statusBg    = syncStatus === 'success' ? '#14532d40' : syncStatus === 'error' ? '#7f1d1d40' : '#78350f40';
  const isSyncing   = syncStatus === 'syncing';

  // Black & white redesign (was a dark brown/gold theme) — matches the
  // glossy black accent already rolled out on the toolbar, flyer editor,
  // and My Profile page. Technique badges are all uniform black pills now
  // instead of orange/teal/purple — differentiated by label only.
  const GLOSS_BLACK = 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)';
  const GLOSS_SHADOW = '0 3px 10px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)';
  const tagStyle = { color: '#111827', background: '#f3f4f6', padding: '1px 6px', borderRadius: 3 };

  const cardStyle = {
    background: '#ffffff',
    border: '1px solid #e5e5e6',
    borderRadius: 12, padding: '18px 20px', marginBottom: 14,
  };
  // Badges now carry the same gloss highlight as the header/buttons instead
  // of a flat fill — a thin white sheen over the black base.
  const badgeBase = {
    fontSize: 10, fontWeight: 800, padding: '3px 9px',
    borderRadius: 4, letterSpacing: '.06em',
    background: GLOSS_BLACK, color: '#ffffff',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22)',
  };
  const sectionTitle = {
    fontSize: 15, fontWeight: 700, color: '#111827',
    fontFamily: "'Playfair Display',Georgia,serif",
  };
  // Was gray (#6b7280) at 12.5px — now black and larger per feedback.
  const descStyle = {
    fontSize: 14, color: '#000000', marginBottom: 14, lineHeight: 1.7,
  };
  const btnBase = {
    width: '100%', padding: '12px 16px', borderRadius: 8,
    fontWeight: 800, fontSize: 13.5, cursor: isSyncing ? 'not-allowed' : 'pointer',
    fontFamily: "'Playfair Display',Georgia,serif",
    letterSpacing: '0.02em', border: 'none',
    opacity: isSyncing ? 0.6 : 1,
  };

  // Body content — the three sync techniques + status message — shared by
  // both the popup (original) and inline (embedded directly in a Settings
  // tab, per request, instead of behind an "Open Sync Chatbot" button)
  // presentations below.
  const body = (
    <>
      {/* S3 Export */}
      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <span style={{ ...badgeBase }}>TECHNIQUE 1</span>
          <span style={sectionTitle}>S3 Export (.txt)</span>
        </div>
        <div style={descStyle}>
          Formats events into Lambda-compatible .txt files and uploads to S3. Chatbot picks up changes on next cold start (~60 sec).
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={handleS3Sync} disabled={isSyncing}
            style={{ ...btnBase, flex:1, background:GLOSS_BLACK, color:'#fff', boxShadow:GLOSS_SHADOW }}>
            {isSyncing ? '⏳ Syncing...' : '☁️ Upload to S3'}
          </button>
          <button onClick={handleDownloadTxt} disabled={isSyncing}
            style={{ ...btnBase, width:'auto', padding:'12px 16px', background:'#fff', border:'1px solid #d1d5db', color:'#111827', fontSize:13 }}>
            💾 Download
          </button>
        </div>
      </div>

      {/* DynamoDB Live */}
      <div style={cardStyle}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <span style={{ ...badgeBase }}>TECHNIQUE 4</span>
          <span style={sectionTitle}>DynamoDB (Live)</span>
        </div>
        <div style={descStyle}>
          Writes events directly to DynamoDB <code style={tagStyle}>temple-events</code> table. Chatbot answers are updated immediately — no cold start wait.
        </div>
        <button onClick={handleDynamoSync} disabled={isSyncing}
          style={{ ...btnBase, background:GLOSS_BLACK, color:'#fff', boxShadow:GLOSS_SHADOW }}>
          {isSyncing ? '⏳ Writing to DynamoDB...' : '⚡ Sync Live (DynamoDB)'}
        </button>
      </div>

      {/* Panchang */}
      <div style={{ ...cardStyle, marginBottom: syncStatus && syncStatus !== 'syncing' ? 14 : 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <span style={{ ...badgeBase }}>PANCHANG</span>
          <span style={sectionTitle}>Panchang Data</span>
        </div>
        <div style={descStyle}>
          Syncs tithi, nakshatra data to <code style={tagStyle}>temple-panchang</code> table. Shows on public calendar across all devices.
        </div>
        <button onClick={handlePanchangSync} disabled={isSyncing}
          style={{ ...btnBase, background:GLOSS_BLACK, color:'#fff', boxShadow:GLOSS_SHADOW }}>
          {isSyncing ? '⏳ Syncing...' : '🔱 Sync Panchang'}
        </button>
      </div>

      {/* Status message */}
      {syncStatus && syncStatus !== 'syncing' && (
        <div style={{ background:statusBg, border:`1px solid ${statusColor}50`, borderRadius:10, padding:'13px 16px', fontSize:13, color:statusColor, lineHeight:1.6, fontWeight:600 }}>
          {syncMessage}
        </div>
      )}
    </>
  );

  // Inline: embedded directly in the Settings "Sync Chatbot" tab — no
  // backdrop, no floating card, no close button; it's just this tab's
  // content, not a dialog sitting on top of the page.
  if (inline) {
    return (
      <div>
        <div style={{ fontSize:13, color:'#6b7280', marginBottom:16 }}>
          {allEvents.length} events ready to sync
        </div>
        {body}
      </div>
    );
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'#ffffff', border:'1px solid #e5e5e6', borderRadius:18, maxWidth:520, width:'100%', overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.4)' }}>

        {/* Header — glossy black: a brighter top highlight + an inset
            bottom shadow so the sheen actually reads at a glance, matching
            the toolbar/flyer editor gloss recipe more closely than the
            first pass (which was too subtle to notice). */}
        <div style={{
          background:`linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 50%), linear-gradient(180deg,#0a0a0a,#000000)`,
          borderBottom:'1px solid rgba(255,255,255,0.1)',
          boxShadow:'inset 0 -10px 14px -10px rgba(0,0,0,0.6)',
          padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between',
        }}>
          <div>
            <div style={{ fontSize:19, fontWeight:800, color:'#fff', fontFamily:"'Playfair Display',Georgia,serif", letterSpacing:'0.02em' }}>
              🤖 Sync to WhatsApp Chatbot
            </div>
            <div style={{ fontSize:12.5, color:'#a8a29e', marginTop:4, fontWeight:600 }}>
              {allEvents.length} events ready to sync
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.14)', color:'#fff', cursor:'pointer', fontSize:16, lineHeight:1, width:34, height:34, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding:'22px 24px' }}>
          {body}
        </div>
      </div>
    </div>
  );
}
