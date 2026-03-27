/**
 * src/components/RSVPAnalyticsPage.jsx
 * RSVP Analytics — modal/panel version (receives events as prop from parent)
 * - Monthly view: date-wise Yes/No/Maybe guest counts
 * - Per-event detail view
 * - Uses stable eventId when available
 * - Handles both `attending` and legacy `meal: "attending:yes|no|maybe"` payloads
 * - Uses simple fetches to avoid CORS preflight issues
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Download, RefreshCw, Search, Trash2, TrendingUp, Calendar, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'TempleAdmin2026!';

const slugify = (text) =>
  (text || '').toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
const getEventKey = (event) =>
  event?.eventId ||
  `${event?.date}-${slugify(event?.title)}`;

const getAttendance = (item) => {
  if (item?.attending === 'yes' || item?.attending === 'no' || item?.attending === 'maybe') {
    return item.attending;
  }
  if (item?.meal === 'attending:yes') return 'yes';
  if (item?.meal === 'attending:no') return 'no';
  if (item?.meal === 'attending:maybe') return 'maybe';
  return 'yes';
};

const fetchRSVPForEvent = async (event) => {
  const key = getEventKey(event);
  console.log('Fetching RSVP for key:', key, event);
  const res = await fetch(`${API}/api/rsvp/${encodeURIComponent(key)}`, {
    credentials: 'include',
    headers: { 'x-admin-secret': ADMIN_SECRET },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed: ${key} (${res.status}) ${text}`);
  }
  return res.json();
};
export default function RSVPAnalyticsPage({ events = [], onClose }) {
  const [activeTab, setActiveTab] = useState('monthly');

  const [selectedMonth, setSelectedMonth] = useState('');
  const [monthlyData,   setMonthlyData]   = useState([]);
  const [monthLoading,  setMonthLoading]  = useState(false);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [rsvpData, setRsvpData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError,   setDetailError]   = useState('');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [eventSearch, setEventSearch] = useState('');

  const availableMonths = React.useMemo(() => {
    const seen = new Set();
    const months = [];
    events
      .filter((e) => e.type !== 'panchang' && e.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((e) => {
        const key = e.date.slice(0, 7);
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

  useEffect(() => {

    if (availableMonths.length && !selectedMonth) {
      const now = new Date();
      const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const match = availableMonths.find((m) => m.key === currentKey);
      setSelectedMonth(match ? match.key : availableMonths[0].key);
    }
  }, [availableMonths, selectedMonth]);

  useEffect(() => {
    if (!selectedMonth || !events.length) return;
    const monthEvents = events.filter(
      (e) => e.type !== 'panchang' && e.date?.startsWith(selectedMonth)
    );
    if (!monthEvents.length) {
      setMonthlyData([]);
      return;
    }
    setMonthLoading(true);
    Promise.all(
      monthEvents.map(async (event) => {
    try {
          const rsvp = await fetchRSVPForEvent(event);
          return { event, rsvp };
        } catch (err) {
          console.error('Monthly RSVP fetch failed for', getEventKey(event), err);
          return {
            event,
            rsvp: { items: [], totalCount: 0 },
            error: err?.message || 'Failed to fetch',
          };
        }
      })
    )
      .then((results) => setMonthlyData(results))
      .finally(() => setMonthLoading(false));
  }, [selectedMonth, events]);

  const groupedEvents = React.useMemo(() => {
    const filteredEvents = events.filter(
      (e) =>
      e.type !== 'panchang' &&
        (e.title || '').toLowerCase().includes(eventSearch.toLowerCase())
    );
    const groups = {};
    filteredEvents.forEach((event) => {
      const d = new Date(event.date + 'T12:00:00');
      const mk = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (!groups[mk]) groups[mk] = [];
      groups[mk].push(event);
    });
    return Object.entries(groups).sort(
      (a, b) => new Date(b[1][0].date + 'T12:00:00') - new Date(a[1][0].date + 'T12:00:00')
    );
  }, [events, eventSearch]);

  const fetchDetail = useCallback(async (event) => {
    setDetailLoading(true);
    setDetailError('');
    try {
      const data = await fetchRSVPForEvent(event);
      setRsvpData(data);
    } catch (err) {
      console.error('Detail RSVP fetch failed for', getEventKey(event), err);
      setDetailError(err.message || 'Failed to fetch');
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
      const res = await fetch(
        `${API}/api/rsvp/${encodeURIComponent(getEventKey(selectedEvent))}/${rsvpId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Delete failed (${res.status}) ${text}`);
        }

      fetchDetail(selectedEvent);
    } catch (err) {
      console.error('Failed to delete RSVP', err);
      alert('Failed to delete RSVP');
    } finally {
      setDeleting(null);
    }
  };

  const exportCSV = () => {
    if (!rsvpData?.items?.length) return;
    const rows = [
      ['Name', 'Guests', 'Attending', 'Phone', 'Notes', 'Submitted At'],
      ...rsvpData.items.map((i) => [
        i.name,
        i.count,
        getAttendance(i),
        i.phone || '',
        i.notes || '',
        new Date(i.createdAt).toLocaleString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rsvp_${selectedEvent?.title?.replace(/\s+/g, '_') || 'event'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

    
    

  const filtered = rsvpData?.items?.filter((i) =>
    (i.name || '').toLowerCase().includes(search.toLowerCase())
  ) || [];

  const stats = {
    totalRsvps: rsvpData?.items?.length || 0,
    totalGuests: rsvpData?.totalCount || 0,
    avgPartySize: rsvpData?.items?.length 
      ? (rsvpData.totalCount / rsvpData.items.length).toFixed(1)
      : '0',
    yesCount: rsvpData?.items?.filter((i) => getAttendance(i) === 'yes')?.length || 0,
    noCount: rsvpData?.items?.filter((i) => getAttendance(i) === 'no')?.length || 0,
    maybeCount: rsvpData?.items?.filter((i) => getAttendance(i) === 'maybe')?.length || 0,
    yesGuests: rsvpData?.items?.filter((i) => getAttendance(i) === 'yes')
                  ?.reduce((s, i) => s + (i.count || 0), 0) || 0,
    noGuests: rsvpData?.items?.filter((i) => getAttendance(i) === 'no')
                  ?.reduce((s, i) => s + (i.count || 0), 0) || 0,
    maybeGuests: rsvpData?.items?.filter((i) => getAttendance(i) === 'maybe')
                  ?.reduce((s, i) => s + (i.count || 0), 0) || 0,
  };

  const monthTotals = monthlyData.reduce((acc, { rsvp }) => {
    (rsvp.items || []).forEach((item) => {
      const a = getAttendance(item);
      const c = item.count || 0;
      if (a === 'yes') {
        acc.yes += c;
        acc.yesRsvps++;
      }
      if (a === 'no') {
        acc.no += c;
        acc.noRsvps++;
      }
      if (a === 'maybe') {
        acc.maybe += c;
        acc.maybeRsvps++;
      }
      acc.total += c;
    });
    return acc;
  }, { yes: 0, no: 0, maybe: 0, total: 0, yesRsvps: 0, noRsvps: 0, maybeRsvps: 0 });

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TrendingUp style={{ width: 22, height: 22, color: '#94a3b8' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>RSVP Analytics</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Track event responses and attendance
            </div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={S.closeBtn}>
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div style={S.body}>
        <div style={S.sidebar}>
          <div style={S.sectionLabel}>SELECT EVENT</div>
          <div style={S.searchBox}>
            <Search className="w-4 h-4" style={{ color: '#6b7280', flexShrink: 0 }} />
              <input
              type="text"
              placeholder="Search events..."
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              style={S.searchInput}
              />
            </div>
          <div style={{ marginTop: 12 }}>
            {groupedEvents.map(([month, monthEvts]) => (
              <div key={month} style={{ marginBottom: 18 }}>
                <div style={S.monthHeader}>
                    <span>{month}</span>
                  <span style={S.monthBadge}>{monthEvts.length}</span>
                  </div>
                {monthEvts.map((event) => (
                  <div
                    key={event.eventId || getEventKey(event)}
                      onClick={() => handleEventSelect(event)}
                      style={{
                      ...S.eventCard,
                      ...(selectedEvent && getEventKey(selectedEvent) === getEventKey(event)
                        ? S.eventCardActive
                        : {}),
                      }}
                    >
                    <div style={S.eventCardTitle}>{event.title}</div>
                    <div style={S.eventCardDate}>
                        {new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { 
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
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

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
          }}
        >
          <div style={S.tabs}>
            <button
              onClick={() => setActiveTab('monthly')}
              style={{ ...S.tab, ...(activeTab === 'monthly' ? S.tabActive : {}) }}
            >
              <Calendar style={{ width: 14, height: 14 }} /> Monthly View
            </button>
            <button
              onClick={() => {
                setActiveTab('detail');
                if (!selectedEvent && events.length) handleEventSelect(events[0]);
              }}
              style={{ ...S.tab, ...(activeTab === 'detail' ? S.tabActive : {}) }}
            >
              <TrendingUp style={{ width: 14, height: 14 }} /> Event Detail
            </button>
                </div>

          {activeTab === 'monthly' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={S.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={S.sectionLabel}>Month</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={S.monthSelect}
                  >
                    {availableMonths.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  {monthLoading && (
                    <span style={{ color: '#64748b', fontSize: '0.78rem' }}>⏳ Loading...</span>
                  )}
            </div>
          </div>

              {!monthLoading && monthlyData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  {[
                    { label: 'Total Guests', value: monthTotals.total, icon: '👥', bg: 'linear-gradient(135deg,#7c3aed,#6366f1)' },
                    { label: 'Attending (Yes)', value: monthTotals.yes, icon: '✅', bg: 'linear-gradient(135deg,#059669,#10b981)' },
                    { label: 'Not Attending', value: monthTotals.no, icon: '❌', bg: 'linear-gradient(135deg,#dc2626,#ef4444)' },
                    { label: 'Maybe', value: monthTotals.maybe, icon: '🤔', bg: 'linear-gradient(135deg,#d97706,#f59e0b)' },
                  ].map((c) => (
                    <div key={c.label} style={{ ...S.statCard, background: c.bg }}>
                      <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{c.icon}</div>
                      <div style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                        {c.value}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.8)', marginTop: 5 }}>
                        {c.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={S.cardTitle}>📅 Date-wise Breakdown</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {availableMonths.find((m) => m.key === selectedMonth)?.label}
                </div>
                </div>

                {monthLoading ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b' }}>⏳ Fetching RSVP data...</div>
                ) : monthlyData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b' }}>No events this month</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #334155' }}>
                          {['Date', 'Event', 'Yes', 'No', 'Maybe', 'Total Guests', ''].map((h) => (
                            <th key={h} style={S.th}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData
                          .sort((a, b) => a.event.date.localeCompare(b.event.date))
                          .map(({ event, rsvp }) => {
                            const items = rsvp.items || [];
                            const yesG = items.filter((i) => getAttendance(i) === 'yes').reduce((s, i) => s + (i.count || 0), 0);
                            const noG = items.filter((i) => getAttendance(i) === 'no').reduce((s, i) => s + (i.count || 0), 0);
                            const mayG = items.filter((i) => getAttendance(i) === 'maybe').reduce((s, i) => s + (i.count || 0), 0);
                            const total = yesG + noG + mayG;
                            const dateStr = new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                            return (
                              <tr
                                key={getEventKey(event)}
                                style={{ ...S.tr, cursor: 'pointer' }}
                                onClick={() => handleEventSelect(event)}
                              >
                                <td style={{ ...S.td, color: '#94a3b8', whiteSpace: 'nowrap' }}>{dateStr}</td>
                                <td style={{ ...S.td, fontWeight: 600, color: '#e2e8f0', maxWidth: 180 }}>
                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {event.title}
              </div>
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>
                                  <span style={{ ...S.pill, background: '#16a34a22', color: '#16a34a' }}>{yesG}</span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>
                                  <span style={{ ...S.pill, background: '#dc262622', color: '#dc2626' }}>{noG}</span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>
                                  <span style={{ ...S.pill, background: '#d9770622', color: '#d97706' }}>{mayG}</span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>
                                  <span style={{ ...S.pill, background: '#6366f122', color: '#818cf8' }}>{total}</span>
                                </td>
                                <td style={{ ...S.td, textAlign: 'center' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEventSelect(event);
                                    }}
                                    style={S.detailBtn}
                                  >
                                    Detail →
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid #334155', background: '#0f172a' }}>
                          <td style={S.td} />
                          <td style={{ ...S.td, fontWeight: 700, color: '#e2e8f0' }}>
                            {availableMonths.find((m) => m.key === selectedMonth)?.label} Total
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

          {activeTab === 'detail' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!selectedEvent ? (
                <div style={{ ...S.card, textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 10 }}>👈</div>
                  Select an event from the list to view RSVPs
                </div>
              ) : (
                <>
                  <div style={{ ...S.card, padding: '14px 18px' }}>
                    <div style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.95rem' }}>{selectedEvent.title}</div>
                    <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 3 }}>
                      {new Date(selectedEvent.date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      {selectedEvent.time ? ` · ${selectedEvent.time}` : ''}
                    </div>
                    <div style={{ color: '#475569', fontSize: '0.68rem', marginTop: 3, fontFamily: 'monospace' }}>
                      key: {getEventKey(selectedEvent)}
                    </div>
                  </div>

                  {detailLoading ? (
                    <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>⏳ Loading...</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                        {[
                          { label: 'Total RSVPs', value: stats.totalRsvps, bg: 'linear-gradient(135deg,#7c3aed,#6366f1)', icon: '📋' },
                          { label: 'Total Guests', value: stats.totalGuests, bg: 'linear-gradient(135deg,#059669,#10b981)', icon: '👥' },
                          { label: 'Avg Party', value: stats.avgPartySize, bg: 'linear-gradient(135deg,#d97706,#f59e0b)', icon: '👨‍👩‍👧' },
                          { label: 'Confirmed', value: stats.yesCount, bg: 'linear-gradient(135deg,#2563eb,#3b82f6)', icon: '✅' },
                        ].map((c) => (
                          <div key={c.label} style={{ ...S.statCard, background: c.bg }}>
                            <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>{c.icon}</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{c.value}</div>
                            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)', marginTop: 5 }}>{c.label}</div>
                          </div>
                        ))}
                      </div>

                      <div style={S.card}>
                        <div style={S.cardTitle}>📊 Guest Breakdown</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 14 }}>
                          {[
                            { label: '✅ Yes', guests: stats.yesGuests, rsvps: stats.yesCount, color: '#16a34a' },
                            { label: '🤔 Maybe', guests: stats.maybeGuests, rsvps: stats.maybeCount, color: '#d97706' },
                            { label: '❌ No', guests: stats.noGuests, rsvps: stats.noCount, color: '#dc2626' },
                          ].map((b) => (
                            <div key={b.label} style={{ background: '#0f172a', borderRadius: 8, padding: 14 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: b.color, marginBottom: 6 }}>{b.label}</div>
                              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#e2e8f0' }}>{b.guests}</div>
                              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: 3 }}>
                                guests · {b.rsvps} responses
                              </div>
                              <div style={{ background: '#334155', height: 5, borderRadius: 4, marginTop: 10, overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${stats.totalGuests ? (b.guests / stats.totalGuests) * 100 : 0}%`,
                                    height: '100%',
                                    background: b.color,
                                    borderRadius: 4,
                                    transition: 'width 0.5s',
                                  }}
                                />
                    </div>
                  </div>
                          ))}
                </div>
              </div>

                      <div style={S.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                            <div style={S.cardTitle}>👥 All RSVPs</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>{filtered.length} entries</div>
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

                        <div style={{ ...S.searchBox, marginBottom: 14 }}>
                          <Search className="w-4 h-4" style={{ color: '#6b7280', flexShrink: 0 }} />
                          <input
                            type="text"
                            placeholder="Search by name..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={S.searchInput}
                          />
                        </div>
                        {detailError && (
                          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#fca5a5', fontSize: '0.82rem', marginBottom: 14 }}>
                            ⚠ {detailError}
                </div>
                        )}

                {filtered.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                            <div style={{ fontSize: '2.2rem', marginBottom: 10 }}>📭</div>
                            No RSVPs yet for this event
                  </div>
                ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                                <tr style={{ borderBottom: '2px solid #334155' }}>
                                  {['#', 'Name', 'Guests', 'Status', 'Phone', 'Submitted', ''].map((h) => (
                                    <th key={h} style={S.th}>{h}</th>
                                  ))}
                        </tr>
                      </thead>
                      <tbody>
                                {filtered.map((item, idx) => {
                                  const attendance = getAttendance(item);
                                  return (
                                  <tr key={item.rsvpId} style={S.tr}>
                                    <td style={{ ...S.td, color: '#475569' }}>{idx + 1}</td>
                                      <td style={{ ...S.td, fontWeight: 600, color: '#e2e8f0' }}>{item.name}</td>
                                    <td style={{ ...S.td, textAlign: 'center' }}>
                                        <span style={{ ...S.pill, background: '#16a34a22', color: '#16a34a' }}>
                                        {item.count}
                                      </span>
                            </td>
                                    <td style={S.td}>
                                      <span
                                        style={{
                                        ...S.pill,
                                          background:
                                              attendance === 'yes'
                                              ? '#16a34a22'
                                                : attendance === 'no'
                                                ? '#dc262622'
                                                : '#d9770622',
                                          color:
                                              attendance === 'yes'
                                              ? '#16a34a'
                                                : attendance === 'no'
                                                ? '#dc2626'
                                                : '#d97706',
                                        }}
                                      >
                                          {attendance === 'yes' ? '✅ Yes' : attendance === 'no' ? '❌ No' : '🤔 Maybe'}
                              </span>
                            </td>
                                    <td style={{ ...S.td, color: '#64748b' }}>{item.phone || '—'}</td>
                                    <td style={{ ...S.td, color: '#64748b', whiteSpace: 'nowrap' }}>
                              {new Date(item.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                              })}
                            </td>
                                    <td style={S.td}>
                              <button
                                onClick={() => handleDelete(item.rsvpId, item.name)}
                                disabled={deleting === item.rsvpId}
                                        style={S.deleteBtn}
                                        title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                                  );
                                })}
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

const S = {
  wrap:       { display: 'flex', flexDirection: 'column', height: '100%', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', borderRadius: 12, overflow: 'hidden' },
  header:     { background: '#1e293b', borderBottom: '1px solid #334155', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 },
  closeBtn:   { background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: 8, borderRadius: 8, cursor: 'pointer', display: 'flex' },
  body:       { display: 'grid', gridTemplateColumns: '240px 1fr', gap: 0, flex: 1, overflow: 'hidden' },
  sidebar:    { background: '#1e293b', borderRight: '1px solid #334155', padding: 16, overflowY: 'auto' },
  sectionLabel: { fontSize: '0.65rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 },
  searchBox:  { display: 'flex', alignItems: 'center', gap: 8, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px' },
  searchInput: { background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: '0.84rem', outline: 'none', flex: 1 },
  monthHeader: { fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between' },
  monthBadge: { fontSize: '0.65rem', color: '#64748b', background: '#0f172a', padding: '1px 7px', borderRadius: 10 },
  eventCard:  { background: '#0f172a', border: '1px solid #334155', borderRadius: 7, padding: '9px 10px', cursor: 'pointer', marginBottom: 5, position: 'relative' },
  eventCardActive: { background: '#1e40af22', borderColor: '#3b82f6' },
  eventCardTitle: { fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  eventCardDate:  { fontSize: '0.68rem', color: '#64748b' },
  viewBadge:  { position: 'absolute', top: 7, right: 7, background: '#3b82f6', color: '#fff', fontSize: '0.58rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4 },
  tabs:       { display: 'flex', gap: 3, background: '#1e293b', border: '1px solid #334155', borderRadius: 9, padding: 3, flexShrink: 0 },
  tab:        { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 12px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#64748b', background: 'transparent' },
  tabActive:  { background: '#0f172a', color: '#e2e8f0' },
  monthSelect: { background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', padding: '7px 12px', borderRadius: 8, fontSize: '0.88rem', cursor: 'pointer', outline: 'none' },
  card:       { background: '#1e293b', borderRadius: 10, border: '1px solid #334155', padding: 18 },
  cardTitle:  { fontSize: '0.88rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 4 },
  statCard:   { borderRadius: 10, padding: '16px 12px', textAlign: 'center' },
  th:         { padding: '9px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr:         { borderBottom: '1px solid #334155' },
  td:         { padding: '10px 12px', fontSize: '0.82rem', color: '#94a3b8' },
  pill:       { padding: '3px 9px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700 },
  detailBtn:  { background: '#1e40af22', border: '1px solid #3b82f644', color: '#60a5fa', padding: '3px 9px', borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 },
  iconBtn:    { background: '#0f172a', border: '1px solid #334155', color: '#94a3b8', padding: 8, borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center' },
  deleteBtn:  { background: 'transparent', border: '1px solid #dc2626', color: '#dc2626', padding: 6, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' },
};
