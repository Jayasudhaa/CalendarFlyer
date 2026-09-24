// Shared style helpers for the Runway-inspired parts of the AI creation
// flow — the "What do you want to create?" header + theme chips in
// AIVisualPanel, the interactive Q&A wizard in PosterSpecWizard, and the
// prompt bar below the canvas in DesignPanel. Deliberately monochrome
// (black/white/gray, dark selected outline) rather than the app's orange
// accent used elsewhere. It previously used a plain system sans-serif
// rather than Poppins so this corner of the UI would read distinctly
// "Runway-like" per the reference screenshots rather than blending into
// the rest of the app — that font choice has since been unified onto the
// site's DM Sans body font per a later "one font styling for all pages"
// request, so only the monochrome color treatment still sets this corner
// apart.
export const RUNWAY_FONT = "'DM Sans', sans-serif";

// A pill/chip button — unselected is a flat light-gray pill, selected gets
// a white background with a dark outline and bolder text (matches the
// "Color palette" chip highlighted in the Runway reference).
export function runwayPill(selected) {
  return {
    padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontSize: '0.78rem',
    fontWeight: selected ? '700' : '500', fontFamily: RUNWAY_FONT,
    transition: 'background 0.12s, border-color 0.12s, color 0.12s',
    background: selected ? '#ffffff' : '#f2f2f3',
    color: '#111827',
    border: selected ? '1.5px solid #111827' : '1.5px solid transparent',
    lineHeight: 1.3,
  };
}
