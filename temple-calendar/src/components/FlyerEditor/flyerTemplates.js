// ─── Themed Flyer Templates ─────────────────────────────────────────────────
// Pure DATA (no JSX, no fabric.js calls) describing four reusable flyer
// themes, drawn from patterns observed across 16 real event flyers a temple
// client sent as design references, and matching the HTML/CSS design
// preview they approved: a header/title band with a ceremonial-serif title
// and a divider ornament, a date/time pill, a sponsorship block (sometimes
// a two-column "provided by temple / provided by devotee" comparison
// table), an optional info panel (schedule/checklist/guidance content), a
// footer, and an ornamental gold-filigree-style border.
//
// canvasBuilder.js's applyTemplate() is the only thing that reads this data
// (see its own header comment for the fabric.js drawing side) — every
// numeric "top"/"left"/"width"/"height" field below is a FRACTION of the
// target canvas's w/h (dims from constants.js's LAYOUTS[layoutKey]), same
// convention buildFlyer()/buildModernFlyer() already use throughout
// canvasBuilder.js, so nothing here is tied to a hardcoded pixel size.
// artworkSlot is the one exception — per the spec this rectangle is in
// absolute canvas coordinates (it also has to double as the geometry
// placeArtwork() clips a photo to), sized for each template's own
// layoutKey's canvas dimensions.
//
// Each template targets one existing constants.js LAYOUTS entry rather than
// inventing a new canvas size — see the per-template comment below for why
// that particular size fits that template's content and real-world use.

