export const APP_DOMAIN = 'https://calendarflyapp.com';
// ─── Temple Info ──────────────────────────────────────────────────────────────
export const TEMPLE_NAME = 'SAMPLE TEMPLE NAME';
export const TEMPLE_ADDR = '123 Main Street, Your City, ST 00000';
export const TEMPLE_INFO = 'Temple: 555 555 5555  |  Manager: 555 555 5556  |  manager@example.org';

// ─── Canvas Sizes ─────────────────────────────────────────────────────────────
// Positions inside canvasBuilder.js are all computed as w*0.xx / h*0.xx, so
// these pixel dimensions are safe to change freely — nothing is hardcoded.
export const LAYOUTS = {
  square:    { label: 'Square Post',        icon: '⬛', w: 1080, h: 1080, desc: '1080 x 1080 px' },
  portrait:  { label: 'Poster (Portrait)',  icon: '📄', w: 1080, h: 1350, desc: '1080 x 1350 px' },
  landscape: { label: 'Poster (Landscape)', icon: '🖼',  w: 1350, h: 1080, desc: '1350 x 1080 px' },
  story:     { label: 'Story',              icon: '📱', w: 1080, h: 1920, desc: '1080 x 1920 px' },
};

// ─── Color Themes ─────────────────────────────────────────────────────────────
export const THEMES = {
  saffron:  { label: 'Saffron Blessing',  bg: '#FFF9E6', header: '#D97706', title: '#92400E', date: '#166534', text: '#1f2937', border: '#F59E0B', accent: '#FEF3C7' },
  crimson:  { label: 'Crimson Devotion',  bg: '#7F1D1D', header: '#B91C1C', title: '#FEF2F2', date: '#FDE68A', text: '#FFFFFF', border: '#EF4444', accent: '#450A0A' },
  ivory:    { label: 'Ivory Elegance',    bg: '#FFFFF0', header: '#92400E', title: '#6B0F1A', date: '#14532D', text: '#111827', border: '#9B7840', accent: '#FEFCE8' },
  royal:    { label: 'Royal Indigo',      bg: '#1E1B4B', header: '#3730A3', title: '#E0E7FF', date: '#FDE68A', text: '#C7D2FE', border: '#6366F1', accent: '#312E81' },
  emerald:  { label: 'Emerald Grace',     bg: '#064E3B', header: '#065F46', title: '#D1FAE5', date: '#FDE68A', text: '#A7F3D0', border: '#10B981', accent: '#022C22' },
  rose:     { label: 'Rose Bloom',        bg: '#FFF1F2', header: '#BE123C', title: '#881337', date: '#166534', text: '#4C0519', border: '#FB7185', accent: '#FFE4E6' },
};
// Small solid swatch shown next to each theme name in dropdowns/legends.
export const THEME_SWATCH = Object.fromEntries(
  Object.entries(THEMES).map(([k, t]) => [k, t.header])
);

// ─── Font Options ─────────────────────────────────────────────────────────────
// Legacy per-object font picker (Text panel) — unchanged.
export const FONTS = ['Georgia', 'Times New Roman', 'Palatino', 'Garamond', 'serif'];

// New Heading/Body font-pairing system (Design panel → Text section). Names
// map 1:1 to Google Fonts family names — loadGoogleFont() in canvasBuilder.js
// injects the stylesheet for whichever ones get used.
export const HEADING_FONTS = ['Cinzel', 'Playfair Display', 'Cormorant Garamond', 'Marcellus', 'Georgia'];
export const BODY_FONTS    = ['Poppins', 'Lato', 'Montserrat', 'Raleway', 'Georgia'];

// ─── Layout density (Design panel → Layout → Spacing) ────────────────────────
// A scalar applied to a handful of key vertical gaps in canvasBuilder.js —
// Compact tightens the layout, Spacious opens it up, Comfortable is today's
// default spacing (multiplier 1).
export const SPACING_OPTIONS = {
  Compact:     0.85,
  Comfortable: 1,
  Spacious:    1.2,
};

