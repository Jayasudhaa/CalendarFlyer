import React from 'react';

// Same glossy-black icon badge BroadcastPage.jsx defines for every card
// header on that page (Flyer Studio's Event & Text panel recipe) —
// duplicated here rather than shared through an import, since it's a
// four-line style literal with no state or logic, and importing it back
// from BroadcastPage.jsx (which imports *this* file) would make the two
// files circular for the sake of one span.
const GLOSS_BLACK = 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg,#3a3a3a,#000000)';
const GLOSS_SHADOW = '0 2px 6px -2px rgba(0,0,0,0.5)';
function IconBadge({ icon, size = 24 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.55, background: GLOSS_BLACK, color: '#fff', boxShadow: GLOSS_SHADOW }}>{icon}</span>
  );
}

// Status badge for one History row — mirrors broadcasts.js's computeStatus
// outcomes ('sent' | 'partial' | 'failed') plus the two states that live
// outside a send attempt entirely ('scheduled' | 'cancelled').
function historyStatusPill(status) {
  const m = {
    sent:      { color: '#16a34a', bg: 'rgba(22,163,74,0.1)',  label: '✓ Sent' },
    partial:   { color: '#d97706', bg: 'rgba(217,119,6,0.1)',  label: '◐ Partial' },
    failed:    { color: '#dc2626', bg: 'rgba(220,38,38,0.1)',  label: '✗ Failed' },
    scheduled: { color: '#2563eb', bg: 'rgba(37,99,235,0.1)',  label: '📅 Scheduled' },
    cancelled: { color: '#71717a', bg: 'rgba(113,113,122,0.1)', label: 'Cancelled' },
    sending:   { color: '#d97706', bg: 'rgba(217,119,6,0.1)',  label: '⏳ Sending' },
  };
  return m[status] || { color: '#71717a', bg: 'rgba(113,113,122,0.1)', label: status };
}

/**
 * BroadcastHistory — the "Send History" panel BroadcastPage.jsx shows
 * when `view === 'history'`. Extracted alongside ScheduleReminders.jsx as
 * part of splitting that ~1500-line file into smaller pieces: this block
 * was fully self-contained (its own list rendering, its own status-pill
 * logic), so the only things it needs from the parent are the history
 * data itself and the two cancel actions, all passed down as props —
 * BroadcastPage.jsx still owns loading it (loadHistory/openHistory) and
 * the underlying state, since `view` also gates what the rest of the page
 * shows.
 *
 * `scheduledGroupCounts`/`onCancelGroup` back the "Cancel all N reminders"
 * link on a reminder-series row — see routes/broadcast.js's POST
 * /schedule/cancel-batch.
 */
export default function BroadcastHistory({
  P, PLATFORMS, historyItems, historyLoading, historyError,
  cancellingId, scheduledGroupCounts, onCancelScheduled, onCancelGroup,
}) {
  const card = { background: P.card, border: '1px solid rgba(0,0,0,0.05)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' };
  const lbl = { fontSize: '0.88rem', color: P.muted, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" };
  const headRow = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 };

  return (
    <div style={{ width: '100%', boxSizing: 'border-box', maxWidth: 900, margin: '0 auto', padding: '22px 28px' }}>
      <div style={card}>
        <div style={headRow}><IconBadge icon="🕓" /><span style={lbl}>Send History</span></div>

        {historyError && (
          <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid #f8717140', color: '#dc2626', fontSize: '0.913rem', marginBottom: 10 }}>{historyError}</div>
        )}
        {historyLoading && (
          <div style={{ padding: '20px 0', textAlign: 'center', color: P.faint, fontSize: '0.99rem' }}>Loading…</div>
        )}
        {!historyLoading && !historyItems.length && !historyError && (
          <div style={{ padding: '28px 0', textAlign: 'center', color: P.faint, fontSize: '0.99rem' }}>Nothing sent or scheduled yet — broadcasts you send or schedule will show up here.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {historyItems.map(item => {
            const st = historyStatusPill(item.status);
            const when = item.status === 'scheduled' ? item.scheduled_for : (item.sent_at || item.created_at);
            const whenLabel = when ? new Date(when).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
            return (
              <div key={item.broadcast_id} style={{ border: `1px solid ${P.border}`, borderRadius: 10, padding: '11px 13px', background: P.bg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: '0.792rem', fontWeight: 800, background: st.bg, color: st.color }}>{st.label}</span>
                      <span style={{ fontSize: '0.858rem', color: P.faint, fontWeight: 600 }}>{(item.platforms || []).map(p => PLATFORMS.find(pl => pl.id === p)?.label || p).join(' · ')}</span>
                      {item.reminder_label && (
                        <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: '0.792rem', fontWeight: 800, background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>🔔 {item.reminder_label}</span>
                      )}
                    </div>
                    <div style={{ color: P.text, fontSize: '0.99rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.caption || '(no message)'}</div>
                    <div style={{ color: P.faint, fontSize: '0.836rem', marginTop: 3 }}>{item.status === 'scheduled' ? 'Scheduled for ' : item.status === 'cancelled' ? 'Was scheduled for ' : 'Sent '}{whenLabel}</div>
                    {item.results && Object.keys(item.results).length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        {Object.entries(item.results).map(([platform, r]) => (
                          <span key={platform} style={{ fontSize: '0.792rem', fontWeight: 700, color: r.success ? '#16a34a' : '#dc2626' }} title={r.error || ''}>
                            {r.success ? '✓' : '✗'} {PLATFORMS.find(pl => pl.id === platform)?.label || platform}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {item.status === 'scheduled' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
                      <button
                        onClick={() => onCancelScheduled(item.broadcast_id)}
                        disabled={cancellingId === item.broadcast_id}
                        style={{ padding: '6px 11px', borderRadius: 7, border: '1px solid #f8717166', background: '#fff', color: '#dc2626', fontSize: '0.858rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {cancellingId === item.broadcast_id ? 'Cancelling…' : 'Cancel'}
                      </button>
                      {item.broadcast_group_id && scheduledGroupCounts[item.broadcast_group_id] > 1 && (
                        <button
                          onClick={() => onCancelGroup(item.broadcast_group_id)}
                          disabled={cancellingId === item.broadcast_group_id}
                          style={{ border: 'none', background: 'transparent', color: '#7c3aed', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                          Cancel all {scheduledGroupCounts[item.broadcast_group_id]} reminders
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
