import { useState, useEffect } from 'react';

/**
 * useImageLibrary
 * Manages the curated S3 image library + Pixabay stock search.
 * Extracted from FlyerEditor to keep concerns separate.
 */
export const useImageLibrary = (imageTab) => {
  // ── Curated Library ──────────────────────────────────────────────────────
  const [libraryImages,    setLibraryImages]    = useState([]);
  const [libraryLoading,   setLibraryLoading]   = useState(false);
  const [libraryError,     setLibraryError]     = useState('');
  const [libraryCat,       setLibraryCat]       = useState('All');

  // ── Stock Search ─────────────────────────────────────────────────────────
  const [stockResults,     setStockResults]     = useState([]);
  const [stockLoading,     setStockLoading]     = useState(false);
  const [stockError,       setStockError]       = useState('');
  const [stockQuery,       setStockQuery]       = useState('');
  const [stockSearchInput, setStockSearchInput] = useState('');

  // ── Background Templates (Pixabay, kept separate from Photo/Stock above
  // so browsing one never clobbers the other) ──────────────────────────────
  const [bgTemplateResults, setBgTemplateResults] = useState([]);
  const [bgTemplateLoading, setBgTemplateLoading] = useState(false);
  const [bgTemplateError,   setBgTemplateError]   = useState('');
  const [bgTemplateQuery,   setBgTemplateQuery]   = useState('');

  // ── Load S3 library when Library tab is active ───────────────────────────
  useEffect(() => {
    if (imageTab !== 'library') return;

    const loadLibrary = async () => {
      setLibraryLoading(true);
      setLibraryError('');
      try {
        const res = await fetch('/api/image-library');
        if (!res.ok) throw new Error(`Could not load library (${res.status})`);
        const data = await res.json();
        console.log('[image-library] response:', data);
        if (data.error) console.warn('[image-library] server warning:', data.error);
        setLibraryImages(data.images || []);
        if ((data.images || []).length === 0) {
          setLibraryError('No images found. Upload to svtemple-flyers/temple-images/library/');
        }
      } catch (err) {
        console.error('[image-library] error:', err.message);
        setLibraryImages([]);
        setLibraryError(err.message);
      } finally {
        setLibraryLoading(false);
      }
    };

    loadLibrary();
  }, [imageTab]);

  // ── Filtered library by category ─────────────────────────────────────────
  const filteredLibrary = libraryCat === 'All'
    ? libraryImages
    : libraryImages.filter(img => img.category === libraryCat);

  // ── Pixabay stock search ──────────────────────────────────────────────────
  const handleStockSearch = async (query) => {
    if (!query.trim()) return;
    setStockQuery(query);
    setStockSearchInput(query);
    setStockLoading(true);
    setStockError('');
    setStockResults([]);
    try {
      const res = await fetch(`/api/pixabay-search?q=${encodeURIComponent(query)}&per_page=18`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Search failed (${res.status}) — check PIXABAY_API_KEY in server .env`);
      }
      const data = await res.json();
      console.log('[pixabay] results:', data.hits?.length, 'for:', query);
      setStockResults(data.hits || []);
      if ((data.hits || []).length === 0) {
        setStockError('No images found — try a different search term');
      }
    } catch (err) {
      setStockError(err.message || 'Search failed');
    } finally {
      setStockLoading(false);
    }
  };

  // ── Background template search (Pixabay) ─────────────────────────────────
  // Same API as the Photo/Stock search above, but writes into its own state
  // so a "🖼 Background Templates" grid (BackgroundTemplatesSection,
  // BrandEditFields.jsx) can live right next to the Background upload card
  // in both AI and DIY mode without disturbing whatever the Photo tab is
  // currently showing.
  const handleBgTemplateSearch = async (query) => {
    if (!query.trim()) return;
    setBgTemplateQuery(query);
    setBgTemplateLoading(true);
    setBgTemplateError('');
    setBgTemplateResults([]);
    try {
      const res = await fetch(`/api/pixabay-search?q=${encodeURIComponent(query)}&per_page=12`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Search failed (${res.status}) — check PIXABAY_API_KEY in server .env`);
      }
      const data = await res.json();
      setBgTemplateResults(data.hits || []);
      if ((data.hits || []).length === 0) {
        setBgTemplateError('No templates found — try another category');
      }
    } catch (err) {
      setBgTemplateError(err.message || 'Search failed');
    } finally {
      setBgTemplateLoading(false);
    }
  };

  // Pre-load one category ("Wood") on first mount so the Background
  // Templates grid shows real thumbnails right away — like the reference
  // grid the user pointed to — instead of an empty "click a category" state.
  useEffect(() => {
    handleBgTemplateSearch('wood plank texture background');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // Library
    libraryImages, libraryLoading, libraryError,
    libraryCat, setLibraryCat,
    filteredLibrary,
    // Stock
    stockResults, stockLoading, stockError,
    stockQuery, stockSearchInput, setStockSearchInput,
    handleStockSearch,
    // Background Templates
    bgTemplateResults, bgTemplateLoading, bgTemplateError, bgTemplateQuery,
    handleBgTemplateSearch,
  };
};