// ─── Languages ────────────────────────────────────────────────────────────────
export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ta', label: 'Tamil',   flag: '🇮🇳' },
  { code: 'te', label: 'Telugu',  flag: '🇮🇳' },
  { code: 'hi', label: 'Hindi',   flag: '🇮🇳' },
  { code: 'kn', label: 'Kannada', flag: '🇮🇳' },
];

// ─── Left icon rail panels ────────────────────────────────────────────────────
// The editor now opens on a DIY-pic-vs-Let-AI-do-it choice (see the mode
// chooser overlay in index.jsx) instead of a Templates tab — Templates set
// both the layout AND the color theme for the whole flyer, which is more
// than "pick a starter image," and mixed poorly with a photo-first choice.
// Removed outright rather than folded in elsewhere; every flyer now uses one
// fixed default layout/theme. TemplatesPanel.jsx and applyTemplate() are
// left on disk unused, same as the other panels retired in earlier passes.
//
// DIY and AI now share almost nothing in the rail — Media (library/stock/
// upload/graphics, background upload, logo, crop/remove-bg/blur/brightness)
// is DIY-only, since AI Visual already covers getting a photo in and a full
// Media tab there felt redundant. AI mode gets its own slim "Brand & Edit"
// tab instead — just logo + the image-editing tools, without the photo
// library. Text is the only tab common to both. The mode itself is locked
// once chosen via the full-screen chooser — see the "↺ Restart" button in
// index.jsx's icon rail, which rebuilds the canvas fresh for whichever mode
// is (re-)picked.
// 'event' now renders the merged Event & Text panel (EventTextPanel.jsx) —
// content editors for the template's named fields (title/date/time/venue/
// description), each with its own font family/size/bold/italic, PLUS the
// free-form "Other Text" tools (add a text box, style whatever's selected,
// language/translate) that used to be a separate 'text' tab. Merged per a
// direct request: separate Event/Text tabs made it unclear where to change
// a field's font, since TextPanel's style controls only ever touched
// whichever object happened to be selected on canvas, not a specific field.
export const PANELS_DIY = [
  { id: 'event', icon: '📅', label: 'Event & Text' },
  { id: 'media', icon: '🖼', label: 'Media' },
];
export const PANELS_AI = [
  { id: 'ai',    icon: '✨', label: 'AI Visual'        },
  // Renamed from "Brand & Edit" — a direct request for "a stylish name" —
  // now that it also holds the direct background-upload fallback moved in
  // from Reference Photos (see BrandEditPanel.jsx).
  { id: 'brand', icon: '🪄', label: 'Finishing Touches' },
  { id: 'event', icon: '📅', label: 'Event & Text'      },
];

// ─── Starter Templates (Templates panel) ──────────────────────────────────────
// `builder` selects which canvasBuilder function draws the layout — all three
// populate the same named objects (event_title, event_date, …) so theme
// changes, translation, and poster mode keep working no matter which one is
// active. `swatch` colors drive the lightweight CSS thumbnail preview.
export const TEMPLATES = [
  {
    id: 'traditional-mahotsav', name: 'Shree Mandir Mahotsav', category: 'Traditional',
    builder: 'traditional', theme: 'saffron', emoji: '🛕',
    swatch: ['#3b1d06', '#c8860a', '#f0c050'],
    desc: 'Ornate gold-bordered temple invitation with full-bleed photo',
  },
  {
    id: 'traditional-kirtan', name: 'Kirtan Sandhya', category: 'Traditional',
    builder: 'traditional', theme: 'crimson', emoji: '🪔',
    swatch: ['#450a0a', '#b91c1c', '#fde68a'],
    desc: 'Warm devotional evening program card',
  },
  {
    id: 'modern-seva', name: 'Annadan Seva', category: 'Modern',
    builder: 'modern', theme: 'ivory', emoji: '🍚',
    swatch: ['#ffffff', '#92400e', '#d97706'],
    desc: 'Clean photo-forward card with bold sans headline',
  },
  {
    id: 'modern-shivir', name: 'Bal Sanskar Shivir', category: 'Modern',
    builder: 'modern', theme: 'royal', emoji: '📿',
    swatch: ['#1e1b4b', '#6366f1', '#e0e7ff'],
    desc: 'Modern youth-program layout with accent color bar',
  },
  {
    id: 'minimal-lights', name: 'Festival of Lights', category: 'Minimal',
    builder: 'minimal', theme: 'emerald', emoji: '✨',
    swatch: ['#022c22', '#10b981', '#d1fae5'],
    desc: 'Understated, text-first layout with generous whitespace',
  },
  {
    id: 'minimal-community', name: 'Community Celebration', category: 'Minimal',
    builder: 'minimal', theme: 'rose', emoji: '🎊',
    swatch: ['#fff1f2', '#be123c', '#fb7185'],
    desc: 'Simple centered card, great for quick announcements',
  },
];
export const TEMPLATE_CATEGORIES = ['All', 'Traditional', 'Modern', 'Minimal'];

