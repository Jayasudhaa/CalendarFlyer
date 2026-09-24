/**
 * flyerTemplates.test.js
 *
 * flyerTemplates.js is pure data (no fabric.js calls), so this checks the
 * data itself is well-formed: exactly the 4 themed templates described in
 * the design preview, each with the fields applyTemplate()/placeArtwork()
 * (canvasBuilder.js) actually read, and an artworkSlot rectangle that fits
 * within its own layoutKey's LAYOUTS canvas bounds.
 */
import { describe, it, expect } from 'vitest';
import { FLYER_TEMPLATES, FLYER_TEMPLATES_BY_ID } from './flyerTemplates';
import { LAYOUTS } from './constants';

describe('FLYER_TEMPLATES', () => {
  it('exports exactly 4 templates — one per LAYOUTS size', () => {
    expect(FLYER_TEMPLATES).toHaveLength(4);
  });

  it('has unique ids, matched 1:1 by FLYER_TEMPLATES_BY_ID', () => {
    const ids = FLYER_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach(id => expect(FLYER_TEMPLATES_BY_ID[id]).toBeTruthy());
  });

  it.each(FLYER_TEMPLATES.map(t => [t.id, t]))('%s: has a name, description, and a valid layoutKey', (id, tpl) => {
    expect(typeof tpl.name).toBe('string');
    expect(tpl.name.length).toBeGreaterThan(0);
    expect(typeof tpl.description).toBe('string');
    expect(LAYOUTS[tpl.layoutKey]).toBeTruthy();
  });

  it.each(FLYER_TEMPLATES.map(t => [t.id, t]))('%s: has well-formed colors (bg or bgGradient, ink, accent)', (id, tpl) => {
    expect(tpl.colors).toBeTruthy();
    expect(typeof tpl.colors.bg === 'string' || Array.isArray(tpl.colors.bgGradient)).toBe(true);
    if (tpl.colors.bgGradient) {
      expect(tpl.colors.bgGradient).toHaveLength(2);
      tpl.colors.bgGradient.forEach(c => expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/));
    }
    expect(tpl.colors.ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(tpl.colors.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it.each(FLYER_TEMPLATES.map(t => [t.id, t]))('%s: has a title with a placeholder and a font', (id, tpl) => {
    expect(tpl.title?.placeholder).toBeTruthy();
    expect(tpl.title?.font).toBeTruthy();
    expect(typeof tpl.title?.fontSize).toBe('number');
  });

  it.each(FLYER_TEMPLATES.map(t => [t.id, t]))('%s: has a sponsorshipStyle of simple or comparison', (id, tpl) => {
    expect(['simple', 'comparison']).toContain(tpl.sponsorshipStyle);
  });

  it('parchment-gold uses the comparison-table sponsorship style with two columns', () => {
    const tpl = FLYER_TEMPLATES_BY_ID['parchment-gold'];
    expect(tpl.sponsorshipStyle).toBe('comparison');
    expect(tpl.sponsorship.columns).toHaveLength(2);
  });

  it.each(FLYER_TEMPLATES.map(t => [t.id, t]))('%s: has a boolean infoPanel flag, with content when true', (id, tpl) => {
    expect(typeof tpl.infoPanel).toBe('boolean');
    if (tpl.infoPanel) {
      expect(['grid', 'list']).toContain(tpl.infoPanelStyle);
      expect(tpl.infoPanelContent).toBeTruthy();
    }
  });

  it('cosmic-navy uses an info-panel grid (schedule + guidance)', () => {
    const tpl = FLYER_TEMPLATES_BY_ID['cosmic-navy'];
    expect(tpl.infoPanel).toBe(true);
    expect(tpl.infoPanelStyle).toBe('grid');
    expect(tpl.infoPanelContent.columns.left.rows.length).toBeGreaterThan(0);
    expect(tpl.infoPanelContent.columns.right.rows.length).toBeGreaterThan(0);
    expect(tpl.starfield).toBe(true);
  });

  it('harvest-green uses an info-panel list (menu)', () => {
    const tpl = FLYER_TEMPLATES_BY_ID['harvest-green'];
    expect(tpl.infoPanel).toBe(true);
    expect(tpl.infoPanelStyle).toBe('list');
    expect(tpl.infoPanelContent.rows.length).toBeGreaterThan(0);
  });

  it('maroon-jewel uses the simple sponsorship badge and no info panel', () => {
    const tpl = FLYER_TEMPLATES_BY_ID['maroon-jewel'];
    expect(tpl.sponsorshipStyle).toBe('simple');
    expect(tpl.infoPanel).toBe(false);
  });

  it.each(FLYER_TEMPLATES.map(t => [t.id, t]))('%s: has a footer with text', (id, tpl) => {
    expect(tpl.footer?.text).toBeTruthy();
  });

  it.each(FLYER_TEMPLATES.map(t => [t.id, t]))('%s: has a 3-color swatch for the template picker thumbnail', (id, tpl) => {
    expect(tpl.swatch).toHaveLength(3);
  });

  it.each(FLYER_TEMPLATES.map(t => [t.id, t]))('%s: artworkSlot is a valid, positive rectangle fully inside its LAYOUTS bounds', (id, tpl) => {
    const { x, y, width, height } = tpl.artworkSlot;
    const { w, h } = LAYOUTS[tpl.layoutKey];
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + width).toBeLessThanOrEqual(w);
    expect(y + height).toBeLessThanOrEqual(h);
  });
});
