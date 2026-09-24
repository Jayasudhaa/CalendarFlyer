/**
 * canvasBuilder.placeArtwork.test.js
 *
 * Coverage for placeArtwork() — places a photo into a themed flyer
 * template's artworkSlot (flyerTemplates.js). Same fake-fabric mock
 * approach as canvasBuilder.placeLogo.test.js (placeArtwork follows the
 * exact same load/guard/dedup-before-replace shape as placeLogo, just
 * sized to template.artworkSlot instead of a fixed LOGO_BOX), plus a
 * fabric.Rect stub since placeArtwork also builds a clipPath rect.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { placeArtwork } from './canvasBuilder';

function makeFabricImage(width = 800, height = 500) {
  const img = { width, height };
  img.set = vi.fn((props) => { Object.assign(img, props); return img; });
  return img;
}

function makeFakeCanvas(existingObjects = []) {
  const objects = [...existingObjects];
  return {
    getObjects: vi.fn(() => objects),
    add: vi.fn((obj) => objects.push(obj)),
    remove: vi.fn((obj) => {
      const i = objects.indexOf(obj);
      if (i >= 0) objects.splice(i, 1);
    }),
    setActiveObject: vi.fn(),
    renderAll: vi.fn(),
    _objects: objects,
  };
}

const template = () => ({
  id: 'test-tpl',
  artworkSlot: { x: 108, y: 400, width: 864, height: 380 },
});

beforeEach(() => {
  global.window.fabric = {
    Image: { fromURL: vi.fn((url, callback) => callback(makeFabricImage())) },
    Rect: vi.fn((opts) => ({ __type: 'rect', ...opts })),
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('placeArtwork', () => {
  it('adds the loaded image to the canvas, centered in the artwork slot', () => {
    const canvas = makeFakeCanvas();
    placeArtwork({ canvas, url: 'data:image/png;base64,xyz', template: template() });

    expect(window.fabric.Image.fromURL).toHaveBeenCalledTimes(1);
    expect(canvas.add).toHaveBeenCalledTimes(1);
    expect(canvas._objects).toHaveLength(1);
    const [img] = canvas._objects;
    expect(img.name).toBe('tpl_artwork_img');
    // slot is x:108,y:400,w:864,h:380 -> center at (108+432, 400+190)
    expect(img.left).toBe(108 + 864 / 2);
    expect(img.top).toBe(400 + 380 / 2);
    expect(img.originX).toBe('center');
    expect(img.originY).toBe('center');
  });

  it('cover-fits the image to the slot (scales up to fill, not down to contain)', () => {
    const canvas = makeFakeCanvas();
    // 800x500 image into an 864x380 slot -> scale = max(864/800, 380/500) = max(1.08, 0.76) = 1.08
    placeArtwork({ canvas, url: 'data:x', template: template() });
    const [img] = canvas._objects;
    expect(img.scaleX).toBeCloseTo(864 / 800, 5);
    expect(img.scaleY).toBeCloseTo(864 / 800, 5);
  });

  it('clips the image to the slot rectangle with an absolutely-positioned clipPath', () => {
    const canvas = makeFakeCanvas();
    placeArtwork({ canvas, url: 'data:x', template: template() });
    const [img] = canvas._objects;
    expect(window.fabric.Rect).toHaveBeenCalledWith(expect.objectContaining({
      left: 108, top: 400, width: 864, height: 380, absolutePositioned: true,
    }));
    expect(img.clipPath).toMatchObject({ left: 108, top: 400, width: 864, height: 380, absolutePositioned: true });
  });

  it('removes the empty-state placeholder and any previously-placed artwork before adding the new photo', () => {
    const stale = [
      { name: 'tpl_artwork_placeholder' }, { name: 'tpl_artwork_hint' }, { name: 'tpl_artwork_img' }, { name: 'tpl_bg' },
    ];
    const canvas = makeFakeCanvas(stale);
    placeArtwork({ canvas, url: 'data:x', template: template() });
    expect(canvas.remove).toHaveBeenCalledTimes(3);
    expect(canvas._objects.find(o => o === stale[3])).toBe(stale[3]);
    expect(canvas._objects.filter(o => o.name === 'tpl_artwork_img')).toHaveLength(1);
  });

  it('routes a non-data URL through the image proxy', () => {
    const canvas = makeFakeCanvas();
    placeArtwork({ canvas, url: 'https://example.org/photo.jpg', template: template() });
    expect(window.fabric.Image.fromURL).toHaveBeenCalledWith(
      '/api/image-proxy?url=' + encodeURIComponent('https://example.org/photo.jpg'),
      expect.any(Function),
      { crossOrigin: 'anonymous' },
    );
  });

  it('bails out (no throw, logs an error) when canvas is missing', () => {
    expect(() => placeArtwork({ canvas: null, url: 'data:x', template: template() })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('no canvas'));
    expect(window.fabric.Image.fromURL).not.toHaveBeenCalled();
  });

  it('bails out when url is missing', () => {
    const canvas = makeFakeCanvas();
    expect(() => placeArtwork({ canvas, url: '', template: template() })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('no url'));
    expect(canvas.add).not.toHaveBeenCalled();
  });

  it('bails out when the template has no artworkSlot', () => {
    const canvas = makeFakeCanvas();
    expect(() => placeArtwork({ canvas, url: 'data:x', template: { id: 'no-slot' } })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('artworkSlot'));
    expect(canvas.add).not.toHaveBeenCalled();
  });

  it('bails out when template itself is missing', () => {
    const canvas = makeFakeCanvas();
    expect(() => placeArtwork({ canvas, url: 'data:x', template: null })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('artworkSlot'));
    expect(canvas.add).not.toHaveBeenCalled();
  });

  it('logs an error and adds nothing if Fabric fails to load the image', () => {
    window.fabric.Image.fromURL = vi.fn((url, callback) => callback(null));
    const canvas = makeFakeCanvas();
    placeArtwork({ canvas, url: 'data:x', template: template() });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('failed to load'), expect.anything());
    expect(canvas.add).not.toHaveBeenCalled();
  });
});