// ─── Shared Styles (light theme) ──────────────────────────────────────────────
// `accent`/`accentSoft` are the site-wide accent — went orange → indigo →
// (a round of proposed alternatives) → charcoal, the one that was picked.
// Every plain <button style={{background: COLORS.accent}}> and colored
// border/text across the app re-themes automatically from this one token;
// only elements that layer a glossy highlight on top (Share & Publish,
// Generate, primary CTA buttons) needed their own edit, in the files where
// that gloss lives.
export const COLORS = {
  appBg:      '#ffffff',
  panelBg:    '#ffffff',
  panelBorder:'#e5e7eb',
  // Premium white behind the canvas (was a flat light gray, #eef0f3) —
  // does NOT touch the flyer/canvas content itself, only the studio's own
  // backdrop around it.
  canvasBg:   '#ffffff',
  text:       '#000000',
  textMuted:  '#52525b',
  textFaint:  '#71717a',
  border:     '#e5e7eb',
  borderStrong:'#d1d5db',
  accent:     '#57534e',
  accentSoft: '#f1efec',
  accentDeep: '#1c1917',
  danger:     '#dc2626',
};

export const STYLES = {
  sectionLabel: {
    display: 'block', color: COLORS.textMuted, fontSize: '0.72rem',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 6, marginTop: 14, fontWeight: '700',
  },
  input: {
    width: '100%', padding: '8px 11px', background: '#ffffff',
    border: `1.5px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8,
    fontSize: '0.82rem', boxSizing: 'border-box', outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  },
  card: {
    background: COLORS.panelBg, border: `1px solid ${COLORS.panelBorder}`,
    borderRadius: 12, padding: 14,
  },
  // Shared "grouped section" card used inside every left-rail panel (Brand,
  // Event & Text, Media, Poster Specification, Reference Library, Photo
  // Style, …) — "Champagne Glass", now on a grey ground (a direct request,
  // after comparing pale-yellow vs. grey side by side) instead of the
  // original pale-yellow/gold-tinted one — the same frosted-card recipe
  // PosterSpecWizard.jsx and AIVisualPanel.jsx already carry: translucent
  // white over the rail's own grey gradient backdrop (see each panel's own
  // outer wrapper), with a soft neutral hairline border instead of gold.
  // Gold stays as the ACCENT color on buttons/highlights — only the
  // background/border/ink tokens moved to grey.
  sectionCard: {
    padding: '12px 13px', marginBottom: 12, borderRadius: 12,
    background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    border: '1px solid rgba(90,84,74,0.22)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 20px -18px rgba(60,56,50,0.35)',
  },
  // Section header used inside sectionCard blocks. Neutral hairline
  // underline now to match the grey ground, instead of the gold one.
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: 6,
    color: '#232220', fontWeight: '800', fontSize: '0.95rem',
    marginBottom: 9, paddingBottom: 7,
    borderBottom: '2px solid rgba(90,84,74,0.3)',
    letterSpacing: '0.01em',
  },
};
