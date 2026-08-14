/**
 * SyncChatbotModal.jsx
 * Modal for syncing events and panchang data to WhatsApp Chatbot
 */
import React from 'react';

export default function SyncChatbotModal({ events, syncStatus, syncMessage, setSyncStatus, setSyncMessage, onClose }) {
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

  const cardStyle = {
    background: 'linear-gradient(145deg,#1c0e04,#231206)',
    border: '1px solid rgba(201,148,58,0.25)',
    borderRadius: 12, padding: '18px 20px', marginBottom: 14,
  };
  const badgeBase = {
    fontSize: 10, fontWeight: 800, padding: '3px 9px',
    borderRadius: 4, letterSpacing: '.06em',
  };
  const sectionTitle = {
    fontSize: 15, fontWeight: 700, color: '#f5e6c8',
    fontFamily: "'Playfair Display',Georgia,serif",
  };
  const descStyle = {
    fontSize: 12.5, color: '#c9b99a', marginBottom: 14, lineHeight: 1.7,
  };
  const btnBase = {
    width: '100%', padding: '12px 16px', borderRadius: 8,
    fontWeight: 800, fontSize: 13.5, cursor: isSyncing ? 'not-allowed' : 'pointer',
    fontFamily: "'Playfair Display',Georgia,serif",
    letterSpacing: '0.02em', border: 'none',
    opacity: isSyncing ? 0.6 : 1,
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'linear-gradient(160deg,#150800,#1e0e02)', border:'1px solid rgba(201,148,58,0.35)', borderRadius:18, maxWidth:520, width:'100%', overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,148,58,0.15)' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1a0800,#2d1200)', borderBottom:'1px solid rgba(201,148,58,0.2)', padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:19, fontWeight:800, color:'#fde68a', fontFamily:"'Playfair Display',Georgia,serif", letterSpacing:'0.02em' }}>
              🤖 Sync to WhatsApp Chatbot
            </div>
            <div style={{ fontSize:12.5, color:'#c9943a', marginTop:4, fontWeight:600 }}>
              {allEvents.length} events ready to sync
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', color:'#c9943a', cursor:'pointer', fontSize:16, lineHeight:1, width:34, height:34, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding:'22px 24px' }}>

          {/* S3 Export */}
          <div style={cardStyle}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <span style={{ ...badgeBase, background:'rgba(201,148,58,0.15)', border:'1px solid rgba(201,148,58,0.4)', color:'#f5a623' }}>TECHNIQUE 1</span>
              <span style={sectionTitle}>S3 Export (.txt)</span>
            </div>
            <div style={descStyle}>
              Formats events into Lambda-compatible .txt files and uploads to S3. Chatbot picks up changes on next cold start (~60 sec).
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={handleS3Sync} disabled={isSyncing}
                style={{ ...btnBase, flex:1, background:'linear-gradient(135deg,#92400e,#b45309)', color:'#fef3c7', boxShadow:'0 4px 14px rgba(180,83,9,0.4)' }}>
                {isSyncing ? '⏳ Syncing...' : '☁️ Upload to S3'}
              </button>
              <button onClick={handleDownloadTxt} disabled={isSyncing}
                style={{ ...btnBase, width:'auto', padding:'12px 16px', background:'rgba(201,148,58,0.12)', border:'1px solid rgba(201,148,58,0.35)', color:'#f5a623', fontSize:13 }}>
                💾 Download
              </button>
            </div>
          </div>

          {/* DynamoDB Live */}
          <div style={cardStyle}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <span style={{ ...badgeBase, background:'rgba(15,118,110,0.2)', border:'1px solid rgba(20,184,166,0.4)', color:'#2dd4bf' }}>TECHNIQUE 4</span>
              <span style={sectionTitle}>DynamoDB (Live)</span>
            </div>
            <div style={descStyle}>
              Writes events directly to DynamoDB <code style={{ color:'#f5a623', background:'rgba(201,148,58,0.1)', padding:'1px 6px', borderRadius:3 }}>temple-events</code> table. Chatbot answers are updated immediately — no cold start wait.
            </div>
            <button onClick={handleDynamoSync} disabled={isSyncing}
              style={{ ...btnBase, background:'linear-gradient(135deg,#0f766e,#0d9488)', color:'#ccfbf1', boxShadow:'0 4px 14px rgba(13,148,136,0.4)' }}>
              {isSyncing ? '⏳ Writing to DynamoDB...' : '⚡ Sync Live (DynamoDB)'}
            </button>
          </div>

          {/* Panchang */}
          <div style={{ ...cardStyle, marginBottom: syncStatus && syncStatus !== 'syncing' ? 14 : 0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <span style={{ ...badgeBase, background:'rgba(139,92,246,0.2)', border:'1px solid rgba(167,139,250,0.4)', color:'#c4b5fd' }}>PANCHANG</span>
              <span style={sectionTitle}>Panchang Data</span>
            </div>
            <div style={descStyle}>
              Syncs tithi, nakshatra data to <code style={{ color:'#f5a623', background:'rgba(201,148,58,0.1)', padding:'1px 6px', borderRadius:3 }}>temple-panchang</code> table. Shows on public calendar across all devices.
            </div>
            <button onClick={handlePanchangSync} disabled={isSyncing}
              style={{ ...btnBase, background:'linear-gradient(135deg,#5b21b6,#7c3aed)', color:'#ede9fe', boxShadow:'0 4px 14px rgba(124,58,237,0.4)' }}>
              {isSyncing ? '⏳ Syncing...' : '🔱 Sync Panchang'}
            </button>
          </div>

          {/* Status message */}
          {syncStatus && syncStatus !== 'syncing' && (
            <div style={{ background:statusBg, border:`1px solid ${statusColor}50`, borderRadius:10, padding:'13px 16px', fontSize:13, color:statusColor, lineHeight:1.6, fontWeight:600 }}>
              {syncMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
