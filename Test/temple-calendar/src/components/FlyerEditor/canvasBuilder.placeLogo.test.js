/**
 * canvasBuilder.placeLogo.test.js
 *
 * Regression coverage for "uploading a logo does nothing" (reported live in
 * both AI mode and DIY mode — both call this exact same function via
 * index.jsx's handleUpload). placeLogo() is a pure function of
 * (canvas, url, dims, scale), so it's tested directly here instead of
 * through the full FlyerEditor UI — that would also require faking most of
 * the Fabric.js surface (buildFlyer uses Rect/Textbox/Group/Line/Circle),
 * which buys nothing extra for THIS bug.
 *
 * This suite passes end to end, which narrows the bug: placement math,
 * dedup-before-replace, and the canvas/url/dims guards are all correct. If
 * the live symptom persists, the cause is upstream of this function — most
 * likely Fabric.js not finished loading yet (useFabric.js loads it async
 * from a CDN) or a z-order/rebuild race, not the placement logic itself.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { placeLogo } from './canvasBuilder';

function makeFabricImage(width = 200, height = 100) {
  // Real Fabric objects' .set() assigns the given properties onto the
  // object itself (it's a chainable setter, not a no-op) — mirrored here
  // so assertions can inspect img.name / img.left / img.scaleX afterward,
  // the same way the real canvas ends up with a positioned, named object.
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
    renderAll: vi.fn(),
    _objects: objects,
  };
}

beforeEach(() => {
  // placeLogo reaches Fabric only through window.fabric.Image.fromURL —
  // stub just that surface, matching what the real Fabric v5 UMD build
  // (loaded from cdnjs at runtime, see useFabric.js) exposes.
  global.window.fabric = {
    Image: {
      fromURL: vi.fn((url, callback) => callback(makeFabricImage())),
    },
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('placeLogo', () => {
  const dims = { w: 500, h: 700 };

  it('places two logo copies (left + right corner) on a valid canvas', () => {
    const canvas = makeFakeCanvas();
    placeLogo({ canvas, url: 'data:image/png;base64,xyz', dims });

    expect(window.fabric.Image.fromURL).toHaveBeenCalledTimes(2);
    expect(canvas.add).toHaveBeenCalledTimes(2);
    expect(canvas.renderAll).toHaveBeenCalledTimes(2);
    expect(canvas._objects).toHaveLength(2);
  });

  it('positions the right-corner copy using dims.w', () => {
    const canvas = makeFakeCanvas();
    placeLogo({ canvas, url: 'data:x', dims });
    const rightImg = canvas._objects[1];
    // left corner is placed at x=14 (LOGO_MARGIN), right corner at
    // dims.w - LOGO_MARGIN - LOGO_BOX (14 + 150, see canvasBuilder.js)
    expect(rightImg.set).toHaveBeenCalledWith(expect.objectContaining({ left: dims.w - 164, name: 'logo_r' }));
  });

  it('removes any previously-placed logo_l/logo_r before adding new ones', () => {
    const stale = [{ name: 'logo_l' }, { name: 'logo_r' }, { name: 'bg' }];
    const canvas = makeFakeCanvas(stale);
    placeLogo({ canvas, url: 'data:x', dims });
    // the two stale logo objects were removed, 'bg' was left alone, two new logos were added
    expect(canvas.remove).toHaveBeenCalledTimes(2);
    expect(canvas._objects.find(o => o === stale[2])).toBe(stale[2]);
    expect(canvas._objects.filter(o => o.name === 'logo_l' || o.name === 'logo_r')).toHaveLength(2);
  });

  it('uses the default ~150px-box scale when no custom scale is given', () => {
    const canvas = makeFakeCanvas();
    placeLogo({ canvas, url: 'data:x', dims });
    const [leftImg] = canvas._objects;
    // makeFabricImage() is 200x100 -> min(150/200, 150/100) = 0.75
    expect(leftImg.set).toHaveBeenCalledWith(expect.objectContaining({ scaleX: 0.75, scaleY: 0.75 }));
  });

  it('honors a previously-chosen (manually resized) scale instead of the default', () => {
    const canvas = makeFakeCanvas();
    placeLogo({ canvas, url: 'data:x', dims, scale: 0.75 });
    const [leftImg] = canvas._objects;
    expect(leftImg.set).toHaveBeenCalledWith(expect.objectContaining({ scaleX: 0.75, scaleY: 0.75 }));
  });

  it('bails out (no throw, logs an error) when canvas is missing', () => {
    expect(() => placeLogo({ canvas: null, url: 'data:x', dims })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('no canvas'));
    expect(window.fabric.Image.fromURL).not.toHaveBeenCalled();
  });

  it('bails out when url is missing (e.g. FileReader never resolved)', () => {
    const canvas = makeFakeCanvas();
    expect(() => placeLogo({ canvas, url: '', dims })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('no url'));
    expect(canvas.add).not.toHaveBeenCalled();
  });

  it('bails out when dims is missing (would otherwise crash on dims.w)', () => {
    const canvas = makeFakeCanvas();
    expect(() => placeLogo({ canvas, url: 'data:x', dims: null })).not.toThrow();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('no dims'));
    expect(canvas.add).not.toHaveBeenCalled();
  });

  it('logs an error and adds nothing if Fabric fails to load the image (bad/corrupt file)', () => {
    window.fabric.Image.fromURL = vi.fn((url, callback) => callback(null));
    const canvas = makeFakeCanvas();
    placeLogo({ canvas, url: 'data:x', dims });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('failed to load'));
    expect(canvas.add).not.toHaveBeenCalled();
  });
});
