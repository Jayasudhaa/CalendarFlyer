import React, { useState } from 'react';
import { BarChart, Calendar, Download, Upload, Users, Settings, Plus } from 'lucide-react';

function AdminDashboard({ events, onBulkImport, onClearAll, onShowAddEvent }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [importData, setImportData] = useState('');

  const stats = {
    totalEvents: events.length,
    thisMonth: events.filter(e => {
      const eventDate = new Date(e.date);
      const now = new Date();
      return eventDate.getMonth() === now.getMonth() && 
             eventDate.getFullYear() === now.getFullYear();
    }).length,
    upcoming: events.filter(e => new Date(e.date) > new Date()).length,
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

  function handleBulkImport() {
    try {
      const eventsToImport = JSON.parse(importData);
      if (Array.isArray(eventsToImport)) {
        onBulkImport(eventsToImport);
        setImportData('');
      } else {
        alert('❌ Data must be an array of events.\n\nExpected format: [{"id":"...","date":"2026-01-01",...}]');
      }
    } catch (error) {
      alert('❌ Error parsing JSON:\n\n' + error.message + '\n\nMake sure the file is valid JSON.');
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
      <h2 style={{ fontFamily:"Cinzel,Georgia,serif", fontSize:"1.5rem", fontWeight:700, color:"var(--cf-text-primary)", marginBottom:24, letterSpacing:"0.03em" }}>Admin Dashboard</h2>

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:24, borderBottom:"1px solid var(--cf-border)" }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{ padding:'6px 16px', borderBottom: activeTab==='overview' ? '2px solid #c2410c' : '2px solid transparent', color: activeTab==='overview' ? '#c2410c' : '#b97a3a', fontWeight:600, cursor:'pointer', background:'none', border:'none', fontFamily:'Georgia,serif' }}
        >
          <BarChart className="w-4 h-4 inline mr-2" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('import')}
          style={{ padding:'6px 16px', color: activeTab==='import' ? '#c2410c' : '#b97a3a', fontWeight:600, cursor:'pointer', background:'none', border:'none', borderBottom: activeTab==='import' ? '2px solid #c2410c' : '2px solid transparent', fontFamily:'Georgia,serif' }}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          Import/Export
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          style={{ padding:'6px 16px', color: activeTab==='settings' ? '#c2410c' : '#b97a3a', fontWeight:600, cursor:'pointer', background:'none', border:'none', borderBottom: activeTab==='settings' ? '2px solid #c2410c' : '2px solid transparent', fontFamily:'Georgia,serif' }}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Settings
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* ADD EVENT BUTTON - NEW */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800">Statistics</h3>
            <button
              onClick={onShowAddEvent}
              style={{ background:"linear-gradient(135deg,#c2410c,#9a3412)", color:"#fff", padding:"10px 20px", borderRadius:10, border:"none", fontWeight:700, fontSize:"0.9rem", cursor:"pointer", display:"flex", alignItems:"center", gap:8, boxShadow:"0 4px 16px rgba(180,80,0,0.25)" }}
            >
              <Plus className="w-5 h-5" />
              Add New Event
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div style={{ background:"linear-gradient(135deg,#fffdf7,#fff8ee)", border:"1px solid #d4af37", borderRadius:12, padding:16, boxShadow:"0 4px 16px rgba(180,120,0,0.08)" }}>
              <div style={{ fontSize:"2rem", fontWeight:700, color:"#c2410c" }}>{stats.totalEvents}</div>
              <div style={{ fontSize:"0.8rem", color:"#b97a3a" }}>Total Events</div>
            </div>
            <div style={{ background:"linear-gradient(135deg,#fffdf7,#fff8ee)", border:"1px solid #d4af37", borderRadius:12, padding:16, boxShadow:"0 4px 16px rgba(180,120,0,0.08)" }}>
              <div style={{ fontSize:"2rem", fontWeight:700, color:"#b45309" }}>{stats.thisMonth}</div>
              <div style={{ fontSize:"0.8rem", color:"#b97a3a" }}>This Month</div>
            </div>
            <div style={{ background:"linear-gradient(135deg,#fffdf7,#fff8ee)", border:"1px solid #d4af37", borderRadius:12, padding:16, boxShadow:"0 4px 16px rgba(180,120,0,0.08)" }}>
              <div style={{ fontSize:"2rem", fontWeight:700, color:"#8B4513" }}>{stats.upcoming}</div>
              <div style={{ fontSize:"0.8rem", color:"#b97a3a" }}>Upcoming</div>
            </div>
            <div style={{ background:"linear-gradient(135deg,#fffdf7,#fff8ee)", border:"1px solid #d4af37", borderRadius:12, padding:16, boxShadow:"0 4px 16px rgba(180,120,0,0.08)" }}>
              <div style={{ fontSize:"2rem", fontWeight:700, color:"#c2410c" }}>{Object.keys(stats.byType).length}</div>
              <div style={{ fontSize:"0.8rem", color:"#b97a3a" }}>Event Types</div>
            </div>
          </div>

          <div style={{ background:"linear-gradient(135deg,#fffdf7,#fff8ee)", border:"1px solid #e8d5a3", borderRadius:12, padding:16 }}>
            <h3 style={{ fontWeight:700, marginBottom:12, color:"#6b2d0a" }}>Events by Type</h3>
            <div className="space-y-2">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="capitalize">{type}</span>
                  <span style={{ background:"rgba(194,65,12,0.1)", color:"#c2410c", padding:"2px 12px", borderRadius:12, fontSize:"0.8rem", fontWeight:600, border:"1px solid rgba(194,65,12,0.2)" }}>{count}</span>
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
            <h3 style={{ fontWeight:700, marginBottom:12, color:"#6b2d0a" }}>Export Events</h3>
            <p className="text-sm text-gray-600 mb-3">
              Download all events as JSON for backup or migration
            </p>
            <button
              onClick={exportEvents}
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export All Events
            </button>
          </div>

          <div className="border-t pt-6">
            <h3 style={{ fontWeight:700, marginBottom:12, color:"#6b2d0a" }}>Import Events</h3>
            <p className="text-sm text-gray-600 mb-3">
              Upload a JSON file or paste JSON data to bulk import events
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Upload JSON File</label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Or Paste JSON Data</label>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder='[{"id": "event-1", "date": "2026-01-01", "title": "Event Name", ...}]'
                className="w-full h-64 p-3 border rounded font-mono text-sm"
              />
            </div>

            <button
              onClick={handleBulkImport}
              disabled={!importData}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import Events
            </button>

            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-4">
              <p className="text-sm text-yellow-800">
                <strong>✓ Smart Import:</strong> The system automatically detects the year from your file and only imports matching events. 
                Events from wrong years are blocked. Duplicates (same date+type+title) are skipped.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div>
            <h3 style={{ fontWeight:700, marginBottom:12, color:"#6b2d0a" }}>Temple Information</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Temple Name</label>
                <input
                  type="text"
                  defaultValue="Sample Temple Name"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  defaultValue="123 Main Street, Your City, ST 00000"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    defaultValue="303 660 9555"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Manager Phone</label>
                  <input
                    type="text"
                    defaultValue="303 898 5514"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">

            <h3 className="font-bold mb-3 text-red-700">⚠️ Danger Zone</h3>
            <button 
              onClick={onClearAll}
              className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 transition-colors font-semibold"
            >
              🗑️ Clear All Events
            </button>
            <p className="text-sm text-red-600 mt-2 font-medium">
              ⚠️ Warning: This will delete ALL {events.length} events permanently. This action cannot be undone. Make sure to export your data first!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
