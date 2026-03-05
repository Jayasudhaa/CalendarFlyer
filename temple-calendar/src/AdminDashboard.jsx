import React, { useState } from 'react';
import { BarChart, Calendar, Download, Upload, Users, Settings } from 'lucide-react';

function AdminDashboard({ events, onBulkImport, onClearAll }) {
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

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('[AdminDashboard] File selected:', file.name, file.size, 'bytes');
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          console.log('[AdminDashboard] File read, length:', text?.length || 0);
          const json = JSON.parse(text);
          console.log('[AdminDashboard] JSON parsed successfully:', Array.isArray(json) ? json.length : 'not array', 'events');
          setImportData(JSON.stringify(json, null, 2));
        } catch (error) {
          console.error('[AdminDashboard] JSON parse error:', error);
          alert('❌ Invalid JSON file\n\n' + error.message);
        }
      };
      reader.onerror = (e) => {
        console.error('[AdminDashboard] File read error:', e);
        alert('❌ Error reading file');
      };
      reader.readAsText(file);
    }
  };

  const handleBulkImport = () => {
    console.log('[AdminDashboard] Starting bulk import, data length:', importData?.length || 0);
    try {
      const eventsToImport = JSON.parse(importData);
      console.log('[AdminDashboard] Parsed events:', Array.isArray(eventsToImport) ? eventsToImport.length : 'not array');
      if (Array.isArray(eventsToImport)) {
        console.log('[AdminDashboard] Calling onBulkImport with', eventsToImport.length, 'events');
        onBulkImport(eventsToImport);
        setImportData('');
        // Success message shown by App.jsx with year protection info
      } else {
        alert('❌ Data must be an array of events.\n\nExpected format: [{"id":"...","date":"2026-01-01",...}]');
      }
    } catch (error) {
      console.error('[AdminDashboard] Bulk import error:', error);
      alert('❌ Error parsing JSON:\n\n' + error.message + '\n\nMake sure the file is valid JSON.');
    }
  };

  const exportEvents = () => {
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
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <h2 className="text-2xl font-bold text-orange-700 mb-6">Admin Dashboard</h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 ${activeTab === 'overview' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-gray-600'}`}
        >
          <BarChart className="w-4 h-4 inline mr-2" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 ${activeTab === 'import' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-gray-600'}`}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          Import/Export
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 ${activeTab === 'settings' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-gray-600'}`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Settings
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{stats.totalEvents}</div>
              <div className="text-sm text-gray-600">Total Events</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{stats.thisMonth}</div>
              <div className="text-sm text-gray-600">This Month</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">{stats.upcoming}</div>
              <div className="text-sm text-gray-600">Upcoming</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">{Object.keys(stats.byType).length}</div>
              <div className="text-sm text-gray-600">Event Types</div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold mb-3">Events by Type</h3>
            <div className="space-y-2">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center">
                  <span className="capitalize">{type}</span>
                  <span className="bg-orange-100 px-3 py-1 rounded-full text-sm">{count}</span>
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
            <h3 className="font-bold mb-3">Export Events</h3>
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
            <h3 className="font-bold mb-3">Import Events</h3>
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
            <h3 className="font-bold mb-3">Temple Information</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Temple Name</label>
                <input
                  type="text"
                  defaultValue="Sri Venkateswara Swamy Temple of Colorado"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  defaultValue="1495 South Ridge Road, Castle Rock, CO 80104"
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
            <h3 className="font-bold mb-3">Admin Password</h3>
            <p className="text-sm text-gray-600 mb-3">
              Change the admin access password
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Current Password</label>
                <input
                  type="password"
                  placeholder="Enter current password"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <button className="bg-orange-600 text-white px-6 py-2 rounded hover:bg-orange-700">
                Update Password
              </button>
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
