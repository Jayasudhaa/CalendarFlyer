/**
 * src/pages/RSVPAdmin.jsx
 * RSVP Analytics Dashboard
 * - Monthly rollup: Yes/No/Maybe + guest count per event
 * - Per-event detail view
 * - Key format: YYYY-MM-DD-title-slug (stable, no localStorage ID needed)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Download, RefreshCw, Search, Trash2, X, TrendingUp, Calendar } from 'lucide-react';
import { useEvents } from '../hooks/useEvents';

const API = import.meta.env.VITE_API_URL || '';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'TempleAdmin2026!';

// ── Stable event key: YYYY-MM-DD-title-slug ───────────────────────────────────
const slugify = (text) =>
  (text || '').toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');

const getEventKey = (event) => `${event.date}-${slugify(event.title)}`;
// ── Fetch RSVP data for one event ─────────────────────────────────────────────
const fetchRSVPForEvent = async (event) => {
  const key = getEventKey(event);
  const res = await fetch(`${API}/api/rsvp/${key}`, {
    credentials: 'include',
    headers: { 'x-admin-secret': ADMIN_SECRET },
  });
  if (!res.ok) throw new Error(`Failed: ${key}`);
  return res.json();
};
export default function RSVPAdmin() {
  const { events } = useEvents();
  // ── Tab: 'monthly' | 'detail' ───────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('monthly');
  // ── Monthly view state ──────────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState('');
  const [monthlyData, setMonthlyData]     = useState([]); // [{ event, rsvp }]
  const [monthLoading, setMonthLoading]   = useState(false);
  // ── Per-event detail state ──────────────────────────────────────────────────
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [rsvpData, setRsvpData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError,   setDetailError]   = useState('');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [eventSearch, setEventSearch] = useState('');

  // ── Derive available months from events ─────────────────────────────────────
  const availableMonths = React.useMemo(() => {
    const seen = new Set();
    const months = [];
    events
      .filter(e => e.type !== 'panchang' && e.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(e => {
        const key = e.date.slice(0, 7); // YYYY-MM
        if (!seen.has(key)) {
          seen.add(key);
          const d = new Date(e.date + 'T12:00:00');
          months.push({
            key,
            label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          });
        }
      });
    return months;
  }, [events]);
  // Auto-select current month on load
  useEffect(() => {
    if (availableMonths.length && !selectedMonth) {
      const now = new Date();
      const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const match = availableMonths.find(m => m.key === currentKey);
      setSelectedMonth(match ? match.key : availableMonths[0].key);
    }
  }, [availableMonths]);
  // ── Fetch monthly data whenever selectedMonth changes ───────────────────────
  useEffect(() => {
    if (!selectedMonth || !events.length) return;
    const monthEvents = events.filter(
      e => e.type !== 'panchang' && e.date?.startsWith(selectedMonth)
    );
    if (!monthEvents.length) { setMonthlyData([]); return; }
    setMonthLoading(true);
    Promise.all(
      monthEvents.map(async (event) => {
        try {
          const rsvp = await fetchRSVPForEvent(event);
          return { event, rsvp };
        } catch {
          return { event, rsvp: { items: [], totalCount: 0 } };
        }
      })
    ).then(results => {
      setMonthlyData(results);
      setMonthLoading(false);
    });
  }, [selectedMonth, events]);
  // ── Group events for sidebar ─────────────────────────────────────────────────
  const groupedEvents = React.useMemo(() => {
    const filtered = events.filter(e => 
      e.type !== 'panchang' &&
      e.title.toLowerCase().includes(eventSearch.toLowerCase())
    );

    const groups = {};
    filtered.forEach(event => {
      const d = new Date(event.date + 'T12:00:00');
      const mk = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (!groups[mk]) groups[mk] = [];
      groups[mk].push(event);
      });
    
    return Object.entries(groups).sort((a, b) =>
      new Date(b[1][0].date + 'T12:00:00') - new Date(a[1][0].date + 'T12:00:00')
    );
  }, [events, eventSearch]);

  // ── Per-event fetch ──────────────────────────────────────────────────────────
  const fetchDetail = useCallback(async (event) => {
    setDetailLoading(true);
    setDetailError('');
    try {
      const data = await fetchRSVPForEvent(event);
      setRsvpData(data);
    } catch (err) {
      setDetailError(err.message);
      setRsvpData({ items: [], totalCount: 0 });
    } finally {
      setDetailLoading(false);
    }
  }, []);
  const handleEventSelect = (event) => {
    setSelectedEvent(event);
    setActiveTab('detail');
    fetchDetail(event);
  };

  const handleDelete = async (rsvpId, name) => {
    if (!window.confirm(`Remove RSVP for ${name}?`)) return;
    setDeleting(rsvpId);
    try {
      await fetch(`${API}/api/rsvp/${getEventKey(selectedEvent)}/${rsvpId}`, {
      method: 'DELETE',
        credentials: 'include',
        headers: { 'x-admin-secret': ADMIN_SECRET },
    });
      fetchDetail(selectedEvent);
    } catch { alert('Failed to delete RSVP'); }
    finally { setDeleting(null); }
  };

  const exportCSV = () => {
    if (!rsvpData?.items?.length) return;
    const rows = [
      ['Name', 'Guests', 'Attending', 'Phone', 'Notes', 'Submitted At'],
      ...rsvpData.items.map(i => [
        i.name, i.count, i.attending || 'yes',
        i.phone || '', i.notes || '',
        new Date(i.createdAt).toLocaleString(),
      ]),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `rsvp_${selectedEvent?.title?.replace(/\s+/g, '_') || 'event'}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const filtered = rsvpData?.items?.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const stats = {
    totalRsvps: rsvpData?.items?.length || 0,
    totalGuests: rsvpData?.totalCount || 0,
    avgPartySize: rsvpData?.items?.length 
      ? (rsvpData.totalCount / rsvpData.items.length).toFixed(1) : '0',
    yesCount: rsvpData?.items?.filter(i => i.attending === 'yes')?.length || 0,
    noCount: rsvpData?.items?.filter(i => i.attending === 'no')?.length || 0,
    maybeCount: rsvpData?.items?.filter(i => i.attending === 'maybe')?.length || 0,
    yesGuests:  rsvpData?.items?.filter(i => i.attending === 'yes')
                  ?.reduce((s, i) => s + (i.count || 0), 0) || 0,
  };

  // ── Monthly totals ────────────────────────────────────────────────────────────
  const monthTotals = monthlyData.reduce((acc, { rsvp }) => {
    (rsvp.items || []).forEach(item => {
      const a = item.attending || 'yes';
      const c = item.count || 0;
      if (a === 'yes')   { acc.yes += c; acc.yesRsvps++; }
      if (a === 'no')    { acc.no  += c; acc.noRsvps++;  }
      if (a === 'maybe') { acc.maybe += c; acc.maybeRsvps++; }
      acc.total += c;
    });
    return acc;
  }, { yes: 0, no: 0, maybe: 0, total: 0, yesRsvps: 0, noRsvps: 0, maybeRsvps: 0 });

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>
            <TrendingUp style={{ width: 28, height: 28, marginRight: 10 }} />
            RSVP Analytics
          </h1>
          <p style={S.subtitle}>Track event responses and attendance</p>
        </div>
        <button onClick={() => window.history.back()} style={S.closeBtn}>
          <X className="w-5 h-5" />
        </button>
          </div>

      <div style={S.container}>
        {/* ── Left: Event list ── */}
        <div style={S.sidebar}>
          <div style={S.sectionLabel}>SELECT EVENT</div>
          <div style={S.searchBox}>
            <Search className="w-4 h-4" style={{ color: '#6b7280', flexShrink: 0 }} />
            <input
              type="text" placeholder="Search events..."
              value={eventSearch} onChange={e => setEventSearch(e.target.value)}
              style={S.searchInput}
            />
            </div>
          <div style={S.eventList}>
            {groupedEvents.map(([month, monthEvts]) => (
              <div key={month} style={{ marginBottom: 20 }}>
                <div style={S.monthHeader}>
                  <span>{month}</span>
                  <span style={S.monthBadge}>{monthEvts.length}</span>
                </div>
                {monthEvts.map(event => (
                  <div key={event.id || getEventKey(event)}
                onClick={() => handleEventSelect(event)}
                style={{
                      ...S.eventCard,
                      ...(selectedEvent && getEventKey(selectedEvent) === getEventKey(event)
                        ? S.eventCardActive : {}),
                }}
              >
                    <div style={S.eventCardTitle}>{event.title}</div>
                    <div style={S.eventCardDate}>
                      {new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { 
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                      {event.time ? ` · ${event.time}` : ''}
          </div>
                    {selectedEvent && getEventKey(selectedEvent) === getEventKey(event) && (
                      <div style={S.viewBadge}>Viewing</div>
                )}
        </div>
        ))}
      </div>
            ))}
          </div>
                </div>
        {/* ── Right: Tabs + Content ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Tabs */}
          <div style={S.tabs}>
            <button
              onClick={() => setActiveTab('monthly')}
              style={{ ...S.tab, ...(activeTab === 'monthly' ? S.tabActive : {}) }}
            >
              <Calendar style={{ width: 15, height: 15 }} /> Monthly View
            </button>
            <button
              onClick={() => { setActiveTab('detail'); if (!selectedEvent && events.length) handleEventSelect(events[0]); }}
              style={{ ...S.tab, ...(activeTab === 'detail' ? S.tabActive : {}) }}
            >
              <TrendingUp style={{ width: 15, height: 15 }} /> Event Detail
            </button>
              </div>
          {/* ══ MONTHLY VIEW ══ */}
          {activeTab === 'monthly' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Month selector */}
              <div style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Select Month
                  </span>
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    style={S.monthSelect}
                  >
                    {availableMonths.map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                  {monthLoading && (
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>⏳ Loading...</span>
            )}
      </div>
        </div>
              {/* Monthly summary cards */}
              {!monthLoading && monthlyData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                  {[
                    { label: 'Total Guests', value: monthTotals.total, icon: '👥', bg: 'linear-gradient(135deg,#7c3aed,#6366f1)' },
                    { label: 'Attending (Yes)', value: monthTotals.yes, icon: '✅', bg: 'linear-gradient(135deg,#059669,#10b981)' },
                    { label: 'Not Attending', value: monthTotals.no, icon: '❌', bg: 'linear-gradient(135deg,#dc2626,#ef4444)' },
                    { label: 'Maybe', value: monthTotals.maybe, icon: '🤔', bg: 'linear-gradient(135deg,#d97706,#f59e0b)' },
                  ].map(c => (
                    <div key={c.label} style={{ ...S.statCard, background: c.bg }}>
                      <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>{c.icon}</div>
                      <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{c.value}</div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)', marginTop: 6, fontWeight: 500 }}>{c.label}</div>
    </div>
                  ))}
      </div>
              )}

              {/* Date-wise table */}
              <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <div style={S.cardTitle}>📅 Date-wise Breakdown</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {availableMonths.find(m => m.key === selectedMonth)?.label}
    </div>
                </div>

                {monthLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    ⏳ Fetching RSVP data for all events...
              </div>
                ) : monthlyData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    No events this month
          </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #334155' }}>
                          {['Date', 'Event', 'Yes (guests)', 'No (guests)', 'Maybe (guests)', 'Total Guests', ''].map(h => (
                            <th key={h} style={S.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData
                          .sort((a, b) => a.event.date.localeCompare(b.event.date))
                          .map(({ event, rsvp }) => {
                            const items = rsvp.items || [];
                            const yesG  = items.filter(i => i.attending === 'yes').reduce((s, i) => s + (i.count || 0), 0);
                            const noG   = items.filter(i => i.attending === 'no').reduce((s, i) => s + (i.count || 0), 0);
                            const mayG  = items.filter(i => i.attending === 'maybe').reduce((s, i) => s + (i.count || 0), 0);
                            const total = yesG + noG + mayG;
                            const d = new Date(event.date + 'T12:00:00');
                            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            return (
                              <tr
                                key={getEventKey(event)}
                                style={{ ...S.tr, cursor: 'pointer' }}
                                onClick={() => handleEventSelect(event)}
                              >
                                <td style={{ ...S.td, color: '#94a3b8', whiteSpace: 'nowrap' }}>{dateStr}</td>
                                <td style={{ ...S.td, fontWeight: 600, color: '#e2e8f0', maxWidth: 220 }}>
                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {event.title}
                                  </div>
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>
                                  <span style={{ ...S.pill, background: '#16a34a22', color: '#16a34a' }}>
                                    {yesG}
                                  </span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>
                                  <span style={{ ...S.pill, background: '#dc262622', color: '#dc2626' }}>
                                    {noG}
                                  </span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>
                                  <span style={{ ...S.pill, background: '#d9770622', color: '#d97706' }}>
                                    {mayG}
                                  </span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>
                                  <span style={{ ...S.pill, background: '#6366f122', color: '#818cf8' }}>
                                    {total}
                                  </span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleEventSelect(event); }}
                                    style={S.detailBtn}
                                  >
                                    Detail →
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                      {/* Totals row */}
                      <tfoot>
                        <tr style={{ borderTop: '2px solid #334155', background: '#0f172a' }}>
                          <td style={{ ...S.td, color: '#64748b' }} />
                          <td style={{ ...S.td, fontWeight: 700, color: '#e2e8f0' }}>
                            {availableMonths.find(m => m.key === selectedMonth)?.label} Total
                          </td>
                          <td style={{ ...S.td, textAlign: 'center', fontWeight: 800, color: '#16a34a' }}>{monthTotals.yes}</td>
                          <td style={{ ...S.td, textAlign: 'center', fontWeight: 800, color: '#dc2626' }}>{monthTotals.no}</td>
                          <td style={{ ...S.td, textAlign: 'center', fontWeight: 800, color: '#d97706' }}>{monthTotals.maybe}</td>
                          <td style={{ ...S.td, textAlign: 'center', fontWeight: 800, color: '#818cf8' }}>{monthTotals.total}</td>
                          <td style={S.td} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
          </div>
        </div>
          )}

          {/* ══ EVENT DETAIL VIEW ══ */}
          {activeTab === 'detail' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {!selectedEvent ? (
                <div style={{ ...S.card, textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 12 }}>👈</div>
                  Select an event from the list to view RSVPs
                </div>
              ) : (
                <>
                  {/* Event title */}
                  <div style={{ ...S.card, padding: '16px 20px' }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>{selectedEvent.title}</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 4 }}>
                      {new Date(selectedEvent.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      {selectedEvent.time ? ` · ${selectedEvent.time}` : ''}
            </div>
                    <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: 4, fontFamily: 'monospace' }}>
                      key: {getEventKey(selectedEvent)}
        </div>
                  </div>

                  {/* Stat cards */}
                  {detailLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>⏳ Loading...</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
                        {[
                          { label: 'Total RSVPs',  value: stats.totalRsvps,  bg: 'linear-gradient(135deg,#7c3aed,#6366f1)', icon: '📋' },
                          { label: 'Total Guests', value: stats.totalGuests, bg: 'linear-gradient(135deg,#059669,#10b981)', icon: '👥' },
                          { label: 'Avg Party',    value: stats.avgPartySize, bg: 'linear-gradient(135deg,#d97706,#f59e0b)', icon: '👨‍👩‍👧' },
                          { label: 'Confirmed',    value: stats.yesCount,    bg: 'linear-gradient(135deg,#2563eb,#3b82f6)', icon: '✅' },
                        ].map(c => (
                          <div key={c.label} style={{ ...S.statCard, background: c.bg }}>
                            <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{c.icon}</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{c.value}</div>
                            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>{c.label}</div>
                          </div>
                        ))}
                      </div>
                      {/* Attendance breakdown */}
                      <div style={S.card}>
                        <div style={S.cardTitle}>📊 Guest Breakdown</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 16 }}>
                          {[
                            { label: '✅ Yes', guests: stats.yesGuests, rsvps: stats.yesCount, color: '#16a34a' },
                            { label: '🤔 Maybe', guests: stats.maybeCount, rsvps: stats.maybeCount, color: '#d97706' },
                            { label: '❌ No', guests: stats.noCount, rsvps: stats.noCount, color: '#dc2626' },
                          ].map(b => (
                            <div key={b.label} style={{ background: '#0f172a', borderRadius: 8, padding: 16 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: b.color, marginBottom: 8 }}>{b.label}</div>
                              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#e2e8f0' }}>{b.guests}</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>guests · {b.rsvps} responses</div>
                              <div style={{ background: '#334155', height: 6, borderRadius: 4, marginTop: 10, overflow: 'hidden' }}>
                    <div style={{
                                  width: `${stats.totalGuests ? (b.guests / stats.totalGuests * 100) : 0}%`,
                                  height: '100%', background: b.color, borderRadius: 4, transition: 'width 0.5s',
                    }} />
          </div>
            </div>
                          ))}
          </div>
        </div>

                      {/* RSVP table */}
                      <div style={S.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
                            <div style={S.cardTitle}>👥 All RSVPs</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{filtered.length} entries</div>
              </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => fetchDetail(selectedEvent)} style={S.iconBtn} title="Refresh">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                            <button onClick={exportCSV} style={S.iconBtn} disabled={!rsvpData?.items?.length} title="Export CSV">
                    <Download className="w-4 h-4" />
                  </button>
            </div>
              </div>
                        <div style={{ ...S.searchBox, marginBottom: 16 }}>
                          <Search className="w-4 h-4" style={{ color: '#6b7280', flexShrink: 0 }} />
            <input
                            type="text" placeholder="Search by name..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            style={S.searchInput}
            />
          </div>

                        {detailError && (
                          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#fca5a5', fontSize: '0.85rem', marginBottom: 16 }}>
                            ⚠ {detailError}
                          </div>
                        )}
          {filtered.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
                            <div>No RSVPs yet for this event</div>
            </div>
          ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                                <tr style={{ borderBottom: '2px solid #334155' }}>
                                  {['#', 'Name', 'Guests', 'Status', 'Phone', 'Submitted', ''].map(h => (
                                    <th key={h} style={S.th}>{h}</th>
                                  ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                                  <tr key={item.rsvpId} style={S.tr}>
                                    <td style={{ ...S.td, color: '#475569' }}>{idx + 1}</td>
                                    <td style={{ ...S.td, fontWeight: 600, color: '#e2e8f0' }}>{item.name}</td>
                                    <td style={{ ...S.td, textAlign: 'center' }}>
                                      <span style={{ ...S.pill, background: '#16a34a22', color: '#16a34a' }}>{item.count}</span>
                      </td>
                                    <td style={S.td}>
                            <span style={{
                                        ...S.pill,
                              background: item.attending === 'yes' ? '#16a34a22' : item.attending === 'no' ? '#dc262622' : '#d9770622',
                              color: item.attending === 'yes' ? '#16a34a' : item.attending === 'no' ? '#dc2626' : '#d97706',
                            }}>
                              {item.attending === 'yes' ? '✅ Yes' : item.attending === 'no' ? '❌ No' : '🤔 Maybe'}
                        </span>
                      </td>
                                    <td style={{ ...S.td, color: '#64748b' }}>{item.phone || '—'}</td>
                                    <td style={{ ...S.td, color: '#64748b', whiteSpace: 'nowrap' }}>
                                      {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                                    <td style={S.td}>
                            <button
                              onClick={() => handleDelete(item.rsvpId, item.name)}
                            disabled={deleting===item.rsvpId}
                                        style={S.deleteBtn}
                                        title="Delete RSVP"
                            >
                              <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
                    </>
                  )}
                </>
              )}
        </div>
        )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page:       { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' },
  header:     { background: '#1e293b', borderBottom: '1px solid #334155', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title:      { fontSize: '1.6rem', fontWeight: 800, color: '#fff', margin: 0, display: 'flex', alignItems: 'center' },
  subtitle:   { fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0' },
  closeBtn:   { background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: 10, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' },
  container:  { display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, padding: '24px 28px', maxWidth: 1400, margin: '0 auto' },
  sidebar:    { background: '#1e293b', borderRadius: 12, border: '1px solid #334155', padding: 18, height: 'fit-content', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' },
  sectionLabel: { fontSize: '0.68rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 },
  searchBox:  { display: 'flex', alignItems: 'center', gap: 8, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px' },
  searchInput: { background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: '0.88rem', outline: 'none', flex: 1 },
  eventList:  { marginTop: 14 },
  monthHeader: { fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  monthBadge: { fontSize: '0.68rem', color: '#64748b', background: '#0f172a', padding: '2px 8px', borderRadius: 10 },
  eventCard:  { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', marginBottom: 6, position: 'relative', transition: 'border-color 0.15s' },
  eventCardActive: { background: '#1e40af22', borderColor: '#3b82f6' },
  eventCardTitle: { fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  eventCardDate:  { fontSize: '0.72rem', color: '#64748b' },
  viewBadge:  { position: 'absolute', top: 8, right: 8, background: '#3b82f6', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4 },
  tabs:       { display: 'flex', gap: 4, background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 4 },
  tab:        { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#64748b', background: 'transparent', transition: 'all 0.15s' },
  tabActive:  { background: '#0f172a', color: '#e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' },
  monthSelect: { background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', padding: '8px 14px', borderRadius: 8, fontSize: '0.9rem', cursor: 'pointer', outline: 'none' },
  card:       { background: '#1e293b', borderRadius: 12, border: '1px solid #334155', padding: 22 },
  cardTitle:  { fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 4 },
  statCard:   { borderRadius: 12, padding: '20px 16px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' },
  th:         { padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr:         { borderBottom: '1px solid #334155', transition: 'background 0.15s' },
  td:         { padding: '12px 14px', fontSize: '0.84rem', color: '#94a3b8' },
  pill:       { padding: '3px 10px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 700 },
  detailBtn:  { background: '#1e40af22', border: '1px solid #3b82f644', color: '#60a5fa', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 },
  iconBtn:    { background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', padding: 9, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  deleteBtn:  { background: 'transparent', border: '1px solid #dc2626', color: '#dc2626', padding: 7, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
