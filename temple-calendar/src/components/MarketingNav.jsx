/**
 * MarketingNav - shared top header for the public marketing site
 * (Landing, Features, Pricing, Blog, About, Contact, Careers, Privacy,
 * Terms, Security). Extracted from PremiumLanding.jsx so every page gets
 * the same header and the same working links instead of duplicating this
 * markup everywhere.
 *
 * Two-row header (thin utility bar + main nav), both black — a deliberate
 * dark bookend around the white page body, same idea as MarketingFooter.jsx
 * staying black. Still strictly monochrome, no color accents.
 *
 * Because this header is taller than a single-row nav, every page using it
 * needs a bit more top padding on its first section — see the `md:pt-*`
 * bump alongside each page's base `pt-*` class.
 */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import PremiumButton from '../PremiumButton';
import BrandMark from './BrandMark';

export default function MarketingNav() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // "About" carries Features and Blog as a dropdown (Uber's own nav does the
  // same thing with its "About" menu) -- click-to-open so it works on touch,
  // closes on an outside click or on Escape.
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutMenuPos, setAboutMenuPos] = useState(null);
  const aboutRef = useRef(null);
  const aboutMenuRef = useRef(null);

  useEffect(() => {
    if (!aboutOpen) return;
    const rect = aboutRef.current?.getBoundingClientRect();
    if (rect) setAboutMenuPos({ top: rect.bottom + 12, left: rect.left });

    // The menu itself is portaled to document.body (see below) to escape
    // page-level overflow-hidden ancestors, so it's no longer a DOM
    // descendant of aboutRef -- contains() on aboutRef alone treats every
    // click on a menu item as "outside" and closes the menu on mousedown,
    // one tick before the item's own onClick (navigate) would have fired.
    // Checking aboutMenuRef too was the missing half of that fix.
    const handleOutside = (e) => {
      if (
        aboutRef.current && !aboutRef.current.contains(e.target) &&
        aboutMenuRef.current && !aboutMenuRef.current.contains(e.target)
      ) setAboutOpen(false);
    };
    const handleEscape = (e) => { if (e.key === 'Escape') setAboutOpen(false); };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [aboutOpen]);

  return (
    <div className="fixed top-0 w-full z-50">
      {/* Utility bar — Contact Sales lives only in the pricing/enterprise
          sections now (PremiumLanding.jsx's pricing section,
          PricingMarketingPage.jsx's enterprise callout), not on every page,
          so it doesn't compete with the actual page CTAs. */}
      <div className="hidden md:block border-b border-white/10 bg-black">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-end gap-4 text-xs text-white/60">
          <a href="mailto:support@calendarflyapp.com" className="hover:text-white transition-colors">
            support@calendarflyapp.com
          </a>
        </div>
      </div>

      {/* Main nav — cf-mkt-shine adds a slow diagonal light sweep across the
          bar (see index.css); a few .cf-sparkle dots twinkle near the CTA. */}
      <nav
        className="cf-mkt-shine transition-all duration-300 border-b border-white/10"
        style={{
          background: scrollY > 50 ? 'rgba(0, 0, 0, 0.97)' : 'rgba(0, 0, 0, 0.9)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <span className="cf-sparkle" style={{ width: 3, height: 3, top: '30%', right: '18%', animationDelay: '0.4s' }} aria-hidden="true" />
        <span className="cf-sparkle" style={{ width: 2, height: 2, top: '65%', right: '30%', animationDelay: '1.3s' }} aria-hidden="true" />
        <span className="cf-sparkle" style={{ width: 2, height: 2, top: '25%', right: '45%', animationDelay: '2.1s' }} aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-3">
            <BrandMark size={56} light />
            <span className="flex flex-col items-start leading-none">
              <span
                className="cf-shine-text text-4xl font-extrabold"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                CalendarFly
              </span>
              <span className="hidden sm:block text-xs tracking-wide text-white font-bold mt-1">
                Events simplified, Community amplified
              </span>
            </span>
          </button>

          <div className="hidden md:flex items-center gap-8">
            {/* cf-shine-text gives each link the same shimmering-white
                treatment as the wordmark; staggered animationDelay values
                (inline style beats the class's shorthand, same trick as the
                sparkle dots above) make the shimmer cascade left to right
                instead of all four links flashing in lockstep. (About's dropdown items aren't part of that cascade -- they only exist once opened.) */}
            <button onClick={() => navigate('/explore')} className="cf-shine-text text-base font-bold hover:opacity-80 transition-opacity" style={{ animationDelay: '0s' }}>
              Explore
            </button>
            {/* Anchors to the homepage's "For organizations" section (see
                PremiumLanding.jsx's scroll-to-hash effect) rather than its
                own page -- that page doesn't exist yet, this is the lighter
                first step of the role-based nav split. */}
            <button onClick={() => navigate('/#for-organizations')} className="cf-shine-text text-base font-bold hover:opacity-80 transition-opacity" style={{ animationDelay: '0.3s' }}>For Organizations</button>
            <div ref={aboutRef} className="relative">
              <button
                onClick={() => setAboutOpen((v) => !v)}
                aria-expanded={aboutOpen}
                className="cf-shine-text text-base font-bold hover:opacity-80 transition-opacity flex items-center gap-1.5"
                style={{ animationDelay: '0.6s' }}
              >
                About
                <span style={{ fontSize: '0.7em', transform: aboutOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
              </button>
              {aboutOpen && aboutMenuPos && createPortal(
                <div
                  ref={aboutMenuRef}
                  className="rounded-xl border border-white/10 overflow-hidden"
                  style={{
                    position: 'fixed',
                    top: aboutMenuPos.top,
                    left: aboutMenuPos.left,
                    background: 'rgba(10,10,10,0.98)',
                    backdropFilter: 'blur(20px)',
                    minWidth: 180,
                    zIndex: 100,
                  }}
                >
                  <button
                    onClick={() => { setAboutOpen(false); navigate('/about'); }}
                    className="w-full text-left px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                  >
                    About CalendarFly
                  </button>
                  <button
                    onClick={() => { setAboutOpen(false); navigate('/features'); }}
                    className="w-full text-left px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors border-t border-white/10"
                  >
                    Features
                  </button>
                  <button
                    onClick={() => { setAboutOpen(false); navigate('/blog'); }}
                    className="w-full text-left px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition-colors border-t border-white/10"
                  >
                    Blog
                  </button>
                </div>,
                document.body
              )}
            </div>
            <button onClick={() => navigate('/contact')} className="cf-shine-text text-base font-bold hover:opacity-80 transition-opacity" style={{ animationDelay: '0.9s' }}>Contact</button>
            <PremiumButton onClick={() => navigate('/signup')} size="sm" variant="mono">
              Start Free Today
            </PremiumButton>
          </div>
        </div>
      </nav>
    </div>
  );
}
