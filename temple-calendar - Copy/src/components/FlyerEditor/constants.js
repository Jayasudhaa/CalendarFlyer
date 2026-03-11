export const APP_DOMAIN = 'https://jyuxa8xvk6.us-east-2.awsapprunner.com';
// ─── Temple Info ──────────────────────────────────────────────────────────────
export const TEMPLE_NAME = 'SRI VENKATESWARA SWAMY TEMPLE OF COLORADO';
export const TEMPLE_ADDR = '1495 South Ridge Road, Castle Rock, CO 80104';
export const TEMPLE_INFO = 'Temple: 303 660 9555  |  Manager: 303 898 5514  |  manager@svtempleco.org';

// ─── Canvas Layouts ───────────────────────────────────────────────────────────
export const LAYOUTS = {
  square:    { label: 'Square',    icon: '⬛', w: 800,  h: 800,  desc: '800×800'   },
  portrait:  { label: 'Portrait',  icon: '📄', w: 700,  h: 1000, desc: '700×1000'  },
  landscape: { label: 'Landscape', icon: '🖼',  w: 1000, h: 700,  desc: '1000×700'  },
  story:     { label: 'Story',     icon: '📱', w: 600,  h: 1067, desc: '600×1067'  },
};

// ─── Color Themes ─────────────────────────────────────────────────────────────
export const THEMES = {
  saffron:  { label: 'Saffron',  bg: '#FFF9E6', header: '#D97706', title: '#92400E', date: '#166534', text: '#1f2937', border: '#F59E0B', accent: '#FEF3C7' },
  crimson:  { label: 'Crimson',  bg: '#7F1D1D', header: '#B91C1C', title: '#FEF2F2', date: '#FDE68A', text: '#FFFFFF', border: '#EF4444', accent: '#450A0A' },
  ivory:    { label: 'Ivory',    bg: '#FFFFF0', header: '#92400E', title: '#6B0F1A', date: '#14532D', text: '#111827', border: '#9B7840', accent: '#FEFCE8' },
  royal:    { label: 'Royal',    bg: '#1E1B4B', header: '#3730A3', title: '#E0E7FF', date: '#FDE68A', text: '#C7D2FE', border: '#6366F1', accent: '#312E81' },
  emerald:  { label: 'Emerald',  bg: '#064E3B', header: '#065F46', title: '#D1FAE5', date: '#FDE68A', text: '#A7F3D0', border: '#10B981', accent: '#022C22' },
  rose:     { label: 'Rose',     bg: '#FFF1F2', header: '#BE123C', title: '#881337', date: '#166534', text: '#4C0519', border: '#FB7185', accent: '#FFE4E6' },
};

// ─── Font Options ─────────────────────────────────────────────────────────────
export const FONTS = ['Georgia', 'Times New Roman', 'Palatino', 'Garamond', 'serif'];

// ─── Languages ────────────────────────────────────────────────────────────────
export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ta', label: 'Tamil',   flag: '🇮🇳' },
  { code: 'te', label: 'Telugu',  flag: '🇮🇳' },
  { code: 'hi', label: 'Hindi',   flag: '🇮🇳' },
];

// ─── Sidebar Panels ───────────────────────────────────────────────────────────
export const PANELS = [
  { id: 'design', icon: '🎨', label: 'Design' },
  { id: 'image',  icon: '✨', label: 'Image'  },
  { id: 'text',   icon: '✏️', label: 'Text'   },
  { id: 'upload', icon: '📤', label: 'Upload' },
];

// ─── Shared Styles ────────────────────────────────────────────────────────────
export const STYLES = {
  sectionLabel: {
    display: 'block', color: '#e2e8f0', fontSize: '0.78rem',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginBottom: 8, marginTop: 16, fontWeight: '600',
  },
  input: {
    width: '100%', padding: '9px 12px', background: '#0f172a',
    border: '1.5px solid #334155', color: 'white', borderRadius: 8,
    fontSize: '0.82rem', boxSizing: 'border-box', outline: 'none',
    fontFamily: 'Georgia,serif',
  },
};
