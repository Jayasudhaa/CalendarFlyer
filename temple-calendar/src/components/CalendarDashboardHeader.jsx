/**
 * src/components/CalendarDashboardHeader.jsx
 * Page header for the admin calendar — big title, quick stats, search,
 * Month/List toggle, and a type filter. Modeled on the reference layout the
 * user supplied: title+subtitle on the left, search/toggle/filter on the
 * right, then a row of stat tiles with icon badges.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Search, SlidersHorizontal, CalendarDays, List, Users, Check, Link2 } from 'lucide-react';
import { getPublicCalendarUrl } from '../utils/rsvpUrl';

function StatCard({ icon, iconBg, value, label, delay }) {
  return (
    <div
      className="cf-stat-tile"
      style={{
        background: 'var(--cf-bg-surface)',
        border: '1px solid var(--cf-border)',
        borderRadius: 14,
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flex: 1,
        minWidth: 160,
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        animation: `cfStatIn 0.5s ease ${delay}ms both`,
      }}
    >
      <div style={{
        width: 50, height: 50, borderRadius: 13, flexShrink: 0,
        background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 4px 14px ${iconBg}66`,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--cf-text-primary)', lineHeight: 1, fontFamily: "'Playfair Display', Georgia, serif" }}>{value}</div>
        <div style={{ fontSize: '0.9rem', color: 'var(--cf-text-muted)', marginTop: 5, fontWeight: 700 }}>{label}</div>
      </div>
    </div>
  );
}

export default function CalendarDashboardHeader({
  eventsCount, thisWeekCount, rsvpOpenCount,
  search, onSearchChange,
  calView, onCalViewChange,
  allTypes, filterTypes, onToggleFilterType, onClearFilterTypes,
}) {
  const [showFilter, setShowFilter] = useState(false);
  const [copied, setCopied] = useState(false);
  const filterRef = useRef(null);

  // Same absolute-URL/?org= convention as AdminToolbar.jsx's "Public
  // Calendar" link and BroadcastPage.jsx's rsvpUrl -- just copied to the
  // clipboard instead of navigated to, since this is meant to be pasted
  // somewhere else (WhatsApp, email).
  function copyCalendarLink() {
    navigator.clipboard.writeText(getPublicCalendarUrl()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    function onDocClick(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const activeFilterCount = filterTypes.size;

  return (
    <div style={{ padding: '18px 16px 4px', position: 'relative' }}>
      <style>{`
        @keyframes cfStatIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .cf-stat-tile:hover { transform: translateY(-3px); box-shadow: 0 10px 26px rgba(0,0,0,0.1); }
        .cf-toggle-btn { transition: all 0.15s ease; }
        .cf-search-input:focus { box-shadow: 0 0 0 3px var(--cf-accent-glow); border-color: var(--cf-accent) !important; }
      `}</style>

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.3rem)', fontWeight: 800, color: 'var(--cf-text-primary)', margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>
            Monthly Calendar
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--cf-text-muted)', margin: '5px 0 0' }}>
            Plan, manage and publish your community events
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--cf-text-muted)', pointerEvents: 'none' }} />
            <input
              className="cf-search-input"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search events..."
              style={{
                padding: '9px 12px 9px 32px', borderRadius: 9, border: '1px solid var(--cf-border)',
                background: 'var(--cf-bg-surface)', color: 'var(--cf-text-primary)', fontSize: '0.85rem',
                outline: 'none', width: 200, transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
              }}
            />
          </div>

          {/* Month / List toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--cf-border)', borderRadius: 9, overflow: 'hidden' }}>
            <button
              className="cf-toggle-btn"
              onClick={() => onCalViewChange('month')}
              style={{
                padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                background: calView === 'month' ? 'var(--cf-bg-surface)' : 'transparent',
                color: calView === 'month' ? 'var(--cf-accent)' : 'var(--cf-text-muted)',
                boxShadow: calView === 'month' ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              }}
            >Month</button>
            <button
              className="cf-toggle-btn"
              onClick={() => onCalViewChange('list')}
              style={{
                padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
                background: calView === 'list' ? 'var(--cf-bg-surface)' : 'transparent',
                color: calView === 'list' ? 'var(--cf-accent)' : 'var(--cf-text-muted)',
                boxShadow: calView === 'list' ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            ><List size={13}/> List</button>
          </div>

          {/* Filter */}
          <div style={{ position: 'relative' }} ref={filterRef}>
            <button
              onClick={() => setShowFilter(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 9, border: `1px solid ${activeFilterCount ? 'var(--cf-accent)' : 'var(--cf-border)'}`,
                background: activeFilterCount ? 'var(--cf-accent-glow)' : 'var(--cf-bg-surface)',
                color: activeFilterCount ? 'var(--cf-accent)' : 'var(--cf-text-muted)',
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
              }}
            >
              <SlidersHorizontal size={14} /> Filter{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </button>
            {showFilter && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 60, width: 200,
                background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', borderRadius: 10,
                boxShadow: '0 12px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
              }}>
                <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--cf-text-muted)', borderBottom: '1px solid var(--cf-border)' }}>
                  Event type
                </div>
                {allTypes.map(t => {
                  const active = filterTypes.has(t.key);
                  return (
                    <button key={t.key} onClick={() => onToggleFilterType(t.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px',
                        background: 'none', border: 'none', borderBottom: '1px solid var(--cf-border)',
                        cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600,
                        color: 'var(--cf-text-primary)',
                      }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{t.label}</span>
                      {active && <Check size={13} color="var(--cf-accent)" />}
                    </button>
                  );
                })}
                {activeFilterCount > 0 && (
                  <button onClick={onClearFilterTypes} style={{
                    width: '100%', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: 700, color: 'var(--cf-accent)', textAlign: 'center',
                  }}>Clear filters</button>
                )}
              </div>
            )}
          </div>

          {/* Copy calendar link */}
          <button
            onClick={copyCalendarLink}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 9, border: `1px solid ${copied ? '#4ade80' : 'var(--cf-border)'}`,
              background: copied ? 'rgba(74,222,128,0.1)' : 'var(--cf-bg-surface)',
              color: copied ? '#16a34a' : 'var(--cf-text-muted)',
              cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
            }}
          >
            {copied ? <Check size={14} /> : <Link2 size={14} />} {copied ? 'Copied!' : 'Copy calendar link'}
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <StatCard
          icon={<CalendarDays size={22} color="#fff" />}
          iconBg="linear-gradient(135deg,#f97316,#ea580c)"
          value={eventsCount}
          label="Events"
          delay={0}
        />
        <StatCard
          icon={<CalendarDays size={22} color="#fff" />}
          iconBg="linear-gradient(135deg,#8b5cf6,#7c3aed)"
          value={thisWeekCount}
          label="This Week"
          delay={70}
        />
        <StatCard
          icon={<Users size={22} color="#fff" />}
          iconBg="linear-gradient(135deg,#10b981,#059669)"
          value={rsvpOpenCount}
          label="RSVPs Open"
          delay={140}
        />
      </div>
    </div>
  );
}
