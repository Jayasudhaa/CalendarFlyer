import React, { useState } from 'react';
import { BarChart, Calendar, Download, Upload, Users, Plus } from 'lucide-react';

function AdminDashboard({ events, onBulkImport, onShowAddEvent }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [importData, setImportData] = useState('');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  const stats = {
    totalEvents: events.length,
    thisMonth: events.filter(e => {
      // Bare 'YYYY-MM-DD' parses as UTC midnight, which lands on the
      // *previous* local day in every US timezone (see CalendarGrid.jsx,
      // which already works around this the same way) — an event dated
      // the 1st of this month was silently dropping out of "This Month"
      // for anyone west of UTC.
      const eventDate = new Date(e.date + 'T12:00:00');
      const now = new Date();
      return eventDate.getMonth() === now.getMonth() &&
             eventDate.getFullYear() === now.getFullYear();
    }).length,
    upcoming: events.filter(e => new Date(e.date + 'T12:00:00') > new Date()).length,
    byType: events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {})
  };

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const json = JSON.parse(text);
          setImportData(JSON.stringify(json, null, 2));
        } catch (error) {
          alert('❌ Invalid JSON file\n\n' + error.message);
        }
      };
      reader.readAsText(file);
    }
  };

  // Panchang exports have { date, tithi, nakshatra, moonPhase? } instead of a
  // "title" — without this, every row gets silently rejected by the server
  // (title + date are required) and the import looks like it did nothing.
  function normalizeImportEvents(rawEvents) {
    return rawEvents.map(ev => {
      if (ev && !ev.title && (ev.tithi || ev.nakshatra)) {
        return {
          ...ev,
          type: ev.type || 'panchang',
          title: [ev.tithi, ev.nakshatra].filter(Boolean).join(' — '),
          moon_phase: ev.moonPhase || ev.moon_phase || null,
        };
      }
      return ev;
    });
  }

  async function handleBulkImport() {
    let eventsToImport;
    try {
      eventsToImport = JSON.parse(importData);
    } catch (error) {
      alert('❌ Error parsing JSON:\n\n' + error.message + '\n\nMake sure the file is valid JSON.');
      return;
    }
    if (!Array.isArray(eventsToImport)) {
      alert('❌ Data must be an array of events.\n\nExpected format: [{"id":"...","date":"2026-01-01",...}]');
      return;
    }
    setImporting(true);
    setImportStatus(`Importing 0/${eventsToImport.length}…`);
    try {
      const result = await onBulkImport(
        normalizeImportEvents(eventsToImport),
        ({ done, total }) => setImportStatus(`Importing ${done}/${total}…`)
      );
      if (result && result.success) {
        const parts = [`${result.added} added`];
        if (result.skipped) parts.push(`${result.skipped} already on the calendar (skipped)`);
        if (result.rejected) parts.push(`${result.rejected} failed`);
        let msg = `✅ Import complete: ${parts.join(', ')}.`;
        // Surface *why* rows failed instead of just a bare count -- most
        // often this is the plan's monthly event limit, which looks
        // identical to a malformed row without the actual server message.
        if (result.rejected && result.rejectReasons) {
          const reasons = Object.entries(result.rejectReasons)
            .map(([msg, count]) => `${count}× "${msg}"`)
            .join('; ');
          if (reasons) msg += ` Reason(s): ${reasons}`;
        }
        setImportStatus(msg);
        setImportData('');
      } else {
        setImportStatus('❌ Import failed. Please try again.');
      }
    } catch (err) {
      setImportStatus('❌ Import failed: ' + (err.message || 'unknown error'));
    } finally {
      setImporting(false);
    }
  };

  function exportEvents() {
    const json = JSON.stringify(events, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temple-events-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ background: "var(--cf-bg-surface)", borderRadius:16, boxShadow:"0 8px 32px rgba(0,0,0,0.08)", padding:24, marginBottom:24, border:"1px solid var(--cf-border)" }}>
      <h2 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:"1.5rem", fontWeight:700, color:"var(--cf-text-primary)", marginBottom:24, letterSpacing:"0.03em" }}>Admin Dashboard</h2>

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:24, borderBottom:"1px solid var(--cf-border)" }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{ padding:'6px 16px', borderBottom: activeTab==='overview' ? '2px solid #000000' : '2px solid transparent', color: activeTab==='overview' ? '#000000' : '#71717a', fontWeight:600, cursor:'pointer', background:'none', border:'none', fontFamily:"'DM Sans', sans-serif" }}
        >
          <BarChart className="w-4 h-4 inline mr-2" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('import')}
          style={{ padding:'6px 16px', color: activeTab==='import' ? '#000000' : '#71717a', fontWeight:600, cursor:'pointer', background:'none', border:'none', borderBottom: activeTab==='import' ? '2px solid #000000' : '2px solid transparent', fontFamily:"'DM Sans', sans-serif" }}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          Import/Export
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* ADD EVENT BUTTON - NEW */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-black">Statistics</h3>
            <button
              onClick={onShowAddEvent}
              style={{ background:"linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)", color:"#fff", padding:"10px 20px", borderRadius:10, border:"none", fontWeight:700, fontSize:"0.9rem", cursor:"pointer", display:"flex", alignItems:"center", gap:8, boxShadow:"0 3px 10px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)" }}
            >
              <Plus className="w-5 h-5" />
              Add New Event
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div style={{ background:"#fafafa", border:"1px solid var(--cf-border)", borderRadius:12, padding:16, boxShadow:"0 4px 16px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize:"2rem", fontWeight:700, color:"#000000" }}>{stats.totalEvents}</div>
              <div style={{ fontSize:"0.8rem", color:"#52525b" }}>Total Events</div>
            </div>
            <div style={{ background:"#fafafa", border:"1px solid var(--cf-border)", borderRadius:12, padding:16, boxShadow:"0 4px 16px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize:"2rem", fontWeight:700, color:"#000000" }}>{stats.thisMonth}</div>
              <div style={{ fontSize:"0.8rem", color:"#52525b" }}>This Month</div>
            </div>
            <div style={{ background:"#fafafa", border:"1px solid var(--cf-border)", borderRadius:12, padding:16, boxShadow:"0 4px 16px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize:"2rem", fontWeight:700, color:"#000000" }}>{stats.upcoming}</div>
              <div style={{ fontSize:"0.8rem", color:"#52525b" }}>Upcoming</div>
            </div>
            <div style={{ background:"#fafafa", border:"1px solid var(--cf-border)", borderRadius:12, padding:16, boxShadow:"0 4px 16px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize:"2rem", fontWeight:700, color:"#000000" }}>{Object.keys(stats.byType).length}</div>
              <div style={{ fontSize:"0.8rem", color:"#52525b" }}>Event Types</div>
            </div>
          </div>

          <div style={{ background:"#fafafa", border:"1px solid var(--cf-border)", borderRadius:12, padding:16, maxWidth:340, margin:"0 auto", boxShadow:"0 4px 16px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontWeight:700, marginBottom:12, color:"#000000", textAlign:"center" }}>Events by Type</h3>
            <div className="space-y-2">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="capitalize" style={{ color:"#000000" }}>{type}</span>
                  <span style={{ background:"rgba(0,0,0,0.06)", color:"#000000", padding:"2px 12px", borderRadius:12, fontSize:"0.8rem", fontWeight:600, border:"1px solid rgba(0,0,0,0.15)" }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Import/Export Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div>
            <h3 style={{ fontWeight:700, marginBottom:12, color:"#000000" }}>Export Events</h3>
            <p className="text-sm text-gray-700 mb-3">
              Download all events as JSON for backup or migration
            </p>
            <button
              onClick={exportEvents}
              style={{ background:"linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)", color:"#fff", boxShadow:"0 3px 10px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)" }}
              className="px-6 py-2 rounded flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export All Events
            </button>
          </div>

          <div className="border-t pt-6" style={{ borderColor:"var(--cf-border)" }}>
            <h3 style={{ fontWeight:700, marginBottom:12, color:"#000000" }}>Import Events</h3>
            <p className="text-sm text-gray-700 mb-3">
              Upload a JSON file or paste JSON data to bulk import events
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color:"#000000" }}>Upload JSON File</label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-black hover:file:bg-gray-200"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color:"#000000" }}>Or Paste JSON Data</label>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder='[{"id": "event-1", "date": "2026-01-01", "title": "Event Name", ...}]'
                className="w-full h-64 p-3 border rounded font-mono text-sm"
                style={{ borderColor:"var(--cf-border)", color:"#000000" }}
              />
            </div>

            <button
              onClick={handleBulkImport}
              disabled={!importData || importing}
              style={!importData || importing ? { background:"#a1a1aa", color:"#fff", cursor:"not-allowed" } : { background:"linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)", color:"#fff", boxShadow:"0 3px 10px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)" }}
              className="px-6 py-2 rounded flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importing…' : 'Import Events'}
            </button>

            {importStatus && (
              <p className={`mt-3 text-sm font-medium ${importStatus.startsWith('❌') ? 'text-red-600' : importStatus.startsWith('✅') ? 'text-green-700' : 'text-gray-700'}`}>
                {importStatus}
              </p>
            )}

            <div className="mt-4 bg-gray-50 border rounded p-4" style={{ borderColor:"var(--cf-border)" }}>
              <p className="text-sm" style={{ color:"#27272a" }}>
                <strong style={{ color:"#000000" }}>✓ Smart Import:</strong> The system automatically detects the year from your file and only imports matching events.
                Events from wrong years are blocked. Duplicates (same date+type+title) are skipped.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Settings tab intentionally removed — it only had non-functional
          placeholder fields (Temple Name/Address/Phone used defaultValue
          with no save handler, so nothing typed there was ever persisted)
          plus an unconfirmed "Clear All Events" button with no confirm()
          dialog, which was a real risk of wiping every event and panchang
          entry on a single misclick. Real org info editing lives on the
          dedicated Settings page; bulk-clearing events is no longer
          exposed anywhere in the UI — only per-event Edit/Delete (from the
          calendar) and Import (Import/Export tab, which only adds/skips
          duplicates, never removes anything) can change event data now. */}
    </div>
  );
}

export default AdminDashboard;
