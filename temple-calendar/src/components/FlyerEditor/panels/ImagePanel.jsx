import React from 'react';
import { STYLES } from '../constants';

const { sectionLabel: sL, input: inp } = STYLES;

const STOCK_CATEGORIES = [
  { label: '🌸 Garland',  q: 'flower garland temple indian' },
  { label: '🪔 Deepam',   q: 'oil lamp deepam diya temple' },
  { label: '🎨 Rangoli',  q: 'rangoli colorful indian festival' },
  { label: '🌺 Marigold', q: 'marigold flowers decoration indian' },
  { label: '🐘 Elephant', q: 'decorated elephant temple india' },
  { label: '🪷 Lotus',    q: 'lotus flower water pink' },
  { label: '🎊 Festival', q: 'indian festival celebration colorful' },
  { label: '🕌 Temple',   q: 'hindu temple gopuram india' },
  { label: '🌙 Diwali',   q: 'diwali lights candles festival' },
  { label: '🌾 Harvest',  q: 'pongal harvest festival india' },
  { label: '🎭 Navratri', q: 'navratri garba festival dance' },
  { label: '🌿 Thoran',   q: 'mango leaves torana temple decoration' },
];

const LIBRARY_CATS = ['All', 'Deities', 'Garlands', 'Rangoli', 'Festival', 'Decor'];