export const FLYER_TEMPLATES = [
  {
    id: 'parchment-gold',
    name: 'Parchment & Gold',
    description: 'Warm cream and deep maroon with gold accents — the everyday theme for weekly pujas and regular observances.',
    // Portrait (1080x1350): the two-column sponsorship comparison table
    // needs real vertical room below the title/date block, and a portrait
    // poster is what most orgs already print/post for a standard puja.
    layoutKey: 'portrait',
    colors: { bg: '#FBF3DC', bgGradient: null, ink: '#5C1A1A', accent: '#C9A227' },
    border: { outerInset: 26, innerInset: 38, cornerSize: 46 },
    title: {
      placeholder: 'Event Title',
      font: 'Cinzel',
      fontSize: 0.058,
      color: '#5C1A1A',
      top: 0.10,
      divider: true,
    },
    datePill: { placeholder: 'Sunday, Date  •  Time', top: 0.205, style: 'outline' },
    sponsorshipStyle: 'comparison',
    sponsorship: {
      top: 0.60,
      heading: 'Sponsorship',
      columns: [
        { label: 'Provided by Temple', items: ['Puja items & materials', 'Prasadam', 'Decorations & flowers'] },
        { label: 'Provided by Devotee', items: ['Fruits & flowers', 'Dakshina', 'Sankalpam details'] },
      ],
    },
    infoPanel: false,
    footer: { top: 0.93, text: 'Temple Name  •  Address  •  Phone' },
    artworkSlot: { x: 108, y: 400, width: 864, height: 380 },
    swatch: ['#FBF3DC', '#5C1A1A', '#C9A227'],
  },
  {
    id: 'maroon-jewel',
    name: 'Maroon Jewel',
    description: 'Deep maroon jewel tones with a gold-filled date pill and a simple sponsor badge — for abhishekams and joint multi-sponsor events.',
    // Square (1080x1080): a single sponsor badge (not a table) and no info
    // panel means this theme is content-light — a square social-post size
    // fits it better than a tall poster, and matches how these are usually
    // shared (Instagram/WhatsApp square posts).
    layoutKey: 'square',
    colors: { bg: '#4A0F12', bgGradient: ['#4A0F12', '#22050A'], ink: '#F3E2B0', accent: '#C9A227' },
    border: { outerInset: 24, innerInset: 34, cornerSize: 40 },
    title: {
      placeholder: 'Event Title',
      font: 'Playfair Display',
      fontSize: 0.062,
      color: '#F3E2B0',
      top: 0.10,
      divider: true,
    },
    datePill: { placeholder: 'Sunday, Date  •  Time', top: 0.215, style: 'filled' },
    sponsorshipStyle: 'simple',
    sponsorship: { top: 0.70, heading: 'Sponsored By', badgeText: '[Sponsor / Family Name]' },
    infoPanel: false,
    footer: { top: 0.93, text: 'Temple Name  •  Address  •  Phone' },
    artworkSlot: { x: 130, y: 330, width: 820, height: 380 },
    swatch: ['#4A0F12', '#22050A', '#C9A227'],
  },
  {
    id: 'cosmic-navy',
    name: 'Cosmic Navy',
    description: 'Navy starfield gradient with a schedule + guidance info grid — for eclipses and other night-sky observances.',
    // Story (1080x1920): eclipse/night-sky alerts are the one category this
    // client's references post as tall Instagram/WhatsApp Stories rather
    // than a poster — and the schedule+guidance grid needs the extra
    // vertical space a story canvas gives that a square or portrait one
    // doesn't.
    layoutKey: 'story',
    starfield: true,
    colors: { bg: '#0B1130', bgGradient: ['#0B1130', '#050818'], ink: '#F4F1EA', accent: '#E8B93B' },
    border: { outerInset: 24, innerInset: 34, cornerSize: 40 },
    title: {
      placeholder: 'Event Title',
      font: 'Marcellus',
      fontSize: 0.058,
      color: '#F4F1EA',
      top: 0.09,
      divider: true,
    },
    datePill: { placeholder: 'Sunday, Date  •  Time', top: 0.185, style: 'outline' },
    sponsorshipStyle: 'simple',
    sponsorship: { top: 0.25, heading: 'Sponsored By', badgeText: '[Sponsor / Family Name]' },
    infoPanel: true,
    infoPanelStyle: 'grid',
    infoPanelContent: {
      top: 0.60, height: 0.26, left: 0.08, width: 0.84,
      columns: {
        left: {
          title: 'Schedule',
          rows: ['Sutak Begins — [time]', 'Eclipse Begins — [time]', 'Maximum Eclipse — [time]', 'Eclipse Ends — [time]'],
        },
        right: {
          title: 'Guidance',
          rows: ['Avoid food & water during eclipse', 'Chant / meditate indoors', 'Temple closed during Sutak', 'Reopens after purification'],
        },
      },
    },
    footer: { top: 0.955, text: 'Temple Name  •  Address  •  Phone' },
    artworkSlot: { x: 90, y: 560, width: 900, height: 500 },
    swatch: ['#0B1130', '#050818', '#E8B93B'],
  },
  {
    id: 'harvest-green',
    name: 'Harvest Green',
    description: 'Seasonal green gradient with a printed Sadya-style menu list — for Onam-style harvest festivals and community feasts.',
    // Landscape (1350x1080): a photo-and-menu side-by-side layout (artwork
    // on one side, the menu list on the other) reads naturally as a wide
    // banner — this is also the size these community feast flyers get
    // printed at for hall/table display, per the references.
    layoutKey: 'landscape',
    colors: { bg: '#1F5C2E', bgGradient: ['#1F5C2E', '#123B1C'], ink: '#FAF3E0', accent: '#D4AF37' },
    border: { outerInset: 24, innerInset: 34, cornerSize: 40 },
    title: {
      placeholder: 'Event Title',
      font: 'Cormorant Garamond',
      fontSize: 0.052,
      color: '#FAF3E0',
      top: 0.08,
      divider: true,
    },
    datePill: { placeholder: 'Sunday, Date  •  Time', top: 0.21, style: 'outline' },
    sponsorshipStyle: 'simple',
    sponsorship: { top: 0.29, heading: 'Sponsored By', badgeText: '[Sponsor / Family Name]' },
    infoPanel: true,
    infoPanelStyle: 'list',
    infoPanelContent: {
      top: 0.34, height: 0.48, left: 0.565, width: 0.395,
      title: 'Sadya Menu',
      rows: ['Rice & Sambar', 'Avial & Thoran', 'Pachadi & Payasam', 'Banana Chips & Pickle'],
    },
    footer: { top: 0.93, text: 'Temple Name  •  Address  •  Phone' },
    artworkSlot: { x: 70, y: 367, width: 620, height: 520 },
    swatch: ['#1F5C2E', '#123B1C', '#D4AF37'],
  },
];

export const FLYER_TEMPLATES_BY_ID = Object.fromEntries(FLYER_TEMPLATES.map(t => [t.id, t]));
