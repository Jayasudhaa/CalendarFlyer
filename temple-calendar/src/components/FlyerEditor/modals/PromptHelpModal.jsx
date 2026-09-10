import React, { useState } from 'react';
import { COLORS } from '../constants';
import { PROMPT_LIBRARY_OPTIONS, getPromptByName } from '../promptLibrary';
import { COMMUNITY_PROMPT_LIBRARY_OPTIONS, getCommunityPromptByName } from '../communityPromptLibrary';

// Tips written to match what the prompt compiler + image model actually
// respond well to — not generic "be descriptive" advice.
const TIPS = [
  { icon: '🎯', title: 'Name the moment, not just the deity/event', body: 'Instead of "Ganesha", try "Lord Ganesha seated on a lotus throne receiving modak offerings" — the more specific the scene, the less generic the result.' },
  { icon: '🎨', title: 'Call out colors and mood', body: 'Add phrases like "warm saffron and gold palette" or "soft golden evening light" — color and lighting words steer the output more reliably than adjectives like "beautiful" or "nice".' },
  { icon: '🖼', title: 'Mention what should stay empty', body: 'If you plan to add your own title/date text later (Framed mode), add "empty space at the top and bottom" so the AI leaves room instead of filling the whole frame.' },
  { icon: '📷', title: 'Ground it with a reference photo', body: 'Pick 1–4 photos in Reference Photos (right panel) — your actual temple, hall, or decor — and generation will visually match your real venue instead of a generic one.' },
  { icon: '✏️', title: 'Start from a preset, then edit', body: 'Pick a Deity/Festival (or Celebration Theme) from the dropdown above to auto-fill a detailed starting prompt, then tweak it in the AI Prompt box below the canvas.' },
];

export default function PromptHelpModal({ onClose, promptCategory, onUsePrompt }) {
  const isTemple = promptCategory === 'temple';
  const libraryOptions = isTemple ? PROMPT_LIBRARY_OPTIONS : COMMUNITY_PROMPT_LIBRARY_OPTIONS;
  const getLibraryPrompt = isTemple ? getPromptByName : getCommunityPromptByName;
  const [expanded, setExpanded] = useState(null);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fffdfb', borderRadius: 16, width: '100%', maxWidth: 720,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        border: '1px solid #f3e4cf', boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Header — glossy charcoal, matching the site-wide accent */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f3e4cf',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: `linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDeep})`,
          borderRadius: '16px 16px 0 0', flexShrink: 0,
        }}>
          <div>
            <div style={{ color: 'white', fontWeight: '800', fontSize: '1.15rem' }}>
              ❓ AI Prompt Help
            </div>
            <div style={{ color: '#d6d3d1', fontSize: '0.75rem', marginTop: 2 }}>
              Tips, example prompts, and what to expect
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
            borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem',
          }}>
            ✕ Close
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: 22, flex: 1 }}>

          {/* ── What generated images look like ── */}
          <div style={{ marginBottom: 20, padding: '14px 16px', background: COLORS.accentSoft, border: `1px solid ${COLORS.accent}33`, borderRadius: 10 }}>
            <div style={{ color: COLORS.accent, fontWeight: '800', fontSize: '0.85rem', marginBottom: 6 }}>🖼 What you'll get</div>
            <div style={{ color: COLORS.accentDeep, fontSize: '0.78rem', lineHeight: 1.7 }}>
              Generated images come back as a single, full-frame illustration — a devotional-poster or celebration-scene style (rich color, soft golden light, symmetrical composition), sized to fit your chosen canvas. In <strong>Framed</strong> mode it drops into the photo window and your template's own title/date/venue text stays on top. In <strong>Full Frame</strong> mode it fills the entire flyer edge-to-edge with empty space left near the top/bottom for text. Turning on "Let AI write your title/date/time/venue into the image" bakes that text into the artwork itself, so it won't be separately editable afterward.
            </div>
          </div>

          {/* ── Tips ── */}
          <div style={{ color: COLORS.text, fontWeight: '800', fontSize: '0.88rem', marginBottom: 10 }}>💡 Writing a good prompt</div>
          <div style={{ display: 'grid', gap: 8, marginBottom: 22 }}>
            {TIPS.map(tip => (
              <div key={tip.title} style={{ display: 'flex', gap: 10, padding: '10px 12px', border: `1px solid ${COLORS.border}`, borderRadius: 10, background: '#fff' }}>
                <div style={{ fontSize: '1.1rem', flexShrink: 0 }}>{tip.icon}</div>
                <div>
                  <div style={{ color: COLORS.text, fontWeight: '700', fontSize: '0.78rem', marginBottom: 2 }}>{tip.title}</div>
                  <div style={{ color: COLORS.textMuted, fontSize: '0.74rem', lineHeight: 1.6 }}>{tip.body}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Example prompts, from the same curated library the dropdown uses ── */}
          <div style={{ color: COLORS.text, fontWeight: '800', fontSize: '0.88rem', marginBottom: 4 }}>
            ✨ Example prompts {isTemple ? '(Deity / Festival)' : '(Celebration Theme)'}
          </div>
          <div style={{ color: COLORS.textFaint, fontSize: '0.72rem', marginBottom: 10, lineHeight: 1.5 }}>
            The same presets available in the "{isTemple ? 'Deity / Festival' : 'Celebration Theme'}" dropdown — click one to preview it, then "Use this prompt" to drop it straight into the AI Prompt box.
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {libraryOptions.map(name => {
              const isOpen = expanded === name;
              const promptText = getLibraryPrompt(name);
              return (
                <div key={name} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                  <button onClick={() => setExpanded(isOpen ? null : name)} style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    color: COLORS.text, fontSize: '0.8rem', fontWeight: '600',
                  }}>
                    <span>{name}</span>
                    <span style={{ color: COLORS.textFaint, fontSize: '0.75rem' }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 12px 12px' }}>
                      <div style={{ color: COLORS.textMuted, fontSize: '0.72rem', lineHeight: 1.6, marginBottom: 8, padding: '8px 10px', background: '#fafafa', borderRadius: 8 }}>
                        {promptText}
                      </div>
                      <button onClick={() => onUsePrompt?.(promptText)} style={{
                        padding: '7px 14px',
                        background: `linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 48%), linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDeep})`,
                        color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: '700', fontSize: '0.74rem',
                        boxShadow: '0 2px 6px -2px rgba(0,0,0,0.5)',
                      }}>
                        ✓ Use this prompt
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
