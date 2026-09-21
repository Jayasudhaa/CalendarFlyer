import React, { useState, useRef, useEffect } from 'react';

/**
 * CalendarTimePicker — a small, dependency-free date+time picker used by
 * BroadcastPage's "Schedule for later" card (replacing the old bare
 * `<input type="datetime-local">`, which rendered as tiny native browser
 * chrome that was easy to miss/misread). No date-picker library is
 * installed in this project, so this is a self-contained popover: a month
 * calendar grid + an hour/minute/AM-PM row, built on plain React state.
 *
 * Controlled like a normal input: `value`/`onChange` use the exact same
 * "YYYY-MM-DDTHH:mm" local-time string format `datetime-local` used, so it
 * drops in wherever that format was already being parsed
 * (`new Date(scheduleAt)` etc. all keep working unchanged).
 *
 * `min` (same string format) disables earlier days and, on the selected
 * day itself, clamps the time row.
 */

function pad(n) { return String(n).padStart(2, '0'); }

function toValue(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseValue(v) {
  if (!v) return null;
  const [datePart, timePart] = v.split('T');
  if (!datePart) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart || '00:00').split(':').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function CalendarTimePicker({ value, onChange, min, accent = '#2563eb', label }) {
  const selected = parseValue(value);
  const minDate = parseValue(min);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfDay(selected || minDate || new Date()));
  const rootRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open) setViewMonth(startOfDay(selected || minDate || new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function commit(next) {
    if (minDate && next < minDate) next = new Date(minDate);
    onChange(toValue(next));
  }

  function pickDay(day) {
    const base = selected || minDate || new Date();
    const next = new Date(day);
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    commit(next);
  }

  function setHour12(hour12, isPM) {
    const base = selected || minDate || new Date();
    const next = new Date(base);
    let h = hour12 % 12;
    if (isPM) h += 12;
    next.setHours(h);
    commit(next);
  }

  function setMinute(min5) {
    const base = selected || minDate || new Date();
    const next = new Date(base);
    next.setMinutes(min5);
    commit(next);
  }

  const disp = selected || minDate;
  const hour24 = disp ? disp.getHours() : 9;
  const isPM = hour24 >= 12;
  const hour12 = ((hour24 % 12) || 12);
  // Round to the nearest 5-minute step for the dropdown's *display* only
  // (the actual stored value is untouched until the user picks something).
  // A plain `Math.round(m/5)*5 % 60` wraps :58/:59 to "00" without carrying
  // into the next hour, showing a misleading hour/minute pair -- floor
  // instead, which only ever rounds a display value backward in time,
  // never past the top of the hour.
  const minuteRounded = disp ? Math.floor(disp.getMinutes() / 5) * 5 : 0;

  // Calendar grid for viewMonth
  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));

  const today = startOfDay(new Date());
  const minDay = minDate ? startOfDay(minDate) : null;

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid var(--cf-border)',
    borderRadius: 8, color: 'var(--cf-text, #18181b)', fontSize: '0.99rem', fontFamily: "'DM Sans', sans-serif",
    background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      {label && <label style={{ display: 'block', color: '#18181b', fontSize: '0.858rem', fontWeight: 700, marginBottom: 4 }}>{label}</label>}
      <div style={fieldStyle} onClick={() => setOpen(v => !v)}>
        <span>{disp ? disp.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Pick a date & time'}</span>
        <span style={{ color: accent, fontWeight: 800 }}>📅</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', zIndex: 40, top: 'calc(100% + 6px)', left: 0, minWidth: 280,
          background: '#fff', border: '1px solid var(--cf-border)', borderRadius: 12,
          boxShadow: '0 10px 30px -8px rgba(0,0,0,0.25)', padding: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={() => setViewMonth(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 800, color: '#18181b', padding: '2px 8px' }}>‹</button>
            <div style={{ fontWeight: 800, fontSize: '0.99rem', color: '#18181b' }}>{MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}</div>
            <button type="button" onClick={() => setViewMonth(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 800, color: '#18181b', padding: '2px 8px' }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#71717a', padding: '2px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 12 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const disabled = minDay ? startOfDay(day) < minDay : false;
              const isSelected = selected && sameDay(day, selected);
              const isToday = sameDay(day, today);
              return (
                <button
                  type="button" key={i} disabled={disabled} onClick={() => pickDay(day)}
                  style={{
                    aspectRatio: '1', border: isToday && !isSelected ? `1px solid ${accent}` : 'none', borderRadius: 7,
                    background: isSelected ? accent : 'transparent', color: disabled ? '#d4d4d8' : (isSelected ? '#fff' : '#18181b'),
                    fontWeight: isSelected ? 800 : 600, fontSize: '0.858rem', cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >{day.getDate()}</button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={hour12} onChange={e => setHour12(Number(e.target.value), isPM)} style={timeSelectStyle}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <span style={{ fontWeight: 800, color: '#18181b' }}>:</span>
            <select value={minuteRounded} onChange={e => setMinute(Number(e.target.value))} style={timeSelectStyle}>
              {MINUTE_STEPS.map(m => <option key={m} value={m}>{pad(m)}</option>)}
            </select>
            <div style={{ display: 'flex', border: '1px solid var(--cf-border)', borderRadius: 7, overflow: 'hidden' }}>
              {['AM', 'PM'].map(ap => (
                <button
                  type="button" key={ap} onClick={() => setHour12(hour12, ap === 'PM')}
                  style={{
                    border: 'none', padding: '7px 10px', fontWeight: 800, fontSize: '0.836rem', cursor: 'pointer',
                    background: (ap === 'PM') === isPM ? accent : '#fff', color: (ap === 'PM') === isPM ? '#fff' : '#18181b',
                  }}
                >{ap}</button>
              ))}
            </div>
            <button type="button" onClick={() => setOpen(false)}
              style={{ marginLeft: 'auto', border: 'none', background: accent, color: '#fff', borderRadius: 7, padding: '7px 12px', fontWeight: 800, fontSize: '0.836rem', cursor: 'pointer' }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const timeSelectStyle = {
  padding: '7px 8px', border: '1px solid var(--cf-border)', borderRadius: 7, fontWeight: 700,
  fontSize: '0.9rem', color: '#18181b', background: '#fff', fontFamily: "'DM Sans', sans-serif",
};
