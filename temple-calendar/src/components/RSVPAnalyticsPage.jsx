/**
 * src/components/RSVPAnalyticsModal.jsx
 * RSVP Analytics Modal - matches Flyer/Broadcast Studio design
 * FIXED: Receives events as prop from parent
 */
import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Search, Trash2, TrendingUp } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function RSVPAnalyticsPage({ events = [] }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [rsvpData, setRsvpData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [eventSearch, setEventSearch] = useState('');

  // Select first event on mount
  useEffect(() => {

    if (events.length > 0 && !selectedEvent) {
      setSelectedEvent(events[0]);
      fetchRSVPData(events[0].id);
    }
  }, [events]);

  const fetchRSVPData = async (eventId) => {
    try {
      const res = await fetch(`${API}/api/rsvp/${eventId}`, {
        credentials: 'include',
        headers: { 
          'x-admin-secret': import.meta.env.VITE_ADMIN_SECRET || '',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch RSVP data');
      const data = await res.json();
      setRsvpData(data);
    } catch (err) {
      console.error('RSVP fetch error:', err);
      setRsvpData({ items: [], totalCount: 0, timeline: {}, attendingBreakdown: {} });
    }
  };

  const handleEventSelect = (event) => {
    setSelectedEvent(event);
    fetchRSVPData(event.id);
  };

  const handleDelete = async (rsvpId, name) => {
    if (!window.confirm(`Remove RSVP for ${name}?`)) return;
    setDeleting(rsvpId);
    try {
      await fetch(`${API}/api/rsvp/${selectedEvent.id}/${rsvpId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 
          'x-admin-secret': import.meta.env.VITE_ADMIN_SECRET || '',
        },
      });
      fetchRSVPData(selectedEvent.id);
    } catch (err) {
      alert('Failed to delete RSVP');
    } finally {
      setDeleting(null);
    }
  };

  const exportCSV = () => {
    if (!rsvpData?.items?.length) return;
    const rows = [
      ['Name', 'Attendees', 'Attending', 'Phone', 'Notes', 'Submitted At'],
      ...rsvpData.items.map(i => [
        i.name, 
        i.count, 
        i.attending || 'yes',
        i.phone || '',
        i.notes || '',
        new Date(i.createdAt).toLocaleString()
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rsvp_${selectedEvent?.title?.replace(/\s+/g, '_') || 'event'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Group events by month
  const groupedEvents = React.useMemo(() => {
    const filtered = events.filter(e => 
      (e.title || '').toLowerCase().includes(eventSearch.toLowerCase())
    );
    
    const groups = {};
    filtered.forEach(event => {
      const date = new Date(event.date + 'T12:00:00');
      const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(event);
    });
    
    return Object.entries(groups).sort((a, b) => {
      const dateA = new Date(a[1][0].date + 'T12:00:00');
      const dateB = new Date(b[1][0].date + 'T12:00:00');
      return dateB - dateA;
    });
  }, [events, eventSearch]);

  const filtered = rsvpData?.items?.filter(i =>
    (i.name || '').toLowerCase().includes(search.toLowerCase())
  ) || [];

  const stats = {
    totalRsvps: rsvpData?.items?.length || 0,
    totalGuests: rsvpData?.totalCount || 0,
    avgPartySize: rsvpData?.items?.length 
      ? (rsvpData.totalCount / rsvpData.items.length).toFixed(1) 
      : '0',
    yesCount: rsvpData?.items?.filter(i => i.attending === 'yes')?.length || 0,
    noCount: rsvpData?.items?.filter(i => i.attending === 'no')?.length || 0,
    maybeCount: rsvpData?.items?.filter(i => i.attending === 'maybe')?.length || 0,
  };

  return (
    <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              <TrendingUp style={{ width: '28px', height: '28px', marginRight: '10px' }} />
              RSVP Analytics
            </h1>
            <p style={styles.subtitle}>Track event responses and attendance</p>
          </div>
        </div>

        <div style={styles.container}>
          {/* Event Selector */}
          <div style={styles.eventSelector}>
            <div style={styles.sectionLabel}>SELECT EVENT</div>
            <div style={styles.eventSearch}>
              <Search className="w-4 h-4" style={{ color: '#6b7280' }} />
              <input
                type="text"
                placeholder="Search events..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                style={styles.eventSearchInput}
              />
            </div>
            
            <div style={styles.eventList}>
              {groupedEvents.map(([month, monthEvents]) => (
                <div key={month} style={styles.monthGroup}>
                  <div style={styles.monthHeader}>
                    <span>{month}</span>
                    <span style={styles.monthCount}>{monthEvents.length}</span>
                  </div>
                  {monthEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => handleEventSelect(event)}
                      style={{
                        ...styles.eventCard,
                        ...(selectedEvent?.id === event.id ? styles.eventCardActive : {}),
                      }}
                    >
                      <div style={styles.eventCardTitle}>{event.title}</div>
                      <div style={styles.eventCardDate}>
                        {new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                        {event.time && ` • ${event.time}`}
                      </div>
                      {selectedEvent?.id === event.id && (
                        <div style={styles.viewBadge}>Viewing</div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              
              {groupedEvents.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📅</div>
                  <div style={{ fontSize: '0.85rem' }}>
                    {eventSearch ? 'No events found' : 'No events available'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analytics Panel */}
          {selectedEvent && rsvpData && (
            <div style={styles.analyticsPanel}>
              {/* Stats Grid */}
              <div style={styles.statsGrid}>
                <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)' }}>
                  <div style={styles.statIcon}>📋</div>
                  <div style={styles.statValue}>{stats.totalRsvps}</div>
                  <div style={styles.statLabel}>Total RSVPs</div>
                </div>
                <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
                  <div style={styles.statIcon}>👥</div>
                  <div style={styles.statValue}>{stats.totalGuests}</div>
                  <div style={styles.statLabel}>Total Guests</div>
                </div>
                <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' }}>
                  <div style={styles.statIcon}>👨‍👩‍👧</div>
                  <div style={styles.statValue}>{stats.avgPartySize}</div>
                  <div style={styles.statLabel}>Avg Party Size</div>
                </div>
                <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' }}>
                  <div style={styles.statIcon}>✅</div>
                  <div style={styles.statValue}>{stats.yesCount}</div>
                  <div style={styles.statLabel}>Confirmed</div>
                </div>
              </div>

              {/* Attendance Breakdown */}
              <div style={styles.card}>
                <div style={styles.cardTitle}>📊 Attendance Breakdown</div>
                <div style={styles.attendanceGrid}>
                  <div style={styles.attendanceCard}>
                    <div style={{ ...styles.attendanceLabel, color: '#16a34a' }}>✅ Yes</div>
                    <div style={styles.attendanceValue}>{stats.yesCount}</div>
                    <div style={styles.attendanceBar}>
                      <div style={{
                        width: `${stats.totalRsvps ? (stats.yesCount / stats.totalRsvps * 100) : 0}%`,
                        height: '100%',
                        background: '#16a34a',
                        borderRadius: '6px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                  <div style={styles.attendanceCard}>
                    <div style={{ ...styles.attendanceLabel, color: '#d97706' }}>🤔 Maybe</div>
                    <div style={styles.attendanceValue}>{stats.maybeCount}</div>
                    <div style={styles.attendanceBar}>
                      <div style={{
                        width: `${stats.totalRsvps ? (stats.maybeCount / stats.totalRsvps * 100) : 0}%`,
                        height: '100%',
                        background: '#d97706',
                        borderRadius: '6px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                  <div style={styles.attendanceCard}>
                    <div style={{ ...styles.attendanceLabel, color: '#dc2626' }}>❌ No</div>
                    <div style={styles.attendanceValue}>{stats.noCount}</div>
                    <div style={styles.attendanceBar}>
                      <div style={{
                        width: `${stats.totalRsvps ? (stats.noCount / stats.totalRsvps * 100) : 0}%`,
                        height: '100%',
                        background: '#dc2626',
                        borderRadius: '6px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* RSVP List */}
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <div style={styles.cardTitle}>👥 All RSVPs</div>
                    <div style={styles.cardSubtitle}>{filtered.length} entries</div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => fetchRSVPData(selectedEvent.id)} style={styles.iconBtn}>
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={exportCSV} style={styles.iconBtn} disabled={!rsvpData?.items?.length}>
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div style={styles.searchBox}>
                  <Search className="w-4 h-4" style={{ color: '#6b7280' }} />
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={styles.searchInput}
                  />
                </div>

                {filtered.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                    <div style={{ fontSize: '1.1rem', color: '#9ca3af' }}>No RSVPs yet</div>
                  </div>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.tableHeaderRow}>
                          <th style={styles.tableHeader}>#</th>
                          <th style={styles.tableHeader}>Name</th>
                          <th style={styles.tableHeader}>Guests</th>
                          <th style={styles.tableHeader}>Status</th>
                          <th style={styles.tableHeader}>Phone</th>
                          <th style={styles.tableHeader}>Submitted</th>
                          <th style={styles.tableHeader}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((item, idx) => (
                          <tr key={item.rsvpId} style={styles.tableRow}>
                            <td style={styles.tableCell}>{idx + 1}</td>
                            <td style={{ ...styles.tableCell, fontWeight: '600', color: '#e2e8f0' }}>
                              {item.name}
                            </td>
                            <td style={styles.tableCell}>
                              <span style={styles.guestBadge}>{item.count}</span>
                            </td>
                            <td style={styles.tableCell}>
                              <span style={{
                                ...styles.statusBadge,
                                background: item.attending === 'yes' ? '#16a34a22' : item.attending === 'no' ? '#dc262622' : '#d9770622',
                                color: item.attending === 'yes' ? '#16a34a' : item.attending === 'no' ? '#dc2626' : '#d97706',
                              }}>
                                {item.attending === 'yes' ? '✅ Yes' : item.attending === 'no' ? '❌ No' : '🤔 Maybe'}
                              </span>
                            </td>
                            <td style={styles.tableCell}>{item.phone || '—'}</td>
                            <td style={styles.tableCell}>
                              {new Date(item.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td style={styles.tableCell}>
                              <button
                                onClick={() => handleDelete(item.rsvpId, item.name)}
                                disabled={deleting === item.rsvpId}
                                style={styles.deleteBtn}
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
            </div>
          )}
        </div>
    </div>
  );
}

const styles = {
  page: {
    background: '#0f172a',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    background: '#1e293b',
    borderBottom: '1px solid #334155',
    padding: '20px 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#fff',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    margin: '4px 0 0 38px',
  },
  closeBtn: {
    background: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    padding: '8px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  container: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '20px',
    padding: '20px',
    overflow: 'auto',
    flex: 1,
    height: 'calc(100vh - 90px)',
  },
  eventSelector: {
    background: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
    padding: '16px',
    height: 'fit-content',
    maxHeight: 'calc(100vh - 130px)',
    overflowY: 'auto',
  },
  sectionLabel: {
    fontSize: '0.7rem',
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: '0.1em',
    marginBottom: '10px',
  },
  monthGroup: {
    marginBottom: '16px',
  },
  monthHeader: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    fontWeight: '700',
    letterSpacing: '0.05em',
    marginBottom: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthCount: {
    fontSize: '0.7rem',
    color: '#64748b',
    fontWeight: '500',
    background: '#0f172a',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  eventSearch: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '8px 10px',
    marginBottom: '12px',
  },
  eventSearchInput: {
    background: 'transparent',
    border: 'none',
    color: '#e2e8f0',
    fontSize: '0.85rem',
    outline: 'none',
    flex: 1,
  },
  eventList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  eventCard: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    position: 'relative',
  },
  eventCardActive: {
    background: '#1e40af22',
    borderColor: '#3b82f6',
  },
  eventCardTitle: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: '4px',
  },
  eventCardDate: {
    fontSize: '0.72rem',
    color: '#64748b',
  },
  viewBadge: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    background: '#3b82f6',
    color: '#fff',
    fontSize: '0.6rem',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  analyticsPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
  },
  statCard: {
    borderRadius: '12px',
    padding: '20px 16px',
    textAlign: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
  },
  statIcon: {
    fontSize: '1.8rem',
    marginBottom: '6px',
  },
  statValue: {
    fontSize: '2.2rem',
    fontWeight: '900',
    color: '#fff',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.8)',
    marginTop: '6px',
    fontWeight: '500',
  },
  card: {
    background: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
    padding: '20px',
  },
  cardTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: '4px',
  },
  cardSubtitle: {
    fontSize: '0.7rem',
    color: '#64748b',
  },
  attendanceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginTop: '16px',
  },
  attendanceCard: {
    background: '#0f172a',
    borderRadius: '8px',
    padding: '14px',
  },
  attendanceLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    marginBottom: '6px',
  },
  attendanceValue: {
    fontSize: '1.8rem',
    fontWeight: '800',
    color: '#e2e8f0',
    marginBottom: '10px',
  },
  attendanceBar: {
    background: '#334155',
    height: '6px',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '10px 12px',
    marginBottom: '16px',
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    color: '#e2e8f0',
    fontSize: '0.85rem',
    outline: 'none',
    flex: 1,
  },
  iconBtn: {
    background: '#0f172a',
    border: '1px solid #334155',
    color: '#94a3b8',
    padding: '8px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeaderRow: {
    borderBottom: '2px solid #334155',
  },
  tableHeader: {
    padding: '10px 12px',
    textAlign: 'left',
    color: '#64748b',
    fontWeight: '600',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tableRow: {
    borderBottom: '1px solid #334155',
  },
  tableCell: {
    padding: '12px',
    fontSize: '0.8rem',
    color: '#94a3b8',
  },
  guestBadge: {
    background: '#16a34a22',
    color: '#16a34a',
    fontWeight: '700',
    fontSize: '0.85rem',
    padding: '3px 10px',
    borderRadius: '20px',
  },
  statusBadge: {
    padding: '3px 8px',
    borderRadius: '20px',
    fontSize: '0.7rem',
    fontWeight: '600',
  },
  deleteBtn: {
    background: 'transparent',
    border: '1px solid #dc2626',
    color: '#dc2626',
    padding: '6px',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 0',
    color: '#64748b',
  },
};
