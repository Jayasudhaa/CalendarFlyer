import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  INTENT_OPTIONS, AUDIENCE_OPTIONS, REGION_OPTIONS, STYLE_OPTIONS,
  PALETTE_OPTIONS, IMAGE_ROLE_OPTIONS, NEGATIVE_SPACE_OPTIONS,
} from '../posterSpec';
import { RUNWAY_FONT } from './runwayUI';

// ─── Answer confirmation sound — "Gentle Chime" ────────────────────────────
// A short two-note ascending chime (no audio file — synthesized on the fly
// via Web Audio) plays each time a question is answered, picked from three
// candidates previewed live for the user. Muted state remembers per browser
// since this tool sometimes gets used on shared screens/quiet offices — a
// small speaker toggle sits next to the wizard title.
const SOUND_KEY = 'cf_wizard_sound_enabled';
function isSoundEnabled() {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}
function persistSoundEnabled(on) {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
}
let _wizardAudioCtx = null;
function playConfirmChime() {
  if (!isSoundEnabled()) return;
  try {
    if (!_wizardAudioCtx) _wizardAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _wizardAudioCtx;
    const tone = (freq, start, dur, peak) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur + 0.02);
    };
    tone(659.25, 0, 0.16, 0.16);
    tone(880, 0.09, 0.22, 0.14);
  } catch { /* Web Audio unavailable — fail silent, sound is a nicety */ }
}

// ─── Guided Conversation ───────────────────────────────────────────────────
// Replaces the old flat stack of "one question after another, all expanded
// at once" — reported as making the left panel scroll forever ("why is the
// draft so big"). Same underlying fields, same defaults (posterSpec comes
// pre-filled from inferPosterSpecDefaults), same auto-compile-into-the-
// prompt behavior in AIVisualPanel — just presented as a short chat thread:
// only the CURRENT question is fully open with its pill/input options,
// everything already answered collapses into a compact ask/answer bubble
// pair in a capped-height scrolling thread above it, with a step counter.
// Clicking any past answer reopens that question for editing. Richer,
// warmer styling than the rest of the (deliberately flat/monochrome)
// AI Visual chrome — this is the piece the user specifically asked to make
// "rich UI".

// "Champagne Glass" — the confirmed ultra-premium palette for the AI Visual
// left rail (picked from a Champagne Glass vs. Midnight Atelier preview).
// Gold accent + deep gold + a bright gold used only for gradient highlights
// (icon/avatar/answer-bubble accents), never as a flat fill on its own, plus
// a warm ink pair and a translucent gold hairline used for both borders and
// as a `${LINE}66`-style tint. Matches the frosted-glass card language now
// used across AIVisualPanel.jsx and ReferencePhotosPanel.jsx.
const ACCENT       = '#a87f2e';
const ACCENT_DEEP  = '#7c5e1f';
const ACCENT_LIGHT = '#c9a44e';
const ACCENT_SOFT  = '#e9d9ad';
// Grey ground now (a direct request, after comparing pale-yellow vs. grey
// side by side) — only these neutral/ink tokens moved; ACCENT* above stay
// gold, since gold is still the accent on buttons/highlights either way.
const INK         = '#232220';
const INK_SOFT    = '#6e6a63';
const INK_FAINT   = '#948d81';
const LINE        = 'rgba(90,84,74,0.22)';

// A glossy "convex button" sheen — a soft white highlight banded across the
// top third, layered over the base gradient — used on the answer bubble,
// the Generate button, and the prompt icon badge (the pieces asked to be
// "glossy") instead of a flat fill.
const GLOSS_OVERLAY = 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 48%)';
const GLOSS_SHADOW = '0 3px 10px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -10px 14px -10px rgba(0,0,0,0.35)';

