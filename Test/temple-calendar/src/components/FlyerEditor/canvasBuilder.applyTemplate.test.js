/**
 * canvasBuilder.applyTemplate.test.js
 *
 * Coverage for applyTemplate() — the drawing half of the themed flyer
 * template system (flyerTemplates.js holds the data, this draws it onto a
 * Fabric.js canvas as named 'tpl_...' objects). Same fake-fabric mock
 * approach as canvasBuilder.placeLogo.test.js: applyTemplate only ever
 * reaches Fabric through `new window.fabric.<Class>(...)`, so each class
 * used (Rect/Textbox/Line/Circle/Polyline/Gradient) is stubbed here as a
 * plain factory that captures its constructor args onto a chainable
 * object, mirroring what the real Fabric v5 UMD build (loaded from cdnjs,
 * see useFabric.js) produces closely enough to assert on `name`/position/
 * color props afterward.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyTemplate } from './canvasBuilder';

// Every fabric "class" applyTemplate touches is just a constructor that
// tags the returned object with its own name (for assertions) and spreads
// whatever config it was given — real enough for this file's purposes
// without pulling in the actual Fabric.js library.
function makeFabricStub() {
  const rectLike = (type) => vi.fn((opts) => ({ __type: type, ...opts }));
  const lineLike = (type) => vi.fn((points, opts) => ({ __type: type, points, ...opts }));
  const textLike = (type) => vi.fn((text, opts) => ({ __type: type, text, ...opts }));
  return {
    Rect: rectLike('rect'),
    Circle: rectLike('circle'),
    Textbox: textLike('textbox'),
    Line: lineLike('line'),
    Polyline: lineLike('polyline'),
    Gradient: vi.fn((opts) => ({ __type: 'gradient', ...opts })),
    Image: { fromURL: vi.fn() },
  };
}

function makeFakeCanvas() {
  const objects = [];
  return {
    getObjects: vi.fn(() => objects),
    add: vi.fn((obj) => objects.push(obj)),
    remove: vi.fn((obj) => {
      const i = objects.indexOf(obj);
      if (i >= 0) objects.splice(i, 1);
    }),
    clear: vi.fn(() => { objects.length = 0; }),
    renderAll: vi.fn(),
    discardActiveObject: vi.fn(),
    _objects: objects,
  };
}

const baseTemplate = () => ({
  id: 'test-tpl',
  name: 'Test Template',
  colors: { bg: '#FBF3DC', ink: '#5C1A1A', accent: '#C9A227' },
  border: { outerInset: 24, innerInset: 34, cornerSize: 40 },
  title: { placeholder: 'Event Title', font: 'Cinzel', fontSize: 0.058, color: '#5C1A1A', top: 0.1, divider: true },
  datePill: { placeholder: 'Date • Time', top: 0.2, style: 'outline' },
  sponsorshipStyle: 'simple',
  sponsorship: { top: 0.6, heading: 'Sponsored By', badgeText: '[Name]' },
  infoPanel: false,
  footer: { top: 0.93, text: 'Temple • Address • Phone' },
  artworkSlot: { x: 108, y: 400, width: 864, height: 380 },
});

const dims = { w: 1080, h: 1350 };

beforeEach(() => {
  global.window.fabric = makeFabricStub();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('applyTemplate', () => {
  it('bails out (no throw, logs an error) when canvas is missing', () => {
    expect(() => applyTemplate({ canvas: null, template: baseTemplate(), dims })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('no canvas'));
  });

  it('bails out when template is missing', () => {
    const canvas = makeFakeCanvas();
    expect(() => applyTemplate({ canvas, template: null, dims })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('no template'));
    expect(canvas.add).not.toHaveBeenCalled();
  });

  it('bails out when dims is missing', () => {
    const canvas = makeFakeCanvas();
    expect(() => applyTemplate({ canvas, template: baseTemplate(), dims: null })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('no dims'));
    expect(canvas.add).not.toHaveBeenCalled();
  });

  it('clears the canvas before drawing (a template replaces prior content)', () => {
    const canvas = makeFakeCanvas();
    canvas._objects.push({ name: 'stale_object' });
    applyTemplate({ canvas, template: baseTemplate(), dims });
    expect(canvas.clear).toHaveBeenCalledTimes(1);
    expect(canvas._objects.find(o => o.name === 'stale_object')).toBeUndefined();
  });

  it('draws the background, border, title, date pill, and footer as named tpl_ objects', () => {
    const canvas = makeFakeCanvas();
    applyTemplate({ canvas, template: baseTemplate(), dims });
    const names = canvas._objects.map(o => o.name);
    expect(names).toEqual(expect.arrayContaining([
      'tpl_bg', 'tpl_border_outer', 'tpl_border_inner',
      'tpl_corner_tl', 'tpl_corner_tr', 'tpl_corner_bl', 'tpl_corner_br',
      'tpl_title', 'tpl_title_divider', 'tpl_title_ornament',
      'tpl_date_pill_bg', 'tpl_date_pill_text',
      'tpl_footer_rule', 'tpl_footer_text',
    ]));
  });

  it('uses the title placeholder text and font from the template', () => {
    const canvas = makeFakeCanvas();
    applyTemplate({ canvas, template: baseTemplate(), dims });
    const title = canvas._objects.find(o => o.name === 'tpl_title');
    expect(title.text).toBe('Event Title');
    expect(title.fontFamily).toBe('Cinzel');
    expect(title.fill).toBe('#5C1A1A');
  });

  it('builds a plain fill color (not a Gradient) when the template has no bgGradient', () => {
    const canvas = makeFakeCanvas();
    applyTemplate({ canvas, template: baseTemplate(), dims });
    const bg = canvas._objects.find(o => o.name === 'tpl_bg');
    expect(bg.fill).toBe('#FBF3DC');
    expect(window.fabric.Gradient).not.toHaveBeenCalled();
  });

  it('builds a top-to-bottom Gradient fill when the template has a bgGradient', () => {
    const canvas = makeFakeCanvas();
    const tpl = { ...baseTemplate(), colors: { bg: '#4A0F12', bgGradient: ['#4A0F12', '#22050A'], ink: '#F3E2B0', accent: '#C9A227' } };
    applyTemplate({ canvas, template: tpl, dims });
    expect(window.fabric.Gradient).toHaveBeenCalledWith(expect.objectContaining({
      type: 'linear',
      colorStops: [{ offset: 0, color: '#4A0F12' }, { offset: 1, color: '#22050A' }],
    }));
    const bg = canvas._objects.find(o => o.name === 'tpl_bg');
    expect(bg.fill.__type).toBe('gradient');
  });

  it('draws the "simple" sponsorship badge for sponsorshipStyle: simple', () => {
    const canvas = makeFakeCanvas();
    applyTemplate({ canvas, template: baseTemplate(), dims });
    const badge = canvas._objects.find(o => o.name === 'tpl_sponsorship_badge_text');
    expect(badge).toBeTruthy();
    expect(badge.text).toContain('[Name]');
    expect(canvas._objects.find(o => o.name === 'tpl_sponsorship_col_left_label')).toBeUndefined();
  });

  it('draws the two-column comparison table for sponsorshipStyle: comparison', () => {
    const canvas = makeFakeCanvas();
    const tpl = {
      ...baseTemplate(),
      sponsorshipStyle: 'comparison',
      sponsorship: {
        top: 0.6, heading: 'Sponsorship',
        columns: [
          { label: 'Provided by Temple', items: ['Prasadam'] },
          { label: 'Provided by Devotee', items: ['Dakshina'] },
        ],
      },
    };
    applyTemplate({ canvas, template: tpl, dims });
    const leftLabel = canvas._objects.find(o => o.name === 'tpl_sponsorship_col_left_label');
    const rightLabel = canvas._objects.find(o => o.name === 'tpl_sponsorship_col_right_label');
    expect(leftLabel.text).toBe('Provided by Temple');
    expect(rightLabel.text).toBe('Provided by Devotee');
    expect(canvas._objects.find(o => o.name === 'tpl_sponsorship_col_left_items').text).toContain('Prasadam');
    expect(canvas._objects.find(o => o.name === 'tpl_sponsorship_badge_text')).toBeUndefined();
  });

  it('skips the info panel entirely when infoPanel is false', () => {
    const canvas = makeFakeCanvas();
    applyTemplate({ canvas, template: baseTemplate(), dims });
    expect(canvas._objects.some(o => (o.name || '').startsWith('tpl_info_'))).toBe(false);
  });

  it('draws a two-column schedule+guidance grid for infoPanelStyle: grid', () => {
    const canvas = makeFakeCanvas();
    const tpl = {
      ...baseTemplate(),
      infoPanel: true,
      infoPanelStyle: 'grid',
      infoPanelContent: {
        top: 0.6, height: 0.26, left: 0.08, width: 0.84,
        columns: {
          left: { title: 'Schedule', rows: ['Begins — 6am'] },
          right: { title: 'Guidance', rows: ['Stay indoors'] },
        },
      },
    };
    applyTemplate({ canvas, template: tpl, dims });
    expect(canvas._objects.find(o => o.name === 'tpl_info_left_title').text).toBe('Schedule');
    expect(canvas._objects.find(o => o.name === 'tpl_info_right_title').text).toBe('Guidance');
    expect(canvas._objects.find(o => o.name === 'tpl_info_left_rows').text).toContain('Begins — 6am');
    expect(canvas._objects.find(o => o.name === 'tpl_info_rows')).toBeUndefined();
  });

  it('draws a single-column bullet list for infoPanelStyle: list', () => {
    const canvas = makeFakeCanvas();
    const tpl = {
      ...baseTemplate(),
      infoPanel: true,
      infoPanelStyle: 'list',
      infoPanelContent: { top: 0.34, height: 0.48, left: 0.565, width: 0.395, title: 'Sadya Menu', rows: ['Rice & Sambar'] },
    };
    applyTemplate({ canvas, template: tpl, dims });
    const title = canvas._objects.find(o => o.name === 'tpl_info_title');
    const rows = canvas._objects.find(o => o.name === 'tpl_info_rows');
    expect(title.text).toBe('Sadya Menu');
    expect(rows.text).toContain('Rice & Sambar');
    expect(canvas._objects.find(o => o.name === 'tpl_info_left_title')).toBeUndefined();
  });

  it('draws a deterministic starfield when template.starfield is true', () => {
    const canvas = makeFakeCanvas();
    const tpl = { ...baseTemplate(), starfield: true };
    applyTemplate({ canvas, template: tpl, dims });
    const stars = canvas._objects.filter(o => o.name === 'tpl_star');
    expect(stars).toHaveLength(60);
    expect(stars.every(s => s.left >= 0 && s.left <= dims.w)).toBe(true);
    // Same template + dims must always render the same starfield — no
    // Math.random(), so re-running is exactly reproducible.
    const canvas2 = makeFakeCanvas();
    applyTemplate({ canvas: canvas2, template: tpl, dims });
    const stars2 = canvas2._objects.filter(o => o.name === 'tpl_star');
    expect(stars2.map(s => s.left)).toEqual(stars.map(s => s.left));
  });

  it('skips the starfield when template.starfield is not set', () => {
    const canvas = makeFakeCanvas();
    applyTemplate({ canvas, template: baseTemplate(), dims });
    expect(canvas._objects.some(o => o.name === 'tpl_star')).toBe(false);
  });

  it('draws the artwork-slot placeholder at the template\'s artworkSlot rectangle', () => {
    const canvas = makeFakeCanvas();
    applyTemplate({ canvas, template: baseTemplate(), dims });
    const placeholder = canvas._objects.find(o => o.name === 'tpl_artwork_placeholder');
    expect(placeholder).toMatchObject({ left: 108, top: 400, width: 864, height: 380 });
    expect(canvas._objects.find(o => o.name === 'tpl_artwork_hint')).toBeTruthy();
  });

  it('skips the artwork-slot placeholder when the template has no artworkSlot', () => {
    const canvas = makeFakeCanvas();
    const { artworkSlot, ...tpl } = baseTemplate();
    applyTemplate({ canvas, template: tpl, dims });
    expect(canvas._objects.some(o => o.name === 'tpl_artwork_placeholder')).toBe(false);
  });

  it('renders and clears the active selection when done', () => {
    const canvas = makeFakeCanvas();
    applyTemplate({ canvas, template: baseTemplate(), dims });
    expect(canvas.renderAll).toHaveBeenCalled();
    expect(canvas.discardActiveObject).toHaveBeenCalled();
  });
});
