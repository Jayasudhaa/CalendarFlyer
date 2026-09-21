import React, { useState } from 'react';
import CalendarTimePicker from './CalendarTimePicker';

/**
 * ScheduleReminders — the "Schedule for later" card on BroadcastPage:
 * either a one-off scheduled send, or a countdown of N reminders before an
 * event. Extracted out of BroadcastPage.jsx (which had grown past 1500
 * lines) as part of the "split into smaller components" pass — this piece
 * was a clean cut because every bit of its state (scheduleMode, scheduleAt,
 * scheduling, scheduleError, scheduledOk, scheduleTab, eventAt,
 * reminderOffsets, reminderResult) and its two submit handlers
 * (handleSchedule / handleScheduleReminders) were only ever read or written
 * from inside this one card — nothing outside it touched them.
 *
 * `selected`, `caption`, `autoRSVP`, `rsvpUrl`, `uploadedMedia`,
 * `showWATemplate`, `selectedWATemplate`, `waVars` are the compose-wide
 * fields this card needs to build the POST /schedule body — they're owned
 * by BroadcastPage and passed down read-only, the same values the
 * send-now flow there uses.
 *
 * server/scheduler.js is what actually fires these (a ~60s poll, since
 * this app has no queue/cron infra — see that file's header). The two
 * POST bodies below (`scheduled_for` vs. `event_at`+`reminders[]`) are
 * handled by the two branches of routes/broadcast.js's POST /schedule.
 */