function pillStyle(active) {
  return {
    // box-sizing wasn't set here — same class of bug Bubble.jsx's own
    // padding/max-width overflow had ("text sticking out"), just never
    // patched on this shared pill style. Explicit border-box keeps the
    // pill's declared width/height inclusive of its own padding+border.
    boxSizing: 'border-box',
    padding: '8px 14px', borderRadius: 11, cursor: 'pointer', fontSize: '0.78rem',
    fontWeight: active ? '700' : '600', fontFamily: RUNWAY_FONT, lineHeight: 1.3,
    border: `1.5px solid ${active ? ACCENT : LINE}`,
    background: active ? `linear-gradient(155deg, #fff3ea, ${ACCENT_SOFT})` : '#ffffff',
    color: active ? ACCENT_DEEP : INK,
    boxShadow: active ? '0 2px 8px -2px rgba(28,25,23,0.3)' : '0 1px 0 rgba(0,0,0,0.02)',
    transition: 'border-color 0.12s, background 0.12s, box-shadow 0.12s, transform 0.12s',
  };
}

// `progress` (0–1, AI avatar only) draws a thin ring around the avatar that
// fills in as you move through the wizard's questions — doubles the avatar
// as a progress indicator, so the separate progress-dots row could be
// dropped without losing that "how far along am I" signal.
function Avatar({ mine, progress, size = 24 }) {
  const core = (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size >= 24 ? '0.68rem' : '0.58rem',
      background: mine ? `linear-gradient(135deg, #2a2320, ${INK})` : `linear-gradient(135deg, ${ACCENT_LIGHT}, ${ACCENT_DEEP})`,
      color: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
    }}>{mine ? '🙂' : '✦'}</div>
  );
  if (mine || progress == null) return core;

  const r = 14.5;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
      <svg viewBox="0 0 32 32" style={{ position: 'absolute', inset: 0 }}>
        <circle cx="16" cy="16" r={r} fill="none" stroke={LINE} strokeWidth="2.4" />
        <circle
          cx="16" cy="16" r={r} fill="none" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
          transform="rotate(-90 16 16)" style={{ transition: 'stroke-dashoffset 0.25s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 4 }}>{core}</div>
    </div>
  );
}

// `highlight` marks the CURRENT question's ask-bubble — the one thing on
// screen you're meant to act on right now. Past questions in the collapsed
// history use the plain (unhighlighted) style so the live one visibly pops
// out instead of blending into a wall of identical gray bubbles.
function Bubble({ mine, highlight, children, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        // maxWidth alone doesn't stop this from overflowing — Bubble is a
        // flex item (the ask-bubble row is display:flex), and a flex item's
        // default min-width:auto refuses to shrink below its content's
        // longest UNBREAKABLE run, no matter what maxWidth says. Question
        // labels like "title/date/time/venue" are one long slash-joined
        // token with no spaces to wrap at — that's exactly what was pushing
        // the bubble's border out past the spotlight card's edge. minWidth:0
        // lets it actually shrink to maxWidth; overflowWrap/wordBreak let a
        // token that long break mid-word instead of forcing the box wider.
        maxWidth: '88%', minWidth: 0, boxSizing: 'border-box', overflowWrap: 'break-word', wordBreak: 'break-word',
        alignSelf: mine ? 'flex-end' : 'flex-start',
        padding: highlight ? '13px 16px' : '8px 12px', borderRadius: 13,
        borderBottomRightRadius: mine ? 4 : 13, borderBottomLeftRadius: mine ? 13 : 4,
        background: mine
          ? `${GLOSS_OVERLAY}, linear-gradient(155deg, ${ACCENT_LIGHT}, ${ACCENT_DEEP})`
          : highlight ? `linear-gradient(155deg, #f8f9ff, ${ACCENT_SOFT})` : '#f5f1ea',
        border: !mine && highlight ? `1.5px solid ${ACCENT}` : '1.5px solid transparent',
        color: mine ? '#fff' : highlight ? ACCENT_DEEP : INK,
        fontWeight: highlight ? '800' : '400',
        fontSize: highlight ? '0.86rem' : '0.78rem', lineHeight: highlight ? 1.65 : 1.5, fontFamily: RUNWAY_FONT,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: mine ? GLOSS_SHADOW : highlight ? '0 4px 14px -5px rgba(28,25,23,0.35)' : 'none',
      }}
    >{children}</div>
  );
}

