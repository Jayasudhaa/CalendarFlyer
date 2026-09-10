import React, { useState, useMemo, useEffect } from 'react';
import { RUNWAY_FONT } from './runwayUI';

// ─── Prompt Dock ────────────────────────────────────────────────────────────
// The "What do you want to create?" prompt used to live in a full-width bar
// pinned below the canvas — moved here, docked in a slim strip right above
// the canvas instead, per a direct request. Collapsed by default (one line
// of the current prompt + Edit/Generate), expands in place to the full
// textarea + quick-add tags when you click Edit. AI mode only — Canvas size
// now lives in the Brand & Edit tab instead (see DesignPanel.jsx).
const TEMPLE_PROMPT_TAGS = [
  'golden diyas', 'marigold garlands', 'rangoli pattern', 'temple gopuram backdrop',
  'soft golden glow', 'sunset sky', 'incense smoke', 'floral border', 'silk drapery',
];
const COMMUNITY_PROMPT_TAGS = [
  'string lights', 'balloon arch', 'outdoor stage', 'warm sunset', 'banner backdrop',
  'confetti', 'floral centerpiece', 'crowd celebrating', 'string of flags',
];

// "Unified Black Glass" — this dock used to carry its own cream/charcoal
// "Runway" identity (still shared by PosterSpecWizard.jsx/AIVisualPanel.jsx —
// this file NO LONGER stays in sync with those; it diverged on purpose,
// per a direct request to fold it into the black-glossy card language used
// for headers and primary buttons everywhere else in the app). GLOSS_OVERLAY/
// GLOSS_SHADOW keep the same "convex button" sheen recipe, just re-tuned for
// a dark surface instead of cream.
const ACCENT       = '#3a3a3a';
const ACCENT_DEEP  = '#000000';
const ACCENT_LIGHT = '#6b6b6b';
const INK         = '#f4f4f5';
const INK_SOFT    = '#a1a1aa';
const LINE        = 'rgba(255,255,255,0.16)';
const GLOSS_OVERLAY = 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)';
const GLOSS_SHADOW = '0 2px 6px -2px rgba(0,0,0,0.5)';