export default function ScheduleReminders({
  P, selected, caption, autoRSVP, rsvpUrl, uploadedMedia,
  showWATemplate, selectedWATemplate, waVars,
}) {
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduledOk, setScheduledOk] = useState(false);

  // ── Event reminders (schedule a countdown of sends before one event, vs
  // the single one-off send above) ────────────────────────────────────────
  const [scheduleTab, setScheduleTab] = useState('once'); // 'once' | 'reminders'
  const [eventAt, setEventAt] = useState('');
  const [reminderOffsets, setReminderOffsets] = useState(() => defaultReminderOffsets());
  const [reminderResult, setReminderResult] = useState(null); // { created, skipped } from the last reminder-series schedule call

  // Minimum lead time mirrors MIN_SCHEDULE_LEAD_MS in routes/broadcast.js —
  // kept as a plain literal here rather than fetched from the server, since
  // it only needs to roughly match for the datetime picker's min attribute
  // to feel right; the server is what actually enforces it.
  const MIN_SCHEDULE_LEAD_MINUTES = 2;
  function minScheduleLocal() {
    const d = new Date(Date.now() + MIN_SCHEDULE_LEAD_MINUTES * 60 * 1000);
    d.setSeconds(0, 0);
    // datetime-local wants "YYYY-MM-DDTHH:mm" in the browser's local time —
    // toISOString() would convert to UTC first, off by the visitor's
    // timezone offset, so build it from the local getters instead.
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Reminder-series defaults: 7 days / 1 day / 3 hours before the event —
  // matches Meetup's own event-reminder cadence ("typically 7 days, 1 day,
  // and a few hours before the event") and the 3-reminder count a Wild
  // Apricot study found performed best, with a 4th reminder adding only
  // marginal benefit (see the plan shared in chat before this was built).
  // Each row here becomes one independent scheduled broadcast on submit.
  const REMINDER_UNIT_MINUTES = { hours: 60, days: 1440 };
  function defaultReminderOffsets() {
    return [
      { id: 'r1', value: 7, unit: 'days' },
      { id: 'r2', value: 1, unit: 'days' },
      { id: 'r3', value: 3, unit: 'hours' },
    ];
  }
  function addReminder() {
    setReminderOffsets(list => list.length >= 4 ? list : [...list, { id: `r${Date.now()}`, value: 1, unit: 'days' }]);
  }
  function removeReminder(id) {
    setReminderOffsets(list => list.filter(r => r.id !== id));
  }
  function updateReminder(id, patch) {
    setReminderOffsets(list => list.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  const anySelected = Object.values(selected).some(Boolean);

  const handleSchedule = async () => {
    setScheduleError('');
    setScheduledOk(false);
    const platforms = Object.keys(selected).filter(k => selected[k]);
    if (!platforms.length) { setScheduleError('Select at least one channel first.'); return; }
    if (!caption.trim()) { setScheduleError('Write a message first.'); return; }
    if (!scheduleAt) { setScheduleError('Pick a date and time.'); return; }
    const when = new Date(scheduleAt).getTime();
    if (!when || when < Date.now() + MIN_SCHEDULE_LEAD_MINUTES * 60 * 1000) {
      setScheduleError(`Pick a time at least ${MIN_SCHEDULE_LEAD_MINUTES} minutes from now.`);
      return;
    }
    if (platforms.includes('instagram') && !uploadedMedia) {
      setScheduleError('Instagram requires an image — add one under "Add Creative" first.');
      return;
    }

    setScheduling(true);
    try {
      const token = localStorage.getItem('cf_token');
      const body = {
        platforms, caption, auto_rsvp: autoRSVP, rsvp_url: rsvpUrl,
        scheduled_for: when,
      };
      if (uploadedMedia) body.imageBase64 = uploadedMedia;
      if (platforms.includes('whatsapp') && showWATemplate) {
        body.wa_template = { template_name: selectedWATemplate.id, variables: waVars };
      }
      const res = await fetch('/api/broadcast/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not schedule this broadcast');
      setScheduledOk(true);
      setScheduleMode(false);
      setScheduleAt('');
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setScheduling(false);
    }
  };

  // Same flow as handleSchedule above but for the "Event reminders" tab:
  // one event date/time plus N lead-time offsets → POST /schedule with
  // `event_at` + `reminders[]` instead of a single `scheduled_for`. The
  // backend creates one broadcast row per reminder (sharing a
  // broadcast_group_id) reusing the exact same validation/upload path.
  const handleScheduleReminders = async () => {
    setScheduleError('');
    setScheduledOk(false);
    setReminderResult(null);
    const platforms = Object.keys(selected).filter(k => selected[k]);
    if (!platforms.length) { setScheduleError('Select at least one channel first.'); return; }
    if (!caption.trim()) { setScheduleError('Write a message first.'); return; }
    if (!eventAt) { setScheduleError('Pick the event date and time.'); return; }
    if (!reminderOffsets.length) { setScheduleError('Add at least one reminder.'); return; }
    if (platforms.includes('instagram') && !uploadedMedia) {
      setScheduleError('Instagram requires an image — add one under "Add Creative" first.');
      return;
    }
    const eventWhen = new Date(eventAt).getTime();
    if (!eventWhen || Number.isNaN(eventWhen)) { setScheduleError('Pick a valid event date and time.'); return; }

    setScheduling(true);
    try {
      const token = localStorage.getItem('cf_token');
      const body = {
        platforms, caption, auto_rsvp: autoRSVP, rsvp_url: rsvpUrl,
        event_at: eventWhen,
        reminders: reminderOffsets.map(r => ({
          minutes_before: r.value * REMINDER_UNIT_MINUTES[r.unit],
          label: `${r.value} ${r.unit} before`,
        })),
      };
      if (uploadedMedia) body.imageBase64 = uploadedMedia;
      if (platforms.includes('whatsapp') && showWATemplate) {
        body.wa_template = { template_name: selectedWATemplate.id, variables: waVars };
      }
      const res = await fetch('/api/broadcast/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not schedule these reminders');
      setReminderResult({ created: data.created || [], skipped: data.skipped || [] });
      setScheduledOk(true);
      setScheduleMode(false);
      setEventAt('');
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setScheduling(false);
    }
  };

  // Same card/label styling BroadcastPage uses elsewhere — redefined here
  // (rather than passed as props) since it's a plain style-object literal,
  // not shared state.
  const card = { background: P.card, border: '1px solid rgba(0,0,0,0.05)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' };
  const lbl = { fontSize: '0.88rem', color: P.muted, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" };

  function subTabStyle(active) {
    return { padding: '7px 13px', borderRadius: 8, border: `1px solid ${active ? 'transparent' : P.border}`, background: active ? 'linear-gradient(135deg,#2563eb,#7c3aed)' : '#fff', color: active ? '#fff' : P.muted, fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" };
  }
  function scheduleBtnStyle(disabled, grad) {
    return { padding: '10px 18px', border: 'none', borderRadius: 9, background: disabled ? P.border : `linear-gradient(135deg,${grad})`, color: '#fff', fontWeight: 800, fontSize: '0.99rem', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", marginTop: 12 };
  }

  return (
    <div style={{ ...card, background: 'linear-gradient(135deg, rgba(37,99,235,0.07), rgba(124,58,237,0.05))', border: '2px solid rgba(37,99,235,0.35)', marginBottom: 0, boxShadow: '0 3px 14px -6px rgba(37,99,235,0.35)' }}>
      <div
        onClick={() => { setScheduleMode(v => !v); setScheduleError(''); setScheduledOk(false); setReminderResult(null); if (!scheduleAt) setScheduleAt(minScheduleLocal()); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem', flexShrink: 0 }}>🕐</div>
          <div>
            <div style={{ ...lbl, fontSize: '1.05rem' }}>Schedule for later</div>
            <div style={{ color: P.faint, fontSize: '0.8rem', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal' }}>One-time send, or a countdown of reminders before an event</div>
          </div>
        </div>
        <span style={{ color: '#2563eb', fontSize: '0.913rem', fontWeight: 800, flexShrink: 0 }}>{scheduleMode ? '▲ Hide' : '▼ Set it up'}</span>
      </div>

      {scheduleMode && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { setScheduleTab('once'); setScheduleError(''); }} style={subTabStyle(scheduleTab === 'once')}>📌 One-time schedule</button>
            <button type="button" onClick={() => { setScheduleTab('reminders'); setScheduleError(''); }} style={subTabStyle(scheduleTab === 'reminders')}>🔔 Event reminders</button>
          </div>

          {scheduleTab === 'once' ? (
            <div>
              <CalendarTimePicker label="Send at" value={scheduleAt} min={minScheduleLocal()} onChange={setScheduleAt} accent="#2563eb" />
              <button onClick={handleSchedule} disabled={scheduling || !anySelected} style={scheduleBtnStyle(scheduling || !anySelected, '#2563eb,#1d4ed8')}>
                {scheduling ? 'Scheduling…' : '📅 Schedule Broadcast'}
              </button>
            </div>
          ) : (
            <div>
              <CalendarTimePicker label="Event date & time" value={eventAt} min={minScheduleLocal()} onChange={setEventAt} accent="#7c3aed" />
              <div style={{ marginTop: 14, marginBottom: 4 }}>
                <div style={{ color: P.muted, fontSize: '0.858rem', fontWeight: 700, marginBottom: 6 }}>Send reminders</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reminderOffsets.map((r, i) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: '#fff', border: `1px solid ${P.border}`, borderRadius: 8, padding: '7px 10px' }}>
                      <span style={{ color: P.faint, fontSize: '0.858rem', fontWeight: 700 }}>#{i + 1}</span>
                      <input
                        type="number" min={1} max={30} value={r.value}
                        onChange={e => updateReminder(r.id, { value: Math.max(1, Number(e.target.value) || 1) })}
                        style={{ width: 52, padding: '5px 6px', border: `1px solid ${P.border}`, borderRadius: 6, fontFamily: "'DM Sans', sans-serif" }}
                      />
                      <select value={r.unit} onChange={e => updateReminder(r.id, { unit: e.target.value })} style={{ padding: '5px 6px', border: `1px solid ${P.border}`, borderRadius: 6, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
                        <option value="hours">hours before</option>
                        <option value="days">days before</option>
                      </select>
                      {eventAt && (
                        <span style={{ color: P.faint, fontSize: '0.78rem' }}>
                          → {new Date(new Date(eventAt).getTime() - r.value * (r.unit === 'days' ? 1440 : 60) * 60000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      )}
                      <button type="button" onClick={() => removeReminder(r.id)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontWeight: 800, fontSize: '0.99rem' }}>✕</button>
                    </div>
                  ))}
                </div>
                {reminderOffsets.length < 4 && (
                  <button type="button" onClick={addReminder} style={{ marginTop: 8, border: `1px dashed ${P.border}`, background: 'transparent', color: '#7c3aed', borderRadius: 7, padding: '6px 10px', fontWeight: 700, fontSize: '0.858rem', cursor: 'pointer' }}>
                    + Add another reminder
                  </button>
                )}
                <div style={{ marginTop: 6, color: P.faint, fontSize: '0.78rem' }}>
                  Default (7 days / 1 day / 3 hours before) mirrors Meetup's own event-reminder cadence.
                </div>
              </div>
              <button onClick={handleScheduleReminders} disabled={scheduling || !anySelected || !reminderOffsets.length} style={scheduleBtnStyle(scheduling || !anySelected || !reminderOffsets.length, '#7c3aed,#5b21b6')}>
                {scheduling ? 'Scheduling…' : `🔔 Schedule ${reminderOffsets.length} Reminder${reminderOffsets.length === 1 ? '' : 's'}`}
              </button>
            </div>
          )}
        </div>
      )}

      {scheduleError && (
        <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid #f8717140', color: '#dc2626', fontSize: '0.88rem', fontWeight: 600 }}>{scheduleError}</div>
      )}
      {scheduledOk && (
        <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(74,222,128,0.1)', border: '1px solid #4ade8040', color: '#16a34a', fontSize: '0.88rem', fontWeight: 700 }}>
          {reminderResult
            ? `✓ Scheduled ${reminderResult.created.length} reminder${reminderResult.created.length === 1 ? '' : 's'}${reminderResult.skipped.length ? ` (${reminderResult.skipped.length} skipped — already in the past for this event date)` : ''}. Find them under 🕓 History.`
            : '✓ Scheduled! Find it under 🕓 History, where you can cancel it anytime before it sends.'}
        </div>
      )}
    </div>
  );
}