const CROP_PRESETS = [
  { label: '1:1',  val: '1:1'  },
  { label: '4:3',  val: '4:3'  },
  { label: '3:4',  val: '3:4'  },
  { label: '16:9', val: '16:9' },
  { label: 'Free', val: null   },
];
export default function ImagePanel({
  imageTab, setImageTab,
  // Library
  libraryLoading, libraryError, filteredLibrary,
  libraryCat, setLibraryCat,
  // Stock
  stockResults, stockLoading, stockError,
  stockQuery, stockSearchInput, setStockSearchInput,
  handleStockSearch,
  // AI
  genPrompt, setGenPrompt,
  generating, genSeconds, genError,
  handleGenerate,
  // Image adjustments
  applyFilter,
  applyBlur,
  handleCrop,
  handleRemoveBgApi,
  removingBg,
  selectedObject,
  onPlaceImage,
  onDragStart,
  onDragEnd,
}) {
  const isImageSelected = selectedObject?.type === 'image';
  return (
    <div>
      <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.95rem', marginBottom: 10 }}>🖼 Images</div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', background: '#0f172a', borderRadius: 8, padding: 3, marginBottom: 14, gap: 2 }}>
        {[
          // { id: 'library', label: '📚 Library' }, // hidden until S3 deployed
          { id: 'stock',   label: '🔍 Stock'   },
          { id: 'ai',      label: '✨ AI Gen'  },
        ].map(tab => (
          <button key={tab.id} onClick={() => setImageTab(tab.id)} style={{
            flex: 1, padding: '6px 2px', border: 'none', borderRadius: 6, cursor: 'pointer',
            background: imageTab === tab.id ? '#c2410c' : 'transparent',
            color: imageTab === tab.id ? 'white' : '#64748b',
            fontSize: '0.75rem', fontWeight: imageTab === tab.id ? '700' : '500',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── LIBRARY ── */}
      {imageTab === 'library' && (
        <div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {LIBRARY_CATS.map(cat => (
              <button key={cat} onClick={() => setLibraryCat(cat)} style={{
                padding: '5px 10px',
                border: `1px solid ${libraryCat === cat ? '#c2410c' : '#475569'}`,
                background: libraryCat === cat ? '#c2410c' : '#1e293b',
                color: 'white', borderRadius: 20, cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: libraryCat === cat ? '700' : '400',
              }}>{cat}</button>
            ))}
          </div>

          {libraryLoading && <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', padding: '20px 0' }}>Loading library…</div>}
          {libraryError  && <div style={{ color: '#fca5a5', fontSize: '0.78rem', background: 'rgba(220,38,38,0.1)', padding: '10px', borderRadius: 6, marginBottom: 8, lineHeight: 1.6 }}>⚠ {libraryError}</div>}

          {!libraryLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
              {filteredLibrary.map((img, i) => (
                <div key={i}
                  onClick={() => onPlaceImage(img.url)}
                  draggable="true"
                  onDragStart={e => {
                    e.dataTransfer.setData('imageUrl', img.url);
                    e.dataTransfer.setData('text/plain', img.url);
                    e.dataTransfer.effectAllowed = 'copy';
                    onDragStart?.(img.url);
                  }}
                  onDragEnd={() => onDragEnd?.()}
                  style={{
                    cursor: 'grab', borderRadius: 7, overflow: 'hidden',
                    border: '2px solid #1e293b', aspectRatio: '1', background: '#0f172a',
                    transition: 'border-color 0.15s, transform 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#c2410c'; e.currentTarget.style.transform = 'scale(1.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <img src={img.thumb || img.url} alt={img.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                </div>
              ))}
              {filteredLibrary.length === 0 && !libraryLoading && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', padding: '20px 0', lineHeight: 2 }}>
                  No images yet.<br />
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Upload to S3:<br />temple-images/library/{libraryCat === 'All' ? 'Deities' : libraryCat}/
                  </span>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 7, fontSize: '0.72rem', color: '#a5b4fc', lineHeight: 1.8 }}>
            💡 Click to place · Drag onto canvas
          </div>
        </div>
      )}

      {/* ── STOCK ── */}
      {imageTab === 'stock' && (
        <div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {STOCK_CATEGORIES.map(({ label, q }) => (
              <button key={q} onClick={() => handleStockSearch(q)} style={{
                padding: '4px 9px',
                border: `1px solid ${stockQuery === q ? '#c2410c' : '#334155'}`,
                background: stockQuery === q ? '#c2410c' : '#0f172a',
                color: 'white', borderRadius: 20, cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: '500',
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
            <input value={stockSearchInput} onChange={e => setStockSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleStockSearch(stockSearchInput)}
              placeholder="e.g. rangoli, deepam, lotus..."
              style={{ ...inp, flex: 1, marginBottom: 0, fontSize: '0.75rem' }} />
            <button onClick={() => handleStockSearch(stockSearchInput)}
              style={{ padding: '0 12px', background: '#c2410c', border: 'none', color: 'white', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem' }}>🔍</button>
          </div>

          {stockLoading && <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', padding: '20px 0' }}>Searching…</div>}
          {stockError  && <div style={{ color: '#fca5a5', fontSize: '0.78rem', background: 'rgba(220,38,38,0.1)', padding: '10px', borderRadius: 6, marginBottom: 8 }}>⚠ {stockError}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
            {stockResults.map((img, i) => (
              <div key={i}
                onClick={() => onPlaceImage(img.largeImageURL || img.webformatURL)}
                draggable="true"
                onDragStart={e => {
                  const url = img.largeImageURL || img.webformatURL;
                  e.dataTransfer.setData('imageUrl', url);
                  e.dataTransfer.setData('text/plain', url);
                  e.dataTransfer.effectAllowed = 'copy';
                  onDragStart?.(url);
                }}
                onDragEnd={() => onDragEnd?.()}
                title={img.tags} style={{
                  cursor: 'grab', borderRadius: 7, overflow: 'hidden',
                  border: '2px solid #1e293b', aspectRatio: '1', background: '#0f172a',
                  transition: 'border-color 0.15s, transform 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#c2410c'; e.currentTarget.style.transform = 'scale(1.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <img src={img.previewURL} alt={img.tags}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
              </div>
            ))}
            {!stockLoading && stockResults.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', padding: '20px 0' }}>
                Click a category or search above
              </div>
            )}
          </div>
          {stockResults.length > 0 && <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#64748b', textAlign: 'center' }}>Free images from Pixabay</div>}
        </div>
      )}

      {/* ── AI GENERATE ── */}
      {imageTab === 'ai' && (
        <div>
          <span style={sL}>Customize Prompt</span>
          <textarea value={genPrompt} onChange={e => setGenPrompt(e.target.value)} rows={7}
            style={{ ...inp, resize: 'vertical', lineHeight: 1.5, fontSize: '0.72rem', marginBottom: 6 }} />
          <div style={{ color: '#64748b', fontSize: '0.68rem', marginBottom: 12 }}>Auto-generated from event type. Edit to customize.</div>

          <button onClick={handleGenerate} disabled={generating} style={{
            width: '100%', padding: '12px',
            background: generating ? '#1e293b' : 'linear-gradient(135deg,#c2410c,#7c2d12)',
            color: 'white', border: generating ? '1px solid #334155' : 'none',
            borderRadius: 8, cursor: generating ? 'not-allowed' : 'pointer',
            fontWeight: 'bold', fontSize: '0.85rem', marginBottom: 8,
          }}>
            {generating
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                  Generating… {genSeconds}s
                </span>
              : '✨ Generate Deity Image'}
          </button>

          {generating && (
            <div style={{ width: '100%', height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#c2410c,#f97316)', borderRadius: 2, width: `${Math.min((genSeconds / 60) * 100, 95)}%`, transition: 'width 1s linear' }} />
            </div>
          )}
          {genError && <div style={{ color: '#fca5a5', fontSize: '0.75rem', background: 'rgba(220,38,38,0.1)', padding: '8px', borderRadius: 6, marginBottom: 8 }}>⚠ {genError}</div>}

          <div style={{ padding: '8px 10px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 7, fontSize: '0.72rem', color: '#a5b4fc', lineHeight: 1.6 }}>
            💡 AI works best for deity images. Use Stock tab for garlands, rangoli & decor.
          </div>
        </div>
      )}

      {/* ── IMAGE EDIT TOOLS — shown when an image is selected ── */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #1e293b' }}>
        <span style={sL}>Edit Selected Image</span>
        {!isImageSelected && (
          <div style={{ color: '#475569', fontSize: '0.75rem', marginBottom: 12, fontStyle: 'italic' }}>
            Click an image on the canvas to see edit options
          </div>
        )}
        {isImageSelected && (
          <>
            {/* Crop presets */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: '#cbd5e1', fontSize: '0.75rem', fontWeight: '600', marginBottom: 6 }}>✂ Crop</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {CROP_PRESETS.map(({ label, val }) => (
                  <button key={label}
                    onClick={() => val ? handleCrop(val) : null}
                    style={{
                      padding: '4px 10px', border: '1px solid #334155',
                      background: '#0f172a', color: '#cbd5e1',
                      borderRadius: 6, cursor: 'pointer', fontSize: '0.72rem',
                    }}>{label}</button>
                ))}
              </div>
            </div>
            {/* Remove background */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: '#cbd5e1', fontSize: '0.75rem', fontWeight: '600', marginBottom: 6 }}>🪄 Remove Background</div>
              <button onClick={handleRemoveBgApi} disabled={removingBg} style={{
                width: '100%', padding: '10px',
                background: removingBg ? '#1e293b' : 'linear-gradient(135deg,#6366f1,#4338ca)',
                color: 'white', border: removingBg ? '1px solid #334155' : 'none',
                borderRadius: 8, cursor: removingBg ? 'not-allowed' : 'pointer',
                fontWeight: '600', fontSize: '0.8rem',
              }}>
                {removingBg
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                      Removing…
                    </span>
                  : '🪄 Remove Background'}
              </button>
              <div style={{ color: '#475569', fontSize: '0.65rem', marginTop: 4 }}>
                Requires REMOVE_BG_API_KEY in server .env
              </div>
            </div>
            {/* Blur */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: '#cbd5e1', fontSize: '0.75rem', fontWeight: '600', marginBottom: 6 }}>💧 Blur</div>
              <input type="range" min="0" max="100" defaultValue="0"
                style={{ width: '100%', accentColor: '#c2410c' }}
                onChange={e => applyBlur(+e.target.value)} />
            </div>
          </>
        )}
        {/* Brightness & Contrast — always visible */}
        {['Brightness', 'Contrast'].map(type => (
          <label key={type} style={{ display: 'block', color: '#94a3b8', marginBottom: 12 }}>
            <div style={{ fontSize: '0.75rem', marginBottom: 4 }}>{type === 'Brightness' ? '☀' : '◑'} {type}</div>
            <input type="range" min="-100" max="100" defaultValue="0"
              style={{ width: '100%', accentColor: '#c2410c' }}
              onChange={e => applyFilter(type, +e.target.value)} />
          </label>
        ))}
      </div>
    </div>
  );
}