export default function PromptDock({
  genPrompt, setGenPrompt, promptCategory, onShowHelp,
  handleGenerate, generating, genSeconds, genError,
  feedbackPending, onSendFeedback, onDismissFeedback,
}) {
  const [editing, setEditing] = useState(false);
  // Manual minimize — independent of the auto-minimize during `generating`
  // below. Lets the user shrink this dock down to just its header on their
  // own terms (e.g. once the prompt's dialed in and they'd rather see more
  // canvas), not only while a request is in flight. Click the header (or
  // the chevron) to toggle either way.
  const [minimized, setMinimized] = useState(false);
  const tags = promptCategory === 'temple' ? TEMPLE_PROMPT_TAGS : COMMUNITY_PROMPT_TAGS;

  // Auto-collapse the expanded editor the moment generation starts — left
  // open (per a direct request from the user reporting this), the full
  // prompt text + textarea + Edit/Generate row stayed at full height for
  // the whole generation, blocking the canvas below it. The collapsed view
  // below also swaps to a minimized "Generating…" strip during this time
  // (see the `generating` branch further down), so between the two nothing
  // full-size sits above the canvas while an image is being generated.
  useEffect(() => {
    if (generating) setEditing(false);
  }, [generating]);

  // A manually-minimized dock (the ▴ toggle above) used to still pop the
  // feedback ask (thumbs up/down) in below it once a generation finished —
  // contradicting the whole point of minimizing, and easy to miss entirely
  // since it rendered under a one-line strip the user had deliberately
  // shrunk. Un-minimize for both `generating` (so the progress strip is
  // visible) and `feedbackPending` (so the feedback ask actually gets
  // seen) — either is a brief, self-resolving moment, and the user can
  // re-minimize with one click right after if they still want to.
  useEffect(() => {
    if (generating || feedbackPending) setMinimized(false);
  }, [generating, feedbackPending]);

  // A raw seconds counter ("6s") doesn't tell you anything about how much
  // longer it'll take — swapped for an estimated percentage instead (a
  // direct request), using the same 60s-to-95%-cap curve the progress bar
  // below already used, so the button and the bar always agree with each
  // other. There's no real completion signal from the API mid-flight, so
  // this is a reasonable estimate, not a measured value — it never claims
  // 100% until the request actually resolves and `generating` goes false.
  const genPercent = Math.min(Math.round((genSeconds / 60) * 100), 95);

  // Generate no longer fires straight off the button — it opens a
  // confirmation popup with the full compiled prompt first ("read the
  // prompt back, ask for approval" per direct request), so nothing
  // generates until the user has actually seen the whole thing and said
  // go, even when it's collapsed to two clamped lines in the dock itself.
  const [showConfirm, setShowConfirm] = useState(false);
  const requestGenerate = () => setShowConfirm(true);
  const confirmGenerate = () => { setShowConfirm(false); handleGenerate(); };

  // "Read it back" — a direct request for a karaoke-style read-aloud of the
  // full prompt (the modal already shows it as text; this speaks it too,
  // via the browser's built-in speech synthesis — no external service/key
  // needed). Splits the prompt into word/whitespace tokens up front so the
  // currently-spoken word can be looked up by character offset and
  // highlighted as SpeechSynthesisUtterance reports each word boundary.
  const readAloudSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speaking, setSpeaking] = useState(false);
  const [spokenWordIdx, setSpokenWordIdx] = useState(-1);
  const promptTokens = useMemo(() => (genPrompt || '').split(/(\s+)/), [genPrompt]);

  const stopReadAloud = () => {
    if (readAloudSupported) window.speechSynthesis.cancel();
    setSpeaking(false); setSpokenWordIdx(-1);
  };
  const startReadAloud = () => {
    if (!readAloudSupported || !genPrompt) return;
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(genPrompt);
    utter.rate = 0.95;
    utter.onboundary = (e) => {
      if (e.name && e.name !== 'word') return;
      let acc = 0;
      for (let i = 0; i < promptTokens.length; i++) {
        const len = promptTokens[i].length;
        if (e.charIndex < acc + len) { setSpokenWordIdx(i); break; }
        acc += len;
      }
    };
    utter.onend = () => { setSpeaking(false); setSpokenWordIdx(-1); };
    utter.onerror = () => { setSpeaking(false); setSpokenWordIdx(-1); };
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  };
  // Closing the popup (Let me edit, backdrop click, or Generate itself)
  // should always cut the reading off instead of letting it keep talking
  // over whatever's next.
  useEffect(() => { if (!showConfirm) stopReadAloud(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showConfirm]);

  // Feedback on the image that just finished — thumbs pick a rating, then
  // (per direct request) an optional comment box opens before it actually
  // sends, rather than firing immediately on click.
  const [feedbackChoice, setFeedbackChoice] = useState(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const pickFeedback = (r) => setFeedbackChoice(r);
  const submitFeedback = () => {
    onSendFeedback(feedbackChoice, feedbackComment.trim());
    setFeedbackChoice(null); setFeedbackComment('');
  };
  const skipFeedback = () => { setFeedbackChoice(null); setFeedbackComment(''); onDismissFeedback(); };

  // A compiled prompt (from the Guided Conversation wizard) ends with a
  // "STRICT OUTPUT RULES" block ("Do not generate text", "Do not include
  // invented religious iconography", …). Quick-add used to just concatenate
  // the tag onto the very end of the whole string, which landed it right
  // after that block — reading as if the tag itself were one more output
  // rule, a confusing negative-sounding non-sequitur. Now it's inserted as
  // its own clearly-labeled section ahead of the rules block instead, and
  // repeat clicks accumulate into that same section rather than stacking
  // duplicate headers. Prompts with no such block (a plain theme-chip
  // prompt, or hand-typed text) fall back to the old plain append.
  const ADDITIONAL_HEADER = 'ADDITIONAL VISUAL ELEMENTS';
  const STRICT_MARKER = 'STRICT OUTPUT RULES';

  const addTag = (tag) => {
    setGenPrompt(prev => {
      const current = prev || '';
      if (current.toLowerCase().includes(tag.toLowerCase())) return current;

      const additionalMatch = current.match(new RegExp(`${ADDITIONAL_HEADER}\\nInclude: ([^\\n]*)`));
      if (additionalMatch) {
        return current.replace(
          `${ADDITIONAL_HEADER}\nInclude: ${additionalMatch[1]}`,
          `${ADDITIONAL_HEADER}\nInclude: ${additionalMatch[1]}, ${tag}`
        );
      }

      const strictIdx = current.indexOf(STRICT_MARKER);
      if (strictIdx === -1) {
        const trimmed = current.trim();
        return trimmed ? `${trimmed}, ${tag}` : tag;
      }

      const before = current.slice(0, strictIdx).trimEnd();
      const after = current.slice(strictIdx);
      return `${before}\n\n${ADDITIONAL_HEADER}\nInclude: ${tag}.\n\n${after}`;
    });
  };

  return (
    <div style={{ margin: '6px 14px 16px', flexShrink: 0 }}>
      <div style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 50%), linear-gradient(180deg,#1a1a1a,#000000)',
        borderRadius: 14,
        boxShadow: '0 10px 26px -14px rgba(0,0,0,0.45)',
        padding: editing ? '10px 14px 12px' : '8px 10px',
      }}>
        {/* Collapsed state — decluttered into three stacked rows instead of
            cramming the badge, prompt text, "?", Edit and Generate onto one
            packed row: badge+label, a readable 2-line prompt preview, then
            a right-aligned actions row. The editing state keeps the old
            single-row layout since the expanded textarea below takes over
            as the "read the prompt" surface at that point. */}
        {generating ? (
          /* Minimized "generating" strip — replaces the prompt text, Edit
             button, and full Generate button entirely while a request is
             in flight, so this dock shrinks down to one compact row
             instead of sitting at full height above the canvas (the
             progress bar further below still shows). Reappears as the
             normal collapsed view the moment `generating` goes false. */
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 9, flexShrink: 0,
              background: `${GLOSS_OVERLAY}, linear-gradient(135deg, ${ACCENT_LIGHT}, ${ACCENT_DEEP})`, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem',
              boxShadow: GLOSS_SHADOW,
            }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
            </div>
            <div style={{ flex: 1, minWidth: 0, fontSize: '0.82rem', fontWeight: '600', color: INK, fontFamily: RUNWAY_FONT }}>
              Generating your image…
            </div>
            <div style={{ fontSize: '0.76rem', fontWeight: '700', color: INK_SOFT, fontFamily: RUNWAY_FONT, flexShrink: 0 }}>
              {genPercent}%
            </div>
          </div>
        ) : minimized ? (
          /* Manually minimized — the user's own choice to shrink this
             down, independent of `generating`. Just the badge, label, and
             a chevron to bring it back; nothing else rendered below it
             (no prompt preview, no Edit/Generate, no expanded editor). */
          <div onClick={() => setMinimized(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} title="Show prompt">
            <div style={{
              width: 28, height: 28, borderRadius: 9, flexShrink: 0,
              background: `${GLOSS_OVERLAY}, linear-gradient(135deg, ${ACCENT_LIGHT}, ${ACCENT_DEEP})`, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem',
              boxShadow: GLOSS_SHADOW,
            }}>✦</div>
            <div style={{ flex: 1, minWidth: 0, fontSize: '0.68rem', fontWeight: '800', color: INK_SOFT, fontFamily: RUNWAY_FONT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              AI Prompt
            </div>
            <span style={{ color: INK_SOFT, fontSize: '0.85rem', flexShrink: 0 }}>▾</span>
          </div>
        ) : !editing ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                background: `${GLOSS_OVERLAY}, linear-gradient(135deg, ${ACCENT_LIGHT}, ${ACCENT_DEEP})`, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem',
                boxShadow: GLOSS_SHADOW,
              }}>✦</div>
              <div style={{ flex: 1, minWidth: 0, fontSize: '0.68rem', fontWeight: '800', color: INK_SOFT, fontFamily: RUNWAY_FONT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                AI Prompt
              </div>
              <button onClick={() => setMinimized(true)} title="Minimize" style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: 'none', background: 'none',
                color: INK_SOFT, cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}>▴</button>
            </div>

            {/* Bigger + brighter — pure white instead of the slightly
                off-white INK token, and a size step up so it reads clearly
                against the black glass card. */}
            <div onClick={() => setEditing(true)} style={{
              marginTop: 8, fontSize: '0.92rem', color: genPrompt ? '#ffffff' : '#c4c4ca',
              fontFamily: RUNWAY_FONT, lineHeight: 1.55, cursor: 'pointer',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {genPrompt || 'What do you want to create? Click to describe it…'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              {onShowHelp && (
                <button onClick={onShowHelp} title="Prompt tips & examples" style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  border: `1.5px solid ${LINE}`, background: 'rgba(255,255,255,0.06)', color: INK_SOFT,
                  cursor: 'pointer', fontSize: '0.66rem', fontWeight: '800',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                }}>?</button>
              )}

              <button onClick={() => setEditing(true)} style={{
                fontSize: '0.7rem', fontWeight: '700', color: INK, fontFamily: RUNWAY_FONT,
                border: `1.5px solid ${LINE}`, borderRadius: 8, padding: '6px 11px',
                background: 'rgba(255,255,255,0.06)', cursor: 'pointer', flexShrink: 0,
              }}>Edit</button>

              {/* Solid white — the one bright accent against the black glass
                  card, so Generate still reads as the primary action. */}
              <button onClick={requestGenerate} disabled={generating} style={{
                fontSize: '0.76rem', fontWeight: '700', color: generating ? '#e4e4e7' : '#0a0a0a', fontFamily: RUNWAY_FONT,
                border: 'none', borderRadius: 9, padding: '8px 16px', flexShrink: 0,
                background: generating ? '#52525b' : '#ffffff',
                cursor: generating ? 'not-allowed' : 'pointer',
                boxShadow: generating ? 'none' : '0 3px 10px -4px rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {generating
                  ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>{genPercent}%</>
                  : '✨ Generate'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 9, flexShrink: 0,
              background: `${GLOSS_OVERLAY}, linear-gradient(135deg, ${ACCENT_LIGHT}, ${ACCENT_DEEP})`, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem',
              boxShadow: GLOSS_SHADOW,
            }}>✦</div>

            <div style={{ flex: 1, minWidth: 0, fontSize: '0.7rem', fontWeight: '800', color: INK, fontFamily: RUNWAY_FONT, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              What do you want to create?
            </div>

            {onShowHelp && (
              <button onClick={onShowHelp} title="Prompt tips & examples" style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: `1.5px solid ${LINE}`, background: 'rgba(255,255,255,0.06)', color: INK_SOFT,
                cursor: 'pointer', fontSize: '0.66rem', fontWeight: '800',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}>?</button>
            )}

            <button onClick={() => setEditing(false)} style={{
              fontSize: '0.7rem', fontWeight: '700', color: INK, fontFamily: RUNWAY_FONT,
              border: `1.5px solid ${LINE}`, borderRadius: 8, padding: '6px 11px',
              background: 'rgba(255,255,255,0.06)', cursor: 'pointer', flexShrink: 0,
            }}>Done</button>

            {/* Was calling handleGenerate directly, skipping the confirm-
                before-generate popup below whenever Generate was clicked
                from THIS expanded/editing view specifically — the confirm
                popup only ever fired from the collapsed view's button.
                Routed through requestGenerate now so "read the prompt back,
                ask for approval" holds no matter which view you're in. */}
            <button onClick={requestGenerate} disabled={generating} style={{
              fontSize: '0.76rem', fontWeight: '700', color: generating ? '#e4e4e7' : '#0a0a0a', fontFamily: RUNWAY_FONT,
              border: 'none', borderRadius: 9, padding: '8px 16px', flexShrink: 0,
              background: generating ? '#52525b' : '#ffffff',
              cursor: generating ? 'not-allowed' : 'pointer',
              boxShadow: generating ? 'none' : '0 3px 10px -4px rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {generating
                ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>{genPercent}%</>
                : '✨ Generate'}
            </button>
          </div>
        )}

        {/* Expanded editor — sized to stay readable without eating too much
            of the canvas's vertical room: capped height (scrolls internally
            past ~5 lines, resizable by hand) rather than the taller fixed
            box this had briefly grown to, and the dock's own outer margin
            was trimmed too so it sits higher, closer to the top bar.
            `&& !generating` is a belt-and-suspenders guard alongside the
            useEffect above — this should never actually be reached while
            generating, but never risk it staying open for one stray frame. */}
        {editing && !generating && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <textarea
              value={genPrompt}
              onChange={e => setGenPrompt(e.target.value)}
              placeholder="Describe the image you want — style, colors, mood, setting…"
              rows={5} autoFocus
              style={{
                flex: '1 1 380px', minWidth: 260, minHeight: 120, maxHeight: 160, padding: '12px 14px', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${LINE}`, borderRadius: 12,
                color: INK, fontWeight: '400', fontSize: '0.85rem', lineHeight: 1.6,
                outline: 'none', resize: 'vertical', fontFamily: RUNWAY_FONT,
              }}
            />
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <div style={{ color: INK, fontSize: '0.64rem', fontWeight: '800', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Quick add
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tags.map(tag => (
                  <button key={tag} onClick={() => addTag(tag)} style={{
                    padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600',
                    fontFamily: RUNWAY_FONT, border: `1.5px solid ${LINE}`, background: 'rgba(255,255,255,0.05)', color: INK,
                  }}>+ {tag}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {genError && (
          <div style={{ marginTop: 10, color: '#fca5a5', fontSize: '0.74rem', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', padding: '8px 10px', borderRadius: 8 }}>
            ⚠ {genError}
          </div>
        )}
        {generating && (
          <div style={{ marginTop: 10, width: '100%', height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: `linear-gradient(90deg, ${ACCENT_LIGHT}, #ffffff)`, borderRadius: 2, width: `${genPercent}%`, transition: 'width 1s linear' }} />
          </div>
        )}

        {/* Post-generate feedback — appears once, right after a successful
            generation. Picking a thumb opens an optional comment box
            before anything actually sends (per direct request), rather
            than firing on the click itself. Sent straight to the site
            owner's inbox — see server/routes/image-feedback.js. */}
        {feedbackPending && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: `1.5px solid ${LINE}` }}>
            {feedbackChoice === null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, color: INK, fontSize: '0.76rem', fontWeight: '600', fontFamily: RUNWAY_FONT }}>
                  How did this one turn out?
                </div>
                <button onClick={() => pickFeedback('up')} title="Good result" style={{
                  width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${LINE}`, background: 'rgba(255,255,255,0.06)',
                  cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>👍</button>
                <button onClick={() => pickFeedback('down')} title="Not great" style={{
                  width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${LINE}`, background: 'rgba(255,255,255,0.06)',
                  cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>👎</button>
                <button onClick={skipFeedback} title="Dismiss" style={{
                  width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'none', color: INK_SOFT,
                  cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0,
                }}>✕</button>
              </div>
            ) : (
              <div>
                <div style={{ color: INK, fontSize: '0.76rem', fontWeight: '700', fontFamily: RUNWAY_FONT, marginBottom: 8 }}>
                  {feedbackChoice === 'up' ? '👍 Glad it worked out — anything to add?' : '👎 Sorry about that — what went wrong?'}
                </div>
                <textarea
                  value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} autoFocus
                  placeholder="Optional — a sentence or two helps" rows={2}
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '8px 10px', marginBottom: 8,
                    background: 'rgba(255,255,255,0.06)', border: `1.5px solid ${LINE}`, borderRadius: 8,
                    color: INK, fontSize: '0.76rem', lineHeight: 1.5, outline: 'none', resize: 'vertical', fontFamily: RUNWAY_FONT,
                  }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={skipFeedback} style={{
                    fontSize: '0.72rem', fontWeight: '700', color: INK_SOFT, fontFamily: RUNWAY_FONT,
                    border: 'none', background: 'none', cursor: 'pointer', padding: '6px 8px',
                  }}>Cancel</button>
                  <button onClick={submitFeedback} style={{
                    fontSize: '0.72rem', fontWeight: '700', color: '#0a0a0a', fontFamily: RUNWAY_FONT,
                    border: 'none', borderRadius: 8, padding: '7px 14px', background: '#ffffff', cursor: 'pointer',
                  }}>Send feedback</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm-before-generate — reads the compiled prompt back to the
          user for a deliberate go-ahead before anything is actually sent
          to the model, per direct request. */}
      {showConfirm && (
        <div onClick={() => setShowConfirm(false)} style={{
          position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          {/* This one card deliberately breaks from the dock's own black-
              glass identity — a direct request ("white background, black
              font") — so the prompt text itself reads as clearly as
              possible right before it's actually sent. */}
          <div onClick={e => e.stopPropagation()} style={{
            background: '#ffffff', borderRadius: 16, padding: '20px 22px',
            maxWidth: 480, width: '100%', maxHeight: '78vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(0,0,0,0.35)', border: '1.5px solid #e5e0d5',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
              <div style={{ color: '#0a0a0a', fontFamily: RUNWAY_FONT, fontSize: '1rem', fontWeight: '800' }}>
                Ready to generate?
              </div>
              {readAloudSupported && genPrompt && (
                <button
                  onClick={speaking ? stopReadAloud : startReadAloud}
                  title={speaking ? 'Stop reading' : 'Read the prompt aloud, karaoke-style'}
                  style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 11px', borderRadius: 20, cursor: 'pointer', fontFamily: RUNWAY_FONT,
                    fontSize: '0.68rem', fontWeight: '700',
                    border: `1.5px solid ${speaking ? '#a87f2e' : '#d6d0c4'}`,
                    background: speaking ? 'linear-gradient(135deg, #c9a44e, #7c5e1f)' : '#fff',
                    color: speaking ? '#fff' : '#1c1917',
                  }}
                >
                  {speaking ? <>⏹ Stop</> : <>🔊 Read aloud</>}
                </button>
              )}
            </div>
            <div style={{ color: '#57534e', fontSize: '0.74rem', marginBottom: 12, fontFamily: RUNWAY_FONT, lineHeight: 1.5 }}>
              Here's the full prompt that will be sent — take a look before it generates.
            </div>
            <div style={{
              flex: 1, overflowY: 'auto', padding: '10px 12px', borderRadius: 10,
              background: '#f7f5f0', border: '1.5px solid #e5e0d5', marginBottom: 14,
              color: '#1c1917', fontSize: '0.78rem', lineHeight: 1.55, fontFamily: RUNWAY_FONT, whiteSpace: 'pre-wrap',
            }}>
              {genPrompt
                ? promptTokens.map((tok, i) => (
                  /^\s+$/.test(tok) ? tok : (
                    <span key={i} style={{
                      background: i === spokenWordIdx ? '#f3d98a' : 'transparent',
                      borderRadius: 3, boxShadow: i === spokenWordIdx ? '0 0 0 2px #f3d98a' : 'none',
                      transition: 'background 0.1s',
                    }}>{tok}</span>
                  )
                ))
                : '(empty prompt)'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowConfirm(false); setEditing(true); }} style={{
                fontSize: '0.76rem', fontWeight: '700', color: '#1c1917', fontFamily: RUNWAY_FONT,
                border: '1.5px solid #d6d0c4', borderRadius: 9, padding: '9px 16px',
                background: '#ffffff', cursor: 'pointer',
              }}>Let me edit</button>
              <button onClick={confirmGenerate} style={{
                fontSize: '0.76rem', fontWeight: '700', color: '#ffffff', fontFamily: RUNWAY_FONT,
                border: 'none', borderRadius: 9, padding: '9px 18px',
                background: 'linear-gradient(135deg, #c9a44e, #7c5e1f)', cursor: 'pointer',
                boxShadow: '0 3px 10px -4px rgba(124,94,31,0.5)',
              }}>Looks good, Generate ✨</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
