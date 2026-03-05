/**
 * Header Component
 * Temple information and authentication controls
 */

import React, { useState } from 'react';
import { Calendar, Lock, LogOut, Unlock, BarChart, Plus, TrendingUp, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAdminUrl, encodeEventId } from '../utils/rsvpUrl';

const Header = ({ onShowLogin, onShowDashboard, onShowAddEvent, events = [] }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [search, setSearch] = useState('');

  const templeInfo = {
    name: "Sri Venkateswara Swamy Temple of Colorado",
    address: "1495 South Ridge Road, Castle Rock, CO 80104",
    website: "www.svtempleco.org",
    phone: "303 660 9555",
    manager: "303 898 5514",
    email: "manager@svtempleco.org"
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  const openAnalytics = (event) => {
    const url = getAdminUrl(event);
    window.open(url, '_blank');
    setShowEventPicker(false);
    setSearch('');
  };
  const filteredEvents = events
    .filter(e => e.title?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Group by month
  const groupedByMonth = filteredEvents.reduce((acc, event) => {
    const d = new Date(event.date + 'T12:00:00');
    const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});
  return (
    <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 shadow-lg" style={{ position: 'relative' }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Temple Info */}
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calendar className="w-8 h-8" />
              {templeInfo.name}
            </h1>
            <p className="text-orange-100 mt-1">{templeInfo.address}</p>
            <div className="flex gap-4 mt-2 text-sm">
              <span>📞 {templeInfo.phone}</span>
              <span>👤 Manager: {templeInfo.manager}</span>
            </div>
          </div>

          {/* Auth Controls */}
          <div className="text-right">
            {!isAuthenticated() ? (
              <button
                onClick={onShowLogin}
                className="bg-white text-orange-600 px-6 py-3 rounded-lg hover:bg-orange-50 flex items-center gap-2 font-semibold shadow-lg transition-all hover:shadow-xl"
              >
                <Lock className="w-5 h-5" />
                Admin Login
              </button>
            ) : (
              <div className="space-y-2">
                {/* User Info */}
                <div className="flex items-center gap-2 justify-end bg-white bg-opacity-20 px-4 py-2 rounded-lg">
                  {user?.picture ? (
                    <img 
                      src={user.picture} 
                      alt={user.displayName}
                      className="w-8 h-8 rounded-full border-2 border-white"
                    />
                  ) : (
                  <Unlock className="w-4 h-4 text-green-300" />
                  )}
                  <div className="text-right">
                    <p className="font-semibold">{user?.displayName || 'Administrator'}</p>
                    <p className="text-xs text-orange-100">
                      {user?.authMethod === 'google' ? '🔑 Google' : '@' + (user?.username || 'admin')}
                    </p>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="flex gap-2 flex-wrap justify-end">
                  <button
                    onClick={onShowDashboard}
                    className="bg-white text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-50 flex items-center gap-2 font-medium transition-all"
                  >
                    <BarChart className="w-4 h-4" />
                    Dashboard
                  </button>
                  {/* RSVP Analytics button */}
                  <button
                    onClick={() => setShowEventPicker(true)}
                    className="bg-white text-purple-600 px-4 py-2 rounded-lg hover:bg-purple-50 flex items-center gap-2 font-medium transition-all"
                    style={{ boxShadow: '0 2px 8px rgba(124,58,237,0.25)' }}
                  >
                    <TrendingUp className="w-4 h-4" />
                    RSVP Analytics
                  </button>
                  <button
                    onClick={onShowAddEvent}
                    className="bg-white text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-50 flex items-center gap-2 font-medium transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Event
                  </button>
                  <button
                    onClick={handleLogout}
                    className="bg-white bg-opacity-90 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 flex items-center gap-2 font-medium transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ── Event picker modal ── */}
      {showEventPicker && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }} onClick={() => setShowEventPicker(false)}>
          <div style={{
            background: 'white', borderRadius: 14, width: '100%', maxWidth: 480,
            boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{
              padding: '18px 20px', borderBottom: '1px solid #f3f4f6',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(135deg,#7c3aed,#6366f1)',
            }}>
              <div>
                <div style={{ color: 'white', fontWeight: '700', fontSize: '1rem' }}>📊 RSVP Analytics</div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem', marginTop: 2 }}>
                  Select an event to view its dashboard
                </div>
              </div>
              <button onClick={() => setShowEventPicker(false)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                  borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: '1rem' }}>
                ✕
              </button>
            </div>
            {/* Search */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
              <input
                autoFocus
                placeholder="Search events…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb',
                  borderRadius: 8, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            {/* Event list */}
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {filteredEvents.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
                  No events found
                </div>
              ) : Object.entries(groupedByMonth).map(([month, monthEvents]) => (
                <div key={month}>
                  {/* Month header */}
                  <div style={{
                    padding: '8px 16px', background: '#f5f3ff',
                    borderBottom: '1px solid #ede9fe', borderTop: '1px solid #ede9fe',
                    fontSize: '0.7rem', fontWeight: '700', color: '#7c3aed',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>📅 {month}</span>
                    <span style={{ fontWeight: '400', color: '#a78bfa' }}>{monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Events in this month */}
                  {monthEvents.map(event => (
                <button key={event.id} onClick={() => openAnalytics(event)}
                  style={{
                        width: '100%', padding: '11px 16px 11px 24px', textAlign: 'left',
                    background: 'white', border: 'none', borderBottom: '1px solid #f9fafb',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#faf5ff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#111827' }}>
                      {event.title}
                    </div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 2 }}>
                          {new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
                          {event.time ? ` · ${event.time}` : ''}
                    </div>
                  </div>
                      <div style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: '600',
                        background: '#f5f3ff', padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>
                    View →
                  </div>
                </button>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 16px', background: '#fafafa',
              fontSize: '0.68rem', color: '#9ca3af', textAlign: 'center',
              borderTop: '1px solid #f3f4f6' }}>
              Opens in a new tab · Admin login required
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Header;