// Actual suggested colors for each named palette option — direct request
// ("provide suggestions for color palette") since the plain text names
// ("Saffron & Gold", "Blue & White", …) didn't show what they'd actually
// look like on the poster. A small two-dot swatch (or three for Pastel,
// which isn't a two-color name) renders in front of each pill's label.
const PALETTE_SWATCHES = {
  'Saffron & Gold': ['#FF9933', '#D4AF37'],
  'Red & Gold':     ['#B3202B', '#D4AF37'],
  'Blue & White':   ['#1E3A8A', '#FFFFFF'],
  'Green & Gold':   ['#15803D', '#D4AF37'],
  'Maroon & Cream': ['#7B1E3A', '#F3E5C8'],
  Pastel:           ['#F6C9DA', '#BEE3F8', '#FDE9C8'],
};
function PaletteSwatch({ colors }) {
  if (!colors) return null;
  return (
    <span style={{ display: 'inline-flex', marginRight: 7, flexShrink: 0 }}>
      {colors.map((c, i) => (
        <span key={i} style={{
          width: 11, height: 11, borderRadius: '50%', background: c,
          border: '1px solid rgba(0,0,0,0.15)', boxShadow: '0 0 0 1.5px #fff',
          marginLeft: i > 0 ? -3 : 0,
        }} />
      ))}
    </span>
  );
}

const textFieldStyle = {
  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
  background: '#fff', border: `1.5px solid ${LINE}`, borderRadius: 10,
  fontSize: '0.78rem', color: INK, outline: 'none', fontFamily: RUNWAY_FONT,
};

