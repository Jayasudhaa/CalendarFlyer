/**
 * src/components/RSVPAnalyticsPage.jsx
 * RSVP Analytics — reskinned to a filter-bar + tabs layout (Overview /
 * Event performance / Attendees) per the user-provided mockup, but built
 * from ONLY data this app actually tracks.
 *
 * The original mockup this was designed against also showed Checked-in,
 * Collected ($), Page views, an engagement funnel, and per-event
 * "Registration sources" (WhatsApp/Facebook/Instagram/Direct link) — none
 * of which this app records anywhere (no check-in flow, no payments, no
 * page-view or referrer tracking). Rather than fabricate numbers for a
 * real dashboard, this view only shows what's backed by real RSVP data:
 * event counts, RSVP submissions, guest counts, and Confirmed/Maybe/
 * Declined responses — computed from the same `/api/rsvp/:eventKey` data
 * the rest of this component already fetched. See the chat thread this
 * shipped from for the fuller reasoning (user chose "reskin, real data
 * only" over faking the untracked metrics or building the tracking itself).
 *
 * - Monthly overview: date-wise Yes/No/Maybe guest counts, weekly
 *   registration trend, event performance summary table
 * - Per-event detail view (drill-down from the Event filter or the
 *   summary table)
 * - All-events or per-event attendee list, search + delete
 * - Uses stable eventId when available
 * - Handles both `attending` and legacy `meal: "attending:yes|no|maybe"` payloads
 * - Uses simple fetches to avoid CORS preflight issues
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Download, RefreshCw, Search, Trash2, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';
// A stuck fetch (dropped connection, a CORS failure some browsers never
// settle cleanly, etc.) used to leave monthLoading/detailLoading stuck on
// forever — "endless Loading". This bounds every RSVP fetch so it always
// resolves one way or another within FETCH_TIMEOUT_MS.
const FETCH_TIMEOUT_MS = 15000;
function withTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}
// Admin RSVP endpoints now authenticate with the normal logged-in-user token
// (cf_token) instead of a shared secret — a VITE_-prefixed secret gets
// compiled straight into the public JS bundle, which let anyone with
// devtools read/delete any tenant's RSVPs. See server/routes/rsvp.js.
function authHeader() {
  const token = localStorage.getItem('cf_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const slugify = (text) =>
  (text || '').toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
const getEventKey = (event) =>
  event?.eventId ||
  `${event?.date}-${slugify(event?.title)}`;

function getAttendance(item) {
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
  let res;
  try {
    res = await withTimeout(`${API}/api/rsvp/${encodeURIComponent(key)}`, {
      credentials: 'include',
      headers: { ...authHeader() },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Timed out loading RSVPs for ${key} — check your connection and try again`);
    }
    throw new Error(`Network error loading RSVPs for ${key}: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed: ${key} (${res.status}) ${text}`);
  }
  return res.json();
};

// Fetches RSVPs for many events in ONE request instead of one request per
// event. The Analytics Overview used to fire a separate GET /api/rsvp/:key
// per event in the month — with 15-20 events that's 15-20 requests, and
// browsers cap concurrent connections per host at ~6, so most of them just
// queue in waves rather than actually running in parallel. This collapses
// all of it into a single POST, with the server fanning the DB lookups out
// concurrently instead. See server/routes/rsvp.js's POST /rsvp/batch.
const fetchRSVPBatch = async (eventKeys) => {
  let res;
  try {
    res = await withTimeout(`${API}/api/rsvp/batch`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ eventIds: eventKeys }),
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Timed out loading RSVPs — check your connection and try again');
    }
    throw new Error(`Network error loading RSVPs: ${err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to load RSVPs (${res.status}) ${text}`);
  }
  const data = await res.json();
  return data.results || {};
};

// Real, creatable event types (matches AddEventModal.jsx's EVENT_TYPES minus
// 'panchang', which never has RSVPs — same list the admin calendar's legend
// and the public calendar's filter pills already use, so "Type" here means
// the same thing everywhere in the app).
const TYPE_META = {
  pooja:      { label: 'Pooja',      color: '#f97316' },
  festival:   { label: 'Festival',   color: '#dc2626' },
  holiday:    { label: 'Holiday',    color: '#8b5cf6' },
  kalyanam:   { label: 'Kalyanam',   color: '#eab308' },
  abhishekam: { label: 'Abhishekam', color: '#06b6d4' },
};
function fmtDate(dateStr, opts) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric' });
}

export default function RSVPAnalyticsPage({ events = [], onClose }) {
  // 'overview' | 'performance' | 'attendees'
  const [analyticsTab, setAnalyticsTab] = useState('overview');

  const [selectedMonth, setSelectedMonth] = useState('');
  const [monthlyData,   setMonthlyData]   = useState([]);
  const [monthLoading,  setMonthLoading]  = useState(false);
  const [eventFilter, setEventFilter] = useState('all'); // 'all' or an event key

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [rsvpData, setRsvpData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError,   setDetailError]   = useState('');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);

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

  // Guards against overlapping fetches: if selectedMonth/events change again
  // before the previous batch finishes, a stale response landing late used
  // to still call setMonthLoading(false)/setMonthlyData() and could
  // overwrite the newer request's state — visible as loading that never
  // settles, or settling to the wrong month's data. Only the most recently
  // started request is allowed to apply its result.
  const monthRequestRef = useRef(0);

  useEffect(() => {
    if (!selectedMonth || !events.length) return;
    const monthEvents = events.filter(
      (e) => e.type !== 'panchang' && e.date?.startsWith(selectedMonth)
    );
    if (!monthEvents.length) {
      setMonthlyData([]);
      return;
    }
    const requestId = ++monthRequestRef.current;
    setMonthLoading(true);
    const keys = monthEvents.map(getEventKey);
    fetchRSVPBatch(keys)
      .then((byKey) => {
        if (monthRequestRef.current !== requestId) return;
        setMonthlyData(monthEvents.map((event) => {
          const key = getEventKey(event);
          const r = byKey[key];
          if (!r) {
            return { event, rsvp: { items: [], totalCount: 0 }, error: 'No data returned' };
          }
          const { error, ...rsvp } = r;
          return error ? { event, rsvp, error } : { event, rsvp };
        }));
      })
      .catch((err) => {
        console.error('Monthly RSVP batch fetch failed', err);
        if (monthRequestRef.current === requestId) {
          setMonthlyData(monthEvents.map((event) => ({
            event,
            rsvp: { items: [], totalCount: 0 },
            error: err?.message || 'Failed to fetch',
          })));
        }
      })
      .finally(() => {
        if (monthRequestRef.current === requestId) setMonthLoading(false);
      });
  }, [selectedMonth, events]);

  const monthlyDataFiltered = monthlyData;

  const detailRequestRef = useRef(0);
  const fetchDetail = useCallback(async (event) => {
    const requestId = ++detailRequestRef.current;
    setDetailLoading(true);
    setDetailError('');
    try {
      const data = await fetchRSVPForEvent(event);
      if (detailRequestRef.current === requestId) setRsvpData(data);
    } catch (err) {
      console.error('Detail RSVP fetch failed for', getEventKey(event), err);
      if (detailRequestRef.current === requestId) {
        setDetailError(err.message || 'Failed to fetch');
        setRsvpData({ items: [], totalCount: 0 });
      }
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false);
    }
  }, []);

  // The "Event" filter drives both the Event performance and (single-event)
  // Attendees views — picking one fetches its RSVPs; picking "All events"
  // clears the selection so those tabs fall back to their aggregate view.
  useEffect(() => {
    if (eventFilter === 'all') {
      setSelectedEvent(null);
      setRsvpData(null);
      return;
    }
    const match = monthlyData.find((d) => getEventKey(d.event) === eventFilter)?.event;
    if (match) {
      setSelectedEvent(match);
      fetchDetail(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventFilter, monthlyData]);

  // Reset the Event filter whenever the month changes, so it never points
  // at an event that no longer belongs to the visible month.
  useEffect(() => { setEventFilter('all'); }, [selectedMonth]);

  const handleDelete = async (rsvpId, name) => {
    if (!window.confirm(`Remove RSVP for ${name}?`)) return;
    setDeleting(rsvpId);
    try {
      const res = await fetch(
        `${API}/api/rsvp/${encodeURIComponent(getEventKey(selectedEvent))}/${rsvpId}`,
        { method: 'DELETE', credentials: 'include', headers: { ...authHeader() } }
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

  // Every RSVP across every event in the filtered month, tagged with which
  // event it belongs to — used by the Attendees tab when no single Event is
  // selected, and by CSV export in that same "all events" mode.
  const allAttendees = React.useMemo(() => {
    const rows = [];
    monthlyDataFiltered.forEach(({ event, rsvp }) => {
      (rsvp.items || []).forEach((item) => rows.push({ ...item, _eventTitle: event.title, _eventDate: event.date }));
    });
    return rows;
  }, [monthlyDataFiltered]);

  const filtered = (eventFilter === 'all' ? allAttendees : rsvpData?.items || [])
    .filter((i) => (i.name || '').toLowerCase().includes(search.toLowerCase()));

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

  // ── Overview aggregates — every number here is a straight sum/count over
  // real RSVP data for the (type-filtered) month, nothing estimated.
  const overview = React.useMemo(() => {
    let rsvpsCount = 0, yesRsvps = 0, noRsvps = 0, maybeRsvps = 0, yesGuests = 0, noGuests = 0, maybeGuests = 0;
    monthlyDataFiltered.forEach(({ rsvp }) => {
      (rsvp.items || []).forEach((item) => {
        const a = getAttendance(item);
        const c = item.count || 0;
        rsvpsCount++;
        if (a === 'yes') { yesRsvps++; yesGuests += c; }
        else if (a === 'no') { noRsvps++; noGuests += c; }
        else { maybeRsvps++; maybeGuests += c; }
      });
    });
    const totalGuests = yesGuests + noGuests + maybeGuests;
    const expectedGuests = yesGuests + maybeGuests; // yes + maybe, not "no"
    const responseRate = rsvpsCount ? Math.round((yesRsvps / rsvpsCount) * 100) : 0;
    const avgParty = rsvpsCount ? (totalGuests / rsvpsCount).toFixed(1) : '0';
    return {
      eventsCount: monthlyDataFiltered.length,
      rsvpsCount, yesRsvps, noRsvps, maybeRsvps,
      yesGuests, noGuests, maybeGuests, totalGuests, expectedGuests,
      responseRate, avgParty,
    };
  }, [monthlyDataFiltered]);

  // ── Weekly registration trend — buckets every RSVP's submission
  // timestamp (createdAt) into the calendar weeks of the selected month.
  const weeklyRegistrations = React.useMemo(() => {
    if (!selectedMonth) return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const weeks = [];
    for (let i = 0; i < 5; i++) {
      const start = new Date(y, m - 1, 1 + i * 7);
      if (start.getMonth() !== m - 1) break;
      weeks.push({ start, count: 0 });
    }
    monthlyDataFiltered.forEach(({ rsvp }) => {
      (rsvp.items || []).forEach((item) => {
        if (!item.createdAt) return;
        const d = new Date(item.createdAt);
        for (let i = weeks.length - 1; i >= 0; i--) {
          if (d >= weeks[i].start) { weeks[i].count++; break; }
        }
      });
    });
    return weeks.map((w) => ({
      label: w.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: w.count,
    }));
  }, [monthlyDataFiltered, selectedMonth]);
  const maxWeekly = Math.max(1, ...weeklyRegistrations.map((w) => w.count));

  function exportCSV() {
    const isAll = eventFilter === 'all';
    const rows = isAll
      ? [
          ['Event', 'Name', 'Guests', 'Attending', 'Phone', 'Notes', 'Submitted At'],
          ...filtered.map((i) => [i._eventTitle, i.name, i.count, getAttendance(i), i.phone || '', i.notes || '', i.createdAt ? new Date(i.createdAt).toLocaleString() : '']),
        ]
      : [
          ['Name', 'Guests', 'Attending', 'Phone', 'Notes', 'Submitted At'],
          ...filtered.map((i) => [i.name, i.count, getAttendance(i), i.phone || '', i.notes || '', i.createdAt ? new Date(i.createdAt).toLocaleString() : '']),
        ];
    if (rows.length <= 1) return;
    const csv = rows.map((r) => r.map((v) => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = isAll
      ? `rsvps_${selectedMonth || 'month'}.csv`
      : `rsvp_${selectedEvent?.title?.replace(/\s+/g, '_') || 'event'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const monthLabel = availableMonths.find((m) => m.key === selectedMonth)?.label || '';

  return (
    <div style={S.wrap}>
      <style>{`
        @media (max-width: 720px) {
          .cf-an-filters { flex-wrap: wrap !important; }
          .cf-an-stat-grid { grid-template-columns: repeat(2,1fr) !important; }
          .cf-an-tabs button { font-size: 0.78rem !important; padding: 8px 10px !important; }
          .cf-an-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <div>
          <div style={S.h1}>Analytics</div>
          <div style={S.sub}>See RSVPs, guests, and event performance</div>
        </div>
        {onClose && (
          <button onClick={onClose} style={S.closeBtn}>
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div style={S.body}>
        {/* ── Filter bar ── */}
        <div className="cf-an-filters" style={S.filterBar}>
          <label style={S.filterField}>
            <span style={S.filterLabel}>Date range</span>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={S.select}>
              {availableMonths.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
          <label style={S.filterField}>
            <span style={S.filterLabel}>Event</span>
            <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} style={S.select}>
              <option value="all">All events</option>
              {monthlyData.map(({ event }) => (
                <option key={getEventKey(event)} value={getEventKey(event)}>{event.title}</option>
              ))}
            </select>
          </label>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            style={{ ...S.exportBtn, opacity: filtered.length === 0 ? 0.5 : 1, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer' }}
            title={eventFilter === 'all' ? 'Export all attendees this month' : 'Export this event’s attendees'}
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="cf-an-tabs" style={S.tabs}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'performance', label: 'Event performance' },
            { key: 'attendees', label: 'Attendees' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setAnalyticsTab(t.key)}
              style={{ ...S.tab, ...(analyticsTab === t.key ? S.tabActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {monthLoading && <div style={S.loadingLine}>⏳ Loading {monthLabel}…</div>}

        {/* ── Overview ── */}
        {analyticsTab === 'overview' && !monthLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={S.statSection}>
              <div className="cf-an-stat-grid" style={S.statGrid}>
                <StatTile label="Events" value={overview.eventsCount} sub={monthLabel} />
                <StatTile label="RSVPs" value={overview.rsvpsCount} sub={`${overview.yesRsvps} confirmed`} />
                <StatTile label="Expected guests" value={overview.expectedGuests} sub="yes + maybe" />
                <StatTile label="Confirmed" value={overview.yesRsvps} sub={`of ${overview.rsvpsCount} responses`} color="#16a34a" />
                <StatTile label="Avg. party size" value={overview.avgParty} sub="guests per RSVP" />
                <StatTile label="Response rate" value={`${overview.responseRate}%`} sub="confirmed of all responses" />
              </div>
            </div>

            <div className="cf-an-two-col" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
              <div style={S.card}>
                <div style={S.cardTitle}>Registrations over time</div>
                <div style={S.cardSub}>RSVPs received each week</div>
                {weeklyRegistrations.length === 0 ? (
                  <div style={S.emptyBlock}>No RSVPs yet this month</div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 140, marginTop: 18, padding: '0 4px' }}>
                    {weeklyRegistrations.map((w) => (
                      <div key={w.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--cf-text-primary)' }}>{w.count}</div>
                        <div style={{
                          width: '100%', maxWidth: 40,
                          height: Math.max(4, (w.count / maxWeekly) * 100),
                          background: 'var(--cf-accent)', borderRadius: '4px 4px 0 0',
                        }} />
                        <div style={{ fontSize: '0.65rem', color: 'var(--cf-text-muted)' }}>{w.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={S.card}>
                <div style={S.cardTitle}>Response breakdown</div>
                <div style={S.cardSub}>Confirmed, maybe and declined this month</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                  <ResponseBar label="Confirmed" count={overview.yesRsvps} total={overview.rsvpsCount} color="#16a34a" />
                  <ResponseBar label="Maybe" count={overview.maybeRsvps} total={overview.rsvpsCount} color="#d97706" />
                  <ResponseBar label="Declined" count={overview.noRsvps} total={overview.rsvpsCount} color="#dc2626" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Event performance ── */}
        {analyticsTab === 'performance' && !monthLoading && (
          eventFilter === 'all' ? (
            <div style={{ ...S.card, textAlign: 'center', padding: '48px 0', color: 'var(--cf-text-muted)' }}>
              Pick an event from the Event filter above to see its performance.
            </div>
          ) : !selectedEvent ? null : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...S.card, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--cf-text-primary)', fontSize: '1.05rem' }}>{selectedEvent.title}</div>
                  <div style={{ color: 'var(--cf-text-muted)', fontSize: '0.82rem', marginTop: 3 }}>
                    {fmtDate(selectedEvent.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    {selectedEvent.time ? ` · ${selectedEvent.time}` : ''}
                  </div>
                </div>
                {selectedEvent.type && TYPE_META[(selectedEvent.type || '').toLowerCase()] && (
                  <span style={{ ...S.pill, background: `${TYPE_META[selectedEvent.type.toLowerCase()].color}1a`, color: TYPE_META[selectedEvent.type.toLowerCase()].color }}>
                    {TYPE_META[selectedEvent.type.toLowerCase()].label}
                  </span>
                )}
              </div>

              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--cf-text-muted)' }}>⏳ Loading...</div>
              ) : (
                <>
                  {detailError && (
                    <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: 'var(--cf-text-primary)', fontSize: '0.82rem' }}>
                      ⚠ {detailError}
                    </div>
                  )}
                  <div className="cf-an-stat-grid" style={S.statGrid}>
                    <StatTile label="RSVPs" value={stats.totalRsvps} />
                    <StatTile label="Guests" value={stats.totalGuests} />
                    <StatTile label="Avg. party size" value={stats.avgPartySize} />
                    <StatTile label="Confirmed" value={stats.yesCount} color="#16a34a" />
                  </div>

                  <div style={S.card}>
                    <div style={S.cardTitle}>Response status</div>
                    <div style={S.cardSub}>Confirmed, maybe and declined for this event</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                      <ResponseBar label="Confirmed" count={stats.yesCount} total={stats.totalRsvps} guests={stats.yesGuests} color="#16a34a" />
                      <ResponseBar label="Maybe" count={stats.maybeCount} total={stats.totalRsvps} guests={stats.maybeGuests} color="#d97706" />
                      <ResponseBar label="Declined" count={stats.noCount} total={stats.totalRsvps} guests={stats.noGuests} color="#dc2626" />
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        )}

        {/* ── Attendees ── */}
        {analyticsTab === 'attendees' && !monthLoading && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={S.cardTitle}>{eventFilter === 'all' ? `All attendees — ${monthLabel}` : `Attendees — ${selectedEvent?.title || ''}`}</div>
                <div style={S.cardSub}>{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</div>
              </div>
              {eventFilter !== 'all' && (
                <button onClick={() => fetchDetail(selectedEvent)} style={S.iconBtn} title="Refresh">
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
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

            {(eventFilter !== 'all' && detailLoading) ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--cf-text-muted)' }}>⏳ Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={S.emptyBlock}>No RSVPs yet {eventFilter === 'all' ? 'this month' : 'for this event'}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #d4d4d8' }}>
                      {[
                        ...(eventFilter === 'all' ? ['Event'] : []),
                        'Name', 'Guests', 'Status', 'Phone', 'Submitted',
                        ...(eventFilter !== 'all' ? [''] : []),
                      ].map((h) => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => {
                      const attendance = getAttendance(item);
                      return (
                        <tr key={item.rsvpId || `${item._eventDate}-${item.name}-${idx}`} style={S.tr}>
                          {eventFilter === 'all' && (
                            <td style={{ ...S.td, color: 'var(--cf-text-muted)', maxWidth: 160 }}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item._eventTitle}</div>
                            </td>
                          )}
                          <td style={{ ...S.td, fontWeight: 600 }}>{item.name}</td>
                          <td style={S.td}>
                            <span style={{ ...S.pill, background: '#16a34a1a', color: '#16a34a' }}>{item.count}</span>
                          </td>
                          <td style={S.td}>
                            <span style={{
                              ...S.pill,
                              background: attendance === 'yes' ? '#16a34a1a' : attendance === 'no' ? '#dc26261a' : '#d977061a',
                              color: attendance === 'yes' ? '#16a34a' : attendance === 'no' ? '#dc2626' : '#d97706',
                            }}>
                              {attendance === 'yes' ? '✅ Yes' : attendance === 'no' ? '❌ No' : '🤔 Maybe'}
                            </span>
                          </td>
                          <td style={{ ...S.td, color: 'var(--cf-text-muted)' }}>{item.phone || '—'}</td>
                          <td style={{ ...S.td, color: 'var(--cf-text-muted)', whiteSpace: 'nowrap' }}>
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          {eventFilter !== 'all' && (
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
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────
function StatTile({ label, value, sub, color }) {
  return (
    <div style={S.statCard}>
      <div style={S.statLabel}>{label}</div>
      <div style={{ ...S.statValue, color: color || 'var(--cf-text-primary)' }}>{value}</div>
      {sub && <div style={S.statSub}>{sub}</div>}
    </div>
  );
}

function ResponseBar({ label, count, total, guests, color }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, color: 'var(--cf-text-primary)' }}>{label}</span>
        <span style={{ color: 'var(--cf-text-muted)' }}>
          {count}{guests !== undefined ? ` · ${guests} guests` : ''}
        </span>
      </div>
      <div style={{ background: '#e4e4e7', height: 8, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ── Theme-aware styles — cream/white cards on the app's shared surface ──────
const S = {
  wrap:        { display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--cf-bg-base)', color: 'var(--cf-text-primary)', fontFamily: "'DM Sans', sans-serif" },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  h1:          { fontSize: '1.6rem', fontWeight: 800, color: 'var(--cf-text-primary)', fontFamily: "'Playfair Display', Georgia, serif" },
  sub:         { fontSize: '0.85rem', color: 'var(--cf-text-muted)', marginTop: 2 },
  closeBtn:    { background: 'transparent', border: '1px solid var(--cf-border)', color: 'var(--cf-text-primary)', padding: 8, borderRadius: 8, cursor: 'pointer', display: 'flex' },
  body:        { display: 'flex', flexDirection: 'column', gap: 14 },
  filterBar:   { display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' },
  filterField: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 },
  filterLabel: { fontSize: '0.7rem', color: 'var(--cf-text-muted)', fontWeight: 600 },
  select:      { background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', color: 'var(--cf-text-primary)', padding: '8px 10px', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer', outline: 'none', fontFamily: "'DM Sans', sans-serif" },
  exportBtn:   { display: 'flex', alignItems: 'center', gap: 6, background: '#000000', color: '#ffffff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: '0.85rem', fontWeight: 700, fontFamily: "'DM Sans', sans-serif", marginLeft: 'auto' },
  tabs:        { display: 'flex', gap: 4, borderBottom: '1px solid var(--cf-border)' },
  tab:         { padding: '10px 4px', marginRight: 18, border: 'none', borderBottom: '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 600, color: 'var(--cf-text-muted)', fontFamily: "'DM Sans', sans-serif" },
  tabActive:   { color: 'var(--cf-text-primary)', borderBottomColor: '#000000' },
  loadingLine: { color: 'var(--cf-text-muted)', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' },
  statSection: { background: 'var(--cf-accent-glow)', border: '1px solid var(--cf-accent)', borderRadius: 14, padding: 16 },
  statGrid:    { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 },
  statCard:    { background: 'var(--cf-bg-surface)', borderRadius: 10, border: '1px solid var(--cf-border)', padding: '14px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' },
  statLabel:   { fontSize: '0.72rem', color: 'var(--cf-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  statValue:   { fontSize: '2.1rem', fontWeight: 700, lineHeight: 1.25, fontFamily: "'Playfair Display', Georgia, serif" },
  statSub:     { fontSize: '0.72rem', color: 'var(--cf-text-muted)', marginTop: 3, fontStyle: 'italic' },
  card:        { background: 'var(--cf-bg-surface)', borderRadius: 10, border: '1px solid var(--cf-border)', padding: 18, boxShadow: '0 4px 16px rgba(0,0,0,0.05)' },
  cardTitle:   { fontSize: '0.95rem', fontWeight: 700, color: 'var(--cf-text-primary)', fontFamily: "'Playfair Display', Georgia, serif" },
  cardSub:     { fontSize: '0.76rem', color: 'var(--cf-text-muted)', marginTop: 2 },
  emptyBlock:  { textAlign: 'center', padding: '32px 0', color: 'var(--cf-text-muted)', fontSize: '0.85rem' },
  searchBox:   { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--cf-bg-base)', border: '1px solid var(--cf-border)', borderRadius: 8, padding: '7px 10px' },
  searchInput: { background: 'transparent', border: 'none', color: 'var(--cf-text-primary)', fontSize: '0.84rem', outline: 'none', flex: 1, fontFamily: "'DM Sans', sans-serif" },
  th:          { padding: '9px 12px', textAlign: 'left', color: 'var(--cf-text-muted)', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
  tr:          { borderBottom: '1px solid var(--cf-border)' },
  td:          { padding: '10px 12px', fontSize: '0.82rem', color: 'var(--cf-text-primary)' },
  pill:        { padding: '3px 9px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 700 },
  iconBtn:     { background: 'var(--cf-bg-surface)', border: '1px solid var(--cf-border)', color: 'var(--cf-text-muted)', padding: 8, borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center' },
  deleteBtn:   { background: 'transparent', border: '1px solid #dc2626', color: '#dc2626', padding: 6, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center' },
};