// Exposes { goToStep(i) } via ref so a completely separate part of the tree
// — the "Answered so far" timeline strip index.jsx now renders snug beneath
// the generated poster — can jump the wizard to a given question when a
// history chip is tapped there, without threading step-navigation state
// through AIVisualPanel.jsx.
const PosterSpecWizard = forwardRef(function PosterSpecWizard({
  posterSpec, setPosterSpecField,
  imageStyle, setImageStyle,
  posterMode, setPosterMode,
  posterFields, setPosterFields,
  referencePhotos,
  onReferenceStepActive,
  // Reports { active, items } up to index.jsx (via AIVisualPanel.jsx)
  // whenever a step is answered or navigated to — the timeline strip
  // renders straight from this instead of duplicating step logic.
  onStepsChange,
}, ref) {
  const [active, setActive] = useState(0);
  // `firing` names the pill currently mid-confirmation ("stepKey:value") —
  // it flashes and pops a checkmark badge for a beat before the underlying
  // pick actually commits, so the confirmation is visible even though a
  // single-select question advances to the next step right after.
  const [firing, setFiring] = useState(null);
  const [soundOn, setSoundOnState] = useState(isSoundEnabled());
  if (!posterSpec) return null;

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOnState(next);
    persistSoundEnabled(next);
    if (next) playConfirmChime();
  };

  const togglePalette = (o) => {
    const checked = posterSpec.palette.includes(o);
    const next = checked ? posterSpec.palette.filter(p => p !== o) : [...posterSpec.palette, o];
    setPosterSpecField('palette', next);
  };

  // Every step already has a value (posterSpec starts pre-filled from
  // inferPosterSpecDefaults) — "answering" a single/binary question both
  // sets it AND advances to the next step; text/multi-select steps get an
  // explicit "Continue" since there's no one click that means "done" there.
  const steps = [
    {
      key: 'intent', type: 'single', label: "What's this poster for?",
      options: INTENT_OPTIONS.map(o => ({ value: o.value, label: o.label })),
      value: posterSpec.intent,
      answerLabel: INTENT_OPTIONS.find(o => o.value === posterSpec.intent)?.label,
      onPick: v => setPosterSpecField('intent', v),
    },
    {
      key: 'audience', type: 'single', label: "Who's it for?",
      options: AUDIENCE_OPTIONS.map(o => ({ value: o, label: o })),
      value: posterSpec.audience, answerLabel: posterSpec.audience,
      onPick: v => setPosterSpecField('audience', v),
    },
    {
      key: 'region', type: 'single', label: 'Which cultural region?',
      options: REGION_OPTIONS.map(o => ({ value: o, label: o })),
      value: posterSpec.region, answerLabel: posterSpec.region,
      onPick: v => setPosterSpecField('region', v),
    },
    {
      key: 'style', type: 'single', label: 'What visual style?',
      options: STYLE_OPTIONS.map(o => ({ value: o, label: o })),
      value: posterSpec.style, answerLabel: posterSpec.style,
      onPick: v => setPosterSpecField('style', v),
    },
    {
      key: 'tradition', type: 'text', label: 'Any specific tradition or occasion?',
      hint: 'e.g. Ganesh Chaturthi, South Indian temple tradition',
      value: posterSpec.tradition, answerLabel: posterSpec.tradition || '—',
      onChange: v => setPosterSpecField('tradition', v),
    },
    {
      key: 'palette', type: 'multi', label: 'Color palette?', hint: 'Pick one or more',
      options: PALETTE_OPTIONS.map(o => ({ value: o, label: o })),
      value: posterSpec.palette, answerLabel: posterSpec.palette.join(', ') || '—',
      onToggle: togglePalette,
    },
    {
      key: 'imageRole', type: 'single', label: 'Where should the image sit?',
      options: IMAGE_ROLE_OPTIONS.map(o => ({ value: o, label: o })),
      value: posterSpec.imageRole, answerLabel: posterSpec.imageRole,
      onPick: v => setPosterSpecField('imageRole', v),
    },
    {
      key: 'negativeSpace', type: 'single', label: 'Leave empty space for text on the…',
      options: NEGATIVE_SPACE_OPTIONS.map(o => ({ value: o, label: o })),
      value: posterSpec.negativeSpace, answerLabel: posterSpec.negativeSpace,
      onPick: v => setPosterSpecField('negativeSpace', v),
    },
    {
      key: 'imageStyle', type: 'single', label: 'How should the photo look?',
      hint: 'Choose one',
      options: [{ value: 'framed', label: '🖼 Framed' }, { value: 'full', label: '⬛ Full Frame' }],
      value: imageStyle,
      answerLabel: imageStyle === 'full' ? '⬛ Full Frame' : '🖼 Framed',
      onPick: v => setImageStyle(v),
    },
    {
      // Nudges toward the Reference Photos section (now rendered directly
      // below this wizard, see AIVisualPanel.jsx) so it isn't a disconnected
      // afterthought — direct request: "add prompt for reference image that
      // need to be included in ai prompt." Doesn't set a posterSpec field;
      // it's informational, always counts as "answered".
      key: 'referenceImage', type: 'note',
      label: 'Got a reference photo of your venue or decor?',
      hint: 'A real photo of your temple, hall, or setup helps the AI match your actual space instead of generating something generic.',
      value: true,
      answerLabel: (referencePhotos && referencePhotos.length > 0)
        ? `📷 ${referencePhotos.length} photo${referencePhotos.length === 1 ? '' : 's'} ready`
        : 'None — generating freely',
    },
    {
      key: 'posterMode', type: 'single',
      label: 'Should AI write your title/date/time/venue into the image?',
      hint: "Bakes the text into the artwork — it won't be separately editable or translatable afterward",
      options: [{ value: true, label: '✓ Yes, bake it in' }, { value: false, label: 'Keep it movable' }],
      value: posterMode,
      answerLabel: posterMode ? '✓ Yes, bake it in' : 'Keep it movable',
      onPick: v => setPosterMode(v),
      extra: posterMode ? (
        <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
          <input value={posterFields?.title || ''} onChange={e => setPosterFields(f => ({ ...f, title: e.target.value }))}
            placeholder="Event title" style={textFieldStyle} />
          <input value={posterFields?.date || ''} onChange={e => setPosterFields(f => ({ ...f, date: e.target.value }))}
            placeholder="Date (e.g. Friday, August 21st, 2026)" style={textFieldStyle} />
          <input value={posterFields?.time || ''} onChange={e => setPosterFields(f => ({ ...f, time: e.target.value }))}
            placeholder="Time (e.g. 6:30 PM)" style={textFieldStyle} />
          <input value={posterFields?.venue || ''} onChange={e => setPosterFields(f => ({ ...f, venue: e.target.value }))}
            placeholder="Venue / address" style={textFieldStyle} />
        </div>
      ) : null,
    },
  ];

  const goNext = () => setActive(a => Math.min(a + 1, steps.length - 1));
  const goPrev = () => setActive(a => Math.max(a - 1, 0));

  // Single-select: flash + chime immediately, then commit the pick and
  // advance a beat later so the confirmation is actually visible before the
  // step changes out from under it. Ignores a second click mid-animation.
  const firePick = (step, value, pid) => {
    if (firing) return;
    playConfirmChime();
    setFiring(pid);
    setTimeout(() => { step.onPick(value); goNext(); setFiring(null); }, 380);
  };
  // Multi-select: toggles immediately (no navigation to time around), only
  // flashes when a pill is being turned ON, not when it's being cleared.
  const fireToggle = (step, value, pid) => {
    const turningOn = !step.value.includes(value);
    step.onToggle(value);
    if (turningOn) {
      playConfirmChime();
      setFiring(pid);
      setTimeout(() => setFiring(null), 700);
    }
  };
  // Continue buttons (text/note steps) just get the confirmation chime —
  // there's no single pill to flash there.
  const fireContinue = () => { playConfirmChime(); goNext(); };

  const pillButton = (step, o, extraStyle) => {
    const pid = `${step.key}:${String(o.value)}`;
    const isFiring = firing === pid;
    const selected = isFiring || step.value === o.value;
    return (
      <button key={String(o.value)}
        className={isFiring ? 'cf-pill-flash' : ''}
        style={{ ...pillStyle(selected), position: 'relative', ...extraStyle }}
        onClick={() => firePick(step, o.value, pid)}
      >
        {o.label}
        <span className={`cf-check-burst${isFiring ? ' fire' : ''}`}>✓</span>
      </button>
    );
  };

  // Spotlight the Reference Photos panel (a separate component index.jsx
  // renders off to the side) whenever the wizard lands on the reference-
  // photo question — dims the rest of the editor and pops that panel
  // forward for a few seconds, per direct request ("highlight that
  // section"). Reverts on its own, and also if the user navigates away
  // from the question before the timer's up.
  useEffect(() => {
    if (!onReferenceStepActive) return;
    if (steps[active]?.key !== 'referenceImage') return;
    onReferenceStepActive(true);
    const t = setTimeout(() => onReferenceStepActive(false), 3200);
    return () => { clearTimeout(t); onReferenceStepActive(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Lets index.jsx's below-canvas timeline strip command this wizard to
  // jump to a given question when a history chip is tapped.
  useImperativeHandle(ref, () => ({
    goToStep: (i) => setActive(Math.max(0, Math.min(i, steps.length - 1))),
  }), [steps.length]);

  // Reports the step/answer list up to index.jsx (via AIVisualPanel.jsx) so
  // the timeline strip can render "answered so far" without duplicating any
  // of the question logic above — fires on every render where an answer,
  // the active step, or the reference photo count changed.
  useEffect(() => {
    if (!onStepsChange) return;
    onStepsChange({
      active,
      items: steps.map((s, i) => ({ index: i, label: s.label, answerLabel: s.answerLabel })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, posterSpec, imageStyle, posterMode, posterFields, referencePhotos]);

  return (
    <div style={{
      padding: '16px 16px 14px', background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      border: `1px solid ${LINE}`, borderRadius: 16, marginBottom: 16,
      boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 24px -18px rgba(60,56,50,0.35)',
    }}>
      {/* Flash + checkmark-burst confirmation on each answered pill — see
          pillButton() / firePick() / fireToggle() above. Injected once here
          rather than per-button since it's the same two keyframes reused
          across every pill in the wizard. */}
      <style>{`
        @keyframes cfPillFlash { 0% { filter: brightness(1); } 35% { filter: brightness(1.35); } 100% { filter: brightness(1); } }
        .cf-pill-flash { animation: cfPillFlash 0.4s ease-out; }
        @keyframes cfCheckPop {
          0% { opacity: 0; transform: scale(0.3); }
          35% { opacity: 1; transform: scale(1.15); }
          55% { transform: scale(0.95); }
          75% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1); }
        }
        .cf-check-burst {
          position: absolute; top: -8px; right: -8px; width: 18px; height: 18px; border-radius: 50%;
          background: #16a34a; color: #fff; display: flex; align-items: center; justify-content: center;
          font-size: 0.58rem; font-weight: 800; opacity: 0; pointer-events: none;
        }
        .cf-check-burst.fire { animation: cfCheckPop 0.7s cubic-bezier(.34,1.56,.64,1) forwards; }
        @keyframes cfCardPop { 0% { transform: scale(1); } 40% { transform: scale(1.025); } 100% { transform: scale(1); } }
        .cf-card-pop { animation: cfCardPop 0.4s ease-out; }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ color: INK, fontWeight: '800', fontSize: '0.9rem', fontFamily: RUNWAY_FONT }}>
            💬 Let's build this together
          </div>
          <button onClick={toggleSound} title={soundOn ? 'Sound on — click to mute' : 'Sound off — click to unmute'} style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `1px solid ${LINE}`,
            background: '#fff', color: INK_SOFT, cursor: 'pointer', fontSize: '0.62rem', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{soundOn ? '🔊' : '🔇'}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <button onClick={goPrev} disabled={active === 0} title="Previous question" style={{
            width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `1px solid ${LINE}`, background: '#fff',
            color: active === 0 ? '#d8d1c4' : INK_SOFT, cursor: active === 0 ? 'default' : 'pointer',
            fontSize: '0.62rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1,
          }}>‹</button>
          <div style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: INK_SOFT, letterSpacing: '0.03em' }}>
            STEP {active + 1} / {steps.length}
          </div>
          <button onClick={goNext} disabled={active === steps.length - 1} title="Next question" style={{
            width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `1px solid ${LINE}`, background: '#fff',
            color: active === steps.length - 1 ? '#d8d1c4' : INK_SOFT, cursor: active === steps.length - 1 ? 'default' : 'pointer',
            fontSize: '0.62rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1,
          }}>›</button>
        </div>
      </div>
      <div style={{ color: INK, fontSize: '0.7rem', marginBottom: 16, lineHeight: 1.5, fontFamily: RUNWAY_FONT }}>
        Answers compile into the AI Prompt above automatically — edit it by hand anytime.
      </div>

      {/* The CURRENT question — shown first and highlighted, so it's the
          first thing you see and answer, instead of being buried below a
          growing scroll of history. A tinted, bordered "spotlight" card
          makes it unmistakably the one thing to act on right now. */}
      {steps[active] && (
        <div className={firing ? 'cf-card-pop' : ''} style={{
          padding: '12px 12px 12px', borderRadius: 13,
          background: `linear-gradient(155deg, #fffaf6, ${ACCENT_SOFT}bb)`,
          border: `1.5px solid ${ACCENT}66`, boxShadow: '0 6px 18px -12px rgba(28,25,23,0.4)',
          marginBottom: 14,
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'center' }}>
            <Avatar mine={false} progress={(active + 1) / steps.length} />
            <Bubble mine={false} highlight>{steps[active].label}</Bubble>
          </div>
          <div style={{ color: INK_FAINT, fontSize: '0.6rem', marginLeft: 40, marginBottom: 8, fontFamily: RUNWAY_FONT }}>
            Just now
          </div>
          {steps[active].hint && (
            <div style={{ color: INK_SOFT, fontSize: '0.68rem', marginBottom: 8, marginLeft: 40, fontFamily: RUNWAY_FONT }}>
              {steps[active].hint}
            </div>
          )}

          <div style={{ marginLeft: 40 }}>
            {steps[active].type === 'single' && (
              // Exactly-2-option questions (Yes/No-shaped) get an even,
              // matched-width grid instead of flex-wrap pills — with longer
              // labels, flex-wrap could drop the second pill onto its own
              // row where it looked like a stray highlighted box "popping
              // out" of the layout by itself. Longer option lists still
              // wrap naturally as pills.
              steps[active].options.length === 2 ? (
                // Grid stretches both pills to the row's height automatically,
                // but plain block text stays top-anchored inside it — when one
                // label wraps to more lines than the other, the shorter one's
                // text sat high with a slab of empty space below it, reading
                // as lopsided/"sticking out" next to its neighbor. Centering
                // the content (flex) plus a shared minHeight keeps both pills
                // reading as one balanced pair no matter how their text wraps.
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 7, alignItems: 'stretch' }}>
                  {steps[active].options.map(o => pillButton(steps[active], o, {
                    textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 46,
                    minWidth: 0, overflowWrap: 'break-word', wordBreak: 'break-word',
                  }))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                  {steps[active].options.map(o => pillButton(steps[active], o))}
                </div>
              )
            )}
            {steps[active].type === 'note' && (
              <>
                <div style={{
                  padding: '9px 12px', borderRadius: 10, marginBottom: 10,
                  background: (referencePhotos && referencePhotos.length > 0) ? '#f0fdf4' : '#ffffff',
                  border: `1.5px solid ${(referencePhotos && referencePhotos.length > 0) ? '#4ade80' : LINE}`,
                  color: INK, fontSize: '0.76rem', lineHeight: 1.5, fontFamily: RUNWAY_FONT,
                }}>
                  {(referencePhotos && referencePhotos.length > 0)
                    ? `✓ Using ${referencePhotos.length} photo${referencePhotos.length === 1 ? '' : 's'} already saved in Reference Photos.`
                    : 'None added yet — add one or more just below, or skip and generate freely.'}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={fireContinue} style={{
                    padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: `${GLOSS_OVERLAY}, linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, color: '#fff',
                    fontWeight: '700', fontSize: '0.74rem', fontFamily: RUNWAY_FONT,
                    boxShadow: GLOSS_SHADOW,
                  }}>Continue →</button>
                  <button
                    onClick={() => document.getElementById('reference-photos-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    style={{
                      padding: '7px 12px', borderRadius: 9, border: `1.5px solid ${LINE}`, cursor: 'pointer',
                      background: '#fff', color: ACCENT_DEEP, fontWeight: '700', fontSize: '0.72rem', fontFamily: RUNWAY_FONT,
                    }}
                  >↓ Jump to Reference Photos</button>
                </div>
              </>
            )}
            {steps[active].type === 'multi' && (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
                  {steps[active].options.map(o => {
                    const pid = `${steps[active].key}:${String(o.value)}`;
                    const isFiring = firing === pid;
                    return (
                      <button key={o.value}
                        className={isFiring ? 'cf-pill-flash' : ''}
                        style={{ ...pillStyle(steps[active].value.includes(o.value)), position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                        onClick={() => fireToggle(steps[active], o.value, pid)}
                      >
                        <PaletteSwatch colors={PALETTE_SWATCHES[o.label]} />
                        {o.label}
                        <span className={`cf-check-burst${isFiring ? ' fire' : ''}`}>✓</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={fireContinue} style={{
                  padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: `${GLOSS_OVERLAY}, linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, color: '#fff',
                  fontWeight: '700', fontSize: '0.74rem', fontFamily: RUNWAY_FONT,
                  boxShadow: GLOSS_SHADOW,
                }}>Continue →</button>
              </>
            )}
            {steps[active].type === 'text' && (
              <>
                <input value={steps[active].value} onChange={e => steps[active].onChange(e.target.value)}
                  placeholder="Tell us the specific tradition or occasion" style={{ ...textFieldStyle, marginBottom: 10 }} />
                <button onClick={fireContinue} style={{
                  padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: `${GLOSS_OVERLAY}, linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, color: '#fff',
                  fontWeight: '700', fontSize: '0.74rem', fontFamily: RUNWAY_FONT,
                  boxShadow: GLOSS_SHADOW,
                }}>Continue →</button>
              </>
            )}
            {steps[active].extra}
          </div>
        </div>
      )}

      {active >= steps.length - 1 && steps[active] && (steps[active].value !== undefined) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9, marginTop: -4, marginBottom: 14,
          padding: '9px 12px', borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #4ade8088',
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: '#16a34a', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.66rem', fontWeight: '800',
          }}>✓</span>
          <div style={{ fontSize: '0.74rem', color: INK, fontWeight: '700', fontFamily: RUNWAY_FONT, lineHeight: 1.4 }}>
            All set — tap Generate above, or revisit any answer in the strip beneath your poster.
          </div>
        </div>
      )}
    </div>
  );
});

export default PosterSpecWizard;
